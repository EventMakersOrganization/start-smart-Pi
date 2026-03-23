"""
AI feedback loop: collects evaluation signals (question quality, answer
accuracy, response latency, user ratings), aggregates them, and produces
actionable tuning recommendations for prompts, difficulty, and RAG retrieval.

Data is persisted in MongoDB so trends can be tracked across sessions.
"""
from __future__ import annotations

import logging
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core import db_connection
from core.rag_service import RAGService

logger = logging.getLogger("ai_feedback_loop")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# MongoDB collection for feedback records
_FEEDBACK_COLLECTION = "ai_feedback"

# ---------------------------------------------------------------------------
# Signal types
# ---------------------------------------------------------------------------

SIGNAL_QUESTION_QUALITY = "question_quality"
SIGNAL_ANSWER_ACCURACY = "answer_accuracy"
SIGNAL_RESPONSE_LATENCY = "response_latency"
SIGNAL_USER_RATING = "user_rating"
SIGNAL_DIFFICULTY_MISMATCH = "difficulty_mismatch"
SIGNAL_HALLUCINATION = "hallucination"

ALL_SIGNALS = frozenset({
    SIGNAL_QUESTION_QUALITY,
    SIGNAL_ANSWER_ACCURACY,
    SIGNAL_RESPONSE_LATENCY,
    SIGNAL_USER_RATING,
    SIGNAL_DIFFICULTY_MISMATCH,
    SIGNAL_HALLUCINATION,
})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_collection():
    db = db_connection.get_database()
    return db[_FEEDBACK_COLLECTION]


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# AIFeedbackLoop
# ---------------------------------------------------------------------------


class AIFeedbackLoop:
    """
    Collects, persists, aggregates, and analyses AI feedback signals.
    Produces tuning recommendations for prompts, difficulty calibration,
    and RAG retrieval.
    """

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()

    # ------------------------------------------------------------------
    # Record signals
    # ------------------------------------------------------------------

    def record_signal(
        self,
        signal_type: str,
        value: float,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """
        Persist a single feedback signal.

        Args:
            signal_type: One of ALL_SIGNALS.
            value: Numeric value (score, seconds, 1-5 rating, etc.).
            metadata: Optional context (subject, topic, question_id, ...).

        Returns:
            Inserted document ID or None on error.
        """
        if signal_type not in ALL_SIGNALS:
            logger.warning("Unknown signal type: %s", signal_type)
            return None
        doc = {
            "signal_type": signal_type,
            "value": float(value),
            "metadata": metadata or {},
            "timestamp": _utcnow(),
        }
        try:
            col = _get_collection()
            result = col.insert_one(doc)
            return str(result.inserted_id)
        except Exception as exc:
            logger.error("record_signal failed: %s", exc)
            return None

    def record_question_feedback(
        self,
        question_dict: dict,
        quality_score: float,
        student_accuracy: float | None = None,
        difficulty_matched: bool | None = None,
    ) -> str | None:
        """Convenience: persist combined question-level feedback."""
        meta: dict[str, Any] = {
            "subject": question_dict.get("subject", ""),
            "topic": question_dict.get("topic", ""),
            "difficulty": question_dict.get("difficulty", ""),
            "question_preview": str(question_dict.get("question", ""))[:120],
        }
        self.record_signal(SIGNAL_QUESTION_QUALITY, quality_score, meta)
        if student_accuracy is not None:
            self.record_signal(SIGNAL_ANSWER_ACCURACY, student_accuracy, meta)
        if difficulty_matched is not None:
            if not difficulty_matched:
                self.record_signal(SIGNAL_DIFFICULTY_MISMATCH, 1.0, meta)
        return None

    def record_response_latency(
        self,
        endpoint: str,
        latency_seconds: float,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        meta = dict(metadata or {})
        meta["endpoint"] = endpoint
        return self.record_signal(SIGNAL_RESPONSE_LATENCY, latency_seconds, meta)

    def record_user_rating(
        self,
        rating: int,
        context: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        """Rating 1-5 from the student on an AI response."""
        rating = max(1, min(5, int(rating)))
        meta = dict(metadata or {})
        meta["context"] = context[:300]
        return self.record_signal(SIGNAL_USER_RATING, float(rating), meta)

    def record_hallucination(
        self,
        response_preview: str,
        confidence: float,
        metadata: dict[str, Any] | None = None,
    ) -> str | None:
        meta = dict(metadata or {})
        meta["response_preview"] = response_preview[:200]
        return self.record_signal(SIGNAL_HALLUCINATION, confidence, meta)

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------

    def get_signal_stats(
        self,
        signal_type: str,
        last_n: int = 200,
    ) -> dict[str, Any]:
        """Basic stats for recent signals of a given type."""
        try:
            col = _get_collection()
            cursor = (
                col.find({"signal_type": signal_type})
                .sort("timestamp", -1)
                .limit(last_n)
            )
            vals = [doc["value"] for doc in cursor if "value" in doc]
        except Exception as exc:
            logger.error("get_signal_stats: %s", exc)
            vals = []

        if not vals:
            return {"signal_type": signal_type, "count": 0}
        return {
            "signal_type": signal_type,
            "count": len(vals),
            "mean": round(statistics.mean(vals), 4),
            "median": round(statistics.median(vals), 4),
            "stdev": round(statistics.stdev(vals), 4) if len(vals) > 1 else 0.0,
            "min": round(min(vals), 4),
            "max": round(max(vals), 4),
        }

    def get_topic_accuracy_breakdown(self, last_n: int = 500) -> dict[str, Any]:
        """Accuracy per topic from answer_accuracy signals."""
        try:
            col = _get_collection()
            cursor = (
                col.find({"signal_type": SIGNAL_ANSWER_ACCURACY})
                .sort("timestamp", -1)
                .limit(last_n)
            )
            by_topic: dict[str, list[float]] = {}
            for doc in cursor:
                topic = (doc.get("metadata") or {}).get("topic", "unknown")
                by_topic.setdefault(topic, []).append(float(doc["value"]))
        except Exception as exc:
            logger.error("get_topic_accuracy_breakdown: %s", exc)
            return {}

        breakdown: dict[str, Any] = {}
        for topic, vals in by_topic.items():
            breakdown[topic] = {
                "count": len(vals),
                "mean_accuracy": round(statistics.mean(vals), 4),
            }
        return breakdown

    def get_difficulty_mismatch_rate(self, last_n: int = 300) -> dict[str, Any]:
        """Fraction of recent questions where predicted != claimed difficulty."""
        try:
            col = _get_collection()
            total_q = col.count_documents({"signal_type": SIGNAL_QUESTION_QUALITY})
            mismatches = col.count_documents({"signal_type": SIGNAL_DIFFICULTY_MISMATCH})
        except Exception as exc:
            logger.error("get_difficulty_mismatch_rate: %s", exc)
            return {"mismatch_rate": 0.0, "total": 0, "mismatches": 0}
        rate = mismatches / max(total_q, 1)
        return {
            "mismatch_rate": round(rate, 4),
            "total_questions": total_q,
            "mismatches": mismatches,
        }

    # ------------------------------------------------------------------
    # Recommendations
    # ------------------------------------------------------------------

    def generate_tuning_recommendations(self) -> dict[str, Any]:
        """
        Analyse accumulated signals and produce actionable recommendations
        for prompt engineering, difficulty calibration, and RAG retrieval.
        """
        quality = self.get_signal_stats(SIGNAL_QUESTION_QUALITY)
        accuracy = self.get_signal_stats(SIGNAL_ANSWER_ACCURACY)
        latency = self.get_signal_stats(SIGNAL_RESPONSE_LATENCY)
        ratings = self.get_signal_stats(SIGNAL_USER_RATING)
        mismatch = self.get_difficulty_mismatch_rate()
        topic_acc = self.get_topic_accuracy_breakdown()

        recs: list[dict[str, str]] = []

        # --- Quality ---
        if quality.get("count", 0) > 0 and quality.get("mean", 100) < 70:
            recs.append({
                "area": "prompt_engineering",
                "priority": "high",
                "recommendation": (
                    f"Average question quality is low ({quality['mean']:.1f}/100). "
                    "Review few-shot examples and add stricter constraints in prompts."
                ),
            })

        # --- Accuracy ---
        if accuracy.get("count", 0) > 0:
            mean_acc = accuracy.get("mean", 1.0)
            if mean_acc < 0.4:
                recs.append({
                    "area": "difficulty_calibration",
                    "priority": "high",
                    "recommendation": (
                        f"Student accuracy is very low ({mean_acc:.0%}). "
                        "Consider lowering default difficulty or improving explanations."
                    ),
                })
            elif mean_acc > 0.9:
                recs.append({
                    "area": "difficulty_calibration",
                    "priority": "medium",
                    "recommendation": (
                        f"Student accuracy is very high ({mean_acc:.0%}). "
                        "Increase question difficulty for better learning."
                    ),
                })

        # --- Difficulty mismatch ---
        if mismatch.get("mismatch_rate", 0) > 0.25:
            recs.append({
                "area": "difficulty_calibration",
                "priority": "high",
                "recommendation": (
                    f"Difficulty mismatch rate is {mismatch['mismatch_rate']:.0%}. "
                    "Run DifficultyClassifier on generated questions before serving."
                ),
            })

        # --- Latency ---
        if latency.get("count", 0) > 0 and latency.get("median", 0) > 5.0:
            recs.append({
                "area": "performance",
                "priority": "medium",
                "recommendation": (
                    f"Median AI response latency is {latency['median']:.1f}s. "
                    "Consider caching frequent queries or reducing max_chunks in RAG."
                ),
            })

        # --- User satisfaction ---
        if ratings.get("count", 0) >= 5 and ratings.get("mean", 5) < 3.0:
            recs.append({
                "area": "prompt_engineering",
                "priority": "high",
                "recommendation": (
                    f"Average user rating is {ratings['mean']:.1f}/5. "
                    "Review chatbot tone, add role-play and constraint prompts."
                ),
            })

        # --- Weak topics ---
        weak_topics = [
            t for t, v in topic_acc.items()
            if v["count"] >= 3 and v["mean_accuracy"] < 0.4
        ]
        if weak_topics:
            recs.append({
                "area": "rag_retrieval",
                "priority": "medium",
                "recommendation": (
                    f"Low accuracy on topics: {', '.join(weak_topics[:5])}. "
                    "Check RAG coverage for these topics; consider adding course content."
                ),
            })

        if not recs:
            recs.append({
                "area": "general",
                "priority": "low",
                "recommendation": "All metrics are within healthy ranges. Keep monitoring.",
            })

        return {
            "generated_at": _utcnow(),
            "signal_summary": {
                "question_quality": quality,
                "answer_accuracy": accuracy,
                "response_latency": latency,
                "user_ratings": ratings,
                "difficulty_mismatch": mismatch,
            },
            "topic_accuracy": topic_acc,
            "recommendations": recs,
        }

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def purge_old_signals(self, days: int = 90) -> int:
        """Delete feedback signals older than `days`."""
        cutoff = datetime.now(timezone.utc).isoformat()
        # Rough ISO cutoff
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        try:
            col = _get_collection()
            result = col.delete_many({"timestamp": {"$lt": cutoff}})
            deleted = result.deleted_count
            logger.info("purge_old_signals: removed %d records older than %d days", deleted, days)
            return deleted
        except Exception as exc:
            logger.error("purge_old_signals: %s", exc)
            return 0


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def _demo() -> None:
    import json

    fl = AIFeedbackLoop()

    print("=" * 60)
    print("  Recording sample signals")
    print("=" * 60)
    fl.record_signal(SIGNAL_QUESTION_QUALITY, 85.0, {"topic": "loops", "subject": "Programming"})
    fl.record_signal(SIGNAL_QUESTION_QUALITY, 62.0, {"topic": "recursion", "subject": "Programming"})
    fl.record_signal(SIGNAL_ANSWER_ACCURACY, 1.0, {"topic": "loops"})
    fl.record_signal(SIGNAL_ANSWER_ACCURACY, 0.0, {"topic": "recursion"})
    fl.record_signal(SIGNAL_ANSWER_ACCURACY, 0.0, {"topic": "recursion"})
    fl.record_signal(SIGNAL_ANSWER_ACCURACY, 1.0, {"topic": "loops"})
    fl.record_response_latency("/chatbot/ask", 2.3)
    fl.record_response_latency("/brainrush/generate-question", 4.8)
    fl.record_user_rating(4, "good explanation")
    fl.record_user_rating(2, "answer was confusing")
    fl.record_hallucination("The capital of France is Berlin", 0.9)
    fl.record_question_feedback(
        {"question": "What is recursion?", "topic": "recursion", "difficulty": "medium"},
        quality_score=55.0,
        student_accuracy=0.3,
        difficulty_matched=False,
    )
    print("Signals recorded.\n")

    print("=" * 60)
    print("  Signal stats")
    print("=" * 60)
    for sig in [SIGNAL_QUESTION_QUALITY, SIGNAL_ANSWER_ACCURACY, SIGNAL_RESPONSE_LATENCY, SIGNAL_USER_RATING]:
        stats = fl.get_signal_stats(sig, last_n=50)
        print(f"  {sig}: count={stats.get('count', 0)}  mean={stats.get('mean', '-')}")

    print("\n" + "=" * 60)
    print("  Topic accuracy breakdown")
    print("=" * 60)
    ta = fl.get_topic_accuracy_breakdown()
    for topic, info in ta.items():
        print(f"  {topic}: {info}")

    print("\n" + "=" * 60)
    print("  Difficulty mismatch rate")
    print("=" * 60)
    dm = fl.get_difficulty_mismatch_rate()
    print(f"  {dm}")

    print("\n" + "=" * 60)
    print("  Tuning recommendations")
    print("=" * 60)
    report = fl.generate_tuning_recommendations()
    for rec in report["recommendations"]:
        print(f"  [{rec['priority'].upper()}] {rec['area']}: {rec['recommendation']}")


if __name__ == "__main__":
    _demo()
