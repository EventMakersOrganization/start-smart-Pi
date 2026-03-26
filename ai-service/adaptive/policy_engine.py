"""Real-time adaptive difficulty policy engine."""
from __future__ import annotations

from typing import Any

DIFFICULTIES = ["easy", "medium", "hard"]


class AdaptivePolicyEngine:
    """Decides target difficulty from performance, speed and confidence."""

    def decide_next_difficulty(
        self,
        current_difficulty: str,
        recent_answers: list[dict[str, Any]],
        confidence_score: float | None = None,
        hint_used: bool = False,
    ) -> dict[str, Any]:
        idx = DIFFICULTIES.index(current_difficulty) if current_difficulty in DIFFICULTIES else 1
        recent = recent_answers[-3:] if recent_answers else []
        if not recent:
            return {"target_difficulty": DIFFICULTIES[idx], "decision_reason": "no_recent_answers"}

        correct_count = sum(1 for a in recent if a.get("is_correct"))
        avg_time = self._avg_response_time(recent)
        confidence = confidence_score if confidence_score is not None else 0.5

        reason_parts: list[str] = []
        delta = 0

        if correct_count >= 3:
            delta += 1
            reason_parts.append("high_accuracy")
        elif correct_count <= 1:
            delta -= 1
            reason_parts.append("low_accuracy")

        if avg_time is not None:
            if avg_time <= 12 and correct_count >= 2:
                delta += 1
                reason_parts.append("fast_response")
            elif avg_time >= 45 and correct_count <= 1:
                delta -= 1
                reason_parts.append("slow_response")

        if confidence >= 0.8:
            delta += 1
            reason_parts.append("high_confidence")
        elif confidence <= 0.35:
            delta -= 1
            reason_parts.append("low_confidence")

        if hint_used:
            delta -= 1
            reason_parts.append("hint_used")

        target_idx = max(0, min(len(DIFFICULTIES) - 1, idx + (1 if delta > 0 else -1 if delta < 0 else 0)))
        reason = ",".join(reason_parts) if reason_parts else "stable"
        return {"target_difficulty": DIFFICULTIES[target_idx], "decision_reason": reason}

    @staticmethod
    def _avg_response_time(answers: list[dict[str, Any]]) -> float | None:
        times = []
        for a in answers:
            rt = a.get("response_time_sec")
            if isinstance(rt, (int, float)) and rt >= 0:
                times.append(float(rt))
        if not times:
            return None
        return sum(times) / len(times)
