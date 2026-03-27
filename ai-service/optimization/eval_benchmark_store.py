"""Persist and retrieve eval benchmark snapshots."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.db_connection import get_database

_COLL = "eval_benchmark_runs"


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


class EvalBenchmarkStore:
    def __init__(self) -> None:
        self.col = get_database()[_COLL]

    def save_run(self, payload: dict[str, Any]) -> str | None:
        doc = dict(payload)
        doc["created_at"] = _utcnow()
        try:
            return str(self.col.insert_one(doc).inserted_id)
        except Exception:
            return None

    def history(self, last_n: int = 50) -> list[dict[str, Any]]:
        rows = list(self.col.find({}).sort("created_at", -1).limit(last_n))
        for row in rows:
            if "_id" in row:
                row["_id"] = str(row["_id"])
        return rows

    @staticmethod
    def _metric(run: dict[str, Any], path: str, default: float = 0.0) -> float:
        node: Any = run
        for key in path.split("."):
            if not isinstance(node, dict):
                return float(default)
            node = node.get(key)
        try:
            return float(node)
        except Exception:
            return float(default)

    def regression_report(self, last_n_baseline: int = 10) -> dict[str, Any]:
        """
        Compare latest run to mean baseline from previous runs.
        """
        runs = self.history(last_n=max(2, last_n_baseline + 1))
        if len(runs) < 2:
            return {
                "has_baseline": False,
                "regressed": False,
                "severity": "none",
                "summary": "Not enough baseline runs yet.",
                "reasons": [],
                "current_run_id": runs[0].get("_id") if runs else None,
                "baseline_count": max(0, len(runs) - 1),
            }

        current = runs[0]
        baseline = runs[1:]
        n = len(baseline)

        def mean(path: str, default: float = 0.0) -> float:
            vals = [self._metric(r, path, default) for r in baseline]
            return sum(vals) / max(len(vals), 1)

        cur_latency = self._metric(current, "signals.response_latency.mean", 0.0)
        cur_accuracy = self._metric(current, "signals.answer_accuracy.mean", 0.0)
        cur_hallu = self._metric(current, "signals.hallucination.mean", 0.0)
        cur_rating = self._metric(current, "signals.user_rating.mean", 0.0)
        cur_intervention = self._metric(current, "interventions.effective_rate", 0.0)

        base_latency = mean("signals.response_latency.mean", 0.0)
        base_accuracy = mean("signals.answer_accuracy.mean", 0.0)
        base_hallu = mean("signals.hallucination.mean", 0.0)
        base_rating = mean("signals.user_rating.mean", 0.0)
        base_intervention = mean("interventions.effective_rate", 0.0)

        reasons: list[dict[str, Any]] = []
        if cur_latency > max(base_latency * 1.2, base_latency + 0.3):
            reasons.append({"metric": "response_latency.mean", "direction": "up", "current": cur_latency, "baseline": round(base_latency, 4)})
        if (base_accuracy - cur_accuracy) > 0.05:
            reasons.append({"metric": "answer_accuracy.mean", "direction": "down", "current": cur_accuracy, "baseline": round(base_accuracy, 4)})
        if (cur_hallu - base_hallu) > 0.05:
            reasons.append({"metric": "hallucination.mean", "direction": "up", "current": cur_hallu, "baseline": round(base_hallu, 4)})
        if (base_rating - cur_rating) > 0.2 and base_rating > 0:
            reasons.append({"metric": "user_rating.mean", "direction": "down", "current": cur_rating, "baseline": round(base_rating, 4)})
        if (base_intervention - cur_intervention) > 0.08 and base_intervention > 0:
            reasons.append({"metric": "interventions.effective_rate", "direction": "down", "current": cur_intervention, "baseline": round(base_intervention, 4)})

        severity = "none"
        if reasons:
            critical_metrics = {"response_latency.mean", "answer_accuracy.mean", "hallucination.mean"}
            critical_hits = sum(1 for r in reasons if str(r.get("metric")) in critical_metrics)
            severity = "critical" if critical_hits >= 2 or len(reasons) >= 3 else "warning"

        if not reasons:
            summary = "No regression detected compared to recent baseline."
        elif severity == "critical":
            summary = f"Critical regression: {len(reasons)} key benchmark metrics degraded."
        else:
            summary = f"Regression warning: {len(reasons)} metric(s) degraded vs baseline."

        return {
            "has_baseline": True,
            "regressed": len(reasons) > 0,
            "severity": severity,
            "summary": summary,
            "reasons": reasons,
            "current_run_id": current.get("_id"),
            "baseline_count": n,
            "baseline_means": {
                "response_latency_mean": round(base_latency, 4),
                "answer_accuracy_mean": round(base_accuracy, 4),
                "hallucination_mean": round(base_hallu, 4),
                "user_rating_mean": round(base_rating, 4),
                "intervention_effective_rate": round(base_intervention, 4),
            },
        }
