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
import random
import re
from pathlib import Path
import sys

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.db_connection import get_database
from bson import ObjectId

logger = logging.getLogger("real_exercise_loader")

_STOPWORDS = {
    "le", "la", "les", "de", "des", "du", "un", "une", "et", "ou", "dans", "pour", "avec",
    "que", "quel", "quelle", "quels", "quelles", "est", "sont", "the", "a", "an", "and", "or",
    "to", "of", "in", "on", "for", "is", "are",
}


def _question_identity(question: dict) -> str:
    """Stable identity key used to avoid duplicates in one test."""
    oid = str(question.get("original_id") or "").strip()
    if oid:
        return f"id:{oid}"
    return f"txt:{str(question.get('question', '')).strip().lower()}"


def _dedupe_questions(questions: list[dict]) -> list[dict]:
    """Remove duplicates while preserving original order."""
    out: list[dict] = []
    seen: set[str] = set()
    for q in questions or []:
        if not q:
            continue
        key = _question_identity(q)
        if key in seen:
            continue
        seen.add(key)
        out.append(q)
    return out


def _clean_question_text(raw: str) -> str:
    """Normalize imported question text to a single readable prompt."""
    text = (raw or "").replace("\r", "\n").strip()
    if not text:
        return ""

    lines = [ln.strip() for ln in text.split("\n") if ln and ln.strip()]

    def _is_question_marker_line(s: str) -> bool:
        return bool(re.match(r"^question\s*\d+\b", s.strip(), re.IGNORECASE))

    def _is_option_line(s: str) -> bool:
        return bool(re.match(r"^[A-Ea-e]\s*[\.)]\s*", s.strip()))

    def _is_code_like_line(s: str) -> bool:
        t = s.strip()
        if not t:
            return False
        if re.search(r"[{};]|==|!=|<=|>=|\+\+|--", t):
            return True
        if re.search(r"\b(printf|scanf|cout|cin|System\.out|return|for|while|if|else|switch|case|default|int|float|double|char|void)\b", t):
            return True
        if re.search(r"['\"]", t):
            return True
        return False
    # Drop headings like "Quiz 1 : ..."
    lines = [ln for ln in lines if not re.match(r"^quiz\s*\d+\s*[:\-]", ln, re.IGNORECASE)]
    if not lines:
        return text

    def _normalize_line(s: str) -> str:
        s = re.sub(r"^question\s*[:\-]?\s*", "", s, flags=re.IGNORECASE).strip()
        s = re.sub(r"^\d+\s*[\.)]\s*", "", s).strip()
        return s

    # Remove explicit section markers ("Question 2", ...).
    lines = [ln for ln in lines if not _is_question_marker_line(ln)]
    if not lines:
        return ""

    def _is_option_line(s: str) -> bool:
        return bool(re.match(r"^[A-Ea-e]\s*[\.)]\s*", s.strip()))

    def _is_code_like_line(s: str) -> bool:
        t = s.strip()
        if not t:
            return False
        if re.search(r"[{};]|==|!=|<=|>=|\+\+|--", t):
            return True
        if re.search(r"\b(printf|scanf|cout|cin|System\.out|return|for|while|if|else|int|float|double|char|void)\b", t):
            return True
        if re.search(r"['\"]", t):
            return True
        return False

    # Prefer the most specific line among question-like lines.
    question_lines = [ln for ln in lines if "?" in ln]
    if question_lines:
        def _score(s: str) -> int:
            # More specific prompts often contain values/operators and are longer.
            has_expr = bool(re.search(r"[%+\-/*=]|\d", s))
            return len(s) + (25 if has_expr else 0)

        best = max(question_lines, key=_score)
        best_idx = lines.index(best)
        base = _normalize_line(best)

        # Keep surrounding code context (both before and after) so programming
        # questions remain complete and not truncated.
        before: list[str] = []
        for prev in reversed(lines[max(0, best_idx - 8) : best_idx]):
            if "?" in prev:
                break
            if _is_option_line(prev) or _is_question_marker_line(prev):
                break
            if _is_code_like_line(prev):
                before.append(prev.strip())
                continue
            if before:
                break
        before.reverse()

        after: list[str] = []
        for follow in lines[best_idx + 1 : best_idx + 8]:
            if "?" in follow:
                break
            if _is_option_line(follow) or _is_question_marker_line(follow):
                break
            if _is_code_like_line(follow):
                after.append(follow.strip())
                continue
            if after:
                break

        merged = []
        for part in before + [base] + after:
            if not part:
                continue
            if merged and merged[-1] == part:
                continue
            merged.append(part)
        return "\n".join(merged) if merged else base

    # Fallback to first non-empty line.
    return _normalize_line(lines[0])


def _is_multi_question_blob(raw: str) -> bool:
    """Detect imported records that accidentally contain multiple numbered prompts."""
    text = (raw or "").replace("\r", "\n")
    if not text.strip():
        return False

    lines = [ln.strip() for ln in text.split("\n") if ln and ln.strip()]
    marker_lines = 0
    numbered_questions = 0
    question_like_lines = 0
    for ln in lines:
        if re.match(r"^question\s*\d+\b", ln, re.IGNORECASE):
            marker_lines += 1
        if re.match(r"^\d+\s*[\.)]\s*.*\?$", ln):
            numbered_questions += 1
        if "?" in ln:
            question_like_lines += 1

    # Case 1: explicit numbered list of multiple prompts.
    if numbered_questions >= 2:
        return True

    # Case 2: multiple question stems in one blob (common import artifact).
    if question_like_lines >= 2 and text.count("?") >= 2:
        return True

    # Case 3: explicit question section markers inside one exercise document.
    if marker_lines >= 1 and question_like_lines >= 1:
        return True

    return False


def _has_basic_question_option_coherence(question_text: str, options: list[str]) -> bool:
    """Light heuristic to discard obviously mismatched stem/options pairs."""
    if not question_text or not options:
        return False

    q_tokens = {
        t
        for t in re.findall(r"[A-Za-zÀ-ÿ]{4,}", question_text.lower())
        if t not in _STOPWORDS
    }
    if len(q_tokens) < 4:
        return True

    overlap = 0
    for opt in options:
        body = re.sub(r"^[A-E]\s*[\.)]\s*", "", str(opt or "")).strip().lower()
        o_tokens = {
            t
            for t in re.findall(r"[A-Za-zÀ-ÿ]{4,}", body)
            if t not in _STOPWORDS
        }
        overlap += len(q_tokens.intersection(o_tokens))

    if overlap > 0:
        return True

    # Allow compact symbolic/boolean MCQs where lexical overlap is naturally low.
    compact_bodies = [
        re.sub(r"^[A-E]\s*[\.)]\s*", "", str(opt or "")).strip().lower()
        for opt in options
    ]
    bool_set = {"true", "false", "vrai", "faux", "yes", "no"}
    if compact_bodies and all((b in bool_set) or (len(b) <= 3) for b in compact_bodies):
        return True

    return False


def _is_complete_prompt(question_text: str) -> bool:
    """Detect obviously truncated prompts, especially for programming/code questions."""
    q = (question_text or "").strip().lower()
    if not q:
        return False

    if re.fullmatch(r"quelle est la sortie\s*\?", q):
        return False

    asks_output = bool(
        re.search(r"quelle est la sortie|que va[- ]t[- ]il s[’']afficher|what is the output", q)
    )
    if asks_output:
        has_output_call = bool(re.search(r"printf|cout|system\.out|print\b", q))
        if not has_output_call:
            return False

    asks_code_context = bool(
        re.search(
            r"soit le code suivant|consid[eé]rez le code suivant|given the following code|following code",
            q,
        )
    )
    if asks_code_context:
        has_code_context = bool(
            re.search(r"\n|;|\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcase\b|\breturn\b", q)
        )
        if not has_code_context:
            return False

    return True


def _clean_options(raw_options: list) -> list[str]:
    """Normalize options while preserving answer semantics expected by backend."""
    cleaned: list[str] = []
    seen: set[str] = set()

    for i, opt in enumerate(raw_options or []):
        text = str(opt or "").strip()
        if not text:
            continue

        # Ensure canonical prefix A./B./C./D.
        m = re.match(r"^([A-Ea-e])\s*[\.)]\s*(.+)$", text)
        if m:
            label = m.group(1).upper()
            body = m.group(2).strip()
            candidate = f"{label}. {body}"
        else:
            label = chr(ord("A") + i)
            candidate = f"{label}. {text}"

        key = candidate.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(candidate)

    return cleaned


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


def _resolve_correct_answer(options: list[str], correct_raw: str) -> str | None:
    """Resolve the correct answer to one of the normalized options."""
    if not options:
        return None

    raw = (correct_raw or "").strip()
    if not raw:
        return None

    # Case 1: labeled input like "B. ..." or "B) ..."
    m = re.match(r"^([A-Ea-e])\s*[\.)]\s*(.+)$", raw)
    if m:
        label = m.group(1).upper()
        body = m.group(2).strip().lower()

        # Prefer exact normalized value when present.
        exact = f"{label}. {m.group(2).strip()}"
        if exact in options:
            return exact

        # Otherwise match by same label and same body.
        labeled = [o for o in options if o.startswith(f"{label}.")]
        for opt in labeled:
            opt_body = re.sub(r"^[A-E]\s*[\.)]\s*", "", opt).strip().lower()
            if opt_body == body:
                return opt

        # Last fallback: same label only.
        if labeled:
            return labeled[0]

    # Case 2: raw answer text without label -> match option body.
    raw_lower = raw.lower()
    for opt in options:
        opt_body = re.sub(r"^[A-E]\s*[\.)]\s*", "", opt).strip().lower()
        if opt_body == raw_lower:
            return opt

    return None


def adapt_exercise_to_question(exercise: dict) -> dict | None:
    """
    Convert MongoDB exercise format to level-test question format.
    
    Input:  {type, content, options, correctAnswer, difficulty, courseId, ...}
    Output: {question, options, correct_answer, explanation, difficulty, ...}
    """
    raw_content = str(exercise.get("content", ""))
    if _is_multi_question_blob(raw_content):
        # Imported parsing artifact: one exercise contains multiple prompts.
        return None

    question_text = _clean_question_text(raw_content)
    options = _clean_options(exercise.get("options", []))
    correct_answer = _resolve_correct_answer(options, str(exercise.get("correctAnswer", "")))

    # Drop malformed/incomplete questions, but relaxed criteria to maximize real pool
    if not question_text or len(question_text) < 12:
        return None
    if len(options) < 3:  # Relaxed: accept 3+ options, not just 4
        return None
    if not correct_answer:
        return None
    # Relaxed: "Que va-t-il s'afficher" accepted even if code not perfectly preserved
    is_output_q = bool(re.search(r"quelle est la sortie|que va[- ]t[- ]il s['']afficher|what is the output", question_text.lower()))
    if is_output_q:
        # Must have some code markers or output call
        if not re.search(r"[{};]|\d+|printf|cout|return|if|for|while|switch", question_text):
            return None
    elif not _is_complete_prompt(question_text):
        return None
    if not _has_basic_question_option_coherence(question_text, options):
        return None

    return {
        "question": question_text,
        "options": options,
        "correct_answer": correct_answer,
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
    
    adapted = [q for q in (adapt_exercise_to_question(e) for e in filtered) if q is not None]
    adapted = _dedupe_questions(adapted)[:count]
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
        adapted = adapt_exercise_to_question(ex)
        if adapted is not None:
            by_difficulty[diff].append(adapted)

    # Shuffle to avoid deterministic repetition across sessions.
    for level in by_difficulty:
        random.shuffle(by_difficulty[level])
    
    # Mix evenly: if count=5, try to get 2 easy, 2 medium, 1 hard (or balanced)
    result: list[dict] = []
    used_keys: set[str] = set()
    per_level = max(1, count // 3)
    for level in ["easy", "medium", "hard"]:
        added = 0
        for q in by_difficulty[level]:
            key = _question_identity(q)
            if key in used_keys:
                continue
            result.append(q)
            used_keys.add(key)
            added += 1
            if added >= per_level or len(result) >= count:
                break
    
    # Fill remaining slots with medium if needed (avoid infinite loop when empty)
    if by_difficulty["medium"] and len(result) < count:
        for q in by_difficulty["medium"]:
            key = _question_identity(q)
            if key in used_keys:
                continue
            result.append(q)
            used_keys.add(key)
            if len(result) >= count:
                break

    # Last fill from any level, still deduped.
    if len(result) < count:
        for level in ["easy", "hard", "medium"]:
            for q in by_difficulty[level]:
                key = _question_identity(q)
                if key in used_keys:
                    continue
                result.append(q)
                used_keys.add(key)
                if len(result) >= count:
                    break
            if len(result) >= count:
                break

    final = _dedupe_questions(result)[:count]
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
    
    adapted = [q for q in (adapt_exercise_to_question(e) for e in exercises) if q is not None]
    adapted = _dedupe_questions(adapted)[:num_questions]
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
