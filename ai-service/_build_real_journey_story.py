from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from uuid import uuid4

import httpx

BASE = "http://localhost:8000"
OUT = Path(__file__).resolve().parent / "docs" / "REAL_AHMED_JOURNEY_TEST.md"
MAX_SUBJECTS = 2


def post(path: str, payload: dict, timeout: float = 180.0) -> dict:
    r = httpx.post(f"{BASE}{path}", json=payload, timeout=timeout)
    r.raise_for_status()
    return r.json()


def get(path: str, timeout: float = 120.0) -> dict:
    r = httpx.get(f"{BASE}{path}", timeout=timeout)
    r.raise_for_status()
    return r.json()


def safe_wrong_answer(options: list[str], correct: str) -> str:
    if not options:
        return "B"
    for op in options:
        if str(op).strip().lower() != str(correct).strip().lower():
            return op
    return options[-1]


def main() -> None:
    student_id = f"ahmed-real-{uuid4()}"
    now = datetime.now().strftime("%Y-%m-%d %H:%M")

    print("[1/8] Fetching available courses...")
    # Faster real run: limit subjects so you get output quickly.
    import sys
    _root = Path(__file__).resolve().parent
    if str(_root) not in sys.path:
        sys.path.insert(0, str(_root))
    from core.db_connection import get_all_courses

    courses = get_all_courses()
    selected_subjects = [c.get("id") for c in courses[:MAX_SUBJECTS] if c.get("id")]
    print(f"[2/8] Starting level test with {len(selected_subjects)} subject(s)...")
    start = post("/level-test/start", {"student_id": student_id, "subjects": selected_subjects}, timeout=300.0)
    session_id = start["session_id"]
    first_q = start["first_question"]
    total_questions = int(start["total_questions"])
    subjects = start.get("subjects", [])

    # 2) Force a weak beginner trajectory by mostly answering wrong.
    timeline: list[dict] = []
    q = first_q
    completed_payload = None

    print(f"[3/8] Answering {total_questions} generated questions...")
    for i in range(total_questions):
        # We do not know correct answer in this payload, submit deliberate wrong-ish answer.
        options = q.get("options", [])
        ans = options[-1] if options else "B"
        submit = post("/level-test/submit-answer", {"session_id": session_id, "answer": ans}, timeout=180.0)
        timeline.append(
            {
                "index": i + 1,
                "subject": (q.get("subject") or ""),
                "topic": (q.get("topic") or ""),
                "difficulty": (q.get("difficulty") or ""),
                "question": (q.get("question") or ""),
                "options": options,
                "submitted_answer": ans,
                "correct": submit.get("correct"),
                "correct_answer": submit.get("correct_answer"),
                "next_difficulty": submit.get("next_difficulty"),
                "difficulty_policy": submit.get("difficulty_policy"),
                "intervention": submit.get("intervention"),
            }
        )
        if submit.get("finished"):
            completed_payload = submit
            break
        q = submit.get("next_question") or {}

    if not completed_payload:
        completed_payload = post("/level-test/complete", {"session_id": session_id}, timeout=180.0)
        profile = completed_payload["profile"]
        learning_state = completed_payload.get("learning_state", {})
    else:
        profile = completed_payload.get("profile", {})
        learning_state = completed_payload.get("learning_state", {})

    print("[4/8] Running tutor interaction...")
    # 3) Real tutor interaction
    tutor = post(
        "/chatbot/ask",
        {
            "question": "Explain variables in a very simple and fun way for a complete beginner.",
            "conversation_history": [],
            "student_id": student_id,
        },
        timeout=240.0,
    )

    print("[5/8] Generating BrainRush content...")
    # 4) Real BrainRush content
    brainrush_q = post(
        "/brainrush/generate-question",
        {
            "subject": "Programmation",
            "difficulty": "medium",
            "topic": "variables",
            "question_type": "MCQ",
            "student_id": student_id,
        },
        timeout=180.0,
    )

    brainrush_session = post(
        "/brainrush/generate-session",
        {
            "subject": "Programmation",
            "difficulty": "medium",
            "num_questions": 5,
            "student_id": student_id,
        },
        timeout=240.0,
    )

    print("[6/8] Recording progress events...")
    # 5) Real progress events
    progress_events = []
    progress_events.append(
        post(
            "/learning-state/event",
            {
                "student_id": student_id,
                "event_type": "quiz",
                "score": 55,
                "duration_sec": 900,
                "metadata": {"concept": "variables", "is_correct": True},
            },
        )
    )
    progress_events.append(
        post(
            "/learning-state/event",
            {
                "student_id": student_id,
                "event_type": "exercise",
                "score": 72,
                "duration_sec": 1500,
                "metadata": {"concept": "loops", "is_correct": True},
            },
        )
    )
    progress_events.append(
        post(
            "/learning-state/event",
            {
                "student_id": student_id,
                "event_type": "brainrush",
                "score": 89,
                "duration_sec": 800,
                "metadata": {"concept": "control_flow", "is_correct": True},
            },
        )
    )

    print("[7/8] Collecting analytics snapshots...")
    analytics = get(f"/analytics/learning/{student_id}")
    pace = get(f"/analytics/pace/{student_id}")
    concepts = get(f"/analytics/concepts/{student_id}")
    state = get(f"/learning-state/{student_id}")

    # Build story markdown with real data
    lines: list[str] = []
    lines.append("# COMPLETE STUDENT LEARNING JOURNEY - Real AI Test Run")
    lines.append("")
    lines.append(f"- Generated at: `{now}`")
    lines.append(f"- Student id: `{student_id}`")
    lines.append(f"- Level-test session id: `{session_id}`")
    lines.append("")
    lines.append("## 1) Level Test (Real Data)")
    lines.append(f"- Subjects tested: **{len(subjects)}**")
    lines.append(f"- Total questions: **{total_questions}**")
    lines.append(f"- Overall level: **{profile.get('overall_level', 'n/a')}**")
    lines.append(f"- Overall mastery: **{profile.get('overall_mastery', 'n/a')}%**")
    lines.append("")
    lines.append("### Sample Real Questions/Answers From This Run")
    for row in timeline[:6]:
        lines.append(f"**Q{row['index']} - {row['subject']} ({row['difficulty']})**")
        lines.append(f"- Topic: `{row['topic']}`")
        lines.append(f"- Question: {row['question']}")
        if row["options"]:
            for j, op in enumerate(row["options"], start=1):
                lines.append(f"  - Option {j}: {op}")
        lines.append(f"- Submitted answer: `{row['submitted_answer']}`")
        lines.append(f"- Correct: **{row['correct']}** (correct answer: `{row['correct_answer']}`)")
        pol = row.get("difficulty_policy") or {}
        lines.append(
            f"- Adaptation: next_difficulty=`{row['next_difficulty']}`, "
            f"policy_target=`{pol.get('target_difficulty')}`, reason=`{pol.get('decision_reason')}`"
        )
        intr = row.get("intervention") or {}
        lines.append(f"- Intervention: triggered=`{intr.get('triggered')}`, type=`{intr.get('type')}`")
        lines.append("")

    lines.append("## 2) Tutor Interaction (Real Data)")
    ped = tutor.get("pedagogical_response", {})
    lines.append(f"- Tutor style selected: **{ped.get('style')}**")
    lines.append(f"- Pace decision action: **{(tutor.get('pace_decision') or {}).get('action')}**")
    lines.append(f"- Main answer: {tutor.get('answer', '')[:600]}")
    lines.append(f"- Pedagogical simple explanation: {ped.get('simple_explanation', '')[:600]}")
    lines.append(f"- Mini example: {ped.get('mini_example', '')}")
    lines.append(f"- Quick check: {ped.get('quick_check_question', '')}")
    lines.append(f"- Next action: {ped.get('next_action', '')}")
    lines.append("")

    lines.append("## 3) BrainRush (Real Generated Content)")
    q1 = brainrush_q.get("question", {})
    lines.append(f"- Selected difficulty: **{brainrush_q.get('selected_difficulty')}**")
    lines.append(f"- Policy: `{json.dumps(brainrush_q.get('difficulty_policy', {}), ensure_ascii=False)}`")
    lines.append(f"- Question type: `{q1.get('type')}`")
    lines.append(f"- Question: {q1.get('question')}")
    lines.append(f"- Correct answer: `{q1.get('correct_answer')}`")
    lines.append(f"- Validation confidence: `{q1.get('validation_confidence')}`")
    lines.append("")
    lines.append("### BrainRush Session (5 Real Questions)")
    for i, qq in enumerate(brainrush_session.get("questions", [])[:5], start=1):
        lines.append(f"- Q{i} [{qq.get('difficulty')}/{qq.get('type')}]: {qq.get('question')}")
    lines.append("")

    lines.append("## 4) Learning Progress Events (Real)")
    for i, ev in enumerate(progress_events, start=1):
        st = ev.get("learning_state", {})
        lines.append(
            f"- Event {i}: pace=`{st.get('pace_mode')}`, confidence=`{st.get('confidence_score')}`, "
            f"intervention=`{(ev.get('intervention') or {}).get('type')}`, action=`{(ev.get('pace_decision') or {}).get('action')}`"
        )
    lines.append("")

    lines.append("## 5) Analytics Snapshot (Real)")
    lines.append(f"- Daily progress: `{json.dumps(analytics.get('daily_progress', {}), ensure_ascii=False)}`")
    lines.append(f"- Pace trend: `{json.dumps(pace, ensure_ascii=False)}`")
    lines.append(f"- Concepts strong/weak: `{json.dumps(concepts, ensure_ascii=False)[:1200]}...`")
    lines.append(f"- Predicted success: `{json.dumps(analytics.get('predicted_success', []), ensure_ascii=False)}`")
    lines.append("")

    lines.append("## 6) Current Learner State (Real)")
    lines.append("```json")
    lines.append(json.dumps(state.get("learning_state", {}), ensure_ascii=False, indent=2)[:6000])
    lines.append("```")
    lines.append("")
    lines.append("## Notes")
    lines.append("- This file is generated from live API calls, not mocked data.")
    lines.append("- The question text/options/decisions above are exactly what the AI service returned in this run.")

    print("[8/8] Writing markdown report...")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(str(OUT))


if __name__ == "__main__":
    main()
