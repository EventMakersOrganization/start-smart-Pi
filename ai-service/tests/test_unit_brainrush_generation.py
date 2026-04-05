"""Unit tests for BrainRush generation helpers (fast; no Ollama)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from generation.brainrush_errors import BrainRushGroundingError
from generation.brainrush_question_generator import (
    BRAINRUSH_ALLOWED_COUNTS,
    MIN_BRAINRUSH_CONTEXT_CHARS,
    _fetch_brainrush_context,
    _passes_grounding_gate,
    _topic_course_specs_from_modules,
    brainrush_session_question_ok,
    distribute_difficulties,
    normalize_stem_for_dedup,
    stem_too_similar,
    validate_brainrush_game_rules,
)
from generation.brainrush_question_generator import BrainRushQuestionGenerator


def test_distribute_difficulties_adaptive_counts() -> None:
    for n in (10, 15, 20):
        d = distribute_difficulties(n, "adaptive")
        assert len(d) == n
        assert all(x in ("easy", "medium", "hard") for x in d)


def test_distribute_difficulties_fixed() -> None:
    assert distribute_difficulties(10, "easy") == ["easy"] * 10
    assert distribute_difficulties(15, "hard") == ["hard"] * 15


def test_validate_brainrush_mcq_rules() -> None:
    ok = {
        "question": "Quel mot clé définit une boucle?",
        "options": ["for", "class", "def", "import"],
        "correct_answer": "for",
    }
    assert validate_brainrush_game_rules(ok, question_type="MCQ") is True

    long_q = {**ok, "question": "x" * 250}
    assert validate_brainrush_game_rules(long_q, question_type="MCQ") is False

    bad_opts = {**ok, "options": ["a", "b", "c"]}
    assert validate_brainrush_game_rules(bad_opts, question_type="MCQ") is False


def test_brainrush_allowed_counts() -> None:
    assert BRAINRUSH_ALLOWED_COUNTS == frozenset({10, 15, 20})


def test_brainrush_session_question_ok_mcq_and_letter_answer() -> None:
    q = {
        "type": "MCQ",
        "question": "Quel mot clé définit une boucle en Python?",
        "options": ["for", "class", "def", "import"],
        "correct_answer": "for",
    }
    assert brainrush_session_question_ok(q) is True
    q2 = {**q, "correct_answer": "A"}
    assert brainrush_session_question_ok(q2) is True


def test_brainrush_session_question_ok_rejects_short_or_duplicate() -> None:
    assert brainrush_session_question_ok({"type": "MCQ", "question": "short", "options": ["a", "b"], "correct_answer": "a"}) is False
    assert (
        brainrush_session_question_ok(
            {
                "type": "MCQ",
                "question": "Enough length here for stem",
                "options": ["x", "x", "y", "z"],
                "correct_answer": "x",
            }
        )
        is False
    )


def test_topic_specs_cover_all_courses() -> None:
    modules = [
        {"course_id": "c1", "title": "t1a"},
        {"course_id": "c1", "title": "t1b"},
        {"course_id": "c2", "title": "t2a"},
        {"course_id": "c3", "title": "t3a"},
    ]
    specs = _topic_course_specs_from_modules(modules, 9, seed="roundrobin_test_seed")
    assert len(specs) == 9
    assert len({s["course_id"] for s in specs}) == 3


def test_topic_specs_six_questions_use_three_courses() -> None:
    modules = [
        {"course_id": "c1", "title": "t1a"},
        {"course_id": "c2", "title": "t2a"},
        {"course_id": "c3", "title": "t3a"},
    ]
    specs = _topic_course_specs_from_modules(modules, 6, seed="cov_seed")
    assert len(specs) == 6
    assert len({s["course_id"] for s in specs}) == 3


def test_topic_specs_buckets_by_course_id_not_duplicate_titles() -> None:
    """Same chapter_title on different Mongo docs must not collapse into one bucket."""
    modules = [
        {"course_id": "c1", "title": "1.1 A", "chapter_title": "Duplicate title bug"},
        {"course_id": "c2", "title": "2.1 B", "chapter_title": "Duplicate title bug"},
        {"course_id": "c3", "title": "3.1 C", "chapter_title": "Duplicate title bug"},
    ]
    specs = _topic_course_specs_from_modules(modules, 6, seed="cid_buckets")
    assert len({s["course_id"] for s in specs}) == 3


def test_topic_specs_round_robin_distinct_chapter_titles() -> None:
    """One course_id: all modules share one bucket; topics still deduped."""
    modules = [
        {"course_id": "same", "title": "5.1 A", "chapter_title": "Chapitre 1 - Intro"},
        {"course_id": "same", "title": "5.2 B", "chapter_title": "Chapitre 1 - Intro"},
        {"course_id": "same", "title": "3.1 C", "chapter_title": "Chapitre 2 - Types"},
        {"course_id": "same", "title": "3.2 D", "chapter_title": "Chapitre 2 - Types"},
    ]
    specs = _topic_course_specs_from_modules(modules, 8, seed="chapters_rr")
    assert len(specs) == 8
    assert len({s["topic"] for s in specs}) == 4


def test_validate_brainrush_rejects_syllabus_mcq_stem() -> None:
    q = {
        "question": "Parmi les propositions suivantes, laquelle illustre le mieux le thème « 5.1 » ?",
        "options": ["a", "b", "c", "d"],
        "correct_answer": "a",
    }
    assert validate_brainrush_game_rules(q, question_type="MCQ") is False


def test_validate_brainrush_rejects_choix_placeholder_options() -> None:
    q = {
        "question": "Quelle syntaxe pour une chaîne?",
        "options": ["Choix A", "Choix B", "Choix C", "Choix D"],
        "correct_answer": "Choix A",
    }
    assert validate_brainrush_game_rules(q, question_type="MCQ") is False


def test_normalize_stem_and_similarity() -> None:
    a = normalize_stem_for_dedup("  Hello, World!  ")
    b = normalize_stem_for_dedup("hello world")
    assert stem_too_similar(a, b)


def test_validate_brainrush_true_false_vf() -> None:
    q = {
        "question": "En langage C, le type int fait toujours exactement 32 bits sur toute plateforme.",
        "options": ["Vrai", "Faux"],
        "correct_answer": "Faux",
    }
    assert validate_brainrush_game_rules(q, question_type="TrueFalse") is True


def test_validate_true_false_rejects_syllabus_meta() -> None:
    q = {
        "question": "Le thème « 5.3 - Fonctions » est abordé dans le cours « Programmation ».",
        "options": ["Vrai", "Faux"],
        "correct_answer": "Vrai",
    }
    assert validate_brainrush_game_rules(q, question_type="TrueFalse") is False


def test_validate_brainrush_dragdrop_rejects_placeholders() -> None:
    bad = {
        "question": "Associez les éléments.",
        "items": ["Item 1", "Item 2", "Item 3"],
        "matches": ["Match A", "Match B", "Match C"],
        "correct_pairs": {"Item 1": "Match A", "Item 2": "Match B", "Item 3": "Match C"},
    }
    assert validate_brainrush_game_rules(bad, question_type="DragDrop") is False


def test_brainrush_session_question_ok_true_false() -> None:
    q = {
        "type": "TrueFalse",
        "question": "Une chaîne C se termine par un caractère nul.",
        "options": ["Vrai", "Faux"],
        "correct_answer": "Vrai",
    }
    assert brainrush_session_question_ok(q) is True


def test_passes_grounding_gate_requires_valid_and_confidence() -> None:
    assert _passes_grounding_gate({"is_valid": True, "confidence": 0.75}) is True
    assert _passes_grounding_gate({"is_valid": True, "confidence": 0.55}) is True
    assert _passes_grounding_gate({"is_valid": True, "confidence": 0.50}) is False
    assert _passes_grounding_gate({"is_valid": False, "confidence": 0.60}) is True


@patch("generation.brainrush_question_generator._fetch_brainrush_context")
def test_generate_mcq_raises_when_confidence_below_threshold(mock_fetch: object) -> None:
    long_ctx = "x" * (MIN_BRAINRUSH_CONTEXT_CHARS + 40)
    mock_fetch.return_value = long_ctx
    json_line = (
        '{"question":"Quel mot?","options":["a","b","c","d"],'
        '"correct_answer":"a","explanation":"Car le texte x mentionne a."}'
    )
    gen = BrainRushQuestionGenerator()
    with (
        patch.object(gen.hallucination_guard, "verify_question_validity", return_value={"is_valid": True, "confidence": 0.5, "issues": []}),
        patch("generation.brainrush_question_generator._call_brainrush_llm", return_value=json_line),
        patch("generation.brainrush_question_generator.brainrush_mcq_passes_level_test", return_value=True),
    ):
        with pytest.raises(BrainRushGroundingError):
            gen.generate_mcq("Prog", "easy", "loops", use_gamified=True)


@patch("generation.brainrush_question_generator._fetch_brainrush_context")
def test_generate_mcq_raises_on_short_context(mock_fetch: object) -> None:
    mock_fetch.return_value = "short"
    gen = BrainRushQuestionGenerator()
    with pytest.raises(BrainRushGroundingError):
        gen.generate_mcq("Prog", "easy", "loops", use_gamified=True)


def test_fetch_brainrush_context_uses_best_length() -> None:
    rag = MagicMock()
    rag.get_context_for_query.side_effect = lambda q, max_chunks: "y" * 400 if max_chunks >= 8 else "ab"
    out = _fetch_brainrush_context(rag, "S", "T", None)
    assert len(out) >= MIN_BRAINRUSH_CONTEXT_CHARS
