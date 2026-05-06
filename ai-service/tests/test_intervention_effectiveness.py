"""Integration test for intervention effectiveness loop."""
from __future__ import annotations

import os
import uuid

import httpx
import pytest

BASE = "http://localhost:8000"
TIMEOUT = 120.0


def _api_reachable() -> bool:
    if not bool(os.environ.get("RUN_AI_INTERVENTION_INTEGRATION")):
        return False
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


_needs_api = pytest.mark.skipif(
    not _api_reachable(),
    reason="Set RUN_AI_INTERVENTION_INTEGRATION=1 and run ai-service at localhost:8000",
)


def _event(student_id: str, score: float, concept: str):
    r = httpx.post(
        f"{BASE}/learning-state/event",
        json={
            "student_id": student_id,
            "event_type": "exercise",
            "score": score,
            "duration_sec": 90,
            "metadata": {"concept": concept, "is_correct": score >= 50},
        },
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_event_posts_expected_payload_unit(monkeypatch):
    captured = {}

    class _Resp:
        status_code = 200
        text = 'ok'

        @staticmethod
        def json():
            return {'ok': True}

    def fake_post(url, json, timeout):
        captured['url'] = url
        captured['json'] = json
        captured['timeout'] = timeout
        return _Resp()

    monkeypatch.setattr(httpx, 'post', fake_post)

    out = _event('student-1', 45, 'algebra')

    assert out == {'ok': True}
    assert captured['url'].endswith('/learning-state/event')
    assert captured['json']['student_id'] == 'student-1'
    assert captured['json']['metadata']['concept'] == 'algebra'
    assert captured['json']['metadata']['is_correct'] is False


@_needs_api
def test_intervention_effectiveness_stats_flow():
    student = f"eff-{uuid.uuid4()}"
    concept = "booleans"

    # Trigger struggle intervention by consecutive fails.
    _event(student, 20, concept)
    r2 = _event(student, 25, concept)
    assert r2.get("intervention", {}).get("triggered") is True

    # Resolve pending intervention with improved score.
    r3 = _event(student, 70, concept)
    out = r3.get("intervention_effectiveness_outcome")
    assert out is None or "effective" in out

    stats_resp = httpx.get(f"{BASE}/interventions/effectiveness/{student}", timeout=TIMEOUT)
    assert stats_resp.status_code == 200, stats_resp.text
    stats = stats_resp.json().get("stats", {})
    assert "effective_rate" in stats
    assert "avg_delta_score" in stats
