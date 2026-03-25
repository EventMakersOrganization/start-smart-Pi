"""Unit tests for FastAPI routes via TestClient — all services mocked."""
import sys
import pytest
from unittest.mock import patch, MagicMock


def _noop_rag():
    svc = MagicMock()
    svc.get_context_for_query.return_value = "Mocked context."
    svc.search.return_value = []
    svc.health_check.return_value = {"status": "healthy"}
    return svc


def _make_mock_col():
    col = MagicMock()
    col.insert_one.return_value = MagicMock(inserted_id="x")
    col.count_documents.return_value = 0
    col.delete_many.return_value = MagicMock(deleted_count=0)

    class _FC:
        def __init__(self, d=None):
            self._d = d or []
        def sort(self, *a, **kw):
            return self
        def limit(self, *a, **kw):
            return self
        def __iter__(self):
            return iter(self._d)
    col.find.return_value = _FC()
    return col


def _mock_db():
    db = MagicMock()
    db.__getitem__ = MagicMock(side_effect=lambda k: _make_mock_col())
    return db


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient with all external services mocked."""
    mock_db = _mock_db()
    mock_rag = _noop_rag()

    patches = [
        patch.dict("sys.modules", {}),
        patch("core.rag_service.RAGService.get_instance", return_value=mock_rag),
        patch("core.db_connection.get_database", return_value=mock_db),
        patch("core.db_connection.get_all_courses", return_value=[]),
        patch("core.db_connection._db", mock_db),
        patch("core.db_connection._courses", _make_mock_col()),
        patch("utils.langchain_ollama.generate_response", return_value="mocked answer", create=True),
        patch("utils.langchain_ollama.generate_structured_json", return_value={}, create=True),
    ]
    for p in patches[1:]:
        p.start()

    from fastapi.testclient import TestClient
    import importlib
    if "api" in sys.modules:
        importlib.reload(sys.modules["api"])
    import api as api_mod
    c = TestClient(api_mod.app)
    yield c

    for p in patches[1:]:
        try:
            p.stop()
        except RuntimeError:
            pass


class TestRootAndHealth:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200

    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200


class TestClassifyRoutes:
    def test_classify_difficulty(self, client):
        r = client.post("/classify/difficulty", json={
            "question": {"question": "What is a variable?", "difficulty": "easy"},
        })
        assert r.status_code == 200
        assert "difficulty" in r.json()

    def test_classify_batch(self, client):
        r = client.post("/classify/difficulty-batch", json={
            "questions": [
                {"question": "What is a variable?", "difficulty": "easy"},
            ],
        })
        assert r.status_code == 200


class TestEvaluateRoutes:
    def test_evaluate_answer(self, client):
        r = client.post("/evaluate/answer", json={
            "question": {
                "type": "MCQ",
                "question": "Which keyword defines a function?",
                "options": ["def", "func", "define", "fn"],
                "correct_answer": "def",
                "explanation": "def is the keyword.",
                "difficulty": "easy",
            },
            "student_answer": "def",
        })
        assert r.status_code == 200
        assert "is_correct" in r.json()

    def test_evaluate_batch(self, client):
        r = client.post("/evaluate/batch", json={
            "submissions": [
                {
                    "question": {
                        "type": "TrueFalse",
                        "question": "Python is compiled.",
                        "options": ["True", "False"],
                        "correct_answer": "False",
                        "explanation": "Interpreted.",
                        "difficulty": "easy",
                    },
                    "student_answer": "False",
                },
            ],
        })
        assert r.status_code == 200


class TestFeedbackRoutes:
    def test_record_feedback(self, client):
        r = client.post("/feedback/record", json={
            "signal_type": "question_quality",
            "value": 0.85,
            "metadata": {"topic": "loops"},
        })
        assert r.status_code == 200

    def test_user_rating(self, client):
        r = client.post("/feedback/user-rating", json={
            "rating": 4,
            "context": "good explanation",
        })
        assert r.status_code == 200


class TestMonitorRoutes:
    def test_monitor_health(self, client):
        r = client.get("/monitor/health")
        assert r.status_code == 200

    def test_monitor_throughput(self, client):
        r = client.get("/monitor/throughput")
        assert r.status_code == 200
