"""
End-to-end test for the Adaptive Level Test Engine.

Runs a full lifecycle against the live API server (http://localhost:8000):
  1. Start a level test with all 8 C-programming chapters
  2. Submit answers for every question (auto-answer)
  3. Complete the test, validate the student profile
  4. Call personalised recommendations
"""
import sys
from pathlib import Path

import httpx
import pytest

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

BASE = "http://localhost:8000"
TIMEOUT = 120.0


def _api_reachable() -> bool:
    try:
        r = httpx.get(f"{BASE}/health", timeout=5)
        return r.status_code == 200
    except Exception:
        return False


_needs_api = pytest.mark.skipif(
    not _api_reachable(),
    reason="AI service not running at localhost:8000",
)


@_needs_api
class TestAdaptiveLevelTestE2E:
    """Full adaptive level test lifecycle."""

    def test_full_lifecycle(self):
        # 1. Start test
        start_resp = httpx.post(
            f"{BASE}/level-test/start",
            json={"student_id": "e2e-test-student-001"},
            timeout=TIMEOUT,
        )
        assert start_resp.status_code == 200, f"Start failed: {start_resp.text}"
        start = start_resp.json()
        assert start["status"] == "success"
        session_id = start["session_id"]
        assert session_id
        subjects = start["subjects"]
        assert len(subjects) >= 1
        total_questions = start["total_questions"]
        assert total_questions > 0

        first_q = start["first_question"]
        assert "question" in first_q
        assert "options" in first_q
        assert "difficulty" in first_q

        print(f"\n[START] session={session_id}, subjects={len(subjects)}, total_q={total_questions}")
        print(f"  First Q: {first_q['question'][:80]}...")
        print(f"  Difficulty: {first_q['difficulty']}, Topic: {first_q.get('topic','')}")

        # 2. Submit answers for every question
        answered = 0
        current_options = first_q.get("options", [])
        finished = False
        profile = None

        for i in range(total_questions):
            answer = current_options[0] if current_options else "A"
            submit_resp = httpx.post(
                f"{BASE}/level-test/submit-answer",
                json={"session_id": session_id, "answer": answer},
                timeout=TIMEOUT,
            )
            assert submit_resp.status_code == 200, f"Submit #{i} failed: {submit_resp.text}"
            result = submit_resp.json()
            assert "correct" in result
            answered += 1

            print(f"  [{i+1}/{total_questions}] correct={result['correct']}, "
                  f"next_diff={result.get('next_difficulty','')}")

            if result.get("finished"):
                profile = result.get("profile")
                finished = True
                break

            next_q = result.get("next_question")
            if next_q:
                current_options = next_q.get("options", [])
            else:
                break

        print(f"  Answered: {answered}")

        # 3. If not auto-finished, complete explicitly
        if not finished:
            complete_resp = httpx.post(
                f"{BASE}/level-test/complete",
                json={"session_id": session_id},
                timeout=TIMEOUT,
            )
            assert complete_resp.status_code == 200, f"Complete failed: {complete_resp.text}"
            profile = complete_resp.json().get("profile")

        assert profile is not None
        assert "overall_level" in profile
        assert "overall_mastery" in profile
        assert "subjects" in profile
        assert "strengths" in profile
        assert "weaknesses" in profile
        assert "recommendations" in profile
        assert profile["overall_level"] in ("beginner", "intermediate", "advanced")
        assert 0 <= profile["overall_mastery"] <= 100

        print(f"\n[PROFILE]")
        print(f"  Level: {profile['overall_level']}")
        print(f"  Mastery: {profile['overall_mastery']}%")
        print(f"  Strengths: {len(profile['strengths'])}")
        print(f"  Weaknesses: {len(profile['weaknesses'])}")
        print(f"  Recommendations: {len(profile['recommendations'])}")

        for rec in profile["recommendations"][:3]:
            print(f"    - [{rec.get('priority','')}] {rec.get('subject','')}: "
                  f"{rec.get('action','')} (mastery={rec.get('mastery',0)})")

        # 4. Verify session retrieval
        session_resp = httpx.get(
            f"{BASE}/level-test/session/{session_id}",
            timeout=10,
        )
        assert session_resp.status_code == 200
        session_data = session_resp.json()
        assert session_data["session"]["status"] == "completed"

        # 5. Personalised recommendations from profile
        recs_resp = httpx.post(
            f"{BASE}/recommendations/personalized",
            json={"student_profile": profile, "n_results": 3},
            timeout=TIMEOUT,
        )
        assert recs_resp.status_code == 200, f"Recommendations failed: {recs_resp.text}"
        recs = recs_resp.json()
        assert "recommendations" in recs
        print(f"\n[RECOMMENDATIONS] count={len(recs['recommendations'])}")
        for r in recs["recommendations"]:
            preview = (r.get("relevant_material_preview") or "")[:100]
            print(f"    - {r.get('subject','')}: {r.get('action','')} "
                  f"(preview={preview}...)")


@_needs_api
class TestLevelTestEdgeCases:
    """Edge case validation."""

    def test_invalid_session_submit(self):
        resp = httpx.post(
            f"{BASE}/level-test/submit-answer",
            json={"session_id": "nonexistent-id", "answer": "A"},
            timeout=10,
        )
        assert resp.status_code == 404

    def test_invalid_session_complete(self):
        resp = httpx.post(
            f"{BASE}/level-test/complete",
            json={"session_id": "nonexistent-id"},
            timeout=10,
        )
        assert resp.status_code == 404

    def test_session_not_found(self):
        resp = httpx.get(
            f"{BASE}/level-test/session/nonexistent-id",
            timeout=10,
        )
        assert resp.status_code == 404

    def test_start_with_specific_subjects(self):
        """Start a test with a subset of subjects (first 2 courses)."""
        courses_resp = httpx.get(f"{BASE}/health", timeout=5)
        assert courses_resp.status_code == 200

        from core.db_connection import get_all_courses
        courses = get_all_courses()
        if len(courses) < 2:
            pytest.skip("Need at least 2 courses")

        first_two = [c["id"] for c in courses[:2]]
        resp = httpx.post(
            f"{BASE}/level-test/start",
            json={"student_id": "e2e-subset-student", "subjects": first_two},
            timeout=TIMEOUT,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["subjects"]) == 2
        assert data["total_questions"] == 10


class TestLevelTestScoringUnit:
    """Unit tests for scoring module (no API needed)."""

    def test_compute_subject_mastery_all_correct(self):
        from level_test.scoring import compute_subject_mastery

        subj = {
            "answers": [
                {"answered": True, "is_correct": True, "difficulty": "medium", "topic": "loops"},
                {"answered": True, "is_correct": True, "difficulty": "hard", "topic": "arrays"},
                {"answered": True, "is_correct": True, "difficulty": "easy", "topic": "io"},
            ],
        }
        m = compute_subject_mastery(subj)
        assert m["mastery_score"] == 100.0
        assert m["correct"] == 3
        assert m["accuracy"] == 1.0
        assert len(m["topics_correct"]) == 3
        assert len(m["topics_incorrect"]) == 0

    def test_compute_subject_mastery_all_wrong(self):
        from level_test.scoring import compute_subject_mastery

        subj = {
            "answers": [
                {"answered": True, "is_correct": False, "difficulty": "medium", "topic": "loops"},
                {"answered": True, "is_correct": False, "difficulty": "easy", "topic": "io"},
            ],
        }
        m = compute_subject_mastery(subj)
        assert m["mastery_score"] == 0.0
        assert m["correct"] == 0
        assert len(m["topics_incorrect"]) == 2

    def test_compute_subject_mastery_mixed(self):
        from level_test.scoring import compute_subject_mastery

        subj = {
            "answers": [
                {"answered": True, "is_correct": True, "difficulty": "easy", "topic": "t1"},
                {"answered": True, "is_correct": False, "difficulty": "hard", "topic": "t2"},
            ],
        }
        m = compute_subject_mastery(subj)
        assert 0 < m["mastery_score"] < 100
        assert m["correct"] == 1

    def test_generate_student_profile(self):
        from level_test.scoring import generate_student_profile

        session = {
            "student_id": "test-student",
            "subjects": {
                "subj-a": {
                    "title": "Chapter A",
                    "answers": [
                        {"answered": True, "is_correct": True, "difficulty": "medium", "topic": "x"},
                        {"answered": True, "is_correct": True, "difficulty": "hard", "topic": "y"},
                    ],
                },
                "subj-b": {
                    "title": "Chapter B",
                    "answers": [
                        {"answered": True, "is_correct": False, "difficulty": "easy", "topic": "a"},
                        {"answered": True, "is_correct": False, "difficulty": "medium", "topic": "b"},
                    ],
                },
            },
        }
        profile = generate_student_profile(session)
        assert profile["student_id"] == "test-student"
        assert profile["overall_level"] in ("beginner", "intermediate", "advanced")
        assert len(profile["subjects"]) == 2
        assert len(profile["recommendations"]) == 2

    def test_adapt_difficulty(self):
        from level_test.adaptive_engine import AdaptiveLevelTest

        assert AdaptiveLevelTest._adapt_difficulty("medium", True) == "hard"
        assert AdaptiveLevelTest._adapt_difficulty("medium", False) == "easy"
        assert AdaptiveLevelTest._adapt_difficulty("hard", True) == "hard"
        assert AdaptiveLevelTest._adapt_difficulty("easy", False) == "easy"
        assert AdaptiveLevelTest._adapt_difficulty("easy", True) == "medium"
        assert AdaptiveLevelTest._adapt_difficulty("hard", False) == "medium"

    def test_empty_answers(self):
        from level_test.scoring import compute_subject_mastery

        m = compute_subject_mastery({"answers": []})
        assert m["mastery_score"] == 0.0
        assert m["total"] == 0
