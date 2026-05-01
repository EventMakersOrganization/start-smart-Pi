from fastapi.testclient import TestClient
import api
import jwt
from core.config import JWT_SECRET

client = TestClient(api.app)

# 1. Unauthenticated
r1 = client.get("/health")
print(f"Unauthenticated: {r1.status_code} {r1.json()}")

# 2. Valid
token = jwt.encode({"sub": "test", "role": "student"}, JWT_SECRET, algorithm="HS256")
r2 = client.get("/health", headers={"Authorization": f"Bearer {token}"})
print(f"Valid student: {r2.status_code} {r2.json()}")

# 3. Forbidden
r3 = client.post("/embeddings/optimize", headers={"Authorization": f"Bearer {token}"}, json={"course_ids": []})
print(f"Forbidden (Student to Admin): {r3.status_code} {r3.json()}")

# 4. Admin
admin_token = jwt.encode({"sub": "admin", "role": "admin"}, JWT_SECRET, algorithm="HS256")
# We need to mock the optimize call though
from unittest.mock import patch
with patch("api.batch_processor.process_courses_batch") as mock:
    mock.return_value = {"total_courses": 0}
    r4 = client.post("/embeddings/optimize", headers={"Authorization": f"Bearer {admin_token}"}, json={"course_ids": []})
    print(f"Admin: {r4.status_code} {r4.json()}")
