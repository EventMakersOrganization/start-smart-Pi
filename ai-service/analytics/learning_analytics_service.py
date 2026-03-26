"""Read models for learner analytics endpoints."""
from __future__ import annotations

from typing import Any

from learning_state.concept_mastery_graph import get_unlock_status


class LearningAnalyticsService:
    """Computes dashboard metrics from learning state and recommendations."""

    def daily_progress(self, learning_state: dict[str, Any]) -> dict[str, Any]:
        recent = list((learning_state or {}).get("recent_scores", []))
        if not recent:
            return {"today_score": 0.0, "trend": "stable", "attempts": 0}
        today = recent[-1]
        prev = recent[-2] if len(recent) > 1 else recent[-1]
        trend = "up" if today > prev else "down" if today < prev else "stable"
        return {"today_score": round(today, 2), "trend": trend, "attempts": len(recent)}

    def concept_strengths_weaknesses(self, learning_state: dict[str, Any]) -> dict[str, Any]:
        mastery = dict((learning_state or {}).get("concept_mastery", {}))
        pairs = sorted(mastery.items(), key=lambda kv: kv[1], reverse=True)
        return {
            "strong_concepts": [{"concept": c, "mastery": m} for c, m in pairs[:5]],
            "weak_concepts": [{"concept": c, "mastery": m} for c, m in sorted(mastery.items(), key=lambda kv: kv[1])[:5]],
            "unlock_status": get_unlock_status(mastery),
        }

    def pace_trend(self, learning_state: dict[str, Any]) -> dict[str, Any]:
        pace = (learning_state or {}).get("pace_mode", "slow")
        confidence = float((learning_state or {}).get("confidence_score", 0.3))
        return {"pace_mode": pace, "confidence_score": round(confidence, 3)}

    def predicted_success(self, recommendations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        out = []
        for rec in recommendations:
            out.append({
                "title": rec.get("title", rec.get("type", "recommendation")),
                "predicted_success_probability": rec.get("success_probability", 0.5),
            })
        return out
