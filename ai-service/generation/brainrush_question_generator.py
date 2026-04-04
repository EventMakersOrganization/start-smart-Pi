"""
BrainRush question generator - structured question generation with RAG.
Uses RAGPromptBuilder for context-aware prompts, HallucinationGuard for validation.
"""
from __future__ import annotations

import json
import logging
import random
import re
from typing import Any

from utils import langchain_ollama
from rag.hallucination_guard import HallucinationGuard
from rag.rag_prompt_builder import RAGPromptBuilder, extract_json_from_response
from core.rag_service import RAGService

logger = logging.getLogger("brainrush_question_generator")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# Base time limits (seconds) by question type
_BASE_MCQ = 30
_BASE_TRUE_FALSE = 20
_BASE_DRAG_DROP = 45

# Difficulty multipliers for time
_TIME_MULTIPLIERS = {"easy": 1.0, "medium": 1.2, "hard": 1.5}

# Points by difficulty
_POINTS = {"easy": 10, "medium": 20, "hard": 30}


class BrainRushQuestionGenerator:
    """Generates structured BrainRush questions using RAG and hallucination guards."""

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.prompt_builder = RAGPromptBuilder(self.rag_service)
        self.hallucination_guard = HallucinationGuard(self.rag_service)

    def generate_mcq(self, subject: str, difficulty: str, topic: str) -> dict[str, Any]:
        """
        Generate an MCQ question grounded in course content.
        Returns dict with type, points, time_limit, validation_confidence.
        """
        try:
            prompt = self.prompt_builder.build_question_generation_prompt(
                subject, difficulty, topic, question_type="MCQ"
            )
            prompt = self.hallucination_guard.add_hallucination_prevention_instructions(prompt)
            logger.info("brainrush generate_mcq: subject=%s topic=%s", subject, topic)
            response = langchain_ollama.generate_fast(prompt)
            data = self._extract_and_validate_json(response)
            context = self.rag_service.get_context_for_query(f"{subject} {topic}", max_chunks=3)
            val_dict = dict(data)
            if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                pairs = val_dict.get("correct_pairs") or {}
                val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
            validation = self.hallucination_guard.verify_question_validity(val_dict, context)
            if not validation["is_valid"]:
                logger.warning("brainrush generate_mcq validation issues: %s", validation.get("issues"))
            q = {
                "type": "MCQ",
                "question": data.get("question", ""),
                "options": data.get("options", ["A", "B", "C", "D"]),
                "correct_answer": data.get("correct_answer", ""),
                "explanation": data.get("explanation", ""),
                "difficulty": difficulty,
                "topic": topic,
                "points": self._calculate_points(difficulty),
                "time_limit": self._calculate_time_limit(difficulty, "MCQ"),
                "validation_confidence": validation.get("confidence", 0.0),
                "is_fallback": False,
            }
            if not q["question"] or not q["correct_answer"]:
                raise ValueError("Missing required question or correct_answer")
            return q
        except Exception as e:
            logger.exception("brainrush generate_mcq error: %s", e)
            return self._get_fallback_mcq(subject, topic, difficulty)

    def generate_true_false(self, subject: str, difficulty: str, topic: str) -> dict[str, Any]:
        """Generate a True/False question."""
        try:
            prompt = self.prompt_builder.build_question_generation_prompt(
                subject, difficulty, topic, question_type="True/False"
            )
            prompt = self.hallucination_guard.add_hallucination_prevention_instructions(prompt)
            logger.info("brainrush generate_true_false: subject=%s topic=%s", subject, topic)
            response = langchain_ollama.generate_fast(prompt)
            data = self._extract_and_validate_json(response)
            context = self.rag_service.get_context_for_query(f"{subject} {topic}", max_chunks=3)
            val_dict = dict(data)
            if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                pairs = val_dict.get("correct_pairs") or {}
                val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
            validation = self.hallucination_guard.verify_question_validity(val_dict, context)
            if not validation["is_valid"]:
                logger.warning("brainrush generate_true_false validation issues: %s", validation.get("issues"))
            q = {
                "type": "TrueFalse",
                "question": data.get("question", ""),
                "options": ["True", "False"],
                "correct_answer": data.get("correct_answer", "True"),
                "explanation": data.get("explanation", ""),
                "difficulty": difficulty,
                "topic": topic,
                "points": self._calculate_points(difficulty),
                "time_limit": self._calculate_time_limit(difficulty, "TrueFalse"),
                "validation_confidence": validation.get("confidence", 0.0),
                "is_fallback": False,
            }
            if not q["question"] or not q["correct_answer"]:
                raise ValueError("Missing required question or correct_answer")
            return q
        except Exception as e:
            logger.exception("brainrush generate_true_false error: %s", e)
            return self._get_fallback_true_false(subject, topic, difficulty)

    def generate_drag_drop(self, subject: str, difficulty: str, topic: str) -> dict[str, Any]:
        """Generate a Drag&Drop matching question."""
        try:
            prompt = self.prompt_builder.build_question_generation_prompt(
                subject, difficulty, topic, question_type="Drag&Drop"
            )
            prompt = self.hallucination_guard.add_hallucination_prevention_instructions(prompt)
            logger.info("brainrush generate_drag_drop: subject=%s topic=%s", subject, topic)
            response = langchain_ollama.generate_fast(prompt)
            data = self._extract_and_validate_json(response, allow_correct_pairs=True)
            context = self.rag_service.get_context_for_query(f"{subject} {topic}", max_chunks=3)
            val_dict = dict(data)
            if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                pairs = val_dict.get("correct_pairs") or {}
                val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
            validation = self.hallucination_guard.verify_question_validity(val_dict, context)
            if not validation["is_valid"]:
                logger.warning("brainrush generate_drag_drop validation issues: %s", validation.get("issues"))
            base_points = self._calculate_points(difficulty)
            q = {
                "type": "DragDrop",
                "question": data.get("question", ""),
                "items": data.get("items", []),
                "matches": data.get("matches", []),
                "correct_pairs": data.get("correct_pairs", {}),
                "explanation": data.get("explanation", ""),
                "difficulty": difficulty,
                "topic": topic,
                "points": base_points + 5,
                "time_limit": self._calculate_time_limit(difficulty, "DragDrop"),
                "validation_confidence": validation.get("confidence", 0.0),
                "is_fallback": False,
            }
            if not q["question"] or not q.get("correct_pairs"):
                raise ValueError("Missing required question or correct_pairs")
            return q
        except Exception as e:
            logger.exception("brainrush generate_drag_drop error: %s", e)
            return self._get_fallback_drag_drop(subject, topic, difficulty)

    def generate_mixed_question_set(
        self,
        subject: str,
        difficulty: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Generate a mixed set: 60% MCQ, 30% True/False, 10% Drag&Drop.
        Topics are chosen from RAG-retrieved content.
        """
        topics = self._get_relevant_topics(subject)
        n_mcq = max(1, int(num_questions * 0.6))
        n_tf = max(1, int(num_questions * 0.3))
        n_dd = max(0, num_questions - n_mcq - n_tf)
        questions: list[dict[str, Any]] = []
        idx = 0
        for _ in range(n_mcq):
            topic = topics[idx % len(topics)]
            questions.append(self.generate_mcq(subject, difficulty, topic))
            idx += 1
        for _ in range(n_tf):
            topic = topics[idx % len(topics)]
            questions.append(self.generate_true_false(subject, difficulty, topic))
            idx += 1
        for _ in range(n_dd):
            topic = topics[idx % len(topics)]
            questions.append(self.generate_drag_drop(subject, difficulty, topic))
            idx += 1
        random.shuffle(questions)
        return questions

    def _extract_and_validate_json(self, response: str, allow_correct_pairs: bool = False) -> dict:
        """Extract JSON and ensure required keys exist. For Drag&Drop, allow correct_pairs instead of correct_answer."""
        data = extract_json_from_response(response)
        if "question" not in data:
            raise ValueError("Response missing required field: question")
        if "correct_answer" not in data and not (allow_correct_pairs and data.get("correct_pairs")):
            raise ValueError("Response missing required fields: question, correct_answer (or correct_pairs for Drag&Drop)")
        return data

    def _calculate_points(self, difficulty: str) -> int:
        return _POINTS.get(difficulty.lower(), 20)

    def _calculate_time_limit(self, difficulty: str, question_type: str) -> int:
        base = _BASE_MCQ
        if question_type == "TrueFalse":
            base = _BASE_TRUE_FALSE
        elif question_type == "DragDrop":
            base = _BASE_DRAG_DROP
        mult = _TIME_MULTIPLIERS.get(difficulty.lower(), 1.2)
        return int(base * mult)

    def _get_relevant_topics(self, subject: str) -> list[str]:
        """Extract topics from RAG search results for subject."""
        results = self.rag_service.search(subject, n_results=10)
        topics: list[str] = []
        seen: set[str] = set()
        skip = {"python", "javascript", "programming", "general", "course", "learn", "introduction"}
        for item in results:
            for ch in item.get("chunks") or []:
                meta = ch.get("metadata") or {}
                mod = (meta.get("module_name") or meta.get("course_title") or "").strip()
                if mod and mod.lower() not in seen:
                    seen.add(mod.lower())
                    topics.append(mod)
            content = (item.get("content") or "").lower()
            words = re.findall(r"\b\w{5,}\b", content)
            for w in words[:5]:
                if w not in skip and w not in seen:
                    seen.add(w)
                    topics.append(w)
        if not topics:
            return ["general"]
        return topics[:5]

    def _get_fallback_mcq(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        return {
            "type": "MCQ",
            "question": f"What is a key concept related to {topic} in {subject}?",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correct_answer": "Option A",
            "explanation": "Please review the course material for the correct answer.",
            "difficulty": difficulty,
            "topic": topic,
            "points": self._calculate_points(difficulty),
            "time_limit": self._calculate_time_limit(difficulty, "MCQ"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }

    def _get_fallback_true_false(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        return {
            "type": "TrueFalse",
            "question": f"True or False: {topic} is an important concept in {subject}.",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": "Please review the course material.",
            "difficulty": difficulty,
            "topic": topic,
            "points": self._calculate_points(difficulty),
            "time_limit": self._calculate_time_limit(difficulty, "TrueFalse"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }

    def _get_fallback_drag_drop(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        return {
            "type": "DragDrop",
            "question": f"Match the following {topic} concepts.",
            "items": ["Item 1", "Item 2", "Item 3"],
            "matches": ["Match A", "Match B", "Match C"],
            "correct_pairs": {"Item 1": "Match A", "Item 2": "Match B", "Item 3": "Match C"},
            "explanation": "Please review the course material.",
            "difficulty": difficulty,
            "topic": topic,
            "points": self._calculate_points(difficulty) + 5,
            "time_limit": self._calculate_time_limit(difficulty, "DragDrop"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }


if __name__ == "__main__":
    gen = BrainRushQuestionGenerator()

    print("=" * 60)
    print("TEST 1: MCQ")
    print("=" * 60)
    mcq = gen.generate_mcq("Programming", "medium", "loops")
    print(json.dumps(mcq, indent=2))

    print("\n" + "=" * 60)
    print("TEST 2: True/False")
    print("=" * 60)
    tf = gen.generate_true_false("Programming", "easy", "variables")
    print(json.dumps(tf, indent=2))

    print("\n" + "=" * 60)
    print("TEST 3: Drag&Drop")
    print("=" * 60)
    dd = gen.generate_drag_drop("Programming", "medium", "data types")
    print(json.dumps(dd, indent=2))

    print("\n" + "=" * 60)
    print("TEST 4: Mixed set (5 questions)")
    print("=" * 60)
    mixed = gen.generate_mixed_question_set("Programming", "medium", 5)
    for i, q in enumerate(mixed, 1):
        print(f"{i}. {q.get('type')} - {q.get('points')} pts - {q.get('question', '')[:60]}...")
    print(f"\nTotal points: {sum(q.get('points', 0) for q in mixed)}")
