"""
Prompt templates for level test and adaptive questions (LangChain PromptTemplate).
"""
from langchain_core.prompts import PromptTemplate

# --- Template definitions ---

LEVEL_TEST_QUESTION_TEMPLATE = PromptTemplate(
    input_variables=["subject", "difficulty", "topic"],
    template="""Generate one educational multiple-choice question for first-year students.

Subject: {subject}
Difficulty level: {difficulty}
Topic to test: {topic}

Instructions:
- Generate exactly one question that tests {topic} in {subject}.
- The difficulty should match {difficulty}.
- Return your response in JSON format with these keys:
  - question (string): the question text
  - options (array of 4 strings): four answer choices
  - correct_answer (string): the correct option text
  - explanation (string): brief explanation of the correct answer
- Make it suitable for first-year students.

JSON response:""",
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

# --- Helper functions ---


def get_level_test_prompt(subject, difficulty, topic):
    """
    Returns a formatted prompt string using LEVEL_TEST_QUESTION_TEMPLATE.
    """
    return LEVEL_TEST_QUESTION_TEMPLATE.format(
        subject=subject,
        difficulty=difficulty,
        topic=topic,
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
