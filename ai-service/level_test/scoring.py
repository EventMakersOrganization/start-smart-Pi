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


# Difficulty weights for mastery computation
_DIFF_WEIGHT = {"easy": 1.0, "medium": 1.5, "hard": 2.0}

_LEVEL_THRESHOLDS = {
    "beginner": (0, 39),
    "intermediate": (40, 69),
    "advanced": (70, 100),
}


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
        m["course_id"] = key
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

    recommendations = _build_recommendations(subject_results, level)

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
        "recommendations": recommendations,
    }


def _build_recommendations(
    subject_results: list[dict],
    overall_level: str,
) -> list[dict[str, Any]]:
    """
    Produce an ordered list of study recommendations.

    Priority:
      1. Weakest subjects first (mastery < 40)  → "Review urgently"
      2. Medium subjects (40-59)                 → "Practice more"
      3. Strong subjects (60-79)                 → "Challenge yourself"
      4. Very strong (80+)                       → "Maintain / explore advanced"
    """
    recs: list[dict[str, Any]] = []

    for s in sorted(subject_results, key=lambda x: x["mastery_score"]):
        m = s["mastery_score"]
        title = s["title"]
        weak_topics = s.get("topics_incorrect", [])

        if m < 40:
            recs.append({
                "subject": title,
                "priority": "high",
                "action": "Review urgently",
                "mastery": m,
                "focus_topics": weak_topics,
                "suggested_difficulty": "easy",
                "success_probability": round(0.3 + m / 200, 2),
            })
        elif m < 60:
            recs.append({
                "subject": title,
                "priority": "medium",
                "action": "Practice more exercises",
                "mastery": m,
                "focus_topics": weak_topics,
                "suggested_difficulty": "medium",
                "success_probability": round(0.5 + m / 250, 2),
            })
        elif m < 80:
            recs.append({
                "subject": title,
                "priority": "low",
                "action": "Challenge yourself with harder problems",
                "mastery": m,
                "focus_topics": [],
                "suggested_difficulty": "hard",
                "success_probability": round(0.6 + m / 300, 2),
            })
        else:
            recs.append({
                "subject": title,
                "priority": "optional",
                "action": "Explore advanced topics or mentor others",
                "mastery": m,
                "focus_topics": [],
                "suggested_difficulty": "hard",
                "success_probability": round(0.8 + m / 500, 2),
            })

    return recs
