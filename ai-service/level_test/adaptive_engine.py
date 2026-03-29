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
import random
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

        All questions for every subject are loaded from real imported exercises
        in parallel during this call — subsequent ``submit_answer`` calls are instant.
        """
        from .batch_question_generator import generate_all_subjects_parallel_from_real_exercises

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

        logger.info("Loading real exercises for %d subjects in parallel...", len(batch_input))
        all_questions = generate_all_subjects_parallel_from_real_exercises(batch_input)

        def _qid(q: dict) -> str:
            oid = str((q or {}).get("original_id") or "").strip()
            if oid:
                return f"id:{oid}"
            return f"txt:{str((q or {}).get('question', '')).strip().lower()}"

        def _dedupe_pool(pool: list[dict]) -> list[dict]:
            out: list[dict] = []
            seen: set[str] = set()
            for q in pool or []:
                key = _qid(q)
                if not key or key in seen:
                    continue
                seen.add(key)
                out.append(q)
            return out

        session_id = str(uuid.uuid4())
        subjects_state: dict[str, dict] = {}
        for sid in selected_subjects:
            info = subject_map[sid]
            questions_pool = _dedupe_pool(all_questions.get(sid, []))
            if len(questions_pool) < QUESTIONS_PER_SUBJECT:
                raise ValueError(
                    f"Not enough unique real questions for chapter '{info['title']}' "
                    f"({len(questions_pool)}/{QUESTIONS_PER_SUBJECT}). "
                    "Add more real exercises for this chapter."
                )
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

        # Session-wide already asked keys (across all subjects) to avoid repeats.
        asked_keys: set[str] = set()
        for sk in session.get("subject_order", []):
            sstate = session.get("subjects", {}).get(sk, {})
            for a in sstate.get("answers", []) or []:
                qd = a.get("question") or {}
                key = self._question_key(qd)
                if key:
                    asked_keys.add(key)

        used_indices = {
            a.get("pool_index")
            for a in subj.get("answers", [])
            if a.get("pool_index") is not None
        }
        if not used_indices:
            used_indices = {a.get("question_index") for a in subj.get("answers", [])}

        question = None
        selected_pool_index: int | None = None

        def _candidate_ok(i: int, cand: dict) -> bool:
            if i in used_indices:
                return False
            key = self._question_key(cand)
            if key and key in asked_keys:
                return False
            return self._is_complete_question_dict(cand)

        if target_difficulty:
            for i, cand in enumerate(pool):
                if not _candidate_ok(i, cand):
                    continue
                if str(cand.get("difficulty", "")).lower() == target_difficulty.lower():
                    question = cand
                    selected_pool_index = i
                    break

        if question is None:
            for i, cand in enumerate(pool):
                if not _candidate_ok(i, cand):
                    continue
                question = cand
                selected_pool_index = i
                break

        if question is None:
            raise ValueError(
                f"No more unique real questions available for chapter '{subj['title']}'. "
                "Fallback is disabled by configuration."
            )

        difficulty = question.get("difficulty", subj["current_difficulty"])
        topic = question.get("topic", "general")

        answer_entry = {
            "question_index": q_num,
            "pool_index": selected_pool_index,
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
    def _coherent_static_fallback(subject_title: str, difficulty: str) -> dict:
        bank = [
            {
                "question": "In C, what does #include <stdio.h> provide?",
                "options": [
                    "A. Input/output functions like printf and scanf",
                    "B. Dynamic memory allocation only",
                    "C. Math functions only",
                    "D. Thread scheduling APIs",
                ],
                "correct_answer": "A. Input/output functions like printf and scanf",
                "topic": "C programming basics",
            },
            {
                "question": "What is the primary purpose of a variable in programming?",
                "options": [
                    "A. To store and update values",
                    "B. To compile source code",
                    "C. To define the operating system",
                    "D. To replace all functions",
                ],
                "correct_answer": "A. To store and update values",
                "topic": "Programming fundamentals",
            },
            {
                "question": "What does an if statement do?",
                "options": [
                    "A. Executes code conditionally",
                    "B. Declares a new data type",
                    "C. Compiles the project",
                    "D. Creates a database table",
                ],
                "correct_answer": "A. Executes code conditionally",
                "topic": "Control flow",
            },
        ]
        q = random.choice(bank).copy()
        q.update({
            "explanation": f"Fallback coherent MCQ for {subject_title}.",
            "difficulty": difficulty,
            "type": "MCQ",
        })
        return q

    @staticmethod
    def _question_key(question: dict) -> str:
        oid = str((question or {}).get("original_id") or "").strip()
        if oid:
            return f"id:{oid}"
        stem = str((question or {}).get("question", "")).strip().lower()
        return f"txt:{stem}" if stem else ""

    @staticmethod
    def _is_complete_question_dict(question: dict) -> bool:
        stem = str((question or {}).get("question", "")).strip()
        options = (question or {}).get("options") or []
        if not stem or len(options) < 2:
            return False

        low = stem.lower()
        if low == "quelle est la sortie ?":
            return False

        asks_output = any(
            marker in low
            for marker in [
                "quelle est la sortie",
                "que va-t-il s'afficher",
                "que va-t-il s’afficher",
                "what is the output",
            ]
        )
        if asks_output:
            has_output_call = any(token in low for token in ["printf", "cout", "system.out", "print"])
            if not has_output_call:
                return False

        asks_code_context = any(
            marker in low
            for marker in [
                "soit le code suivant",
                "considérez le code suivant",
                "considerez le code suivant",
                "given the following code",
                "following code",
            ]
        )
        if asks_code_context:
            has_code_context = any(
                token in low
                for token in ["\n", ";", " if ", " for ", " while ", "switch", " case ", "return "]
            )
            if not has_code_context:
                return False

        return True

    @classmethod
    def _fallback_question(
        cls,
        subject_key: str,
        subject_title: str,
        difficulty: str,
        excluded_keys: set[str] | None = None,
    ) -> dict:
        """Avoid generic placeholders by preferring real exercises first.
        Never return duplicate questions (even fallback statics)."""
        excluded = excluded_keys or set()
        tried_fallback_keys: set[str] = set()
        
        try:
            from level_test.real_exercise_loader import get_level_test_questions

            # Prefer same-course real question.
            local_q = get_level_test_questions(
                course_id=subject_key,
                num_questions=8,
                difficulty="mixed",
            )
            for cand in local_q or []:
                key = cls._question_key(cand)
                if key and key in excluded:
                    continue
                if not cls._is_complete_question_dict(cand):
                    continue
                q = dict(cand)
                q["difficulty"] = difficulty
                return q

            # Then use any real imported question globally.
            global_q = get_level_test_questions(
                course_id=None,
                num_questions=12,
                difficulty="mixed",
            )
            for cand in global_q or []:
                key = cls._question_key(cand)
                if key and key in excluded:
                    continue
                if not cls._is_complete_question_dict(cand):
                    continue
                q = dict(cand)
                q["difficulty"] = difficulty
                return q
        except Exception:
            pass

        # Final safety net: coherent static MCQ (never placeholder text).
        # Try up to 10 times to get a non-duplicate fallback
        for _ in range(10):
            q = cls._coherent_static_fallback(subject_title, difficulty)
            key = cls._question_key(q)
            if key and (key in excluded or key in tried_fallback_keys):
                continue
            tried_fallback_keys.add(key)
            return q

        # If all attempts produced duplicates, still return (shouldn't happen with 3 uniques in bank)
        return cls._coherent_static_fallback(subject_title, difficulty)

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
