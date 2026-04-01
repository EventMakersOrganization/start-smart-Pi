"""
Prompt templates for level test and adaptive questions (LangChain PromptTemplate).

Level-test content is retrieved at runtime from ChromaDB/RAG (embedded course chunks from MongoDB).
Templates instruct the model to ground questions ONLY in that provided reference text.
"""
from langchain_core.prompts import PromptTemplate

# ---------------------------------------------------------------------------
# Level test — expert assessment designer rubric (single + batch)
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
  reference and internally consistent: the option marked correct must be the one that actually answers
  the question, and the explanation must justify that same option (not a different one).
- For programming (C, control flow, types): the correct option must match ordinary language rules and
  the wording of the question — e.g. the skeleton of an if-else is not a bare comparison; a for-loop
  is not defined by “runs at least once” (that is typical of do-while). Double-check semantics before
  you output JSON.
- Same language as the reference (French or English). Wording must be unambiguous; four distinct
  options; exactly one correct answer; short explanation (1–3 sentences).
  If the reference material is French, write EVERYTHING in French (including code comments inside options).
- Distractors should be plausible mistakes someone could make when learning this material, not jokes
  or obviously wrong filler.
- Do not use catch-all options (“none of the above”, “all of the above”, or equivalent in any language).
- Do not substitute placeholders for real content where a student must choose concrete syntax or a
  specific value — answers must be assessable from the material.
- Across a batch, vary difficulty and subtopic so items do not repeat the same narrow fact.
- Each row in the batch lists a **topic** string (chapter / section title). That question MUST test that
  exact section: the stem and options must use ideas and vocabulary from that topic, not a different
  chapter that happens to appear in the same reference text. Copy the topic string into the JSON
  `topic` field unchanged.
""".strip()

LEVEL_TEST_QUALITY_RULES = """
Checklist before output:
- `correct_answer` is character-for-character identical to one of the four `options`.
- The question must match the **topic** you were given (same subject matter); the explanation must
  justify the correct option for **this** question (not a different concept).
- Re-read the question: among the four options, only the chosen one is actually correct; fix mistakes
  before returning JSON.
- Options are meaningfully different from each other (not minor rephrases of the same answer).
- The question cannot be answered correctly by guessing document layout alone; it requires the ideas
  in the reference.
""".strip()

LEVEL_TEST_JSON_OUTPUT_CONTRACT = """
OUTPUT (machine-readable JSON — required for the API):
Return STRICT JSON only (no markdown fences). One object with keys:
  - "question" (string)
  - "options" (array of exactly 4 strings — these are the four choices; do not prefix with A/B/C/D inside strings unless the course does)
  - "correct_answer" (string, must match one element of "options" exactly)
  - "difficulty" (string: "easy" | "medium" | "hard")
  - "explanation" (string, 1–3 sentences: why the correct answer is right)
  - "topic" (string, the focus area being tested)
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

# Batch path: JSON array schema (short keys supported for token efficiency)
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
    """
    Full prompt header + rubric + JSON contract for a single level-test question.
    Caller appends COURSE CONTENT from RAG after this string.
    """
    base = LEVEL_TEST_QUESTION_TEMPLATE.format(
        subject=subject,
        difficulty=difficulty,
        topic=topic,
    )
    parts = [base, "", LEVEL_TEST_ASSESSMENT_RUBRIC, "", LEVEL_TEST_QUALITY_RULES, "", LEVEL_TEST_JSON_OUTPUT_CONTRACT]
    return "\n".join(parts)


def build_level_test_batch_prompt(
    subject: str,
    topic_difficulty_specs: str,
    reference_material: str,
    count: int,
    max_ref_chars: int = 2800,
) -> str:
    """
    Build the full batch prompt for level-test pre-generation (one LLM call per logical subject).

    Args:
        subject: Display subject title (e.g. curriculum subject name).
        topic_difficulty_specs: Pre-formatted lines listing each question slot (topic + difficulty).
        reference_material: RAG-retrieved text from course chunks (database-backed).
        count: Number of MCQs (typically 5 per subject).
        max_ref_chars: Truncate reference to control context size.
    """
    ref = (reference_material or "").strip()
    if len(ref) > max_ref_chars:
        ref = ref[:max_ref_chars]

    return (
        f"{LEVEL_TEST_ASSESSMENT_RUBRIC}\n\n"
        f"{LEVEL_TEST_QUALITY_RULES}\n\n"
        f"Subject: {subject}\n\n"
        f"Generate exactly {count} MCQs. One row per item:\n{topic_difficulty_specs}\n\n"
        "Coverage: each row lists topic and difficulty — question i MUST address topic i only; use words "
        "and concepts from that topic line in the stem or options. Do not substitute another chapter’s "
        "content.\n\n"
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
    print(p1[:600] + "...\n")

    print("2. Level test (batch):")
    p2 = build_level_test_batch_prompt(
        "Programmation C",
        '1. topic="Variables" difficulty="medium"\n2. topic="Boucles" difficulty="easy"',
        "Sample ref text about int and printf...",
        2,
    )
    print(p2[:600] + "...\n")

    print("3. Multiple questions:")
    p3 = get_multiple_questions_prompt("Physics", "medium", 3, "kinematics, forces, energy")
    print(p3[:400] + "...\n")

    print("4. Adaptive question:")
    p4 = get_adaptive_question_prompt(
        subject="Programming",
        weak_areas="loops and conditionals",
        difficulty="medium",
        previous_performance="scored 60% on last quiz",
    )
    print(p4[:400] + "...\n")

    print("Templates and helpers loaded successfully.")
