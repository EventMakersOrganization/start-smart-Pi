from __future__ import annotations

import os
import uuid

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 120.0


def _api_reachable() -> bool:
    if not bool(os.environ.get("RUN_AI_FEEDBACK_INTEGRATION")):
        return False
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def _count_signal(signal: str) -> int:
    r = httpx.get(f"{BASE}/feedback/stats/{signal}?last_n=500", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    return int(r.json().get("count", 0))


def test_count_signal_parses_integer_unit(monkeypatch):
    class _Resp:
        status_code = 200
        text = 'ok'

        @staticmethod
        def json():
            return {'count': '7'}

    monkeypatch.setattr(httpx, 'get', lambda *args, **kwargs: _Resp())

    assert _count_signal('response_latency') == 7


@pytest.mark.skipif(
    not _api_reachable(),
    reason="Set RUN_AI_FEEDBACK_INTEGRATION=1 and run ai-service at localhost:8000",
)
def test_autorecord_signals_from_chat_and_brainrush():
    before_latency = _count_signal("response_latency")
    before_hallu = _count_signal("hallucination")
    before_qquality = _count_signal("question_quality")

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

    after_latency = _count_signal("response_latency")
    after_hallu = _count_signal("hallucination")
    after_qquality = _count_signal("question_quality")

    assert after_latency >= before_latency + 2
    assert after_hallu >= before_hallu + 1
    assert after_qquality >= before_qquality + 1
