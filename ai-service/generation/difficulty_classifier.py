"""
Difficulty level classification algorithm for questions and text content.

Analyses linguistic complexity, technical density, cognitive load (Bloom's
taxonomy), and optional RAG-based topic depth to assign easy / medium / hard.
"""
from __future__ import annotations

import math
import re
import statistics
import sys
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.rag_service import RAGService

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DIFFICULTY_LEVELS = ("easy", "medium", "hard")

_TECHNICAL_TERMS = re.compile(
    r"\b("
    r"algorithm|recursion|polymorphism|inheritance|encapsulation|abstraction|"
    r"derivative|integral|matrix|vector|eigenvalue|determinant|"
    r"asynchronous|concurrency|mutex|semaphore|deadlock|"
    r"regression|gradient|backpropagation|optimizer|"
    r"normalization|denormalization|indexing|shard|"
    r"binary|hexadecimal|bitwise|pointer|reference|"
    r"lambda|closure|decorator|generator|iterator|coroutine|"
    r"theorem|proof|axiom|hypothesis|lemma|corollary|"
    r"complexity|amortized|logarithmic|exponential|polynomial|"
    r"protocol|handshake|encryption|hash|cipher|token"
    r")\b",
    re.IGNORECASE,
)

_EASY_VERBS = re.compile(
    r"\b(define|list|name|identify|state|recall|label|match|select)\b",
    re.IGNORECASE,
)
_MEDIUM_VERBS = re.compile(
    r"\b(explain|describe|summarize|interpret|classify|compare|contrast|"
    r"illustrate|solve|apply|demonstrate|calculate|use)\b",
    re.IGNORECASE,
)
_HARD_VERBS = re.compile(
    r"\b(analyze|evaluate|critique|justify|design|develop|construct|"
    r"compose|formulate|synthesize|prove|derive|optimize|refactor)\b",
    re.IGNORECASE,
)

_MULTI_STEP = re.compile(
    r"\b(step[- ]by[- ]step|first .+ then|and then|after that|finally)\b",
    re.IGNORECASE,
)
_NEGATION = re.compile(
    r"\b(not|never|neither|cannot|shouldn't|won't|doesn't|isn't|aren't)\b",
    re.IGNORECASE,
)
_CONDITIONAL = re.compile(
    r"\b(if|unless|provided that|assuming|given that|when .+ then)\b",
    re.IGNORECASE,
)

# Bloom's taxonomy weights (higher level = harder)
_BLOOM_WEIGHTS = {
    "Remember": 0.10,
    "Understand": 0.25,
    "Apply": 0.45,
    "Analyze": 0.65,
    "Evaluate": 0.80,
    "Create": 0.95,
}


# ---------------------------------------------------------------------------
# Feature extractors
# ---------------------------------------------------------------------------

def _word_tokens(text: str) -> list[str]:
    return re.findall(r"[A-Za-z]+", text)


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"[.!?]+", text) if s.strip()]


def compute_linguistic_features(text: str) -> dict[str, float]:
    """Word count, avg word length, avg sentence length, long-word ratio."""
    words = _word_tokens(text)
    sents = _sentences(text)
    n_words = len(words) or 1
    avg_word_len = statistics.mean(len(w) for w in words) if words else 0.0
    avg_sent_len = n_words / max(len(sents), 1)
    long_word_ratio = sum(1 for w in words if len(w) >= 9) / n_words
    return {
        "word_count": float(n_words),
        "avg_word_length": round(avg_word_len, 3),
        "avg_sentence_length": round(avg_sent_len, 3),
        "long_word_ratio": round(long_word_ratio, 4),
    }


def compute_technical_density(text: str) -> dict[str, float]:
    """Ratio of technical terms to total words; raw technical term count."""
    words = _word_tokens(text)
    n_words = max(len(words), 1)
    hits = _TECHNICAL_TERMS.findall(text)
    return {
        "technical_term_count": float(len(hits)),
        "technical_density": round(len(hits) / n_words, 4),
    }


def compute_cognitive_load(text: str) -> dict[str, float]:
    """Bloom verb signals, multi-step markers, negations, conditionals."""
    easy_hits = len(_EASY_VERBS.findall(text))
    medium_hits = len(_MEDIUM_VERBS.findall(text))
    hard_hits = len(_HARD_VERBS.findall(text))
    multi = len(_MULTI_STEP.findall(text))
    negations = len(_NEGATION.findall(text))
    conditionals = len(_CONDITIONAL.findall(text))

    total = easy_hits + medium_hits + hard_hits or 1
    bloom_score = (
        easy_hits * _BLOOM_WEIGHTS["Remember"]
        + medium_hits * _BLOOM_WEIGHTS["Apply"]
        + hard_hits * _BLOOM_WEIGHTS["Evaluate"]
    ) / total

    return {
        "easy_verb_count": float(easy_hits),
        "medium_verb_count": float(medium_hits),
        "hard_verb_count": float(hard_hits),
        "bloom_weighted_score": round(bloom_score, 4),
        "multi_step_markers": float(multi),
        "negation_count": float(negations),
        "conditional_count": float(conditionals),
    }


def compute_structural_complexity(question_dict: dict) -> dict[str, float]:
    """MCQ-specific: option count, option length variance, has code snippet."""
    options = question_dict.get("options") or []
    n_opts = float(len(options))
    lens = [len(str(o)) for o in options]
    var = statistics.variance(lens) if len(lens) > 1 else 0.0
    has_code = 1.0 if any(
        c in str(question_dict.get("question", ""))
        for c in ("```", "def ", "class ", "for ", "while ", "import ", "print(", "=>", "->")
    ) else 0.0
    return {
        "option_count": n_opts,
        "option_length_variance": round(var, 2),
        "has_code_snippet": has_code,
    }


# ---------------------------------------------------------------------------
# Classifier
# ---------------------------------------------------------------------------


class DifficultyClassifier:
    """
    Rule-based difficulty classifier for educational questions and text.

    Combines linguistic, technical, cognitive, and structural features into a
    composite score (0-1) then maps to easy / medium / hard.
    """

    WEIGHTS: dict[str, float] = {
        "linguistic": 0.15,
        "technical": 0.25,
        "cognitive": 0.30,
        "structural": 0.15,
        "topic_depth": 0.15,
    }

    EASY_THRESHOLD = 0.28
    HARD_THRESHOLD = 0.58

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()

    # --- Top-level API ----------------------------------------------------

    def classify_question(self, question_dict: dict) -> dict[str, Any]:
        """
        Classify a full question dict (stem, options, explanation, topic, ...).

        Returns:
            difficulty, confidence, composite_score, feature_breakdown, suggestions
        """
        stem = str(question_dict.get("question", ""))
        expl = str(question_dict.get("explanation", ""))
        full_text = f"{stem} {expl}"

        ling = compute_linguistic_features(full_text)
        tech = compute_technical_density(full_text)
        cog = compute_cognitive_load(stem)
        struct = compute_structural_complexity(question_dict)
        topic_depth = self._estimate_topic_depth(
            question_dict.get("topic", ""),
            question_dict.get("subject", ""),
        )

        ling_score = self._linguistic_score(ling)
        tech_score = self._technical_score(tech)
        cog_score = cog["bloom_weighted_score"]
        struct_score = self._structural_score(struct)

        composite = (
            self.WEIGHTS["linguistic"] * ling_score
            + self.WEIGHTS["technical"] * tech_score
            + self.WEIGHTS["cognitive"] * cog_score
            + self.WEIGHTS["structural"] * struct_score
            + self.WEIGHTS["topic_depth"] * topic_depth
        )
        composite = max(0.0, min(1.0, composite))
        difficulty = self._score_to_level(composite)
        confidence = self._compute_confidence(composite, ling_score, tech_score, cog_score)

        claimed = str(question_dict.get("difficulty", "")).lower()
        suggestions = self._generate_suggestions(difficulty, claimed, ling, tech, cog, struct)

        return {
            "difficulty": difficulty,
            "confidence": round(confidence, 3),
            "composite_score": round(composite, 4),
            "feature_breakdown": {
                "linguistic": {"score": round(ling_score, 4), **ling},
                "technical": {"score": round(tech_score, 4), **tech},
                "cognitive": {"score": round(cog_score, 4), **cog},
                "structural": {"score": round(struct_score, 4), **struct},
                "topic_depth": round(topic_depth, 4),
            },
            "suggestions": suggestions,
        }

    def classify_text(self, text: str) -> dict[str, Any]:
        """Classify arbitrary text (e.g. a paragraph, a course section)."""
        ling = compute_linguistic_features(text)
        tech = compute_technical_density(text)
        cog = compute_cognitive_load(text)

        ling_score = self._linguistic_score(ling)
        tech_score = self._technical_score(tech)
        cog_score = cog["bloom_weighted_score"]

        w = self.WEIGHTS
        composite = (
            (w["linguistic"] + w["structural"]) * ling_score
            + (w["technical"] + w["topic_depth"]) * tech_score
            + w["cognitive"] * cog_score
        )
        composite = max(0.0, min(1.0, composite))
        difficulty = self._score_to_level(composite)
        confidence = self._compute_confidence(composite, ling_score, tech_score, cog_score)

        return {
            "difficulty": difficulty,
            "confidence": round(confidence, 3),
            "composite_score": round(composite, 4),
            "feature_breakdown": {
                "linguistic": {"score": round(ling_score, 4), **ling},
                "technical": {"score": round(tech_score, 4), **tech},
                "cognitive": {"score": round(cog_score, 4), **cog},
            },
        }

    def classify_batch(self, questions: list[dict]) -> dict[str, Any]:
        """Classify a list of questions; return per-item results + summary."""
        results: list[dict[str, Any]] = []
        for q in questions or []:
            results.append(self.classify_question(q))

        levels = [r["difficulty"] for r in results]
        dist = {lv: levels.count(lv) for lv in DIFFICULTY_LEVELS}
        scores = [r["composite_score"] for r in results]
        avg = statistics.mean(scores) if scores else 0.0
        std = statistics.stdev(scores) if len(scores) > 1 else 0.0

        mismatches: list[dict[str, Any]] = []
        for i, (q, r) in enumerate(zip(questions or [], results)):
            claimed = str(q.get("difficulty", "")).lower()
            if claimed in DIFFICULTY_LEVELS and claimed != r["difficulty"]:
                mismatches.append({
                    "index": i,
                    "claimed": claimed,
                    "predicted": r["difficulty"],
                    "composite_score": r["composite_score"],
                })

        return {
            "count": len(results),
            "distribution": dist,
            "average_score": round(avg, 4),
            "stdev_score": round(std, 4),
            "mismatches": mismatches,
            "per_question": results,
        }

    def suggest_difficulty_adjustment(self, question_dict: dict) -> dict[str, Any]:
        """
        If claimed difficulty disagrees with prediction, suggest how to
        adjust the question (add/remove complexity) to match the label.
        """
        result = self.classify_question(question_dict)
        claimed = str(question_dict.get("difficulty", "")).lower()
        if claimed not in DIFFICULTY_LEVELS:
            claimed = result["difficulty"]

        if claimed == result["difficulty"]:
            return {
                "adjustment_needed": False,
                "claimed": claimed,
                "predicted": result["difficulty"],
                "tips": [],
            }

        order = {lv: i for i, lv in enumerate(DIFFICULTY_LEVELS)}
        gap = order[claimed] - order[result["difficulty"]]
        tips: list[str] = []

        if gap > 0:
            tips.append("Add more technical terminology or domain-specific jargon.")
            tips.append("Use multi-step reasoning or conditional logic in the stem.")
            tips.append("Include code snippets, formulas, or diagrams that require analysis.")
            tips.append("Make distractors more plausible (closer to the correct answer).")
        else:
            tips.append("Simplify vocabulary and shorten sentences.")
            tips.append("Remove multi-step reasoning; ask for a single fact or definition.")
            tips.append("Use concrete, everyday examples instead of abstract concepts.")
            tips.append("Make distractors more obviously wrong for easier elimination.")

        return {
            "adjustment_needed": True,
            "claimed": claimed,
            "predicted": result["difficulty"],
            "direction": "increase" if gap > 0 else "decrease",
            "tips": tips,
            "current_score": result["composite_score"],
        }

    # --- Internal scoring -------------------------------------------------

    def _linguistic_score(self, feats: dict[str, float]) -> float:
        awl = feats.get("avg_word_length", 0.0)
        asl = feats.get("avg_sentence_length", 0.0)
        lwr = feats.get("long_word_ratio", 0.0)
        # Normalize each to ~0-1 via sigmoid-like ramps
        s_awl = min(1.0, max(0.0, (awl - 3.5) / 3.0))
        s_asl = min(1.0, max(0.0, (asl - 8.0) / 20.0))
        s_lwr = min(1.0, lwr * 5.0)
        return 0.40 * s_awl + 0.35 * s_asl + 0.25 * s_lwr

    def _technical_score(self, feats: dict[str, float]) -> float:
        density = feats.get("technical_density", 0.0)
        count = feats.get("technical_term_count", 0.0)
        s_density = min(1.0, density * 15.0)
        s_count = min(1.0, count / 6.0)
        return 0.6 * s_density + 0.4 * s_count

    def _structural_score(self, feats: dict[str, float]) -> float:
        code = feats.get("has_code_snippet", 0.0)
        var = feats.get("option_length_variance", 0.0)
        s_var = min(1.0, var / 600.0)
        return 0.5 * code + 0.5 * s_var

    def _estimate_topic_depth(self, topic: str, subject: str) -> float:
        """Use RAG chunk count as a proxy for how niche a topic is."""
        query = f"{subject} {topic}".strip()
        if not query:
            return 0.3
        try:
            ctx = self.rag_service.get_context_for_query(query, max_chunks=3)
            if not ctx or len(ctx.strip()) < 30:
                return 0.6  # scarce coverage ≈ harder niche topic
            return 0.3 + min(0.4, len(ctx) / 3000)
        except Exception:
            return 0.3

    def _score_to_level(self, score: float) -> str:
        if score < self.EASY_THRESHOLD:
            return "easy"
        if score < self.HARD_THRESHOLD:
            return "medium"
        return "hard"

    def _compute_confidence(
        self,
        composite: float,
        ling: float,
        tech: float,
        cog: float,
    ) -> float:
        """Higher confidence when sub-scores agree; lower near thresholds."""
        scores = [ling, tech, cog]
        spread = max(scores) - min(scores) if scores else 0.0
        agreement = max(0.0, 1.0 - spread * 1.5)

        dist_to_boundary = min(
            abs(composite - self.EASY_THRESHOLD),
            abs(composite - self.HARD_THRESHOLD),
        )
        boundary_clarity = min(1.0, dist_to_boundary / 0.15)

        return 0.5 * agreement + 0.5 * boundary_clarity

    def _generate_suggestions(
        self,
        predicted: str,
        claimed: str,
        ling: dict,
        tech: dict,
        cog: dict,
        struct: dict,
    ) -> list[str]:
        suggestions: list[str] = []
        if claimed and claimed in DIFFICULTY_LEVELS and claimed != predicted:
            suggestions.append(
                f"Claimed '{claimed}' but features suggest '{predicted}'."
            )
        if tech["technical_density"] < 0.01 and predicted in ("medium", "hard"):
            suggestions.append("Very low technical density for this difficulty; add domain terms.")
        if cog["hard_verb_count"] == 0 and predicted == "hard":
            suggestions.append("No higher-order verbs (analyze, evaluate, design); consider adding some.")
        if cog["multi_step_markers"] == 0 and predicted == "hard":
            suggestions.append("No multi-step reasoning markers; complex questions usually need them.")
        if struct["has_code_snippet"] == 0 and tech["technical_density"] > 0.05:
            suggestions.append("High technical density but no code — a snippet could reinforce difficulty.")
        if ling["avg_sentence_length"] > 30:
            suggestions.append("Very long sentences; consider splitting for clarity regardless of difficulty.")
        return suggestions


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

def _demo() -> None:
    import json

    clf = DifficultyClassifier()

    easy_q = {
        "question": "What keyword is used to define a function in Python?",
        "options": ["def", "func", "define", "function"],
        "correct_answer": "def",
        "explanation": "The 'def' keyword starts a function definition.",
        "difficulty": "easy",
        "topic": "functions",
        "subject": "Programming",
    }

    medium_q = {
        "question": (
            "Explain what happens when you call a recursive function that has "
            "no base case. Describe the expected behavior and the error produced."
        ),
        "options": [
            "Stack overflow due to infinite recursion",
            "The function returns None",
            "Python silently ignores it",
            "The program exits gracefully",
        ],
        "correct_answer": "Stack overflow due to infinite recursion",
        "explanation": (
            "Without a base case the function calls itself indefinitely, consuming "
            "stack frames until Python raises a RecursionError (stack overflow)."
        ),
        "difficulty": "medium",
        "topic": "recursion",
        "subject": "Programming",
    }

    hard_q = {
        "question": (
            "Analyze the time complexity of the following algorithm and justify "
            "whether an amortized O(1) claim holds:\n"
            "```\ndef push(stack, val):\n"
            "    if len(stack) == stack.capacity:\n"
            "        stack.resize(2 * stack.capacity)\n"
            "    stack.append(val)\n```\n"
            "Compare this with a naive approach that resizes by a constant increment."
        ),
        "options": [
            "Amortized O(1) holds because doubling halves resize frequency",
            "O(n) per push regardless of strategy",
            "O(log n) amortized due to doubling",
            "O(1) only if capacity is pre-allocated",
        ],
        "correct_answer": "Amortized O(1) holds because doubling halves resize frequency",
        "explanation": (
            "Doubling yields amortized O(1) via the accounting/potential method: each "
            "push that doesn't resize 'pays' for the next resize. A constant increment "
            "gives amortized O(n) because resizes happen every k pushes."
        ),
        "difficulty": "hard",
        "topic": "algorithm complexity",
        "subject": "Programming",
    }

    for label, q in [("EASY", easy_q), ("MEDIUM", medium_q), ("HARD", hard_q)]:
        print("=" * 60)
        print(f"  {label} question")
        print("=" * 60)
        r = clf.classify_question(q)
        print(json.dumps({
            "predicted": r["difficulty"],
            "confidence": r["confidence"],
            "composite_score": r["composite_score"],
            "suggestions": r["suggestions"],
        }, indent=2))
        print()

    print("=" * 60)
    print("  Text classification (paragraph)")
    print("=" * 60)
    text = (
        "A variable stores data in memory. You can assign a value with the equals sign. "
        "For example, x = 5 stores the integer 5 in x."
    )
    r_text = clf.classify_text(text)
    print(json.dumps({k: r_text[k] for k in ("difficulty", "confidence", "composite_score")}, indent=2))
    print()

    print("=" * 60)
    print("  Batch classification")
    print("=" * 60)
    batch = clf.classify_batch([easy_q, medium_q, hard_q])
    print(f"Distribution: {batch['distribution']}")
    print(f"Average score: {batch['average_score']}")
    print(f"Mismatches: {batch['mismatches']}")
    print()

    print("=" * 60)
    print("  Adjustment suggestion (mislabeled question)")
    print("=" * 60)
    mislabeled = {**hard_q, "difficulty": "easy"}
    adj = clf.suggest_difficulty_adjustment(mislabeled)
    print(json.dumps(adj, indent=2))


if __name__ == "__main__":
    _demo()
