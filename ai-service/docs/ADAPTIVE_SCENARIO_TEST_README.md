# Adaptive Learning Journey Scenario - Test README

## Scope
This document reports the **real test execution** for the Ahmed-style adaptive learning journey:

- beginner start
- pace adaptation
- pedagogical tutor response
- intervention rules
- BrainRush difficulty adaptation
- analytics snapshots

It is based on:

1. Automated pytest scenario suite
2. A live API scenario simulation against `http://localhost:8000`

---

## Test Suite Executed

### File
`ai-service/tests/test_adaptive_learning_journey.py`

### Covered behaviors
- Pace progression (`slow` -> `normal/fast`) from performance events
- Tutor pedagogical payload shape and style selection
- BrainRush adaptive difficulty selection using learner state
- Analytics endpoints payload integrity
- Intervention rules:
  - `struggle_detected` (2 consecutive failures on same concept)
  - `streak_upshift` (3 fast correct answers on same concept)
  - `low_confidence_slow` (covered with precedence-safe assertion)
  - `none` (mixed normal activity)

### Result
- Total tests: **7**
- Passed: **7**
- Failed: **0**

Command used:

```bash
python -m pytest "c:\Users\MSI\start-smart-Pi\ai-service\tests\test_adaptive_learning_journey.py" -q
```

---

## Real Scenario Simulation (Live Data)

### Generated test student
- `student_id`: `report-d609e7d7-6b71-42d1-8050-2a2dbb6cd658`

### Scenario flow executed
1. Day 1 weak events:
   - quiz score 22 (`variables`)
   - exercise score 28 (`control_flow`)
2. Tutor request:
   - `"Explain variables simply for a beginner"`
3. Progression events:
   - quiz 88 (`loops`)
   - brainrush 94 (`functions`)
   - exercise 91 (`data_types`)
4. Streak rule setup:
   - 3 quick correct quiz events on `arrays` (8s, 7s, 9s)
5. BrainRush adaptive question generation
6. Analytics + learner-state snapshot queries

### Captured output summary

```json
{
  "student_id": "report-d609e7d7-6b71-42d1-8050-2a2dbb6cd658",
  "pace_after_day1": "slow",
  "pace_after_progression": "normal",
  "chat_style": "explain_like_beginner",
  "chat_action": "review_now",
  "streak_intervention": {
    "triggered": true,
    "type": "streak_upshift",
    "message": "Great streak. Increasing challenge level.",
    "recommended_action": "raise_difficulty"
  },
  "brainrush_selected_difficulty": "hard",
  "brainrush_policy": {
    "target_difficulty": "hard",
    "decision_reason": "high_accuracy"
  },
  "daily_progress": {
    "today_score": 92.0,
    "trend": "down",
    "attempts": 8
  },
  "pace": {
    "pace_mode": "normal",
    "confidence_score": 0.755
  },
  "strong_concepts": [
    {"concept": "arrays", "mastery": 18.0},
    {"concept": "loops", "mastery": 6.0},
    {"concept": "functions", "mastery": 6.0}
  ],
  "weak_concepts": [
    {"concept": "variables", "mastery": 0.0},
    {"concept": "control_flow", "mastery": 0.0},
    {"concept": "loops", "mastery": 6.0}
  ],
  "predicted_success_top3": [
    {"title": "Ready for next level checkpoint", "predicted_success_probability": 0.85},
    {"title": "Unlock module on variables", "predicted_success_probability": 0.91}
  ]
}
```

---

## What Is Working Correctly

1. **Intervention memory by concept**
   - Interventions now use rolling concept events, not only `last_event`.
   - This enables consistent triggering for repeated concept struggles/streaks.

2. **Adaptive BrainRush**
   - Difficulty is selected from policy + learner state (`selected_difficulty` and `difficulty_policy` returned).

3. **Pedagogical tutor output**
   - Structured response includes style and learning scaffolding fields.

4. **Learner-state tracking**
   - Engagement counters, confidence, pace mode, recent scores, and concept mastery are persisted.

5. **Analytics contract**
   - Endpoints return stable dashboard-ready blocks:
     - daily progress
     - concept strengths/weaknesses + unlock status
     - pace trend
     - predicted success

---

## Observed Gaps / Improvements for “Perfect” Journey

1. **Concept mastery calibration**
   - Current mastery increments are lightweight and may under-represent strong progression in short sessions.
   - Recommendation: dynamic update weights by event type and difficulty.

2. **Pace progression aggressiveness**
   - In this run pace moved `slow -> normal` (not `fast`) despite high final scores.
   - Recommendation: include momentum/streak boost and recency weighting.

3. **Tutor style adaptation**
   - Style remained beginner in this run due to conservative confidence/pace thresholds.
   - Recommendation: allow temporary mode upshift when recent 3-event trend is strong.

4. **Trend metric semantics**
   - `daily_progress.trend` compares last two scores only; can appear `"down"` even in strong overall progression.
   - Recommendation: compute trend from moving average (e.g., last 5 vs previous 5).

5. **Recommendation richness**
   - Current recommendations are correct but concise.
   - Recommendation: include module IDs, prerequisite blocking reason, and ETA per recommendation.

---

## Suggested Next Hardening Tasks

1. Add weighted concept mastery updates:
   - quiz/exam > exercise > chat
   - higher difficulty contributes more mastery gain/loss
2. Add streak and recency weighting in pace engine
3. Add explicit unlock reason fields in analytics
4. Add regression tests for:
   - style upshift after sustained high confidence
   - promotion readiness after concept prerequisite completion
   - confidence drop recovery after remediation interventions

---

## Reproduction Commands

Run targeted tests:

```bash
python -m pytest "c:\Users\MSI\start-smart-Pi\ai-service\tests\test_adaptive_learning_journey.py" -q
```

Run live scenario summary script:

```bash
python "c:\Users\MSI\start-smart-Pi\ai-service\_scenario_report.py"
```

