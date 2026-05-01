"""Latency fast-path tests for chat and BrainRush endpoints."""
from __future__ import annotations

import os
import time
import uuid
from unittest.mock import patch

import httpx
import pytest

from api import _run_chatbot_pipeline

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
    reason="AI service not running at localhost:8000",
)


@_needs_api
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

class TestLatencyFastPathUnit:
    def test_chatbot_fastpath_falls_back_without_context(self):
        with patch("api.run_with_timeout") as mocked_timeout:
            answer, tier_used, llm_called, fallback_used = _run_chatbot_pipeline(
                effective_question="Explain loops",
                lang="en",
                context="   ",
                t0=time.time(),
                budget_hard=30.0,
            )

        assert tier_used == "fallback"
        assert llm_called is False
        assert fallback_used is True
        assert isinstance(answer, str)
        mocked_timeout.assert_not_called()

    def test_chatbot_fastpath_returns_full_answer_when_llm_succeeds(self):
        with patch("api.run_with_timeout", return_value=("  direct answer  ", False)) as mocked_timeout:
            answer, tier_used, llm_called, fallback_used = _run_chatbot_pipeline(
                effective_question="Explain loops",
                lang="en",
                context="relevant context",
                t0=time.time(),
                budget_hard=30.0,
            )

        assert answer == "direct answer"
        assert tier_used == "full"
        assert llm_called is True
        assert fallback_used is False
        mocked_timeout.assert_called_once()
