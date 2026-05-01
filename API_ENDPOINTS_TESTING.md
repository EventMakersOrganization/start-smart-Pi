# 🚀 Complete API Endpoints Test Guide - Sprint 1

## 📋 BASE URL
```
http://localhost:3000/api
```

---

## 🔐 AUTHENTICATION ENDPOINTS

### 1. Register User
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "student@example.com",
  "password": "password123",
  "first_name": "John",
  "last_name": "Smith",
  "role": "student"
}
```

### 2. Register Instructor
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "password123",
  "first_name": "Jane",
  "last_name": "Doe",
  "role": "instructor"
}
```

### 3. Register Admin
```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123",
  "first_name": "Admin",
  "last_name": "User",
  "role": "admin"
}
```

### 4. Login
```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "password123"
}
```
**Response:** Copy the `access_token` for use in other requests

### 5. Google Login
```http
POST http://localhost:3000/api/auth/login/google
Content-Type: application/json

{
  "token": "YOUR_GOOGLE_OAUTH_TOKEN"
}
```

### 6. Forgot Password
```http
POST http://localhost:3000/api/auth/forgot-password
Content-Type: application/json

{
  "email": "instructor@example.com"
}
```

### 7. Reset Password
```http
POST http://localhost:3000/api/auth/reset-password
Content-Type: application/json

{
  "token": "RESET_TOKEN_FROM_EMAIL",
  "password": "newPassword123"
}
```

---

## 👤 USER/PROFILE ENDPOINTS

### 8. Get User Count (Admin Only)
```http
GET http://localhost:3000/api/user/count
Authorization: Bearer YOUR_TOKEN
```

### 9. Get My Profile
```http
GET http://localhost:3000/api/user/profile
Authorization: Bearer YOUR_TOKEN
```

### 10. Update My Profile
```http
PUT http://localhost:3000/api/user/profile
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "phone": "+1234567890",
  "address": "123 Main St",
  "city": "New York"
}
```

---

## 📊 RISKSCORE ENDPOINTS

### 11. Create RiskScore (Admin/Instructor Only)
```http
POST http://localhost:3000/api/riskscores
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "user": "65a1234567890abcdef01234",
  "score": 75,
  "riskLevel": "medium"
}
```

**Test Cases:**
- **LOW Risk:**
```json
{
  "user": "USER_ID_HERE",
  "score": 25,
  "riskLevel": "low"
}
```

- **MEDIUM Risk:**
```json
{
  "user": "USER_ID_HERE",
  "score": 50,
  "riskLevel": "medium"
}
```

- **HIGH Risk:**
```json
{
  "user": "USER_ID_HERE",
  "score": 85,
  "riskLevel": "high"
}
```

### 12. Get All RiskScores (Admin/Instructor Only)
```http
GET http://localhost:3000/api/riskscores
Authorization: Bearer YOUR_TOKEN
```

### 13. Get RiskScore Count (Admin/Instructor Only)
```http
GET http://localhost:3000/api/riskscores/count
Authorization: Bearer YOUR_TOKEN
```

### 14. Get RiskScore by ID (Admin/Instructor Only)
```http
GET http://localhost:3000/api/riskscores/65b5678901234567890abcde
Authorization: Bearer YOUR_TOKEN
```

### 15. Get RiskScores by User ID (Admin/Instructor Only)
```http
GET http://localhost:3000/api/riskscores/user/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
```

### 16. Update RiskScore (Admin/Instructor Only)
```http
PATCH http://localhost:3000/api/riskscores/65b5678901234567890abcde
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "score": 90,
  "riskLevel": "high"
}
```

### 17. Delete RiskScore (Admin/Instructor Only)
```http
DELETE http://localhost:3000/api/riskscores/65b5678901234567890abcde
Authorization: Bearer YOUR_TOKEN
```

### 17.1 Recalculate Risk Scores (Continuous Scan Trigger)
```http
POST http://localhost:3000/api/riskscores/recalculate
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "limit": 1000
}
```

**Expected response (example):**
```json
{
  "processedStudents": 248,
  "updatedScores": 248,
  "highRiskCount": 19,
  "mediumRiskCount": 74,
  "generatedAt": "2026-04-23T14:10:00.000Z",
  "errors": []
}
```

### 17.2 Get At-Risk Insights (Weak Areas + Sous Acquis)
```http
GET http://localhost:3000/api/riskscores/at-risk-insights?level=medium&limit=25
Authorization: Bearer YOUR_TOKEN
```

**Query params:**
- `level=high|medium` (default: `high`)
- `limit` (default: `25`, max: `200`)

**Expected response item (example):**
```json
[
  {
    "userId": "65a1234567890abcdef01234",
    "name": "John Smith",
    "email": "john.smith@example.com",
    "riskScore": 86,
    "riskLevel": "high",
    "weakAreas": [
      {
        "topic": "Pointers",
        "currentScore": 42,
        "suggestedDifficulty": "medium",
        "action": "Complete a targeted medium remediation exercise in Pointers, then retry a short quiz to validate progress.",
        "encouragement": "You are close to mastering Pointers. Focused practice will quickly move you forward.",
        "source": "performance"
      }
    ],
    "weakSubskills": [
      "Pointers - intermediate",
      "Memory Management - beginner"
    ],
    "recommendedFocus": [
      "Complete a targeted medium remediation exercise in Pointers, then retry a short quiz to validate progress."
    ],
    "lastUpdated": "2026-04-23T14:09:55.000Z"
  }
]
```

---

## 🚨 ALERT ENDPOINTS

### 18. Create Alert (Admin/Instructor Only)
```http
POST http://localhost:3000/api/alerts
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "student": "65a1234567890abcdef01234",
  "instructor": "65a1234567890abcdef05678",
  "message": "Student performance is dropping in Math",
  "severity": "high",
  "resolved": false
}
```

**Test Cases:**
- **LOW Severity:**
```json
{
  "student": "STUDENT_ID_HERE",
  "instructor": "INSTRUCTOR_ID_HERE",
  "message": "Minor assignment submission delay",
  "severity": "low",
  "resolved": false
}
```

- **MEDIUM Severity:**
```json
{
  "student": "STUDENT_ID_HERE",
  "instructor": "INSTRUCTOR_ID_HERE",
  "message": "Attendance dropping below 80%",
  "severity": "medium",
  "resolved": false
}
```

- **HIGH Severity:**
```json
{
  "student": "STUDENT_ID_HERE",
  "instructor": "INSTRUCTOR_ID_HERE",
  "message": "Failing multiple courses - immediate intervention needed",
  "severity": "high",
  "resolved": false
}
```

### 19. Get All Alerts (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts
Authorization: Bearer YOUR_TOKEN
```

### 20. Get Alert Count (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts/count
Authorization: Bearer YOUR_TOKEN
```

### 21. Get Unresolved Alerts (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts/unresolved
Authorization: Bearer YOUR_TOKEN
```

### 22. Get Alert by ID (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts/65c7890123456789012345ab
Authorization: Bearer YOUR_TOKEN
```

### 23. Get Alerts by Student ID (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts/student/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
```

### 24. Get Alerts by Instructor ID (Admin/Instructor Only)
```http
GET http://localhost:3000/api/alerts/instructor/65a1234567890abcdef05678
Authorization: Bearer YOUR_TOKEN
```

### 25. Update Alert (Admin/Instructor Only)
```http
PATCH http://localhost:3000/api/alerts/65c7890123456789012345ab
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "message": "Issue has been addressed - student showing improvement",
  "severity": "low",
  "resolved": true
}
```

### 26. Resolve Alert (Admin/Instructor Only)
```http
PATCH http://localhost:3000/api/alerts/65c7890123456789012345ab/resolve
Authorization: Bearer YOUR_TOKEN
```

### 27. Delete Alert (Admin/Instructor Only)
```http
DELETE http://localhost:3000/api/alerts/65c7890123456789012345ab
Authorization: Bearer YOUR_TOKEN
```

---

## 👥 ADMIN ENDPOINTS

### 28. Get All Students (Admin Only)
```http
GET http://localhost:3000/api/admin/students
Authorization: Bearer YOUR_TOKEN
```

### 29. Get All Users (Admin Only)
```http
GET http://localhost:3000/api/admin/users
Authorization: Bearer YOUR_TOKEN
```

### 30. Get All Instructors (Admin Only)
```http
GET http://localhost:3000/api/admin/instructors
Authorization: Bearer YOUR_TOKEN
```

### 31. Create User (Admin Only)
```http
POST http://localhost:3000/api/admin/user
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "password123",
  "first_name": "New",
  "last_name": "User",
  "role": "student"
}
```

### 32. Update User (Admin Only)
```http
PUT http://localhost:3000/api/admin/user/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "email": "updated@example.com",
  "first_name": "Updated",
  "last_name": "Name",
  "role": "instructor"
}
```

### 33. Delete User (Admin Only)
```http
DELETE http://localhost:3000/api/admin/user/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
```

---

## 📈 ACTIVITY ENDPOINTS

### 34. Get All Activities (Admin Only)
```http
GET http://localhost:3000/api/admin/activity
Authorization: Bearer YOUR_TOKEN
```

---

## 🧠 ANALYTICS ENDPOINTS (SPRINT 7)

### 35. Get Unified Analytics by User (Admin/Instructor Only)
```http
GET http://localhost:3000/api/analytics/unified/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
```

### 36. Get Engagement Score by User (Admin/Instructor Only)
```http
GET http://localhost:3000/api/analytics/engagement/65a1234567890abcdef01234
Authorization: Bearer YOUR_TOKEN
```

### 37. Get Retention Analytics (Admin/Instructor Only)
```http
GET http://localhost:3000/api/analytics/retention?days=30
Authorization: Bearer YOUR_TOKEN
```

**Expected Response (200):**
```json
{
  "totalUsers": 120,
  "retainedUsers": 78,
  "returningUsers": 55,
  "dropoutRate": 35,
  "trend": [
    {
      "date": "2026-03-01",
      "activeUsers": 61,
      "returningUsers": 40
    }
  ]
}
```

### 38. Get Cohort Analytics (Admin/Instructor Only)
```http
GET http://localhost:3000/api/analytics/cohorts
Authorization: Bearer YOUR_TOKEN
```

**Expected Response (200):**
```json
[
  {
    "cohort": "signup:2026-03",
    "averageScore": 60,
    "averageRisk": 39,
    "engagementScore": 55
  },
  {
    "cohort": "course:grade-10",
    "averageScore": 62.5,
    "averageRisk": 41.2,
    "engagementScore": 58.4
  },
  {
    "cohort": "performance:medium",
    "averageScore": 53.1,
    "averageRisk": 47.6,
    "engagementScore": 44.2
  }
]
```

### 39. Get Automated Insights (Admin/Instructor Only)
```http
GET http://localhost:3000/api/analytics/insights
Authorization: Bearer YOUR_TOKEN
```

**Expected Response (200):**
```json
{
  "insights": [
    "High dropout risk detected in performance:low with average risk score 62.",
    "Engagement decreased this week compared with the previous week based on active-user trend.",
    "Students with low activity and performance show higher risk: cohort performance:low has average risk 62."
  ]
}
```

**Insight Rules (Current Rule-Based Thresholds):**
- Dropout risk:
  - High warning when `dropoutRate >= 40`
  - Moderate warning when `20 <= dropoutRate < 40`
- Engagement trend (week-over-week from retention trend):
  - Decrease insight when `currentWeekAvgActive <= 0.9 * previousWeekAvgActive`
  - Increase insight when `currentWeekAvgActive >= 1.1 * previousWeekAvgActive`
- Cohort risk:
  - Low-performance risk insight when `performance:low` cohort exists and `averageRisk >= 45`
  - Otherwise high-cohort warning when top cohort `averageRisk >= 50`
- Engagement scoring sample:
  - Low engagement insight when sampled average `< 45`
  - Strong engagement insight when sampled average `>= 70`
- Fallback:
  - If no rule triggers, response returns a single neutral insight line.

**Expected Response (200):**
```json
{
  "userId": "65a1234567890abcdef01234",
  "engagementScore": 72.5,
  "level": "high"
}
```

**Scoring formula used:**
```text
engagementScore =
  (activity_frequency * 3) +
  (game_sessions * 2) +
  (exercise_completion * 4)
```

**Normalization and Levels:**
- Score is clamped between 0 and 100.
- `low`: score < 35
- `medium`: 35 <= score < 70
- `high`: score >= 70

---

## 🔧 TESTING WORKFLOW

### **Step-by-Step Testing:**

#### **Step 1: Register an Instructor**
Use endpoint #2 and note the response

#### **Step 2: Login as Instructor**
Use endpoint #4 and copy `access_token` from response

#### **Step 3: Get Your Profile**
Use endpoint #9 and note your user ID from response

#### **Step 4: Create a RiskScore**
Use endpoint #11, replace `user` with a valid user ID, test with different risk levels

#### **Step 5: Get All RiskScores**
Use endpoint #12 and verify your created RiskScore appears

#### **Step 6: Create an Alert**
Use endpoint #18, replace student/instructor IDs with valid ones, test different severities

#### **Step 7: Get Unresolved Alerts**
Use endpoint #21 and verify your alert appears

#### **Step 8: Resolve an Alert**
Use endpoint #26 and check it's marked as resolved

#### **Step 9: Update RiskScore**
Use endpoint #16 and change score and risk level

#### **Step 10: Test Permissions**
Login as STUDENT, try creating RiskScore (should fail with 403), try viewing profile (should work)

---

## 📊 QUICK REFERENCE TABLE

| Endpoint | Method | Auth Required | Roles Allowed | Description |
|----------|--------|---------------|---------------|-------------|
| `/auth/register` | POST | No | All | Register new user |
| `/auth/login` | POST | No | All | Login and get JWT token |
| `/auth/forgot-password` | POST | No | All | Request password reset |
| `/auth/reset-password` | POST | No | All | Reset password with token |
| `/user/profile` | GET | Yes | All | Get own profile |
| `/user/profile` | PUT | Yes | All | Update own profile |
| `/user/count` | GET | Yes | Admin | Get total user count |
| `/riskscores` | POST | Yes | Admin, Instructor | Create risk score |
| `/riskscores` | GET | Yes | Admin, Instructor | Get all risk scores |
| `/riskscores/count` | GET | Yes | Admin, Instructor | Get risk score count |
| `/riskscores/:id` | GET | Yes | Admin, Instructor | Get risk score by ID |
| `/riskscores/user/:userId` | GET | Yes | Admin, Instructor | Get risk scores for user |
| `/riskscores/:id` | PATCH | Yes | Admin, Instructor | Update risk score |
| `/riskscores/:id` | DELETE | Yes | Admin, Instructor | Delete risk score |
| `/alerts` | POST | Yes | Admin, Instructor | Create alert |
| `/alerts` | GET | Yes | Admin, Instructor | Get all alerts |
| `/alerts/count` | GET | Yes | Admin, Instructor | Get alert count |
| `/alerts/unresolved` | GET | Yes | Admin, Instructor | Get unresolved alerts |
| `/alerts/:id` | GET | Yes | Admin, Instructor | Get alert by ID |
| `/alerts/student/:studentId` | GET | Yes | Admin, Instructor | Get alerts for student |
| `/alerts/instructor/:instructorId` | GET | Yes | Admin, Instructor | Get alerts for instructor |
| `/alerts/:id` | PATCH | Yes | Admin, Instructor | Update alert |
| `/alerts/:id/resolve` | PATCH | Yes | Admin, Instructor | Mark alert as resolved |
| `/alerts/:id` | DELETE | Yes | Admin, Instructor | Delete alert |
| `/admin/students` | GET | Yes | Admin | Get all students |
| `/admin/users` | GET | Yes | Admin | Get all users |
| `/admin/instructors` | GET | Yes | Admin | Get all instructors |
| `/admin/user` | POST | Yes | Admin | Create new user |
| `/admin/user/:id` | PUT | Yes | Admin | Update user |
| `/admin/user/:id` | DELETE | Yes | Admin | Delete user |
| `/admin/activity` | GET | Yes | Admin | Get all activities |
| `/analytics/unified/:userId` | GET | Yes | Admin, Instructor | Get unified cross-module analytics |
| `/analytics/engagement/:userId` | GET | Yes | Admin, Instructor | Get per-student engagement score |
| `/analytics/retention` | GET | Yes | Admin, Instructor | Analyze retention and dropout trends |
| `/analytics/cohorts` | GET | Yes | Admin, Instructor | Analyze grouped cohorts by signup, course, and performance |
| `/analytics/insights` | GET | Yes | Admin, Instructor | Generate rule-based human-readable insights |

---

## ⚠️ IMPORTANT NOTES

### **For IDs:**
- Replace `65a1234567890abcdef01234` with actual MongoDB ObjectIDs from your database
- Get user IDs from login response or profile endpoint
- User IDs are 24 hex characters

### **For Tokens:**
- Replace `YOUR_TOKEN` with the actual JWT token from login
- Token format: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Tokens expire after 1 day (configured in JWT_EXPIRES_IN)

### **Valid Values:**
- `role`: "admin", "instructor", "student"
- `riskLevel`: "low", "medium", "high"
- `severity`: "low", "medium", "high"
- `resolved`: true or false

---

## 🐛 COMMON ERRORS & SOLUTIONS

### 401 Unauthorized
**Problem:** Missing or invalid JWT token  
**Solution:** Login again and use the fresh `access_token`

### 403 Forbidden
**Problem:** Valid token but insufficient permissions  
**Solution:** Login with correct role (Admin/Instructor for most analytics endpoints)

### 400 Bad Request
**Problem:** Invalid data format or missing required fields  
**Solution:** Check the request body matches the expected format

### 404 Not Found
**Problem:** Invalid endpoint or resource ID doesn't exist  
**Solution:** Verify the URL and resource ID

---

## 🎯 SPRINT 1 TEST CHECKLIST

### Backend API Tests
- [ ] Register Student account
- [ ] Register Instructor account
- [ ] Register Admin account
- [ ] Login with each role
- [ ] Get profile for each role
- [ ] Update profile
- [ ] Create RiskScore (LOW)
- [ ] Create RiskScore (MEDIUM)
- [ ] Create RiskScore (HIGH)
- [ ] Get all RiskScores
- [ ] Get RiskScore by ID
- [ ] Get RiskScore by User ID
- [ ] Update RiskScore
- [ ] Delete RiskScore
- [ ] Create Alert (LOW severity)
- [ ] Create Alert (MEDIUM severity)
- [ ] Create Alert (HIGH severity)
- [ ] Get all Alerts
- [ ] Get unresolved Alerts
- [ ] Get Alert by Student ID
- [ ] Get Alert by Instructor ID
- [ ] Resolve Alert
- [ ] Update Alert
- [ ] Delete Alert
- [ ] Test permission denials (Student trying to create RiskScore)
- [ ] Test Admin endpoints (users, activities)

### Database Verification
- [ ] Verify `riskscores` collection exists
- [ ] Verify `alerts` collection exists
- [ ] Verify `users` collection has test data
- [ ] Verify timestamps are created automatically
- [ ] Check indexes on collections

### Frontend Tests
- [ ] Login page works
- [ ] Register page works
- [ ] Student dashboard loads
- [ ] Instructor dashboard loads
- [ ] Admin dashboard loads
- [ ] Profile page loads and updates
- [ ] Role-based routing works correctly

---

## 📝 NOTES

**Current Implementation Status:**
- ✅ Database schemas created (RiskScore, Alert)
- ✅ Backend CRUD operations implemented
- ✅ Role-based access control in place
- ✅ JWT authentication working
- ✅ Frontend routing components exist
- ✅ Duplicate route mapping FIXED (via SharedModule)

**Testing Tools:**
- Postman (recommended)
- Thunder Client (VS Code extension)
- cURL
- Insomnia

Copy and paste these directly into your REST client! 🚀
