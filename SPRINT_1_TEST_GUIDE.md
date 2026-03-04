# Sprint 1 (Student 5) - Analytics & Risk Testing Guide

## Overview
Test all backend and frontend components for Risk Score and Alert management system.

---

## ✅ PART 1: DATABASE VERIFICATION

### 1.1 Verify MongoDB Collections Exist
```bash
# Connect to MongoDB
mongo mongodb://127.0.0.1:27017/user-management

# Check collections
show collections
# Should show: riskscores, alerts, users, activities, etc.

# View schema
db.riskscores.findOne()
db.alerts.findOne()
```

**Expected:**
- ✅ `riskscores` collection created
- ✅ `alerts` collection created
- ✅ Both have proper timestamps

---

## ✅ PART 2: BACKEND API TESTING

### Base URL: `http://localhost:3000/api`

**Prerequisites:**
1. Create users with different roles (Admin, Instructor, Student)
2. Login to get JWT token for testing

### 2.1 LOGIN & GET TOKEN
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "instructor@example.com",
  "password": "password123"
}

# Response will have: access_token
# Copy this token for next requests
```

---

### 2.2 RISKSCORE CRUD OPERATIONS

#### 2.2.1 Create RiskScore (POST)
```bash
POST /riskscores
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "user": "65a1234567890abcdef01234",
  "score": 75,
  "riskLevel": "medium"
}

# Expected Response (201):
{
  "_id": "...",
  "user": "65a1234567890abcdef01234",
  "score": 75,
  "riskLevel": "medium",
  "lastUpdated": "2026-03-04T...",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Test Cases:**
- ✅ Create with LOW risk (score: 25)
- ✅ Create with MEDIUM risk (score: 50)
- ✅ Create with HIGH risk (score: 85)
- ❌ Missing user ID → 400 error
- ❌ Invalid risk level → 400 error

---

#### 2.2.2 Get All RiskScores (GET)
```bash
GET /riskscores
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
[
  {
    "_id": "...",
    "user": "...",
    "score": 75,
    "riskLevel": "medium",
    ...
  },
  ...
]
```

---

#### 2.2.3 Get Count of RiskScores (GET)
```bash
GET /riskscores/count
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "count": 5
}
```

---

#### 2.2.4 Get RiskScore by User ID (GET)
```bash
GET /riskscores/user/:userId
Authorization: Bearer <YOUR_TOKEN>

Example:
GET /riskscores/user/65a1234567890abcdef01234

# Expected Response (200):
[
  {
    "_id": "...",
    "user": "65a1234567890abcdef01234",
    "score": 75,
    ...
  }
]
```

---

#### 2.2.5 Get RiskScore by ID (GET)
```bash
GET /riskscores/:id
Authorization: Bearer <YOUR_TOKEN>

Example:
GET /riskscores/65b5678901234567890abcde

# Expected Response (200):
{
  "_id": "65b5678901234567890abcde",
  "user": "...",
  "score": 75,
  "riskLevel": "medium"
}
```

---

#### 2.2.6 Update RiskScore (PATCH)
```bash
PATCH /riskscores/:id
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "score": 85,
  "riskLevel": "high"
}

# Expected Response (200):
{
  "_id": "...",
  "score": 85,
  "riskLevel": "high",
  ...
}
```

---

#### 2.2.7 Delete RiskScore (DELETE)
```bash
DELETE /riskscores/:id
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "message": "RiskScore deleted successfully"
}
```

---

### 2.3 ALERT CRUD OPERATIONS

#### 2.3.1 Create Alert (POST)
```bash
POST /alerts
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "student": "65a1234567890abcdef01234",
  "instructor": "65a1234567890abcdef05678",
  "message": "Student performance is dropping in Math",
  "severity": "high",
  "resolved": false
}

# Expected Response (201):
{
  "_id": "...",
  "student": "...",
  "instructor": "...",
  "message": "Student performance is dropping in Math",
  "severity": "high",
  "resolved": false,
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Test Cases:**
- ✅ Create with LOW severity
- ✅ Create with MEDIUM severity
- ✅ Create with HIGH severity
- ✅ Create with resolved: false
- ✅ Create with resolved: true
- ❌ Missing student ID → 400 error
- ❌ Invalid severity → 400 error

---

#### 2.3.2 Get All Alerts (GET)
```bash
GET /alerts
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
[
  {
    "_id": "...",
    "student": "...",
    "message": "...",
    "severity": "high",
    "resolved": false
  },
  ...
]
```

---

#### 2.3.3 Get Count of Alerts (GET)
```bash
GET /alerts/count
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "count": 8
}
```

---

#### 2.3.4 Get Unresolved Alerts (GET)
```bash
GET /alerts/unresolved
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
[
  {
    "_id": "...",
    "message": "...",
    "severity": "high",
    "resolved": false
  },
  ...
]
```

---

#### 2.3.5 Get Alerts for Student (GET)
```bash
GET /alerts/student/:studentId
Authorization: Bearer <YOUR_TOKEN>

Example:
GET /alerts/student/65a1234567890abcdef01234

# Expected Response (200):
[
  {
    "_id": "...",
    "student": "65a1234567890abcdef01234",
    "message": "...",
    ...
  }
]
```

---

#### 2.3.6 Get Alerts for Instructor (GET)
```bash
GET /alerts/instructor/:instructorId
Authorization: Bearer <YOUR_TOKEN>

Example:
GET /alerts/instructor/65a1234567890abcdef05678

# Expected Response (200):
[
  {
    "_id": "...",
    "instructor": "65a1234567890abcdef05678",
    "message": "...",
    ...
  }
]
```

---

#### 2.3.7 Get Alert by ID (GET)
```bash
GET /alerts/:id
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "_id": "...",
  "student": "...",
  "message": "...",
  "resolved": false
}
```

---

#### 2.3.8 Update Alert (PATCH)
```bash
PATCH /alerts/:id
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "resolved": true,
  "message": "Issue has been addressed"
}

# Expected Response (200):
{
  "_id": "...",
  "resolved": true,
  "message": "Issue has been addressed",
  ...
}
```

---

#### 2.3.9 Resolve Alert (PATCH)
```bash
PATCH /alerts/:id/resolve
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "_id": "...",
  "resolved": true,
  ...
}
```

---

#### 2.3.10 Delete Alert (DELETE)
```bash
DELETE /alerts/:id
Authorization: Bearer <YOUR_TOKEN>

# Expected Response (200):
{
  "message": "Alert deleted successfully"
}
```

---

## ✅ PART 3: FRONTEND ROUTING VERIFICATION

### 3.1 Check Admin Dashboard Routing
```
Navigate to: http://localhost:4200/admin-dashboard
```

**Verify:**
- ✅ Admin can view all students, instructors, users
- ✅ Admin can create/edit/delete users
- ✅ Admin can view analytics data
- ✅ Page loads without errors

---

### 3.2 Check Instructor Dashboard Routing
```
Navigate to: http://localhost:4200/instructor-dashboard
```

**Verify:**
- ✅ Instructor can view assigned students
- ✅ Instructor can view student performance data
- ✅ Instructor can create alerts for students
- ✅ Instructor can view risk scores

---

### 3.3 Check Analytics Module
```
Navigate to: http://localhost:4200/analytics
```

**Verify:**
- ✅ Analytics dashboard renders
- ✅ Risk score charts display
- ✅ Alert notifications show
- ✅ Data updates in real-time

---

## ✅ PART 4: PERMISSION/ROLE TESTING

### 4.1 RiskScore Permissions
- ✅ ADMIN can: Create, Read, Update, Delete RiskScores
- ✅ INSTRUCTOR can: Create, Read, Update, Delete RiskScores
- ❌ STUDENT cannot: Create/Update/Delete RiskScores
- ✅ STUDENT can: View their own RiskScores

### 4.2 Alert Permissions
- ✅ ADMIN can: Create, Read, Update, Delete Alerts
- ✅ INSTRUCTOR can: Create, Read, Update, Delete Alerts
- ❌ STUDENT cannot: Create/Update/Delete Alerts
- ✅ STUDENT can: View their own Alerts

---

## ✅ PART 5: ERROR HANDLING

### Test Invalid Requests

#### 5.1 Missing Authorization
```bash
GET /riskscores
# Missing: Authorization: Bearer <token>

# Expected Response (401):
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

#### 5.2 Insufficient Permissions
```bash
# Login as STUDENT, then:
POST /riskscores
Authorization: Bearer <STUDENT_TOKEN>

# Expected Response (403):
{
  "message": "Forbidden - Insufficient permissions",
  "statusCode": 403
}
```

#### 5.3 Invalid Data
```bash
POST /alerts
Authorization: Bearer <TOKEN>

{
  "student": "invalid-id",
  "severity": "ultra-high"  // Invalid severity
}

# Expected Response (400):
{
  "message": "Bad Request",
  "statusCode": 400
}
```

---

## 📊 TEST CHECKLIST

### Backend Tests
- [ ] ✅ RiskScore Create
- [ ] ✅ RiskScore Read All
- [ ] ✅ RiskScore Read by ID
- [ ] ✅ RiskScore Update
- [ ] ✅ RiskScore Delete
- [ ] ✅ RiskScore Count
- [ ] ✅ Alert Create
- [ ] ✅ Alert Read All
- [ ] ✅ Alert Read by ID
- [ ] ✅ Alert Update
- [ ] ✅ Alert Resolve
- [ ] ✅ Alert Delete
- [ ] ✅ Alert Count
- [ ] ✅ Alert Unresolved
- [ ] ✅ Role-based Access Control

### Frontend Tests
- [ ] ✅ Admin Dashboard loads
- [ ] ✅ Instructor Dashboard loads
- [ ] ✅ Student Dashboard loads
- [ ] ✅ Analytics module renders
- [ ] ✅ Routing works correctly

### Database Tests
- [ ] ✅ Collections created
- [ ] ✅ Indexes created
- [ ] ✅ Timestamps working

---

## 🐛 TROUBLESHOOTING

### Backend Not Connecting?
```bash
# Check backend is running on port 3000
netstat -ano | findstr :3000
```

### MongoDB Not Responding?
```bash
# Check MongoDB is running on port 27017
netstat -ano | findstr :27017

# Or use MongoDB Compass to verify connection
# Connection: mongodb://127.0.0.1:27017
```

### Token Expired?
Login again and get a fresh token:
```bash
POST /auth/login
```

### API Endpoints Not Mapping?
Check backend logs for "Mapped" messages - you should see:
```
Mapped {/api/riskscores, POST}
Mapped {/api/riskscores, GET}
Mapped {/api/alerts, POST}
Mapped {/api/alerts, GET}
```

---

## 📝 NOTES

**Current Status:**
- ✅ Database schemas created (RiskScore, Alert)
- ✅ Backend CRUD operations implemented
- ✅ Role-based access control in place
- ✅ Frontend routing components exist
- ✅ Duplicate route mapping FIXED (via SharedModule)

**Next Steps After Testing:**
1. Verify no data validation errors
2. Test frontend forms submitting data
3. Implement real-time alerts (WebSockets - future sprint)
4. Add data visualization charts
