"""
Answer evaluation engine: correctness checking, partial credit, scoring,
feedback generation, and performance tracking for all question types.
"""
from __future__ import annotations

import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.rag_service import RAGService
from rag.rag_prompt_builder import RAGPromptBuilder
from utils import langchain_ollama

# ---------------------------------------------------------------------------
# Scoring constants
# ---------------------------------------------------------------------------

MAX_SCORE = 100.0
PARTIAL_CREDIT_FLOOR = 0.0

_DIFFICULTY_MULTIPLIERS = {"easy": 1.0, "medium": 1.5, "hard": 2.0}
_TIME_BONUS_THRESHOLDS = {"easy": 15.0, "medium": 30.0, "hard": 45.0}


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Lower, strip, collapse whitespace, drop leading articles."""
    t = re.sub(r"\s+", " ", (text or "").strip().lower())
    t = re.sub(r"^(the|a|an)\s+", "", t)
    return t


def _token_set(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", _normalise(text)) if len(w) >= 2}


# ---------------------------------------------------------------------------
# AnswerEvaluator
# ---------------------------------------------------------------------------


class AnswerEvaluator:
    """
    Evaluates student answers across MCQ, True/False, Drag&Drop, and
    open-ended question types.  Produces scores, partial credit, time
    bonuses, and AI-generated feedback via RAG.
    """

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.prompt_builder = RAGPromptBuilder(self.rag_service)

    # ------------------------------------------------------------------
    # Top-level API
    # ------------------------------------------------------------------

    def evaluate(
        self,
        question_dict: dict,
        student_answer: Any,
        time_taken_seconds: float | None = None,
    ) -> dict[str, Any]:
        """
        Evaluate a single answer.

        Args:
            question_dict: Full question (question, options, correct_answer,
                           correct_pairs, type, difficulty, explanation, ...).
            student_answer: The student's submission (str, bool, or dict for DnD).
            time_taken_seconds: Optional wall-clock seconds spent.

        Returns:
            is_correct, score, max_score, partial_credit, time_bonus,
            feedback, detailed_result
        """
        qtype = self._detect_type(question_dict)
        difficulty = str(question_dict.get("difficulty", "medium")).lower()
        if difficulty not in _DIFFICULTY_MULTIPLIERS:
            difficulty = "medium"

        if qtype == "MCQ":
            result = self._evaluate_mcq(question_dict, student_answer)
        elif qtype == "TrueFalse":
            result = self._evaluate_true_false(question_dict, student_answer)
        elif qtype == "DragDrop":
            result = self._evaluate_drag_drop(question_dict, student_answer)
        else:
            result = self._evaluate_open_ended(question_dict, student_answer)

        base_score = result["raw_score"] * MAX_SCORE
        multiplier = _DIFFICULTY_MULTIPLIERS[difficulty]
        weighted_score = round(base_score * multiplier, 2)

        time_bonus = 0.0
        if time_taken_seconds is not None and time_taken_seconds >= 0 and result["raw_score"] > 0:
            time_bonus = self._calculate_time_bonus(time_taken_seconds, difficulty)

        final_score = round(weighted_score + time_bonus, 2)

        feedback = self._generate_feedback(
            question_dict, str(student_answer),
            result["is_correct"], result.get("partial_credit", 0.0),
        )

        return {
            "is_correct": result["is_correct"],
            "score": final_score,
            "max_score": round(MAX_SCORE * multiplier, 2),
            "partial_credit": result.get("partial_credit", 0.0),
            "time_bonus": round(time_bonus, 2),
            "difficulty_multiplier": multiplier,
            "feedback": feedback,
            "detailed_result": result,
        }

    def evaluate_batch(
        self,
        submissions: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Evaluate many answers at once.

        Each item: {question: dict, student_answer: Any, time_taken: float|None}.
        Returns per-item results plus aggregate stats.
        """
        results: list[dict[str, Any]] = []
        total_score = 0.0
        total_max = 0.0
        correct_count = 0

        for sub in submissions or []:
            q = sub.get("question", {})
            sa = sub.get("student_answer", "")
            tt = sub.get("time_taken")
            r = self.evaluate(q, sa, tt)
            results.append(r)
            total_score += r["score"]
            total_max += r["max_score"]
            if r["is_correct"]:
                correct_count += 1

        n = len(results) or 1
        return {
            "count": len(results),
            "correct": correct_count,
            "incorrect": len(results) - correct_count,
            "accuracy": round(correct_count / n, 4),
            "total_score": round(total_score, 2),
            "total_max_score": round(total_max, 2),
            "percentage": round(total_score / max(total_max, 1) * 100, 2),
            "per_answer": results,
        }

    def generate_detailed_explanation(
        self,
        question_dict: dict,
        student_answer: str,
    ) -> str:
        """
        Use RAG + LLM to produce a thorough, context-grounded explanation.
        """
        prompt = self.prompt_builder.build_explanation_prompt(
            question=str(question_dict.get("question", "")),
            student_answer=str(student_answer),
            correct_answer=str(question_dict.get("correct_answer", "")),
        )
        try:
            return langchain_ollama.generate_response(prompt)
        except Exception:
            return self._fallback_explanation(question_dict, student_answer)

    # ------------------------------------------------------------------
    # Type-specific evaluators
    # ------------------------------------------------------------------

    def _evaluate_mcq(self, q: dict, answer: Any) -> dict[str, Any]:
        correct = _normalise(str(q.get("correct_answer", "")))
        student = _normalise(str(answer))
        is_correct = student == correct

        partial = 0.0
        if not is_correct and correct and student:
            sim = SequenceMatcher(None, student, correct).ratio()
            if sim >= 0.85:
                partial = 0.5
            elif sim >= 0.6:
                partial = 0.25

        return {
            "type": "MCQ",
            "is_correct": is_correct,
            "raw_score": 1.0 if is_correct else partial,
            "partial_credit": partial if not is_correct else 0.0,
            "student_normalised": student,
            "correct_normalised": correct,
        }

    def _evaluate_true_false(self, q: dict, answer: Any) -> dict[str, Any]:
        correct = _normalise(str(q.get("correct_answer", "")))
        student = _normalise(str(answer))
        tf_map = {"1": "true", "yes": "true", "0": "false", "no": "false"}
        correct = tf_map.get(correct, correct)
        student = tf_map.get(student, student)
        is_correct = student == correct
        return {
            "type": "TrueFalse",
            "is_correct": is_correct,
            "raw_score": 1.0 if is_correct else 0.0,
            "partial_credit": 0.0,
            "student_normalised": student,
            "correct_normalised": correct,
        }

    def _evaluate_drag_drop(self, q: dict, answer: Any) -> dict[str, Any]:
        """Partial credit per correct pair."""
        correct_pairs: dict = q.get("correct_pairs") or {}
        if not correct_pairs:
            return {
                "type": "DragDrop",
                "is_correct": False,
                "raw_score": 0.0,
                "partial_credit": 0.0,
                "matched": 0,
                "total_pairs": 0,
            }

        student_pairs: dict = {}
        if isinstance(answer, dict):
            student_pairs = answer
        elif isinstance(answer, str):
            try:
                import json
                student_pairs = json.loads(answer)
                if not isinstance(student_pairs, dict):
                    student_pairs = {}
            except Exception:
                student_pairs = {}

        total = len(correct_pairs)
        matched = 0
        for key, val in correct_pairs.items():
            s_val = student_pairs.get(key) or student_pairs.get(str(key))
            if s_val is not None and _normalise(str(s_val)) == _normalise(str(val)):
                matched += 1

        ratio = matched / max(total, 1)
        is_correct = matched == total
        partial = round(ratio, 4) if not is_correct else 0.0

        return {
            "type": "DragDrop",
            "is_correct": is_correct,
            "raw_score": ratio,
            "partial_credit": partial,
            "matched": matched,
            "total_pairs": total,
        }

    def _evaluate_open_ended(self, q: dict, answer: Any) -> dict[str, Any]:
        """
        Keyword overlap + semantic similarity heuristic for open text answers.
        """
        correct = str(q.get("correct_answer", ""))
        student = str(answer or "")
        if not student.strip():
            return {
                "type": "OpenEnded",
                "is_correct": False,
                "raw_score": 0.0,
                "partial_credit": 0.0,
                "keyword_overlap": 0.0,
                "sequence_similarity": 0.0,
            }

        c_tokens = _token_set(correct)
        s_tokens = _token_set(student)
        overlap = len(c_tokens & s_tokens) / max(len(c_tokens), 1) if c_tokens else 0.0

        seq_sim = SequenceMatcher(None, _normalise(student), _normalise(correct)).ratio()

        combined = 0.6 * overlap + 0.4 * seq_sim
        is_correct = combined >= 0.75
        partial = round(combined, 4) if not is_correct else 0.0

        return {
            "type": "OpenEnded",
            "is_correct": is_correct,
            "raw_score": round(combined, 4),
            "partial_credit": partial,
            "keyword_overlap": round(overlap, 4),
            "sequence_similarity": round(seq_sim, 4),
        }

    # ------------------------------------------------------------------
    # Scoring helpers
    # ------------------------------------------------------------------

    def _calculate_time_bonus(self, seconds: float, difficulty: str) -> float:
        threshold = _TIME_BONUS_THRESHOLDS.get(difficulty, 30.0)
        if seconds <= 0 or seconds >= threshold:
            return 0.0
        ratio = 1.0 - (seconds / threshold)
        return round(ratio * 10.0 * _DIFFICULTY_MULTIPLIERS.get(difficulty, 1.0), 2)

    # ------------------------------------------------------------------
    # Feedback
    # ------------------------------------------------------------------

    def _generate_feedback(
        self,
        question_dict: dict,
        student_answer: str,
        is_correct: bool,
        partial_credit: float,
    ) -> dict[str, Any]:
        """Build structured feedback without calling the LLM (fast path)."""
        correct_answer = str(question_dict.get("correct_answer", ""))
        explanation = str(question_dict.get("explanation", ""))

        if is_correct:
            message = "Correct! Well done."
            if explanation:
                message += f" {explanation}"
            return {
                "result": "correct",
                "message": message,
                "correct_answer": correct_answer,
                "learning_tip": None,
            }

        if partial_credit > 0:
            message = (
                f"Not quite right, but you earned partial credit "
                f"({round(partial_credit * 100)}%). "
                f"The correct answer is: {correct_answer}."
            )
        else:
            message = f"Incorrect. The correct answer is: {correct_answer}."

        if explanation:
            message += f" {explanation}"

        topic = question_dict.get("topic", "")
        tip = f"Review the topic '{topic}' in your course materials." if topic else None

        return {
            "result": "partial" if partial_credit > 0 else "incorrect",
            "message": message,
            "correct_answer": correct_answer,
            "learning_tip": tip,
        }

    def _fallback_explanation(self, question_dict: dict, student_answer: str) -> str:
        correct = question_dict.get("correct_answer", "")
        expl = question_dict.get("explanation", "")
        sa_norm = _normalise(str(student_answer))
        ca_norm = _normalise(str(correct))
        if sa_norm == ca_norm:
            return f"Your answer is correct. {expl}"
        return (
            f"The correct answer is '{correct}'. You answered '{student_answer}'. "
            f"{expl}"
        )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    @staticmethod
    def _detect_type(q: dict) -> str:
        explicit = str(q.get("type", "")).strip()
        if explicit in ("MCQ", "TrueFalse", "DragDrop", "OpenEnded"):
            return explicit
        if "correct_pairs" in q:
            return "DragDrop"
        opts = q.get("options")
        if isinstance(opts, list):
            norm = sorted(_normalise(str(o)) for o in opts)
            if norm == ["false", "true"]:
                return "TrueFalse"
            if len(opts) >= 2:
                return "MCQ"
        return "OpenEnded"


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def _demo() -> None:
    import json as _json

    ev = AnswerEvaluator()

    print("=" * 60)
    print("  MCQ - correct answer")
    print("=" * 60)
    mcq = {
        "question": "Which keyword defines a function in Python?",
        "options": ["def", "func", "define", "function"],
        "correct_answer": "def",
        "explanation": "'def' is used to define functions in Python.",
        "difficulty": "easy",
        "topic": "functions",
    }
    r = ev.evaluate(mcq, "def", time_taken_seconds=5.0)
    print(_json.dumps({k: r[k] for k in ("is_correct", "score", "max_score", "time_bonus")}, indent=2))
    print("Feedback:", r["feedback"]["message"][:120])

    print("\n" + "=" * 60)
    print("  MCQ - wrong answer (partial credit)")
    print("=" * 60)
    r2 = ev.evaluate(mcq, "define", time_taken_seconds=12.0)
    print(_json.dumps({k: r2[k] for k in ("is_correct", "score", "partial_credit", "time_bonus")}, indent=2))
    print("Feedback:", r2["feedback"]["message"][:150])

    print("\n" + "=" * 60)
    print("  True/False - correct")
    print("=" * 60)
    tf = {
        "question": "Python uses indentation to define blocks.",
        "options": ["True", "False"],
        "correct_answer": "True",
        "explanation": "Yes, Python relies on indentation.",
        "difficulty": "easy",
    }
    r3 = ev.evaluate(tf, "True")
    print("is_correct:", r3["is_correct"], " score:", r3["score"])

    print("\n" + "=" * 60)
    print("  Drag & Drop - partial credit")
    print("=" * 60)
    dnd = {
        "type": "DragDrop",
        "question": "Match data types to descriptions.",
        "items": ["int", "str", "float"],
        "matches": ["Whole number", "Text", "Decimal"],
        "correct_pairs": {"int": "Whole number", "str": "Text", "float": "Decimal"},
        "difficulty": "medium",
        "topic": "data types",
    }
    student_dnd = {"int": "Whole number", "str": "Decimal", "float": "Decimal"}
    r4 = ev.evaluate(dnd, student_dnd)
    print(_json.dumps({k: r4[k] for k in ("is_correct", "score", "partial_credit")}, indent=2))
    print("Matched:", r4["detailed_result"]["matched"], "/", r4["detailed_result"]["total_pairs"])

    print("\n" + "=" * 60)
    print("  Open-ended")
    print("=" * 60)
    oe = {
        "type": "OpenEnded",
        "question": "What is a variable in programming?",
        "correct_answer": "A variable is a named storage location in memory that holds a value.",
        "difficulty": "easy",
        "topic": "variables",
    }
    r5 = ev.evaluate(oe, "A variable stores a value in memory")
    print(_json.dumps({
        k: r5[k] for k in ("is_correct", "score", "partial_credit")
    }, indent=2))
    print("Keyword overlap:", r5["detailed_result"]["keyword_overlap"])

    print("\n" + "=" * 60)
    print("  Batch evaluation")
    print("=" * 60)
    batch = ev.evaluate_batch([
        {"question": mcq, "student_answer": "def", "time_taken": 5.0},
        {"question": mcq, "student_answer": "func", "time_taken": 20.0},
        {"question": tf, "student_answer": "False"},
        {"question": dnd, "student_answer": dnd["correct_pairs"]},
    ])
    print(f"Accuracy: {batch['accuracy']}")
    print(f"Score: {batch['total_score']} / {batch['total_max_score']} ({batch['percentage']}%)")
    print(f"Correct: {batch['correct']}, Incorrect: {batch['incorrect']}")


if __name__ == "__main__":
    _demo()
