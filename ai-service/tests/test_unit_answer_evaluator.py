"""Unit tests for generation.answer_evaluator — mocks RAGService and LLM."""
import pytest
from unittest.mock import patch, MagicMock

from generation.answer_evaluator import AnswerEvaluator, _normalise, _token_set


class TestNormalise:
    def test_basic(self):
        assert _normalise("  The Answer  ") == "answer"

    def test_strips_articles(self):
        assert _normalise("A quick test") == "quick test"
        assert _normalise("An apple") == "apple"

    def test_empty(self):
        assert _normalise("") == ""
        assert _normalise(None) == ""


class TestTokenSet:
    def test_tokens(self):
        tokens = _token_set("Hello world of Python")
        assert "hello" in tokens
        assert "world" in tokens
        assert "python" in tokens


class TestAnswerEvaluator:
    @pytest.fixture(autouse=True)
    def _setup(self, mock_rag_service):
        with patch("generation.answer_evaluator.RAGService") as MockCls:
            MockCls.get_instance.return_value = mock_rag_service
            with patch("generation.answer_evaluator.RAGPromptBuilder") as MockPB:
                MockPB.return_value = MagicMock()
                self.ev = AnswerEvaluator()

    def test_mcq_correct(self, sample_mcq):
        r = self.ev.evaluate(sample_mcq, "def")
        assert r["is_correct"] is True
        assert r["score"] > 0
        assert r["feedback"]["result"] == "correct"

    def test_mcq_wrong(self, sample_mcq):
        r = self.ev.evaluate(sample_mcq, "func")
        assert r["is_correct"] is False
        assert r["feedback"]["result"] in ("incorrect", "partial")

    def test_mcq_partial_credit(self, sample_mcq):
        r = self.ev.evaluate(sample_mcq, "define")
        partial = r["detailed_result"]["partial_credit"]
        assert partial >= 0

    def test_mcq_time_bonus(self, sample_mcq):
        r = self.ev.evaluate(sample_mcq, "def", time_taken_seconds=2.0)
        assert r["time_bonus"] > 0

    def test_tf_correct(self, sample_tf):
        r = self.ev.evaluate(sample_tf, "True")
        assert r["is_correct"] is True

    def test_tf_wrong(self, sample_tf):
        r = self.ev.evaluate(sample_tf, "False")
        assert r["is_correct"] is False

    def test_dnd_full_correct(self, sample_dnd):
        r = self.ev.evaluate(sample_dnd, sample_dnd["correct_pairs"])
        assert r["is_correct"] is True
        assert r["detailed_result"]["matched"] == 3

    def test_dnd_partial(self, sample_dnd):
        r = self.ev.evaluate(sample_dnd, {"int": "Whole number", "str": "Decimal", "float": "Text"})
        assert r["is_correct"] is False
        assert r["detailed_result"]["matched"] == 1
        assert r["partial_credit"] > 0

    def test_open_ended(self):
        q = {
            "type": "OpenEnded",
            "question": "What is a variable?",
            "correct_answer": "A variable is a named storage location in memory.",
            "difficulty": "easy",
        }
        r = self.ev.evaluate(q, "A variable stores values in memory")
        assert "score" in r
        assert r["detailed_result"]["keyword_overlap"] > 0

    def test_batch_evaluate(self, sample_mcq, sample_tf):
        submissions = [
            {"question": sample_mcq, "student_answer": "def", "time_taken": 5.0},
            {"question": sample_tf, "student_answer": "False"},
        ]
        r = self.ev.evaluate_batch(submissions)
        assert r["count"] == 2
        assert r["correct"] == 1
        assert r["accuracy"] == 0.5

    def test_difficulty_multiplier(self, sample_mcq):
        sample_mcq["difficulty"] = "hard"
        r = self.ev.evaluate(sample_mcq, "def")
        assert r["difficulty_multiplier"] == 2.0
        assert r["max_score"] == 200.0
