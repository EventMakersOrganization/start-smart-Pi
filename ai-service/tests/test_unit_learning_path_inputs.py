import sys
from unittest.mock import MagicMock

# Mock complex dependencies before importing the app logic
mock_modules = [
    'chromadb', 'pymongo', 'motor', 'motor.motor_asyncio', 
    'langchain', 'langchain_community', 'langchain_ollama', 'langchain_core', 'langchain_core.prompts',
    'core.chroma_setup', 'core.db_connection',
    'dotenv', 'ollama', 'uvicorn', 'pypdf', 'PyPDF2', 'docx', 'python-pptx', 'Pillow', 'requests', 'multipart'
]
for mod in mock_modules:
    sys.modules[mod] = MagicMock()

import fastapi.dependencies.utils
fastapi.dependencies.utils.ensure_multipart_is_installed = lambda: None

import pytest
from pydantic import ValidationError

# Now we can import the request model
from api import PersonalizedRecommendationsRequest

def test_personalized_recommendations_request_valid():
    """Happy path: valid student profile and n_results."""
    profile = {
        "student_id": "std_123",
        "overall_level": "intermediate",
        "weaknesses": ["loops", "recursion"],
        "recommendations": [
            {"subject": "Python", "focus_topics": ["for loops"]}
        ]
    }
    request = PersonalizedRecommendationsRequest(student_profile=profile, n_results=10)
    assert request.student_profile == profile
    assert request.n_results == 10

def test_personalized_recommendations_request_defaults():
    """Test default values."""
    profile = {"student_id": "std_123"}
    request = PersonalizedRecommendationsRequest(student_profile=profile)
    assert request.n_results == 5  # Default value

def test_personalized_recommendations_request_invalid_n_results():
    """Validation/error path: n_results out of range."""
    profile = {"student_id": "std_123"}
    
    # Below minimum
    with pytest.raises(ValidationError):
        PersonalizedRecommendationsRequest(student_profile=profile, n_results=0)
        
    # Above maximum
    with pytest.raises(ValidationError):
        PersonalizedRecommendationsRequest(student_profile=profile, n_results=21)

def test_personalized_recommendations_request_missing_profile():
    """Validation/error path: student_profile is required."""
    with pytest.raises(ValidationError):
        PersonalizedRecommendationsRequest(n_results=5)

def test_personalized_recommendations_request_empty_profile():
    """Edge case: student_profile is empty dict."""
    request = PersonalizedRecommendationsRequest(student_profile={})
    assert request.student_profile == {}
    assert request.n_results == 5
