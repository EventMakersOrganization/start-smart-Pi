"""Unit tests for mastery model v2 calibration."""
from __future__ import annotations

from learning_state.concept_mastery_graph import get_unlock_status, update_concept_mastery


def test_harder_quiz_updates_more_than_easy_chat():
    base = {}
    a = update_concept_mastery(
        base,
        concept="functions",
        is_correct=True,
        event_type="quiz",
        difficulty="hard",
        confidence=0.8,
        response_time_sec=12,
    )
    b = update_concept_mastery(
        base,
        concept="functions",
        is_correct=True,
        event_type="chat",
        difficulty="easy",
        confidence=0.4,
        response_time_sec=60,
    )
    assert a["functions"] > b["functions"]


def test_wrong_answer_decreases_mastery():
    base = {"loops": 50.0}
    out = update_concept_mastery(
        base,
        concept="loops",
        is_correct=False,
        event_type="exercise",
        difficulty="medium",
        confidence=0.5,
        response_time_sec=30,
    )
    assert out["loops"] < 50.0


def test_prerequisite_unlock_logic_blocks_dependents():
    mastery = {
        "variables": 80.0,
        "data_types": 80.0,
        "operations": 40.0,  # too low
        "control_flow": 80.0,
        "loops": 80.0,
        "functions": 80.0,
    }
    status = get_unlock_status(mastery)
    assert "control_flow" in status["locked"]
    assert "operations" in status["unlocked"] or "operations" in status["locked"]
    assert "control_flow" in status["blocked_by"]

