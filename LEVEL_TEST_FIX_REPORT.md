# 🔧 Fix: Level Test 500 Error - Root Cause & Solution

## 📋 Issue

When trying to start a level test, the AI service returned a **500 error**:

```
ERROR [AiService] startLevelTest failed: Request failed with status code 500
ERROR [ExceptionsHandler] Request failed with status code 500
AxiosError: Request failed with status code 500
```

## 🔍 Root Cause Analysis

### Discovery Process

1. **Frontend Error**: Student got 500 error when clicking "Start Level Test"
2. **Backend Log**: NestJS logged `"Failed to start level test: Request failed with status code 500"`
3. **AI Service**: Made request to AI service but got 500 response
4. **Test Call**: Made direct curl request to `/level-test/start` endpoint
5. **Real Error**: `"Failed to start level test: max_workers must be greater than 0"`

### The Problem Chain

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend clicks "Start Level Test"                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend: POST /api/chat/ai/level-test/start                │
│ Calls: adaptiveService.startLevelTest(studentId)            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ AI Service: POST /level-test/start                           │
│ Calls: adaptive_level_test.start_test(student_id)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ AdaptiveLevelTest.start_test()                              │
│ 1. Calls: _build_subject_map()                              │
│    → get_all_courses() from MongoDB                         │
│    → Returns: EMPTY LIST ❌  (NO COURSES IN DB)              │
│ 2. selected_subjects = []                                   │
│ 3. batch_input = []                                         │
│ 4. Calls: generate_all_subjects_parallel([])                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ batch_question_generator.py:208                             │
│ max_workers = min(_MAX_WORKERS=1, len(subjects)=0)         │
│         = min(1, 0)                                         │
│         = 0  ❌                                              │
│                                                              │
│ ThreadPoolExecutor(max_workers=0)                           │
│ → ValueError: "max_workers must be greater than 0"          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Exception caught at API level                               │
│ Raises: HTTPException(status_code=500, detail="...")        │
│ Response: 500 Internal Server Error                         │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Solution (2-Part Fix)

### Part 1: Fix max_workers Bug

**File**: `ai-service/level_test/batch_question_generator.py` (line 208)

**Before**:

```python
with ThreadPoolExecutor(max_workers=min(_MAX_WORKERS, len(subjects))) as pool:
```

**After**:

```python
# Ensure max_workers >= 1 (ThreadPoolExecutor requires this)
num_workers = max(1, min(_MAX_WORKERS, len(subjects)))
with ThreadPoolExecutor(max_workers=num_workers) as pool:
```

**Why**: ThreadPoolExecutor validates that `max_workers >= 1`. Using `max()` ensures we never pass 0 workers.

### Part 2: Add Fallback Subjects & Seed Courses

**File**: `ai-service/level_test/adaptive_engine.py` (lines 93-135)

Added fallback subject map when no courses exist in database:

```python
if not subject_map:
    logger.warning("⚠️  No courses found in database. Using fallback sample subjects.")
    subject_map = {
        "math_101": { ... },
        "science_101": { ... },
        "english_101": { ... }
    }
```

**Created**: `ai-service/seed_courses.py`

Runs seed script to populate real courses:

```bash
cd ai-service
python seed_courses.py
```

Inserts 4 sample courses into MongoDB:

- ✅ Mathematics Fundamentals (5 modules: Algebra, Geometry, Calculus, Statistics, Number Theory)
- ✅ General Science (5 modules: Physics, Chemistry, Biology, Earth Science, Astronomy)
- ✅ English & Literature (5 modules: Grammar, Vocabulary, Reading, Writing, Literature)
- ✅ World History (5 modules: Ancient, Medieval, Renaissance, Modern, Asian)

## 🧪 Verification

### Test 1: Before Fix

```bash
curl -X POST http://localhost:8000/level-test/start \
  -H "Content-Type: application/json" \
  -d '{"student_id": "test_123", "subjects": null}'

# Response: 500 Internal Server Error
# {"detail":"Failed to start level test: max_workers must be greater than 0"}
```

### Test 2: After Fix + Seeding

```bash
python seed_courses.py
# ✅ Seeded 4 courses

curl -X POST http://localhost:8000/level-test/start \
  -H "Content-Type: application/json" \
  -d '{"student_id": "test_123", "subjects": null}'

# Response: 200 OK
# {
#   "status": "success",
#   "session_id": "e75d93be-b924-4ca8-8501-a8f7d6904769",
#   "subjects": 4,
#   "total_questions": 20,
#   "first_question": "What is an important concept related to 'Algebra'..."
# }
```

## 📊 Impact

| Aspect              | Before           | After                        |
| ------------------- | ---------------- | ---------------------------- |
| Courses in DB       | 0                | 4+                           |
| Level Test Start    | ❌ 500 Error     | ✅ Works                     |
| Questions Generated | None             | 20 (5 per subject)           |
| Subjects Available  | N/A              | 4                            |
| User Impact         | Can't start test | Can take adaptive level test |

## 🚀 Deploy Steps

1. **Pull the code** with the two fixes:
   - `batch_question_generator.py` - max_workers fix
   - `adaptive_engine.py` - fallback subjects
   - `seed_courses.py` - new seed script

2. **Seed courses** (run once):

   ```bash
   cd ai-service
   python seed_courses.py
   # Output: ✅ Successfully seeded 4 courses!
   ```

3. **Restart AI service** (if running):

   ```bash
   # Kill current: uvicorn api:app --reload
   # Restart: uvicorn api:app --reload --host 0.0.0.0 --port 8000
   ```

4. **Test**: Try starting a level test in frontend
   - ✅ Should see first question
   - ✅ Should see 4 subjects
   - ✅ Should see 20 total questions

## 📝 Notes

- **Fallback Subjects**: If courses aren't seeded, the system still works with hardcoded fallback subjects (but quality is lower)
- **max_workers Fix**: Defensive programming - ensures ThreadPoolExecutor never fails due to 0 workers
- **Real Courses**: Seeding provides realistic questions from real educational content instead of generic fallback
- **Backward Compatible**: Changes don't break existing functionality - only enable previously broken feature

## ⚠️ Prevention

To prevent this issue in the future:

1. **Always seed courses** when initializing a new environment
2. **Add database validation** in startup health check:
   ```python
   if not get_all_courses():
       logger.error("❌ No courses found! Run: python seed_courses.py")
   ```
3. **Add defensive defaults** for all ThreadPoolExecutor usages (now done)
4. **Add integration test** for level-test/start endpoint

---

**Status**: ✅ FIXED & TESTED
**Deployed Date**: 2026-03-28
**Fix Type**: Bug Fix + Data Seeding
