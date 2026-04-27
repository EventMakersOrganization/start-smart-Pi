"""
Adaptive level-test engine (v3 — per-subject, one question per subchapter).

- Each level test targets a single subject from the ``subjects`` collection.
- One question is generated per subchapter (sous-acquis) across all chapters.
- Total questions = total subchapters in the subject.
- Falls back to legacy course-based grouping when no subject doc is found.
"""
from __future__ import annotations

import hashlib
import logging
import random
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.db_connection import (
    get_database,
    get_all_courses,
    get_subject_by_id,
    get_subject_by_title,
)
from core.rag_service import RAGService
from embeddings import embeddings_pipeline_v2
from adaptive.policy_engine import AdaptivePolicyEngine
from adaptive.intervention_engine import InterventionEngine

logger = logging.getLogger("adaptive_engine")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)

DIFFICULTIES = ["easy", "medium", "hard"]
QUESTIONS_PER_SUBJECT_FALLBACK = 2
_COLLECTION = "level_test_sessions"


def _col():
    return get_database()[_COLLECTION]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ------------------------------------------------------------------
# Subject → subchapter extraction from the ``subjects`` collection
# ------------------------------------------------------------------

def _resolve_subject_doc(
    subject_id: str | None = None,
    subject_name: str | None = None,
) -> dict | None:
    """Resolve subject-like payload from courses first, then legacy subjects."""
    courses = get_all_courses() or []
    by_subject: dict[str, list[dict[str, Any]]] = {}
    by_course_id: dict[str, dict[str, Any]] = {}
    for c in courses:
        cid = str(c.get("id") or "").strip()
        if cid:
            by_course_id[cid] = c
        st = str(c.get("subject") or "").strip()
        if st:
            by_subject.setdefault(st.lower(), []).append(c)

    def _doc_from_courses(subject_title: str) -> dict | None:
        key = str(subject_title or "").strip().lower()
        if not key:
            return None
        matched = by_subject.get(key) or []
        if not matched:
            return None
        chapters = []
        for chapter in sorted(
            matched,
            key=lambda x: int(x.get("chapterOrder") or 0),
        ):
            chapters.append(
                {
                    "title": str(chapter.get("title") or "").strip(),
                    "description": str(chapter.get("description") or "").strip(),
                    "subChapters": chapter.get("subChapters") or [],
                }
            )
        title = str(matched[0].get("subject") or subject_title).strip()
        return {
            "id": f"course-subject:{title}",
            "title": title,
            "chapters": chapters,
            "_source": "courses",
        }

    if subject_id:
        sid = str(subject_id).strip()
        if sid.lower().startswith("course-subject:"):
            title_hint = sid.split(":", 1)[1].strip()
            doc = _doc_from_courses(title_hint)
            if doc:
                return doc
        hit_course = by_course_id.get(sid)
        if hit_course:
            doc = _doc_from_courses(str(hit_course.get("subject") or "").strip())
            if doc:
                return doc

    if subject_name:
        doc = _doc_from_courses(subject_name)
        if doc:
            return doc

    # Legacy fallback during migration window.
    if subject_id:
        doc = get_subject_by_id(subject_id)
        if doc:
            return doc
    if subject_name:
        doc = get_subject_by_title(subject_name)
        if doc:
            return doc
    return None


def _build_subchapter_specs(subject_doc: dict) -> list[dict[str, str]]:
    """
    Build a flat list of ``{chapter_title, subchapter_title, subject_title}``
    from a subject document's ``chapters[].subChapters[]`` hierarchy.
    """
    specs: list[dict[str, str]] = []
    seen: set[str] = set()
    subject_title = (subject_doc.get("title") or "").strip()
    subject_id = str(subject_doc.get("id") or "")
    chapters = subject_doc.get("chapters") or []

    for chapter in chapters:
        if not isinstance(chapter, dict):
            continue
        chapter_title = (chapter.get("title") or "").strip()
        # Some documents may use ``subChapters`` while others use ``subchapters``.
        sub_chapters = chapter.get("subChapters") or chapter.get("subchapters") or []
        for sc in sub_chapters:
            if not isinstance(sc, dict):
                continue
            sc_title = (sc.get("title") or "").strip()
            if not sc_title:
                continue
            dedupe_key = f"{chapter_title.lower()}|{sc_title.lower()}"
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            specs.append({
                "subject_id": subject_id,
                "subject_title": subject_title,
                "chapter_title": chapter_title,
                "subchapter_title": sc_title,
            })
    return specs


def _difficulty_sequence_for_count(count: int) -> list[str]:
    """Generate a varied difficulty sequence for N questions."""
    if count <= 0:
        return []
    pattern = ["medium", "hard", "easy"]
    return [pattern[i % len(pattern)] for i in range(count)]


def _norm_text(value: str) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return " ".join(text.split())


def _linked_course_ids_for_subject_title(subject_title: str) -> list[str]:
    """
    Map a Subject document title to Mongo ``courses`` ids for RAG filtering.
    Prefer exact ``course.subject`` matches; if none, allow fuzzy subject/title overlap.
    """
    target = _norm_text(subject_title)
    if not target:
        return []
    exact: list[str] = []
    fuzzy: list[str] = []
    seen_exact: set[str] = set()
    seen_fuzzy: set[str] = set()
    try:
        for c in get_all_courses() or []:
            cid = str(c.get("id") or "").strip()
            if not cid:
                continue
            subj_name = _norm_text(c.get("subject") or "")
            course_title = _norm_text(c.get("title") or "")
            if subj_name == target:
                if cid not in seen_exact:
                    exact.append(cid)
                    seen_exact.add(cid)
                continue
            fuzzy_hit = False
            if subj_name and len(target) >= 6:
                if target in subj_name or subj_name in target:
                    fuzzy_hit = True
            if not fuzzy_hit and course_title and len(target) >= 8:
                if target in course_title or course_title in target:
                    fuzzy_hit = True
            if fuzzy_hit and cid not in seen_fuzzy:
                fuzzy.append(cid)
                seen_fuzzy.add(cid)
    except Exception as exc:
        logger.warning("Could not map subject '%s' to courses: %s", subject_title, exc)
        return []
    chosen = exact if exact else fuzzy
    chosen = list(dict.fromkeys(chosen))

    def _has_chunks(cid: str) -> bool:
        try:
            coll = embeddings_pipeline_v2.get_or_create_chunked_collection(
                embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
            )
            peek = coll.get(where={"course_id": cid}, include=[], limit=1)
            return bool((peek or {}).get("ids"))
        except Exception:
            return False

    # Prefer chunk-backed IDs when available, but keep Mongo-linked IDs to avoid
    # falling back to global retrieval for subjects that are not fully embedded yet.
    with_chunks = [cid for cid in chosen if _has_chunks(cid)]
    if with_chunks:
        return with_chunks
    if chosen:
        logger.warning(
            "No chunk-backed course IDs for subject '%s'; using Mongo-linked IDs (%d)",
            subject_title,
            len(chosen),
        )
        return chosen

    # Last-resort fallback: recover from chunk metadata labels when Mongo mapping is missing.
    try:
        coll = embeddings_pipeline_v2.get_or_create_chunked_collection(
            embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
        )
        sample = coll.peek(limit=20000) or {}
        metas = sample.get("metadatas") or []
        recovered: list[str] = []
        seen_rec: set[str] = set()
        for m in metas:
            if not isinstance(m, dict):
                continue
            cid = str(m.get("course_id") or "").strip()
            if not cid or cid in seen_rec:
                continue
            label = _norm_text(
                f"{m.get('course_title', '')} {m.get('module_name', '')}"
            )
            if target and label and (target in label or label in target):
                seen_rec.add(cid)
                recovered.append(cid)
        if recovered:
            logger.warning(
                "Recovered %d course_id(s) for subject '%s' from chunk metadata fallback",
                len(recovered),
                subject_title,
            )
            return recovered
    except Exception as exc:
        logger.warning(
            "Chunk metadata fallback failed for subject '%s': %s",
            subject_title,
            exc,
        )

    return []


# ------------------------------------------------------------------
# Legacy helpers (kept for fallback when no subject doc exists)
# ------------------------------------------------------------------

def _subject_group_key_and_title(course: dict) -> tuple[str, str]:
    cid = str(course.get("id", "") or "")
    raw = course.get("subject")
    chapter_title = (course.get("title") or "").strip() or "Course"
    if raw is None:
        return f"course:{cid}", chapter_title
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return f"course:{cid}", chapter_title
        return _norm_text(s), s
    s = str(raw).strip()
    if not s:
        return f"course:{cid}", chapter_title
    return _norm_text(s), s


def _topic_course_specs_from_topic_rows(
    topic_rows: list[dict],
    count: int,
    *,
    seed: str = "",
) -> list[dict[str, str]]:
    by_course: dict[str, list[str]] = {}
    for m in topic_rows:
        if not isinstance(m, dict):
            continue
        cid = str(m.get("course_id") or "").strip()
        t = (m.get("title") or "").strip()
        if not cid or not t:
            continue
        by_course.setdefault(cid, [])
        if t not in by_course[cid]:
            by_course[cid].append(t)

    pairs: list[dict[str, str]] = []
    for cid, topics in by_course.items():
        for t in topics:
            pairs.append({"course_id": cid, "topic": t})

    if not pairs:
        return [{"course_id": "", "topic": "general"} for _ in range(count)][:count]

    seed_s = (seed or "default").strip()
    h = hashlib.sha256(seed_s.encode("utf-8")).digest()
    rng = random.Random(int.from_bytes(h[:8], "big"))
    order = pairs[:]
    rng.shuffle(order)

    specs: list[dict[str, str]] = []
    if len(order) >= count:
        specs = [dict(p) for p in order[:count]]
    else:
        for i in range(count):
            specs.append(dict(order[i % len(order)]))
    return specs[:count]


def _course_topic_rows(course: dict[str, Any]) -> list[dict[str, str]]:
    """Build topic rows from canonical subChapters."""
    cid = str(course.get("id") or "").strip()
    if not cid:
        return []
    rows: list[dict[str, str]] = []
    sub = course.get("subChapters") or course.get("subchapters") or []
    if isinstance(sub, list):
        for sc in sub:
            if not isinstance(sc, dict):
                continue
            t = (sc.get("title") or "").strip()
            if not t:
                continue
            rows.append(
                {
                    "title": t,
                    "description": (sc.get("description") or "")[:200],
                    "chapter_title": (course.get("title") or "").strip(),
                    "course_id": cid,
                }
            )
    if rows:
        return rows
    return rows


def _build_logical_subject_map() -> dict[str, dict[str, Any]]:
    courses = get_all_courses()
    courses = sorted(courses, key=lambda c: (c.get("title") or ""))

    subject_map: dict[str, dict[str, Any]] = {}
    for c in courses:
        gkey, display_title = _subject_group_key_and_title(c)
        cid = str(c.get("id", "") or "")
        chapter_title = (c.get("title") or "").strip()
        subject_map.setdefault(gkey, {"course_ids": [], "title": display_title, "topic_rows": []})
        info = subject_map[gkey]
        info["course_ids"].append(cid)
        raw_subj = c.get("subject")
        if isinstance(raw_subj, str) and raw_subj.strip():
            info["title"] = raw_subj.strip()

        topic_rows = _course_topic_rows(c)
        if topic_rows:
            info["topic_rows"].extend(topic_rows)
        elif chapter_title:
            info["topic_rows"].append(
                {
                    "title": chapter_title,
                    "description": (c.get("description") or "")[:200],
                    "chapter_title": chapter_title,
                    "course_id": cid,
                }
            )
    return subject_map


def _resolve_selected_groups(selected: list[str] | None, subject_map: dict[str, dict]) -> list[str]:
    if not selected:
        return list(subject_map.keys())
    course_to_group: dict[str, str] = {}
    for gkey, info in subject_map.items():
        for cid in info.get("course_ids") or []:
            course_to_group[str(cid)] = gkey
    out: list[str] = []
    seen: set[str] = set()
    for s in selected:
        s = str(s).strip()
        if not s:
            continue
        gkey = s if s in subject_map else course_to_group.get(s)
        if gkey and gkey not in seen:
            seen.add(gkey)
            out.append(gkey)
    return out if out else list(subject_map.keys())


# ------------------------------------------------------------------
# Main engine
# ------------------------------------------------------------------

class AdaptiveLevelTest:
    """Manages the lifecycle of one adaptive level-test session."""

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.policy_engine = AdaptivePolicyEngine()
        self.intervention_engine = InterventionEngine()

    # ------------------------------------------------------------------
    # 1. START  (pre-generates ALL questions in parallel)
    # ------------------------------------------------------------------

    def start_test(
        self,
        student_id: str,
        selected_subjects: list[str] | None = None,
        regenerate: bool = False,
        subject_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Initialise a test session.

        When ``subject_id`` is provided, the test is scoped to that single
        subject and generates one question per subchapter.  Otherwise falls
        back to legacy course-based grouping.
        """
        from .batch_question_generator import generate_all_subjects_parallel

        subject_doc = _resolve_subject_doc(
            subject_id=subject_id,
            subject_name=(selected_subjects[0] if selected_subjects else None),
        )

        if subject_doc:
            return self._start_subchapter_test(
                student_id, subject_doc, regenerate,
            )

        return self._start_legacy_test(
            student_id, selected_subjects, regenerate,
        )

    # ------------------------------------------------------------------
    # New subchapter-based test start
    # ------------------------------------------------------------------

    def _start_subchapter_test(
        self,
        student_id: str,
        subject_doc: dict,
        regenerate: bool,
    ) -> dict[str, Any]:
        from .batch_question_generator import generate_all_subjects_parallel

        subchapter_specs = _build_subchapter_specs(subject_doc)
        if not subchapter_specs:
            logger.warning(
                "Subject '%s' has no subchapters, falling back to legacy test",
                subject_doc.get("title"),
            )
            return self._start_legacy_test(
                student_id,
                [subject_doc.get("title") or ""],
                regenerate,
            )

        subject_title = (subject_doc.get("title") or "").strip()
        subject_db_id = str(subject_doc.get("id") or "")
        total_questions = len(subchapter_specs)
        session_seed = str(uuid.uuid4())

        # RAG chunks are primarily linked to course IDs from ``courses``.
        # In subchapter mode we receive a Subject document ID, so map it to the
        # related course IDs by subject name to avoid unfiltered/global retrieval.
        linked_course_ids = _linked_course_ids_for_subject_title(subject_title)
        if not linked_course_ids:
            logger.warning(
                "No courses linked for subject title '%s'; level-test RAG may be weak or global",
                subject_title,
            )
        else:
            logger.info(
                "Linked %d course(s) to subject '%s' for RAG",
                len(linked_course_ids),
                subject_title,
            )

        topics = [s["subchapter_title"] for s in subchapter_specs]
        diffs = _difficulty_sequence_for_count(total_questions)

        gkey = subject_db_id or subject_title.lower()

        batch_input = [
            {
                "key": gkey,
                "title": subject_title,
                "topics": topics,
                "difficulties": diffs,
                "count": total_questions,
                "course_ids": linked_course_ids,
                "question_course_ids": [
                    linked_course_ids[i % len(linked_course_ids)] if linked_course_ids else ""
                    for i in range(total_questions)
                ],
                "diversity_seed": session_seed,
            }
        ]

        logger.info(
            "Pre-generating %d questions (1 per subchapter) for subject '%s'...",
            total_questions,
            subject_title,
        )
        all_questions = generate_all_subjects_parallel(
            batch_input,
            self.rag_service,
            use_cache=not regenerate,
        )

        questions_pool = all_questions.get(gkey, [])
        for i, q in enumerate(questions_pool):
            if i < len(subchapter_specs):
                spec = subchapter_specs[i]
                q["topic"] = spec["subchapter_title"]
                q["chapter_title"] = spec["chapter_title"]
                q["subject_title"] = spec["subject_title"]
            # Ensure correctAnswer is always set before storing in MongoDB
            ca = str(q.get("correct_answer") or q.get("correctAnswer") or "").strip()
            if not ca and isinstance(q.get("options"), list) and q["options"]:
                ca = str(q["options"][0]).strip()
            q["correct_answer"] = ca
            q["correctAnswer"] = ca

        session_id = str(uuid.uuid4())
        subjects_state = {
            gkey: {
                "group_key": gkey,
                "course_id": subject_db_id,
                "course_ids": linked_course_ids,
                "title": subject_title,
                "subject_db_id": subject_db_id,
                "subchapter_specs": subchapter_specs,
                "questions_per_subject": total_questions,
                "current_difficulty": "medium",
                "questions_asked": 0,
                "answers": [],
                "completed": False,
                "question_pool": questions_pool,
            }
        }

        session = {
            "session_id": session_id,
            "student_id": student_id,
            "subjects": subjects_state,
            "subject_order": [gkey],
            "current_subject_idx": 0,
            "status": "in_progress",
            "started_at": _now_iso(),
            "completed_at": None,
            "test_mode": "subchapter",
        }
        _col().insert_one(session)
        logger.info(
            "Level test started (subchapter mode): session=%s student=%s subject=%s questions=%d",
            session_id, student_id, subject_title, total_questions,
        )

        first_q = self._serve_next_question(session)
        return {
            "session_id": session_id,
            "subjects": [
                {
                    "subject_key": gkey,
                    "course_id": subject_db_id,
                    "course_ids": linked_course_ids,
                    "title": subject_title,
                }
            ],
            "total_questions": total_questions,
            "first_question": first_q,
        }

    # ------------------------------------------------------------------
    # Legacy test start (fallback)
    # ------------------------------------------------------------------

    def _start_legacy_test(
        self,
        student_id: str,
        selected_subjects: list[str] | None,
        regenerate: bool,
    ) -> dict[str, Any]:
        from .batch_question_generator import generate_all_subjects_parallel

        subject_map = _build_logical_subject_map()
        selected_groups = _resolve_selected_groups(selected_subjects, subject_map)

        session_seed = str(uuid.uuid4())

        batch_input: list[dict] = []
        for gkey in selected_groups:
            info = subject_map[gkey]
            topic_rows = info["topic_rows"]
            topic_specs = _topic_course_specs_from_topic_rows(
                topic_rows,
                QUESTIONS_PER_SUBJECT_FALLBACK,
                seed=session_seed,
            )
            topics = [s.get("topic") or "general" for s in topic_specs]
            question_course_ids = [s.get("course_id") or "" for s in topic_specs]
            diffs = ["medium", "hard"]
            batch_input.append(
                {
                    "key": gkey,
                    "title": info["title"],
                    "topics": topics,
                    "difficulties": diffs,
                    "count": QUESTIONS_PER_SUBJECT_FALLBACK,
                    "course_ids": list(info.get("course_ids") or []),
                    "question_course_ids": question_course_ids,
                    "diversity_seed": session_seed,
                }
            )

        logger.info(
            "Pre-generating questions (legacy mode) for %d logical subject(s)...",
            len(batch_input),
        )
        all_questions = generate_all_subjects_parallel(
            batch_input,
            self.rag_service,
            use_cache=not regenerate,
        )

        session_id = str(uuid.uuid4())
        subjects_state: dict[str, dict] = {}
        for gkey in selected_groups:
            info = subject_map[gkey]
            questions_pool = all_questions.get(gkey, [])
            cids = info.get("course_ids") or []
            subjects_state[gkey] = {
                "group_key": gkey,
                "course_id": cids[0] if cids else gkey,
                "course_ids": cids,
                "title": info["title"],
                "topic_rows": info["topic_rows"],
                "questions_per_subject": QUESTIONS_PER_SUBJECT_FALLBACK,
                "current_difficulty": "medium",
                "questions_asked": 0,
                "answers": [],
                "completed": False,
                "question_pool": questions_pool,
            }

        session = {
            "session_id": session_id,
            "student_id": student_id,
            "subjects": subjects_state,
            "subject_order": selected_groups,
            "current_subject_idx": 0,
            "status": "in_progress",
            "started_at": _now_iso(),
            "completed_at": None,
            "test_mode": "legacy",
        }
        _col().insert_one(session)
        logger.info(
            "Level test started (legacy mode): session=%s student=%s logical_subjects=%d",
            session_id, student_id, len(selected_groups),
        )

        first_q = self._serve_next_question(session)
        total_questions = sum(
            s.get("questions_per_subject", QUESTIONS_PER_SUBJECT_FALLBACK)
            for s in subjects_state.values()
        )
        return {
            "session_id": session_id,
            "subjects": [
                {
                    "subject_key": gkey,
                    "course_id": (subject_map[gkey].get("course_ids") or [gkey])[0],
                    "course_ids": subject_map[gkey].get("course_ids") or [],
                    "title": subject_map[gkey]["title"],
                }
                for gkey in selected_groups
            ],
            "total_questions": total_questions,
            "first_question": first_q,
        }

    # ------------------------------------------------------------------
    # 2. SUBMIT ANSWER  (instant — no LLM call)
    # ------------------------------------------------------------------

    def submit_answer(
        self,
        session_id: str,
        answer: str,
    ) -> dict[str, Any]:
        session = _col().find_one({"session_id": session_id})
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session["status"] != "in_progress":
            raise ValueError("Test already completed")

        subj_key = session["subject_order"][session["current_subject_idx"]]
        subj = session["subjects"][subj_key]
        answers = subj["answers"]

        if not answers or answers[-1].get("answered"):
            raise ValueError("No pending question to answer")

        current_q = answers[-1]
        correct_answer = (
            current_q["question"].get("correct_answer")
            or current_q["question"].get("correctAnswer")
            or ""
        )
        is_correct = answer.strip().lower() == str(correct_answer).strip().lower()

        current_q["student_answer"] = answer
        current_q["is_correct"] = is_correct
        current_q["answered"] = True
        current_q["answered_at"] = _now_iso()
        rt = self._response_time_sec(current_q.get("generated_at"), current_q.get("answered_at"))
        if rt is not None:
            current_q["response_time_sec"] = rt

        old_diff = subj["current_difficulty"]
        policy = self.policy_engine.decide_next_difficulty(
            current_difficulty=old_diff,
            recent_answers=subj.get("answers", []),
            confidence_score=self._estimate_confidence(subj.get("answers", [])),
            hint_used=False,
        )
        new_diff = policy["target_difficulty"]
        subj["current_difficulty"] = new_diff
        intervention = self.intervention_engine.evaluate(
            recent_answers=subj.get("answers", []),
            confidence_score=self._estimate_confidence(subj.get("answers", [])),
        )

        total_asked = sum(s["questions_asked"] for s in session["subjects"].values())
        total_total = sum(
            s.get("questions_per_subject", QUESTIONS_PER_SUBJECT_FALLBACK)
            for s in session["subjects"].values()
        )
        explanation = current_q["question"].get("explanation", "")

        _col().update_one(
            {"session_id": session_id},
            {"$set": {f"subjects.{subj_key}": subj}},
        )

        qps = subj.get("questions_per_subject", QUESTIONS_PER_SUBJECT_FALLBACK)

        if subj["questions_asked"] >= qps:
            subj["completed"] = True
            _col().update_one(
                {"session_id": session_id},
                {"$set": {f"subjects.{subj_key}.completed": True}},
            )
            next_idx = session["current_subject_idx"] + 1
            if next_idx < len(session["subject_order"]):
                _col().update_one(
                    {"session_id": session_id},
                    {"$set": {"current_subject_idx": next_idx}},
                )
                session["current_subject_idx"] = next_idx
                session = _col().find_one({"session_id": session_id})
                next_q = self._serve_next_question(session)
                return {
                    "correct": is_correct,
                    "correct_answer": correct_answer,
                    "explanation": explanation,
                    "next_difficulty": new_diff,
                    "difficulty_policy": policy,
                    "intervention": intervention,
                    "progress": {"answered": total_asked, "total": total_total},
                    "subject_completed": subj_key,
                    "finished": False,
                    "next_question": next_q,
                }
            else:
                profile = self.complete_test(session_id)
                return {
                    "correct": is_correct,
                    "correct_answer": correct_answer,
                    "explanation": explanation,
                    "next_difficulty": None,
                    "difficulty_policy": policy,
                    "intervention": intervention,
                    "progress": {"answered": total_asked, "total": total_total},
                    "subject_completed": subj_key,
                    "finished": True,
                    "profile": profile,
                }

        session = _col().find_one({"session_id": session_id})
        next_q = self._serve_next_question(session, target_difficulty=new_diff)
        return {
            "correct": is_correct,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "next_difficulty": new_diff,
            "difficulty_policy": policy,
            "intervention": intervention,
            "progress": {"answered": total_asked, "total": total_total},
            "finished": False,
            "next_question": next_q,
        }

    # ------------------------------------------------------------------
    # 3. COMPLETE
    # ------------------------------------------------------------------

    def complete_test(self, session_id: str) -> dict[str, Any]:
        from .scoring import generate_student_profile

        session = _col().find_one({"session_id": session_id})
        if not session:
            raise ValueError(f"Session {session_id} not found")

        _col().update_one(
            {"session_id": session_id},
            {"$set": {"status": "completed", "completed_at": _now_iso()}},
        )
        profile = generate_student_profile(session)
        _col().update_one(
            {"session_id": session_id},
            {"$set": {"profile": profile}},
        )
        logger.info("Level test completed: session=%s", session_id)
        return profile

    # ------------------------------------------------------------------
    # 4. GET SESSION
    # ------------------------------------------------------------------

    def get_session(self, session_id: str) -> dict[str, Any] | None:
        doc = _col().find_one({"session_id": session_id}, {"_id": 0})
        return doc

    # ------------------------------------------------------------------
    # INTERNALS
    # ------------------------------------------------------------------

    def _materialize_lazy_question(
        self,
        session: dict,
        subj_key: str,
        subj: dict,
        lazy_payload: dict[str, Any],
        fallback_difficulty: str,
    ) -> dict[str, Any]:
        """
        Generate a real question on demand for slots deferred during start_test.
        This avoids serving generic filler when initial pre-generation hits time budget.
        """
        from level_test.batch_question_generator import generate_batch_for_subject

        topic = str(lazy_payload.get("topic") or "general").strip() or "general"
        difficulty = str(lazy_payload.get("difficulty") or fallback_difficulty).strip() or fallback_difficulty
        chapter_title = str(lazy_payload.get("chapter_title") or "")
        course_ids = [str(x).strip() for x in (subj.get("course_ids") or []) if str(x).strip()]
        seed = f"{session.get('session_id','')}:{subj_key}:{subj.get('questions_asked',0)}:lazy"
        generated_list = generate_batch_for_subject(
            subject_title=subj.get("title", ""),
            topics=[topic],
            difficulties=[difficulty],
            count=1,
            rag_service=self.rag_service,
            course_ids=course_ids,
            question_course_ids=[course_ids[0]] if course_ids else [],
            use_cache=False,
            diversity_seed=seed,
        )
        generated = generated_list[0] if generated_list else None

        if not isinstance(generated, dict) or not generated.get("question") or not generated.get("options"):
            generated = self._fallback_question(subj.get("title", ""), topic, difficulty)

        generated["topic"] = topic
        generated["difficulty"] = difficulty
        generated["chapter_title"] = chapter_title
        generated.setdefault("type", "MCQ")
        return generated

    def _serve_next_question(self, session: dict, target_difficulty: str | None = None) -> dict[str, Any]:
        """Pick the next pre-generated question from the pool (instant)."""
        subj_key = session["subject_order"][session["current_subject_idx"]]
        subj = session["subjects"][subj_key]
        q_num = subj["questions_asked"]
        pool = subj.get("question_pool", [])
        question = None
        selected_pool_idx: int | None = None
        if q_num < len(pool):
            if target_difficulty:
                used_indices = {a.get("question_index") for a in subj.get("answers", [])}
                for i, cand in enumerate(pool):
                    if i in used_indices:
                        continue
                    if str(cand.get("difficulty", "")).lower() == target_difficulty.lower():
                        question = cand
                        selected_pool_idx = i
                        break
            if question is None:
                question = pool[q_num]
                selected_pool_idx = q_num
        if question is None:
            question = self._fallback_question(subj["title"], "general", target_difficulty or subj["current_difficulty"])
        elif isinstance(question, dict) and question.get("__lazy_generate__"):
            question = self._materialize_lazy_question(
                session=session,
                subj_key=subj_key,
                subj=subj,
                lazy_payload=question,
                fallback_difficulty=target_difficulty or subj["current_difficulty"],
            )
            if selected_pool_idx is not None and selected_pool_idx < len(pool):
                pool[selected_pool_idx] = question
                _col().update_one(
                    {"session_id": session["session_id"]},
                    {"$set": {f"subjects.{subj_key}.question_pool": pool}},
                )

        difficulty = question.get("difficulty", subj["current_difficulty"])
        topic = question.get("topic", "general")
        chapter_title = question.get("chapter_title", "")

        answer_entry = {
            "question_index": q_num,
            "question": question,
            "difficulty": difficulty,
            "topic": topic,
            "chapter_title": chapter_title,
            "subject_key": subj_key,
            "answered": False,
            "generated_at": _now_iso(),
        }
        subj["answers"].append(answer_entry)
        subj["questions_asked"] = q_num + 1

        _col().update_one(
            {"session_id": session["session_id"]},
            {"$set": {
                f"subjects.{subj_key}.answers": subj["answers"],
                f"subjects.{subj_key}.questions_asked": subj["questions_asked"],
            }},
        )

        total_asked = sum(s["questions_asked"] for s in session["subjects"].values())
        total_total = sum(
            s.get("questions_per_subject", QUESTIONS_PER_SUBJECT_FALLBACK)
            for s in session["subjects"].values()
        )

        return {
            "question": question.get("question", ""),
            "options": question.get("options", []),
            "difficulty": difficulty,
            "topic": topic,
            "chapter_title": chapter_title,
            "subject": subj["title"],
            "question_index": q_num,
            "progress": {"answered": total_asked - 1, "total": total_total},
        }

    @staticmethod
    def _adapt_difficulty(current: str, is_correct: bool) -> str:
        idx = DIFFICULTIES.index(current) if current in DIFFICULTIES else 1
        if is_correct:
            idx = min(idx + 1, len(DIFFICULTIES) - 1)
        else:
            idx = max(idx - 1, 0)
        return DIFFICULTIES[idx]

    @staticmethod
    def _fallback_question(subject: str, topic: str, difficulty: str) -> dict:
        from level_test.batch_question_generator import _fallback_question as _safe_fallback

        q = _safe_fallback(subject=subject, slot_topic=topic, difficulty=difficulty)
        q.setdefault("questionText", q.get("question", ""))
        q.setdefault("correctAnswer", q.get("correct_answer", ""))
        q.setdefault("explanation", "")
        return q

    @staticmethod
    def _response_time_sec(started_iso: str | None, ended_iso: str | None) -> float | None:
        if not started_iso or not ended_iso:
            return None
        try:
            s = datetime.fromisoformat(started_iso)
            e = datetime.fromisoformat(ended_iso)
            return max(0.0, (e - s).total_seconds())
        except Exception:
            return None

    @staticmethod
    def _estimate_confidence(answers: list[dict[str, Any]]) -> float:
        answered = [a for a in answers if a.get("answered")]
        if not answered:
            return 0.5
        correct = sum(1 for a in answered if a.get("is_correct"))
        return correct / max(len(answered), 1)
