"""Pedagogical tutor response builder with style modes."""
from __future__ import annotations

from typing import Any


class TutorResponseBuilder:
    """Formats answers into pedagogical structures."""

    def select_style(self, pace_mode: str, confidence_score: float) -> str:
        if confidence_score < 0.35 or pace_mode == "slow":
            return "explain_like_beginner"
        if confidence_score < 0.7 or pace_mode == "normal":
            return "step_by_step"
        return "challenge_mode"

    def build(self, question: str, raw_answer: str, style: str, sources: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        src = sources or []
        top_source = src[0]["course_title"] if src else "course materials"

        if style == "analogy_fun_mode":
            explanation = f"Think of it like a daily-life analogy. {raw_answer}"
        elif style == "challenge_mode":
            explanation = f"{raw_answer}\nTry extending this with one extra condition or edge case."
        elif style == "step_by_step":
            explanation = f"Step 1: Understand the concept.\nStep 2: Apply it to your question.\nStep 3: Verify result.\n{raw_answer}"
        else:
            explanation = f"Simple explanation: {raw_answer}"

        quick_check = f"Quick check: in one sentence, how would you answer: '{question[:80]}'?"
        next_action = "Do one short practice exercise on this same topic."

        return {
            "style": style,
            "simple_explanation": explanation,
            "mini_example": "Example: print('Hello') displays text on screen.",
            "quick_check_question": quick_check,
            "next_action": next_action,
            "source_hint": f"Grounded in {top_source}",
        }
