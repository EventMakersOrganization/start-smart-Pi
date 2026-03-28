# 🔌 Endpoints & API Calls Reference

## PHASE 1: SIGN UP

| Endpoint             | Method | Body                                                 | Response                                      | Purpose                                         |
| -------------------- | ------ | ---------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- |
| `/api/auth/register` | POST   | `{ first_name, last_name, email, password, phone? }` | `{ message: "User registered successfully" }` | Create new user in MongoDB + send welcome email |

---

## PHASE 2: LOGIN

| Endpoint                         | Method | Body                  | Response                                            | Purpose                                       |
| -------------------------------- | ------ | --------------------- | --------------------------------------------------- | --------------------------------------------- |
| `/api/auth/login`                | POST   | `{ email, password }` | `{ token: "...", user: { id, name, email, role } }` | Authenticate + issue JWT                      |
| `/api/adaptive/profiles/:userId` | GET    | -                     | `{ _id, userId, level, progress, ... }` or `404`    | Check if profile exists (determines redirect) |

---

## PHASE 3: LEVEL TEST (AI-Powered - First Time Only)

### 3a. Initialize Test

| Endpoint                        | Method | Service      | Request | Response                                                                                                                            | Details                                                                                     |
| ------------------------------- | ------ | ------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `/api/chat/ai/level-test/start` | POST   | AI (FastAPI) | `{}`    | `{ session_id, subjects: ["Math", "Science", ...], total_questions: 15, first_question: { question, options, topic, difficulty } }` | Generates all 15 questions in parallel, returns first + session_id. Other questions cached. |

### 3b. Student Answers Questions (Sequential)

| Endpoint                                | Method | Service      | Request                                      | Response                                                                                                | Repeat                          |
| --------------------------------------- | ------ | ------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `/api/chat/ai/level-test/submit-answer` | POST   | AI (FastAPI) | `{ session_id: "...", answer: "my_choice" }` | `{ correct: true/false, next_question: { question, options, ... }, progress: "2/15", finished: false }` | **15 times** (one per question) |

**Frontend**: Each response injects `next_question` into UI array via callback

### 3c. Complete Test & Compute Profile

| Endpoint                           | Method | Service      | Request                 | Response                                                                                                                         | Details                                            |
| ---------------------------------- | ------ | ------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `/api/chat/ai/level-test/complete` | POST   | AI (FastAPI) | `{ session_id: "..." }` | `{ profile: { level, strengths, weaknesses, progress, ... }, learning_state: { pace_mode, confidence_score, concept_mastery } }` | Finalizes session, computes mastery for each topic |

### 3d. Get AI Recommendations

| Endpoint                                    | Method | Service      | Request                                              | Response                                                                                 | Details                                 |
| ------------------------------------------- | ------ | ------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| `/api/chat/ai/recommendations/personalized` | POST   | AI (FastAPI) | `{ profile: { level, strengths, weaknesses, ... } }` | `{ recommendations: [ { type, title, description, priority, suggested_course }, ... ] }` | Generates N personalized learning paths |

### 3e. Record Analytics Event (Background)

| Endpoint                        | Method | Service          | Request                                                                                          | Response       | Details                                 |
| ------------------------------- | ------ | ---------------- | ------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------- |
| `/api/adaptive/learning-events` | POST   | Backend (NestJS) | `{ event_type: "quiz", score: 65, duration_sec: 1200, metadata: { source: "level-test", ... } }` | `{ _id, ... }` | Passive analytics ingest (non-blocking) |

### 3f. Create Student Profile (Backend Auto-Triggered)

| Endpoint                 | Method | Service          | Request                                                                        | Response                                | Details                                           |
| ------------------------ | ------ | ---------------- | ------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------- |
| `/api/adaptive/profiles` | POST   | Backend (NestJS) | `{ userId, level, progress, strengths, weaknesses, learningPreferences, ... }` | `{ _id, userId, level, progress, ... }` | Created automatically after level test completion |

---

## PHASE 4: DISPLAY RESULTS

| Endpoint          | Method | Service | Request | Response                                                        | Purpose                                        |
| ----------------- | ------ | ------- | ------- | --------------------------------------------------------------- | ---------------------------------------------- |
| (Already fetched) | -      | -       | -       | (From `/level-test/complete` + `/recommendations/personalized`) | Results page uses responses from phase 3c + 3d |

---

## PHASE 5: STUDENT DASHBOARD (After Level Test)

### Initial Load Endpoints

| Endpoint                                               | Method | Service      | Body | Response                                                                    | Details                        |
| ------------------------------------------------------ | ------ | ------------ | ---- | --------------------------------------------------------------------------- | ------------------------------ |
| `/api/adaptive/profiles/:userId`                       | GET    | Backend      | -    | `{ level, progress, strengths, weaknesses, learningState, ... }`            | Get current adaptive profile   |
| `/api/chat/adaptive/learning-state`                    | GET    | AI (FastAPI) | -    | `{ learning_state: { pace_mode, confidence_score, concept_mastery, ... } }` | Get current AI learning state  |
| `/api/analytics/learning?userId=...`                   | GET    | Analytics    | -    | `{ total_hours, questions_attempted, success_rate, ... }`                   | Get learning analytics         |
| `/api/analytics/pace?userId=...`                       | GET    | Analytics    | -    | `{ pace_mode, pace_score, recommendations, ... }`                           | Get pacing analytics           |
| `/api/analytics/concepts?userId=...`                   | GET    | Analytics    | -    | `{ concepts: [ { name, mastery, trend, ... }, ... ] }`                      | Get concept mastery breakdown  |
| `/api/adaptive/interventions/effectiveness?userId=...` | GET    | Analytics    | -    | `{ interventions: [ { id, type, effectiveness, ... }, ... ] }`              | Get intervention effectiveness |

---

## LOGIN - RECURRING (2nd+ Login)

| Endpoint                         | Method | Body                  | Response                          | Redirect Decision                       |
| -------------------------------- | ------ | --------------------- | --------------------------------- | --------------------------------------- |
| `/api/auth/login`                | POST   | `{ email, password }` | `{ token: "...", user: { ... } }` | Save token                              |
| `/api/adaptive/profiles/:userId` | GET    | -                     | `{ level: "intermediate", ... }`  | **HAVE PROFILE** → `/student-dashboard` |

---

## ERROR HANDLING & FALLBACKS

### Level Test Fails → Legacy Flow

```
If POST /api/chat/ai/level-test/start fails:
  → Use legacy endpoint: POST /api/adaptive/level-test/:studentId
  → Backend generates questions from exercises table
  → Stores result in LevelTest document
  → No AI profile created (fallback profile used)
```

### AI Service Down

```
Request: POST /api/chat/ai/level-test/submit-answer
Response: Error (503 Service Unavailable)

Fallback Triggered:
  → Switch to legacy submit: POST /api/adaptive/level-test/:id/submit
  → Unauthenticated user doesn't realize AI was down
  → Normal quiz flow continues
  → Results displayed normally (from legacy scoring)
```

---

## API Base URLs

| Service                  | URL                         | Status                      |
| ------------------------ | --------------------------- | --------------------------- |
| **Frontend**             | `http://localhost:4200`     | Development                 |
| **Backend (NestJS)**     | `http://localhost:3000/api` | Running (proxy for AI)      |
| **AI Service (FastAPI)** | `http://localhost:8000`     | Running (via backend proxy) |
| **MongoDB**              | `mongodb://localhost:27017` | Local                       |
| **ChromaDB**             | `./chroma_db/`              | Local vector DB             |
| **Ollama**               | `http://localhost:11434`    | LLM inference               |

---

## Data Models Created After Level Test

### User (Existing)

```javascript
{
  _id: ObjectId,
  first_name: String,
  last_name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  role: "student",
  createdAt: Date
}
```

### StudentProfile (NEW)

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  level: "beginner" | "intermediate" | "advanced",
  progress: Number (0-100),
  strengths: [String],
  weaknesses: [String],
  learningPreferences: {
    preferredStyle: String,
    preferredDifficulty: String,
    studyHoursPerDay: Number
  },
  learningState: {
    pace_mode: String,
    confidence_score: Number,
    concept_mastery: { [topic]: mastery_score }
  },
  points_gamification: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### LevelTest (NEW)

```javascript
{
  _id: ObjectId,
  studentId: String (ObjectId),
  questions: [
    {
      questionText: String,
      options: [String],
      correctAnswer: String,
      topic: String,
      difficulty: String
    }
  ],
  answers: [
    {
      questionIndex: Number,
      selectedAnswer: String,
      isCorrect: Boolean,
      timeSpent: Number
    }
  ],
  totalScore: Number,
  resultLevel: "beginner" | "intermediate" | "advanced",
  status: "in-progress" | "completed",
  createdAt: Date,
  completedAt: Date
}
```

### ActivityLog (NEW Entry)

```javascript
{
  userId: ObjectId,
  action: "REGISTER" | "LOGIN" | "LEVEL_TEST_STARTED" | "LEVEL_TEST_COMPLETED",
  timestamp: Date,
  metadata: { ... }
}
```

---

## HTTP Status Codes Reference

| Code    | Meaning             | Example                                    |
| ------- | ------------------- | ------------------------------------------ |
| **200** | OK                  | Profile found + returned                   |
| **201** | Created             | User registered successfully               |
| **400** | Bad Request         | Invalid form data                          |
| **401** | Unauthorized        | Wrong password                             |
| **404** | Not Found           | Profile doesn't exist → trigger level test |
| **409** | Conflict            | Email already registered                   |
| **500** | Server Error        | Backend error                              |
| **503** | Service Unavailable | AI service down → use fallback             |

---

## Request/Response Examples

### Example 1: Sign Up

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Ahmed",
    "last_name": "Ben Ali",
    "email": "ahmed@example.com",
    "password": "myPassword123",
    "phone": "+216123456"
  }'

# Response 201
{
  "message": "User registered successfully"
}
```

### Example 2: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ahmed@example.com",
    "password": "myPassword123"
  }'

# Response 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "first_name": "Ahmed",
    "last_name": "Ben Ali",
    "name": "Ahmed Ben Ali",
    "email": "ahmed@example.com",
    "role": "student"
  }
}
```

### Example 3: Check Profile

```bash
curl -X GET http://localhost:3000/api/adaptive/profiles/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer token_here"

# Response 200 (if profile exists)
{
  "_id": "507f1f77bcf86cd799439012",
  "userId": "507f1f77bcf86cd799439011",
  "level": "intermediate",
  "progress": 65,
  "strengths": ["Math", "English"],
  "weaknesses": ["Science"],
  "learningState": {
    "pace_mode": "adaptive",
    "confidence_score": 0.78,
    "concept_mastery": {
      "Math": 0.85,
      "Science": 0.45,
      "English": 0.92
    }
  }
}

# Response 404 (if first time)
{ "message": "Not Found" }
```

### Example 4: Start Level Test

```bash
curl -X POST http://localhost:3000/api/chat/ai/level-test/start \
  -H "Authorization: Bearer token_here" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response 200
{
  "session_id": "session_abc123xyz",
  "subjects": ["Math", "Science", "English"],
  "total_questions": 15,
  "first_question": {
    "question": "What is 2 + 2?",
    "options": ["3", "4", "5", "6"],
    "topic": "Math",
    "difficulty": "beginner"
  }
}
```

### Example 5: Submit Answer

```bash
curl -X POST http://localhost:3000/api/chat/ai/level-test/submit-answer \
  -H "Authorization: Bearer token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session_abc123xyz",
    "answer": "4"
  }'

# Response 200
{
  "correct": true,
  "next_question": {
    "question": "What is 3 + 3?",
    "options": ["5", "6", "9", "12"],
    "topic": "Math",
    "difficulty": "beginner"
  },
  "progress": "2/15",
  "finished": false
}
```

### Example 6: Complete Level Test

```bash
curl -X POST http://localhost:3000/api/chat/ai/level-test/complete \
  -H "Authorization: Bearer token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session_abc123xyz"
  }'

# Response 200
{
  "profile": {
    "level": "intermediate",
    "progress": 65,
    "strengths": ["Math", "English"],
    "weaknesses": ["Science"]
  },
  "learning_state": {
    "pace_mode": "adaptive",
    "confidence_score": 0.78,
    "concept_mastery": {
      "Math": 0.85,
      "Science": 0.45,
      "English": 0.92
    }
  }
}
```

### Example 7: Get Recommendations

```bash
curl -X POST http://localhost:3000/api/chat/ai/recommendations/personalized \
  -H "Authorization: Bearer token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "profile": {
      "level": "intermediate",
      "strengths": ["Math", "English"],
      "weaknesses": ["Science"]
    }
  }'

# Response 200
{
  "recommendations": [
    {
      "type": "focus_weak_topic",
      "title": "Strengthen your Science fundamentals",
      "description": "Science has been identified as an area for improvement...",
      "priority": "high",
      "suggested_course": "Science 101: Basics"
    },
    {
      "type": "accelerate_strong_topic",
      "title": "Level up your Math skills",
      "description": "You're excelling in Math! Let's push further...",
      "priority": "medium",
      "suggested_course": "Advanced Math: Calculus"
    }
  ]
}
```

---

**Ready to trace through an actual request? Check the main documentation! 📖**
