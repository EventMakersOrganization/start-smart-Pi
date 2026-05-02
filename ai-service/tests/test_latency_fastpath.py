"""Latency tests: unit suite runs in CI; integration suite needs RUN_AI_LATENCY_INTEGRATION + live API."""

from __future__ import annotations

import os
import time
import uuid
from unittest.mock import MagicMock, patch

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 180.0


def _api_reachable() -> bool:
    if not bool(os.environ.get("RUN_AI_LATENCY_INTEGRATION")):
        return False
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


_needs_api = pytest.mark.skipif(
    not _api_reachable(),
    reason="Set RUN_AI_LATENCY_INTEGRATION=1 and run ai-service at localhost:8000",
)


@_needs_api
@pytest.mark.integration
class TestLatencyFastPath:
    def test_chatbot_cache_and_tier_metadata(self):
        student_id = f"latency-{uuid.uuid4()}"
        payload = {
            "question": "Explain loops in simple terms",
            "conversation_history": [],
            "student_id": student_id,
        }

        t0 = time.perf_counter()
        r1 = httpx.post(f"{BASE}/chatbot/ask", json=payload, timeout=TIMEOUT)
        dt1 = time.perf_counter() - t0
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "tier_used" in d1
        assert "cache_hit" in d1

        t1 = time.perf_counter()
        r2 = httpx.post(f"{BASE}/chatbot/ask", json=payload, timeout=TIMEOUT)
        dt2 = time.perf_counter() - t1
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("cache_hit") is True
        assert d2.get("tier_used") == "cache"
        assert dt2 <= dt1

    def test_brainrush_cache_and_tier_metadata(self):
        student_id = f"latency-{uuid.uuid4()}"
        payload = {
            "subject": "Programmation",
            "difficulty": "medium",
            "topic": "variables",
            "question_type": "MCQ",
            "student_id": student_id,
        }

        r1 = httpx.post(f"{BASE}/brainrush/generate-question", json=payload, timeout=TIMEOUT)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "tier_used" in d1
        assert "cache_hit" in d1

        r2 = httpx.post(f"{BASE}/brainrush/generate-question", json=payload, timeout=TIMEOUT)
        assert r2.status_code == 200, r2.text
        d2 = r2.json()
        assert d2.get("cache_hit") is True
        assert d2.get("tier_used") == "cache"


@pytest.fixture()
def api_client():
    with patch("core.db_connection.get_database", return_value=MagicMock()), \
         patch("core.db_connection.get_all_courses", return_value=[]), \
         patch("optimization.hybrid_response_cache.HybridResponseCache.get", return_value=(None, 0)), \
         patch("utils.langchain_ollama.generate_response", return_value="mocked answer"):
        
        from fastapi.testclient import TestClient
        import api
        yield TestClient(api.app)


@pytest.mark.unit
class TestLatencyFastPathUnit:
    def test_chatbot_cache_hit_unit(self, api_client):
        # 1. Mock cache miss then hit
        with patch("api.response_cache.get") as mock_get, \
             patch("api.response_cache.set") as mock_set:
            
            # First call: Miss
            mock_get.return_value = (None, 0)
            payload = {"question": "test?", "conversation_history": []}
            
            r1 = api_client.post("/chatbot/ask", json=payload)
            assert r1.status_code == 200
            assert r1.json()["cache_hit"] is False
            assert mock_set.called

            # Second call: Hit
            mock_get.return_value = ({"answer": "mocked answer"}, 50) # 50ms age
            r2 = api_client.post("/chatbot/ask", json=payload)
            assert r2.status_code == 200
            assert r2.json()["cache_hit"] is True
            assert r2.json()["tier_used"] == "cache"

    def test_brainrush_cache_hit_unit(self, api_client):
        with patch("api.response_cache.get") as mock_get:
            mock_get.return_value = ({"question": "cached q"}, 10)
            payload = {
                "subject": "Math",
                "difficulty": "easy",
                "topic": "addition",
                "question_type": "MCQ"
            }
            r = api_client.post("/brainrush/generate-question", json=payload)
            assert r.status_code == 200
            assert r.json()["cache_hit"] is True

    def test_chatbot_empty_input_unit(self, api_client):
        # Validation error (Pydantic)
        r = api_client.post("/chatbot/ask", json={"question": ""})
        assert r.status_code == 422

    def test_chatbot_unhandled_exception_unit(self, api_client):
        # Mock an internal function to raise an exception that isn't caught by the pipeline
        with patch("api._effective_question", side_effect=Exception("Critical Failure")):
            payload = {"question": "crash me", "conversation_history": []}
            r = api_client.post("/chatbot/ask", json=payload)
            assert r.status_code == 500
            assert "Chatbot failed: Critical Failure" in r.json()["detail"]

    def test_chatbot_llm_timeout_handled_unit(self, api_client):
        # If generate_response_explain returns "" (as it does on exception/timeout), 
        # api.py returns a 200 with a fallback message.
        with patch("api.response_cache.get", return_value=(None, 0)), \
             patch("utils.langchain_ollama.generate_response_explain", return_value=""):
            
            payload = {"question": "slow?", "conversation_history": []}
            r = api_client.post("/chatbot/ask", json=payload)
            assert r.status_code == 200
            assert "tier_used" in r.json()
            # It should have fallback text
            assert len(r.json()["answer"]) > 0
