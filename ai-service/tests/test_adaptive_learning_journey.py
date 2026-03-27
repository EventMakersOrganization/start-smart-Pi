"""
Targeted scenario tests for post-level-test adaptive learning journey.

Goal: verify key Ahmed-like journey capabilities now, and highlight gaps.
These tests use the live API at localhost:8000 (same style as e2e tests).
"""
from __future__ import annotations

import uuid

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 120.0


def _api_reachable() -> bool:
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


_needs_api = pytest.mark.skipif(
    not _api_reachable(),
    reason="AI service not running at localhost:8000",
)


def _event(student_id: str, event_type: str, score: float, concept: str, duration_sec: int = 300) -> dict:
    r = httpx.post(
        f"{BASE}/learning-state/event",
        json={
            "student_id": student_id,
            "event_type": event_type,
            "score": score,
            "duration_sec": duration_sec,
            "metadata": {"concept": concept, "is_correct": score >= 50},
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return r.json()


@_needs_api
class TestAdaptiveLearningJourneyScenario:
    """
    Simulates a condensed Ahmed journey:
    - weak start
    - guided progression
    - pace/difficulty adaptation
    - analytics visibility
    """

    def test_pace_progression_slow_to_fast(self):
        student_id = f"journey-{uuid.uuid4()}"

        # Day 1: low scores => slow
        _event(student_id, "quiz", 20, "variables", duration_sec=700)
        _event(student_id, "exercise", 30, "control_flow", duration_sec=650)

        state_low = httpx.get(f"{BASE}/learning-state/{student_id}", timeout=TIMEOUT).json()["learning_state"]
        assert state_low["pace_mode"] in ("slow", "normal")

        # Day 3-6: high scores => should eventually move to fast
        _event(student_id, "quiz", 88, "loops", duration_sec=250)
        _event(student_id, "brainrush", 95, "functions", duration_sec=220)
        _event(student_id, "exercise", 92, "data_types", duration_sec=200)

        state_high = httpx.get(f"{BASE}/learning-state/{student_id}", timeout=TIMEOUT).json()["learning_state"]
        assert state_high["confidence_score"] >= 0.6
        assert state_high["pace_mode"] in ("normal", "fast")

    def test_chatbot_pedagogical_payload_shape(self):
        student_id = f"journey-{uuid.uuid4()}"
        _event(student_id, "quiz", 85, "variables", duration_sec=220)

        r = httpx.post(
            f"{BASE}/chatbot/ask",
            json={
                "question": "Explique moi les variables en Python simplement",
                "conversation_history": [],
                "student_id": student_id,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()

        ped = data.get("pedagogical_response", {})
        assert ped.get("style") in {
            "explain_like_beginner",
            "step_by_step",
            "analogy_fun_mode",
            "challenge_mode",
        }
        # Required structure from roadmap
        assert ped.get("simple_explanation")
        assert ped.get("mini_example")
        assert ped.get("quick_check_question")
        assert ped.get("next_action")

    def test_brainrush_adaptive_difficulty_and_analytics(self):
        student_id = f"journey-{uuid.uuid4()}"
        _event(student_id, "quiz", 25, "variables", duration_sec=700)

        r = httpx.post(
            f"{BASE}/brainrush/generate-question",
            json={
                "subject": "Programmation",
                "difficulty": "medium",
                "topic": "variables",
                "question_type": "MCQ",
                "student_id": student_id,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("selected_difficulty") in ("easy", "medium", "hard")
        assert "difficulty_policy" in data
        assert "question" in data and data["question"].get("question")

        a = httpx.get(f"{BASE}/analytics/learning/{student_id}", timeout=TIMEOUT)
        assert a.status_code == 200, a.text
        payload = a.json()
        assert "daily_progress" in payload
        assert "concepts" in payload
        assert "pace" in payload
        assert "predicted_success" in payload


@_needs_api
class TestInterventionRules:
    """Targeted tests for intervention rules."""

    def test_two_consecutive_failures_should_trigger_struggle_intervention(self):
        student_id = f"journey-gap-{uuid.uuid4()}"
        _event(student_id, "exercise", 20, "booleans", duration_sec=500)
        res = _event(student_id, "exercise", 25, "booleans", duration_sec=520)
        intervention = res.get("intervention", {})
        assert intervention.get("triggered") is True
        assert intervention.get("type") == "struggle_detected"

    def test_three_fast_correct_should_trigger_streak_upshift(self):
        student_id = f"journey-streak-{uuid.uuid4()}"
        # Fast + correct on same concept
        _event(student_id, "quiz", 95, "loops", duration_sec=8)
        _event(student_id, "quiz", 93, "loops", duration_sec=9)
        res = _event(student_id, "quiz", 91, "loops", duration_sec=7)
        intervention = res.get("intervention", {})
        assert intervention.get("triggered") is True
        assert intervention.get("type") == "streak_upshift"
        assert intervention.get("recommended_action") == "raise_difficulty"

    def test_low_confidence_long_response_should_trigger_guided_review(self):
        student_id = f"journey-lowconf-{uuid.uuid4()}"
        # Build low confidence first
        _event(student_id, "exercise", 20, "functions", duration_sec=70)
        _event(student_id, "exercise", 25, "functions", duration_sec=65)
        res = _event(student_id, "exercise", 30, "functions", duration_sec=75)
        intervention = res.get("intervention", {})
        assert intervention.get("triggered") is True
        assert intervention.get("type") in {"struggle_detected", "low_confidence_slow"}
        # Either is acceptable depending on rule precedence.

    def test_no_intervention_for_mixed_normal_activity(self):
        student_id = f"journey-none-{uuid.uuid4()}"
        _event(student_id, "exercise", 60, "arrays", duration_sec=30)
        _event(student_id, "exercise", 40, "arrays", duration_sec=28)
        res = _event(student_id, "exercise", 65, "arrays", duration_sec=35)
        intervention = res.get("intervention", {})
        assert intervention.get("triggered") is False
        assert intervention.get("type") == "none"
