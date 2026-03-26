"""Unit tests for generation.difficulty_classifier — mocks RAGService."""
import pytest
from unittest.mock import patch, MagicMock

from generation.difficulty_classifier import (
    DifficultyClassifier,
    compute_linguistic_features,
    compute_technical_density,
    compute_cognitive_load,
    compute_structural_complexity,
    DIFFICULTY_LEVELS,
)


# ---------------------------------------------------------------------------
# Feature extractors (pure, no external deps)
# ---------------------------------------------------------------------------

class TestLinguisticFeatures:
    def test_basic_text(self):
        f = compute_linguistic_features("The cat sat on the mat.")
        assert f["word_count"] == 6.0
        assert f["avg_word_length"] > 0
        assert f["long_word_ratio"] == 0.0

    def test_empty(self):
        f = compute_linguistic_features("")
        assert f["word_count"] == 1.0

    def test_long_words_ratio(self):
        f = compute_linguistic_features("polymorphism encapsulation asynchronous")
        assert f["long_word_ratio"] > 0


class TestTechnicalDensity:
    def test_no_terms(self):
        f = compute_technical_density("The cat is on the mat.")
        assert f["technical_term_count"] == 0.0

    def test_with_terms(self):
        f = compute_technical_density("Recursion and polymorphism are key to algorithm design.")
        assert f["technical_term_count"] >= 3.0
        assert f["technical_density"] > 0


class TestCognitiveLoad:
    def test_easy_verbs(self):
        f = compute_cognitive_load("Define the term. List the items. Name the parts.")
        assert f["easy_verb_count"] >= 3

    def test_hard_verbs(self):
        f = compute_cognitive_load("Analyze and evaluate the design. Justify your choice.")
        assert f["hard_verb_count"] >= 2

    def test_multi_step(self):
        f = compute_cognitive_load("First do X, then do Y, and then Z.")
        assert f["multi_step_markers"] >= 1

    def test_negations(self):
        f = compute_cognitive_load("This is not correct and cannot be used.")
        assert f["negation_count"] >= 2


class TestStructuralComplexity:
    def test_has_code(self):
        q = {"question": "What does def foo(): return 1 do?", "options": ["A", "B"]}
        f = compute_structural_complexity(q)
        assert f["has_code_snippet"] == 1.0

    def test_no_code(self):
        q = {"question": "What is a variable?", "options": ["A", "B"]}
        f = compute_structural_complexity(q)
        assert f["has_code_snippet"] == 0.0


# ---------------------------------------------------------------------------
# Classifier (mocked RAGService)
# ---------------------------------------------------------------------------

class TestDifficultyClassifier:
    @pytest.fixture(autouse=True)
    def _setup(self, mock_rag_service):
        with patch("generation.difficulty_classifier.RAGService") as MockCls:
            MockCls.get_instance.return_value = mock_rag_service
            self.clf = DifficultyClassifier()

    def test_classify_easy(self, sample_mcq):
        r = self.clf.classify_question(sample_mcq)
        assert r["difficulty"] in DIFFICULTY_LEVELS
        assert r["difficulty"] == "easy"
        assert 0 <= r["confidence"] <= 1

    def test_classify_hard(self):
        hard = {
            "question": (
                "Analyze and evaluate the amortized complexity of a dynamic array resize "
                "that uses a doubling strategy versus constant-increment resizing. "
                "First, calculate the total cost of n push operations under each strategy. "
                "Then, compare asymptotic bounds and justify which approach avoids O(n) "
                "worst-case per-operation cost. Consider polymorphism, encapsulation, "
                "recursion, concurrency, and thread-safety. This question is not trivial "
                "and cannot be answered without understanding the potential method."
            ),
            "options": ["O(1) amortized", "O(n)", "O(log n)", "O(n^2)"],
            "correct_answer": "O(1) amortized",
            "explanation": "Doubling gives amortized O(1) via potential method.",
            "difficulty": "hard",
            "topic": "algorithm complexity",
            "subject": "Programming",
        }
        r = self.clf.classify_question(hard)
        assert r["difficulty"] in ("hard", "medium")  # heuristic may vary

    def test_classify_text(self):
        r = self.clf.classify_text("A variable stores data in memory. x = 5.")
        assert r["difficulty"] == "easy"

    def test_batch_classify(self, sample_mcq):
        batch = self.clf.classify_batch([sample_mcq, sample_mcq])
        assert batch["count"] == 2
        assert "distribution" in batch

    def test_suggest_adjustment_no_change(self, sample_mcq):
        r = self.clf.suggest_difficulty_adjustment(sample_mcq)
        assert r["adjustment_needed"] is False

    def test_suggest_adjustment_mismatch(self, sample_mcq):
        sample_mcq["difficulty"] = "hard"
        r = self.clf.suggest_difficulty_adjustment(sample_mcq)
        assert r["adjustment_needed"] is True
        assert r["direction"] in ("increase", "decrease")
        assert len(r["tips"]) > 0
