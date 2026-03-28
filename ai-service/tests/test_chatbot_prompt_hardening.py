from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import api


def test_intent_classification_modes():
    assert api._classify_user_intent("Explain pointers in C") == "explanation"
    assert api._classify_user_intent("Give me an example of while loop") == "example"
    assert api._classify_user_intent("Quiz me on arrays") == "quiz"
    assert api._classify_user_intent("Debug this segmentation fault") == "debugging"


def test_tutor_response_mode_full_vs_targeted():
    assert api._tutor_response_mode("c'est quoi les structures") == "full"
    assert api._tutor_response_mode("donner un exemple de code") == "targeted"
    assert api._tutor_response_mode("Explique et donne un exemple") == "full"


def test_normalizer_targeted_does_not_force_emoji_sections():
    raw = "```c\nstruct S { int x; };\n```\nCourt exemple."
    out = api._normalize_tutor_markdown(raw, "fr", response_mode="targeted")
    assert "📘" not in out


def test_tutor_prompt_has_system_context_user_separation():
    """New single-call prompt must have clean SYSTEM | CONTEXT | USER blocks."""
    p = api._build_tutor_prompt(
        question="Explain for vs while",
        context="for loops iterate. while loops check conditions.",
        lang="en",
        response_mode="full",
    )
    assert "CORE BEHAVIOR" in p
    assert "CONTEXT" in p
    assert "USER MESSAGE" in p
    assert "[chunk1]" not in p

    user_block = p.split("USER MESSAGE:")[-1].strip()
    assert "Explain for vs while" in user_block
    assert "OUTPUT FORMAT" in user_block


def test_tutor_prompt_includes_conversation_block():
    p = api._build_tutor_prompt(
        question="Now how do I use them in a function?",
        context="course text",
        lang="en",
        conversation_block="Student: What are pointers?\n\nTutor: Pointers store addresses.",
    )
    assert "CONVERSATION" in p
    assert "Pointers store addresses" in p
    assert "how do I use them" in p


def test_retrieval_merges_followup_with_previous_user_message():
    q = "maintenant comment les utiliser dans une fonction?"
    hist = [{"role": "user", "content": "comment utiliser les pointeurs en C?"}]
    rq = api._retrieval_query_for_chat(q, hist)
    assert "pointeur" in rq.lower()
    assert "fonction" in rq.lower()


def test_trim_history_drops_duplicate_current_turn():
    cur = "same question"
    h = [{"role": "user", "content": "first"}, {"role": "assistant", "content": "ok"}, {"role": "user", "content": cur}]
    t = api._trim_history_exclude_current_turn(h, cur)
    assert len(t) == 2
    assert t[-1].get("content") == "ok"


def test_tutor_prompt_french():
    p = api._build_tutor_prompt(
        question="Explique les pointeurs",
        context="Un pointeur stocke une adresse.",
        lang="fr",
        response_mode="full",
    )
    user_block = p.split("USER MESSAGE:")[-1].strip()
    assert "Explique les pointeurs" in user_block
    assert "FORMAT DE SORTIE" in user_block
    assert "COMPORTEMENT PRINCIPAL" in p
    assert "CONTEXT" in p


def test_tutor_prompt_never_copies_context_instruction():
    """System prompt contains clear DO NOT COPY rules."""
    p = api._build_tutor_prompt(
        question="Q", context="raw course text", lang="en",
    )
    assert "DO NOT copy" in p or "NEVER copy" in p
    assert "reformulate" in p.lower() or "rewrite" in p.lower()


def test_direct_prompt_no_context_block():
    """Direct prompt has no CONTEXT block since there are no chunks."""
    p = api._build_direct_tutor_prompt("Explain arrays")
    assert "USER MESSAGE" in p
    assert "CORE BEHAVIOR" in p


def test_few_shot_examples_exist():
    assert "for" in api._TUTOR_FEW_SHOT_FR.lower()
    assert "while" in api._TUTOR_FEW_SHOT_FR.lower()
    assert "for" in api._TUTOR_FEW_SHOT_EN.lower()
    assert "while" in api._TUTOR_FEW_SHOT_EN.lower()


def test_select_diverse_chunks_limits_and_avoids_duplicates():
    chunks = [
        {"chunk_text": "for loop repeats with init condition increment", "similarity": 0.9, "metadata": {"course_title": "C", "module_name": "loops"}, "course_id": "1"},
        {"chunk_text": "for loop repeats with init condition increment", "similarity": 0.89, "metadata": {"course_title": "C", "module_name": "loops"}, "course_id": "1"},
        {"chunk_text": "while loop repeats while condition is true", "similarity": 0.88, "metadata": {"course_title": "C", "module_name": "loops2"}, "course_id": "1"},
        {"chunk_text": "difference between for and while examples", "similarity": 0.87, "metadata": {"course_title": "C", "module_name": "comparison"}, "course_id": "2"},
        {"chunk_text": "common loop mistakes infinite loop", "similarity": 0.86, "metadata": {"course_title": "C", "module_name": "mistakes"}, "course_id": "3"},
    ]
    out = api._select_diverse_chunks("explain for while loops", chunks, n_max=5)
    assert 3 <= len(out) <= 5
    texts = [c.get("chunk_text") for c in out]
    assert len(set(texts)) == len(texts)


def test_format_context_chunks_labels():
    chunks = [{"chunk_text": "alpha"}, {"chunk_text": "beta"}]
    s = api._format_context_chunks_for_prompt(chunks)
    assert "[chunk1]" in s and "[chunk2]" in s


def test_chunk_cleaning_dedup_and_trim():
    raw = [
        {"chunk_text": "Hello world. Hello world. Short."},
        {"chunk_text": "Another block about pointers and memory addresses in C programming."},
    ]
    cleaned = api._clean_chunks_for_pipeline(raw)
    assert len(cleaned) >= 1
    joined = " ".join((c.get("chunk_text") or "") for c in cleaned)
    assert "Another block" in joined
    assert joined.count("Hello world") <= 1


def test_quality_gate_detects_template_and_copy():
    template_answer = "Reponse directe: X\nExplication pas a pas:\n- a\n- b"
    assert api._is_low_quality_answer(template_answer, "explique pas a pas", "X Y Z") is True

    good = (
        "📘 Concept:\n- A loop repeats instructions.\n\n"
        "🧠 Explanation:\n- Use for when count is known.\n- Use while for condition-driven repetition.\n"
        "- Use while when you must check a condition before each iteration.\n\n"
        "✅ Example:\n- for(i=0;i<3;i++) printf(\"%d\",i);\n\n"
        "🎯 Mini exercise:\n- Rewrite with while?"
    )
    assert api._is_low_quality_answer(good, "explain loops", "unrelated context text") is False


def test_anti_copy_guard_triggers_on_high_similarity():
    src = "x " * 200
    ans = "x " * 200
    assert api._anti_copy_violation(ans, src, "- unrelated summary bullet") is True


def test_failsafe_ellipsis_triggers_placeholder_detection():
    assert api._has_placeholder_ellipsis("📘 Concept:\n...\n\n🧠 Explanation:\nok " * 20) is True


def test_sections_complete_requires_all_four():
    incomplete = (
        "📘 Concept:\n- A loop repeats instructions with enough text here.\n\n"
        "🧠 Explanation:\n- More than twenty chars of body.\n\n"
        "✅ Example:\n- code\n"
    )
    assert api._sections_complete(incomplete) is False
    complete = (
        "📘 Concept:\n- A loop repeats instructions with enough text here.\n\n"
        "🧠 Explanation:\n- More than twenty chars of body here for sure.\n\n"
        "✅ Example:\n- for(;;) { break; }\n\n"
        "🎯 Mini exercise:\n- Name one reason to use a for loop."
    )
    assert api._sections_complete(complete) is True


def test_instruction_leakage_detection():
    assert api._has_instruction_leakage("Explain this concept in detail.") is True
    assert api._has_instruction_leakage("Write an example of a for loop.") is True
    assert api._has_instruction_leakage("Explique pourquoi c'est vrai.") is True
    assert api._has_instruction_leakage("📘 Concept:\n- Loops repeat code.\n\n🧠 Explanation:\n- For is for counting.") is False


def test_normalizer_adds_missing_sections_without_ellipsis_stubs():
    raw = "A quick explanation only."
    out = api._normalize_tutor_markdown(raw, "en")
    assert "📘 Concept:" in out
    assert "🧠 Explanation:" in out
    assert "✅ Example:" in out
    assert "🎯 Mini exercise:" in out
    assert "…" not in out
    assert "- …" not in out


def test_normalizer_does_not_wrap_llm_failure_message():
    fail = api._llm_failure_plain_message("fr")
    assert api._is_llm_failure_plain_response(fail)
    out = api._normalize_tutor_markdown(fail, "fr")
    assert out == fail.strip()
    assert "🧠 Explanation:" not in out
    assert "📘 Concept:" not in out


def test_normalizer_redistributes_bloated_concept_into_sections():
    raw = (
        "📘 Concept:\n\n"
        "Premier paragraphe definissant le concept avec des champs nommes.\n\n"
        "Deuxieme paragraphe avec plus de details sur l'utilisation.\n\n"
        "Troisieme paragraphe pour illustrer un cas pratique concret.\n\n"
        "Quatrieme paragraphe qui invite a la reflexion sur les usages.\n\n"
        "🧠 Explanation:\n\n"
        "✅ Example:\n\n"
        "🎯 Mini exercise:\n\n"
    )
    out = api._normalize_tutor_markdown(raw, "fr")
    expl = api._tutor_extract_section_body(out, "🧠 Explanation:", "✅ Example:")
    assert len(expl.strip()) >= 15
    ex = api._tutor_extract_section_body(out, "✅ Example:", "🎯 Mini exercise:")
    assert len(ex.strip()) >= 10


def test_normalizer_preserves_trailing_verify_note_after_redistribute():
    raw = (
        "📘 Concept:\n\n"
        "Para one.\n\nPara two.\n\nPara three.\n\nPara four.\n\n"
        "🧠 Explanation:\n\n✅ Example:\n\n🎯 Mini exercise:\n\n"
        "[Note: Please verify with instructor.]"
    )
    out = api._normalize_tutor_markdown(raw, "en")
    assert "[Note:" in out


def test_cache_schema_version_bumped():
    assert api.CACHE_SCHEMA_VERSION == "chat_v21_adaptive_tutor_format"


def test_augment_retrieval_includes_prior_assistant_snippet():
    hist = [
        {"role": "user", "content": "c'est quoi malloc"},
        {"role": "assistant", "content": "📘 Concept:\nMalloc reserve la memoire. Exemple malloc(sizeof(int))."},
    ]
    out = api._augment_retrieval_query_from_history("comment liberer", hist)
    assert "malloc" in out.lower() or "memoire" in out.lower()


def test_lexical_rerank_prefers_overlapping_chunk():
    align = "pointeur adresse memoire dereferencement"
    chunks = [
        {"chunk_text": "les boucles for repetent le code", "metadata": {"module_name": "boucles"}, "similarity": 0.7},
        {"chunk_text": "un pointeur stocke ladresse memoire", "metadata": {"module_name": "pointeurs"}, "similarity": 0.68},
    ]
    ranked = api._rerank_chunks_by_lexical_alignment(chunks, align)
    assert "pointeur" in (ranked[0].get("chunk_text") or "").lower()


def test_lexical_rerank_prefers_narrower_module_title_for_short_query():
    """Same similarity: chapter whose title adds fewer extra words vs. the query should rank first."""
    align = "structures"
    chunks = [
        {
            "chunk_text": "for while loops repeat",
            "metadata": {"module_name": "Chapitre 3 Les structures iteratives", "course_title": "C"},
            "similarity": 0.72,
        },
        {
            "chunk_text": "struct champs enregistrement",
            "metadata": {"module_name": "Chapitre 6 Les structures", "course_title": "C"},
            "similarity": 0.72,
        },
        {
            "chunk_text": "if else switch cases",
            "metadata": {"module_name": "Chapitre 2 Les structures conditionnelles", "course_title": "C"},
            "similarity": 0.72,
        },
    ]
    ranked = api._rerank_chunks_by_lexical_alignment(chunks, align)
    assert "Chapitre 6" in (ranked[0].get("metadata") or {}).get("module_name", "")


def test_lexical_rerank_short_query_prefers_body_over_module_title():
    """Single-term queries must still rerank; body match should beat higher sim + title-only match."""
    align = "memory"
    chunks = [
        {
            "chunk_text": "for loops repeat instructions",
            "metadata": {"module_name": "Memory and pointers overview"},
            "similarity": 0.76,
        },
        {
            "chunk_text": "heap memory malloc free",
            "metadata": {"module_name": "Control structures"},
            "similarity": 0.70,
        },
    ]
    ranked = api._rerank_chunks_by_lexical_alignment(chunks, align)
    assert "heap" in (ranked[0].get("chunk_text") or "").lower()


def test_retrieval_merge_not_blocked_by_tableau_keyword():
    q = "comment les mettre dans un tableau"
    hist = [{"role": "user", "content": "c'est quoi les structures"}]
    assert api._should_merge_retrieval_with_previous(q) is True


def test_tutor_chunks_dedup_identical_text():
    """Same chunk text must not appear twice after selection."""
    chunks = [
        {"chunk_text": "strings in C char arrays", "similarity": 0.95},
        {"chunk_text": "strings in C char arrays", "similarity": 0.94},
        {"chunk_text": "pointers store addresses", "similarity": 0.5},
    ]
    out = api._select_tutor_chunks("strings in C", chunks, n_max=5)
    texts = [c.get("chunk_text") for c in out]
    assert len(texts) == len(set(texts))
    assert sum(1 for t in texts if t == "strings in C char arrays") <= 1


def test_tutor_chunks_groups_same_course_after_top():
    """Chunks from the same course as the #1 hit should appear before other courses."""
    chunks = [
        {"chunk_text": "first same course", "course_id": "c1", "metadata": {}},
        {"chunk_text": "other course", "course_id": "c2", "metadata": {}},
        {"chunk_text": "second same course", "course_id": "c1", "metadata": {}},
    ]
    out = api._select_tutor_chunks("q", chunks, n_max=5)
    assert [c["chunk_text"] for c in out] == ["first same course", "second same course", "other course"]


def test_sources_display_only_primary_course():
    """API sources list should match [Source 1] course, not auxiliary retrieved chapters."""
    chunks = [
        {"chunk_text": "a", "course_id": "ch6", "metadata": {"course_title": "Prog", "module_name": "Chapitre 6"}},
        {"chunk_text": "b", "course_id": "ch6", "metadata": {"course_title": "Prog", "module_name": "Chapitre 6"}},
        {"chunk_text": "c", "course_id": "ch3", "metadata": {"course_title": "Prog", "module_name": "Chapitre 3"}},
    ]
    disp = api._chunks_for_sources_display(chunks)
    assert len(disp) == 2
    assert all(c.get("course_id") == "ch6" for c in disp)


def test_minimal_title_surplus_filter_drops_wider_titles_when_two_narrow_exist():
    """Short query: keep only chunks with minimal extra title tokens vs. query."""
    align = "structures"
    chunks = [
        {"chunk_text": "t1", "metadata": {"module_name": "Les structures", "course_title": "C1"}, "similarity": 0.7},
        {"chunk_text": "t2", "metadata": {"module_name": "Chapitre 6 Les structures", "course_title": "C1"}, "similarity": 0.7},
        {
            "chunk_text": "t3",
            "metadata": {"module_name": "Chapitre 3 Les structures iteratives", "course_title": "C1"},
            "similarity": 0.7,
        },
    ]
    out = api._filter_chunks_by_minimal_title_surplus(chunks, align)
    texts = {c["chunk_text"] for c in out}
    assert "t3" not in texts
    assert "t1" in texts and "t2" in texts


def test_minimal_title_surplus_filter_noop_when_query_long():
    align = "pointer memory address malloc dereference"
    chunks = [
        {"chunk_text": "a", "metadata": {"module_name": "Chapitre 3 Les structures iteratives"}, "similarity": 0.7},
        {"chunk_text": "b", "metadata": {"module_name": "Les structures"}, "similarity": 0.7},
    ]
    out = api._filter_chunks_by_minimal_title_surplus(chunks, align)
    assert len(out) == 2


def test_labeled_course_context_includes_source_headers():
    chunks = [
        {
            "chunk_text": "body a",
            "metadata": {"course_title": "T1", "module_name": "M1"},
        }
    ]
    s = api._format_labeled_course_context(chunks)
    assert "[Source 1]" in s and "T1" in s and "M1" in s and "body a" in s
