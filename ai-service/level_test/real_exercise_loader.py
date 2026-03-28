"""
Load real exercises and quizzes imported from teacher courses.

Instead of generating questions via LLM, this module loads the 76+ 
authentic exercises that were ingested from Support_Cours_Préparation.

Usage:
    from level_test.real_exercise_loader import get_level_test_questions
    
    questions = get_level_test_questions(
        course_id="...",
        num_questions=5,
        difficulty="medium"
    )
"""
import logging
from pathlib import Path
import sys

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.db_connection import get_database
from bson import ObjectId

logger = logging.getLogger("real_exercise_loader")


def get_exercises_by_course(course_id: str) -> list[dict]:
    """Fetch all exercises for a specific course."""
    try:
        course_id_obj = ObjectId(course_id)
    except:
        course_id_obj = course_id
    
    db = get_database()
    exercises = list(db["exercises"].find({"courseId": course_id_obj}))
    return exercises


def get_all_exercises() -> list[dict]:
    """Fetch all imported exercises from MongoDB."""
    db = get_database()
    exercises = list(db["exercises"].find({}))
    return exercises


def adapt_exercise_to_question(exercise: dict) -> dict:
    """
    Convert MongoDB exercise format to level-test question format.
    
    Input:  {type, content, options, correctAnswer, difficulty, courseId, ...}
    Output: {question, options, correct_answer, explanation, difficulty, ...}
    """
    return {
        "question": exercise.get("content", ""),
        "options": exercise.get("options", []),
        "correct_answer": exercise.get("correctAnswer", ""),
        "explanation": f"Question from {exercise.get('topic', 'course content')}",
        "difficulty": exercise.get("difficulty", "medium").lower(),
        "topic": exercise.get("topic", exercise.get("subject", "")),
        "type": exercise.get("type", "MCQ"),
        "source": "real_exercise",
        "original_id": str(exercise.get("_id", "")),
    }


def get_questions_by_difficulty(difficulty: str, count: int = 5) -> list[dict]:
    """
    Get real questions filtered by difficulty level.
    
    Args:
        difficulty: "easy", "medium", "hard"
        count: max number of questions to return
    
    Returns:
        List of adapted questions
    """
    exercises = get_all_exercises()
    filtered = [
        e for e in exercises 
        if e.get("difficulty", "medium").lower() == difficulty.lower()
    ]
    
    adapted = [adapt_exercise_to_question(e) for e in filtered[:count]]
    logger.info(f"Loaded {len(adapted)} {difficulty} questions")
    return adapted


def get_mixed_difficulty_questions(course_id: str = None, count: int = 5) -> list[dict]:
    """
    Get balanced mix of easy/medium/hard real questions.
    
    Args:
        course_id: optional filter to exercises from this course
        count: total questions to return
    
    Returns:
        List of adapted questions with balanced difficulty
    """
    if course_id:
        exercises = get_exercises_by_course(course_id)
    else:
        exercises = get_all_exercises()
    
    # Group by difficulty
    by_difficulty = {"easy": [], "medium": [], "hard": []}
    for ex in exercises:
        diff = ex.get("difficulty", "medium").lower()
        if diff not in by_difficulty:
            diff = "medium"
        by_difficulty[diff].append(adapt_exercise_to_question(ex))
    
    # Mix evenly: if count=5, try to get 2 easy, 2 medium, 1 hard (or balanced)
    result = []
    per_level = max(1, count // 3)
    for level in ["easy", "medium", "hard"]:
        available = by_difficulty[level]
        result.extend(available[:per_level])
    
    # Fill remaining slots with medium if needed (avoid infinite loop when empty)
    if by_difficulty["medium"]:
        while len(result) < count:
            to_add = by_difficulty["medium"][:count - len(result)]
            if not to_add:
                break
            result.extend(to_add)

    final = result[:count]
    logger.info(f"Loaded {len(final)} mixed-difficulty questions for course {course_id}")
    return final


def get_questions_for_course(course_id: str, num_questions: int = 5, difficulty: str = None) -> list[dict]:
    """
    Get real questions for a specific course.
    
    Args:
        course_id: MongoDB ObjectId or string ID
        num_questions: how many to return
        difficulty: optional filter ("easy", "medium", "hard")
    
    Returns:
        List of adapted questions
    """
    exercises = get_exercises_by_course(course_id)
    
    if difficulty:
        exercises = [
            e for e in exercises 
            if e.get("difficulty", "medium").lower() == difficulty.lower()
        ]
    
    adapted = [adapt_exercise_to_question(e) for e in exercises[:num_questions]]
    logger.info(f"Loaded {len(adapted)} questions for course {course_id}")
    return adapted


def get_level_test_questions(
    course_id: str = None,
    num_questions: int = 5,
    difficulty: str = "medium",
) -> list[dict]:
    """
    Main entry point: get real questions for level test.

    Prefers mixed difficulty. Falls back to specific difficulty if requested.
    """
    if difficulty == "mixed" or difficulty is None:
        return get_mixed_difficulty_questions(course_id, num_questions)
    return get_questions_for_course(course_id, num_questions, difficulty)


def count_available_exercises() -> int:
    """Count total exercises in MongoDB."""
    db = get_database()
    return db["exercises"].count_documents({})
