# 📝 Scénario Complet: Sign Up → Login → Learning Journey

## 🎯 Vue d'ensemble

Quand un nouvel étudiant se sign up et login, voici le flux complet qui se déclenche :

---

## 📋 PHASE 1: SIGN UP (Inscription)

### 1. Utilisateur clique sur "Create Account"

- **URL**: `/register`
- **Page**: RegisterComponent
- **Données saisies**:
  - First Name
  - Last Name
  - Email (unique)
  - Phone (optionnel)
  - Password (min 6 caractères)
  - Confirm Password

### 2. Frontend envoie POST `/api/auth/register`

```javascript
// RegisterComponent.onSubmit()
POST /api/auth/register
Body: {
  first_name: "Ahmed",
  last_name: "Ben Ali",
  email: "ahmed@example.com",
  password: "hashedByFrontend",
  phone: "+216123456"
}
```

### 3. Backend traite l'inscription

**Endpoint**: `POST /api/auth/register` (NestJS AuthService)

**Étapes**:

1. ✅ Vérifie que l'email n'existe pas (sinon -> ConflictException)
2. ✅ Hash le password avec bcrypt (salt=10)
3. ✅ Crée l'utilisateur en MongoDB
   ```javascript
   User {
     first_name: "Ahmed",
     last_name: "Ben Ali",
     email: "ahmed@example.com",
     password: "$2b$10$..." (hashed),
     phone: "+216123456",
     role: "student", // Default role
     createdAt: Date.now()
   }
   ```
4. ✅ Envoie un **email de bienvenue** à l'adresse
5. ✅ Retourne: `{ message: "User registered successfully" }`

### 4. Frontend affiche confirmation

- ✅ Message de succès: "Registration successful! Please login."
- ✅ Réinitialise le formulaire
- ✅ Redirige vers `/login` après 2 secondes

---

## 📋 PHASE 2: LOGIN (Première connexion)

### 1. Utilisateur clique sur "Login"

- **URL**: `/login`
- **Page**: LoginComponent
- **Données saisies**:
  - Email: `ahmed@example.com`
  - Password: `...`

### 2. Frontend envoie POST `/api/auth/login`

```javascript
// LoginComponent.onSubmit()
POST /api/auth/login
Body: {
  email: "ahmed@example.com",
  password: "plaintext"
}
```

### 3. Backend valide les credentials

**Endpoint**: `POST /api/auth/login` avec guard LocalAuthGuard (Passport)

**Étapes**:

1. ✅ Cherche l'utilisateur par email
2. ✅ Compare le password avec bcrypt.compare()
3. ✅ Si valide: signe un JWT token
   ```javascript
   JWT Payload {
     email: "ahmed@example.com",
     sub: "userId_ObjectId",
     role: "student"
   }
   ```
4. ✅ Log l'activité: `ActivityAction.LOGIN`
5. ✅ Retourne:
   ```javascript
   {
     token: "eyJhbGciOiJIUzI1NiIs...",
     user: {
       id: "507f1f77bcf86cd799439011",
       first_name: "Ahmed",
       last_name: "Ben Ali",
       name: "Ahmed Ben Ali",
       email: "ahmed@example.com",
       role: "student"
     }
   }
   ```

### 4. Frontend stocke la session

```javascript
// AuthService.login() avec tap operator
localStorage.setItem("authToken", response.token);
localStorage.setItem("userRole", "student");
userSubject.next(response.user); // BehaviorSubject pour l'app
```

### 5. Frontend fait une redirection intelligente

**Endpoint**: `GET /api/adaptive/profiles/:userId` (AuthService)

```javascript
// LoginComponent: Check if profile exists
if (user.role === "student") {
  const userId = user._id || user.id;
  adaptiveService.getProfile(userId).subscribe({
    next: (profile) => {
      if (!profile || !profile.level) {
        // ❌ Pas de profil = PREMIÈRE CONNEXION
        router.navigate(["/level-test"]);
      } else {
        // ✅ Profil existe = CONNEXION RÉCURRENTE
        router.navigate(["/student-dashboard"]);
      }
    },
    error: () => {
      // ❌ Profil not found = PREMIÈRE CONNEXION
      router.navigate(["/level-test"]);
    },
  });
}
```

---

## 📋 PHASE 3: LEVEL TEST (Évaluation Initiale - Première Connexion Seulement)

### Context: Pourquoi le level test ?

- ✅ Le profil n'existe pas `profile.level` est vide
- ✅ C'est la **première connexion** de l'étudiant
- ✅ Le niveau initial (beginner/intermediate/advanced) est inconnu

### 1. Frontend navigue vers `/level-test`

**Component**: `LevelTestComponent`

### 2. Frontend initialise le test

```javascript
// LevelTestComponent.ngOnInit()
this.setupTest({
  // Données initiales vides
  questions: [],
  _id: null,
  total_questions: 0,
  session_id: null,
});
```

### 3. Utilisateur clique sur "Start Test"

**Endpoint**: `POST /api/chat/ai/level-test/start` (Proxy vers AI Service)

**AI Service (FastAPI on localhost:8000)** traite:

1. ✅ Récupère les **cours disponibles** depuis ChromaDB
2. ✅ Génère **5 questions par sujet** via LLM (Ollama)
3. ✅ Crée une **session_id** pour tracker les réponses
4. ✅ Les questions sont **cachées**, sauf la première
5. ✅ Retourne:
   ```javascript
   {
     session_id: "session_abc123",
     subjects: ["Math", "Science", "English"],
     total_questions: 15, // 5 par sujet
     first_question: {
       question: "What is 2 + 2?",
       options: ["3", "4", "5", "6"],
       topic: "Math",
       difficulty: "beginner"
     }
   }
   ```

### 4. Frontend transforme et affiche

```javascript
// AdaptiveLearningService.startLevelTest()
Transformation:
{
  _id: "session_abc123", // Pour compatibilité legacy
  session_id: "session_abc123", // Pour AI flow
  questions: [
    { question: "What is 2 + 2?", ... }, // Première question
    { question: "Loading...", options: [] }, // Placeholder pour Q2
    { question: "Loading...", options: [] }, // Placeholder pour Q3
    ...
  ],
  total_questions: 15,
  isAiGenerated: true
}

// LevelTestComponent affiche:
// - Question 1/15 (loaded)
// - Chronomètre
// - Boutons: Next/Previous
// - Sidebar with progress
```

### 5. Utilisateur répond aux 15 questions

- Navigue entre les questions
- Temps par question est tracké
- Réponses stockées dans `answers[]`

### 6. Utilisateur clique "Submit Test"

**Sequential AI Flow**:

#### 6a. Soumet toutes les réponses

```javascript
// AdaptiveLearningService.submitLevelTestAnswersToAi()
FOR EACH answer in answers[]:
  POST /api/chat/ai/level-test/submit-answer
  Body: {
    session_id: "session_abc123",
    answer: "4" // Ma réponse
  }

  Response:
  {
    correct: true/false,
    next_question: {
      question: "What is 3 + 3?",
      options: [...],
      topic: "Math"
    },
    progress: 2/15,
    finished: false
  }

  // Callback injecte next_question in testData.questions[index+1]
```

#### 6b. Complète le test

```javascript
POST /api/chat/ai/level-test/complete
Body: {
  session_id: "session_abc123"
}

Response:
{
  profile: {
    level: "intermediate", // Computed based on scores
    strengths: ["Math", "English"],
    weaknesses: ["Science"],
    progress: 65
  },
  learning_state: {
    pace_mode: "adaptive",
    confidence_score: 0.78,
    concept_mastery: {
      "Math": 0.85,
      "Science": 0.45,
      "English": 0.92
    }
  }
}
```

#### 6c. Récupère les recommandations

```javascript
POST /api/chat/ai/recommendations/personalized
Body: {
  profile: { ... from step 6b ... }
}

Response:
{
  recommendations: [
    {
      type: "focus_weak_topic",
      title: "Strengthen your Science fundamentals",
      description: "...",
      suggested_course: "Science 101",
      priority: "high"
    },
    {
      type: "accelerate_strong_topic",
      title: "Level up your Math skills",
      description: "...",
      suggested_course: "Advanced Math",
      priority: "medium"
    }
  ]
}
```

### 7. Backend crée le profil de l'étudiant

**Auto-triggered**: Après complétion du level test

```javascript
// StudentProfile créé en MongoDB:
StudentProfile {
  userId: "507f1f77bcf86cd799439011",
  level: "intermediate",
  academic_level: null,
  risk_level: "LOW",
  progress: 65,
  points_gamification: 0,
  learningPreferences: {
    preferredStyle: "visual",
    preferredDifficulty: "beginner",
    studyHoursPerDay: 1
  },
  strengths: ["Math", "English"],
  weaknesses: ["Science"],
  learningState: {
    pace_mode: "adaptive",
    confidence_score: 0.78,
    concept_mastery: { "Math": 0.85, "Science": 0.45, "English": 0.92 }
  },
  createdAt: Date.now()
}
```

### 8. Frontend affiche les résultats

**Route**: `/student-dashboard/level-test-result`
**Component**: `LevelTestResultComponent`

**Affichage**:

- ✅ Your Level: **INTERMEDIATE**
- ✅ Overall Score: **65%**
- ✅ Topics Breakdown:
  - Math: 85% ✅
  - English: 92% ✅
  - Science: 45% ⚠️
- ✅ **AI-Powered Recommendations**:
  1. "Strengthen your Science fundamentals" (Priority: HIGH)
  2. "Level up your Math skills" (Priority: MEDIUM)
- ✅ "Continue to Dashboard" button

---

## 📋 PHASE 4: STUDENT DASHBOARD (Après Level Test)

### 1. Navigator towards `/student-dashboard`

**Click**: "Continue to Dashboard" or direct navigation

### 2. StudentDashboardComponent initialise et charge

```javascript
// StudentDashboardComponent.ngOnInit()
1. Get current user from AuthService
2. Load basic profile info
3. Load Adaptive Data:
   - GET /api/analytics/learning (analytics service)
   - GET /api/analytics/pace
   - GET /api/analytics/concepts
   - GET /api/chat/adaptive/learning-state (AI service)
   - GET /api/adaptive/profiles/:userId (to refresh profile)
```

### 3. Dashboard affiche

**Widgets**:

- ✅ **Adaptive Profile Card**:
  - Level: **INTERMEDIATE**
  - Progress: **65%**
  - Pace: **adaptive**
  - Confidence: **78%**
  - Mastery: **74%**
- ✅ **Topic Rings** (Vue visuelle):
  - Math (85%) - Vert
  - English (92%) - Vert foncé
  - Science (45%) - Orange

- ✅ **AI Recommendations Panel**:
  1. Science fundamentals course
  2. Math advanced course
- ✅ **Learning Analytics**:
  - Hours studied
  - Questions attempted
  - Success rate

- ✅ **Quick Actions**:
  - Start Level Test Again (recalibrate)
  - Browse Courses
  - Take Quiz

---

## 📋 PHASE 5: CONNEXIONS FUTURES (Login Récurrent)

### 1. Utilisateur login à nouveau

Même process que Phase 2, MAIS:

```javascript
// LoginComponent redirect
const profile = getProfile(userId); // Returns profile with level="intermediate"

if (profile.level) {
  router.navigate(["/student-dashboard"]); // ✅ Directement au dashboard
  // SKIP level test
}
```

### 2. Dashboard charge les données continuées

- ✅ Affiche le même profil + analytics mises à jour
- ✅ Recommandations recalculées basées sur nouvelle progression
- ✅ Historique des quiz/exercices chargé
- ✅ Adaptive learning state actualisé depuis AI service

---

## 🎯 Résumé des Flux par Endpoint

### **SIGN UP**

```
Frontend: POST /api/auth/register
  ↓
Backend: Create User
  ↓
Response: { message: "success" }
  ↓
Frontend: Redirect to /login
```

### **LOGIN (First Time)**

```
Frontend: POST /api/auth/login
  ↓
Backend: Validate & Sign JWT
  ↓
LocalStorage: Save token + role
  ↓
Frontend: Check Profile → NOT FOUND
  ↓
Redirect: /level-test
```

### **LEVEL TEST**

```
Frontend: POST /api/chat/ai/level-test/start
  ↓
AI Service: Generate 5×3 questions, return first + session_id
  ↓
Frontend: Display question + placeholders
  ↓
User: Answer 15 questions (each → POST /submit-answer)
  ↓
AI Service: Complete test → POST /complete
  ↓
AI Service: Generate recommendations
  ↓
Backend: Create StudentProfile with level
  ↓
Frontend: Show results + recommendations
```

### **LOGIN (Subsequent Times)**

```
Frontend: POST /api/auth/login
  ↓
Backend: Validate & Sign JWT
  ↓
Frontend: Check Profile → FOUND (level="intermediate")
  ↓
Redirect: /student-dashboard
  ↓
Dashboard: Load adaptive data, analytics, recommendations
```

---

## 🗄️ Données Créées lors du Sign Up + Level Test

### **User (MongoDB)**

```javascript
{
  _id: ObjectId("507f1f77bcf86cd799439011"),
  first_name: "Ahmed",
  last_name: "Ben Ali",
  email: "ahmed@example.com",
  password: "$2b$10$...",
  phone: "+216123456",
  role: "student",
  createdAt: 2026-03-28T10:00:00Z
}
```

### **StudentProfile (MongoDB)**

```javascript
{
  _id: ObjectId(...),
  userId: ObjectId("507f1f77bcf86cd799439011"),
  level: "intermediate",
  progress: 65,
  strengths: ["Math", "English"],
  weaknesses: ["Science"],
  learningPreferences: {
    preferredStyle: "visual",
    preferredDifficulty: "beginner",
    studyHoursPerDay: 1
  },
  learningState: {
    pace_mode: "adaptive",
    confidence_score: 0.78,
    concept_mastery: { "Math": 0.85, "Science": 0.45, "English": 0.92 }
  },
  points_gamification: 0,
  createdAt: 2026-03-28T10:15:00Z
}
```

### **LevelTest (MongoDB)**

```javascript
{
  _id: ObjectId(...),
  studentId: "507f1f77bcf86cd799439011",
  questions: [
    { questionText: "...", options: [...], correctAnswer: "...", topic: "Math" },
    // ... 15 questions
  ],
  answers: [
    { questionIndex: 0, selectedAnswer: "4", isCorrect: true, timeSpent: 45 },
    // ... 15 answers
  ],
  totalScore: 65,
  resultLevel: "intermediate",
  status: "completed",
  createdAt: 2026-03-28T10:05:00Z,
  completedAt: 2026-03-28T10:15:00Z
}
```

### **Activity Log (MongoDB)**

```javascript
[
  { userId: "...", action: "REGISTER", timestamp: ... },
  { userId: "...", action: "LOGIN", timestamp: ... },
  { userId: "...", action: "LEVEL_TEST_STARTED", timestamp: ... },
  { userId: "...", action: "LEVEL_TEST_COMPLETED", timestamp: ... }
]
```

---

## ✅ Services Impliqués

| Service                     | Purpose                                         | Tech              |
| --------------------------- | ----------------------------------------------- | ----------------- |
| **AuthService**             | Login/Register/JWT                              | NestJS + Passport |
| **AdaptiveLearningService** | Profile CRUD                                    | NestJS + MongoDB  |
| **ChatController** (Proxy)  | Forward to AI                                   | NestJS            |
| **AI Service**              | Generate questions, adapt difficulty, recommend | FastAPI           |
| **ActivityService**         | Log user actions                                | MongoDB           |
| **Analytics Service**       | Compute metrics                                 | Python/FastAPI    |

---

## 🔄 État de l'Étudiant à Chaque Étape

| Étape               | User Exists | Profile Exists | Level Known | Test Taken                     |
| ------------------- | ----------- | -------------- | ----------- | ------------------------------ |
| After Sign Up       | ✅          | ❌             | ❌          | ❌                             |
| After Login (First) | ✅          | ❌             | ❌          | ❌ → Redirected to /level-test |
| During Level Test   | ✅          | In Creation    | ❌          | 🔄 In Progress                 |
| After Level Test    | ✅          | ✅             | ✅          | ✅ → Redirected to /dashboard  |
| After Login (2nd+)  | ✅          | ✅             | ✅          | ✅ → Redirected to /dashboard  |

---

## 🚨 Edge Cases Gérés

1. **Email déjà utilisé lors du sign up**
   - Exception: ConflictException
   - Message: "Email already exists"

2. **Mauvais password au login**
   - Exception: UnauthorizedException
   - Message: "Login failed. Please check your credentials."

3. **AI Service down lors du level test**
   - Fallback: Legacy level test endpoint
   - User: Sees normal test, no AI features

4. **Session perdue pendant le level test**
   - Recovery: Resume from last submitted answer
   - Data: Persisted in MongoDB session storage

5. **User tries to access /level-test après avoir complété**
   - Redirect: /student-dashboard
   - Reason: Level already determined

---

**That's the complete journey from Sign Up to Active Learner! 🎓**
