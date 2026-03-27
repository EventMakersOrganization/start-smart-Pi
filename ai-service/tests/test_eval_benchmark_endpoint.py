from __future__ import annotations

import httpx
import pytest

BASE = "http://localhost:8000"


def _api_reachable() -> bool:
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


@pytest.mark.skipif(not _api_reachable(), reason="AI service not running at localhost:8000")
def test_eval_benchmark_endpoint_contract():
    r = httpx.get(f"{BASE}/monitor/eval-benchmark", timeout=30)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload.get("status") == "success"
    assert "quality_gate" in payload
    assert "signals" in payload
    assert "interventions" in payload


@pytest.mark.skipif(not _api_reachable(), reason="AI service not running at localhost:8000")
def test_eval_benchmark_run_and_history_contract():
    run_resp = httpx.post(f"{BASE}/monitor/eval-benchmark/run?last_n=100", timeout=30)
    assert run_resp.status_code == 200, run_resp.text
    run_payload = run_resp.json()
    assert run_payload.get("status") == "success"
    assert "benchmark" in run_payload
    assert "regression" in run_payload

    hist_resp = httpx.get(f"{BASE}/monitor/eval-benchmark/history?last_n=5", timeout=30)
    assert hist_resp.status_code == 200, hist_resp.text
    hist_payload = hist_resp.json()
    assert hist_payload.get("status") == "success"
    assert isinstance(hist_payload.get("runs"), list)


@pytest.mark.skipif(not _api_reachable(), reason="AI service not running at localhost:8000")
def test_eval_benchmark_regression_contract():
    # Ensure at least one persisted run exists.
    _ = httpx.post(f"{BASE}/monitor/eval-benchmark/run?last_n=80", timeout=30)
    resp = httpx.get(f"{BASE}/monitor/eval-benchmark/regression?last_n_baseline=5", timeout=30)
    assert resp.status_code == 200, resp.text
    payload = resp.json()
    assert payload.get("status") == "success"
    assert "regressed" in payload
    assert "reasons" in payload
    assert payload.get("severity") in {"none", "warning", "critical"}
    assert isinstance(payload.get("summary"), str)
