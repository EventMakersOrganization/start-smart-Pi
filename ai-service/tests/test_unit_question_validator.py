"""Unit tests for generation.question_validator — no external services needed."""
import pytest
from generation.question_validator import (
    QuestionValidator,
    is_valid_difficulty,
    is_valid_question_type,
    sanitize_question_text,
)


class TestHelpers:
    def test_valid_difficulties(self):
        assert is_valid_difficulty("easy")
        assert is_valid_difficulty("medium")
        assert is_valid_difficulty("hard")
        assert not is_valid_difficulty("extreme")
        assert not is_valid_difficulty("")

    def test_valid_question_types(self):
        assert is_valid_question_type("MCQ")
        assert is_valid_question_type("TrueFalse")
        assert is_valid_question_type("DragDrop")
        assert not is_valid_question_type("essay")

    def test_sanitize_empty(self):
        assert sanitize_question_text("") == ""
        assert sanitize_question_text(None) == ""

    def test_sanitize_whitespace_and_caps(self):
        result = sanitize_question_text("  what   is  python ?  ")
        assert result[0].isupper()
        assert "  " not in result


class TestMCQValidation:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.v = QuestionValidator()

    def test_valid_mcq(self, sample_mcq):
        r = self.v.validate_mcq(sample_mcq)
        assert r["is_valid"] is True
        assert r["errors"] == []

    def test_missing_fields(self):
        r = self.v.validate_mcq({"question": "Short?"})
        assert r["is_valid"] is False
        assert any("Missing" in e for e in r["errors"])

    def test_wrong_option_count(self, sample_mcq):
        sample_mcq["options"] = ["A", "B"]
        r = self.v.validate_mcq(sample_mcq)
        assert r["is_valid"] is False

    def test_correct_answer_not_in_options(self, sample_mcq):
        sample_mcq["correct_answer"] = "lambda"
        r = self.v.validate_mcq(sample_mcq)
        assert r["is_valid"] is False

    def test_duplicate_options(self, sample_mcq):
        sample_mcq["options"] = ["def", "def", "func", "import"]
        r = self.v.validate_mcq(sample_mcq)
        assert any("Duplicate" in e for e in r["errors"])

    def test_question_too_short(self, sample_mcq):
        sample_mcq["question"] = "Q?"
        r = self.v.validate_mcq(sample_mcq)
        assert r["is_valid"] is False


class TestTrueFalseValidation:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.v = QuestionValidator()

    def test_valid_tf(self, sample_tf):
        r = self.v.validate_true_false(sample_tf)
        assert r["is_valid"] is True

    def test_wrong_options(self, sample_tf):
        sample_tf["options"] = ["Yes", "No"]
        r = self.v.validate_true_false(sample_tf)
        assert r["is_valid"] is False

    def test_wrong_correct_answer(self, sample_tf):
        sample_tf["correct_answer"] = "Maybe"
        r = self.v.validate_true_false(sample_tf)
        assert r["is_valid"] is False


class TestDragDropValidation:
    @pytest.fixture(autouse=True)
    def _setup(self):
        self.v = QuestionValidator()

    def test_valid_dnd(self, sample_dnd):
        r = self.v.validate_drag_drop(sample_dnd)
        assert r["is_valid"] is True

    def test_mismatched_length(self, sample_dnd):
        sample_dnd["matches"] = ["Whole number", "Text"]
        r = self.v.validate_drag_drop(sample_dnd)
        assert r["is_valid"] is False

    def test_missing_pair_mapping(self, sample_dnd):
        sample_dnd["correct_pairs"] = {"int": "Whole number"}
        r = self.v.validate_drag_drop(sample_dnd)
        assert r["is_valid"] is False


class TestBatchValidation:
    def test_batch_report(self, sample_questions):
        v = QuestionValidator()
        r = v.validate_batch(sample_questions)
        assert r["total"] == 3
        assert r["valid"] + r["invalid"] == 3
        assert isinstance(r["overall_quality"], (int, float))

    def test_json_format_valid(self):
        v = QuestionValidator()
        r = v.validate_json_format('{"question": "Q?", "options": ["A","B"]}')
        assert r["is_valid"] is True
        assert r["parsed"]["question"] == "Q?"

    def test_json_format_invalid(self):
        v = QuestionValidator()
        r = v.validate_json_format("not json")
        assert r["is_valid"] is False
