"""Unit tests for recommendation ranking v2."""
from __future__ import annotations

from recommendation.continuous_recommender import ContinuousRecommender


def test_recommendations_have_rank_fields():
    rec = ContinuousRecommender()
    state = {
        "concept_mastery": {
            "variables": 75.0,
            "data_types": 72.0,
            "operations": 68.0,
            "control_flow": 40.0,
            "loops": 35.0,
        },
        "weaknesses": ["loops", "functions"],
        "pace_mode": "normal",
        "confidence_score": 0.7,
        "recent_scores": [52, 61, 70, 76],
    }
    out = rec.recommend(state, n_results=6)
    assert len(out) >= 3
    for i, r in enumerate(out, start=1):
        assert r["priority"] == i
        assert "utility_score" in r
        assert "estimated_gain" in r
        assert "estimated_effort_hours" in r
        assert "success_probability" in r


def test_prerequisite_repair_emitted_when_blocked():
    rec = ContinuousRecommender()
    state = {
        "concept_mastery": {
            "variables": 80.0,
            "data_types": 80.0,
            "operations": 20.0,  # blocks control_flow -> loops -> functions
            "control_flow": 10.0,
            "loops": 0.0,
        },
        "weaknesses": ["control_flow"],
        "pace_mode": "slow",
        "confidence_score": 0.4,
        "recent_scores": [30, 32],
    }
    out = rec.recommend(state, n_results=10)
    assert any(r.get("type") == "prerequisite_repair" for r in out)
