"""
Question generator - AI-generated level test and adaptive questions via Ollama.
"""
import json
import re

import config
import langchain_ollama
import prompt_templates
import db_connection

# Default topics per subject when topics is None in generate_multiple_questions
DEFAULT_TOPICS = {
    "Mathematics": "algebra, geometry, calculus, statistics",
    "Physics": "mechanics, waves, thermodynamics, electromagnetism",
    "Programming": "variables, loops, conditionals, functions",
    "General": "general knowledge, reasoning, problem solving",
}

REQUIRED_QUESTION_FIELDS = ["question", "options", "correct_answer", "explanation"]


def parse_json_response(response_text):
    """
    Extracts JSON from LLM response. Handles markdown code blocks (```json ... ```) or raw {...}.
    Returns parsed JSON (dict or list) or None on failure.
    """
    if not response_text or not isinstance(response_text, str):
        return None
    text = response_text.strip()
    # Try to extract from ```json ... ``` or ``` ... ```
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        text = code_block.group(1).strip()
    # Find first { or [ and last } or ]
    start_obj = text.find("{")
    start_arr = text.find("[")
    if start_obj >= 0 and (start_arr < 0 or start_obj < start_arr):
        end = text.rfind("}")
        if end > start_obj:
            try:
                return json.loads(text[start_obj : end + 1])
            except json.JSONDecodeError:
                pass
    if start_arr >= 0:
        end = text.rfind("]")
        if end > start_arr:
            try:
                return json.loads(text[start_arr : end + 1])
            except json.JSONDecodeError:
                pass
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def validate_question(question_dict):
    """
    Checks if question has all required fields: question, options, correct_answer, explanation.
    options must be a list (ideally of 4 items).
    Returns True if valid, False otherwise.
    """
    if not question_dict or not isinstance(question_dict, dict):
        return False
    for key in REQUIRED_QUESTION_FIELDS:
        if key not in question_dict:
            return False
    if not isinstance(question_dict.get("options"), list):
        return False
    if not isinstance(question_dict.get("question"), str) or not question_dict["question"].strip():
        return False
    return True


def generate_level_test_question(subject, difficulty="medium", topic="general"):
    """
    Generates a single level test question using the prompt template and Ollama LLM.
    Parses JSON, validates, retries once on failure.
    Returns question dict {question, options, correct_answer, explanation} or None.
    """
    prompt = prompt_templates.get_level_test_prompt(subject, difficulty, topic)
    for attempt in range(2):
        try:
            print(f"[question_generator] generate_level_test_question attempt {attempt + 1}: subject={subject}, difficulty={difficulty}, topic={topic}")
            response = langchain_ollama.generate_response(prompt)
            if not response:
                continue
            data = parse_json_response(response)
            if data is None:
                print("[question_generator] Invalid JSON in response, retrying...")
                continue
            # Handle single object (not wrapped in array)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if not isinstance(data, dict):
                continue
            if validate_question(data):
                return data
            print("[question_generator] Generated question missing required fields.")
        except Exception as e:
            print(f"[question_generator] generate_level_test_question error: {e}")
    return None


def generate_multiple_questions(subject, difficulty="medium", num_questions=5, topics=None):
    """
    Generates multiple questions in one call using get_multiple_questions_prompt.
    If topics is None, uses default topics for the subject.
    Returns list of question dicts.
    """
    if topics is None:
        topics = DEFAULT_TOPICS.get(subject, DEFAULT_TOPICS["General"])
    topics_str = topics if isinstance(topics, str) else ", ".join(str(t) for t in topics)
    prompt = prompt_templates.get_multiple_questions_prompt(subject, difficulty, num_questions, topics_str)
    try:
        print(f"[question_generator] generate_multiple_questions: subject={subject}, n={num_questions}")
        response = langchain_ollama.generate_response(prompt)
        if not response:
            return []
        data = parse_json_response(response)
        if data is None:
            print("[question_generator] Failed to parse JSON from multiple-questions response.")
            return []
        if not isinstance(data, list):
            data = [data] if isinstance(data, dict) else []
        result = []
        for i, item in enumerate(data):
            if isinstance(item, dict) and validate_question(item):
                result.append(item)
            else:
                print(f"[question_generator] Skipping invalid question at index {i}")
        return result
    except Exception as e:
        print(f"[question_generator] generate_multiple_questions error: {e}")
        return []


def _difficulty_from_scores(previous_scores):
    """Maps average score to difficulty: low -> hard, medium -> medium, high -> easy."""
    if not previous_scores:
        return "medium"
    try:
        nums = [float(x) for x in previous_scores if x is not None]
        if not nums:
            return "medium"
        avg = sum(nums) / len(nums)
        if avg < 50:
            return "easy"
        if avg > 75:
            return "hard"
        return "medium"
    except (TypeError, ValueError):
        return "medium"


def generate_adaptive_question(subject, student_profile):
    """
    Generates a personalized question based on student_profile.
    student_profile: dict with weak_areas, current_level, previous_scores.
    Determines difficulty from performance and uses get_adaptive_question_prompt.
    Returns question dict or None.
    """
    profile = student_profile or {}
    weak_areas = profile.get("weak_areas", "general")
    if isinstance(weak_areas, list):
        weak_areas = ", ".join(str(x) for x in weak_areas)
    previous_scores = profile.get("previous_scores", [])
    difficulty = _difficulty_from_scores(previous_scores)
    previous_performance = f"Current level: {profile.get('current_level', 'unknown')}. Previous scores: {previous_scores}"
    prompt = prompt_templates.get_adaptive_question_prompt(subject, weak_areas, difficulty, previous_performance)
    try:
        print(f"[question_generator] generate_adaptive_question: subject={subject}, difficulty={difficulty}")
        response = langchain_ollama.generate_response(prompt)
        if not response:
            return None
        data = parse_json_response(response)
        if isinstance(data, list) and len(data) > 0:
            data = data[0]
        if isinstance(data, dict) and validate_question(data):
            return data
        return None
    except Exception as e:
        print(f"[question_generator] generate_adaptive_question error: {e}")
        return None


def save_question_to_db(question_dict, course_id, source="AI"):
    """
    Saves question to MongoDB 'exercises' collection.
    Fields: courseId, difficulty, content (question text), correctAnswer, type="MCQ", source, options, explanation.
    Returns saved question ID (string) or None.
    """
    if not question_dict or not validate_question(question_dict):
        print("[question_generator] save_question_to_db: invalid question dict.")
        return None
    try:
        doc = {
            "courseId": course_id,
            "difficulty": question_dict.get("difficulty", "medium"),
            "content": question_dict.get("question", ""),
            "correctAnswer": question_dict.get("correct_answer", ""),
            "type": "MCQ",
            "source": source,
            "options": question_dict.get("options", []),
            "explanation": question_dict.get("explanation", ""),
        }
        inserted_id = db_connection.insert_exercise(doc)
        return inserted_id
    except Exception as e:
        print(f"[question_generator] save_question_to_db error: {e}")
        return None


def generate_and_save_level_test(subject, num_questions=10, course_id="level-test"):
    """
    Generates a complete level test: 3 easy, 4 medium, 3 hard (or proportional).
    Saves all questions to the database and returns list of question IDs.
    """
    n = max(1, num_questions)
    n_easy = max(0, (n * 3) // 10)
    n_hard = max(0, (n * 3) // 10)
    n_medium = n - n_easy - n_hard
    if n_medium < 0:
        n_medium = 0
        n_easy = n // 2
        n_hard = n - n_easy
    counts = [("easy", n_easy), ("medium", n_medium), ("hard", n_hard)]
    all_ids = []
    total = 0
    for difficulty, count in counts:
        if count <= 0:
            continue
        print(f"[question_generator] Generating {count} {difficulty} questions...")
        questions = generate_multiple_questions(subject, difficulty=difficulty, num_questions=count, topics=None)
        for i, q in enumerate(questions):
            q["difficulty"] = difficulty
            qid = save_question_to_db(q, course_id, source="AI")
            if qid:
                all_ids.append(qid)
                total += 1
                print(f"[question_generator] Saved question {total}/{n}: id={qid}")
    print(f"[question_generator] generate_and_save_level_test: saved {len(all_ids)} questions.")
    return all_ids


if __name__ == "__main__":
    print("=== Question generator tests ===\n")

    print("1. parse_json_response (markdown):")
    s = 'Here is the answer:\n```json\n{"question": "Q?", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "E"}\n```'
    out = parse_json_response(s)
    print("   Valid:", validate_question(out) if isinstance(out, dict) else False)

    print("\n2. generate_level_test_question (single):")
    q = generate_level_test_question("Mathematics", "easy", "algebra")
    if q:
        print("   Question:", q.get("question", "")[:60] + "...")
        print("   Options:", len(q.get("options", [])))
    else:
        print("   (Skipped or failed - Ollama may not be running)")

    print("\n3. validate_question:")
    print("   Valid dict:", validate_question({"question": "Q?", "options": ["A","B","C","D"], "correct_answer": "A", "explanation": "E"}))
    print("   Missing field:", validate_question({"question": "Q?", "options": []}))

    print("\nDone.")
