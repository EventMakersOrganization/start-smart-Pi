"""
Adaptive level-test engine (v2 — logical subject grouping).

- Courses that share the same MongoDB `subject` field are treated as ONE logical subject.
- One logical subject gets a pool of QUESTIONS_PER_SUBJECT MCQs, sampled across its chapters/modules.
- Questions are pre-generated in parallel on start_test; submit_answer is instant.
"""
from __future__ import annotations

import logging
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.db_connection import get_database, get_all_courses
from core.rag_service import RAGService
from adaptive.policy_engine import AdaptivePolicyEngine
from adaptive.intervention_engine import InterventionEngine

logger = logging.getLogger("adaptive_engine")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)

DIFFICULTIES = ["easy", "medium", "hard"]
QUESTIONS_PER_SUBJECT = 5
_COLLECTION = "level_test_sessions"


def _col():
    return get_database()[_COLLECTION]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
        return s.lower(), s
    s = str(raw).strip()
    if not s:
        return f"course:{cid}", chapter_title
    return s.lower(), s


def _topic_course_specs_from_modules(
    modules: list[dict],
    count: int,
    *,
    seed: str = "",
) -> list[dict[str, str]]:
    by_course: dict[str, list[str]] = {}
    for m in modules:
        if not isinstance(m, dict):
            continue
        cid = str(m.get("course_id") or "").strip()
        t = (m.get("title") or "").strip()
        if not cid or not t:
            continue
        by_course.setdefault(cid, [])
        if t not in by_course[cid]:
            by_course[cid].append(t)

    ordered_courses = list(by_course.keys())
    specs: list[dict[str, str]] = []
    if ordered_courses:
        # Use a per-session seed so module sampling changes between API calls/students.
        offsets: dict[str, int] = {
            cid: (abs(hash(f"{seed}|{cid}")) % max(len(by_course.get(cid) or []), 1))
            for cid in ordered_courses
        }
        i = 0
        while len(specs) < count:
            cid = ordered_courses[i % len(ordered_courses)]
            topics = by_course.get(cid) or ["general"]
            off = offsets.get(cid, 0)
            local_k = (i // len(ordered_courses)) % max(len(topics), 1)
            topic = topics[(off + local_k) % max(len(topics), 1)]
            specs.append({"course_id": cid, "topic": topic})
            i += 1

    while len(specs) < count:
        specs.append({"course_id": "", "topic": "general"})
    return specs[:count]


def _build_logical_subject_map() -> dict[str, dict[str, Any]]:
    courses = get_all_courses()
    courses = sorted(courses, key=lambda c: (c.get("title") or ""))

    subject_map: dict[str, dict[str, Any]] = {}
    for c in courses:
        gkey, display_title = _subject_group_key_and_title(c)
        cid = str(c.get("id", "") or "")
        chapter_title = (c.get("title") or "").strip()
        subject_map.setdefault(gkey, {"course_ids": [], "title": display_title, "modules": []})
        info = subject_map[gkey]
        info["course_ids"].append(cid)
        raw_subj = c.get("subject")
        if isinstance(raw_subj, str) and raw_subj.strip():
            info["title"] = raw_subj.strip()

        modules = c.get("modules", [])
        if isinstance(modules, list):
            for m in modules:
                if isinstance(m, dict):
                    info["modules"].append(
                        {
                            "title": m.get("title", ""),
                            "description": (m.get("description") or "")[:200],
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
    ) -> dict[str, Any]:
        """
        Initialise a test session.

        All questions for every subject are pre-generated in parallel
        during this call — subsequent ``submit_answer`` calls are instant.
        """
        from .batch_question_generator import generate_all_subjects_parallel

        subject_map = _build_logical_subject_map()
        selected_groups = _resolve_selected_groups(selected_subjects, subject_map)

        # Per-session seed to reduce repeats across students / repeated starts.
        session_seed = str(uuid.uuid4())

        batch_input: list[dict] = []
        for gkey in selected_groups:
            info = subject_map[gkey]
            modules = info["modules"]
            topic_specs = _topic_course_specs_from_modules(
                modules,
                QUESTIONS_PER_SUBJECT,
                seed=session_seed,
            )
            topics = [s.get("topic") or "general" for s in topic_specs]
            question_course_ids = [s.get("course_id") or "" for s in topic_specs]
            diffs = self._initial_difficulty_sequence()
            batch_input.append(
                {
                    "key": gkey,
                    "title": info["title"],
                    "topics": topics,
                    "difficulties": diffs,
                    "count": QUESTIONS_PER_SUBJECT,
                    "course_ids": list(info.get("course_ids") or []),
                    "question_course_ids": question_course_ids,
                    "diversity_seed": session_seed,
                }
            )

        logger.info(
            "Pre-generating questions for %d logical subject(s) in parallel...",
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
                "modules": info["modules"],
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
        }
        _col().insert_one(session)
        logger.info(
            "Level test started: session=%s student=%s logical_subjects=%d",
            session_id,
            student_id,
            len(selected_groups),
        )

        first_q = self._serve_next_question(session)
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
            "total_questions": len(selected_groups) * QUESTIONS_PER_SUBJECT,
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
        correct_answer = current_q["question"].get("correct_answer", "")
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
        total_total = len(session["subject_order"]) * QUESTIONS_PER_SUBJECT
        explanation = current_q["question"].get("explanation", "")

        _col().update_one(
            {"session_id": session_id},
            {"$set": {f"subjects.{subj_key}": subj}},
        )

        if subj["questions_asked"] >= QUESTIONS_PER_SUBJECT:
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
    # INTERNALS — no LLM calls after start_test
    # ------------------------------------------------------------------

    def _serve_next_question(self, session: dict, target_difficulty: str | None = None) -> dict[str, Any]:
        """Pick the next pre-generated question from the pool (instant)."""
        subj_key = session["subject_order"][session["current_subject_idx"]]
        subj = session["subjects"][subj_key]
        q_num = subj["questions_asked"]
        pool = subj.get("question_pool", [])
        question = None
        if q_num < len(pool):
            if target_difficulty:
                used_indices = {a.get("question_index") for a in subj.get("answers", [])}
                for i, cand in enumerate(pool):
                    if i in used_indices:
                        continue
                    if str(cand.get("difficulty", "")).lower() == target_difficulty.lower():
                        question = cand
                        break
            if question is None:
                question = pool[q_num]
        if question is None:
            question = self._fallback_question(subj["title"], "general", target_difficulty or subj["current_difficulty"])

        difficulty = question.get("difficulty", subj["current_difficulty"])
        topic = question.get("topic", "general")

        answer_entry = {
            "question_index": q_num,
            "question": question,
            "difficulty": difficulty,
            "topic": topic,
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
        total_total = len(session["subject_order"]) * QUESTIONS_PER_SUBJECT

        return {
            "question": question.get("question", ""),
            "options": question.get("options", []),
            "difficulty": difficulty,
            "topic": topic,
            "subject": subj["title"],
            "question_index": q_num,
            "progress": {"answered": total_asked - 1, "total": total_total},
        }

    @staticmethod
    def _initial_difficulty_sequence() -> list[str]:
        """Starting difficulties for the 5 questions per subject.
        Start medium, cover all levels so scoring has differentiated weights."""
        return ["medium", "medium", "easy", "hard", "medium"]

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
