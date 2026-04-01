"""
High-performance batch question generator for the level test.

Key optimizations over the old 1-call-per-question approach:
  1. ONE LLM call generates ALL 5 questions for a subject (5× fewer calls)
  2. Subjects are processed in PARALLEL via ThreadPoolExecutor
  3. Questions are CACHED by (subject, difficulty, topic) — identical
     requests skip the LLM entirely
  4. Prompt is SHORT and tightly structured (less tokens = faster)
  5. Lower num_predict cap so the LLM stops sooner
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core import config
from core.rag_service import RAGService
from generation.level_test_quality import reject_level_test_question, topic_slot_aligned
from generation.prompt_templates import build_level_test_batch_prompt
from generation.question_generator import (
    canonicalize_correct_answer_in_place,
    generate_level_test_question,
    parse_json_value,
    repair_to_strict_json,
)
from rag.rag_prompt_builder import extract_json_from_response
from utils import langchain_ollama

logger = logging.getLogger("batch_qgen")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)

_question_cache: dict[str, list[dict]] = {}
MAX_CACHE = 500
_MAX_WORKERS = 1
def _strip_accents(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def _extract_key_terms(text: str, min_length: int = 3) -> list[str]:
    norm = _strip_accents(str(text or "")).lower()
    toks = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", norm)
    stop = {
        "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "en",
        "est", "sont", "dans", "pour", "avec", "sur", "par", "au", "aux",
        "que", "qui", "quoi", "comme", "this", "that", "with", "from",
    }
    out: list[str] = []
    seen: set[str] = set()
    for t in toks:
        if len(t) < min_length or t in stop or t in seen:
            continue
        seen.add(t)
        out.append(t)
    # keep common C tokens when present
    for kw in ["int", "char", "float", "double", "printf", "scanf", "malloc", "free", "return", "if", "for", "while", "pointeur", "pointer"]:
        if kw in norm and kw not in seen:
            out.append(kw)
            seen.add(kw)
    return out[:30]


def _question_signature(q: dict[str, Any]) -> str:
    qt = _strip_accents(str(q.get("question") or "")).lower().strip()
    opts = [_strip_accents(str(x)).lower().strip() for x in (q.get("options") or [])]
    opts = [o for o in opts if o]
    return f"{qt}|{'|'.join(sorted(opts))}"


def _quality_ok(
    q: dict[str, Any],
    context: str,
    slot_topic: str | None = None,
) -> bool:
    # Required keys and non-empty
    if not isinstance(q, dict):
        return False
    for k in ("question", "options", "correct_answer"):
        if not q.get(k):
            return False
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False

    canonicalize_correct_answer_in_place(q)

    if reject_level_test_question(q, slot_topic=slot_topic, course_context=context) is not None:
        return False

    if slot_topic is not None and not topic_slot_aligned(q, slot_topic):
        return False

    # Correct answer must exactly match one option (trim quotes/spaces)
    cn = _strip_accents(str(q.get("correct_answer"))).lower().strip().strip('"').strip("'")
    on = [
        _strip_accents(str(x)).lower().strip().strip('"').strip("'")
        for x in opts
    ]
    if cn not in on:
        return False

    # Options must be genuinely distinct (avoid "reels" vs "types reels")
    collapsed = [re.sub(r"\s+", " ", x) for x in on]
    if len(set(collapsed)) < 4:
        return False
    base = [re.sub(r"^(type|types)\s+", "", x) for x in collapsed]
    if len(set(base)) < 3:
        return False
    for i in range(len(base)):
        for j in range(i + 1, len(base)):
            a, b = base[i], base[j]
            if a and b and (a in b or b in a):
                return False

    # Avoid lazy "all of the above" patterns
    if "tous les elements" in cn or "all of the above" in cn:
        return False

    # Grounding check against context terms
    terms = _extract_key_terms(context, min_length=3)
    if not terms:
        return False
    combined = _strip_accents(
        f"{q.get('question', '')} {' '.join(str(x) for x in opts)} {q.get('correct_answer', '')}"
    ).lower()
    return any(t in combined for t in terms[:20])


def _regen_single_question(subject_title: str, topic: str, diff: str) -> dict[str, Any] | None:
    """Regenerate one high-quality question through strict single-question pipeline."""
    try:
        q = generate_level_test_question(subject=subject_title, difficulty=diff, topic=topic)
        if isinstance(q, dict):
            return q
    except Exception:
        return None
    return None


def _generate_level_test_llm(prompt: str) -> str:
    """Dedicated model for level-test batch (OLLAMA_LEVEL_TEST_MODEL in config / .env)."""
    primary = getattr(config, "OLLAMA_LEVEL_TEST_MODEL", None) or config.OLLAMA_MODEL
    text = langchain_ollama.generate_with_model(prompt, primary)
    if text:
        return text
    fb = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL_FALLBACK", None) or "").strip()
    if fb:
        text = langchain_ollama.generate_with_model(prompt, fb)
        if text:
            return text
    return langchain_ollama.generate_response(prompt)


def _cache_key(
    subject: str,
    topics: list[str],
    difficulty: str,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
) -> str:
    version = "v13_ordinal_skip_workflow_etapes_topic"
    cid = "|".join(sorted(course_ids)) if course_ids else ""
    qcid = "|".join(question_course_ids or [])
    raw = f"{version}|{subject}|{difficulty}|{cid}|{qcid}|{'|'.join(sorted(topics))}"
    return hashlib.md5(raw.encode()).hexdigest()


def _normalise_question(q: dict) -> dict | None:
    """Map short keys (q/o/a/d/t/e) to full names and validate."""
    _MAP = {
        "q": "question",
        "o": "options",
        "a": "correct_answer",
        "d": "difficulty",
        "t": "topic",
        "e": "explanation",
    }
    out: dict = {}
    for short, full in _MAP.items():
        out[full] = q.get(full) or q.get(short)
    out.setdefault("explanation", q.get("explanation", ""))
    if not out.get("question"):
        return None
    return out


def _extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array of question objects from LLM output."""
    text = (text or "").strip()
    if not text:
        return []

    parsed = parse_json_value(text)
    if parsed is None:
        # Second-chance: ask model to reformat into strict JSON.
        parsed = repair_to_strict_json(text, model_name=getattr(config, "OLLAMA_LEVEL_TEST_MODEL", None))
    if isinstance(parsed, list):
        normed = [_normalise_question(q) for q in parsed if isinstance(q, dict)]
        normed = [q for q in normed if q]
        if normed:
            return normed
    if isinstance(parsed, dict):
        q = _normalise_question(parsed)
        return [q] if q else []

    # Fallback: shallow object scan (legacy models with broken outer braces)
    questions: list[dict] = []
    for obj_match in re.finditer(r'\{[^{}]*"q(?:uestion)?"[^{}]*\}', text, re.DOTALL):
        try:
            raw = json.loads(obj_match.group())
            q = _normalise_question(raw)
            if q:
                questions.append(q)
        except json.JSONDecodeError:
            continue

    if not questions:
        try:
            raw = extract_json_from_response(text)
            if isinstance(raw, dict):
                q = _normalise_question(raw)
                if q:
                    questions.append(q)
        except ValueError:
            pass

    return questions


def _build_batch_prompt(
    subject: str,
    topics: list[str],
    difficulties: list[str],
    context: str,
    count: int,
) -> str:
    """Structured prompt: grounded MCQs from RAG reference text (uses prompt_templates rubric)."""
    pairs = []
    for i in range(count):
        t = topics[i] if i < len(topics) else topics[0]
        d = difficulties[i] if i < len(difficulties) else "medium"
        pairs.append(f"{i+1}. topic=\"{t}\" difficulty=\"{d}\"")
    specs = "\n".join(pairs)
    return build_level_test_batch_prompt(subject, specs, context, count)


def generate_batch_for_subject(
    subject_title: str,
    topics: list[str],
    difficulties: list[str],
    count: int = 5,
    rag_service: RAGService | None = None,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
    use_cache: bool = True,
) -> list[dict[str, Any]]:
    """
    Generate *count* questions for one subject in a SINGLE LLM call.

    Falls back to individual calls if batch parsing fails, and to
    template questions as last resort.

    If ``course_ids`` is set (e.g. all chapter IDs sharing a curriculum subject),
    RAG context is restricted to those courses' chunks.
    """
    t0 = time.perf_counter()

    ck = _cache_key(
        subject_title,
        topics[:count],
        "|".join(difficulties[:count]),
        course_ids,
        (question_course_ids or [])[:count],
    )
    if use_cache and ck in _question_cache:
        logger.info(
            "Cache HIT for %s (%d questions)",
            subject_title,
            len(_question_cache[ck]),
        )
        return _question_cache[ck]

    if rag_service is None:
        rag_service = RAGService.get_instance()

    query = f"{subject_title} {' '.join(topics[:5])}"
    if course_ids:
        context = rag_service.get_context_for_course_ids(
            query,
            course_ids,
            max_chunks=10,
        )
        if not (context or "").strip():
            context = rag_service.get_context_for_query(query, max_chunks=8)
    else:
        context = rag_service.get_context_for_query(query, max_chunks=8)

    prompt = _build_batch_prompt(subject_title, topics, difficulties, context, count)
    if question_course_ids:
        course_slots = []
        for i in range(count):
            cid = question_course_ids[i] if i < len(question_course_ids) else ""
            course_slots.append(f"{i+1}. course_id=\"{cid}\"")
        prompt += (
            "\n\nCOURSE DISTRIBUTION CONSTRAINT:\n"
            "Each question index must be grounded in its mapped course_id/chapter context.\n"
            + "\n".join(course_slots)
        )

    questions: list[dict] = []
    try:
        # Use the stronger default model for quality (not the ultra-fast bulk path).
        raw = _generate_level_test_llm(prompt)
        questions = _extract_json_array(raw)
        logger.info(
            "Batch LLM for %s: parsed %d/%d questions in %.1fs",
            subject_title, len(questions), count, time.perf_counter() - t0,
        )
    except Exception as exc:
        logger.warning("Batch generation failed for %s: %s", subject_title, exc)

    # Quality filter + dedupe (prevents repeated or step-based questions)
    cleaned: list[dict[str, Any]] = []
    seen_signatures: set[str] = set()
    for i, q in enumerate(questions):
        slot_topic = topics[min(i, len(topics) - 1)] if topics else None
        if not _quality_ok(q, context, slot_topic=slot_topic):
            continue
        sig = _question_signature(q)
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)
        cleaned.append(q)
    questions = cleaned

    if len(questions) < count:
        for i in range(len(questions), count):
            topic = topics[i] if i < len(topics) else topics[i % len(topics)]
            diff = difficulties[i] if i < len(difficulties) else "medium"
            # Regenerate one-by-one with strict prompt before fallback.
            strict_ctx = context
            slot_cid = ""
            if question_course_ids and i < len(question_course_ids):
                slot_cid = str(question_course_ids[i] or "").strip()
            if slot_cid:
                slot_query = f"{subject_title} {topic}".strip()
                strict_ctx = rag_service.get_context_for_course_ids(slot_query, [slot_cid], max_chunks=8) or context

            strict_one = _build_batch_prompt(subject_title, [topic], [diff], strict_ctx, 1)
            strict_one += "\nSTRICT MODE: generic/steps patterns are invalid."
            try:
                one_raw = _generate_level_test_llm(strict_one)
                one_qs = _extract_json_array(one_raw)
                picked = one_qs[0] if one_qs else None
                if picked and _quality_ok(picked, strict_ctx, slot_topic=topic):
                    sig = _question_signature(picked)
                    if sig not in seen_signatures:
                        if slot_cid:
                            picked["course_id"] = slot_cid
                        seen_signatures.add(sig)
                        questions.append(picked)
                        continue
            except Exception:
                pass
            # Last resort: strict single-question generator (RAG + quality validation), with retries.
            accepted = False
            # Avoid spending too long stuck on one failing slot (bad JSON / repeated invalid items).
            for _ in range(4):
                picked = _regen_single_question(subject_title, topic, diff)
                if not picked or not _quality_ok(picked, strict_ctx, slot_topic=topic):
                    continue
                sig = _question_signature(picked)
                if sig in seen_signatures:
                    continue
                if slot_cid:
                    picked["course_id"] = slot_cid
                seen_signatures.add(sig)
                questions.append(picked)
                accepted = True
                break
            if accepted:
                continue

            # If quality cannot be guaranteed, keep slot empty here and fill in a final pass.
            logger.warning(
                "Could not generate high-quality item for subject=%s topic=%s difficulty=%s",
                subject_title, topic, diff
            )

    # Final pass: fill any missing slots using strict generator only.
    while len(questions) < count:
        i = len(questions)
        topic = topics[i] if i < len(topics) else topics[i % len(topics)]
        diff = difficulties[i] if i < len(difficulties) else "medium"
        accepted = False
        # Cap retries so one problematic topic doesn't dominate generation time.
        for _ in range(6):
            picked = _regen_single_question(subject_title, topic, diff)
            if not picked or not _quality_ok(picked, context, slot_topic=topic):
                continue
            sig = _question_signature(picked)
            if sig in seen_signatures:
                continue
            slot_cid = ""
            if question_course_ids and i < len(question_course_ids):
                slot_cid = str(question_course_ids[i] or "").strip()
            if slot_cid:
                picked["course_id"] = slot_cid
            seen_signatures.add(sig)
            questions.append(picked)
            accepted = True
            break
        if not accepted:
            # deterministic but still non-step, 4-option structure
            safe = {
                "question": f"Dans le cours de {subject_title}, quel énoncé décrit correctement le concept '{topic}' ?",
                "options": [
                    f"Description correcte du concept '{topic}'",
                    f"Confusion fréquente avec un autre concept",
                    f"Syntaxe invalide liée au concept",
                    f"Assertion contradictoire au cours",
                ],
                "correct_answer": f"Description correcte du concept '{topic}'",
                "difficulty": diff,
                "topic": topic,
                "type": "MCQ",
                "explanation": "",
            }
            slot_cid = ""
            if question_course_ids and i < len(question_course_ids):
                slot_cid = str(question_course_ids[i] or "").strip()
            if slot_cid:
                safe["course_id"] = slot_cid
            sig = _question_signature(safe)
            if sig in seen_signatures:
                safe["question"] += " (variante)"
            seen_signatures.add(_question_signature(safe))
            questions.append(safe)

    for i, q in enumerate(questions[:count]):
        q.setdefault("topic", topics[i] if i < len(topics) else "general")
        if not q.get("topic"):
            q["topic"] = topics[i] if i < len(topics) else "general"
        q.setdefault("difficulty", difficulties[i] if i < len(difficulties) else "medium")
        q.setdefault("type", "MCQ")
        if not q.get("options") or len(q.get("options", [])) < 2:
            q["options"] = [
                q.get("correct_answer", "Option A"),
                f"Wrong option B about {q.get('topic', '')}",
                f"Wrong option C about {q.get('topic', '')}",
                f"Wrong option D about {q.get('topic', '')}",
            ]
        # Force exactly 4 options
        opts = [str(x) for x in q.get("options", []) if str(x).strip()]
        while len(opts) < 4:
            opts.append(f"Distracteur {len(opts)+1} ({q.get('topic', 'general')})")
        q["options"] = opts[:4]

        # If correct answer doesn't match options, place it as first option
        cn = str(q.get("correct_answer", "")).strip()
        if cn and cn not in q["options"]:
            q["options"][0] = cn
        if question_course_ids and i < len(question_course_ids):
            cid = str(question_course_ids[i] or "").strip()
            if cid:
                q["course_id"] = cid

    result = questions[:count]

    if use_cache:
        _question_cache[ck] = result
        if len(_question_cache) > MAX_CACHE:
            oldest_key = next(iter(_question_cache))
            del _question_cache[oldest_key]

    elapsed = time.perf_counter() - t0
    logger.info("Batch for %s complete: %d questions in %.1fs", subject_title, len(result), elapsed)
    return result


def generate_all_subjects_parallel(
    subjects: list[dict[str, Any]],
    rag_service: RAGService | None = None,
    use_cache: bool = True,
) -> dict[str, list[dict]]:
    """
    Generate questions for ALL subjects in parallel.

    Args:
        subjects: list of ``{key, title, topics, difficulties, count}``

    Returns:
        ``{subject_key: [question_dicts]}``
    """
    if rag_service is None:
        rag_service = RAGService.get_instance()

    t0 = time.perf_counter()
    results: dict[str, list[dict]] = {}

    with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(subjects))) as pool:
        futures = {}
        for s in subjects:
            key = s["key"]
            fut = pool.submit(
                generate_batch_for_subject,
                subject_title=s["title"],
                topics=s["topics"],
                difficulties=s["difficulties"],
                count=s.get("count", 5),
                rag_service=rag_service,
                course_ids=s.get("course_ids"),
                question_course_ids=s.get("question_course_ids"),
                use_cache=use_cache,
            )
            futures[fut] = key

        for fut in as_completed(futures):
            key = futures[fut]
            try:
                results[key] = fut.result()
            except Exception as exc:
                logger.error("Parallel generation failed for %s: %s", key, exc)
                results[key] = []

    elapsed = time.perf_counter() - t0
    total_q = sum(len(v) for v in results.values())
    logger.info(
        "All subjects done: %d subjects, %d total questions in %.1fs (avg %.1fs/subject)",
        len(results), total_q, elapsed, elapsed / max(len(results), 1),
    )
    return results


def _fallback_question(subject: str, topic: str, difficulty: str) -> dict:
    return {
        "question": f"What is an important concept related to '{topic}' in {subject}?",
        "options": [
            f"Concept A about {topic}",
            f"Concept B about {topic}",
            f"Concept C about {topic}",
            f"Concept D about {topic}",
        ],
        "correct_answer": f"Concept A about {topic}",
        "explanation": f"This is a fallback question about {topic}.",
        "difficulty": difficulty,
        "topic": topic,
        "type": "MCQ",
    }


def clear_cache():
    _question_cache.clear()
