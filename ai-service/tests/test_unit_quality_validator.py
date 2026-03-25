"""Unit tests for generation.question_quality_validator — mocks RAGService."""
import pytest
from unittest.mock import patch, MagicMock

from generation.question_quality_validator import (
    QuestionQualityValidator,
    calculate_bloom_taxonomy_level,
    detect_question_patterns,
)


class TestBloomTaxonomy:
    @pytest.mark.parametrize("text,expected", [
        ("Define recursion", "Remember"),
        ("Explain how loops work", "Understand"),
        ("Solve the equation", "Apply"),
        ("Compare lists and tuples", "Analyze"),
        ("Evaluate the algorithm", "Evaluate"),
        ("Design a data structure", "Create"),
        ("Which keyword starts a loop?", "Remember"),
        ("", "Unknown"),
    ])
    def test_bloom_levels(self, text, expected):
        assert calculate_bloom_taxonomy_level(text) == expected


class TestPatternDetection:
    def test_detects_duplicates(self):
        qs = [
            {"question": "What is X?"},
            {"question": "What is X?"},
            {"question": "How does Y work?"},
        ]
        r = detect_question_patterns(qs)
        assert r["total_questions"] == 3
        assert len(r["duplicate_stem_prefixes"]) > 0

    def test_detects_overused_format(self):
        qs = [{"question": f"What is item {i}?"} for i in range(6)]
        r = detect_question_patterns(qs)
        assert len(r["overused_format_warnings"]) > 0

    def test_empty_batch(self):
        r = detect_question_patterns([])
        assert r["total_questions"] == 0


class TestQuestionQualityValidator:
    @pytest.fixture(autouse=True)
    def _setup(self, mock_rag_service):
        with patch("generation.question_quality_validator.RAGService") as MockCls:
            MockCls.get_instance.return_value = mock_rag_service
            self.v = QuestionQualityValidator()

    def test_clarity_good(self):
        r = self.v.assess_question_clarity(
            "In Python, which keyword is used to define a function that accepts parameters?"
        )
        assert r["clarity_score"] > 70

    def test_clarity_vague(self):
        r = self.v.assess_question_clarity("What is X?")
        assert r["clarity_score"] < 80
        assert len(r["issues"]) > 0

    def test_answer_quality_valid(self, sample_mcq):
        r = self.v.assess_answer_quality("def", sample_mcq["options"])
        assert r["answer_quality"] > 80

    def test_answer_quality_missing(self):
        r = self.v.assess_answer_quality("", [])
        assert r["answer_quality"] == 0.0

    def test_distractor_quality(self, sample_mcq):
        r = self.v.assess_distractor_quality(sample_mcq["options"], "def")
        assert r["distractor_score"] > 0

    def test_explanation_too_short(self):
        r = self.v.assess_explanation_quality("Correct.")
        assert r["explanation_score"] < 50
        assert len(r["issues"]) > 0

    def test_explanation_good(self):
        r = self.v.assess_explanation_quality(
            "The 'def' keyword defines a function because Python uses it to declare "
            "the function signature, therefore all functions start with def."
        )
        assert r["explanation_score"] > 70

    def test_overall_quality_high(self, sample_mcq):
        r = self.v.calculate_overall_quality(sample_mcq)
        assert r["overall_quality_score"] > 60
        assert "bloom_level" in r

    def test_validate_against_source(self, sample_mcq):
        source = "In Python, def is the keyword used to define functions."
        r = self.v.validate_against_source(sample_mcq, source)
        assert r["source_based"] is True
        assert r["confidence"] > 0.5

    def test_batch_quality(self, sample_questions):
        r = self.v.batch_quality_assessment(sample_questions)
        assert r["count"] == 3
        assert "average_quality_score" in r
        assert "common_issues" in r
