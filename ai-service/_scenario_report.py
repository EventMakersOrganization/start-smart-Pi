import json
import uuid

import httpx

BASE = "http://localhost:8000"
student = f"report-{uuid.uuid4()}"
out = {"student_id": student}


def post(path, payload, timeout=120):
    r = httpx.post(BASE + path, json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json()


def get(path, timeout=120):
    r = httpx.get(BASE + path, timeout=timeout)
    r.raise_for_status()
    return r.json()


out["day1_e1"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "quiz",
        "score": 22,
        "duration_sec": 680,
        "metadata": {"concept": "variables", "is_correct": False},
    },
)
out["day1_e2"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "exercise",
        "score": 28,
        "duration_sec": 620,
        "metadata": {"concept": "control_flow", "is_correct": False},
    },
)

out["chat"] = post(
    "/chatbot/ask",
    {"question": "Explain variables simply for a beginner", "conversation_history": [], "student_id": student},
    timeout=180,
)

out["day3_e1"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "quiz",
        "score": 88,
        "duration_sec": 230,
        "metadata": {"concept": "loops", "is_correct": True},
    },
)
out["day4_e1"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "brainrush",
        "score": 94,
        "duration_sec": 210,
        "metadata": {"concept": "functions", "is_correct": True},
    },
)
out["day5_e1"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "exercise",
        "score": 91,
        "duration_sec": 190,
        "metadata": {"concept": "data_types", "is_correct": True},
    },
)

post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "quiz",
        "score": 96,
        "duration_sec": 8,
        "metadata": {"concept": "arrays", "is_correct": True},
    },
)
post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "quiz",
        "score": 93,
        "duration_sec": 7,
        "metadata": {"concept": "arrays", "is_correct": True},
    },
)
out["streak_rule"] = post(
    "/learning-state/event",
    {
        "student_id": student,
        "event_type": "quiz",
        "score": 92,
        "duration_sec": 9,
        "metadata": {"concept": "arrays", "is_correct": True},
    },
)

out["brainrush_q"] = post(
    "/brainrush/generate-question",
    {
        "subject": "Programmation",
        "difficulty": "medium",
        "topic": "variables",
        "question_type": "MCQ",
        "student_id": student,
    },
    timeout=180,
)

out["analytics_learning"] = get(f"/analytics/learning/{student}")
out["analytics_pace"] = get(f"/analytics/pace/{student}")
out["analytics_concepts"] = get(f"/analytics/concepts/{student}")
out["learning_state"] = get(f"/learning-state/{student}")

summary = {
    "student_id": student,
    "pace_after_day1": out["day1_e2"].get("learning_state", {}).get("pace_mode"),
    "pace_after_progression": out["day5_e1"].get("learning_state", {}).get("pace_mode"),
    "chat_style": out["chat"].get("pedagogical_response", {}).get("style"),
    "chat_action": out["chat"].get("pace_decision", {}).get("action"),
    "streak_intervention": out["streak_rule"].get("intervention", {}),
    "brainrush_selected_difficulty": out["brainrush_q"].get("selected_difficulty"),
    "brainrush_policy": out["brainrush_q"].get("difficulty_policy"),
    "daily_progress": out["analytics_learning"].get("daily_progress"),
    "pace": out["analytics_learning"].get("pace"),
    "strong_concepts": out["analytics_learning"].get("concepts", {}).get("strong_concepts", [])[:3],
    "weak_concepts": out["analytics_learning"].get("concepts", {}).get("weak_concepts", [])[:3],
    "predicted_success_top3": out["analytics_learning"].get("predicted_success", [])[:3],
}
print(json.dumps(summary, indent=2, ensure_ascii=False))
