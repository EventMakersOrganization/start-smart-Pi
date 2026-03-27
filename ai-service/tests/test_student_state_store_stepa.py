from __future__ import annotations

from learning_state.student_state_store import StudentStateStore


class _FakeCollection:
    def __init__(self) -> None:
        self._docs: dict[str, dict] = {}

    def find_one(self, query: dict):
        sid = query.get("student_id")
        doc = self._docs.get(sid)
        return dict(doc) if doc else None

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        sid = query.get("student_id")
        exists = sid in self._docs
        doc = dict(self._docs.get(sid, {}))
        if not exists and upsert:
            doc.update(dict(update.get("$setOnInsert", {})))
        doc.update(dict(update.get("$set", {})))
        self._docs[sid] = doc


def test_upsert_from_level_test_prefers_profile_concept_mastery():
    store = StudentStateStore()
    store._col = _FakeCollection()

    profile = {
        "student_id": "stepa-student",
        "overall_level": "beginner",
        "overall_mastery": 42.0,
        "strengths": [],
        "weaknesses": [],
        "recommendations": [{"subject": "Python Basics", "priority": "high"}],
        "subjects": [
            {"title": "Python Basics", "mastery_score": 90.0},
            {"title": "Databases", "mastery_score": 30.0},
        ],
        "concept_mastery": {
            "variables": 75.0,
            "loops": 20.0,
            "functions": 10.0,
        },
    }

    out = store.upsert_from_level_test(profile, session_id="sess-stepa")
    assert out["student_id"] == "stepa-student"
    assert out["concept_mastery"] == profile["concept_mastery"]
