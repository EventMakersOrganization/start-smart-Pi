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


def _slot_topic_allows_procedure_ordinal(slot_topic: str) -> bool:
    """Startup/shutdown / admin procedures: numbered-step questions can be legitimate."""
    t = _strip_accents((slot_topic or "").lower())
    keys = (
        "demarrage",
        "arret",
        "startup",
        "shutdown",
        "instance",
        "nommount",
        "mount",
        "open",
        "tablespace",
        "checkpoint",
        "redo",
        "journalis",
        "sauvegarde",
        "backup",
        "parametr",
        "alter system",
        "spfile",
        "pfile",
        "sequence",
        "dictionnaire",
        "vue",
        "objet",
    )
    return any(k in t for k in keys)


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


_TOPIC_NOISE = frozenset({
    "module", "chapitre", "chapter", "partie", "section", "cours",
    "introduction", "conclusion", "resume", "annexe",
    "gestion", "creation", "manipulation", "suite", "fin",
    "principe", "general", "generalites", "notions", "bases",
})


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
        if w in _TOPIC_NOISE:
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


# Light aliases so French stems still match common paraphrases (small models mix FR/EN terms).
_TOPIC_KW_ALIASES: dict[str, frozenset[str]] = {
    "dictionnaire": frozenset({"dictionary", "catalogue", "catalog", "metadata", "dict"}),
    "donnees": frozenset({"data", "donnee", "base"}),
    "donnee": frozenset({"data", "donnees", "base"}),
    "vues": frozenset({"vue", "view", "views", "dba_", "user_", "all_"}),
    "vue": frozenset({"view", "views", "vues", "dba_", "user_", "all_"}),
    "objets": frozenset({"objet", "object", "objects", "table", "index", "synonym"}),
    "objet": frozenset({"objets", "objects", "table", "index", "synonym"}),
    "demarrage": frozenset({"startup", "demarrer", "start", "nommount", "mount", "open"}),
    "arret": frozenset({"shutdown", "arreter", "stop", "fermer", "abort", "immediate"}),
    "tablespaces": frozenset({"tablespace", "fichier", "datafile", "dbf", "espace"}),
    "tablespace": frozenset({"tablespaces", "fichiers", "datafile", "espace", "stockage"}),
    "instance": frozenset({"instances", "sga", "pga", "processus", "process", "oracle"}),
    "sga": frozenset({"instance", "shared", "global", "memoire", "buffer", "pool"}),
    "memoire": frozenset({"memory", "sga", "pga", "buffer", "cache", "pool"}),
    "sequence": frozenset({"sequences", "seq", "nextval", "suite", "cache", "increment"}),
    "sequences": frozenset({"sequence", "seq", "nextval", "suite", "currval", "increment"}),
    "suite": frozenset({"sequence", "sequences", "nextval", "cache", "increment", "serie"}),
    "parametres": frozenset({"parameter", "parameters", "spfile", "pfile", "init", "parametre"}),
    "commandes": frozenset({"command", "alter", "session", "system", "commande"}),
    "fichiers": frozenset({"file", "files", "spfile", "pfile", "init", "fichier"}),
    "privileges": frozenset({"privilege", "grant", "revoke", "droit", "droits", "acces"}),
    "privilege": frozenset({"privileges", "grant", "revoke", "droit", "droits", "acces"}),
    "roles": frozenset({"role", "grant", "revoke", "connect", "resource", "dba"}),
    "role": frozenset({"roles", "grant", "revoke", "connect", "resource"}),
    "revocation": frozenset({"revoke", "retirer", "supprimer", "privilege", "droit"}),
    "profils": frozenset({"profil", "profile", "password", "limite", "ressource"}),
    "profil": frozenset({"profils", "profile", "password", "limite", "ressource"}),
    "utilisateur": frozenset({"user", "compte", "comptes", "session", "connexion", "utilisateurs"}),
    "utilisateurs": frozenset({"user", "users", "compte", "comptes", "session", "utilisateur"}),
    "comptes": frozenset({"compte", "user", "utilisateur", "session", "connexion"}),
    "compte": frozenset({"comptes", "user", "utilisateur", "session", "connexion"}),
    "sessions": frozenset({"session", "connexion", "utilisateur", "alter"}),
    "securisation": frozenset({"securite", "security", "authentification", "audit", "protection"}),
    "authentification": frozenset({"password", "login", "connexion", "securite", "utilisateur"}),
    "audit": frozenset({"auditing", "trace", "fga", "surveillance", "journal"}),
    "moindre": frozenset({"privilege", "privileges", "minimum", "securite", "droit"}),
    "espace": frozenset({"tablespace", "stockage", "datafile", "taille", "quota"}),
}


def _topic_kw_matches_blob(k: str, blob: str) -> bool:
    if re.search(rf"\b{re.escape(k)}\b", blob):
        return True
    if len(k) >= 4 and k.endswith("s"):
        stem = k[:-1]
        if re.search(rf"\b{re.escape(stem)}\b", blob):
            return True
    for alias in _TOPIC_KW_ALIASES.get(k, frozenset()):
        if len(alias) >= 2 and re.search(rf"\b{re.escape(alias)}\b", blob):
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


def _topic_suffix_focus_match(slot_topic: str, blob: str) -> bool:
    """
    Many subchapter titles use « … — focus » or « A / B ». If the full title misses keyword
    hits, try the focused tail and slash segments (e.g. vues et objets; SESSION; ALTER SYSTEM).
    """
    st = (slot_topic or "").strip()
    if not st:
        return False
    pieces: list[str] = []
    for sep in ("\u2014", "\u2013"):
        if sep in st:
            parts = [p.strip() for p in st.split(sep) if p.strip()]
            if parts:
                pieces.append(parts[-1])
            break
    if not pieces and " - " in st:
        tail = st.split(" - ")[-1].strip()
        if tail:
            pieces.append(tail)
    pieces.append(st)
    extra: list[str] = []
    for p in list(pieces):
        if "/" in p:
            for seg in p.split("/"):
                s = seg.strip()
                if len(s) >= 3:
                    extra.append(s)
    pieces.extend(extra)

    seen: set[str] = set()
    for focus in pieces:
        if not focus or focus in seen:
            continue
        seen.add(focus)
        collapsed = " ".join(_strip_accents(focus).lower().split())
        if len(collapsed) >= 8 and collapsed in blob:
            return True
        kws_focus = _topic_keywords_from_slot(focus)
        if not kws_focus:
            continue
        if sum(1 for k in kws_focus if _topic_kw_matches_blob(k, blob)) >= 1:
            return True
    return False


def _weak_rag_vocab_overlap(blob: str, course_content: str) -> bool:
    """True when the MCQ reuses several terms from the retrieved chunk (paraphrased topic)."""
    cc = (course_content or "").strip()
    if len(cc) < 220 or not blob:
        return False
    try:
        from generation.question_generator import extract_key_terms
    except Exception:
        return False
    ct = extract_key_terms(course_content, min_length=4)
    if len(ct) < 4:
        ct = extract_key_terms(course_content, min_length=3)
    if len(ct) < 3:
        return False
    overlap = sum(1 for term in ct if term in blob)
    if len(ct) >= 8:
        return overlap >= 3
    if len(ct) >= 5:
        return overlap >= 2
    return overlap >= 2


def topic_slot_aligned(
    q: dict[str, Any],
    slot_topic: str,
    course_context: str | None = None,
) -> bool:
    st = (slot_topic or "").strip()
    if not st:
        return True
    if not isinstance(q, dict):
        return False
    blob = _strip_accents(
        f"{q.get('question', '')} {' '.join(str(x) for x in (q.get('options') or []))} "
        f"{q.get('explanation', '')}"
    ).lower()
    kws = _topic_keywords_from_slot(st)
    # If the topic title yields very few meaningful keywords after filtering
    # noise words, be lenient — the title is too generic to gate on.
    if len(kws) < 2:
        if _language_mismatch_question_slot(str(q.get("question") or ""), st):
            return False
        return True
    hits = sum(1 for k in kws if _topic_kw_matches_blob(k, blob))
    # Require two hits only for very long topic keyword lists (many subchapter titles are 4–7 tokens).
    need = 2 if len(kws) >= 9 else 1
    keyword_ok = hits >= need
    suffix_ok = _topic_suffix_focus_match(st, blob)
    rag_weak_ok = _weak_rag_vocab_overlap(blob, course_context or "") if course_context else False
    if not (keyword_ok or suffix_ok or rag_weak_ok):
        return False
    if _language_mismatch_question_slot(str(q.get("question") or ""), st):
        return False
    return True


def _looks_non_french_level_test(q: dict[str, Any]) -> bool:
    """True if question/options/explanation look Spanish or English-only (not French)."""
    parts = [
        str(q.get("question") or ""),
        " ".join(str(x) for x in (q.get("options") or [])),
        str(q.get("explanation") or ""),
    ]
    blob = " ".join(parts)
    if "¿" in blob or "¡" in blob:
        return True
    if re.search(
        r"\b(cuando|cuándo|cuál|cuáles|cómo|por\s+qué|dónde|qué\s+medida|"
        r"para\s+evitar|utilizando|usar\s+consultas|implementar\s+control)\b",
        blob,
        re.IGNORECASE,
    ):
        return True
    qst = str(q.get("question") or "").strip()
    if re.match(r"^(What|Which|How|When|Where|Why)\b", qst, re.IGNORECASE) and not re.search(
        r"[éèêëàâùûôîïç]", qst
    ):
        return True
    return False


def reject_level_test_question(
    q: dict[str, Any],
    slot_topic: str | None = None,
    course_context: str | None = None,
    *,
    require_french: bool = False,
) -> str | None:
    if not isinstance(q, dict):
        return "not a dict"
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return "options not length 4"
    if not q.get("question") or not q.get("correct_answer"):
        return "missing question or correct_answer"

    if require_french and _looks_non_french_level_test(q):
        return "non_french_language"

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

    if not (
        slot_topic
        and (
            _slot_topic_is_workflow_etapes_chapter(slot_topic)
            or _slot_topic_allows_procedure_ordinal(slot_topic)
        )
    ) and _ORDINAL_STEP_QUESTION.search(qt):
        return "ordinal_procedure_step_question"

    # Syllabus / course-title trivia (BrainRush + level test): not a concept question
    if re.search(
        r"\b(illustre le mieux le thème|parmi les propositions suivantes.*thème|"
        r"thème «[^»]+»\s+dans\s+«|est abordé dans le cours «)\b",
        qt,
        re.IGNORECASE,
    ):
        return "syllabus_or_course_title_meta_mcq"
    if {x.strip().lower() for x in on} <= {"choix a", "choix b", "choix c", "choix d"}:
        return "placeholder_choix_abcd_options"

    return None

