import sys
from unittest.mock import MagicMock, patch

# Mock complex dependencies before importing the app logic
mock_modules = [
    'chromadb', 'pymongo', 'motor', 'motor.motor_asyncio', 
    'langchain', 'langchain_community', 'langchain_ollama', 'langchain_core', 'langchain_core.prompts',
    'core.chroma_setup', 'core.db_connection',
    'dotenv', 'ollama', 'uvicorn', 'pypdf', 'PyPDF2', 'docx', 'python-pptx', 'Pillow', 'requests', 'multipart'
]
for mod in mock_modules:
    sys.modules[mod] = MagicMock()

import pytest
from learning_state.student_state_store import StudentStateStore

@pytest.fixture
def mock_db():
    db = MagicMock()
    collection = MagicMock()
    db.__getitem__.return_value = collection
    
    with patch('learning_state.student_state_store.get_database') as mock_get_db:
        mock_get_db.return_value = db
        yield collection

@pytest.fixture
def store(mock_db):
    return StudentStateStore()

def test_upsert_from_level_test_happy_path(store, mock_db):
    """Happy path: upsert state from a valid student profile."""
    profile = {
        "student_id": "std_123",
        "overall_level": "intermediate",
        "overall_mastery": 80.0,
        "concept_mastery": {"loops": 0.85, "recursion": 0.7},
        "strengths": ["loops"],
        "weaknesses": ["recursion"],
        "recommendations": ["Advanced Recursion"]
    }
    
    mock_db.find_one.return_value = None
    
    # We ignore the return value as it calls find_one again
    store.upsert_from_level_test(profile, session_id="sess_abc")
    
    assert mock_db.update_one.called
    args, kwargs = mock_db.update_one.call_args
    update_payload = args[1]['$set']
    
    assert update_payload["student_id"] == "std_123"
    assert update_payload["current_level"] == "intermediate"
    assert update_payload["overall_mastery"] == 80.0
    assert update_payload["confidence_score"] == 0.8
    assert update_payload["pace_mode"] == "fast"

def test_upsert_from_level_test_missing_id(store):
    """Error path: missing student_id raises ValueError."""
    with pytest.raises(ValueError, match="student_profile.student_id is required"):
        store.upsert_from_level_test({"overall_mastery": 50})

def test_upsert_from_level_test_pace_modes(store, mock_db):
    """Edge cases: verify different pace modes based on mastery."""
    mock_db.find_one.return_value = None
    
    # Slow pace
    store.upsert_from_level_test({"student_id": "s1", "overall_mastery": 30.0})
    args, _ = mock_db.update_one.call_args
    assert args[1]['$set']["pace_mode"] == "slow"
    
    # Normal pace
    store.upsert_from_level_test({"student_id": "s2", "overall_mastery": 60.0})
    args, _ = mock_db.update_one.call_args
    assert args[1]['$set']["pace_mode"] == "normal"

def test_record_learning_event_updates_engagement(store, mock_db):
    """Happy path: recording an event updates counters and study time."""
    student_id = "std_123"
    mock_db.find_one.return_value = {
        "student_id": student_id,
        "engagement": {"events_count": 5, "study_time_sec": 100}
    }
    
    store.record_learning_event(
        student_id=student_id,
        event_type="quiz",
        score=90.0,
        duration_sec=60
    )
    
    assert mock_db.update_one.called
    args, _ = mock_db.update_one.call_args
    update_payload = args[1]['$set']
    
    engagement = update_payload["engagement"]
    assert engagement["events_count"] == 6
    assert engagement["study_time_sec"] == 160
    assert engagement["quiz_attempts"] == 1
    assert 90.0 in update_payload["recent_scores"]

def test_record_learning_event_score_clamping(store, mock_db):
    """Edge case: scores should be clamped between 0 and 100."""
    student_id = "std_123"
    mock_db.find_one.return_value = None
    
    # Score above 100
    store.record_learning_event(student_id, "exercise", score=150.0)
    args, _ = mock_db.update_one.call_args
    assert args[1]['$set']["recent_scores"] == [100.0]
    
    # Score below 0
    # Simulate existing state with the previous score
    mock_db.find_one.return_value = {"student_id": student_id, "recent_scores": [100.0]}
    store.record_learning_event(student_id, "exercise", score=-50.0)
    args, _ = mock_db.update_one.call_args
    assert 0.0 in args[1]['$set']["recent_scores"]

def test_record_learning_event_invalid_input(store):
    """Error path: missing required fields for event."""
    with pytest.raises(ValueError, match="student_id is required"):
        store.record_learning_event(student_id=None, event_type="quiz")
    
    with pytest.raises(ValueError, match="event_type is required"):
        store.record_learning_event(student_id="s1", event_type="")

def test_record_learning_event_updates_concept_mastery(store, mock_db):
    """Happy path: recording an event with metadata updates concept mastery."""
    student_id = "std_123"
    mock_db.find_one.return_value = {
        "student_id": student_id,
        "concept_mastery": {"loops": 0.5},
        "overall_mastery": 50.0,
        "confidence_score": 0.5
    }
    
    store.record_learning_event(
        student_id=student_id,
        event_type="quiz",
        score=100.0,
        metadata={"concept": "loops", "difficulty": "medium", "is_correct": True}
    )
    
    args, _ = mock_db.update_one.call_args
    update_payload = args[1]['$set']
    
    assert "loops" in update_payload["concept_mastery"]
    assert update_payload["concept_mastery"]["loops"] > 0.5
