"""
Advanced question quality validation: clarity, answers, distractors,
explanations, difficulty alignment, and source grounding.
"""
from __future__ import annotations

import re
import statistics
import sys
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

# Ensure ai-service root is on sys.path when running: python generation/question_quality_validator.py
_SERVICE_ROOT = Path(__file__).resolve().parent.parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from core.rag_service import RAGService
from generation.question_validator import QuestionValidator

# ---------------------------------------------------------------------------
# Quality metrics (module-level)
# ---------------------------------------------------------------------------

_BLOOM_RULES: list[tuple[str, list[str]]] = [
    (
        "Create",
        [
            r"\b(design|develop|construct|create|compose|formulate|propose|write\s+a)\b",
        ],
    ),
    (
        "Evaluate",
        [
            r"\b(judge|assess|critique|evaluate|justify|defend|argue\s+(for|against))\b",
        ],
    ),
    (
        "Analyze",
        [
            r"\b(compare|contrast|differentiate|distinguish|analyze|examine|infer|organize)\b",
        ],
    ),
    (
        "Apply",
        [
            r"\b(solve|use|apply|demonstrate|implement|calculate|compute|execute)\b",
        ],
    ),
    (
        "Understand",
        [
            r"\b(explain|describe|summarize|interpret|classify|discuss|why|how\s+does)\b",
        ],
    ),
    (
        "Remember",
        [
            r"\b(what\s+is|define|list|name|identify|state|recall|when\s+did|who\s+is)\b",
            r"\b(which|what)\s+keyword\b",
        ],
    ),
]


def calculate_bloom_taxonomy_level(question_text: str) -> str:
    """
    Classify question stem by Bloom's taxonomy using keyword patterns.
    Returns one of: Remember, Understand, Apply, Analyze, Evaluate, Create, Unknown.
    """
    if not question_text or not isinstance(question_text, str):
        return "Unknown"
    text = question_text.strip()
    if not text:
        return "Unknown"
    lower = text.lower()
    for level, patterns in _BLOOM_RULES:
        for pat in patterns:
            if re.search(pat, lower, re.IGNORECASE):
                return level
    return "Unknown"


def detect_question_patterns(questions: list[dict]) -> dict[str, Any]:
    """
    Detect repetitive stems, overused openings, and format skew in a batch.
    """
    stems: list[str] = []
    openings: dict[str, int] = {}
    for q in questions or []:
        qt = str(q.get("question", "")).strip()
        if not qt:
            continue
        stems.append(qt.lower())
        first = re.match(r"^([\w\s]{0,40})", qt)
        if first:
            key = first.group(1).strip().lower()[:30]
            openings[key] = openings.get(key, 0) + 1

    repeated_openings = {k: v for k, v in openings.items() if v >= 2 and k}
    # Near-duplicate stems (simple normalized equality)
    norm = [re.sub(r"\s+", " ", s)[:80] for s in stems]
    cnt = Counter(norm)
    duplicate_stems = {k: v for k, v in cnt.items() if v >= 2 and k}

    formats: dict[str, int] = {}
    for q in questions or []:
        qt = str(q.get("question", ""))
        if re.match(r"^\s*what\s+is\b", qt, re.I):
            formats["what_is"] = formats.get("what_is", 0) + 1
        if re.match(r"^\s*which\b", qt, re.I):
            formats["which"] = formats.get("which", 0) + 1
        if "?" in qt:
            formats["question_mark"] = formats.get("question_mark", 0) + 1

    overused: list[str] = []
    n = len(questions) or 1
    for name, c in formats.items():
        if c / n > 0.5:
            overused.append(f"Format '{name}' appears in {c}/{len(questions)} questions (>50%)")

    return {
        "total_questions": len(questions or []),
        "repeated_opening_phrases": repeated_openings,
        "duplicate_stem_prefixes": duplicate_stems,
        "format_counts": formats,
        "overused_format_warnings": overused,
    }


# ---------------------------------------------------------------------------
# QuestionQualityValidator
# ---------------------------------------------------------------------------


class QuestionQualityValidator(QuestionValidator):
    """Extends QuestionValidator with scoring, distractor analysis, and batch stats."""

    def __init__(self) -> None:
        super().__init__()
        self.rag_service = RAGService.get_instance()
        self.quality_thresholds: dict[str, Any] = {
            "clarity_optimal_min": 50,
            "clarity_optimal_max": 200,
            "explanation_min_len": 50,
            "answer_min_len": 1,
            "answer_max_len": 500,
            "overall_passing_score": 60.0,
            "vague_pattern_penalty": 15.0,
        }

    def _is_mcq(self, question_dict: dict) -> bool:
        qtype = str(question_dict.get("type", "MCQ")).strip()
        opts = question_dict.get("options")
        return qtype == "MCQ" or (
            qtype not in ("TrueFalse", "DragDrop") and isinstance(opts, list) and len(opts) >= 2
        )

    def assess_question_clarity(self, question_text: str) -> dict[str, Any]:
        """Score stem clarity; flag vague or ambiguous phrasing."""
        issues: list[str] = []
        text = (question_text or "").strip()
        if not text:
            return {"clarity_score": 0.0, "issues": ["Question text is empty"]}

        score = 100.0
        n = len(text)
        lo, hi = self.quality_thresholds["clarity_optimal_min"], self.quality_thresholds["clarity_optimal_max"]
        if n < lo:
            issues.append(f"Question is short ({n} chars); optimal range {lo}-{hi}.")
            score -= min(25.0, (lo - n) / lo * 25)
        elif n > hi:
            issues.append(f"Question is long ({n} chars); consider tightening ({lo}-{hi}).")
            score -= min(15.0, (n - hi) / hi * 15)

        if re.match(r"^\s*What is\s+(\w+)\s*\?\s*$", text, re.IGNORECASE):
            issues.append('Very generic "What is X?" pattern; add context or constraints.')
            score -= self.quality_thresholds["vague_pattern_penalty"]

        vague_tokens = len(re.findall(r"\b(it|this|that|thing|stuff)\b", text, re.I))
        if vague_tokens >= 2:
            issues.append("Multiple vague referents (it/this/that); be more specific.")
            score -= 10.0 * min(vague_tokens - 1, 3)

        if not text.endswith("?") and "choose" not in text.lower():
            issues.append("Stem may read as a fragment; consider ending with a question.")
            score -= 5.0

        score = max(0.0, min(100.0, score))
        return {"clarity_score": round(score, 2), "issues": issues}

    def assess_answer_quality(
        self,
        correct_answer: str,
        options: list[str] | None = None,
    ) -> dict[str, Any]:
        """Score correctness metadata: membership in options, length, obviousness."""
        issues: list[str] = []
        score = 100.0
        ca = (correct_answer or "").strip()
        amin = int(self.quality_thresholds["answer_min_len"])
        amax = int(self.quality_thresholds["answer_max_len"])

        if len(ca) < amin:
            issues.append("Correct answer is empty or too short.")
            return {"answer_quality": 0.0, "issues": issues}

        if len(ca) > amax:
            issues.append(f"Correct answer is very long ({len(ca)} chars).")
            score -= 15.0

        if options is not None and isinstance(options, list) and len(options) >= 2:
            norm_opts = [str(o).strip() for o in options]
            if ca not in norm_opts:
                issues.append("correct_answer is not exactly one of the listed options.")
                score -= 50.0
            # Obvious: much longer correct vs distractors or stands out
            lens = [len(str(o)) for o in options]
            if lens:
                ca_len = len(ca)
                if ca_len > max(lens) * 1.5 and max(lens) > 0:
                    issues.append("Correct option is much longer than others (may be obvious).")
                    score -= 12.0
                if ca_len < min(lens) * 0.4 and min(lens) > 5:
                    issues.append("Correct option is much shorter than others (may stand out).")
                    score -= 8.0

        score = max(0.0, min(100.0, score))
        return {"answer_quality": round(score, 2), "issues": issues}

    def assess_distractor_quality(self, options: list[str], correct_answer: str) -> dict[str, Any]:
        """MCQ: plausibility and separation of wrong options."""
        issues: list[str] = []
        if not options or not isinstance(options, list):
            return {"distractor_score": 0.0, "issues": ["No options list for MCQ distractor analysis."]}

        ca = str(correct_answer or "").strip()
        wrong = [str(o).strip() for o in options if str(o).strip() != ca]
        if len(options) < 4:
            issues.append("MCQ typically has 4 options for balanced distractors.")
            score = 60.0
        else:
            score = 100.0

        if not wrong:
            return {"distractor_score": 0.0, "issues": ["No distractors (wrong options) found."]}

        # Pairwise similarity among wrong answers
        sims: list[float] = []
        for i, a in enumerate(wrong):
            for b in wrong[i + 1 :]:
                sims.append(SequenceMatcher(None, a.lower(), b.lower()).ratio())
        if sims:
            avg_sim = statistics.mean(sims)
            if avg_sim > 0.85:
                issues.append("Distractors are very similar to each other (may confuse or feel duplicate).")
                score -= 20.0
            elif avg_sim < 0.15 and all(len(x) > 3 for x in wrong):
                issues.append("Distractors are very different in style; check plausibility.")

        # Obviously wrong: very short nonsense
        for w in wrong:
            if len(w) <= 1:
                issues.append(f"Distractor {w!r} looks trivially invalid.")
                score -= 15.0

        # Plausibility heuristic: length within range of correct
        if ca:
            clen = len(ca)
            for w in wrong:
                if clen > 0 and len(w) < clen * 0.2 and len(w) < 4:
                    issues.append(f"Distractor {w!r} may be obviously wrong vs correct answer length.")
                    score -= 8.0

        score = max(0.0, min(100.0, score))
        return {"distractor_score": round(score, 2), "issues": issues}

    def assess_explanation_quality(self, explanation: str) -> dict[str, Any]:
        """Score pedagogical value of explanation text."""
        issues: list[str] = []
        text = (explanation or "").strip()
        min_len = int(self.quality_thresholds["explanation_min_len"])
        if len(text) < min_len:
            return {
                "explanation_score": max(0.0, len(text) / min_len * 40.0),
                "issues": [f"Explanation too short ({len(text)} chars); aim for {min_len}+."],
            }

        score = 100.0
        generic_phrases = [
            r"\b(because it is correct|this is the right answer|the answer is [ab]|obviously)\b",
            r"\b(as you know|clearly|everyone knows)\b",
        ]
        for pat in generic_phrases:
            if re.search(pat, text, re.I):
                issues.append("Explanation sounds generic or hand-wavy.")
                score -= 20.0
                break

        if not re.search(r"\b(because|since|therefore|thus|means|refers|defines)\b", text, re.I):
            issues.append("Explanation could use more reasoning connectors (because, therefore, …).")
            score -= 10.0

        concept_like = len(re.findall(r"\b[a-z]{4,}\b", text.lower()))
        if concept_like < 5:
            issues.append("Explanation may not reference enough concepts/terms.")
            score -= 12.0

        score = max(0.0, min(100.0, score))
        return {"explanation_score": round(score, 2), "issues": issues}

    def assess_difficulty_appropriateness(
        self,
        question_dict: dict,
        claimed_difficulty: str,
    ) -> dict[str, Any]:
        """Heuristic prediction of difficulty vs claimed label."""
        q = str(question_dict.get("question", ""))
        text = f"{q} {question_dict.get('explanation', '')}"
        words = re.findall(r"[A-Za-z]+", text)
        avg_word_len = statistics.mean(len(w) for w in words) if words else 0.0

        technical = len(
            re.findall(
                r"\b(algorithm|recursion|polymorphism|derivative|integral|vector|matrix|async)\b",
                text,
                re.I,
            )
        )
        sentences = max(1, len(re.split(r"[.!?]+", q)))
        long_words = sum(1 for w in words if len(w) >= 9)

        complexity_score = min(
            100.0,
            avg_word_len * 8 + technical * 12 + long_words * 3 + sentences * 2,
        )

        if complexity_score < 25:
            predicted = "easy"
        elif complexity_score < 55:
            predicted = "medium"
        else:
            predicted = "hard"

        claimed = str(claimed_difficulty or question_dict.get("difficulty", "medium")).strip().lower()
        if claimed not in ("easy", "medium", "hard"):
            claimed = "medium"

        order = {"easy": 0, "medium": 1, "hard": 2}
        delta = abs(order.get(predicted, 1) - order.get(claimed, 1))
        confidence = max(0.0, 1.0 - 0.35 * delta - (0.02 * abs(complexity_score - 50)))

        matches = predicted == claimed
        return {
            "matches": matches,
            "predicted_difficulty": predicted,
            "confidence": round(confidence, 3),
        }

    def calculate_overall_quality(self, question_dict: dict) -> dict[str, Any]:
        """Run all checks and combine weighted scores into a report."""
        qtext = str(question_dict.get("question", ""))
        opts = question_dict.get("options")
        if not isinstance(opts, list):
            opts = None
        ca = str(question_dict.get("correct_answer", ""))
        expl = str(question_dict.get("explanation", ""))
        claimed = str(question_dict.get("difficulty", "medium"))

        clarity = self.assess_question_clarity(qtext)
        answer = self.assess_answer_quality(ca, opts)
        explanation = self.assess_explanation_quality(expl)
        difficulty = self.assess_difficulty_appropriateness(question_dict, claimed)

        is_mcq = self._is_mcq(question_dict) and opts and len(opts) >= 2
        if is_mcq:
            distractors = self.assess_distractor_quality(opts, ca)
            d_score = distractors["distractor_score"]
            overall = (
                0.25 * clarity["clarity_score"]
                + 0.25 * answer["answer_quality"]
                + 0.20 * d_score
                + 0.20 * explanation["explanation_score"]
                + 0.10 * (100.0 if difficulty["matches"] else 60.0)
            )
        else:
            distractors = {"distractor_score": None, "issues": ["Skipped (not MCQ)."]}
            overall = (
                0.30 * clarity["clarity_score"]
                + 0.30 * answer["answer_quality"]
                + 0.25 * explanation["explanation_score"]
                + 0.15 * (100.0 if difficulty["matches"] else 60.0)
            )

        all_issues: list[str] = (
            clarity["issues"]
            + answer["issues"]
            + explanation["issues"]
            + distractors.get("issues", [])
        )
        if not difficulty["matches"]:
            all_issues.append(
                f"Claimed difficulty '{claimed}' vs predicted '{difficulty['predicted_difficulty']}'."
            )

        suggestions = list(dict.fromkeys(all_issues))[:15]
        overall = round(max(0.0, min(100.0, overall)), 2)

        return {
            "overall_quality_score": overall,
            "weights_note": "MCQ: clarity 25%, answer 25%, distractors 20%, explanation 20%, difficulty 10%. "
            "Non-MCQ: clarity 30%, answer 30%, explanation 25%, difficulty 15%.",
            "components": {
                "clarity": clarity,
                "answer": answer,
                "distractors": distractors,
                "explanation": explanation,
                "difficulty": difficulty,
            },
            "improvement_suggestions": suggestions,
            "bloom_level": calculate_bloom_taxonomy_level(qtext),
        }

    def validate_against_source(self, question_dict: dict, source_text: str) -> dict[str, Any]:
        """Heuristic grounding: overlap of answer and question with source text."""
        issues: list[str] = []
        source = (source_text or "").lower()
        if not source.strip():
            return {
                "source_based": False,
                "confidence": 0.0,
                "issues": ["Source text is empty."],
            }

        q = str(question_dict.get("question", "")).lower()
        ca = str(question_dict.get("correct_answer", "")).lower()

        def _tokens(s: str) -> set[str]:
            return {t for t in re.findall(r"[a-z0-9]{3,}", s) if len(t) >= 3}

        src_t = _tokens(source)
        q_t = _tokens(q)
        overlap_q = len(q_t & src_t) / max(1, len(q_t))

        answer_in_source = ca in source or any(
            fragment in source for fragment in re.split(r"[\s,;/]+", ca) if len(fragment) >= 4
        )

        if not answer_in_source:
            issues.append("Correct answer (or its key tokens) not clearly found in source.")
        if overlap_q < 0.15 and len(q_t) > 3:
            issues.append("Question stem shares few terms with source (may be off-topic).")

        confidence = 0.4 * min(1.0, overlap_q * 3) + 0.6 * (1.0 if answer_in_source else 0.25)
        source_based = answer_in_source and overlap_q >= 0.1

        return {
            "source_based": source_based,
            "confidence": round(max(0.0, min(1.0, confidence)), 3),
            "issues": issues,
        }

    def batch_quality_assessment(self, questions: list[dict]) -> dict[str, Any]:
        """Aggregate quality metrics and identify weak items."""
        reports: list[dict[str, Any]] = []
        scores: list[float] = []
        all_issues: list[str] = []

        for q in questions or []:
            rep = self.calculate_overall_quality(q)
            reports.append(rep)
            scores.append(rep["overall_quality_score"])
            all_issues.extend(rep.get("improvement_suggestions", []))

        issue_counts = Counter(all_issues)
        common_issues = [issue for issue, _ in issue_counts.most_common(10)]

        distribution = {"0-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
        for s in scores:
            if s < 40:
                distribution["0-40"] += 1
            elif s < 60:
                distribution["40-60"] += 1
            elif s < 80:
                distribution["60-80"] += 1
            else:
                distribution["80-100"] += 1

        lowest = sorted(
            enumerate(scores),
            key=lambda x: x[1],
        )[: max(1, min(5, len(scores)))]
        lowest_quality = [
            {"index": i, "overall_quality_score": scores[i]} for i, _ in lowest
        ]

        avg = statistics.mean(scores) if scores else 0.0
        stdev = statistics.stdev(scores) if len(scores) > 1 else 0.0

        return {
            "count": len(questions or []),
            "average_quality_score": round(avg, 2),
            "stdev_quality_score": round(stdev, 4),
            "quality_distribution": distribution,
            "common_issues": common_issues,
            "lowest_quality_questions": lowest_quality,
            "per_question_reports": reports,
            "pattern_analysis": detect_question_patterns(questions or []),
        }


def _demo() -> None:
    import json

    v = QuestionQualityValidator()

    high_q = {
        "type": "MCQ",
        "question": (
            "In Python, which keyword begins a loop that continues while a condition remains true, "
            "and is often used when the number of iterations is not known in advance?"
        ),
        "options": [
            "for",
            "while",
            "def",
            "import",
        ],
        "correct_answer": "while",
        "explanation": (
            "The `while` keyword starts a while-loop: the block runs repeatedly as long as the "
            "condition is true, therefore it suits unknown iteration counts; `for` iterates over sequences "
            "because it walks items in order."
        ),
        "difficulty": "hard",
    }

    low_q = {
        "type": "MCQ",
        "question": "What is X?",
        "options": ["a", "b", "yes", "no"],
        "correct_answer": "a",
        "explanation": "Because it is correct.",
        "difficulty": "hard",
    }

    source = (
        "Python while loops use the while keyword. The loop body runs while the condition is true. "
        "For loops use for and iterate over sequences."
    )

    print("=" * 60)
    print("High-quality question - overall report")
    print("=" * 60)
    r1 = v.calculate_overall_quality(high_q)
    print(json.dumps({k: r1[k] for k in ("overall_quality_score", "bloom_level", "improvement_suggestions")}, indent=2))
    g1 = v.validate_against_source(high_q, source)
    print("validate_against_source:", json.dumps(g1, indent=2))

    print("\n" + "=" * 60)
    print("Low-quality question - overall report")
    print("=" * 60)
    r2 = v.calculate_overall_quality(low_q)
    print(json.dumps({k: r2[k] for k in ("overall_quality_score", "bloom_level", "improvement_suggestions")}, indent=2))

    print("\n" + "=" * 60)
    print("Batch assessment")
    print("=" * 60)
    batch = [high_q, low_q, {**high_q, "question": high_q["question"] + " (duplicate stem test)"}]
    br = v.batch_quality_assessment(batch)
    print("average_quality_score:", br["average_quality_score"])
    print("quality_distribution:", br["quality_distribution"])
    print("common_issues (sample):", br["common_issues"][:5])
    print("lowest_quality_questions:", br["lowest_quality_questions"])
    print("pattern_analysis keys:", list(br["pattern_analysis"].keys()))


if __name__ == "__main__":
    _demo()
