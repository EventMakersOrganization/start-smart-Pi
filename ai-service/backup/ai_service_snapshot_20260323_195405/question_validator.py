"""
Question validator - validates generated questions for required fields,
format, quality, and batch consistency.
"""
from __future__ import annotations

import json
import re
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUIRED_MCQ = ("question", "options", "correct_answer", "explanation")
REQUIRED_TRUE_FALSE = ("question", "options", "correct_answer", "explanation")
REQUIRED_DRAG_DROP = ("question", "items", "matches", "correct_pairs")

VALID_DIFFICULTIES = frozenset({"easy", "medium", "hard"})
VALID_QUESTION_TYPES = frozenset({"MCQ", "TrueFalse", "DragDrop"})

MIN_QUESTION_LEN = 10
MAX_QUESTION_LEN = 500
MAX_OPTION_LEN = 200
MIN_DRAG_ITEMS = 3
MAX_DRAG_ITEMS = 6


# ---------------------------------------------------------------------------
# Standalone helpers
# ---------------------------------------------------------------------------


def is_valid_difficulty(difficulty: str) -> bool:
    """Return True if difficulty is one of easy, medium, hard."""
    return str(difficulty).strip().lower() in VALID_DIFFICULTIES


def is_valid_question_type(qtype: str) -> bool:
    """Return True if type is MCQ, TrueFalse, or DragDrop."""
    return str(qtype).strip() in VALID_QUESTION_TYPES


def sanitize_question_text(text: str) -> str:
    """Remove extra whitespace, fix punctuation, capitalize first letter."""
    if not text or not isinstance(text, str):
        return ""
    t = re.sub(r"\s+", " ", text.strip())
    t = re.sub(r"\s*([.?!,])\s*", r"\1 ", t)
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    return t


# ---------------------------------------------------------------------------
# QuestionValidator class
# ---------------------------------------------------------------------------


class QuestionValidator:
    """Validates generated questions for structure, format, and quality."""

    def validate_mcq(self, question_dict: dict) -> dict[str, Any]:
        """
        Validate an MCQ question.
        Returns {is_valid: bool, errors: list[str], warnings: list[str]}.
        """
        errors: list[str] = []
        warnings: list[str] = []

        for field in REQUIRED_MCQ:
            if field not in question_dict:
                errors.append(f"Missing required field: {field}")
            elif question_dict[field] is None:
                errors.append(f"Field cannot be null: {field}")

        options = question_dict.get("options")
        if options is not None:
            if not isinstance(options, list):
                errors.append("options must be a list")
            else:
                if len(options) != 4:
                    errors.append(f"options must have exactly 4 items, got {len(options)}")
                for i, opt in enumerate(options):
                    s = str(opt).strip()
                    if not s:
                        errors.append(f"Option {i + 1} is empty")
                    elif len(s) > MAX_OPTION_LEN:
                        errors.append(f"Option {i + 1} exceeds {MAX_OPTION_LEN} characters")
                if len(set(str(o).strip().lower() for o in options)) < len(options):
                    errors.append("Duplicate options are not allowed")

        correct = question_dict.get("correct_answer")
        if correct is not None and options is not None and isinstance(options, list):
            correct_str = str(correct).strip()
            if correct_str not in [str(o).strip() for o in options]:
                errors.append("correct_answer must be one of the options")

        qtext = question_dict.get("question")
        if qtext is not None:
            q = str(qtext).strip()
            if len(q) < MIN_QUESTION_LEN:
                errors.append(f"Question must be at least {MIN_QUESTION_LEN} characters")
            elif len(q) > MAX_QUESTION_LEN:
                errors.append(f"Question must be at most {MAX_QUESTION_LEN} characters")

        return {
            "is_valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def validate_true_false(self, question_dict: dict) -> dict[str, Any]:
        """Validate a True/False question."""
        errors: list[str] = []
        warnings: list[str] = []

        for field in REQUIRED_TRUE_FALSE:
            if field not in question_dict:
                errors.append(f"Missing required field: {field}")

        options = question_dict.get("options")
        if options is not None:
            if options != ["True", "False"] and options != ["False", "True"]:
                norm = [str(o).strip() for o in options] if isinstance(options, list) else []
                if set(norm) != {"true", "false"}:
                    errors.append('options must be exactly ["True", "False"]')

        correct = question_dict.get("correct_answer")
        if correct is not None:
            c = str(correct).strip().lower()
            if c not in ("true", "false"):
                errors.append('correct_answer must be "True" or "False"')

        qtext = question_dict.get("question")
        if qtext is not None:
            q = str(qtext).strip()
            if "?" in q:
                warnings.append("True/False questions are usually statements, not questions")
            if len(q) < MIN_QUESTION_LEN:
                errors.append(f"Question must be at least {MIN_QUESTION_LEN} characters")
            elif len(q) > MAX_QUESTION_LEN:
                errors.append(f"Question must be at most {MAX_QUESTION_LEN} characters")

        return {"is_valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    def validate_drag_drop(self, question_dict: dict) -> dict[str, Any]:
        """Validate a Drag&Drop matching question."""
        errors: list[str] = []
        warnings: list[str] = []

        for field in REQUIRED_DRAG_DROP:
            if field not in question_dict:
                errors.append(f"Missing required field: {field}")

        items = question_dict.get("items")
        matches = question_dict.get("matches")
        pairs = question_dict.get("correct_pairs")

        if items is not None and not isinstance(items, list):
            errors.append("items must be a list")
        if matches is not None and not isinstance(matches, list):
            errors.append("matches must be a list")
        if pairs is not None and not isinstance(pairs, dict):
            errors.append("correct_pairs must be a dict")

        if isinstance(items, list) and isinstance(matches, list):
            if len(items) != len(matches):
                errors.append("items and matches must have the same length")
            if len(items) < MIN_DRAG_ITEMS or len(items) > MAX_DRAG_ITEMS:
                errors.append(f"items must have between {MIN_DRAG_ITEMS} and {MAX_DRAG_ITEMS} elements")
            try:
                if len(set(str(i) for i in items)) < len(items):
                    errors.append("Duplicate items are not allowed")
            except TypeError:
                errors.append("items must contain hashable (string/number) values")
            try:
                if len(set(str(m) for m in matches)) < len(matches):
                    errors.append("Duplicate matches are not allowed")
            except TypeError:
                errors.append("matches must contain hashable (string/number) values")

        if isinstance(pairs, dict) and isinstance(items, list):
            pair_keys = {str(k) for k in pairs}
            for item in items:
                key = str(item)
                if key not in pair_keys:
                    errors.append(f"correct_pairs must map every item; missing: {item!r}")
            match_strs = {str(m) for m in matches} if isinstance(matches, list) else set()
            for k, v in (pairs or {}).items():
                val = v if isinstance(v, (str, int, float)) else str(v)
                if val not in match_strs:
                    errors.append(f"correct_pairs values must be from matches; invalid: {v!r}")

        qtext = question_dict.get("question")
        if qtext is not None:
            q = str(qtext).strip()
            if len(q) < MIN_QUESTION_LEN:
                errors.append(f"Question must be at least {MIN_QUESTION_LEN} characters")

        return {"is_valid": len(errors) == 0, "errors": errors, "warnings": warnings}

    def validate_json_format(self, json_string: str) -> dict[str, Any]:
        """
        Try to parse JSON and check basic structure.
        Returns {is_valid: bool, parsed: dict | None, error: str | None}.
        """
        if not json_string or not str(json_string).strip():
            return {"is_valid": False, "parsed": None, "error": "Empty input"}
        try:
            parsed = json.loads(json_string)
            if not isinstance(parsed, dict):
                return {"is_valid": False, "parsed": parsed, "error": "Root must be a JSON object"}
            if "question" not in parsed:
                return {"is_valid": False, "parsed": parsed, "error": "Missing 'question' key"}
            return {"is_valid": True, "parsed": parsed, "error": None}
        except json.JSONDecodeError as e:
            return {"is_valid": False, "parsed": None, "error": str(e)}

    def validate_question_quality(self, question_dict: dict) -> dict[str, Any]:
        """
        Check for common quality issues and assign a score 0-100.
        Returns {quality_score: int, suggestions: list[str]}.
        """
        suggestions: list[str] = []
        score = 100

        q = str(question_dict.get("question", "")).strip()
        if not q:
            return {"quality_score": 0, "suggestions": ["Question is empty"]}

        if re.match(r"^\s*What is \w+\s*\?", q, re.IGNORECASE):
            suggestions.append("Question may be too vague; consider being more specific")
            score -= 15

        options = question_dict.get("options")
        if isinstance(options, list) and len(options) >= 2:
            lens = [len(str(o)) for o in options]
            if max(lens) - min(lens) < 5 and max(lens) < 30:
                suggestions.append("Options are very similar in length; consider more distinct choices")
                score -= 10
            correct = str(question_dict.get("correct_answer", "")).strip()
            if correct and correct == str(options[0]).strip():
                suggestions.append("Correct answer is first option; consider shuffling for fairness")
                score -= 5

        if len(q) < 20:
            suggestions.append("Question is very short; consider adding context")
            score -= 10

        if not q.endswith("?") and question_dict.get("type") == "MCQ":
            suggestions.append("MCQ questions typically end with a question mark")
            score -= 5

        if score < 0:
            score = 0
        return {"quality_score": score, "suggestions": suggestions}

    def validate_batch(self, questions: list[dict]) -> dict[str, Any]:
        """
        Validate a list of questions and produce a summary report.
        Returns total, valid, invalid, errors_by_question, overall_quality.
        """
        errors_by_question: dict[int, list[str]] = {}
        quality_scores: list[int] = []
        seen_questions: set[str] = set()
        duplicate_indices: list[int] = []
        type_counts: dict[str, int] = {}
        difficulty_counts: dict[str, int] = {}

        for i, q in enumerate(questions):
            qtype = str(q.get("type", "MCQ")).strip()
            type_counts[qtype] = type_counts.get(qtype, 0) + 1
            d = str(q.get("difficulty", "medium")).lower()
            difficulty_counts[d] = difficulty_counts.get(d, 0) + 1
            qtext = str(q.get("question", "")).strip().lower()
            if qtext in seen_questions:
                duplicate_indices.append(i)
            seen_questions.add(qtext)

            if qtype == "TrueFalse":
                res = self.validate_true_false(q)
            elif qtype == "DragDrop":
                res = self.validate_drag_drop(q)
            else:
                res = self.validate_mcq(q)

            if not res["is_valid"]:
                errors_by_question[i] = res.get("errors", [])
            qual = self.validate_question_quality(q)
            quality_scores.append(qual["quality_score"])

        valid_count = sum(1 for i in range(len(questions)) if i not in errors_by_question)
        invalid_count = len(questions) - valid_count
        overall_quality = round(sum(quality_scores) / len(quality_scores), 1) if quality_scores else 0.0

        return {
            "total": len(questions),
            "valid": valid_count,
            "invalid": invalid_count,
            "errors_by_question": errors_by_question,
            "overall_quality": overall_quality,
            "duplicate_indices": duplicate_indices,
            "type_distribution": type_counts,
            "difficulty_distribution": difficulty_counts,
        }


# ---------------------------------------------------------------------------
# Main / tests
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    validator = QuestionValidator()

    print("=" * 60)
    print("TEST 1: Valid MCQ")
    print("=" * 60)
    valid_mcq = {
        "question": "What keyword is used to define a loop that runs while a condition is true?",
        "options": ["for", "while", "loop", "repeat"],
        "correct_answer": "while",
        "explanation": "The 'while' keyword starts a while loop.",
    }
    r = validator.validate_mcq(valid_mcq)
    print("is_valid:", r["is_valid"], "errors:", r["errors"])

    print("\n" + "=" * 60)
    print("TEST 2: Invalid MCQ (missing fields)")
    print("=" * 60)
    invalid_mcq = {"question": "Short?", "options": ["A", "B"]}
    r2 = validator.validate_mcq(invalid_mcq)
    print("is_valid:", r2["is_valid"], "errors:", r2["errors"])

    print("\n" + "=" * 60)
    print("TEST 3: True/False")
    print("=" * 60)
    tf = {
        "question": "Python uses indentation to define code blocks.",
        "options": ["True", "False"],
        "correct_answer": "True",
        "explanation": "Yes, Python uses indentation.",
    }
    r3 = validator.validate_true_false(tf)
    print("is_valid:", r3["is_valid"], "errors:", r3["errors"], "warnings:", r3["warnings"])

    print("\n" + "=" * 60)
    print("TEST 4: Drag&Drop")
    print("=" * 60)
    dd = {
        "question": "Match the data types to their descriptions.",
        "items": ["int", "str", "float"],
        "matches": ["Whole number", "Text", "Decimal"],
        "correct_pairs": {"int": "Whole number", "str": "Text", "float": "Decimal"},
    }
    r4 = validator.validate_drag_drop(dd)
    print("is_valid:", r4["is_valid"], "errors:", r4["errors"])

    print("\n" + "=" * 60)
    print("TEST 5: Batch validation")
    print("=" * 60)
    tf_with_type = {**tf, "type": "TrueFalse"}
    dd_with_type = {**dd, "type": "DragDrop"}
    batch = [
        {**valid_mcq, "type": "MCQ"},
        invalid_mcq,
        tf_with_type,
        dd_with_type,
    ]
    r5 = validator.validate_batch(batch)
    print("total:", r5["total"], "valid:", r5["valid"], "invalid:", r5["invalid"])
    print("overall_quality:", r5["overall_quality"])
    print("errors_by_question:", r5["errors_by_question"])

    print("\n" + "=" * 60)
    print("TEST 6: Helpers")
    print("=" * 60)
    print("is_valid_difficulty('medium'):", is_valid_difficulty("medium"))
    print("is_valid_question_type('MCQ'):", is_valid_question_type("MCQ"))
    print("sanitize:", repr(sanitize_question_text("  what   is  python ?  ")))
