"""
High-performance batch question generator for the level test.

Batch: ONE LLM call per logical subject (typically 5 MCQs) + parallel subjects.
Includes quality filtering, topic-slot alignment, and cache bypass support.
"""
from __future__ import annotations

import hashlib
import json
import logging
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

import unicodedata

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

try:
    import ollama as _ollama  # type: ignore
except Exception:  # noqa: BLE001
    _ollama = None

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


def _cache_key(
    subject: str,
    topics: list[str],
    difficulty: str,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
    diversity_seed: str | None = None,
) -> str:
    version = "v14_topic_shuffle_session_diversity"
    cid = "|".join(sorted(course_ids)) if course_ids else ""
    qcid = "|".join(question_course_ids or [])
    seed = (diversity_seed or "").strip()
    raw = f"{version}|{subject}|{difficulty}|{cid}|{qcid}|{seed}|{'|'.join(sorted(topics))}"
    return hashlib.md5(raw.encode()).hexdigest()


def _normalise_question(q: dict) -> dict | None:
    """Map short keys (q/o/a/d/t) to full names and validate."""
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
        _lt = langchain_ollama.resolve_ollama_model_name(
            (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
        )
        parsed = repair_to_strict_json(text, model_name=_lt)
    if isinstance(parsed, list):
        normed = [_normalise_question(q) for q in parsed if isinstance(q, dict)]
        normed = [q for q in normed if q]
        if normed:
            return normed
    if isinstance(parsed, dict):
        q = _normalise_question(parsed)
        return [q] if q else []

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
        except Exception:
            pass

    return questions


def _build_batch_prompt(
    subject: str,
    topics: list[str],
    difficulties: list[str],
    context: str,
    count: int,
    diversity_seed: str | None = None,
) -> str:
    """Structured prompt grounded in RAG reference (uses prompt_templates rubric)."""
    pairs = []
    for i in range(count):
        t = topics[i] if i < len(topics) else topics[0]
        d = difficulties[i] if i < len(difficulties) else "medium"
        pairs.append(f"{i+1}. topic=\"{t}\" difficulty=\"{d}\"")
    specs = "\n".join(pairs)

    return build_level_test_batch_prompt(
        subject,
        specs,
        context,
        count,
        diversity_seed=(diversity_seed or None),
    )


def _generate_level_test_llm(prompt: str, *, output_questions: int = 1) -> str:
    """
    Call Ollama for level-test generation. For batch (output_questions > 1), scale num_predict
    so JSON is not truncated at 1024 — that caused parsed 1/5 and many single-question fallbacks.
    """

    def _gen(model_name: str) -> str:
        mn = (model_name or "").strip()
        if not mn:
            return ""
        base_ctx = int(getattr(config, "OLLAMA_LEVEL_TEST_NUM_CTX", 2048))
        base_pred = int(getattr(config, "OLLAMA_LEVEL_TEST_NUM_PREDICT", 1024))
        if output_questions > 1:
            num_ctx = min(16384, max(base_ctx, 4096))
            num_predict = min(8192, max(base_pred, 280 * output_questions + 400))
        else:
            num_ctx = base_ctx
            num_predict = base_pred
        if _ollama is not None:
            try:
                logger.info(
                    "[level_test] ollama.generate model=%s num_ctx=%s num_predict=%s (batch_n=%s)",
                    mn,
                    num_ctx,
                    num_predict,
                    output_questions,
                )
                opts = {
                    "temperature": float(getattr(config, "OLLAMA_LEVEL_TEST_TEMPERATURE", 0.4)),
                    "top_p": 0.9,
                    "num_ctx": num_ctx,
                    "num_predict": num_predict,
                }
                resp = _ollama.generate(model=mn, prompt=str(prompt), options=opts)
                if isinstance(resp, dict):
                    text = str(resp.get("response", "") or "").strip()
                elif hasattr(resp, "response"):
                    text = str(getattr(resp, "response") or "").strip()
                else:
                    text = str(resp).strip()
                if text:
                    return text
            except Exception:
                pass
        # fallback if python `ollama` package not installed OR returned empty/errored
        return (
            langchain_ollama.generate_with_model(prompt, mn)
            if hasattr(langchain_ollama, "generate_with_model")
            else langchain_ollama.generate_response(prompt)
        )

    primary = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
    primary = langchain_ollama.resolve_ollama_model_name(primary)
    logger.info(
        "[level_test] batch/single LLM primary=%s (resolved) output_questions=%s",
        primary,
        output_questions,
    )
    text = _gen(primary)
    if text:
        return text
    fb = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL_FALLBACK", None) or "").strip()
    if fb:
        text = _gen(langchain_ollama.resolve_ollama_model_name(fb))
        if text:
            return text
    return _gen(config.OLLAMA_MODEL)


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

    cn = _strip_accents(str(q.get("correct_answer"))).lower().strip().strip('"').strip("'")
    on = [
        _strip_accents(str(x)).lower().strip().strip('"').strip("'")
        for x in opts
    ]
    if cn not in on:
        return False
    collapsed = [re.sub(r"\s+", " ", x) for x in on]
    if len(set(collapsed)) < 4:
        return False
    return True


def _regen_single_question(
    subject_title: str,
    topic: str,
    diff: str,
    *,
    diversity_seed: str | None = None,
) -> dict[str, Any] | None:
    try:
        q = generate_level_test_question(
            subject=subject_title,
            difficulty=diff,
            topic=topic,
            diversity_seed=diversity_seed,
        )
        if isinstance(q, dict):
            return q
    except Exception:
        return None
    return None


def generate_batch_for_subject(
    subject_title: str,
    topics: list[str],
    difficulties: list[str],
    count: int = 5,
    rag_service: RAGService | None = None,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
    use_cache: bool = True,
    diversity_seed: str | None = None,
) -> list[dict[str, Any]]:
    """
    Generate *count* questions for one subject in a SINGLE LLM call.

    Falls back to individual calls if batch parsing fails, and to
    template questions as last resort.
    """
    t0 = time.perf_counter()

    ck = _cache_key(
        subject_title,
        topics[:count],
        "|".join(difficulties[:count]),
        course_ids,
        (question_course_ids or [])[:count],
        diversity_seed,
    )
    if use_cache and ck in _question_cache:
        logger.info("Cache HIT for %s (%d questions)", subject_title, len(_question_cache[ck]))
        return _question_cache[ck]

    if rag_service is None:
        rag_service = RAGService.get_instance()

    query = f"{subject_title} {' '.join(topics[:5])}"
    if course_ids and hasattr(rag_service, "get_context_for_course_ids"):
        context = rag_service.get_context_for_course_ids(query, course_ids, max_chunks=10)
        if not (context or "").strip():
            context = rag_service.get_context_for_query(query, max_chunks=8)
    else:
        context = rag_service.get_context_for_query(query, max_chunks=8)

    prompt = _build_batch_prompt(
        subject_title,
        topics,
        difficulties,
        context,
        count,
        diversity_seed=diversity_seed,
    )

    questions: list[dict] = []
    try:
        raw = _generate_level_test_llm(prompt, output_questions=count)
        questions = _extract_json_array(raw)
        logger.info(
            "Batch LLM for %s: parsed %d/%d questions in %.1fs",
            subject_title, len(questions), count, time.perf_counter() - t0,
        )
    except Exception as exc:
        logger.warning("Batch generation failed for %s: %s", subject_title, exc)

    cleaned: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, q in enumerate(questions):
        slot_topic = topics[min(i, len(topics) - 1)] if topics else None
        if not _quality_ok(q, context, slot_topic=slot_topic):
            continue
        sig = _question_signature(q)
        if sig in seen:
            continue
        seen.add(sig)
        cleaned.append(q)
    questions = cleaned

    if len(questions) < count:
        for i in range(len(questions), count):
            topic = topics[i] if i < len(topics) else topics[i % len(topics)]
            diff = difficulties[i] if i < len(difficulties) else "medium"
            strict_ctx = context
            slot_cid = ""
            if question_course_ids and i < len(question_course_ids):
                slot_cid = str(question_course_ids[i] or "").strip()
            if slot_cid and course_ids and hasattr(rag_service, "get_context_for_course_ids"):
                strict_ctx = rag_service.get_context_for_course_ids(
                    f"{subject_title} {topic}".strip(),
                    [slot_cid],
                    max_chunks=8,
                ) or context
            picked = None
            # One call here is already up to 3 internal attempts; keep total retries bounded.
            for _ in range(1):
                picked = _regen_single_question(
                    subject_title,
                    topic,
                    diff,
                    diversity_seed=diversity_seed,
                )
                if picked and _quality_ok(picked, strict_ctx, slot_topic=topic):
                    break
            if not picked:
                picked = _fallback_question(subject_title, topic, diff, context=strict_ctx)
            if slot_cid:
                picked["course_id"] = slot_cid
            questions.append(picked)

    for i, q in enumerate(questions[:count]):
        q.setdefault("topic", topics[i] if i < len(topics) else "general")
        q.setdefault("difficulty", difficulties[i] if i < len(difficulties) else "medium")
        q.setdefault("type", "MCQ")
        if not q.get("options") or len(q.get("options", [])) < 2:
            q["options"] = [
                q.get("correct_answer", "Option A"),
                f"Wrong option B about {q.get('topic', '')}",
                f"Wrong option C about {q.get('topic', '')}",
                f"Wrong option D about {q.get('topic', '')}",
            ]

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
                diversity_seed=s.get("diversity_seed"),
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


def _fallback_question(
    subject: str,
    slot_topic: str,
    difficulty: str,
    context: str = "",
) -> dict:
    """
    Last-resort filler that stays in French (this project’s default) and avoids
    generic "Concept A" placeholders.
    """
    # Avoid title-only questions; anchor to a technical term from context AND keep topic alignment.
    t = (slot_topic or "ce chapitre").strip()
    s = (subject or "ce cours").strip()
    norm = _strip_accents(context or "").lower()
    m = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", norm)
    # Filter generic document words so we don't ask "à quoi sert chapitre ?"
    generic = {
        "dans", "pour", "avec", "les", "des", "une", "un", "du", "de", "la", "le",
        "cours", "chapitre", "module", "section", "titre", "partie", "page",
        "exemple", "figure", "programme", "table", "annexe",
        # Too generic to build a useful MCQ
        "operation", "operations", "operateur", "operateurs", "chaine", "chaines",
        "donnee", "donnees", "structure", "structures", "fonction", "fonctions",
    }
    candidates = [x for x in m if len(x) >= 3 and x not in generic]
    topic_words = [
        w
        for w in re.findall(r"[a-zA-Zàâäéèêëïîôùûç]{3,}", _strip_accents(t).lower())
        if w not in generic
    ]
    candidates = candidates[:50] + topic_words

    q_text = ""
    good = ""
    for term in candidates:
        cand = {
            "question": f"Dans {s}, à quoi sert « {term} » (ou que signifie-t-il) ?",
            "options": [],
            "correct_answer": "",
            "explanation": "",
            "topic": t,
        }
        if topic_slot_aligned(cand, t):
            q_text = cand["question"]
            good = f"Définition/usage correct de « {term} »"
            break

    if not q_text:
        concept = " ".join(topic_words[:3]).strip() or "ce concept"
        q_text = f"Dans {s}, quel énoncé est correct concernant {concept} ?"
        good = "Énoncé correct selon le cours"
    return {
        "question": q_text,
        "options": [
            good,
            "Confusion fréquente (définition ou usage incorrect)",
            "Assertion contredite par le cours",
            "Exemple incorrect (syntaxe/usage)",
        ],
        "correct_answer": good,
        "explanation": "",
        "difficulty": difficulty,
        "topic": t,
        "type": "MCQ",
    }


def clear_cache():
    _question_cache.clear()
