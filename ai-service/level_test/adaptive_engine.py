"""
Adaptive level-test engine (v2 — high-performance).

Key speed improvements over v1:
  * On ``start_test``, ALL questions for ALL subjects are pre-generated
    in PARALLEL via ``batch_question_generator`` (one LLM call per subject,
    subjects processed concurrently). This turns 40 sequential LLM calls
    into ~8 parallel calls.
  * ``submit_answer`` is instant — no LLM call, just picks the next
    pre-generated question and adjusts difficulty.
  * Questions are cached so identical test configs skip the LLM entirely.

State machine:
  START at MEDIUM → correct ⇒ go UP, wrong ⇒ go DOWN
  After N questions per subject → compute per-module mastery.

All state is persisted in MongoDB ``level_test_sessions``.
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


def _build_subject_map() -> dict[str, dict]:
    """Map each course (chapter) to its modules for topic selection."""
    courses = get_all_courses()
    subject_map: dict[str, dict] = {}
    for c in courses:
        cid = c.get("id", "")
        title = c.get("title", "")
        modules = c.get("modules", [])
        mod_list = []
        if isinstance(modules, list):
            for m in modules:
                if isinstance(m, dict):
                    mod_list.append({
                        "title": m.get("title", ""),
                        "description": (m.get("description") or "")[:200],
                    })
        subject_map[cid] = {
            "course_id": cid,
            "title": title,
            "modules": mod_list,
        }
    return subject_map


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
    ) -> dict[str, Any]:
        """
        Initialise a test session.

        All questions for every subject are pre-generated in parallel
        during this call — subsequent ``submit_answer`` calls are instant.
        """
        from .batch_question_generator import generate_all_subjects_parallel

        subject_map = _build_subject_map()

        if not subject_map:
            raise ValueError(
                "No courses found in MongoDB collection 'courses'. Ingest your existing ai-service courses first."
            )

        logger.info(
            "Using %d existing course(s) from MongoDB for level test: %s",
            len(subject_map),
            ", ".join([v.get("title", "") for v in subject_map.values()]),
        )
        if not selected_subjects:
            selected_subjects = list(subject_map.keys())
        else:
            selected_subjects = [s for s in selected_subjects if s in subject_map]
            if not selected_subjects:
                selected_subjects = list(subject_map.keys())

        batch_input: list[dict] = []
        for sid in selected_subjects:
            info = subject_map[sid]
            modules = info["modules"]
            topics = [m["title"] for m in modules[:QUESTIONS_PER_SUBJECT]]
            while len(topics) < QUESTIONS_PER_SUBJECT:
                topics.append(topics[len(topics) % max(len(topics), 1)])
            diffs = self._initial_difficulty_sequence()
            batch_input.append({
                "key": sid,
                "title": info["title"],
                "topics": topics,
                "difficulties": diffs,
                "count": QUESTIONS_PER_SUBJECT,
            })

        logger.info("Pre-generating questions for %d subjects in parallel...", len(batch_input))
        all_questions = generate_all_subjects_parallel(batch_input, self.rag_service)

        session_id = str(uuid.uuid4())
        subjects_state: dict[str, dict] = {}
        for sid in selected_subjects:
            info = subject_map[sid]
            questions_pool = all_questions.get(sid, [])
            subjects_state[sid] = {
                "course_id": sid,
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
            "subject_order": selected_subjects,
            "current_subject_idx": 0,
            "status": "in_progress",
            "started_at": _now_iso(),
            "completed_at": None,
        }
        _col().insert_one(session)
        logger.info("Level test started: session=%s student=%s subjects=%d",
                     session_id, student_id, len(selected_subjects))

        first_q = self._serve_next_question(session)
        return {
            "session_id": session_id,
            "subjects": [
                {"course_id": s, "title": subject_map[s]["title"]}
                for s in selected_subjects
            ],
            "total_questions": len(selected_subjects) * QUESTIONS_PER_SUBJECT,
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
