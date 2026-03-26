"""Pacing and session orchestration rules."""
from __future__ import annotations

from typing import Any


class PacingEngine:
    """Simple deterministic pacing decisions from learner-state trends."""

    def decide(self, learning_state: dict[str, Any] | None) -> dict[str, Any]:
        state = learning_state or {}
        conf = float(state.get("confidence_score", 0.3))
        pace_mode = str(state.get("pace_mode", "slow"))
        recent = list(state.get("recent_scores", []))
        engagement = state.get("engagement", {}) or {}
        study_time = int(engagement.get("study_time_sec", 0))

        avg_recent = (sum(recent[-5:]) / len(recent[-5:])) if recent else 0.0

        action = "review_now"
        explanation_depth = "deep_explain"
        break_suggested = False

        if pace_mode == "fast" and conf >= 0.75 and avg_recent >= 75:
            action = "advance_now"
            explanation_depth = "short_explain"
        elif pace_mode == "normal" and avg_recent >= 55:
            action = "advance_now"
            explanation_depth = "step_by_step"
        elif avg_recent < 45 or conf < 0.4:
            action = "review_now"
            explanation_depth = "deep_explain"

        if study_time >= 45 * 60:
            break_suggested = True

        return {
            "action": action,
            "explanation_depth": explanation_depth,
            "take_break": break_suggested,
            "pace_mode": pace_mode,
            "avg_recent_score": round(avg_recent, 2),
        }
