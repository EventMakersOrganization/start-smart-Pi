#!/usr/bin/env python3
"""
Integration test: Verify level test flow works end-to-end
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"
STUDENT_ID = "test_student_69c7841860c375ed30b3c5b7"

def test_health():
    """Test AI service health"""
    print("🏥 Testing AI Service Health...")
    resp = requests.get(f"{BASE_URL}/health")
    if resp.status_code == 200:
        print("✅ AI Service is healthy")
        return True
    else:
        print(f"❌ Health check failed: {resp.status_code}")
        return False

def test_level_test_start():
    """Test level test start endpoint"""
    print("\n🎯 Testing Level Test Start...")
    
    payload = {
        "student_id": STUDENT_ID,
        "subjects": None
    }
    
    resp = requests.post(f"{BASE_URL}/level-test/start", json=payload)
    
    if resp.status_code != 200:
        print(f"❌ Start failed: {resp.status_code}")
        print(f"Response: {resp.text}")
        return None
    
    data = resp.json()
    print(f"✅ Level test started!")
    print(f"   Session ID: {data['session_id']}")
    print(f"   Subjects: {len(data['subjects'])}")
    print(f"   Total Questions: {data['total_questions']}")
    print(f"   First Question: {data['first_question']['question'][:50]}...")
    
    return data

def test_submit_answer(session_data):
    """Test submit answer endpoint"""
    print("\n📝 Testing Submit Answer...")
    
    session_id = session_data['session_id']
    
    # Submit answer to first question
    payload = {
        "session_id": session_id,
        "answer": session_data['first_question']['options'][0]  # Pick first option
    }
    
    resp = requests.post(f"{BASE_URL}/level-test/submit-answer", json=payload)
    
    if resp.status_code != 200:
        print(f"❌ Submit answer failed: {resp.status_code}")
        print(f"Response: {resp.text}")
        return False
    
    data = resp.json()
    print(f"✅ Answer submitted!")
    print(f"   Correct: {data.get('correct')}")
    print(f"   Progress: {data.get('progress')}")
    
    return True

def run_tests():
    """Run all tests"""
    print("=" * 60)
    print("🧪 LEVEL TEST INTEGRATION TEST SUITE")
    print("=" * 60)
    
    try:
        # Test 1: Health
        if not test_health():
            print("\n❌ AI Service not available!")
            return False
        
        time.sleep(1)
        
        # Test 2: Start level test
        session_data = test_level_test_start()
        if not session_data:
            print("\n❌ Failed to start level test!")
            return False
        
        time.sleep(1)
        
        # Test 3: Submit answer
        if not test_submit_answer(session_data):
            print("\n❌ Failed to submit answer!")
            return False
        
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    import sys
    success = run_tests()
    sys.exit(0 if success else 1)
