"""Intervention rule engine for struggle/streak detection."""
from __future__ import annotations

from typing import Any


class InterventionEngine:
    """Produces interventions based on recent attempts and confidence."""

    def evaluate(
        self,
        recent_answers: list[dict[str, Any]],
        confidence_score: float | None = None,
    ) -> dict[str, Any]:
        recent = recent_answers[-3:] if recent_answers else []
        conf = float(confidence_score if confidence_score is not None else 0.5)

        if len(recent) >= 2 and all(not a.get("is_correct", False) for a in recent[-2:]):
            topic = recent[-1].get("topic", recent[-1].get("concept", "current concept"))
            return {
                "triggered": True,
                "type": "struggle_detected",
                "message": f"You seem to struggle with {topic}. Switching to an easier explanation with a hint.",
                "recommended_action": "show_hint_and_easy_example",
            }

        if len(recent) >= 3:
            fast_correct = 0
            for a in recent:
                rt = a.get("response_time_sec")
                if a.get("is_correct") and isinstance(rt, (int, float)) and rt <= 12:
                    fast_correct += 1
            if fast_correct >= 3:
                return {
                    "triggered": True,
                    "type": "streak_upshift",
                    "message": "Great streak. Increasing challenge level.",
                    "recommended_action": "raise_difficulty",
                }

        last = recent[-1] if recent else {}
        rt = last.get("response_time_sec")
        if conf < 0.4 and isinstance(rt, (int, float)) and rt >= 45:
            return {
                "triggered": True,
                "type": "low_confidence_slow",
                "message": "Low confidence and long response time detected. Reducing load with guided steps.",
                "recommended_action": "guided_example_and_review",
            }

        return {"triggered": False, "type": "none", "message": "", "recommended_action": "none"}
