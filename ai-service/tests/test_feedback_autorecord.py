from __future__ import annotations

import uuid

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 120.0


def _api_reachable() -> bool:
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not _api_reachable(), reason="AI service not running at localhost:8000")
def test_autorecord_signals_from_chat_and_brainrush():
    def _count(signal: str) -> int:
        r = httpx.get(f"{BASE}/feedback/stats/{signal}?last_n=500", timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        return int(r.json().get("count", 0))

    before_latency = _count("response_latency")
    before_hallu = _count("hallucination")
    before_qquality = _count("question_quality")

    sid = f"auto-signal-{uuid.uuid4()}"
    chat = httpx.post(
        f"{BASE}/chatbot/ask",
        json={
            "question": "Explique en francais ce que sont les variables en programmation",
            "conversation_history": [],
            "student_id": sid,
        },
        timeout=TIMEOUT,
    )
    assert chat.status_code == 200, chat.text

    bq = httpx.post(
        f"{BASE}/brainrush/generate-question",
        json={
            "subject": "Programmation",
            "difficulty": "medium",
            "topic": "variables",
            "question_type": "MCQ",
            "student_id": sid,
        },
        timeout=TIMEOUT,
    )
    assert bq.status_code == 200, bq.text

    after_latency = _count("response_latency")
    after_hallu = _count("hallucination")
    after_qquality = _count("question_quality")

    assert after_latency >= before_latency + 2
    assert after_hallu >= before_hallu + 1
    assert after_qquality >= before_qquality + 1
