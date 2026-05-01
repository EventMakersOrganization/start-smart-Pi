"""
Unit tests for Auth-related API behavior in ai-service.
Conforms to Sprint 8 requirements for Member 1.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import jwt
import sys
import os

# Create the client at module level or in a fixture
# Since we are running in the ai-service directory, api should be importable
from api import app
from core.config import JWT_SECRET

@pytest.fixture
def client():
    return TestClient(app)

def test_unauthenticated_request(client):
    """
    Scenario: Request without Authorization header.
    Expected: 401 Unauthorized (or 403 depending on FastAPI version, here it got 401).
    """
    response = client.get("/health")
    assert response.status_code == 401

def test_invalid_token(client):
    """
    Scenario: Request with an invalid JWT token.
    Expected: 401 Unauthorized with 'Invalid token' message.
    """
    response = client.get("/health", headers={"Authorization": "Bearer fake.token.here"})
    assert response.status_code == 401
    assert "Invalid token" in response.json()["detail"]

def test_expired_token(client):
    """
    Scenario: Request with an expired JWT token.
    Expected: 401 Unauthorized with 'Token expired' message.
    """
    from datetime import datetime, timedelta, timezone
    expired_payload = {
        "sub": "user123",
        "role": "student",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1)
    }
    expired_token = jwt.encode(expired_payload, JWT_SECRET, algorithm="HS256")
    
    response = client.get("/health", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert "Token expired" in response.json()["detail"]

def test_valid_authenticated_request(client):
    """
    Scenario: Request with a valid student JWT token.
    Expected: 200 OK for a general route like /health.
    """
    valid_payload = {
        "sub": "student_001",
        "role": "student"
    }
    token = jwt.encode(valid_payload, JWT_SECRET, algorithm="HS256")
    
    response = client.get("/health", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_permission_forbidden_edge_case(client):
    """
    Scenario: Student tries to access an admin-only route (/embeddings/optimize).
    Expected: 403 Forbidden with 'admin role required' message.
    """
    student_payload = {
        "sub": "student_001",
        "role": "student"
    }
    token = jwt.encode(student_payload, JWT_SECRET, algorithm="HS256")
    
    response = client.post(
        "/embeddings/optimize", 
        headers={"Authorization": f"Bearer {token}"},
        json={"course_ids": []}
    )
    assert response.status_code == 403
    assert "admin role required" in response.json()["detail"]

def test_valid_admin_request(client):
    """
    Scenario: Admin accesses an admin-only route.
    Expected: 200 OK (assuming logic is mocked).
    """
    admin_payload = {
        "sub": "admin_001",
        "role": "admin"
    }
    token = jwt.encode(admin_payload, JWT_SECRET, algorithm="HS256")
    
    # Mock the backend processor to avoid real work
    with patch("api.batch_processor.process_courses_batch") as mock_batch:
        mock_batch.return_value = {"total_courses": 1, "total_chunks": 10, "total_time": 1.5}
        
        response = client.post(
            "/embeddings/optimize", 
            headers={"Authorization": f"Bearer {token}"},
            json={"course_ids": []}
        )
        assert response.status_code == 200
        assert response.json()["status"] == "success"
