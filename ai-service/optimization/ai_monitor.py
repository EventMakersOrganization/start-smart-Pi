"""
AI performance monitoring: tracks endpoint latency, success/failure rates,
LLM token estimates, and system health over time.

Data stored in MongoDB ``ai_performance_metrics`` collection so dashboards
and the feedback loop can consume it.
"""
from __future__ import annotations

import logging
import statistics
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core import db_connection
from core.rag_service import RAGService

logger = logging.getLogger("ai_monitor")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

_METRICS_COLLECTION = "ai_performance_metrics"


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_collection():
    return db_connection.get_database()[_METRICS_COLLECTION]


# ---------------------------------------------------------------------------
# AIPerformanceMonitor
# ---------------------------------------------------------------------------


class AIPerformanceMonitor:
    """
    Records per-request metrics, aggregates them, and exposes summary
    dashboards for latency, throughput, errors, and component health.
    """

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()

    # ------------------------------------------------------------------
    # Record
    # ------------------------------------------------------------------

    def record_request(
        self,
        endpoint: str,
        latency_seconds: float,
        success: bool,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """Persist one API request metric."""
        doc = {
            "endpoint": endpoint,
            "latency": round(latency_seconds, 4),
            "success": success,
            "metadata": metadata or {},
            "timestamp": _utcnow(),
        }
        try:
            return str(_get_collection().insert_one(doc).inserted_id)
        except Exception as exc:
            logger.error("record_request: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Aggregation helpers
    # ------------------------------------------------------------------

    def get_endpoint_stats(
        self,
        endpoint: str | None = None,
        minutes: int = 60,
    ) -> dict[str, Any]:
        """Stats for one or all endpoints in the last `minutes` window."""
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()
        filt: dict[str, Any] = {"timestamp": {"$gte": cutoff}}
        if endpoint:
            filt["endpoint"] = endpoint
        try:
            docs = list(_get_collection().find(filt).sort("timestamp", -1).limit(5000))
        except Exception as exc:
            logger.error("get_endpoint_stats: %s", exc)
            docs = []

        if not docs:
            return {"window_minutes": minutes, "total_requests": 0}

        latencies = [d["latency"] for d in docs]
        successes = sum(1 for d in docs if d.get("success"))
        failures = len(docs) - successes

        by_ep: dict[str, list[float]] = {}
        for d in docs:
            by_ep.setdefault(d["endpoint"], []).append(d["latency"])

        per_endpoint: dict[str, dict[str, Any]] = {}
        for ep, lats in by_ep.items():
            per_endpoint[ep] = {
                "count": len(lats),
                "mean_latency": round(statistics.mean(lats), 4),
                "median_latency": round(statistics.median(lats), 4),
                "p95_latency": round(sorted(lats)[int(len(lats) * 0.95)] if lats else 0, 4),
                "max_latency": round(max(lats), 4),
            }

        return {
            "window_minutes": minutes,
            "total_requests": len(docs),
            "successes": successes,
            "failures": failures,
            "success_rate": round(successes / len(docs), 4),
            "mean_latency": round(statistics.mean(latencies), 4),
            "median_latency": round(statistics.median(latencies), 4),
            "p95_latency": round(sorted(latencies)[int(len(latencies) * 0.95)] if latencies else 0, 4),
            "per_endpoint": per_endpoint,
        }

    def get_error_log(self, last_n: int = 50) -> list[dict[str, Any]]:
        """Recent failed requests."""
        try:
            cursor = (
                _get_collection()
                .find({"success": False})
                .sort("timestamp", -1)
                .limit(last_n)
            )
            return [
                {
                    "endpoint": d.get("endpoint"),
                    "latency": d.get("latency"),
                    "metadata": d.get("metadata"),
                    "timestamp": d.get("timestamp"),
                }
                for d in cursor
            ]
        except Exception as exc:
            logger.error("get_error_log: %s", exc)
            return []

    def get_system_health(self) -> dict[str, Any]:
        """
        Composite health: RAG components + recent API performance.
        """
        rag_health = self.rag_service.health_check()
        recent = self.get_endpoint_stats(minutes=15)

        api_ok = recent.get("success_rate", 1.0) >= 0.90
        latency_ok = recent.get("median_latency", 0) <= 10.0

        overall = "healthy"
        if rag_health.get("status") != "healthy":
            overall = "degraded"
        if not api_ok:
            overall = "degraded"
        if not latency_ok and overall == "healthy":
            overall = "slow"

        return {
            "overall": overall,
            "components": rag_health,
            "api_performance_15m": {
                "total_requests": recent.get("total_requests", 0),
                "success_rate": recent.get("success_rate", None),
                "median_latency": recent.get("median_latency", None),
            },
            "checks": {
                "api_success_rate_ok": api_ok,
                "api_latency_ok": latency_ok,
            },
            "checked_at": _utcnow(),
        }

    def get_throughput(self, minutes: int = 60) -> dict[str, Any]:
        """Requests per minute in the window."""
        stats = self.get_endpoint_stats(minutes=minutes)
        total = stats.get("total_requests", 0)
        rpm = round(total / max(minutes, 1), 2)
        return {
            "window_minutes": minutes,
            "total_requests": total,
            "requests_per_minute": rpm,
        }

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def purge_old_metrics(self, days: int = 30) -> int:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        try:
            result = _get_collection().delete_many({"timestamp": {"$lt": cutoff}})
            deleted = result.deleted_count
            logger.info("purge_old_metrics: removed %d records older than %d days", deleted, days)
            return deleted
        except Exception as exc:
            logger.error("purge_old_metrics: %s", exc)
            return 0


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def _demo() -> None:
    import json

    mon = AIPerformanceMonitor()

    print("=" * 60)
    print("  Recording sample metrics")
    print("=" * 60)
    endpoints = [
        ("/chatbot/ask", 1.2, True),
        ("/chatbot/ask", 3.5, True),
        ("/chatbot/ask", 12.0, False),
        ("/brainrush/generate-question", 4.1, True),
        ("/brainrush/generate-question", 2.8, True),
        ("/rag/answer", 2.0, True),
        ("/rag/answer", 0.8, True),
        ("/search/advanced", 0.3, True),
        ("/search/advanced", 0.5, False),
    ]
    for ep, lat, ok in endpoints:
        mon.record_request(ep, lat, ok, {"demo": True})
    print(f"Recorded {len(endpoints)} sample requests.\n")

    print("=" * 60)
    print("  Endpoint stats (last 60 min)")
    print("=" * 60)
    stats = mon.get_endpoint_stats(minutes=60)
    print(json.dumps({k: stats[k] for k in (
        "total_requests", "successes", "failures", "success_rate",
        "mean_latency", "median_latency",
    )}, indent=2))
    print("Per endpoint:")
    for ep, ep_stats in stats.get("per_endpoint", {}).items():
        print(f"  {ep}: {ep_stats}")

    print("\n" + "=" * 60)
    print("  Error log")
    print("=" * 60)
    errors = mon.get_error_log(last_n=5)
    for e in errors:
        print(f"  {e['endpoint']} latency={e['latency']}s at {e['timestamp']}")

    print("\n" + "=" * 60)
    print("  System health")
    print("=" * 60)
    health = mon.get_system_health()
    print(json.dumps(health, indent=2, default=str))

    print("\n" + "=" * 60)
    print("  Throughput")
    print("=" * 60)
    tp = mon.get_throughput(minutes=60)
    print(json.dumps(tp, indent=2))


if __name__ == "__main__":
    _demo()
