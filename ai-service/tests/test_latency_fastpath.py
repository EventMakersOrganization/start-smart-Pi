"""Latency fast-path tests for chat and BrainRush endpoints."""
from __future__ import annotations

import time
import uuid

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 180.0


def _api_reachable() -> bool:
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
