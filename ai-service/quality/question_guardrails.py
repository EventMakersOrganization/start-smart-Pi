"""Question quality and response guardrails."""
from __future__ import annotations

from typing import Any


class QuestionGuardrails:
    """Validates generated question payload quality and applies fallbacks."""

    REQUIRED_KEYS = ("question", "options", "correct_answer")

    def validate_question(self, q: dict[str, Any]) -> dict[str, Any]:
        issues: list[str] = []
        for k in self.REQUIRED_KEYS:
            if k not in q or q.get(k) in (None, "", []):
                issues.append(f"missing_{k}")
        options = q.get("options", [])
        if isinstance(options, list) and len(options) < 2:
            issues.append("insufficient_options")
        # Case-sensitive uniqueness: case-only variants (e.g. "int" vs "Int") are acceptable for MCQ.
        if isinstance(options, list) and len(set(str(o).strip() for o in options)) != len(options):
            issues.append("duplicate_options")
        text = str(q.get("question", ""))
        if len(text) < 12:
            issues.append("too_short_question")
        return {"is_valid": len(issues) == 0, "issues": issues, "confidence": max(0.0, 1.0 - len(issues) * 0.2)}

    def fallback_question(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        d = (difficulty or "medium").lower()
        pts = {"easy": 10, "medium": 20, "hard": 30}.get(d, 20)
        mult = {"easy": 1.0, "medium": 1.2, "hard": 1.5}.get(d, 1.2)
        return {
            "question": f"Which statement best describes {topic} in {subject}?",
            "options": ["Statement A", "Statement B", "Statement C", "Statement D"],
            "correct_answer": "Statement A",
            "explanation": "Fallback question due to generation quality checks.",
            "difficulty": difficulty,
            "topic": topic,
            "type": "MCQ",
            "is_fallback": True,
            "points": pts,
            "time_limit": int(30 * mult),
        }
