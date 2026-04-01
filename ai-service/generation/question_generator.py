"""
Question generator - AI-generated level test and adaptive questions via Ollama.
"""
import difflib
import json
import re
import unicodedata
from typing import Any

from core import config, db_connection
from core.rag_service import RAGService
from utils import langchain_ollama
from . import prompt_templates
from .level_test_quality import reject_level_test_question, topic_slot_aligned

# Default topics per subject when topics is None in generate_multiple_questions
DEFAULT_TOPICS = {
    "Mathematics": "algebra, geometry, calculus, statistics",
    "Physics": "mechanics, waves, thermodynamics, electromagnetism",
    "Programming": "variables, loops, conditionals, functions",
    "General": "general knowledge, reasoning, problem solving",
}

REQUIRED_QUESTION_FIELDS = ["question", "options", "correct_answer", "explanation"]  # JSON MCQ contract


def _normalize_json_text(text: str) -> str:
    """Replace smart quotes that break strict JSON parsers."""
    return text.translate(
        str.maketrans(
            {
                "\u201c": '"',
                "\u201d": '"',
                "\u2018": "'",
                "\u2019": "'",
            }
        )
    )


def parse_json_value(response_text: str) -> Any | None:
    """
    Parse the first JSON object or array from an LLM response.

    Uses json.JSONDecoder.raw_decode so braces inside strings and trailing prose
    do not break parsing (unlike slice-to-last-} heuristics).
    """
    if not response_text or not isinstance(response_text, str):
        return None
    text = response_text.strip()
    code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if code_block:
        text = code_block.group(1).strip()
    text = _normalize_json_text(text)

    for opener in ("{", "["):
        start = 0
        while True:
            idx = text.find(opener, start)
            if idx < 0:
                break
            try:
                obj, _ = json.JSONDecoder().raw_decode(text, idx)
                return obj
            except json.JSONDecodeError:
                start = idx + 1

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def parse_json_response(response_text):
    """
    Extracts JSON from LLM response. Handles markdown fences and surrounding text.
    Returns parsed JSON (dict or list) or None on failure.
    """
    return parse_json_value(response_text)

def repair_to_strict_json(
    raw_text: str,
    *,
    model_name: str | None = None,
) -> Any | None:
    """
    Ask the model to rewrite its output as STRICT JSON only.
    This is a second-chance step when the first generation returns prose or malformed JSON.
    """
    if not raw_text or not isinstance(raw_text, str):
        return None
    repair_prompt = (
        "You are a JSON formatter.\n"
        "Rewrite the content below into STRICT JSON ONLY.\n"
        "Rules:\n"
        "- Output ONLY a single JSON value (object or array). No prose, no markdown fences.\n"
        "- Use double quotes for all JSON strings.\n"
        "- Preserve the intended fields for an MCQ: question, options (4 strings), correct_answer, "
        "difficulty, explanation, topic.\n"
        "- correct_answer MUST exactly match one element of options.\n\n"
        "CONTENT TO REFORMAT:\n"
        "---\n"
        f"{raw_text.strip()}\n"
        "---\n\n"
        "JSON:"
    )
    try:
        if model_name:
            fixed = langchain_ollama.generate_with_model(repair_prompt, model_name)
        else:
            fixed = langchain_ollama.generate_response(repair_prompt)
        return parse_json_value(fixed)
    except Exception:
        return None


def _generate_level_test_llm(prompt: str) -> str:
    """Use dedicated strong model for level-test generation (see OLLAMA_LEVEL_TEST_MODEL in .env)."""
    primary = getattr(config, "OLLAMA_LEVEL_TEST_MODEL", None) or config.OLLAMA_MODEL
    text = langchain_ollama.generate_with_model(prompt, primary)
    if text:
        return text
    fb = getattr(config, "OLLAMA_LEVEL_TEST_MODEL_FALLBACK", None) or ""
    fb = fb.strip()
    if fb:
        text = langchain_ollama.generate_with_model(prompt, fb)
        if text:
            return text
    # Last resort: default chat model (e.g. mistral)
    return langchain_ollama.generate_response(prompt)


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


def _strip_accents(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def extract_key_terms(text: str, min_length: int = 4) -> list[str]:
    """
    Extract candidate key terms from course content for grounding checks.
    """
    if not isinstance(text, str):
        return []
    norm = _strip_accents(text).lower()

    tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", norm)
    common_words = {
        "le",
        "la",
        "les",
        "un",
        "une",
        "des",
        "est",
        "sont",
        "dans",
        "pour",
        "avec",
        "sans",
        "ou",
        "et",
        "que",
        "qui",
        "quoi",
        "comme",
        "faire",
        "fait",
        "code",
        "en",
        "du",
        "des",
        "au",
        "aux",
        "par",
        "sur",
        "lorsque",
        "lors",
        "plus",
        "moins",
        "c",
        "g",
        "d",
    }

    terms = [t for t in tokens if len(t) >= min_length and t not in common_words]

    # Ensure short C keywords are not filtered out
    c_keywords = [
        "int",
        "char",
        "float",
        "double",
        "long",
        "short",
        "unsigned",
        "signed",
        "void",
        "struct",
        "typedef",
        "enum",
        "if",
        "else",
        "for",
        "while",
        "return",
        "printf",
        "scanf",
        "malloc",
        "free",
        "sizeof",
        "null",
        "true",
        "false",
        "const",
        "static",
        "pointer",
        "pointeur",
        "malloc",
    ]
    for kw in c_keywords:
        if kw in norm:
            terms.append(kw)

    out: list[str] = []
    seen: set[str] = set()
    for t in terms:
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
    return out[:20]


def canonicalize_correct_answer_in_place(question_dict: dict) -> bool:
    """
    If correct_answer matches one option modulo accents, quotes, or minor spacing, set it to that
    option's exact string. Uses a tight fuzzy match when exactly one option is close enough.
    Returns True when a unique option was identified (including already-exact match).
    """
    opts = question_dict.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    ca = question_dict.get("correct_answer")
    if ca is None or str(ca).strip() == "":
        return False

    ca_s = str(ca).strip()
    # Letter or index labels (small models sometimes output "B" instead of full option text)
    letter = re.match(r"^\s*([A-Da-d])\s*$", ca_s)
    if letter:
        i = ord(letter.group(1).upper()) - ord("A")
        if 0 <= i < len(opts):
            question_dict["correct_answer"] = opts[i]
            return True
    num = re.match(r"^\s*([1-4])\s*$", ca_s)
    if num:
        i = int(num.group(1)) - 1
        if 0 <= i < len(opts):
            question_dict["correct_answer"] = opts[i]
            return True

    def norm(s: str) -> str:
        t = _strip_accents(str(s)).lower().strip()
        t = t.strip('"').strip("'").replace("\u2019", "'")
        return re.sub(r"\s+", " ", t)

    nca = norm(str(ca))
    pairs: list[tuple[str, str]] = [(norm(str(o)), str(o)) for o in opts]

    for no, raw in pairs:
        if no == nca:
            question_dict["correct_answer"] = raw
            return True

    candidates = [no for no, _ in pairs]
    close = difflib.get_close_matches(nca, candidates, n=1, cutoff=0.9)
    if len(close) == 1:
        for no, raw in pairs:
            if no == close[0]:
                question_dict["correct_answer"] = raw
                return True
    close2 = difflib.get_close_matches(nca, candidates, n=2, cutoff=0.82)
    if len(close2) == 1:
        for no, raw in pairs:
            if no == close2[0]:
                question_dict["correct_answer"] = raw
                return True
    return False


def validate_question_quality(
    question_dict: dict,
    course_content: str,
    topic: str | None = None,
) -> bool:
    """
    Validate that the generated question is specific, non-vague, and grounded in the provided course content.
    """
    canonicalize_correct_answer_in_place(question_dict)

    issues: list[str] = []
    r = reject_level_test_question(question_dict, slot_topic=topic, course_context=course_content)
    if r:
        issues.append(f"Rejected pattern: {r}")
    if topic and str(topic).strip() and not topic_slot_aligned(question_dict, str(topic).strip()):
        issues.append("Question does not align with the target topic.")

    q_text = _strip_accents(str(question_dict.get("question") or "")).lower().strip()
    options_text = _strip_accents(" ".join(str(x) for x in (question_dict.get("options") or []))).lower()
    correct_raw = str(question_dict.get("correct_answer") or "")
    correct_norm = _strip_accents(correct_raw).lower().strip()

    # Check 3: Options distinctness
    option_norms = [
        _strip_accents(str(x)).lower().strip()
        for x in (question_dict.get("options") or [])
    ]
    if len(set(option_norms)) < 3:
        issues.append("Options are not distinct enough.")

    # Check 4: Grounding: at least one key term should appear in question/options/correct
    course_terms = extract_key_terms(course_content, min_length=3)
    if not course_terms:
        issues.append("No key terms extracted from course content.")
    else:
        combined = f"{q_text} {options_text} {correct_norm}"
        if not any(term in combined for term in course_terms):
            issues.append("Question/options don't seem grounded in provided course content.")

    # Check 5: Correct answer must match ONE option exactly (or trivially after whitespace/quotes)
    if correct_norm and option_norms:
        def _trim_trivial(s: str) -> str:
            return s.strip().strip('"').strip("'")

        cn = _trim_trivial(correct_norm)
        exact = any(_trim_trivial(opt) == cn for opt in option_norms)
        if not exact:
            # Allow only punctuation-only suffix differences (avoid partial matches like "int a;" vs "int a; a=...").
            ok = False
            for opt in option_norms:
                on = _trim_trivial(opt)
                if on.startswith(cn):
                    extra = on[len(cn):].strip()
                    if not extra or all(ch in ";,." for ch in extra):
                        ok = True
                        break
            if not ok:
                issues.append("Correct answer does not exactly match any option text.")

    if issues:
        print(f"[question_generator] validate_question_quality issues: {issues}")
        return False
    return True


def generate_level_test_question(subject, difficulty="medium", topic="general"):
    """
    Generates one HIGH-QUALITY level-test question.

    NEW flow:
      1) Retrieve real course content from ChromaDB via RAG
      2) Generate a JSON MCQ grounded in that content
      3) Validate quality (non-generic + grounded) + retry
    """
    rag_service = RAGService.get_instance()

    # STEP 1: Retrieve actual course content from ChromaDB (via RAG)
    context_query = f"{subject} {topic}".strip()
    course_content = rag_service.get_context_for_query(context_query, max_chunks=3)
    if not course_content or len(course_content) < 50:
        course_content = rag_service.get_context_for_query(subject, max_chunks=5)
    course_content = (course_content or "").strip()
    if len(course_content) > 9000:
        course_content = course_content[:9000]

    # STEP 2: Build enhanced prompt with course content
    base_prompt = prompt_templates.get_level_test_prompt(subject, difficulty, topic)

    # Lightweight C-specific guidance to avoid step-based nonsense
    subject_l = str(subject).lower()
    topic_l = str(topic).lower()
    topic_norm = _strip_accents(topic_l)
    c_mode = ("programmation" in subject_l) or ("c" in topic_l) or (" c" in topic_l)
    c_guidance = ""
    if c_mode:
        if "etape" in topic_norm or "etapes" in topic_norm:
            c_guidance = (
                "Pour ce thème (code source vers exécutable): une question sur le rôle de la compilation, "
                "de l'édition de liens ou de l'exécution — ne pas demander la première/deuxième/n-ième étape."
            )
        elif "variable" in topic_l or "variables" in topic_l:
            c_guidance = "Pour le sujet C/variables: teste une syntaxe exacte ou une règle précise (ex: mot-clé int/char, type, rôle)."
        elif "fonction" in topic_l:
            c_guidance = "Pour le sujet C/fonctions: teste la syntaxe ou le rôle précis de return/paramètres."
        elif "pointeur" in topic_l or "pointer" in topic_l:
            c_guidance = "Pour le sujet C/pointeurs: teste la signification de & et *, et l'accès à la valeur pointée."
        else:
            c_guidance = "Pour le sujet C: évite les questions génériques; utilise des règles/syntaxes concrètes."

    prompt = (
        f"{base_prompt}\n\n"
        f"COURSE CONTENT (from ChromaDB / course database via RAG):\n{course_content}\n\n"
        f"Return STRICT JSON only (no markdown fences). The rubric above requires explanation in the JSON object.\n"
        f"{'C guidance: ' + c_guidance + '\\n' if c_guidance else ''}"
    )

    # STEP 3: Generate + STEP 4: Validate and retry
    invalid_json_count = 0
    for attempt in range(3):
        try:
            strict_suffix = ""
            if attempt >= 1:
                strict_suffix = (
                    "\nSTRICT MODE: If the question is generic/steps-based OR options look like numbered steps, fail this attempt."
                )

            final_prompt = prompt + strict_suffix
            print(
                f"[question_generator] generate_level_test_question attempt {attempt + 1}: "
                f"subject={subject}, difficulty={difficulty}, topic={topic}"
            )

            response = _generate_level_test_llm(final_prompt)
            if not response:
                continue

            data = parse_json_response(response)
            if data is None:
                print("[question_generator] Invalid JSON in response, retrying...")
                invalid_json_count += 1
                # First: try to "repair" the same output into strict JSON.
                repaired = repair_to_strict_json(
                    response,
                    model_name=getattr(config, "OLLAMA_LEVEL_TEST_MODEL", None),
                )
                if repaired is not None:
                    data = repaired
                else:
                    # If the primary model keeps returning non-JSON for this slot, immediately try fallback model.
                    if invalid_json_count >= 2:
                        fb = (
                            getattr(config, "OLLAMA_LEVEL_TEST_MODEL_FALLBACK", "") or ""
                        ).strip()
                        if fb:
                            response_fb = langchain_ollama.generate_with_model(
                                final_prompt, fb
                            )
                            if response_fb:
                                # Try repair on fallback output too.
                                data = parse_json_response(
                                    response_fb
                                ) or repair_to_strict_json(response_fb, model_name=fb)
                                if data is None:
                                    continue
                        continue
                    continue

            # Handle single object (not wrapped in array)
            if isinstance(data, list) and len(data) > 0:
                data = data[0]
            if not isinstance(data, dict):
                continue

            if validate_question(data) and validate_question_quality(data, course_content, topic=topic):
                return data

            print("[question_generator] Question failed validation; retrying...")
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
