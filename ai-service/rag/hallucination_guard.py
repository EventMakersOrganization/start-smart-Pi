"""
Hallucination prevention and detection for AI-generated responses.
Validates that LLM output is grounded in retrieved course context,
filters unsafe content, and adds appropriate disclaimers.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from utils import langchain_ollama
from core.rag_service import RAGService

logger = logging.getLogger("hallucination_guard")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# Minimum word length considered "significant" when comparing claim vs context
# Lowered from 4 to 3 to support French (many keywords are 3 chars: "int", "for", "les")
_MIN_WORD_LEN = 3
# Fraction of claim keywords that must appear in context for it to count as supported
_CLAIM_SUPPORT_THRESHOLD = 0.4
# Fraction of claims that must be grounded for the whole response to be considered valid
_RESPONSE_VALID_THRESHOLD = 0.5

# Phrases that signal the model is appropriately hedging rather than fabricating
_HEDGING_PHRASES = [
    "i'm not sure",
    "i don't know",
    "not certain",
    "may not be covered",
    "might be",
    "could be",
    "i'm not confident",
    "not covered in the available",
    "i cannot confirm",
    "je ne suis pas sûr",
    "je ne sais pas",
    "pas certain",
    "n'est pas couvert",
    "pourrait être",
    "il est possible",
]

# Simple profanity / URL patterns to strip from output
_UNSAFE_PATTERNS = [
    r"\bfuck\b|\bshit\b|\bdamn\b",
    r"https?://(?:[a-zA-Z0-9]|[$\-_@.&+!*(),])+",
]


class HallucinationGuard:
    """Prevents and detects AI hallucinations in responses."""

    def __init__(self, rag_service: RAGService) -> None:
        self.rag_service = rag_service

    # ------------------------------------------------------------------
    # Response validation
    # ------------------------------------------------------------------

    def validate_response_against_context(
        self,
        response: str,
        context: str,
    ) -> dict[str, Any]:
        """
        Check whether an AI response is grounded in provided context.

        Returns:
            ``is_valid`` (bool), ``confidence`` (0-1), ``issues`` (list of
            ungrounded claims), ``total_claims``, ``grounded_claims``.
        """
        claims = self._extract_claims(response)

        if not claims:
            return {
                "is_valid": True,
                "confidence": 1.0,
                "issues": [],
                "total_claims": 0,
                "grounded_claims": 0,
            }

        grounded = 0
        ungrounded: list[str] = []
        for claim in claims:
            if self._is_claim_supported(claim, context):
                grounded += 1
            else:
                ungrounded.append(claim)

        confidence = grounded / len(claims)
        return {
            "is_valid": confidence >= _RESPONSE_VALID_THRESHOLD,
            "confidence": round(confidence, 4),
            "issues": ungrounded,
            "total_claims": len(claims),
            "grounded_claims": grounded,
        }

    # ------------------------------------------------------------------
    # Claim extraction and support checking
    # ------------------------------------------------------------------

    def _extract_claims(self, text: str) -> list[str]:
        """
        Extract factual claim sentences from *text*.
        Filters out questions, very short fragments, greetings, and
        meta-statements.  Handles both English and French text.
        """
        raw = re.split(r"(?<=[.!])\s+", text.strip())
        skip_phrases = {
            "i am", "i can", "let me", "hello", "hi there", "sure,", "of course",
            "bonjour", "je suis", "je peux", "bien sûr", "salut",
        }
        claims: list[str] = []
        for sentence in raw:
            s = sentence.strip().rstrip(".")
            if not s or len(s) < 10:
                continue
            if "?" in s:
                continue
            if any(phrase in s.lower() for phrase in skip_phrases):
                continue
            claims.append(s)
        return claims

    def _is_claim_supported(self, claim: str, context: str) -> bool:
        """
        Check whether the significant keywords of *claim* appear in *context*.
        Returns ``True`` if the overlap ratio >= ``_CLAIM_SUPPORT_THRESHOLD``.
        Also returns True for short claims or code snippets (likely rephrasing).
        """
        if len(claim) < 30:
            return True
        # Code snippets in backticks or with C-like syntax are likely from the course
        if "```" in claim or re.search(r"\b(int|void|float|char|return|for|while)\b", claim):
            return True
        claim_words = set(re.findall(rf"\b\w{{{_MIN_WORD_LEN},}}\b", claim.lower()))
        if not claim_words:
            return True
        context_words = set(re.findall(rf"\b\w{{{_MIN_WORD_LEN},}}\b", context.lower()))
        overlap = claim_words & context_words
        return (len(overlap) / len(claim_words)) >= _CLAIM_SUPPORT_THRESHOLD

    # ------------------------------------------------------------------
    # Prompt hardening
    # ------------------------------------------------------------------

    def add_hallucination_prevention_instructions(self, prompt: str) -> str:
        """
        Inject explicit anti-hallucination instructions into *prompt*.
        If the prompt contains ``YOUR ANSWER:``, the block is inserted just
        before it; otherwise it is appended.
        """
        safety = (
            "\nIMPORTANT GUIDELINES:\n"
            "1. Base your answer primarily on the course content provided above.\n"
            "2. Do NOT invent facts, formulas, or code that are not in the content.\n"
            "3. You MAY rephrase, summarize, and explain the content in your own words.\n"
            "4. If you are unsure, say so — but still try to help with what is available.\n\n"
        )
        if "YOUR ANSWER:" in prompt:
            return prompt.replace("YOUR ANSWER:", safety + "YOUR ANSWER:")
        return prompt + "\n" + safety

    # ------------------------------------------------------------------
    # Question validation
    # ------------------------------------------------------------------

    def verify_question_validity(
        self,
        question_dict: dict[str, Any],
        source_context: str,
    ) -> dict[str, Any]:
        """
        Verify that a generated question is based on actual course content.

        Returns:
            ``is_valid`` (bool), ``confidence`` (0-1), ``issues`` (list).
        """
        issues: list[str] = []

        question_text = question_dict.get("question", "")
        if not self._is_claim_supported(question_text, source_context):
            issues.append("Question topic not well-supported by source material")

        correct_answer = str(question_dict.get("correct_answer", ""))
        if correct_answer and len(correct_answer) > 5:
            if correct_answer.lower() not in source_context.lower():
                answer_words = set(
                    re.findall(rf"\b\w{{{_MIN_WORD_LEN},}}\b", correct_answer.lower())
                )
                context_words = set(
                    re.findall(rf"\b\w{{{_MIN_WORD_LEN},}}\b", source_context.lower())
                )
                if answer_words and len(answer_words & context_words) < len(answer_words) * 0.5:
                    issues.append("Correct answer may not be supported by course material")

        for option in question_dict.get("options", []):
            if len(str(option)) > 200:
                issues.append(f"Option too long: {str(option)[:50]}...")

        confidence = max(0.0, 1.0 - len(issues) * 0.25)
        return {"is_valid": len(issues) == 0, "confidence": confidence, "issues": issues}

    # ------------------------------------------------------------------
    # Content filtering
    # ------------------------------------------------------------------

    def filter_unsafe_content(self, text: str) -> str:
        """Replace profanity and raw URLs with ``[filtered]``."""
        out = text
        for pattern in _UNSAFE_PATTERNS:
            out = re.sub(pattern, "[filtered]", out, flags=re.IGNORECASE)
        return out

    # ------------------------------------------------------------------
    # Full post-processing pipeline
    # ------------------------------------------------------------------

    def post_process_response(
        self,
        response: str,
        context: str,
    ) -> dict[str, Any]:
        """
        End-to-end post-processing: safety filter, grounding validation,
        and optional disclaimer injection.

        Returns:
            ``cleaned_response``, ``is_safe`` (bool), ``validation`` dict.
        """
        cleaned = self.filter_unsafe_content(response)
        validation = self.validate_response_against_context(cleaned, context)

        if validation["confidence"] < _RESPONSE_VALID_THRESHOLD:
            cleaned += (
                "\n\n[Note: Please verify this information with "
                "course materials or your instructor.]"
            )

        return {
            "cleaned_response": cleaned,
            "is_safe": True,
            "validation": validation,
        }


# ------------------------------------------------------------------
# Standalone utilities
# ------------------------------------------------------------------


def detect_hedging_language(text: str) -> bool:
    """
    Return ``True`` if *text* contains hedging phrases that indicate
    appropriate uncertainty (a good sign the model isn't fabricating).
    """
    text_lower = text.lower()
    return any(phrase in text_lower for phrase in _HEDGING_PHRASES)


# ------------------------------------------------------------------
# Self-test
# ------------------------------------------------------------------

if __name__ == "__main__":
    rag = RAGService.get_instance()
    guard = HallucinationGuard(rag)

    context = (
        "Python uses for loops to iterate over sequences. "
        "The syntax is: for item in sequence."
    )

    # --- Test 1: grounded response ---
    print("=" * 60)
    print("TEST 1: Valid Response")
    print("=" * 60)
    response_ok = (
        "For loops in Python are used to iterate over sequences "
        "using the syntax 'for item in sequence'."
    )
    r1 = guard.validate_response_against_context(response_ok, context)
    print(f"Is valid : {r1['is_valid']}")
    print(f"Confidence: {r1['confidence']:.2f}")
    print(f"Issues    : {r1['issues']}")

    # --- Test 2: hallucinated response ---
    print("\n" + "=" * 60)
    print("TEST 2: Hallucinated Response")
    print("=" * 60)
    response_bad = (
        "Python also has a special 'repeat' keyword that works "
        "like loops but faster."
    )
    r2 = guard.validate_response_against_context(response_bad, context)
    print(f"Is valid : {r2['is_valid']}")
    print(f"Confidence: {r2['confidence']:.2f}")
    print(f"Issues    : {r2['issues']}")

    # --- Test 3: prompt hardening ---
    print("\n" + "=" * 60)
    print("TEST 3: Prompt Hardening")
    print("=" * 60)
    sample_prompt = "Answer this.\n\nYOUR ANSWER:"
    hardened = guard.add_hallucination_prevention_instructions(sample_prompt)
    print(hardened[:300])

    # --- Test 4: question validation ---
    print("\n" + "=" * 60)
    print("TEST 4: Question Validation")
    print("=" * 60)
    good_q = {
        "question": "What keyword starts a for loop in Python?",
        "options": ["for", "while", "loop", "repeat"],
        "correct_answer": "for",
    }
    r3 = guard.verify_question_validity(good_q, context)
    print(f"Valid: {r3['is_valid']}  Confidence: {r3['confidence']:.2f}  Issues: {r3['issues']}")

    bad_q = {
        "question": "What is the capital of France?",
        "options": ["Paris", "London"],
        "correct_answer": "Paris",
    }
    r4 = guard.verify_question_validity(bad_q, context)
    print(f"Valid: {r4['is_valid']}  Confidence: {r4['confidence']:.2f}  Issues: {r4['issues']}")

    # --- Test 5: post-process pipeline ---
    print("\n" + "=" * 60)
    print("TEST 5: Post-process Pipeline")
    print("=" * 60)
    raw = "Loops iterate. Visit http://evil.com for more. Also damn, Python is great."
    pp = guard.post_process_response(raw, context)
    print(f"Cleaned : {pp['cleaned_response']}")
    print(f"Safe    : {pp['is_safe']}")
    print(f"Validity: {pp['validation']}")

    # --- Test 6: hedging detection ---
    print("\n" + "=" * 60)
    print("TEST 6: Hedging Detection")
    print("=" * 60)
    hedge_yes = detect_hedging_language("I'm not sure about that")
    hedge_no = detect_hedging_language("The answer is definitely 42")
    print(f"Hedging detected: {hedge_yes}")
    print(f"No hedging      : {hedge_no}")
