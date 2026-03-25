"""Pytest configuration: path setup, shared fixtures, and markers."""
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))


# ---------------------------------------------------------------------------
# Shared fixtures (mock external services for CI)
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_rag_service():
    """A RAGService mock that avoids Chroma/Ollama/Mongo."""
    svc = MagicMock()
    svc.get_context_for_query.return_value = "Mocked course content about loops and functions."
    svc.search.return_value = []
    svc.health_check.return_value = {
        "status": "healthy",
        "mongodb": "ok",
        "chromadb": "ok",
        "ollama_llm": "ok",
    }
    return svc


@pytest.fixture()
def sample_mcq():
    return {
        "type": "MCQ",
        "question": "Which keyword defines a function in Python?",
        "options": ["def", "func", "define", "function"],
        "correct_answer": "def",
        "explanation": "The 'def' keyword is used to define functions in Python.",
        "difficulty": "easy",
        "topic": "functions",
        "subject": "Programming",
    }


@pytest.fixture()
def sample_tf():
    return {
        "type": "TrueFalse",
        "question": "Python uses indentation to define code blocks.",
        "options": ["True", "False"],
        "correct_answer": "True",
        "explanation": "Python relies on indentation rather than braces.",
        "difficulty": "easy",
        "topic": "syntax",
    }


@pytest.fixture()
def sample_dnd():
    return {
        "type": "DragDrop",
        "question": "Match data types to their descriptions.",
        "items": ["int", "str", "float"],
        "matches": ["Whole number", "Text", "Decimal"],
        "correct_pairs": {"int": "Whole number", "str": "Text", "float": "Decimal"},
        "difficulty": "medium",
        "topic": "data types",
    }


@pytest.fixture()
def sample_questions(sample_mcq, sample_tf, sample_dnd):
    return [sample_mcq, sample_tf, sample_dnd]
