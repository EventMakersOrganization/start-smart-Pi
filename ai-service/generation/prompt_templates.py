"""
Prompt templates for level test and adaptive questions (LangChain PromptTemplate).
"""
from langchain_core.prompts import PromptTemplate

# ---------------------------------------------------------------------------
# Level test — rubric + JSON contract (single + batch)
# ---------------------------------------------------------------------------

LEVEL_TEST_ASSESSMENT_RUBRIC = """
You are an expert assessment designer.

Generate multiple-choice questions (MCQs) using ONLY the reference material in this prompt
(course content from the knowledge base). Do not rely on outside facts.

General principles:
- Each question tests one clear idea: definitions, distinctions, applying a rule, reading code,
  predicting behaviour, or spotting errors — not memorizing document structure or labels.
- Do NOT ask which step is first, second, or Nth in a procedure or workflow (e.g. “première étape”,
  “first step”, “quel est le deuxième pas”). That only tests memorized order. Instead ask what a
  phase means, why it matters, or how two phases differ.
- Every statement you assert (including in options and in the explanation) must be faithful to the
  reference and internally consistent.
- For programming (C, control flow, types): double-check semantics before output JSON.
- Avoid trivial “identify the symbol” items (e.g. “quel opérateur est / ?”). Prefer behaviour questions
  (ex: division entière vs réelle selon le type, précédence, effet de `break`, portée d’une variable, etc.).
- Same language as the reference (French or English). If the reference is French, write EVERYTHING in French.
- Exactly 4 options; exactly 1 correct; short explanation (1–3 sentences).
- No catch-all options (“none/all of the above”, or equivalent).
- Each row lists a topic string. The question MUST address that topic.
- If the question compares two constructs (e.g. while vs do-while, if vs switch), make each option explicit
  about WHICH construct it refers to (avoid vague options that could apply to either).
""".strip()

LEVEL_TEST_QUALITY_RULES = """
Checklist before output:
- `correct_answer` is character-for-character identical to one of the four `options`.
- The question matches the given topic; the explanation justifies the chosen option.
""".strip()

LEVEL_TEST_JSON_OUTPUT_CONTRACT = """
OUTPUT (machine-readable JSON — required for the API):
Return STRICT JSON only (no markdown fences). One object with keys:
  - "question" (string)
  - "options" (array of exactly 4 strings)
  - "correct_answer" (string, must match one element of "options" exactly)
  - "difficulty" (string: "easy" | "medium" | "hard")
  - "explanation" (string, 1–3 sentences)
  - "topic" (string)
""".strip()

LEVEL_TEST_QUESTION_TEMPLATE = PromptTemplate(
    input_variables=["subject", "difficulty", "topic"],
    template="""You are an expert assessment designer.

Generate exactly ONE level-test multiple-choice question.

Subject: {subject}
Difficulty level: {difficulty}
Topic / concept to target: {topic}

The course content will follow in a section labelled COURSE CONTENT. Base the question ONLY on that content.
""",
)

LEVEL_TEST_BATCH_JSON_SCHEMA = """
JSON OUTPUT (strict):
Reply with ONLY a JSON array of {count} objects. Each object must include:
  - "question" (string)
  - "options" (array of exactly 4 strings)
  - "correct_answer" (string, must exactly equal one of the four options)
  - "difficulty" ("easy" | "medium" | "hard")
  - "explanation" (string, 1–3 sentences)
  - "topic" (string)

You may use short keys instead: "q", "o", "a", "d", "t", "e" (e = explanation).
""".strip()


def get_level_test_prompt(subject, difficulty, topic):
    base = LEVEL_TEST_QUESTION_TEMPLATE.format(subject=subject, difficulty=difficulty, topic=topic)
    return "\n".join(
        [
            base,
            "",
            LEVEL_TEST_ASSESSMENT_RUBRIC,
            "",
            LEVEL_TEST_QUALITY_RULES,
            "",
            LEVEL_TEST_JSON_OUTPUT_CONTRACT,
        ]
    )


def build_level_test_batch_prompt(
    subject: str,
    topic_difficulty_specs: str,
    reference_material: str,
    count: int,
    diversity_seed: str | None = None,
    max_ref_chars: int = 2800,
) -> str:
    ref = (reference_material or "").strip()
    if len(ref) > max_ref_chars:
        ref = ref[:max_ref_chars]
    if diversity_seed:
        seed_line = (
            f"SESSION / DIVERSITY ID: {diversity_seed}\n"
            "Each run MUST differ from any previous run: pick different angles, numbers, and code snippets "
            "within the same topic rows; do not repeat the same question stem pattern.\n\n"
        )
    else:
        seed_line = ""
    return (
        f"{LEVEL_TEST_ASSESSMENT_RUBRIC}\n\n"
        f"{LEVEL_TEST_QUALITY_RULES}\n\n"
        f"Subject: {subject}\n\n"
        f"Generate exactly {count} MCQs. One row per item:\n{topic_difficulty_specs}\n\n"
        "Coverage: each row lists topic and difficulty — question i MUST address topic i only.\n"
        "Topic coverage: rows use different chapter/module topics where listed; spread across them "
        "and avoid asking the same subtopic twice.\n\n"
        f"{seed_line}"
        f"REFERENCE MATERIAL (only source of truth — from course database / RAG):\n{ref}\n\n"
        f"{LEVEL_TEST_BATCH_JSON_SCHEMA.format(count=count)}\n"
        "JSON:"
    )


MULTIPLE_QUESTIONS_TEMPLATE = PromptTemplate(
    input_variables=["subject", "difficulty", "number_of_questions", "topics"],
    template="""Generate multiple educational multiple-choice questions for first-year students.

Subject: {subject}
Difficulty: {difficulty}
Number of questions to generate: {number_of_questions}
Topics to cover: {topics}

Instructions:
- Generate exactly {number_of_questions} questions.
- Cover the topics listed: {topics}.
- Keep difficulty at {difficulty}.
- Return a JSON array. Each element must have:
  - question (string)
  - options (array of 4 strings)
  - correct_answer (string)
  - explanation (string)

JSON array response:""",
)

ADAPTIVE_QUESTION_TEMPLATE = PromptTemplate(
    input_variables=["subject", "weak_areas", "difficulty", "previous_performance"],
    template="""Generate one adaptive multiple-choice question to assess a student's current level.

Subject: {subject}
Student's weak areas: {weak_areas}
Target difficulty: {difficulty}
Previous performance context: {previous_performance}

Instructions:
- Focus on the weak areas: {weak_areas}.
- Adjust difficulty to {difficulty}.
- Consider the previous performance: {previous_performance}.
- Generate one question that helps assess the student's current level.
- Return in JSON format with keys: question, options (array of 4), correct_answer, explanation.

JSON response:""",
)


def get_multiple_questions_prompt(subject, difficulty, num_questions, topics):
    """
    Returns a formatted prompt string using MULTIPLE_QUESTIONS_TEMPLATE.
    topics: comma-separated string of topics (e.g. "algebra, geometry, calculus").
    """
    topics_str = topics if isinstance(topics, str) else ", ".join(str(t) for t in topics)
    return MULTIPLE_QUESTIONS_TEMPLATE.format(
        subject=subject,
        difficulty=difficulty,
        number_of_questions=num_questions,
        topics=topics_str,
    )


def get_adaptive_question_prompt(subject, weak_areas, difficulty, previous_performance):
    """
    Returns a formatted prompt string using ADAPTIVE_QUESTION_TEMPLATE.
    """
    return ADAPTIVE_QUESTION_TEMPLATE.format(
        subject=subject,
        weak_areas=weak_areas,
        difficulty=difficulty,
        previous_performance=previous_performance,
    )


if __name__ == "__main__":
    print("=== Prompt template examples ===\n")

    print("1. Level test (single question):")
    p1 = get_level_test_prompt("Mathematics", "easy", "linear equations")
    print(p1[:400] + "...\n")

    print("2. Multiple questions:")
    p2 = get_multiple_questions_prompt("Physics", "medium", 3, "kinematics, forces, energy")
    print(p2[:400] + "...\n")

    print("3. Adaptive question:")
    p3 = get_adaptive_question_prompt(
        subject="Programming",
        weak_areas="loops and conditionals",
        difficulty="medium",
        previous_performance="scored 60% on last quiz",
    )
    print(p3[:400] + "...\n")

    print("Templates and helpers loaded successfully.")
