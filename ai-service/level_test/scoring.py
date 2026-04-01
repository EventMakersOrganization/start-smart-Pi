"""
Scoring and profile generation for the adaptive level test.

Takes a completed (or in-progress) session and produces:
* per-subject mastery score  (0-100)
* per-subject difficulty reached
* strengths / weaknesses
* overall level  ("beginner" / "intermediate" / "advanced")
* learning-path recommendations ordered by priority
"""
from __future__ import annotations

import statistics
import sys
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from learning_state.concept_mastery_graph import get_unlock_status


# Difficulty weights for mastery computation
_DIFF_WEIGHT = {"easy": 1.0, "medium": 1.5, "hard": 2.0}

_LEVEL_THRESHOLDS = {
    "beginner": (0, 39),
    "intermediate": (40, 69),
    "advanced": (70, 100),
}


def _norm_topic(topic: str) -> str:
    return str(topic or "").strip().lower().replace(" ", "_")


def compute_subject_mastery(subject_data: dict) -> dict[str, Any]:
    """
    Compute mastery for a single subject (course / chapter).

    Args:
        subject_data: The per-subject dict from the session document,
                      containing ``answers``, ``title``, etc.

    Returns:
        ``{mastery_score, correct, total, difficulty_reached,
           topics_correct, topics_incorrect, accuracy}``
    """
    answers: list[dict] = subject_data.get("answers", [])
    answered = [a for a in answers if a.get("answered")]

    if not answered:
        return {
            "mastery_score": 0.0,
            "correct": 0,
            "total": 0,
            "difficulty_reached": "medium",
            "topics_correct": [],
            "topics_incorrect": [],
            "accuracy": 0.0,
        }

    total_weight = 0.0
    earned_weight = 0.0
    correct_count = 0
    topics_correct: list[str] = []
    topics_incorrect: list[str] = []

    for a in answered:
        diff = a.get("difficulty", "medium")
        w = _DIFF_WEIGHT.get(diff, 1.0)
        total_weight += w
        if a.get("is_correct"):
            earned_weight += w
            correct_count += 1
            topics_correct.append(a.get("topic", ""))
        else:
            topics_incorrect.append(a.get("topic", ""))

    mastery = round((earned_weight / total_weight) * 100, 2) if total_weight else 0.0

    last_diff = answered[-1].get("difficulty", "medium")

    return {
        "mastery_score": mastery,
        "correct": correct_count,
        "total": len(answered),
        "difficulty_reached": last_diff,
        "topics_correct": topics_correct,
        "topics_incorrect": topics_incorrect,
        "accuracy": round(correct_count / len(answered), 4),
    }


def compute_topic_mastery(session: dict[str, Any]) -> dict[str, float]:
    """
    Compute per-topic mastery from answered level-test questions.
    """
    subjects_state: dict[str, dict] = session.get("subjects", {}) or {}
    per_topic: dict[str, dict[str, float]] = {}

    for subj in subjects_state.values():
        answers = [a for a in (subj.get("answers", []) or []) if a.get("answered")]
        for a in answers:
            topic_key = _norm_topic(a.get("topic", ""))
            if not topic_key:
                continue
            diff = str(a.get("difficulty", "medium")).lower()
            w = float(_DIFF_WEIGHT.get(diff, 1.0))
            row = per_topic.setdefault(topic_key, {"earned": 0.0, "total": 0.0})
            row["total"] += w
            if a.get("is_correct"):
                row["earned"] += w

    concept_mastery: dict[str, float] = {}
    for key, row in per_topic.items():
        total = float(row.get("total", 0.0))
        earned = float(row.get("earned", 0.0))
        concept_mastery[key] = round((earned / total) * 100.0, 2) if total else 0.0
    return concept_mastery


def _classify_level(score: float) -> str:
    for level, (lo, hi) in _LEVEL_THRESHOLDS.items():
        if lo <= score <= hi:
            return level
    return "intermediate"


def generate_student_profile(session: dict) -> dict[str, Any]:
    """
    Build a full student profile from a completed level-test session.

    Args:
        session: The full session document from MongoDB.

    Returns:
        ``{student_id, overall_level, overall_mastery,
           subjects (list), strengths, weaknesses,
           recommendations (list)}``
    """
    student_id = session.get("student_id", "")
    subjects_state: dict[str, dict] = session.get("subjects", {})

    subject_results: list[dict[str, Any]] = []
    mastery_scores: list[float] = []

    for key, subj in subjects_state.items():
        m = compute_subject_mastery(subj)
        m["subject_key"] = key
        m["course_id"] = subj.get("course_id") or key
        m["course_ids"] = subj.get("course_ids") or []
        m["title"] = subj.get("title", "")
        subject_results.append(m)
        mastery_scores.append(m["mastery_score"])

    overall = round(statistics.mean(mastery_scores), 2) if mastery_scores else 0.0
    level = _classify_level(overall)

    strengths = sorted(
        [s for s in subject_results if s["mastery_score"] >= 60],
        key=lambda x: x["mastery_score"],
        reverse=True,
    )
    weaknesses = sorted(
        [s for s in subject_results if s["mastery_score"] < 60],
        key=lambda x: x["mastery_score"],
    )

    concept_mastery = compute_topic_mastery(session)
    recommendations = _build_recommendations(subject_results, level, concept_mastery)

    return {
        "student_id": student_id,
        "overall_level": level,
        "overall_mastery": overall,
        "subjects": subject_results,
        "strengths": [
            {"title": s["title"], "mastery": s["mastery_score"]}
            for s in strengths
        ],
        "weaknesses": [
            {"title": s["title"], "mastery": s["mastery_score"]}
            for s in weaknesses
        ],
        "concept_mastery": concept_mastery,
        "recommendations": recommendations,
    }


def _build_recommendations(
    subject_results: list[dict],
    overall_level: str,
    concept_mastery: dict[str, float] | None = None,
) -> list[dict[str, Any]]:
    """
    Produce an ordered list of study recommendations.

    Priority:
      1. Weakest subjects first (mastery < 40)  → "Review urgently"
      2. Medium subjects (40-59)                 → "Practice more"
      3. Strong subjects (60-79)                 → "Challenge yourself"
      4. Very strong (80+)                       → "Maintain / explore advanced"
    """
    mastery = concept_mastery or {}
    unlock = get_unlock_status(mastery)
    blocked_by = unlock.get("blocked_by", {}) or {}

    level_bias = {"beginner": -0.05, "intermediate": 0.0, "advanced": 0.05}.get(overall_level, 0.0)
    effort_by_type = {
        "targeted_exercise": 2.0,
        "retry_easier_variant": 1.5,
        "promotion_ready": 3.0,
        "prerequisite_repair": 2.0,
    }
    gain_by_type = {
        "targeted_exercise": 14.0,
        "retry_easier_variant": 12.0,
        "promotion_ready": 16.0,
        "prerequisite_repair": 13.0,
    }
    action_by_type = {
        "targeted_exercise": "Targeted practice on weak concepts",
        "retry_easier_variant": "Retry with easier guided exercises",
        "promotion_ready": "Advance to the next challenge level",
        "prerequisite_repair": "Repair missing prerequisites first",
    }
    difficulty_by_type = {
        "targeted_exercise": "medium",
        "retry_easier_variant": "easy",
        "promotion_ready": "hard",
        "prerequisite_repair": "easy",
    }
    priority_by_type = {
        "prerequisite_repair": "high",
        "targeted_exercise": "high",
        "retry_easier_variant": "medium",
        "promotion_ready": "low",
    }

    ranked: list[dict[str, Any]] = []
    for s in subject_results:
        m = float(s.get("mastery_score", 0.0))
        title = s.get("title", "")
        weak_topics = list(s.get("topics_incorrect", []) or [])
        weak_norm = [_norm_topic(t) for t in weak_topics if _norm_topic(t)]

        weak_vals = [float(mastery.get(k, m)) for k in weak_norm] if weak_norm else [m]
        weak_mastery_avg = sum(weak_vals) / max(len(weak_vals), 1)

        if any(t in blocked_by for t in weak_norm):
            rec_type = "prerequisite_repair"
        elif weak_mastery_avg < 40.0:
            rec_type = "targeted_exercise"
        elif weak_mastery_avg < 60.0:
            rec_type = "retry_easier_variant"
        else:
            rec_type = "promotion_ready"

        effort = float(effort_by_type[rec_type])
        gain = float(gain_by_type[rec_type])
        base_prob = max(0.3, min(0.95, 0.35 + (weak_mastery_avg / 100.0) * 0.5 + level_bias))
        success_probability = round(base_prob, 2)
        utility = (gain * success_probability) / max(effort, 0.5)

        ranked.append({
            "subject": title,
            "priority": priority_by_type[rec_type],
            "action": action_by_type[rec_type],
            "mastery": round(m, 2),
            "focus_topics": weak_topics,
            "suggested_difficulty": difficulty_by_type[rec_type],
            "success_probability": success_probability,
            "_utility": round(utility, 5),
        })

    ranked.sort(key=lambda x: (-float(x.get("_utility", 0.0)), float(x.get("mastery", 0.0))))
    for row in ranked:
        row.pop("_utility", None)
    return ranked
