"""Track intervention outcomes and effectiveness over time."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.db_connection import get_database

_COL = "intervention_effectiveness"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class InterventionEffectivenessTracker:
    """Persistence + aggregation for intervention effectiveness loop."""

    def __init__(self) -> None:
        self._col = get_database()[_COL]

    def register_intervention(
        self,
        student_id: str,
        concept: str,
        intervention_type: str,
        baseline_score: float | None,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        doc = {
            "student_id": student_id,
            "concept": (concept or "general").strip().lower(),
            "intervention_type": intervention_type,
            "baseline_score": float(baseline_score) if baseline_score is not None else None,
            "resolved": False,
            "effective": None,
            "delta_score": None,
            "created_at": _now(),
            "metadata": metadata or {},
        }
        try:
            return str(self._col.insert_one(doc).inserted_id)
        except Exception:
            return None

    def resolve_with_event(
        self,
        student_id: str,
        concept: str,
        new_score: float | None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        if new_score is None:
            return None
        doc = self._col.find_one(
            {
                "student_id": student_id,
                "concept": (concept or "general").strip().lower(),
                "resolved": False,
            },
            sort=[("created_at", -1)],
        )
        if not doc:
            return None
        baseline = doc.get("baseline_score")
        if baseline is None:
            delta = 0.0
            effective = False
        else:
            delta = float(new_score) - float(baseline)
            effective = delta >= 8.0

        self._col.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "resolved": True,
                    "resolved_at": _now(),
                    "new_score": float(new_score),
                    "delta_score": round(delta, 3),
                    "effective": bool(effective),
                    "resolution_metadata": metadata or {},
                }
            },
        )
        return {
            "intervention_type": doc.get("intervention_type"),
            "concept": doc.get("concept"),
            "baseline_score": baseline,
            "new_score": float(new_score),
            "delta_score": round(delta, 3),
            "effective": bool(effective),
        }

    def get_stats(self, student_id: str | None = None, last_n: int = 200) -> dict[str, Any]:
        filt: dict[str, Any] = {"resolved": True}
        if student_id:
            filt["student_id"] = student_id
        docs = list(self._col.find(filt).sort("resolved_at", -1).limit(last_n))
        if not docs:
            return {"count": 0, "effective_rate": 0.0, "avg_delta_score": 0.0, "by_type": {}}
        count = len(docs)
        eff = sum(1 for d in docs if d.get("effective"))
        deltas = [float(d.get("delta_score") or 0.0) for d in docs]
        by_type: dict[str, dict[str, Any]] = {}
        for d in docs:
            t = d.get("intervention_type", "unknown")
            by_type.setdefault(t, {"count": 0, "effective": 0, "avg_delta": 0.0, "_d": []})
            by_type[t]["count"] += 1
            if d.get("effective"):
                by_type[t]["effective"] += 1
            by_type[t]["_d"].append(float(d.get("delta_score") or 0.0))
        for t, v in by_type.items():
            vals = v.pop("_d")
            v["effective_rate"] = round(v["effective"] / max(v["count"], 1), 4)
            v["avg_delta"] = round(sum(vals) / max(len(vals), 1), 4)
        return {
            "count": count,
            "effective_rate": round(eff / count, 4),
            "avg_delta_score": round(sum(deltas) / count, 4),
            "by_type": by_type,
        }
