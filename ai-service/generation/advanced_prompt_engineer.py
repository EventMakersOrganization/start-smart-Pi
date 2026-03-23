"""
Advanced prompt engineering utilities: few-shot, chain-of-thought, role-play,
constraints, structured outputs, and quality analysis for RAG-backed flows.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

# Ensure ai-service root is on sys.path when running: python generation/advanced_prompt_engineer.py
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.rag_service import RAGService
from rag.rag_prompt_builder import RAGPromptBuilder


# ---------------------------------------------------------------------------
# Few-shot library for question generation (high-quality patterns)
# ---------------------------------------------------------------------------

QUESTION_GENERATION_EXAMPLES: list[dict[str, Any]] = [
    {
        "subject": "Programming",
        "topic": "loops",
        "difficulty": "medium",
        "question": {
            "question": "What does this Python loop print?\nfor i in range(3):\n    print(i)",
            "options": ["0 1 2", "1 2 3", "0 1 2 3", "1 2"],
            "correct_answer": "0 1 2",
            "explanation": "range(3) yields 0, 1, 2; each is printed on its own line.",
            "difficulty": "medium",
            "topic": "loops",
        },
        "answer": {
            "summary": "The loop iterates over indices 0, 1, 2.",
            "reasoning": "range(3) excludes the upper bound, so three iterations occur.",
        },
    },
    {
        "subject": "Mathematics",
        "topic": "algebra",
        "difficulty": "easy",
        "question": {
            "question": "Solve for x: 2x + 6 = 14",
            "options": ["x = 3", "x = 4", "x = 5", "x = 7"],
            "correct_answer": "x = 4",
            "explanation": "Subtract 6: 2x = 8; divide by 2: x = 4.",
            "difficulty": "easy",
            "topic": "linear equations",
        },
        "answer": {"summary": "x = 4", "steps": ["2x = 8", "x = 4"]},
    },
    {
        "subject": "Physics",
        "topic": "kinematics",
        "difficulty": "medium",
        "question": {
            "question": "A car accelerates from rest at 2 m/s² for 5 s. What is its final speed?",
            "options": ["5 m/s", "10 m/s", "12 m/s", "25 m/s"],
            "correct_answer": "10 m/s",
            "explanation": "v = v0 + a·t = 0 + 2·5 = 10 m/s.",
            "difficulty": "medium",
            "topic": "kinematics",
        },
        "answer": {"formula": "v = a·t", "result": "10 m/s"},
    },
    {
        "subject": "Programming",
        "topic": "conditionals",
        "difficulty": "easy",
        "question": {
            "question": "What is the output of: print('yes' if 2 > 1 else 'no')",
            "options": ["yes", "no", "True", "Error"],
            "correct_answer": "yes",
            "explanation": "2 > 1 is True, so the if branch selects 'yes'.",
            "difficulty": "easy",
            "topic": "conditionals",
        },
        "answer": {"output": "yes"},
    },
    {
        "subject": "Mathematics",
        "topic": "geometry",
        "difficulty": "hard",
        "question": {
            "question": "A right triangle has legs 3 and 4. What is the hypotenuse?",
            "options": ["5", "6", "7", "12"],
            "correct_answer": "5",
            "explanation": "Pythagorean theorem: √(3²+4²) = 5.",
            "difficulty": "hard",
            "topic": "geometry",
        },
        "answer": {"theorem": "a² + b² = c²", "c": 5},
    },
    {
        "subject": "Programming",
        "topic": "functions",
        "difficulty": "medium",
        "question": {
            "question": "What does len('hi') return in Python?",
            "options": ["1", "2", "3", "Error"],
            "correct_answer": "2",
            "explanation": "The string has two characters.",
            "difficulty": "medium",
            "topic": "strings and functions",
        },
        "answer": {"len": 2},
    },
    {
        "subject": "Physics",
        "topic": "energy",
        "difficulty": "easy",
        "question": {
            "question": "Kinetic energy depends on mass and …?",
            "options": ["velocity", "color", "volume", "density"],
            "correct_answer": "velocity",
            "explanation": "KE = ½mv² depends on mass and speed.",
            "difficulty": "easy",
            "topic": "energy",
        },
        "answer": {"concept": "KE increases with speed squared."},
    },
    {
        "subject": "General",
        "topic": "logic",
        "difficulty": "medium",
        "question": {
            "question": "If all Bloops are Razzies, and all Razzies are Zazzies, are all Bloops Zazzies?",
            "options": ["Yes", "No", "Cannot tell", "Only some"],
            "correct_answer": "Yes",
            "explanation": "Transitivity of subset relations.",
            "difficulty": "medium",
            "topic": "logic",
        },
        "answer": {"reasoning": "B ⊆ R ⊆ Z implies B ⊆ Z."},
    },
]


class AdvancedPromptEngineer:
    """
    Composes RAG-backed prompts with few-shot, CoT, role-play, constraints,
    and structured JSON outputs; analyzes prompt quality heuristically.
    """

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.rag_prompt_builder = RAGPromptBuilder(self.rag_service)
        self.prompt_engineering_techniques: dict[str, str] = {
            "few_shot": "Provide labeled examples (Q/A) so the model matches format and style.",
            "chain_of_thought": "Ask the model to reason step-by-step before the final answer.",
            "role_playing": "Assign a clear persona (e.g. expert tutor) to improve tone and depth.",
            "constraint_specification": "State length, format, tone, and forbidden content explicitly.",
            "output_structuring": "Request JSON or fixed sections to reduce parsing errors.",
        }

    # --- Building blocks --------------------------------------------------

    def use_few_shot_learning(self, base_prompt: str, examples: list[dict[str, Any]]) -> str:
        """Append few-shot examples as 'Example N: Q: ... A: ...' for consistency."""
        if not examples:
            return base_prompt
        blocks: list[str] = []
        for i, ex in enumerate(examples, start=1):
            q = ex.get("Q") or ex.get("question") or json.dumps(ex.get("question", {}), ensure_ascii=False)
            a = ex.get("A") or ex.get("answer") or json.dumps(ex.get("answer", {}), ensure_ascii=False)
            if isinstance(q, dict):
                q = json.dumps(q, ensure_ascii=False)
            if isinstance(a, dict):
                a = json.dumps(a, ensure_ascii=False)
            blocks.append(f"Example {i}: Q: {q}\nA: {a}")
        few_shot_block = "\n\n".join(blocks)
        return (
            f"{base_prompt.rstrip()}\n\n"
            "FEW-SHOT EXAMPLES (match this style and level of detail):\n"
            f"{few_shot_block}\n"
        )

    def use_chain_of_thought(self, base_prompt: str) -> str:
        """Encourage explicit reasoning before the final answer."""
        return (
            f"{base_prompt.rstrip()}\n\n"
            "Let's break this down:\n"
            "Think step by step before you give your final answer. "
            "Briefly outline your reasoning, then conclude.\n"
        )

    def use_role_playing(self, base_prompt: str, role: str = "expert tutor") -> str:
        """Prefix with a role instruction to steer tone and expertise."""
        return (
            f"You are acting as: {role}. "
            "Help the student learn; stay accurate, supportive, and aligned with the instructions below.\n\n"
            f"{base_prompt.lstrip()}"
        )

    def use_constraint_specification(self, base_prompt: str, constraints: dict[str, Any]) -> str:
        """
        Add explicit constraints: length, format, tone, forbidden topics, etc.
        """
        lines: list[str] = []
        if "length" in constraints and constraints["length"]:
            lines.append(f"- Length: {constraints['length']}")
        if "format" in constraints and constraints["format"]:
            lines.append(f"- Format: {constraints['format']}")
        if "tone" in constraints and constraints["tone"]:
            lines.append(f"- Tone: {constraints['tone']}")
        if "forbidden" in constraints and constraints["forbidden"]:
            lines.append(f"- Do not: {constraints['forbidden']}")
        for key, val in constraints.items():
            if key in {"length", "format", "tone", "forbidden"}:
                continue
            if val:
                lines.append(f"- {key}: {val}")
        if not lines:
            return base_prompt
        spec = "\n".join(lines)
        return (
            f"{base_prompt.rstrip()}\n\n"
            "CONSTRAINTS (follow strictly):\n"
            f"{spec}\n"
        )

    def use_output_structuring(self, base_prompt: str, structure: dict[str, Any]) -> str:
        """Ask for an exact output shape (e.g. JSON keys) to ease parsing."""
        structure_json = json.dumps(structure, indent=2, ensure_ascii=False)
        return (
            f"{base_prompt.rstrip()}\n\n"
            "OUTPUT STRUCTURE:\n"
            "Return a single valid JSON object with exactly these keys (types as described):\n"
            f"{structure_json}\n"
            "No markdown fences unless asked; prefer raw JSON only.\n"
        )

    def build_optimized_question_prompt(
        self,
        subject: str,
        difficulty: str,
        topic: str,
        question_type: str,
    ) -> str:
        """
        Compose a question-generation prompt using RAG base + few-shot + CoT
        + JSON structure + difficulty-based constraints.
        """
        base = self.rag_prompt_builder.build_question_generation_prompt(
            subject=subject,
            difficulty=difficulty,
            topic=topic,
            question_type=question_type,
        )

        # Pick 2–3 few-shot examples: same subject preferred, else any
        same_subj = [e for e in QUESTION_GENERATION_EXAMPLES if e.get("subject") == subject]
        pool = same_subj if same_subj else QUESTION_GENERATION_EXAMPLES
        few_shot_raw = pool[:3]
        few_shot = [
            {"Q": e.get("question"), "A": e.get("answer")}
            for e in few_shot_raw
        ]
        enhanced = self.use_few_shot_learning(base, few_shot)
        enhanced = self.use_chain_of_thought(enhanced)

        structure = {
            "question": "string — the question stem",
            "options": "array of strings — answer choices",
            "correct_answer": "string — must match one option exactly",
            "explanation": "string — short pedagogical explanation",
            "difficulty": "easy | medium | hard",
            "topic": "string — specific subtopic",
        }
        if question_type.strip().lower() in {"true/false", "tf", "true_false"}:
            structure["options"] = '["True", "False"]'
        enhanced = self.use_output_structuring(enhanced, structure)

        diff = (difficulty or "medium").lower()
        constraints: dict[str, Any] = {}
        if diff == "easy":
            constraints = {
                "length": "Keep stem under 3 sentences; explanation in 2–3 sentences.",
                "tone": "Use simple language; avoid jargon.",
                "forbidden": "Do not mention advanced topics outside the stated topic.",
            }
        elif diff == "medium":
            constraints = {
                "length": "Moderate detail; explanation in 3–5 sentences.",
                "format": "One clearly correct option; distractors plausible but wrong.",
                "forbidden": "Do not use trick wording or double negatives.",
            }
        else:
            constraints = {
                "length": "Allow multi-step reasoning in the stem if needed.",
                "tone": "Precise and rigorous; still fair for motivated first-years.",
                "forbidden": "Do not require knowledge not inferable from course content.",
            }
        enhanced = self.use_constraint_specification(enhanced, constraints)
        return enhanced

    def build_optimized_chatbot_prompt(
        self,
        question: str,
        context: str,
        student_level: str = "beginner",
    ) -> str:
        """
        Tutor-style prompt: role-play, RAG context, constraints by level, CoT for harder questions.
        """
        ctx = (context or "").strip()
        if not ctx:
            ctx = self.rag_service.get_context_for_query(question, max_chunks=5)
            if hasattr(self.rag_prompt_builder, "truncate_context"):
                ctx = self.rag_prompt_builder.truncate_context(ctx)

        base = (
            f"RELEVANT COURSE CONTENT:\n{ctx}\n\n"
            f"STUDENT QUESTION:\n{question}\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer using the course content when possible.\n"
            "2. If missing from content, say you don't have that in the materials.\n"
            "3. Be clear and encouraging.\n"
        )
        base = self.use_role_playing(base, role="expert tutor")

        level = (student_level or "beginner").lower()
        if level in {"beginner", "novice", "first-year"}:
            constraints = {
                "tone": "Use simple language and short sentences.",
                "format": "Prefer short paragraphs; define terms on first use.",
                "forbidden": "Avoid unexplained jargon and advanced topics unless asked.",
            }
        elif level in {"intermediate", "medium"}:
            constraints = {
                "tone": "Clear and precise; some technical terms OK if explained.",
                "length": "Answer in 2–4 short paragraphs unless a one-line answer suffices.",
            }
        else:
            constraints = {
                "tone": "Rigorous; you may use standard terminology.",
                "length": "Be concise but complete.",
            }
        base = self.use_constraint_specification(base, constraints)

        complex_q = (
            len(question) > 120
            or bool(re.search(r"\b(why|how|explain|prove|compare|analyze)\b", question, re.I))
        )
        if complex_q:
            base = self.use_chain_of_thought(base)
        return base

    def analyze_prompt_quality(self, prompt: str) -> dict[str, Any]:
        """
        Heuristic quality check: length band, ambiguity markers, clarity, examples.
        Returns score 0–100 and suggestions.
        """
        text = prompt or ""
        n = len(text)
        suggestions: list[str] = []
        length_score = 100
        if n < 500:
            length_score = 40
            suggestions.append("Prompt is short; add context, constraints, or examples (target ~500–2000 chars).")
        elif n > 2000:
            length_score = 70
            suggestions.append("Prompt is long; consider trimming redundancy while keeping constraints.")

        vague_pattern = re.compile(
            r"\b(it|this|that|thing|stuff|something)\b",
            re.I,
        )
        vague_hits = len(vague_pattern.findall(text))
        ambiguity_score = max(0, 100 - vague_hits * 15)
        if vague_hits > 3:
            suggestions.append("Replace vague pronouns ('it', 'this') with specific nouns where possible.")

        has_numbered = bool(re.search(r"^\s*\d+[\).]", text, re.M)) or "INSTRUCTIONS" in text.upper()
        has_requirements = "REQUIREMENT" in text.upper() or "CONSTRAINT" in text.upper()
        clarity_score = 90 if (has_numbered or has_requirements) else 55
        if not has_numbered and not has_requirements:
            suggestions.append("Add numbered INSTRUCTIONS or CONSTRAINTS for clearer behavior.")

        has_examples = bool(re.search(r"Example\s*\d", text, re.I)) or "Q:" in text and "A:" in text
        examples_score = 100 if has_examples else 60
        if not has_examples:
            suggestions.append("Consider few-shot examples for more consistent outputs.")

        overall = round(
            0.25 * length_score
            + 0.25 * ambiguity_score
            + 0.25 * clarity_score
            + 0.25 * examples_score
        )
        return {
            "length_chars": n,
            "length_optimal_band": "500-2000",
            "length_score": length_score,
            "ambiguity_score": ambiguity_score,
            "vague_token_hits": vague_hits,
            "clarity_score": clarity_score,
            "examples_present": has_examples,
            "examples_score": examples_score,
            "quality_score": overall,
            "suggestions": suggestions,
        }


def _demo() -> None:
    """Exercise each technique and print before/after comparisons."""
    ape = AdvancedPromptEngineer()
    base = "Summarize the main idea of the passage."

    print("=== Few-shot learning ===")
    fs = ape.use_few_shot_learning(
        base,
        [
            {"Q": "What is 2+2?", "A": "4"},
            {"Q": "Capital of France?", "A": "Paris"},
        ],
    )
    print("BEFORE:\n", base[:200], "...\n")
    print("AFTER:\n", fs[:600], "...\n")

    print("=== Chain-of-thought ===")
    cot = ape.use_chain_of_thought(base)
    print("BEFORE:\n", base, "\n")
    print("AFTER:\n", cot[:400], "...\n")

    print("=== Role-playing ===")
    rp = ape.use_role_playing(base, role="an expert tutor in history")
    print("BEFORE:\n", base, "\n")
    print("AFTER:\n", rp[:400], "...\n")

    print("=== Constraint specification ===")
    cons = ape.use_constraint_specification(
        base,
        {
            "length": "Answer in 2-3 sentences",
            "format": "Use bullet points",
            "tone": "Use simple language",
            "forbidden": "Do not mention advanced topics",
        },
    )
    print("AFTER:\n", cons, "\n")

    print("=== Output structuring ===")
    struct = ape.use_output_structuring(
        base,
        {"answer": "string", "explanation": "string", "confidence": "number 0-1"},
    )
    print("AFTER (truncated):\n", struct[:500], "...\n")

    print("=== Optimized question prompt (may call RAG) ===")
    try:
        q_prompt = ape.build_optimized_question_prompt(
            "Programming",
            "medium",
            "loops",
            "MCQ",
        )
        print("Length:", len(q_prompt))
        print(q_prompt[:1200], "...\n")
    except Exception as e:  # noqa: BLE001
        print(f"(skipped or partial: {e})\n")

    print("=== Optimized chatbot prompt ===")
    chat_p = ape.build_optimized_chatbot_prompt(
        "Why do we use for-loops instead of repeating code?",
        context="Loops allow repeating a block of code with different values each time.",
        student_level="beginner",
    )
    print(chat_p[:1500], "...\n")

    print("=== Prompt quality analysis (base vs enhanced) ===")
    qa_base = ape.analyze_prompt_quality(base)
    qa_enh = ape.analyze_prompt_quality(fs)
    print("Base:", json.dumps(qa_base, indent=2))
    print("Enhanced (few-shot):", json.dumps(qa_enh, indent=2))


if __name__ == "__main__":
    _demo()
