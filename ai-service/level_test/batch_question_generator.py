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
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.rag_service import RAGService
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


def _cache_key(subject: str, topics: list[str], difficulty: str) -> str:
    raw = f"{subject}|{difficulty}|{'|'.join(sorted(topics))}"
    return hashlib.md5(raw.encode()).hexdigest()


def _normalise_question(q: dict) -> dict | None:
    """Map short keys (q/o/a/d/t) to full names and validate."""
    _MAP = {"q": "question", "o": "options", "a": "correct_answer", "d": "difficulty", "t": "topic"}
    out: dict = {}
    for short, full in _MAP.items():
        out[full] = q.get(full) or q.get(short)
    out.setdefault("explanation", q.get("explanation", ""))
    if not out.get("question"):
        return None
    return out


def _extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array of question objects from LLM output."""
    text = text.strip()
    match = re.search(r'\[.*\]', text, re.DOTALL)
    if match:
        try:
            arr = json.loads(match.group())
            if isinstance(arr, list):
                normed = [_normalise_question(q) for q in arr if isinstance(q, dict)]
                normed = [q for q in normed if q]
                if normed:
                    return normed
        except json.JSONDecodeError:
            pass

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
        raw = extract_json_from_response(text)
        if isinstance(raw, dict):
            q = _normalise_question(raw)
            if q:
                questions.append(q)

    return questions


def _build_batch_prompt(
    subject: str,
    topics: list[str],
    difficulties: list[str],
    context: str,
    count: int,
) -> str:
    """Ultra-short prompt — minimal tokens for maximum speed."""
    pairs = []
    for i in range(count):
        t = topics[i] if i < len(topics) else topics[0]
        d = difficulties[i] if i < len(difficulties) else "medium"
        pairs.append(f"{i+1}. topic=\"{t}\" difficulty=\"{d}\"")
    specs = "\n".join(pairs)

    return (
        f"{count} MCQ for {subject}.\n{specs}\n"
        f"Ref:{context[:600]}\n"
        'Reply ONLY JSON array:[{{"q":"..","o":["A","B","C","D"],"a":"A","d":"easy","t":"topic"}},...]\n'
        "JSON:"
    )


def generate_batch_for_subject(
    subject_title: str,
    topics: list[str],
    difficulties: list[str],
    count: int = 5,
    rag_service: RAGService | None = None,
) -> list[dict[str, Any]]:
    """
    Generate *count* questions for one subject in a SINGLE LLM call.

    Falls back to individual calls if batch parsing fails, and to
    template questions as last resort.
    """
    t0 = time.perf_counter()

    ck = _cache_key(subject_title, topics[:count], "|".join(difficulties[:count]))
    if ck in _question_cache:
        logger.info("Cache HIT for %s (%d questions)", subject_title, len(_question_cache[ck]))
        return _question_cache[ck]

    if rag_service is None:
        rag_service = RAGService.get_instance()

    context = rag_service.get_context_for_query(
        f"{subject_title} {' '.join(topics[:2])}", max_chunks=2,
    )

    prompt = _build_batch_prompt(subject_title, topics, difficulties, context, count)

    questions: list[dict] = []
    try:
        raw = langchain_ollama.generate_fast(prompt)
        questions = _extract_json_array(raw)
        logger.info(
            "Batch LLM for %s: parsed %d/%d questions in %.1fs",
            subject_title, len(questions), count, time.perf_counter() - t0,
        )
    except Exception as exc:
        logger.warning("Batch generation failed for %s: %s", subject_title, exc)

    if len(questions) < count:
        for i in range(len(questions), count):
            topic = topics[i] if i < len(topics) else topics[i % len(topics)]
            diff = difficulties[i] if i < len(difficulties) else "medium"
            questions.append(_fallback_question(subject_title, topic, diff))

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
