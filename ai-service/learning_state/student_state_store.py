"""Persistent learner-state store and lightweight adaptation rules."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.db_connection import get_database
from adaptive.pacing_engine import PacingEngine
from learning_state.concept_mastery_graph import update_concept_mastery

_COLLECTION = "student_learning_state"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_doc(doc: dict[str, Any] | None) -> dict[str, Any] | None:
    if not doc:
        return None
    out = dict(doc)
    out.pop("_id", None)
    return out


class StudentStateStore:
    """
    Continuous learner-state persistence.

    This is intentionally simple and deterministic to keep it predictable:
    - Level test updates long-term baseline (mastery, strengths/weaknesses).
    - Learning events update pace/confidence and engagement counters.
    """

    def __init__(self) -> None:
        self._col = get_database()[_COLLECTION]
        self._pacing_engine = PacingEngine()

    def get_state(self, student_id: str) -> dict[str, Any] | None:
        doc = self._col.find_one({"student_id": student_id})
        return _clean_doc(doc)

    def upsert_from_level_test(
        self,
        student_profile: dict[str, Any],
        session_id: str | None = None,
    ) -> dict[str, Any]:
        student_id = str(student_profile.get("student_id") or "").strip()
        if not student_id:
            raise ValueError("student_profile.student_id is required")

        profile_concept_mastery = student_profile.get("concept_mastery", {})
        concept_mastery: dict[str, float] = {}
        if isinstance(profile_concept_mastery, dict) and profile_concept_mastery:
            for key, value in profile_concept_mastery.items():
                concept_mastery[str(key)] = float(value)
        else:
            subjects = student_profile.get("subjects", [])
            for subj in subjects:
                title = str(subj.get("title") or subj.get("course_id") or "unknown")
                concept_mastery[title] = float(subj.get("mastery_score", 0.0))

        overall_mastery = float(student_profile.get("overall_mastery", 0.0))
        confidence = max(0.1, min(0.99, overall_mastery / 100.0))

        # Baseline pace from test results only; events can refine it later.
        if overall_mastery < 40:
            pace_mode = "slow"
        elif overall_mastery < 75:
            pace_mode = "normal"
        else:
            pace_mode = "fast"

        now = _now_iso()
        existing = self.get_state(student_id) or {}

        update = {
            "student_id": student_id,
            "current_level": student_profile.get("overall_level", "beginner"),
            "overall_mastery": round(overall_mastery, 2),
            "confidence_score": round(confidence, 3),
            "pace_mode": existing.get("pace_mode", pace_mode),
            "strengths": student_profile.get("strengths", []),
            "weaknesses": student_profile.get("weaknesses", []),
            "recommended_focus": student_profile.get("recommendations", []),
            "concept_mastery": concept_mastery,
            "last_level_test_session_id": session_id,
            "last_level_test_at": now,
            "engagement": existing.get(
                "engagement",
                {
                    "events_count": 0,
                    "quiz_attempts": 0,
                    "exercise_attempts": 0,
                    "ai_tutor_chats": 0,
                    "brainrush_sessions": 0,
                    "study_time_sec": 0,
                },
            ),
            "recent_scores": existing.get("recent_scores", []),
            "concept_events": existing.get("concept_events", []),
            "updated_at": now,
        }

        self._col.update_one(
            {"student_id": student_id},
            {"$set": update, "$setOnInsert": {"created_at": now}},
            upsert=True,
        )
        return self.get_state(student_id) or update

    def record_learning_event(
        self,
        student_id: str,
        event_type: str,
        score: float | None = None,
        duration_sec: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        student_id = str(student_id or "").strip()
        event_type = str(event_type or "").strip().lower()
        if not student_id:
            raise ValueError("student_id is required")
        if not event_type:
            raise ValueError("event_type is required")

        now = _now_iso()
        state = self.get_state(student_id) or {
            "student_id": student_id,
            "current_level": "beginner",
            "overall_mastery": 0.0,
            "confidence_score": 0.3,
            "pace_mode": "slow",
            "strengths": [],
            "weaknesses": [],
            "recommended_focus": [],
            "concept_mastery": {},
            "engagement": {
                "events_count": 0,
                "quiz_attempts": 0,
                "exercise_attempts": 0,
                "ai_tutor_chats": 0,
                "brainrush_sessions": 0,
                "study_time_sec": 0,
            },
            "recent_scores": [],
            "concept_events": [],
            "created_at": now,
        }

        engagement = dict(state.get("engagement", {}))
        engagement["events_count"] = int(engagement.get("events_count", 0)) + 1
        engagement["study_time_sec"] = int(engagement.get("study_time_sec", 0)) + int(duration_sec or 0)

        if event_type == "quiz":
            engagement["quiz_attempts"] = int(engagement.get("quiz_attempts", 0)) + 1
        elif event_type == "exercise":
            engagement["exercise_attempts"] = int(engagement.get("exercise_attempts", 0)) + 1
        elif event_type == "chat":
            engagement["ai_tutor_chats"] = int(engagement.get("ai_tutor_chats", 0)) + 1
        elif event_type == "brainrush":
            engagement["brainrush_sessions"] = int(engagement.get("brainrush_sessions", 0)) + 1

        recent_scores = list(state.get("recent_scores", []))
        if score is not None:
            clamped = max(0.0, min(100.0, float(score)))
            recent_scores.append(clamped)
            recent_scores = recent_scores[-20:]

        avg_score = (sum(recent_scores) / len(recent_scores)) if recent_scores else float(state.get("overall_mastery", 0.0))
        if avg_score >= 80:
            pace_mode = "fast"
        elif avg_score >= 45:
            pace_mode = "normal"
        else:
            pace_mode = "slow"

        confidence = max(0.1, min(0.99, avg_score / 100.0))

        state_update = {
            **state,
            "engagement": engagement,
            "recent_scores": recent_scores,
            "pace_mode": pace_mode,
            "confidence_score": round(confidence, 3),
            "updated_at": now,
        }
        state_update.pop("created_at", None)
        concept_events = list(state.get("concept_events", []))
        if metadata:
            concept = str(metadata.get("concept", metadata.get("topic", ""))) if isinstance(metadata, dict) else ""
            if concept:
                is_correct = bool(metadata.get("is_correct", score is not None and float(score) >= 50)) if isinstance(metadata, dict) else bool(score and score >= 50)
                difficulty = str(metadata.get("difficulty", "medium")) if isinstance(metadata, dict) else "medium"
                state_update["concept_mastery"] = update_concept_mastery(
                    state.get("concept_mastery", {}),
                    concept=concept,
                    is_correct=is_correct,
                    event_type=event_type,
                    difficulty=difficulty,
                    confidence=confidence,
                    response_time_sec=duration_sec,
                )
                concept_events.append(
                    {
                        "concept": concept.strip().lower().replace(" ", "_"),
                        "is_correct": is_correct,
                        "response_time_sec": int(duration_sec or 0),
                        "event_type": event_type,
                        "difficulty": difficulty,
                        "score": float(score) if score is not None else None,
                        "at": now,
                    }
                )
                concept_events = concept_events[-200:]
            state_update["last_event"] = {
                "type": event_type,
                "score": score,
                "duration_sec": duration_sec,
                "metadata": metadata,
                "at": now,
            }
        state_update["concept_events"] = concept_events
        pace_decision = self._pacing_engine.decide(state_update)
        state_update["pace_mode"] = pace_decision.get("pace_mode", state_update.get("pace_mode", "slow"))
        state_update["session_orchestration"] = pace_decision

        self._col.update_one(
            {"student_id": student_id},
            {"$set": state_update, "$setOnInsert": {"created_at": state.get("created_at", now)}},
            upsert=True,
        )
        return self.get_state(student_id) or state_update
