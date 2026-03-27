"""Concept mastery graph and calibrated prerequisite logic (v2)."""
from __future__ import annotations

from typing import Any

DEFAULT_GRAPH: dict[str, list[str]] = {
    "variables": [],
    "data_types": ["variables"],
    "operations": ["variables", "data_types"],
    "control_flow": ["operations"],
    "loops": ["control_flow"],
    "functions": ["loops"],
    "arrays": ["variables"],
    "pointers": ["arrays", "functions"],
}

# Prerequisite thresholds can be concept-specific.
UNLOCK_THRESHOLDS: dict[str, float] = {
    "default": 60.0,
    "loops": 65.0,
    "functions": 70.0,
    "pointers": 75.0,
}

EVENT_WEIGHTS: dict[str, float] = {
    "quiz": 1.0,
    "exercise": 0.9,
    "brainrush": 0.85,
    "chat": 0.5,
}

DIFF_WEIGHTS: dict[str, float] = {
    "easy": 0.9,
    "medium": 1.0,
    "hard": 1.15,
}


def update_concept_mastery(
    concept_mastery: dict[str, float] | None,
    concept: str,
    is_correct: bool,
    step: float = 6.0,
    *,
    event_type: str = "exercise",
    difficulty: str = "medium",
    confidence: float = 0.5,
    response_time_sec: int | float | None = None,
) -> dict[str, float]:
    """
    Calibrated mastery update.

    - Boosts/penalizes by event type and difficulty.
    - Applies confidence scaling.
    - Applies response-time factor for very fast/very slow attempts.
    """
    mastery = dict(concept_mastery or {})
    key = (concept or "general").strip().lower().replace(" ", "_")
    current = float(mastery.get(key, 0.0))

    ev_w = EVENT_WEIGHTS.get((event_type or "").lower(), 0.8)
    diff_w = DIFF_WEIGHTS.get((difficulty or "").lower(), 1.0)
    conf = max(0.1, min(0.99, float(confidence)))

    rt_factor = 1.0
    if isinstance(response_time_sec, (int, float)):
        if response_time_sec <= 10:
            rt_factor = 1.08
        elif response_time_sec >= 90:
            rt_factor = 0.92

    delta = step * ev_w * diff_w * (0.7 + 0.6 * conf) * rt_factor
    if not is_correct:
        delta = -(delta * 0.9)

    current = current + delta
    mastery[key] = round(max(0.0, min(100.0, current)), 2)
    return mastery


def get_unlock_status(
    concept_mastery: dict[str, float] | None,
    threshold: float = 60.0,
) -> dict[str, Any]:
    mastery = concept_mastery or {}
    unlocked: list[str] = []
    locked: list[str] = []
    blocked_by: dict[str, list[str]] = {}
    for concept, prereqs in DEFAULT_GRAPH.items():
        req = UNLOCK_THRESHOLDS.get(concept, threshold if threshold != 60.0 else UNLOCK_THRESHOLDS["default"])
        missing = [p for p in prereqs if float(mastery.get(p, 0.0)) < req]
        prereq_ok = not missing
        if prereq_ok:
            unlocked.append(concept)
        else:
            locked.append(concept)
            blocked_by[concept] = missing
    return {
        "unlocked": unlocked,
        "locked": locked,
        "threshold": threshold,
        "thresholds": UNLOCK_THRESHOLDS,
        "blocked_by": blocked_by,
    }
