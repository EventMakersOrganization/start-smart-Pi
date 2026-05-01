"""
High-performance batch question generator for the level test.

Batch: ONE LLM call per logical subject (typically 2 MCQs) + parallel subjects.
Includes quality filtering, topic-slot alignment, and cache bypass support.
"""
from __future__ import annotations

import threading
import hashlib
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
from core.db_connection import get_course_by_id
from generation.level_test_quality import reject_level_test_question, topic_slot_aligned
from generation.question_generator import (
    canonicalize_correct_answer_in_place,
    generate_level_test_question,
)
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
_MAX_WORKERS = 2


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
    version = "v16_2q_fr"
    cid = "|".join(sorted(course_ids)) if course_ids else ""
    qcid = "|".join(question_course_ids or [])
    seed = (diversity_seed or "").strip()
    raw = f"{version}|{subject}|{difficulty}|{cid}|{qcid}|{seed}|{'|'.join(sorted(topics))}"
    return hashlib.md5(raw.encode()).hexdigest()


def _mongo_course_text_for_level_test(course_id: str | None, topic_hint: str = "") -> str:
    """Scoped Mongo fallback context when filtered chunks are missing."""
    cid = str(course_id or "").strip()
    if not cid:
        return ""
    try:
        doc = get_course_by_id(cid)
    except Exception:
        return ""
    if not isinstance(doc, dict):
        return ""

    parts: list[str] = []
    title = str(doc.get("title") or "").strip()
    desc = str(doc.get("description") or "").strip()
    if title:
        parts.append(f"Chapitre: {title}")
    if desc:
        parts.append(desc)

    hint = _strip_accents(str(topic_hint or "")).lower()
    sub = doc.get("subChapters") or doc.get("subchapters") or []
    if isinstance(sub, list):
        matched: list[dict[str, Any]] = []
        others: list[dict[str, Any]] = []
        for sc in sub:
            if not isinstance(sc, dict):
                continue
            sc_title = str(sc.get("title") or "").strip()
            sc_desc = str(sc.get("description") or "").strip()
            blob = _strip_accents(f"{sc_title} {sc_desc}").lower()
            if hint and hint in blob:
                matched.append(sc)
            else:
                others.append(sc)
        chosen = matched[:3] if matched else others[:3]
        for i, sc in enumerate(chosen, start=1):
            sc_title = str(sc.get("title") or "").strip()
            sc_desc = str(sc.get("description") or "").strip()
            if sc_title:
                parts.append(f"Sous-chapitre {i}: {sc_title}")
            if sc_desc:
                parts.append(sc_desc)

    return "\n\n".join(parts).strip()[:12000]


def _generate_level_test_llm(
    prompt: str,
    *,
    output_questions: int = 1,
) -> str:
    """Call Ollama for single-question level-test generation."""

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
                    "[level_test] ollama.generate model=%s num_ctx=%s num_predict=%s",
                    mn,
                    num_ctx,
                    num_predict,
                )
                opts = {
                    "temperature": float(getattr(config, "OLLAMA_LEVEL_TEST_TEMPERATURE", 0.4)),
                    "top_p": 0.9,
                    "repeat_penalty": float(getattr(config, "OLLAMA_REPEAT_PENALTY", 1.2)),
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
        "[level_test] single LLM primary=%s (resolved) output_questions=%s",
        primary,
        output_questions,
    )
    text = _gen(primary)
    if text:
        return text
    return ""


def _question_signature(q: dict[str, Any]) -> str:
    qt = _strip_accents(str(q.get("question") or "")).lower().strip()
    opts = [_strip_accents(str(x)).lower().strip() for x in (q.get("options") or [])]
    opts = [o for o in opts if o]
    return f"{qt}|{'|'.join(sorted(opts))}"


def final_duplicate_check(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Final safety check to remove duplicate question stems."""
    seen: set[str] = set()
    unique_questions: list[dict[str, Any]] = []
    for q in questions or []:
        signature = _strip_accents(str((q or {}).get("question") or "")).lower()[:80]
        if signature not in seen:
            seen.add(signature)
            unique_questions.append(q)
        else:
            logger.warning(
                "DUPLICATE DETECTED IN FINAL CHECK: %s...",
                str((q or {}).get("question") or "")[:60],
            )
    if len(unique_questions) < len(questions or []):
        logger.warning(
            "REMOVED %d duplicates in final check",
            len(questions or []) - len(unique_questions),
        )
    return unique_questions


def _normalize_question_fields(q: dict[str, Any]) -> dict[str, Any]:
    """Ensure compatibility across consumers expecting camel/snake case keys."""
    if not isinstance(q, dict):
        return q
    q.setdefault("question", str(q.get("questionText") or ""))
    if not q.get("questionText"):
        q["questionText"] = q.get("question", "")
    # Normalize answer aliases.
    ca = str(
        q.get("correct_answer") 
        or q.get("correctAnswer") 
        or q.get("answer") 
        or q.get("correct") 
        or q.get("solution") 
        or ""
    ).strip()
    if not ca and isinstance(q.get("options"), list) and q.get("options"):
        ca = str(q["options"][0]).strip()
    q["correct_answer"] = ca
    q["correctAnswer"] = ca
    # Keep explanation present to reduce downstream validation failures.
    q.setdefault("explanation", "")
    return q


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

    if (
        reject_level_test_question(
            q, slot_topic=slot_topic, course_context=context, require_french=True
        )
        is not None
    ):
        return False
    if slot_topic is not None and not topic_slot_aligned(q, slot_topic, context):
        logger.info("_quality_ok: topic_slot_aligned FAILED for topic '%s'", slot_topic)
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
    course_ids: list[str] | None = None,
    previous_questions: list[str] | None = None,
) -> dict[str, Any] | None:
    try:
        cids = [str(x).strip() for x in (course_ids or []) if str(x).strip()]
        q = generate_level_test_question(
            subject=subject_title,
            difficulty=diff,
            topic=topic,
            diversity_seed=diversity_seed,
            course_ids=cids or None,
            previous_questions=previous_questions or [],
        )
        if isinstance(q, dict) and q.get("question") and q.get("options"):
            return q
    except Exception as exc:
        logger.warning("_regen_single_question failed for %s/%s: %s", subject_title, topic, exc)
    return None


def _generate_single_level_test_question(
    *,
    subject: str,
    topic: str,
    difficulty: str,
    rag_service: RAGService,
    course_content: str = "",
    course_ids: list[str] | None = None,
    diversity_seed: str | None = None,
    max_retries: int = 3,
    previous_questions: list[str] | None = None,
) -> dict[str, Any] | None:
    """Generate ONE question for a single subchapter/topic with retries."""
    content = (course_content or "").strip()
    cids = [str(x).strip() for x in (course_ids or []) if str(x).strip()]
    for attempt in range(1, max_retries + 1):
        logger.info("Attempt %d/%d for topic '%s'", attempt, max_retries, topic)
        if len(content) < 100:
            query = f"{subject} {topic}".strip()
            if cids and hasattr(rag_service, "get_context_for_course_ids"):
                content = (rag_service.get_context_for_course_ids(query, cids, max_chunks=3) or "").strip()
            if len(content) < 100 and not cids:
                content = (rag_service.get_context_for_query(query, max_chunks=3) or "").strip()

        q = _regen_single_question(
            subject,
            topic,
            difficulty,
            diversity_seed=diversity_seed,
            course_ids=cids or None,
            previous_questions=previous_questions or [],
        )
        if q and _quality_ok(q, content, slot_topic=topic):
            logger.info("Attempt %d validated for topic '%s'", attempt, topic)
            return q
        logger.info("Attempt %d failed validation for topic '%s'", attempt, topic)
    logger.warning("All %d attempts failed for topic '%s'", max_retries, topic)
    return None


_MAX_WORKERS = 10


def _cache_key(
    subject: str,
    topics: list[str],
    difficulty: str,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
) -> str:
    version = "v16_2q_fr_parallel"
    cid = "|".join(sorted(course_ids)) if course_ids else ""
    qcid = "|".join(question_course_ids or [])
    raw = f"{version}|{subject}|{difficulty}|{cid}|{qcid}|{'|'.join(sorted(topics))}"
    return hashlib.md5(raw.encode()).hexdigest()


def _mongo_course_text_for_level_test(course_id: str | None, topic_hint: str = "") -> str:
    if not course_id:
        return ""
    try:
        c = get_course_by_id(course_id)
        if not c:
            return ""
        return f"{c.get('title','')}\n{c.get('description','')}"
    except Exception as e:
        logger.error("Error fetching course text: %s", e)
        return ""


def generate_batch_for_subject(
    subject_title: str,
    topics: list[str],
    difficulties: list[str],
    count: int = 2,
    rag_service: RAGService | None = None,
    course_ids: list[str] | None = None,
    question_course_ids: list[str] | None = None,
    use_cache: bool = True,
    diversity_seed: str | None = None,
) -> list[dict[str, Any]]:
    """
    Generate questions for ONE subject (multiple topics) in parallel.
    """
    t0 = time.perf_counter()
    base_budget = int(
        getattr(
            config,
            "LEVEL_TEST_GENERATION_TIMEOUT",
            getattr(config, "LEVEL_TEST_MAX_GENERATION_SECONDS", 120),
        )
    )
    per_q_budget = int(getattr(config, "LEVEL_TEST_SECONDS_PER_QUESTION", 25))
    max_total_seconds = max(base_budget, count * max(10, per_q_budget))

    ck = _cache_key(
        subject_title,
        topics[:count],
        "|".join(difficulties[:count]),
        course_ids,
        (question_course_ids or [])[:count],
    )
    if use_cache and ck in _question_cache:
        logger.info("Cache HIT for %s (%d questions)", subject_title, len(_question_cache[ck]))
        return _question_cache[ck]

    if rag_service is None:
        rag_service = RAGService.get_instance()

    seen_lock = threading.Lock()
    seen_sigs = set()

    def generate_slot(i: int) -> dict[str, Any]:
        slot_topic = topics[i] if i < len(topics) else "general"
        slot_diff = difficulties[i] if i < len(difficulties) else "medium"
        slot_cid = str(question_course_ids[i] or "").strip() if (question_course_ids and i < len(question_course_ids)) else ""
        
        slot_cids = [slot_cid] if slot_cid else [str(x).strip() for x in (course_ids or []) if str(x).strip()]
        query = f"{subject_title} {slot_topic}".strip()
        
        context = ""
        if slot_cids and hasattr(rag_service, "get_context_for_course_ids"):
            context = (rag_service.get_context_for_course_ids(query, slot_cids, max_chunks=3) or "").strip()
        elif course_ids is None: # only if not provided scope
            context = (rag_service.get_context_for_query(query, max_chunks=3) or "").strip()
            
        if not context and slot_cids:
            context = _mongo_course_text_for_level_test(slot_cids[0], slot_topic)

        max_attempts = max(2, int(getattr(config, "LEVEL_TEST_RETRIES_PER_TOPIC", 2)))
        picked = None
        
        # Shared set of signatures for this subject batch
        for attempt in range(1, max_attempts + 1):
            if (time.perf_counter() - t0) >= max_total_seconds:
                break
                
            candidate = _generate_single_level_test_question(
                subject=subject_title,
                topic=slot_topic,
                difficulty=slot_diff,
                rag_service=rag_service,
                course_content=context,
                course_ids=slot_cids or None,
                diversity_seed=f"{(diversity_seed or '').strip()}:{i}:{attempt}",
                max_retries=1,
                previous_questions=[], 
            )
            if candidate:
                candidate = _normalize_question_fields(candidate)
                canonicalize_correct_answer_in_place(candidate)
                candidate["topic"] = slot_topic
                candidate["difficulty"] = slot_diff
                candidate.setdefault("type", "MCQ")
                candidate.setdefault("is_fallback", False)
                if slot_cid:
                    candidate["course_id"] = slot_cid
                
                # Double check signature uniqueness even in parallel
                sig = _strip_accents(str(candidate.get("question") or "")).lower()[:100]
                with seen_lock:
                    if sig in seen_sigs:
                        picked = None
                        continue # try another attempt
                    seen_sigs.add(sig)
                
                picked = candidate
                break
        
        if not picked:
            picked = _fallback_question(
                subject_title,
                slot_topic,
                slot_diff,
                context=context,
                diversity_seed=f"{(diversity_seed or '').strip()}:{i}:final",
                question_index=i,
            )
            picked["topic"] = slot_topic
            picked["difficulty"] = slot_diff
            picked = _normalize_question_fields(picked)
            canonicalize_correct_answer_in_place(picked)
            
        return picked


    # Parallel execution for the slots
    result: list[dict[str, Any]] = [None] * count # type: ignore
    with ThreadPoolExecutor(max_workers=min(count, _MAX_WORKERS)) as executor:
        futures = {executor.submit(generate_slot, i): i for i in range(count)}
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                result[idx] = fut.result()
            except Exception as exc:
                logger.error("Slot %d failed: %s", idx, exc)
                # Fail-safe if even the slot logic crashed
                result[idx] = _fallback_question(subject_title, topics[idx], difficulties[idx], question_index=idx)

    # Post-process for duplicates across the batch
    final_result = final_duplicate_check(result)
    
    # Fill any gaps if final check removed too many
    if len(final_result) < count:
        seen = set(_strip_accents(str(q.get("question") or "")).lower()[:100] for q in final_result if q)
        for k in range(len(final_result), count):
            fill = _fallback_question(
                subject_title, 
                topics[k] if k < len(topics) else "general", 
                difficulties[k] if k < len(difficulties) else "medium", 
                question_index=k,
                used_questions_set=seen
            )
            fill = _normalize_question_fields(fill)
            canonicalize_correct_answer_in_place(fill)
            final_result.append(fill)
            seen.add(_strip_accents(str(fill.get("question") or "")).lower()[:100])

    if use_cache:
        _question_cache[ck] = final_result
        if len(_question_cache) > MAX_CACHE:
            _question_cache.pop(next(iter(_question_cache)))

    elapsed = time.perf_counter() - t0
    logger.info("Subject %s complete: %d questions in %.1fs", subject_title, len(final_result), elapsed)
    return final_result


def generate_all_subjects_parallel(
    subjects: list[dict[str, Any]],
    rag_service: RAGService | None = None,
    use_cache: bool = True,
) -> dict[str, list[dict]]:
    """
    Generate questions for ALL subjects in parallel.
    """
    if rag_service is None:
        rag_service = RAGService.get_instance()

    t0 = time.perf_counter()
    results: dict[str, list[dict]] = {}

    # We now have nested parallelism. Subject-level + Question-level.
    # Keep subject-level workers low to avoid overwhelming Ollama.
    max_workers = max(1, min(2, len(subjects))) 
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(
                generate_batch_for_subject,
                subject_title=s["title"],
                topics=s["topics"],
                difficulties=s["difficulties"],
                count=s.get("count", 2),
                rag_service=rag_service,
                course_ids=s.get("course_ids"),
                question_course_ids=s.get("question_course_ids"),
                use_cache=use_cache,
                diversity_seed=s.get("diversity_seed"),
            ): s["key"]
            for s in subjects
        }
        for fut in as_completed(futures):
            key = futures[fut]
            try:
                results[key] = fut.result()
            except Exception as exc:
                logger.error("Parallel generation failed for %s: %s", key, exc)
                results[key] = []

    elapsed = time.perf_counter() - t0
    logger.info("All subjects done: %d subjects, %d total questions in %.1fs", 
                len(subjects), sum(len(x) for x in results.values()), elapsed)
    return results


def create_safe_fallback_question(
    subject: str,
    slot_topic: str,
    difficulty: str,
    context: str = "",
    diversity_seed: str = "",
    question_index: int = 0,
    used_questions_set: set[str] | None = None,
) -> dict:
    """
    Create UNIQUE fallback that doesn't duplicate existing questions.
    Each fallback must be different — uses a large pool + dynamic topic-specific generation.
    """
    used = used_questions_set if used_questions_set is not None else set()
    t = (slot_topic or "ce sujet").strip()
    
    # Clean topic title (remove suffixes like (suite), - introduction, etc)
    t = re.sub(r"\s*[\(\[].*?[\)\]]\s*", " ", t)
    t = re.sub(r"\s+[-—–].*$", "", t)
    t = t.strip()
    
    s = (subject or "ce cours").strip()
    diff = (difficulty or "medium").strip().lower()
    if diff not in {"easy", "medium", "hard"}:
        diff = "medium"

    if "base de donnees" in _strip_accents(s).lower() or "oracle" in _strip_accents(s).lower():
        fallback_pool = {
            "easy": [
                {"question": "Quelle commande SQL permet de créer une nouvelle table?", "options": ["CREATE TABLE", "NEW TABLE", "MAKE TABLE", "ADD TABLE"], "correct_answer": "CREATE TABLE"},
                {"question": "Quelle est la commande pour afficher les données d'une table?", "options": ["SELECT", "SHOW", "DISPLAY", "GET"], "correct_answer": "SELECT"},
                {"question": "Quelle commande permet d'ajouter une ligne dans une table?", "options": ["INSERT INTO", "ADD ROW", "PUT DATA", "NEW ENTRY"], "correct_answer": "INSERT INTO"},
                {"question": "Quelle commande supprime des lignes d'une table?", "options": ["DELETE FROM", "REMOVE ROW", "DROP ROW", "ERASE DATA"], "correct_answer": "DELETE FROM"},
                {"question": "Quel mot-clé filtre les résultats d'une requête SELECT?", "options": ["WHERE", "FILTER", "HAVING", "LIMIT"], "correct_answer": "WHERE"},
                {"question": "Quelle commande modifie la structure d'une table existante?", "options": ["ALTER TABLE", "MODIFY TABLE", "CHANGE TABLE", "UPDATE TABLE"], "correct_answer": "ALTER TABLE"},
                {"question": "Quel type de contrainte empêche les valeurs NULL?", "options": ["NOT NULL", "NO EMPTY", "REQUIRED", "MANDATORY"], "correct_answer": "NOT NULL"},
                {"question": "Quelle commande supprime une table entière?", "options": ["DROP TABLE", "DELETE TABLE", "REMOVE TABLE", "DESTROY TABLE"], "correct_answer": "DROP TABLE"},
                {"question": "Quel mot-clé trie les résultats d'une requête?", "options": ["ORDER BY", "SORT BY", "ARRANGE BY", "GROUP BY"], "correct_answer": "ORDER BY"},
                {"question": "Quelle commande accorde des droits à un utilisateur?", "options": ["GRANT", "ALLOW", "PERMIT", "AUTHORIZE"], "correct_answer": "GRANT"},
                {"question": "Quelle commande retire des privilèges à un utilisateur?", "options": ["REVOKE", "DENY", "REMOVE", "FORBID"], "correct_answer": "REVOKE"},
                {"question": "Quel type de jointure retourne toutes les lignes des deux tables?", "options": ["FULL OUTER JOIN", "INNER JOIN", "LEFT JOIN", "CROSS JOIN"], "correct_answer": "FULL OUTER JOIN"},
                {"question": "Quelle vue Oracle liste les tables de l'utilisateur courant?", "options": ["USER_TABLES", "MY_TABLES", "SHOW_TABLES", "LIST_TABLES"], "correct_answer": "USER_TABLES"},
                {"question": "Quel rôle Oracle est accordé par défaut pour la connexion?", "options": ["CONNECT", "USER", "LOGIN", "ACCESS"], "correct_answer": "CONNECT"},
                {"question": "Quelle commande valide définitivement les modifications?", "options": ["COMMIT", "SAVE", "APPLY", "CONFIRM"], "correct_answer": "COMMIT"},
            ],
            "medium": [
                {"question": "Quelle vue système affiche les tables de l'utilisateur courant?", "options": ["USER_TABLES", "ALL_TABLES", "DBA_TABLES", "SYS_TABLES"], "correct_answer": "USER_TABLES"},
                {"question": "Quel processus Oracle écrit les données modifiées sur disque?", "options": ["DBWn (Database Writer)", "LGWR (Log Writer)", "CKPT (Checkpoint)", "PMON (Process Monitor)"], "correct_answer": "DBWn (Database Writer)"},
                {"question": "Quelle zone mémoire contient le cache du dictionnaire de données?", "options": ["Shared Pool", "Database Buffer Cache", "Redo Log Buffer", "Java Pool"], "correct_answer": "Shared Pool"},
                {"question": "Quelle commande modifie les paramètres d'une instance en cours?", "options": ["ALTER SYSTEM", "MODIFY SYSTEM", "CHANGE PARAMETER", "SET INSTANCE"], "correct_answer": "ALTER SYSTEM"},
                {"question": "Quel fichier contient les paramètres d'initialisation Oracle?", "options": ["init.ora ou spfile.ora", "config.ora", "oracle.ini", "params.txt"], "correct_answer": "init.ora ou spfile.ora"},
                {"question": "Quel processus Oracle gère les journaux de reprise?", "options": ["LGWR (Log Writer)", "DBWn (Database Writer)", "ARCn (Archiver)", "SMON"], "correct_answer": "LGWR (Log Writer)"},
                {"question": "Quelle commande change un paramètre pour la session courante?", "options": ["ALTER SESSION SET", "MODIFY SESSION", "SET SESSION", "UPDATE SESSION"], "correct_answer": "ALTER SESSION SET"},
                {"question": "Quel type de tablespace stocke les données temporaires?", "options": ["TEMPORARY", "TEMP_DATA", "SWAP", "CACHE"], "correct_answer": "TEMPORARY"},
                {"question": "Quelle vue affiche les privilèges système de l'utilisateur?", "options": ["USER_SYS_PRIVS", "MY_PRIVILEGES", "SYS_GRANTS", "USER_RIGHTS"], "correct_answer": "USER_SYS_PRIVS"},
                {"question": "Quel composant SGA stocke les blocs de données les plus utilisés?", "options": ["Database Buffer Cache", "Shared Pool", "Redo Log Buffer", "Large Pool"], "correct_answer": "Database Buffer Cache"},
                {"question": "Quelle commande crée un nouveau tablespace?", "options": ["CREATE TABLESPACE", "NEW TABLESPACE", "ADD TABLESPACE", "MAKE TABLESPACE"], "correct_answer": "CREATE TABLESPACE"},
                {"question": "Quel privilège permet de créer des tables dans son propre schéma?", "options": ["CREATE TABLE", "TABLE_ADMIN", "SCHEMA_WRITE", "INSERT_TABLE"], "correct_answer": "CREATE TABLE"},
                {"question": "Quelle commande crée un profil de gestion des ressources?", "options": ["CREATE PROFILE", "NEW PROFILE", "ADD PROFILE", "SET PROFILE"], "correct_answer": "CREATE PROFILE"},
                {"question": "Quel type d'audit Oracle suit les commandes SQL?", "options": ["Audit de commande", "Audit de session", "Audit de schéma", "Audit de table"], "correct_answer": "Audit de commande"},
                {"question": "Quelle vue affiche les rôles accordés à l'utilisateur?", "options": ["USER_ROLE_PRIVS", "MY_ROLES", "GRANTED_ROLES", "ROLE_LIST"], "correct_answer": "USER_ROLE_PRIVS"},
            ],
            "hard": [
                {"question": "Quelle différence entre SHUTDOWN IMMEDIATE et SHUTDOWN ABORT?", "options": ["IMMEDIATE attend la fin des transactions, ABORT non", "ABORT est plus sûr", "Aucune différence", "IMMEDIATE est plus rapide"], "correct_answer": "IMMEDIATE attend la fin des transactions, ABORT non"},
                {"question": "Quel est le rôle du processus SMON?", "options": ["Récupération de l'instance après une panne", "Écriture des logs", "Monitoring des utilisateurs", "Sauvegarde automatique"], "correct_answer": "Récupération de l'instance après une panne"},
                {"question": "Quelle est la différence entre PFILE et SPFILE?", "options": ["PFILE est texte, SPFILE est binaire", "PFILE est binaire, SPFILE est texte", "Aucune différence", "PFILE est plus récent"], "correct_answer": "PFILE est texte, SPFILE est binaire"},
                {"question": "Quel paramètre définit la taille des blocs de données?", "options": ["DB_BLOCK_SIZE", "BLOCK_SIZE", "DATA_BLOCK", "ORACLE_BLOCK"], "correct_answer": "DB_BLOCK_SIZE"},
                {"question": "Que fait la commande ALTER DATABASE MOUNT?", "options": ["Monte la base sans l'ouvrir", "Ouvre la base en lecture seule", "Démarre l'instance", "Arrête la base"], "correct_answer": "Monte la base sans l'ouvrir"},
                {"question": "Quel processus gère le nettoyage des processus utilisateur terminés?", "options": ["PMON (Process Monitor)", "SMON", "DBWn", "LGWR"], "correct_answer": "PMON (Process Monitor)"},
                {"question": "Quelle clause SCOPE de ALTER SYSTEM modifie le SPFILE sans effet immédiat?", "options": ["SCOPE=SPFILE", "SCOPE=MEMORY", "SCOPE=BOTH", "SCOPE=DEFERRED"], "correct_answer": "SCOPE=SPFILE"},
                {"question": "Quel mécanisme Oracle permet un audit granulaire basé sur des conditions?", "options": ["Fine-Grained Auditing (FGA)", "Standard Auditing", "Trigger Auditing", "Log Auditing"], "correct_answer": "Fine-Grained Auditing (FGA)"},
                {"question": "Quelle est la différence entre un privilège système et un privilège objet?", "options": ["Système: actions globales, Objet: actions sur un objet spécifique", "Système: lecture seule, Objet: écriture", "Aucune différence", "Objet est plus puissant"], "correct_answer": "Système: actions globales, Objet: actions sur un objet spécifique"},
                {"question": "Quel paramètre limite le nombre de sessions simultanées par utilisateur?", "options": ["SESSIONS_PER_USER dans un profil", "MAX_SESSIONS", "USER_LIMIT", "CONNECTION_LIMIT"], "correct_answer": "SESSIONS_PER_USER dans un profil"},
                {"question": "Quelles sont les trois phases de démarrage d'une instance Oracle?", "options": ["NOMOUNT, MOUNT, OPEN", "START, LOAD, RUN", "INIT, BOOT, READY", "BEGIN, PREPARE, ACTIVE"], "correct_answer": "NOMOUNT, MOUNT, OPEN"},
                {"question": "Quel composant SGA contient le cache des instructions SQL?", "options": ["Library Cache dans le Shared Pool", "Database Buffer Cache", "Redo Log Buffer", "PGA"], "correct_answer": "Library Cache dans le Shared Pool"},
                {"question": "Quelle commande active l'audit standard sur une commande SQL?", "options": ["AUDIT CREATE TABLE", "TRACE CREATE TABLE", "LOG CREATE TABLE", "MONITOR CREATE TABLE"], "correct_answer": "AUDIT CREATE TABLE"},
                {"question": "Quel fichier de contrôle contient les métadonnées de la base de données?", "options": ["Control file (.ctl)", "Data file (.dbf)", "Redo log file", "Archive log file"], "correct_answer": "Control file (.ctl)"},
                {"question": "Quelle option WITH GRANT permet de déléguer un privilège?", "options": ["WITH ADMIN OPTION (système) ou WITH GRANT OPTION (objet)", "WITH DELEGATE", "WITH SHARE", "WITH TRANSFER"], "correct_answer": "WITH ADMIN OPTION (système) ou WITH GRANT OPTION (objet)"},
            ],
        }
    else:
        fallback_pool = {
            "easy": [
                {"question": f"Quel est un concept fondamental de {t}?", "options": ["Concept de base essentiel", "Notion avancée complexe", "Théorie abstraite", "Principe secondaire"], "correct_answer": "Concept de base essentiel"},
                {"question": f"Quelle approche est recommandée pour étudier {t}?", "options": ["Approche méthodique et structurée", "Approche aléatoire", "Sans méthode particulière", "Improvisation totale"], "correct_answer": "Approche méthodique et structurée"},
            ],
            "medium": [
                {"question": f"Comment applique-t-on les principes de {t} en pratique?", "options": ["Avec une méthode structurée et documentée", "Sans planification préalable", "Au hasard des circonstances", "En improvisant sans référence"], "correct_answer": "Avec une méthode structurée et documentée"},
            ],
            "hard": [
                {"question": f"Quelle est la meilleure pratique pour maîtriser {t}?", "options": ["Suivre les standards établis et documenter", "Ignorer les conventions existantes", "Tout automatiser sans comprendre", "Ne rien documenter"], "correct_answer": "Suivre les standards établis et documenter"},
            ],
        }

    pool = fallback_pool.get(diff, fallback_pool["medium"])
    seed_raw = f"{_strip_accents(s).lower()}|{_strip_accents(t).lower()}|{diff}|{(diversity_seed or '').strip()}|{question_index}"
    seed_idx = int(hashlib.md5(seed_raw.encode("utf-8")).hexdigest(), 16)
    ordered_pool = pool[seed_idx % len(pool):] + pool[:seed_idx % len(pool)]

    for fb in ordered_pool:
        sig = _strip_accents(str(fb.get("question") or "")).lower()[:80]
        if sig not in used:
            used.add(sig)
            qtxt = str(fb.get("question") or "")
            if qtxt and not qtxt.endswith("?"):
                qtxt += "?"
            return {
                **fb,
                "question": qtxt,
                "questionText": qtxt,
                "difficulty": diff,
                "topic": t,
                "type": "MCQ",
                "is_fallback": True,
                "fallback_reason": f"Generated fallback #{len(used)} for topic",
                "correctAnswer": fb.get("correct_answer", ""),
                "explanation": "",
            }

    # Dynamic unique fallback — generates a truly unique question per topic
    unique_id = len(used) + 1
    topic_clean = _strip_accents(t).lower()
    # Generate topic-specific unique question instead of generic numbered ones
    topic_questions = [
        {"question": f"Quel élément est essentiel dans le contexte de {t}?", "options": [f"La maîtrise des concepts de {t}", "Un élément sans rapport", "Une notion obsolète", "Un concept non pertinent"], "correct_answer": f"La maîtrise des concepts de {t}"},
        {"question": f"Pourquoi {t} est-il important en {s}?", "options": [f"Il permet de comprendre un aspect fondamental de {s}", "Il n'a aucune importance", "Il est optionnel", "Il est déprécié"], "correct_answer": f"Il permet de comprendre un aspect fondamental de {s}"},
    ]
    pick = topic_questions[unique_id % len(topic_questions)]
    qtxt = pick["question"]
    return {
        "question": qtxt,
        "questionText": qtxt,
        "options": pick["options"],
        "correct_answer": pick["correct_answer"],
        "correctAnswer": pick["correct_answer"],
        "difficulty": diff,
        "topic": t,
        "type": "MCQ",
        "is_fallback": True,
        "fallback_reason": "Generated unique topic-specific overflow fallback",
        "explanation": "",
    }


def _fallback_question(
    subject: str,
    slot_topic: str,
    difficulty: str,
    context: str = "",
    diversity_seed: str = "",
    question_index: int = 0,
    used_questions_set: set[str] | None = None,
) -> dict:
    """Compatibility wrapper for fallback creation."""
    return create_safe_fallback_question(
        subject=subject,
        slot_topic=slot_topic,
        difficulty=difficulty,
        context=context,
        diversity_seed=diversity_seed,
        question_index=question_index,
        used_questions_set=used_questions_set,
    )


def clear_cache():
    _question_cache.clear()
