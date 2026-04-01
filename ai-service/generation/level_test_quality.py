"""
Structural + alignment validation helpers for level-test MCQs.

Most quality guidance lives in prompt_templates. This module:
- enforces a few universal anti-patterns (catch-all options)
- blocks ordinal "Nth step" questions except for workflow-style chapters where it would cause endless retries
- enforces topic-slot alignment + French/English consistency when context is French
"""
from __future__ import annotations

import re
import unicodedata
from typing import Any


def _strip_accents(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def _looks_french(text: str) -> bool:
    if not isinstance(text, str) or not text.strip():
        return False
    if re.search(r"[éèêëàâùûôîïç]", text):
        return True
    t = _strip_accents(text).lower()
    return (
        sum(
            1
            for w in (
                " le ",
                " la ",
                " les ",
                " des ",
                " une ",
                " un ",
                " est ",
                " sont ",
                " pour ",
            )
            if w in f" {t} "
        )
        >= 2
    )


def _question_is_english(question: str) -> bool:
    if not isinstance(question, str):
        return False
    q = question.strip()
    return bool(re.match(r"^(What|Which|How|When|Where|Why)\b", q, re.IGNORECASE))


def _slot_topic_is_workflow_etapes_chapter(slot_topic: str) -> bool:
    t = _strip_accents((slot_topic or "").lower())
    if "etape" not in t and "etapes" not in t:
        return False
    return any(
        x in t
        for x in (
            "code",
            "source",
            "executable",
            "demarche",
            "passer",
            "compil",
            "lien",
            "programme",
        )
    )


_ORDINAL_STEP_QUESTION = re.compile(
    r"\b("
    r"premier|premiere|deuxieme|troisieme|quatrieme|cinquieme|"
    r"1er|1re|2e|3e|4e|5e|"
    r"first|second|third|fourth|fifth|"
    r"1st|2nd|3rd|4th|5th"
    r")\s+(etape|etapes|pas|step|steps)\b",
    re.IGNORECASE,
)


_TOPIC_STOPWORDS = frozenset(
    {
        "the",
        "and",
        "not",
        "are",
        "but",
        "with",
        "that",
        "this",
        "from",
        "into",
        "your",
        "has",
        "have",
        "was",
        "were",
        "one",
        "two",
        "out",
        "all",
        "any",
        "its",
        "le",
        "la",
        "les",
        "des",
        "une",
        "un",
        "pour",
        "dans",
        "avec",
        "est",
        "son",
        "ses",
        "que",
        "qui",
        "aux",
        "plus",
        "par",
        "sur",
        "sans",
        "sous",
        "pas",
        "tout",
        "tous",
    }
)


def _topic_keywords_from_slot(slot_topic: str) -> list[str]:
    t = re.sub(r"^\s*[\d.]+\s*[-–—]\s*", "", (slot_topic or "").strip())
    t = re.sub(r"\([^)]*\)", " ", t)
    t = t.replace("&", " ").replace("/", " ")
    norm = _strip_accents(t).lower()
    words = re.findall(r"[a-zA-Zàâäéèêëïîôùûç]{2,}", norm)
    allow_short = frozenset({"if", "do", "or", "si"})
    out: list[str] = []
    seen: set[str] = set()
    for w in words:
        if w in _TOPIC_STOPWORDS:
            continue
        if len(w) == 2 and w not in allow_short:
            continue
        if w not in seen:
            seen.add(w)
            out.append(w)
    filtered = [w for w in out if w not in ("etape", "etapes")]
    if len(filtered) >= 2:
        out = filtered
    return out[:20]


def _topic_kw_matches_blob(k: str, blob: str) -> bool:
    if re.search(rf"\b{re.escape(k)}\b", blob):
        return True
    if len(k) >= 4 and k.endswith("s"):
        stem = k[:-1]
        if re.search(rf"\b{re.escape(stem)}\b", blob):
            return True
    return False


def _language_mismatch_question_slot(question: str, slot_topic: str) -> bool:
    if not question or not slot_topic:
        return False
    st = slot_topic.lower()
    topic_french = bool(re.search(r"[éèêëàâùûôîïç]", slot_topic)) or any(
        w in st
        for w in (
            "quelle",
            "définition",
            "definition",
            "chaîne",
            "chaine",
            "étape",
            "etape",
            "boucle",
            "variable",
            "portée",
            "portee",
            "fonction",
            "programme",
            "comment",
            "structure",
            "démarche",
            "demarche",
            "exécutable",
            "executable",
            "mémoire",
            "memoire",
            "tableau",
            "caractères",
            "caracteres",
        )
    )
    topic_english = bool(
        re.search(
            r"\b(the|which|what|array|definition|structure|loop|memory|purpose|size)\b",
            st,
            re.I,
        )
    )
    q = question.strip()
    if topic_french and not topic_english and re.match(
        r"^(What|Which|How|When|Where|Why)\b", q, re.I
    ):
        return True
    if topic_english and not topic_french and re.match(
        r"^(Quelle|Quel|Quels|Quoi|Comment|Pourquoi)\b", q, re.I
    ):
        return True
    return False


def topic_slot_aligned(q: dict[str, Any], slot_topic: str) -> bool:
    st = (slot_topic or "").strip()
    if not st:
        return True
    if not isinstance(q, dict):
        return False
    kws = _topic_keywords_from_slot(st)
    if len(kws) < 2:
        return True
    blob = _strip_accents(
        f"{q.get('question', '')} {' '.join(str(x) for x in (q.get('options') or []))} "
        f"{q.get('explanation', '')}"
    ).lower()
    hits = sum(1 for k in kws if _topic_kw_matches_blob(k, blob))
    need = 2 if len(kws) >= 6 else 1
    if hits < need:
        return False
    if _language_mismatch_question_slot(str(q.get("question") or ""), st):
        return False
    return True


def reject_level_test_question(
    q: dict[str, Any],
    slot_topic: str | None = None,
    course_context: str | None = None,
) -> str | None:
    if not isinstance(q, dict):
        return "not a dict"
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return "options not length 4"
    if not q.get("question") or not q.get("correct_answer"):
        return "missing question or correct_answer"

    on = [_strip_accents(str(x)).lower().strip() for x in opts]
    cn = _strip_accents(str(q.get("correct_answer") or "")).lower().strip()
    qt = _strip_accents(str(q.get("question") or "")).lower()

    banned_substrings = (
        "aucun des",
        "aucune des",
        "none of the above",
        "all of the above",
        "tous les elements",
    )
    for s in on + [qt, cn]:
        for b in banned_substrings:
            if b in s:
                return "forbidden_catch_all_option"

    # Reject "what does this word mean" title/keyword junk (common failure when model uses module titles as content).
    # Examples: "à quoi sert « operation »", "que signifie « chaines »"
    if re.search(r"\b(a quoi sert|a quoi sert|que signifie|signifie-t-il)\b", qt) and (
        "«" in str(q.get("question") or "") or '"' in str(q.get("question") or "") or "'" in str(q.get("question") or "")
    ):
        return "title_keyword_definition_junk"

    # Reject canned "definition / confusion / assertion / exemple" option templates.
    # These are non-answers and indicate the model is not using course content.
    if (
        sum(
            1
            for o in on
            if any(
                p in o
                for p in (
                    "definition/usage correct",
                    "confusion frequente",
                    "assertion contredite",
                    "exemple incorrect",
                    "definition usage correct",
                )
            )
        )
        >= 2
    ):
        return "template_options_definition_confusion"

    # Reject "find the error" items when the chosen correct_answer is literally present in the question stem.
    # This is usually a self-contradicting MCQ where the "correct" option repeats the erroneous line.
    if re.search(r"\b(erreur|incorrecte|faute)\b", qt) and cn and cn in qt:
        return "error_question_answer_repeats_stem"

    # Reject options that are just rule labels ("Règle 1: ...") — these test document structure, not understanding.
    if any(re.match(r"^\s*regle\s*\d+\s*[:\-]", o) for o in on):
        return "rule_label_options"

    if course_context and _looks_french(str(course_context)) and _question_is_english(
        str(q.get("question") or "")
    ):
        return "language_mismatch_expected_french"

    # Catch self-contradicting "switch/default" items (general C rule: at most one default label).
    # Common failure: "only one default if there is no default" (nonsense).
    if "switch" in qt and "defaut" in qt:
        ca = _strip_accents(str(q.get("correct_answer") or "")).lower()
        if "n'a pas" in ca and "default" in ca:
            return "illogical_switch_default_rule"

    if not (
        slot_topic and _slot_topic_is_workflow_etapes_chapter(slot_topic)
    ) and _ORDINAL_STEP_QUESTION.search(qt):
        return "ordinal_procedure_step_question"

    return None

