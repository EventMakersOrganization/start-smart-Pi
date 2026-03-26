"""Unit tests for optimization.ai_feedback_loop — mocks MongoDB."""
import pytest
from unittest.mock import patch, MagicMock

from optimization.ai_feedback_loop import (
    SIGNAL_QUESTION_QUALITY,
    SIGNAL_ANSWER_ACCURACY,
    SIGNAL_RESPONSE_LATENCY,
    SIGNAL_USER_RATING,
    SIGNAL_HALLUCINATION,
)


def _make_mock_collection():
    col = MagicMock()
    col.insert_one.return_value = MagicMock(inserted_id="abc123")
    col.count_documents.return_value = 0
    col.delete_many.return_value = MagicMock(deleted_count=5)

    class _FakeCursor:
        def __init__(self, data):
            self._data = data
        def sort(self, *a, **kw):
            return self
        def limit(self, *a, **kw):
            return self
        def __iter__(self):
            return iter(self._data)

    col.find.return_value = _FakeCursor([])
    col._FakeCursor = _FakeCursor
    return col


@pytest.fixture()
def feedback_env(mock_rag_service):
    mock_col = _make_mock_collection()

    with patch("optimization.ai_feedback_loop.RAGService") as MockRAG, \
         patch("optimization.ai_feedback_loop._get_collection", return_value=mock_col):
        MockRAG.get_instance.return_value = mock_rag_service
        from optimization.ai_feedback_loop import AIFeedbackLoop
        loop = AIFeedbackLoop()
        yield loop, mock_col


class TestAIFeedbackLoop:
    def test_record_signal(self, feedback_env):
        loop, col = feedback_env
        loop.record_signal(SIGNAL_QUESTION_QUALITY, 0.85, {"topic": "loops"})
        col.insert_one.assert_called_once()
        doc = col.insert_one.call_args[0][0]
        assert doc["signal_type"] == SIGNAL_QUESTION_QUALITY
        assert doc["value"] == 0.85
        assert doc["metadata"]["topic"] == "loops"

    def test_record_question_feedback(self, feedback_env):
        loop, col = feedback_env
        q = {"question": "What is X?", "topic": "loops", "difficulty": "easy"}
        loop.record_question_feedback(q, quality_score=0.9)
        assert col.insert_one.call_count >= 1

    def test_record_response_latency(self, feedback_env):
        loop, col = feedback_env
        loop.record_response_latency("/chat", 0.42)
        doc = col.insert_one.call_args[0][0]
        assert doc["signal_type"] == SIGNAL_RESPONSE_LATENCY

    def test_record_user_rating(self, feedback_env):
        loop, col = feedback_env
        loop.record_user_rating(4, "Helpful answer")
        doc = col.insert_one.call_args[0][0]
        assert doc["signal_type"] == SIGNAL_USER_RATING
        assert doc["value"] == 4.0

    def test_record_hallucination(self, feedback_env):
        loop, col = feedback_env
        loop.record_hallucination("The capital is Berlin", 0.9)
        doc = col.insert_one.call_args[0][0]
        assert doc["signal_type"] == SIGNAL_HALLUCINATION

    def test_get_signal_stats_empty(self, feedback_env):
        loop, col = feedback_env
        r = loop.get_signal_stats(SIGNAL_QUESTION_QUALITY, last_n=50)
        assert r["count"] == 0

    def test_get_signal_stats_with_data(self, feedback_env):
        loop, col = feedback_env
        FakeCursor = col._FakeCursor
        col.find.return_value = FakeCursor([
            {"value": 0.8}, {"value": 0.9}, {"value": 0.7},
        ])
        r = loop.get_signal_stats(SIGNAL_QUESTION_QUALITY, last_n=50)
        assert r["count"] == 3
        assert abs(r["mean"] - 0.8) < 0.01

    def test_generate_tuning_recommendations(self, feedback_env):
        loop, col = feedback_env
        recs = loop.generate_tuning_recommendations()
        assert isinstance(recs, dict)
        assert "recommendations" in recs

    def test_purge_old_signals(self, feedback_env):
        loop, col = feedback_env
        r = loop.purge_old_signals(days=30)
        assert r == 5
