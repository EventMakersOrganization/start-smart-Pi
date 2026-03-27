"""Performance-aware continuous recommendations."""
from __future__ import annotations

from typing import Any

from learning_state.concept_mastery_graph import get_unlock_status


class ContinuousRecommender:
    """Builds ranked recommendations with gain/effort/success scoring."""

    _BASE_EFFORT = {
        "targeted_exercise": 2.0,
        "retry_easier_variant": 1.5,
        "promotion_ready": 3.0,
        "next_module_unlock": 2.5,
        "prerequisite_repair": 2.0,
    }

    def recommend(self, learning_state: dict[str, Any], n_results: int = 5) -> list[dict[str, Any]]:
        state = learning_state or {}
        concept_mastery = state.get("concept_mastery", {}) or {}
        unlock = get_unlock_status(concept_mastery)
        weaknesses = list(state.get("weaknesses", []))
        pace_mode = state.get("pace_mode", "slow")
        confidence = float(state.get("confidence_score", 0.4))

        recs: list[dict[str, Any]] = []
        blocked_by = unlock.get("blocked_by", {}) or {}
        avg_mastery = self._avg_mastery(concept_mastery)
        momentum = self._momentum(state.get("recent_scores", []))

        for w in weaknesses[:2]:
            rec = {
                "type": "targeted_exercise",
                "title": f"Practice weak area: {w}",
                "rationale": "Recent profile marks this as weak.",
                "success_probability": round(max(0.35, confidence), 2),
                "estimated_gain": 14.0 if avg_mastery < 50 else 10.0,
                "estimated_effort_hours": self._BASE_EFFORT["targeted_exercise"],
                "focus_concepts": [str(w).lower().replace(" ", "_")],
            }
            self._attach_ranking(rec)
            recs.append(rec)

        if pace_mode == "slow":
            rec = {
                "type": "retry_easier_variant",
                "title": "Retry current module with easier variant",
                "rationale": "Low pace mode indicates foundational reinforcement is needed.",
                "success_probability": round(min(0.85, confidence + 0.2), 2),
                "estimated_gain": 12.0,
                "estimated_effort_hours": self._BASE_EFFORT["retry_easier_variant"],
                "focus_concepts": [],
            }
            self._attach_ranking(rec)
            recs.append(rec)
        else:
            rec = {
                "type": "promotion_ready",
                "title": "Ready for next level checkpoint",
                "rationale": "Current pace/confidence support progression.",
                "success_probability": round(min(0.95, confidence + (0.12 if momentum > 0 else 0.08)), 2),
                "estimated_gain": 16.0,
                "estimated_effort_hours": self._BASE_EFFORT["promotion_ready"],
                "focus_concepts": [],
            }
            self._attach_ranking(rec)
            recs.append(rec)

        for c in unlock.get("unlocked", [])[:2]:
            rec = {
                "type": "next_module_unlock",
                "title": f"Unlock module on {c}",
                "rationale": "Prerequisite mastery threshold met.",
                "success_probability": round(min(0.95, confidence + 0.15), 2),
                "estimated_gain": 11.0,
                "estimated_effort_hours": self._BASE_EFFORT["next_module_unlock"],
                "focus_concepts": [c],
            }
            self._attach_ranking(rec)
            recs.append(rec)

        # Add prerequisite repair recommendations for blocked paths.
        for locked, missing in list(blocked_by.items())[:2]:
            if not missing:
                continue
            rec = {
                "type": "prerequisite_repair",
                "title": f"Repair prerequisites for {locked}",
                "rationale": f"Blocked by missing mastery in: {', '.join(missing)}.",
                "success_probability": round(max(0.3, confidence - 0.05), 2),
                "estimated_gain": 13.0,
                "estimated_effort_hours": self._BASE_EFFORT["prerequisite_repair"],
                "focus_concepts": missing,
            }
            self._attach_ranking(rec)
            recs.append(rec)

        # Rank by utility score descending, then success probability.
        recs = sorted(
            recs,
            key=lambda x: (
                -float(x.get("utility_score", 0.0)),
                -float(x.get("success_probability", 0.0)),
            ),
        )
        for i, r in enumerate(recs, start=1):
            r["priority"] = i
        return recs[:n_results]

    @staticmethod
    def _avg_mastery(concept_mastery: dict[str, float]) -> float:
        vals = [float(v) for v in concept_mastery.values()] if concept_mastery else []
        return sum(vals) / len(vals) if vals else 0.0

    @staticmethod
    def _momentum(recent_scores: list[float] | None) -> float:
        rs = list(recent_scores or [])
        if len(rs) < 2:
            return 0.0
        return float(rs[-1]) - float(rs[-2])

    @staticmethod
    def _attach_ranking(rec: dict[str, Any]) -> None:
        """
        Utility score = expected gain * success probability / effort.
        Higher is better.
        """
        gain = float(rec.get("estimated_gain", 10.0))
        prob = float(rec.get("success_probability", 0.5))
        effort = max(0.5, float(rec.get("estimated_effort_hours", 2.0)))
        rec["utility_score"] = round((gain * prob) / effort, 4)
