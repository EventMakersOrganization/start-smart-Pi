"""Unit tests for generation.advanced_prompt_engineer — mocks RAGService."""
import pytest
from unittest.mock import patch, MagicMock

from generation.advanced_prompt_engineer import (
    AdvancedPromptEngineer,
    QUESTION_GENERATION_EXAMPLES,
)


class TestAdvancedPromptEngineer:
    @pytest.fixture(autouse=True)
    def _setup(self, mock_rag_service):
        with patch("generation.advanced_prompt_engineer.RAGService") as MockCls:
            MockCls.get_instance.return_value = mock_rag_service
            with patch("generation.advanced_prompt_engineer.RAGPromptBuilder") as MockPB:
                builder = MagicMock()
                builder.build_question_prompt.return_value = "Base question prompt"
                builder.build_chat_prompt.return_value = "Base chat prompt"
                MockPB.return_value = builder
                self.pe = AdvancedPromptEngineer()

    def test_few_shot_learning(self):
        base = "Generate a question about loops."
        examples = QUESTION_GENERATION_EXAMPLES[:2]
        result = self.pe.use_few_shot_learning(base, examples)
        assert "Example" in result
        assert base in result

    def test_chain_of_thought(self):
        base = "Generate a question."
        result = self.pe.use_chain_of_thought(base)
        assert "step by step" in result.lower() or "break this down" in result.lower()
        assert base in result

    def test_role_playing_default(self):
        base = "Explain recursion."
        result = self.pe.use_role_playing(base)
        assert "expert tutor" in result.lower()

    def test_role_playing_custom(self):
        base = "Explain arrays."
        result = self.pe.use_role_playing(base, role="senior developer")
        assert "senior developer" in result.lower()

    def test_constraint_specification(self):
        constraints = {
            "length": "2-3 sentences",
            "tone": "simple language",
            "forbidden": "advanced topics",
        }
        result = self.pe.use_constraint_specification("Prompt", constraints)
        assert "2-3 sentences" in result
        assert "simple language" in result

    def test_output_structuring(self):
        structure = {"answer": "str", "explanation": "str", "confidence": "float"}
        result = self.pe.use_output_structuring("Generate", structure)
        assert "answer" in result
        assert "confidence" in result

    def test_build_optimized_question_prompt(self):
        result = self.pe.build_optimized_question_prompt(
            subject="Programming", difficulty="medium", topic="loops", question_type="MCQ"
        )
        assert isinstance(result, str)
        assert len(result) > 50

    def test_build_optimized_chatbot_prompt(self):
        result = self.pe.build_optimized_chatbot_prompt(
            question="What is a loop?",
            context="Loops repeat code blocks.",
            student_level="beginner",
        )
        assert isinstance(result, str)
        assert len(result) > 20

    def test_analyze_prompt_quality(self):
        r = self.pe.analyze_prompt_quality("A" * 800)
        assert "quality_score" in r
        assert "suggestions" in r
        assert isinstance(r["quality_score"], (int, float))

    def test_analyze_prompt_too_short(self):
        r = self.pe.analyze_prompt_quality("Hi")
        assert r["quality_score"] < 80
        assert len(r["suggestions"]) > 0


class TestExamples:
    def test_examples_exist(self):
        assert len(QUESTION_GENERATION_EXAMPLES) >= 5

    def test_examples_have_required_keys(self):
        for ex in QUESTION_GENERATION_EXAMPLES:
            assert "subject" in ex
            assert "topic" in ex
