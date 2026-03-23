"""
Advanced context-aware prompt building for RAG.
Constructs prompts for chatbot, question generation, adaptive questions,
and answer explanations using retrieved course content.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from core.rag_service import RAGService

logger = logging.getLogger("rag_prompt_builder")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


class RAGPromptBuilder:
    """Builds context-aware prompts using RAG-retrieved content."""

    def __init__(self, rag_service: RAGService, max_context_length: int = 2000) -> None:
        self.rag_service = rag_service
        self.max_context_length = max_context_length

    # ------------------------------------------------------------------
    # Chatbot
    # ------------------------------------------------------------------

    def build_chatbot_prompt(
        self,
        user_question: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> str:
        """
        Build prompt for an educational chatbot with relevant course context.

        Args:
            user_question: The student's current question.
            conversation_history: Previous messages, each
                ``{"role": "user"|"assistant", "content": "..."}``.

        Returns:
            Complete prompt string ready for LLM invocation.
        """
        context = self.rag_service.get_context_for_query(user_question, max_chunks=5)
        context = self.truncate_context(context)

        conv_block = ""
        if conversation_history:
            recent = conversation_history[-3:]
            lines = [
                f"{msg.get('role', 'user').upper()}: {msg.get('content', '')}"
                for msg in recent
            ]
            conv_block = "CONVERSATION SO FAR:\n" + "\n".join(lines) + "\n\n"

        return (
            "You are an AI tutor helping first-year students learn.\n\n"
            "RELEVANT COURSE CONTENT:\n"
            f"{context}\n\n"
            f"{conv_block}"
            f"CURRENT QUESTION: {user_question}\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer based ONLY on the course content provided above\n"
            "2. If the answer is not in the course content, say "
            '"I don\'t have information about that in our courses"\n'
            "3. Be clear, helpful, and encouraging\n"
            "4. Use simple language appropriate for first-year students\n"
            "5. Provide examples when helpful\n\n"
            "YOUR ANSWER:"
        )

    # ------------------------------------------------------------------
    # Question generation
    # ------------------------------------------------------------------

    _FORMAT_MCQ = """
Generate a multiple choice question in this JSON format:
{
  "question": "Clear question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Option A",
  "explanation": "Why this is correct",
  "difficulty": "easy|medium|hard",
  "topic": "specific topic"
}"""

    _FORMAT_TF = """
Generate a true/false question in this JSON format:
{
  "question": "Statement to evaluate",
  "options": ["True", "False"],
  "correct_answer": "True",
  "explanation": "Why this is true/false",
  "difficulty": "easy|medium|hard",
  "topic": "specific topic"
}"""

    _FORMAT_DND = """
Generate a drag-and-drop matching question in this JSON format:
{
  "question": "Match the following concepts",
  "items": ["Item 1", "Item 2", "Item 3"],
  "matches": ["Match A", "Match B", "Match C"],
  "correct_pairs": {"Item 1": "Match A", "Item 2": "Match B", "Item 3": "Match C"},
  "explanation": "Explanation of correct matches",
  "difficulty": "easy|medium|hard",
  "topic": "specific topic"
}"""

    def build_question_generation_prompt(
        self,
        subject: str,
        difficulty: str,
        topic: str,
        question_type: str = "MCQ",
    ) -> str:
        """
        Build prompt for generating a question grounded in course content.

        Args:
            subject: Subject area (e.g. "Programming").
            difficulty: ``"easy"`` / ``"medium"`` / ``"hard"``.
            topic: Specific topic (e.g. "loops").
            question_type: ``"MCQ"`` / ``"True/False"`` / ``"Drag&Drop"``.

        Returns:
            Complete prompt string for question generation.
        """
        context = self.rag_service.get_context_for_query(
            f"{subject} {topic}", max_chunks=3
        )
        context = self.truncate_context(context)

        fmt_map: dict[str, str] = {
            "MCQ": self._FORMAT_MCQ,
            "True/False": self._FORMAT_TF,
            "Drag&Drop": self._FORMAT_DND,
        }
        format_instructions = fmt_map.get(question_type, "Generate appropriate question format")

        return (
            f"Generate a {difficulty} difficulty {question_type} question "
            f"about {topic} in {subject}.\n\n"
            "RELEVANT COURSE CONTENT:\n"
            f"{context}\n\n"
            "REQUIREMENTS:\n"
            "1. Base the question on the course content above\n"
            f"2. Difficulty level: {difficulty}\n"
            f"3. Question type: {question_type}\n"
            "4. Make it educational and clear for first-year students\n"
            "5. Return ONLY valid JSON, no additional text\n\n"
            f"{format_instructions}\n\n"
            "Generate the question now:"
        )

    # ------------------------------------------------------------------
    # Adaptive questions
    # ------------------------------------------------------------------

    def build_adaptive_question_prompt(
        self,
        student_profile: dict[str, Any],
        previous_questions: list[dict[str, Any]] | None = None,
    ) -> str:
        """
        Build prompt for adaptive question generation based on student performance.

        Args:
            student_profile: Dict with ``weak_areas``, ``strong_areas``,
                ``current_level``.
            previous_questions: Recently asked questions to avoid repetition.

        Returns:
            Prompt tailored to the student's weak areas and level.
        """
        weak_areas: list[str] = student_profile.get("weak_areas") or []
        current_level: str = student_profile.get("current_level", "medium")

        weak_topics = ", ".join(weak_areas) if weak_areas else "general topics"
        context = self.rag_service.get_context_for_query(weak_topics, max_chunks=5)
        context = self.truncate_context(context)

        avoid_block = ""
        if previous_questions:
            topics = [q.get("topic", "") for q in previous_questions[-5:] if q.get("topic")]
            if topics:
                avoid_block = f"Avoid these recently covered topics: {', '.join(topics)}\n\n"

        return (
            "Generate an adaptive question for a student with this profile:\n"
            f"- Weak areas: {', '.join(weak_areas) if weak_areas else 'none specified'}\n"
            f"- Current level: {current_level}\n\n"
            "RELEVANT COURSE CONTENT:\n"
            f"{context}\n\n"
            f"{avoid_block}"
            "REQUIREMENTS:\n"
            "1. Focus on the student's weak areas\n"
            "2. Adjust difficulty to their current level\n"
            "3. Make it challenging but achievable\n"
            "4. Provide clear explanation for learning\n"
            "5. Return JSON format with: question, options, correct_answer, "
            "explanation, difficulty, topic\n\n"
            "Generate the adaptive question:"
        )

    # ------------------------------------------------------------------
    # Answer explanation
    # ------------------------------------------------------------------

    def build_explanation_prompt(
        self,
        question: str,
        student_answer: str,
        correct_answer: str,
    ) -> str:
        """
        Build prompt for explaining why an answer is correct or incorrect.

        Args:
            question: The question that was asked.
            student_answer: The student's selected answer.
            correct_answer: The actual correct answer.

        Returns:
            Prompt for generating a supportive explanation.
        """
        context = self.rag_service.get_context_for_query(question, max_chunks=3)
        context = self.truncate_context(context)

        is_correct = student_answer.strip().lower() == correct_answer.strip().lower()
        result_label = "CORRECT" if is_correct else "INCORRECT"

        if is_correct:
            guidance = "Reinforces why this answer is correct"
        else:
            guidance = "Explains why the answer is incorrect"

        return (
            "A student answered a question. Provide a helpful explanation.\n\n"
            "RELEVANT COURSE CONTENT:\n"
            f"{context}\n\n"
            f"QUESTION: {question}\n"
            f"STUDENT'S ANSWER: {student_answer}\n"
            f"CORRECT ANSWER: {correct_answer}\n"
            f"RESULT: {result_label}\n\n"
            "Provide an explanation that:\n"
            f"1. {guidance}\n"
            "2. References the course content\n"
            "3. Helps the student understand the concept better\n"
            "4. Is encouraging and supportive\n"
            "5. Suggests what to review if incorrect\n\n"
            "YOUR EXPLANATION:"
        )

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def truncate_context(self, context: str, max_length: int | None = None) -> str:
        """Truncate context to fit within token/character limits."""
        limit = max_length or self.max_context_length
        if len(context) <= limit:
            return context
        return context[:limit] + "\n[...truncated for length]"


# ------------------------------------------------------------------
# Standalone helpers
# ------------------------------------------------------------------


def extract_json_from_response(response_text: str) -> dict:
    """
    Extract a JSON object from an LLM response that may contain markdown
    fences or surrounding prose.

    Raises ``ValueError`` if no valid JSON object is found.
    """
    # Try markdown code block first
    block = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", response_text, re.DOTALL)
    if block:
        try:
            return json.loads(block.group(1))
        except json.JSONDecodeError:
            pass

    # Fall back to raw JSON extraction
    raw = re.search(r"\{.*\}", response_text, re.DOTALL)
    if raw:
        try:
            return json.loads(raw.group(0))
        except json.JSONDecodeError:
            pass

    raise ValueError("No valid JSON found in response")


# ------------------------------------------------------------------
# Quick self-test
# ------------------------------------------------------------------

if __name__ == "__main__":
    rag = RAGService.get_instance()
    builder = RAGPromptBuilder(rag)

    print("=" * 60)
    print("TEST 1: Chatbot Prompt")
    print("=" * 60)
    prompt = builder.build_chatbot_prompt("What are for loops in Python?")
    print(prompt)

    print("\n" + "=" * 60)
    print("TEST 2: Question Generation Prompt (MCQ)")
    print("=" * 60)
    prompt = builder.build_question_generation_prompt(
        subject="Programming",
        difficulty="medium",
        topic="loops",
        question_type="MCQ",
    )
    print(prompt)

    print("\n" + "=" * 60)
    print("TEST 3: Adaptive Question Prompt")
    print("=" * 60)
    prompt = builder.build_adaptive_question_prompt(
        student_profile={"weak_areas": ["loops", "functions"], "current_level": "easy"},
        previous_questions=[{"topic": "variables"}],
    )
    print(prompt)

    print("\n" + "=" * 60)
    print("TEST 4: Explanation Prompt (incorrect answer)")
    print("=" * 60)
    prompt = builder.build_explanation_prompt(
        question="What keyword starts a for loop in Python?",
        student_answer="while",
        correct_answer="for",
    )
    print(prompt)

    print("\n" + "=" * 60)
    print("TEST 5: extract_json_from_response")
    print("=" * 60)
    sample = 'Here is the question:\n```json\n{"question":"x","options":["a","b"]}\n```'
    parsed = extract_json_from_response(sample)
    print("Parsed:", parsed)
