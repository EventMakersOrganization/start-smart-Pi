"""
BrainRush question generator - gamified, RAG-grounded questions using the same LLM
stack as level test (OLLAMA_LEVEL_TEST_* via question_generator._ollama_generate_text).
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import re
import unicodedata
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

from core import config
from core.db_connection import get_all_courses
from core.rag_service import RAGService
from generation.brainrush_errors import BrainRushGroundingError
from generation.level_test_quality import reject_level_test_question, topic_slot_aligned
from generation.question_generator import (
    _ollama_generate_text,
    canonicalize_correct_answer_in_place,
    parse_json_value,
    repair_to_strict_json,
)
from rag.hallucination_guard import HallucinationGuard
from rag.rag_prompt_builder import RAGPromptBuilder, extract_json_from_response
from utils import langchain_ollama

try:
    import ollama as _ollama  # type: ignore
except Exception:  # noqa: BLE001
    _ollama = None

# Minimum retrieved characters before calling the LLM (strict RAG grounding)
MIN_BRAINRUSH_CONTEXT_CHARS = 120
_GROUNDING_CONFIDENCE_MIN = 0.55
_MAX_MCQ_ATTEMPTS = 8
_MAX_TF_ATTEMPTS = 8
_MAX_DD_ATTEMPTS = 8

logger = logging.getLogger("brainrush_question_generator")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# Game rules (fast-paced)
BRAINRUSH_MAX_QUESTION_LEN = 200
BRAINRUSH_MAX_OPTION_LEN = 120
BRAINRUSH_ALLOWED_COUNTS = frozenset({10, 15, 20})

# Base time limits (seconds) by question type
_BASE_MCQ = 30
_BASE_TRUE_FALSE = 20
_BASE_DRAG_DROP = 45

_TIME_MULTIPLIERS = {"easy": 1.0, "medium": 1.2, "hard": 1.5}
_POINTS = {"easy": 10, "medium": 20, "hard": 30}

_DD_PLACEHOLDER_RE = re.compile(
    r"^(item|match|concept|choix|option|answer)\s*[0-9]+$|"
    r"^(item|match|concept)\s+[abcd]$|"
    r"^match\s+[abc]$",
    re.IGNORECASE,
)


def _normalize_tf_answer_to_vf(raw: str) -> str | None:
    """Map answer to 'vrai' or 'faux'; None if invalid."""
    s = (raw or "").strip().lower()
    if s in ("vrai", "true", "1", "oui"):
        return "vrai"
    if s in ("faux", "false", "0", "non"):
        return "faux"
    return None


def _is_dd_placeholder_label(s: str) -> bool:
    t = str(s).strip()
    if len(t) < 2:
        return True
    if _DD_PLACEHOLDER_RE.match(t):
        return True
    low = t.lower()
    if low in ("item 1", "item 2", "item 3", "item 4", "match a", "match b", "match c", "match d"):
        return True
    return False


def normalize_stem_for_dedup(stem: str) -> str:
    s = str(stem or "").lower()
    s = re.sub(r"[\s\W_]+", " ", s)
    return s.strip()[:120]


def stem_too_similar(a: str, b: str, threshold: float = 0.88) -> bool:
    if not a or not b:
        return False
    return SequenceMatcher(None, a, b).ratio() >= threshold


def _strip_accents_br(text: str) -> str:
    if not isinstance(text, str):
        return ""
    return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")


def _clean_question_text(text: str) -> str:
    """Strip leading/trailing ellipsis and whitespace that the model tends to add."""
    t = str(text or "").strip()
    while t.startswith("..."):
        t = t[3:].strip()
    while t.endswith("..."):
        t = t[:-3].strip()
    while t.startswith("."):
        t = t[1:].strip()
    return t


def _looks_like_french_ref(text: str) -> bool:
    if not isinstance(text, str) or not text.strip():
        return False
    if re.search(r"[éèêëàâùûôîïç]", text):
        return True
    t = text.lower()
    return sum(1 for w in (" le ", " la ", " les ", " des ", " une ", " un ", " est ", " sont ", " pour ") if w in f" {t} ") >= 2


def _mcq_options_pairwise_diverse(opts: list[Any], *, threshold: float = 0.88) -> bool:
    """Reject when two options are near-duplicates (ambiguous MCQ)."""
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    strs = [re.sub(r"\s+", " ", str(o).strip().lower()) for o in opts]
    if len(set(strs)) < 4:
        return False
    for i in range(4):
        for j in range(i + 1, 4):
            if SequenceMatcher(None, strs[i], strs[j]).ratio() >= threshold:
                return False
    return True


_BRAINRUSH_TF_META_RE = re.compile(
    r"(est abordé dans le cours|le thème «[^»]*»\s+est\s+abordé|important concept in|"
    r"^True\s+or\s+False\s*:|\babout the (course|chapter|module)\b)",
    re.IGNORECASE,
)

_BRAINRUSH_MCQ_META_RE = re.compile(
    r"(illustre le mieux le thème|parmi les propositions suivantes.*thème|"
    r"thème «[^»]+»\s+dans\s+«|est abordé dans le cours «|"
    r"premi[eè]re [ée]tape|derni[eè]re [ée]tape|quel(?:le)?\s+est\s+l[ae']\s*\d*\s*[ée]tape|"
    r"dans quel(?:le)? ordre|quelle étape précède|quelle étape suit)",
    re.IGNORECASE,
)


def _brainrush_tf_is_meta_syllabus_stem(qtext: str) -> bool:
    """Block V/F that only test titles / syllabus / meta ('ce thème est dans le cours')."""
    t = str(qtext or "").strip()
    if not t:
        return True
    if _BRAINRUSH_TF_META_RE.search(t):
        return True
    if "«" in t and "»" in t and re.search(r"dans le cours|dans la matière", t, re.I):
        return True
    return False


def brainrush_mcq_passes_level_test(
    q: dict[str, Any],
    course_content: str,
    slot_topic: str,
) -> bool:
    """Structural/topic checks aligned with level-test batch `_quality_ok`."""
    if not isinstance(q, dict):
        return False
    q2 = dict(q)
    canonicalize_correct_answer_in_place(q2)
    reason = reject_level_test_question(q2, slot_topic=slot_topic, course_context=course_content or "")
    if reason is not None:
        logger.debug("brainrush level-test reject: %s", reason)
        return False
    opts = q2.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    cn = str(q2.get("correct_answer", "")).strip()
    on = [str(x).strip() for x in opts]
    if cn not in on:
        logger.debug("brainrush correct_answer not in options: ca=%r opts=%r", cn, on)
        return False
    collapsed = [re.sub(r"\s+", " ", x.lower()) for x in on]
    if len(set(collapsed)) < 4:
        return False
    return True


def validate_brainrush_game_rules(question_dict: dict[str, Any] | None, *, question_type: str = "MCQ") -> bool:
    """Stricter validation for game questions: short stem/options, no generic step lists."""
    if not question_dict or not isinstance(question_dict, dict):
        return False
    qtext = str(question_dict.get("question", "") or "")
    opts = question_dict.get("options")
    if question_type == "MCQ":
        if _BRAINRUSH_MCQ_META_RE.search(qtext):
            logger.info("brainrush validate: syllabus/meta MCQ stem")
            return False
        if len(qtext) > BRAINRUSH_MAX_QUESTION_LEN:
            logger.info("brainrush validate: question too long (%s chars)", len(qtext))
            return False
        if not isinstance(opts, list) or len(opts) != 4:
            logger.info("brainrush validate: need 4 options, got %s", opts)
            return False
        for opt in opts:
            if len(str(opt)) > BRAINRUSH_MAX_OPTION_LEN:
                logger.info("brainrush validate: option too long")
                return False
        ol = {str(o).strip().lower() for o in opts}
        if len(ol) == 4 and ol <= {"choix a", "choix b", "choix c", "choix d"}:
            logger.info("brainrush validate: placeholder Choix A–D options")
            return False
        ca = question_dict.get("correct_answer")
        if ca is None or str(ca).strip() not in [str(o).strip() for o in opts]:
            return False
        low = qtext.lower()
        if "quelles sont" in low and "étapes" in low:
            return False
        if "quelles sont" in low and "etapes" in low:
            return False
        joined = " ".join(str(o) for o in opts)
        if joined.count("Étape") >= 3 or joined.count("Etape") >= 3:
            return False
    elif question_type == "TrueFalse":
        if len(qtext) > BRAINRUSH_MAX_QUESTION_LEN:
            return False
        if _brainrush_tf_is_meta_syllabus_stem(qtext):
            return False
        if not isinstance(opts, list) or len(opts) != 2:
            return False
        oset = {str(o).strip().lower() for o in opts}
        if oset != {"vrai", "faux"} and oset != {"true", "false"}:
            return False
        ca = str(question_dict.get("correct_answer", "")).strip().lower()
        norm = _normalize_tf_answer_to_vf(ca)
        if norm is None:
            return False
        allowed = {str(o).strip().lower() for o in opts}
        if norm == "vrai" and "vrai" in allowed:
            return True
        if norm == "faux" and "faux" in allowed:
            return True
        if norm == "vrai" and "true" in allowed:
            return True
        if norm == "faux" and "false" in allowed:
            return True
        return False
    elif question_type == "DragDrop":
        pairs = question_dict.get("correct_pairs") or {}
        items = question_dict.get("items") or []
        matches = question_dict.get("matches") or []
        if not isinstance(pairs, dict) or len(pairs) < 2:
            return False
        if not isinstance(items, list) or not isinstance(matches, list):
            return False
        if len(items) < 2 or len(items) != len(matches):
            return False
        if len(items) > 5:
            return False
        for lab in list(items) + list(matches):
            s = str(lab).strip()
            if len(s) < 2:
                return False
            if _is_dd_placeholder_label(s):
                return False
        for k, v in pairs.items():
            if str(k).strip() not in [str(x).strip() for x in items]:
                return False
            if str(v).strip() not in [str(x).strip() for x in matches]:
                return False
        if len(qtext) > BRAINRUSH_MAX_QUESTION_LEN + 80:
            return False
    return True


def brainrush_session_question_ok(q: dict[str, Any] | None) -> bool:
    """
    Structural validation for API post-processing (not the stricter game rules).
    Accepts letter-only correct_answer (A–D) when options are full-text MCQs.
    """
    if not q or not isinstance(q, dict):
        return False
    qtype = str(q.get("type") or "MCQ").strip()
    if qtype == "DragDrop":
        return validate_brainrush_game_rules(q, question_type="DragDrop")
    if qtype == "TrueFalse":
        return validate_brainrush_game_rules(q, question_type="TrueFalse")

    stem = str(q.get("question", "") or "").strip()
    if len(stem) < 8:
        return False
    opts = q.get("options")
    if not isinstance(opts, list) or len(opts) < 2:
        return False
    stripped = [str(o).strip() for o in opts]
    if len(set(stripped)) != len(stripped):
        return False
    ca = str(q.get("correct_answer", "") or "").strip()
    if ca in stripped:
        return True
    if qtype == "MCQ" and len(ca) == 1 and ca.upper() in "ABCDEF" and len(opts) <= 6:
        idx = ord(ca.upper()) - ord("A")
        if 0 <= idx < len(stripped):
            return True
    return False


def distribute_difficulties(num_questions: int, mode: str) -> list[str]:
    """Progressive difficulty for adaptive mode; fixed list otherwise."""
    m = (mode or "adaptive").strip().lower()
    if m != "adaptive":
        fixed = m if m in ("easy", "medium", "hard") else "medium"
        return [fixed] * num_questions
    if num_questions == 10:
        return ["easy", "easy", "medium", "easy", "medium", "medium", "hard", "medium", "hard", "medium"]
    if num_questions == 15:
        return [
            "easy",
            "easy",
            "easy",
            "medium",
            "medium",
            "easy",
            "medium",
            "hard",
            "medium",
            "medium",
            "hard",
            "medium",
            "hard",
            "medium",
            "hard",
        ]
    if num_questions == 20:
        return (
            ["easy"] * 4
            + ["medium"] * 6
            + ["easy"] * 2
            + ["medium"] * 4
            + ["hard"] * 4
        )
    # fallback
    pat = ["easy", "medium", "hard"]
    return (pat * (num_questions // 3 + 1))[:num_questions]


def _mongo_course_id(course: dict[str, Any]) -> str:
    """Mongo courses use ``id`` (normalized from ``_id``); accept either key."""
    return str(course.get("id") or course.get("_id") or "").strip()


def _chapter_title_sort_key(chapter_key: str) -> tuple:
    """
    Order like « Chapitre 1 : … » before « Chapitre 2 : … » (Mongo one document per chapter).
    """
    t = (chapter_key or "").strip()
    m = re.search(r"(?i)chapitre\s*(\d+)", t)
    if m:
        return (0, int(m.group(1)), t.lower())
    m2 = re.match(r"^\s*(\d+)\s*[:.\-]", t)
    if m2:
        return (0, int(m2.group(1)), t.lower())
    return (1, 0, t.lower())


def _module_topic_sort_key(topic: str) -> tuple:
    """Sort module titles « 1.1 - … » before « 1.2 - … » within a chapter."""
    s = (topic or "").strip()
    m = re.match(r"^\s*(\d+)\s*[\.\-]\s*(\d+)", s)
    if m:
        return (0, int(m.group(1)), int(m.group(2)), s.lower())
    return (1, 999, 999, s.lower())


def _subject_group_key_and_title(course: dict[str, Any]) -> tuple[str, str]:
    cid = _mongo_course_id(course)
    raw = course.get("subject")
    chapter_title = (course.get("title") or "").strip() or "Course"
    if raw is None:
        return f"course:{cid}", chapter_title
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return f"course:{cid}", chapter_title
        return s.lower(), s
    s = str(raw).strip()
    if not s:
        return f"course:{cid}", chapter_title
    return s.lower(), s


def _course_text_blob(course: dict[str, Any]) -> str:
    parts = [
        str(course.get("subject") or ""),
        str(course.get("title") or ""),
        str(course.get("description") or "")[:500],
    ]
    return " ".join(parts).lower()


def _merge_courses_into_subject_payload(
    courses: list[dict[str, Any]],
    display_title: str,
) -> dict[str, Any] | None:
    """Single BrainRush subject entry with modules from many MongoDB courses (same programme)."""
    if not courses:
        return None
    course_ids: list[str] = []
    modules: list[dict[str, Any]] = []
    for c in courses:
        cid = _mongo_course_id(c)
        if not cid:
            continue
        course_ids.append(cid)
        chapter_title = (c.get("title") or "").strip()
        for m in c.get("modules") or []:
            if isinstance(m, dict):
                modules.append(
                    {
                        "title": m.get("title", ""),
                        "description": (m.get("description") or "")[:200],
                        "chapter_title": chapter_title,
                        "course_id": cid,
                    }
                )
    gkey = re.sub(r"[^a-z0-9]+", "_", display_title.lower()).strip("_")[:80] or "merged_subject"
    return {"group_key": gkey, "title": display_title.strip(), "course_ids": course_ids, "modules": modules}


def _courses_matching_subject_hint(hint: str, courses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Match courses when Mongo has no `subject` field or keys are per-course (course:...).
    Uses substring / token overlap on subject + title + description.
    """
    h = (hint or "").strip().lower()
    if not h:
        return list(courses)
    out: list[dict[str, Any]] = []
    words = [w for w in re.split(r"\W+", h) if len(w) > 2]
    for c in courses:
        blob = _course_text_blob(c)
        if len(h) >= 4 and h in blob:
            out.append(c)
            continue
        if words and all(w in blob for w in words[:8]):
            out.append(c)
            continue
    return out


def _build_logical_subject_map(courses: list[dict[str, Any]] | None = None) -> dict[str, dict[str, Any]]:
    courses = courses if courses is not None else get_all_courses()
    courses = sorted(courses, key=lambda c: (c.get("title") or ""))
    subject_map: dict[str, dict[str, Any]] = {}
    for i, c in enumerate(courses):
        cid = _mongo_course_id(c)
        mods = c.get("modules", [])
        logger.info(
            "subject_map build: course %s/%s id=%s title=%.40s modules_count=%s",
            i + 1, len(courses), cid[:12], (c.get("title") or "")[:40],
            len(mods) if isinstance(mods, list) else type(mods).__name__,
        )
        gkey, display_title = _subject_group_key_and_title(c)
        cid = _mongo_course_id(c)
        chapter_title = (c.get("title") or "").strip()
        subject_map.setdefault(gkey, {"course_ids": [], "title": display_title, "modules": []})
        info = subject_map[gkey]
        info["course_ids"].append(cid)
        raw_subj = c.get("subject")
        if isinstance(raw_subj, str) and raw_subj.strip():
            s = raw_subj.strip()
            info["title"] = s
            info["subject"] = s  # mirrors MongoDB `subject`; one programme for many chapter docs
        modules = c.get("modules", [])
        has_real_modules = False
        if isinstance(modules, list):
            for m in modules:
                if not isinstance(m, dict):
                    continue
                mtitle = (m.get("title") or m.get("name") or "").strip()
                if mtitle:
                    has_real_modules = True
                    info["modules"].append(
                        {
                            "title": mtitle,
                            "description": (m.get("description") or "")[:200],
                            "chapter_title": chapter_title,
                            "course_id": cid,
                        }
                    )
        if not has_real_modules and chapter_title:
            info["modules"].append(
                {
                    "title": chapter_title,
                    "description": (c.get("description") or "")[:200],
                    "chapter_title": chapter_title,
                    "course_id": cid,
                }
            )
    for gkey, info in subject_map.items():
        cids_in_mods = {str(m.get("course_id") or "") for m in info.get("modules", []) if isinstance(m, dict)}
        logger.info(
            "subject_map result: gkey=%s course_ids=%s modules=%s distinct_cids_in_modules=%s",
            gkey[:40], len(info.get("course_ids", [])), len(info.get("modules", [])), len(cids_in_mods),
        )
    return subject_map


def _topic_course_specs_from_modules(
    modules: list[dict],
    count: int,
    *,
    seed: str = "",
) -> list[dict[str, str]]:
    """
    Round-robin across **Mongo course documents** (one ``course_id`` = one bucket).

    We **do not** bucket by ``chapter_title`` alone: duplicate or missing titles across
    documents would collapse 8 courses into one bucket. ``course_id`` is always unique
    per document. Works for one subject with many courses, or many subjects (each payload
    has its own modules list).
    """
    seen_pair: set[tuple[str, str]] = set()
    # course_id -> list of {course_id, topic}; sort label from first module's chapter_title
    by_course: dict[str, list[dict[str, str]]] = {}
    cid_label: dict[str, str] = {}

    for idx, m in enumerate(modules):
        if not isinstance(m, dict):
            continue
        cid = str(m.get("course_id") or "").strip()
        t = (m.get("title") or m.get("name") or "").strip()
        if not cid or not t:
            if idx < 3:
                logger.info("topic_specs: skipping module %s — cid=%r title=%r keys=%s", idx, cid, t, list(m.keys()))
            continue
        key = (cid, t)
        if key in seen_pair:
            continue
        seen_pair.add(key)
        ch = (m.get("chapter_title") or "").strip()
        if cid not in cid_label and ch:
            cid_label[cid] = ch
        by_course.setdefault(cid, []).append({"course_id": cid, "topic": t})

    if not by_course:
        return [{"course_id": "", "topic": "general"} for _ in range(max(1, count))][:count]

    for cid in by_course:
        by_course[cid].sort(key=lambda row: _module_topic_sort_key(row["topic"]))

    # Order courses by chapter title (Chapitre 1 … Chapitre 8); tie-break by id.
    cids = sorted(
        by_course.keys(),
        key=lambda c: (_chapter_title_sort_key(cid_label.get(c, "")), c),
    )
    h = hashlib.sha256((seed or "default").encode("utf-8")).digest()
    rot = int.from_bytes(h[:8], "big") % len(cids)
    if rot:
        cids = cids[rot:] + cids[:rot]

    n_courses = len(cids)
    n_modules = sum(len(by_course[c]) for c in cids)
    logger.info(
        "brainrush topic plan: %s Mongo course(s), %s module row(s); first courses=%s",
        n_courses,
        n_modules,
        [cid_label.get(c, c)[:48] + ("…" if len(cid_label.get(c, c)) > 48 else "") for c in cids[:5]],
    )

    ptr = {c: 0 for c in cids}
    flat: list[dict[str, str]] = []

    while len(flat) < count:
        for cid in cids:
            if len(flat) >= count:
                break
            bucket = by_course[cid]
            if not bucket:
                continue
            i = ptr[cid] % len(bucket)
            flat.append(dict(bucket[i]))
            ptr[cid] += 1

    return flat[:count]


def _map_entry_matches_subject_hint(ss: str, gkey: str, info: dict[str, Any]) -> bool:
    """Match user hint against logical map (Mongo `subject` → one group with merged modules)."""
    title = (info.get("title") or "").strip().lower()
    subj = (info.get("subject") or info.get("title") or "").strip().lower()
    g = gkey.lower()
    if ss == g or ss == title or ss == subj:
        return True
    if title and (ss in title or title in ss):
        return True
    if subj and (ss in subj or subj in ss):
        return True
    if ss in g or g in ss:
        return True
    return False


def resolve_brainrush_subjects(
    subject_filter: list[str] | None,
    single_subject: str | None,
) -> list[dict[str, Any]]:
    """
    Returns list of {group_key, title, modules, course_ids} for BrainRush.

    When MongoDB stores ``subject`` on each course, ``_build_logical_subject_map`` already
    merges all chapters into **one** group (same gkey / title / modules). That path is
    preferred: we match ``single_subject`` against the map **first**.

    If nothing matches (legacy ``course:…`` keys or missing ``subject``), we fall back to
    ``_courses_matching_subject_hint`` + ``_merge_courses_into_subject_payload``.
    """
    courses_raw = get_all_courses()
    if not courses_raw:
        return []
    subject_map = _build_logical_subject_map(courses_raw)

    def _match_filter(gkey: str, info: dict) -> bool:
        if not subject_filter:
            return True
        titles = (
            (info.get("title") or "").lower(),
            (info.get("subject") or "").lower(),
            gkey.lower(),
        )
        cids = [str(x) for x in info.get("course_ids") or []]
        for f in subject_filter:
            fs = str(f).strip().lower()
            if not fs:
                continue
            if fs == titles[0] or fs == titles[1] or fs == titles[2] or any(fs == c for c in cids):
                return True
            if fs in titles[0] or fs in titles[1]:
                return True
        return False

    if single_subject and str(single_subject).strip():
        ss = str(single_subject).strip().lower()
        label = str(single_subject).strip()

        # 1) Canonical path: Mongo ``subject`` already rolled chapters into one map entry.
        for gkey, info in subject_map.items():
            if not _match_filter(gkey, info):
                continue
            if _map_entry_matches_subject_hint(ss, gkey, info):
                logger.info("resolve path=1(canonical) gkey=%s modules=%s cids=%s", gkey[:30], len(info.get("modules", [])), len(info.get("course_ids", [])))
                return [{"group_key": gkey, **info}]

        # 2) If hint matches a single course (chapter title), expand to its full subject group.
        matched_courses = _courses_matching_subject_hint(label, courses_raw)
        if matched_courses:
            for mc in matched_courses:
                mc_subj = (mc.get("subject") or "").strip().lower()
                if mc_subj:
                    for gkey, info in subject_map.items():
                        if gkey == mc_subj or (info.get("subject") or "").strip().lower() == mc_subj:
                            logger.info(
                                "resolve path=2(expand chapter→subject) hint=%s subject=%s modules=%s cids=%s",
                                label[:30], mc_subj[:30], len(info.get("modules", [])), len(info.get("course_ids", [])),
                            )
                            return [{"group_key": gkey, **info}]
            if subject_filter:
                mf = [str(f).strip().lower() for f in subject_filter if str(f).strip()]
                if mf:
                    matched_courses = [
                        c
                        for c in matched_courses
                        if any(f in _course_text_blob(c) for f in mf)
                    ]
            merged = _merge_courses_into_subject_payload(matched_courses, label)
            if merged and (merged.get("modules") or merged.get("course_ids")):
                logger.info("resolve path=2(legacy merge) modules=%s cids=%s", len(merged.get("modules", [])), len(merged.get("course_ids", [])))
                return [merged]

        # 3) Last-chance partial match on map (substring).
        for gkey, info in subject_map.items():
            if not _match_filter(gkey, info):
                continue
            blob = f"{gkey} {(info.get('title') or '')} {(info.get('subject') or '')}".lower()
            if ss in blob or any(w in blob for w in ss.split() if len(w) > 2):
                logger.info("resolve path=3(substring) gkey=%s modules=%s", gkey[:30], len(info.get("modules", [])))
                return [{"group_key": gkey, **info}]

    out: list[dict[str, Any]] = []
    for gkey, info in subject_map.items():
        if _match_filter(gkey, info):
            out.append({"group_key": gkey, **info})
    return out


def calculate_estimated_time_seconds(questions: list[dict[str, Any]]) -> int:
    total = sum(int(q.get("time_limit", 30)) for q in questions)
    return total + 60


def _passes_grounding_gate(validation: dict[str, Any]) -> bool:
    return float(validation.get("confidence") or 0.0) >= _GROUNDING_CONFIDENCE_MIN


def _fetch_brainrush_context(
    rag: RAGService,
    subject: str,
    topic: str,
    course_id_hint: str | None,
) -> str:
    """
    Same retrieval contract as level_test.batch_question_generator:
    with course_id: get_context_for_course_ids(..., max_chunks=10), then if empty
    get_context_for_query(..., max_chunks=8); without course_id: get_context_for_query(8).
    Tries a few query variants and keeps the longest block until MIN_BRAINRUSH_CONTEXT_CHARS.
    """
    subject_s = (subject or "").strip()
    topic_s = (topic or "").strip()
    base = f"{subject_s} {topic_s}".strip()
    queries: list[str] = [
        base,
        f"{subject_s} {topic_s} cours".strip(),
        f"{topic_s} définition concepts".strip(),
        subject_s,
    ]
    seen: set[str] = set()
    ordered: list[str] = []
    for q in queries:
        q = (q or "").strip()
        if q and q not in seen:
            seen.add(q)
            ordered.append(q)

    def _one_block(qtext: str) -> str:
        qtext = (qtext or "").strip()
        if not qtext:
            return ""
        cid = str(course_id_hint).strip() if course_id_hint else ""
        if cid:
            block = (rag.get_context_for_course_ids(qtext, [cid], max_chunks=10) or "").strip()
            if not block:
                block = (rag.get_context_for_query(qtext, max_chunks=8) or "").strip()
        else:
            block = (rag.get_context_for_query(qtext, max_chunks=8) or "").strip()
        return block

    best = ""
    for qtext in ordered:
        block = _one_block(qtext)
        if len(block) > len(best):
            best = block
        if len(best) >= MIN_BRAINRUSH_CONTEXT_CHARS:
            return best
    return best


def _brainrush_fallback_mcq_from_rag(subject: str, topic: str, difficulty: str, context: str) -> dict[str, Any]:
    """
    Level-test-style last resort: anchor to a term from RAG context (see batch_question_generator._fallback_question).
    Options kept under BRAINRUSH_MAX_OPTION_LEN.
    """
    t = (topic or "ce chapitre").strip()
    s = (subject or "ce cours").strip()
    norm = _strip_accents_br(context or "").lower()
    m = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", norm)
    generic = {
        "dans",
        "pour",
        "avec",
        "les",
        "des",
        "une",
        "un",
        "du",
        "de",
        "la",
        "le",
        "cours",
        "chapitre",
        "module",
        "section",
        "titre",
        "partie",
        "page",
        "exemple",
        "figure",
        "programme",
        "table",
        "annexe",
        "operation",
        "operations",
        "operateur",
        "operateurs",
        "chaine",
        "chaines",
        "donnee",
        "donnees",
        "structure",
        "structures",
        "fonction",
        "fonctions",
    }
    candidates = [x for x in m if len(x) >= 3 and x.lower() not in generic]
    topic_words = [
        w
        for w in re.findall(r"[a-zA-Zàâäéèêëïîôùûç]{3,}", _strip_accents_br(t).lower())
        if w.lower() not in generic
    ]
    candidates = (candidates + topic_words)[:80]

    q_text = ""
    good = ""
    for term in candidates:
        term_s = (term or "")[:24]
        cand = {
            "question": f"Dans {s}, à quoi sert « {term_s} » ?",
            "options": [],
            "correct_answer": "",
            "topic": t,
        }
        if topic_slot_aligned(cand, t):
            q_text = cand["question"]
            good = f"Usage/définition corrects ({term_s})"
            break

    if not q_text:
        concept = " ".join(topic_words[:3]).strip() or "ce sujet"
        q_text = f"Dans {s}, quel énoncé décrit le mieux {concept} ?"
        good = "Énoncé conforme au cours"

    good = good[:BRAINRUSH_MAX_OPTION_LEN]
    return {
        "type": "MCQ",
        "question": q_text[:BRAINRUSH_MAX_QUESTION_LEN],
        "options": [
            good,
            "Erreur fréquente (usage ou définition)",
            "Affirmation fausse vs le cours",
            "Exemple ou syntaxe incorrects",
        ],
        "correct_answer": good,
        "explanation": "Révisez le passage du cours correspondant à ce thème.",
        "difficulty": difficulty,
        "topic": t,
    }


def _brainrush_fallback_tf_stem(topic: str) -> tuple[str, str]:
    """Non-meta technical V/F when LLM fails (no syllabus/title trivia)."""
    tl = (topic or "").lower()
    if "chaîne" in tl or "chaine" in tl or "string" in tl or "caract" in tl:
        return (
            "En C, un littéral de chaîne nécessite un espace pour le '\\0' final en mémoire.",
            "Vrai",
        )
    return ("En C, sizeof(char) vaut 1 octet.", "Vrai")


def _call_brainrush_llm(prompt: str) -> str:
    """
    BrainRush LLM call with scaled num_ctx/num_predict matching the level test batch generator.
    The default _ollama_generate_text uses num_ctx=2048 / num_predict=1024 which is too small
    for rubric-quality prompts — the prompt alone consumes most of the context window and the
    model truncates the JSON response.
    """
    mn = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
    mn = langchain_ollama.resolve_ollama_model_name(mn)

    if _ollama is not None:
        opts = {
            "temperature": float(getattr(config, "OLLAMA_LEVEL_TEST_TEMPERATURE", 0.4)),
            "top_p": 0.9,
            "num_ctx": 4096,
            "num_predict": 1536,
        }
        logger.info("[brainrush] ollama.generate model=%s num_ctx=%s num_predict=%s", mn, opts["num_ctx"], opts["num_predict"])
        try:
            resp = _ollama.generate(model=mn, prompt=str(prompt), options=opts)
            text = ""
            if isinstance(resp, dict):
                text = str(resp.get("response", "") or "").strip()
            elif hasattr(resp, "response"):
                text = str(getattr(resp, "response") or "").strip()
            else:
                text = str(resp).strip()
            if text:
                return text
        except Exception:
            pass

    return _ollama_generate_text(prompt=prompt, model_name=mn)


def _build_gamified_mcq_prompt(
    subject: str,
    topic: str,
    difficulty: str,
    course_content: str,
    diversity_seed: str | None = None,
    strict: bool = False,
) -> str:
    ref = (course_content or "").strip()
    if len(ref) > 3200:
        ref = ref[:3200]
    seed_line = (
        f"\nSESSION_ID: {diversity_seed}\nEach question MUST differ from previous ones: pick different angles, "
        "numbers, and code snippets within the same topic; do not repeat the same question stem pattern.\n"
        if diversity_seed
        else ""
    )
    lang_hint = "Write EVERYTHING in French (question, options, explanation)." if _looks_like_french_ref(ref) else "Same language as the reference."
    return f"""You are an expert C programming teacher writing a quiz question.

Generate exactly ONE multiple-choice question. {lang_hint}

Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}

STRICT RULES — violating any rule makes the question INVALID:

1. QUESTION STYLE:
   - Ask about CONCEPTS, BEHAVIOUR, or MEANING — e.g. "What does this code print?", "What is the difference between X and Y?", "Which statement about X is correct?"
   - Do NOT ask step ordering ("première étape", "dernière étape", "quel est l'ordre").
   - Do NOT copy a code block from the reference and ask "what is this?". Write your OWN short example if needed.
   - Keep the question SHORT (1-2 sentences, under 150 characters if no code). If you include code, keep it under 3 lines.

2. OPTIONS:
   - Exactly 4 options, exactly 1 correct. All 4 must be plausible and roughly the same length.
   - Do NOT use full sentences as options when short phrases work. Keep each option under 80 characters.
   - No catch-all ("toutes les réponses", "aucune de ces réponses").
   - Each option must be clearly different from the others.

3. CORRECTNESS:
   - The correct_answer MUST be factually correct according to C language rules.
   - If asking about code output, mentally execute the code step by step before answering.
   - Common traps to avoid: int A[5]=={{1,2,3}} is VALID in C (remaining = 0). for loop CAN execute 0 times. main() IS required in C. scanf is in stdio.h not string.h.
   - The explanation must justify WHY the correct answer is right and briefly say why the others are wrong.

4. correct_answer must be character-for-character identical to one of the four options.

REFERENCE MATERIAL (use as knowledge source, do NOT copy examples verbatim):
{ref}
{seed_line}
OUTPUT — strict JSON only, no markdown, no extra text before or after the JSON:
{{"question":"Your question here","options":["option1","option2","option3","option4"],"correct_answer":"option1","explanation":"Your explanation here","difficulty":"{difficulty}","topic":"{topic}"}}
JSON:"""


def _build_gamified_tf_prompt(
    subject: str,
    topic: str,
    difficulty: str,
    course_content: str,
    diversity_seed: str | None = None,
) -> str:
    ref = (course_content or "").strip()[:3200]
    seed = (
        f"\nSESSION_ID: {diversity_seed}\nVary wording vs other questions in this session.\n"
        if diversity_seed
        else ""
    )
    lang_hint = "Write EVERYTHING in French (question, explanation)." if _looks_like_french_ref(ref) else "Same language as the reference."
    return f"""You are an expert C programming teacher writing a True/False quiz question. {lang_hint}

Generate exactly ONE True/False statement about the topic below.

Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}

STRICT RULES:

1. The statement must be a clear, unambiguous technical fact about C programming — e.g. how a construct behaves, what a function does, what a type means.
2. Do NOT ask about document structure, step ordering, or course organization.
3. Do NOT write an empty or vague statement. Be specific and concrete.
4. CORRECTNESS IS CRITICAL:
   - for loop CAN execute 0 times (condition checked BEFORE first iteration). Only do-while always executes at least once.
   - main() IS the mandatory entry point in standard C.
   - scanf() is declared in stdio.h, NOT string.h.
   - int A[5] = {{1,2,3}} is valid C: remaining elements are initialized to 0.
   - Verify your statement against C language rules before answering.
5. Options must be exactly ["Vrai", "Faux"]. correct_answer must be exactly "Vrai" or "Faux".
6. Explanation: 1-2 sentences justifying the answer with a concrete reason.

REFERENCE MATERIAL (use as knowledge source):
{ref}
{seed}
OUTPUT — strict JSON only, no markdown, no extra text before or after the JSON:
{{"question":"Your statement here","options":["Vrai","Faux"],"correct_answer":"Vrai","explanation":"Your explanation here","difficulty":"{difficulty}","topic":"{topic}"}}
JSON:"""


def _build_gamified_dd_prompt(
    subject: str,
    topic: str,
    difficulty: str,
    course_content: str,
    *,
    strict: bool = False,
) -> str:
    ref = (course_content or "").strip()[:2800]
    strict_line = (
        "\nSTRICT: 3 pairs; labels taken from text (real names); no Item1/MatchA.\n" if strict else ""
    )
    lang_hint = "Write EVERYTHING in French." if _looks_like_french_ref(ref) else "Same language as the reference."
    return f"""You are an expert assessment designer for a fast-paced educational game (BrainRush).

Generate exactly ONE drag-and-drop matching question using ONLY the reference material below.

Subject: {subject}
Topic: {topic}
Difficulty: {difficulty}
{strict_line}
Rules:
- All labels (items, matches) must be traceable in the reference.
- {lang_hint}
- 3 or 4 pairs (same count for items and matches).
- Each label must be a CONCRETE term from the reference (function names, concepts, keywords).
- Forbidden: "Item 1", "Item 2", "Match A", "Concept X", generic numbering.
- correct_pairs keys must exactly equal items strings; values must exactly equal matches strings.

REFERENCE MATERIAL (only source of truth):
---
{ref}
---

OUTPUT (strict JSON only — no markdown fences, no extra text):
{{"question":"Short instruction in French","items":["term1","term2","term3"],"matches":["desc A","desc B","desc C"],"correct_pairs":{{"term1":"desc A","term2":"desc B","term3":"desc C"}},"explanation":"...","difficulty":"{difficulty}","topic":"{topic}"}}
JSON:"""


class BrainRushQuestionGenerator:
    """Generates structured BrainRush questions using RAG and hallucination guards."""

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.prompt_builder = RAGPromptBuilder(self.rag_service)
        self.hallucination_guard = HallucinationGuard(self.rag_service)

    def generate_mcq(
        self,
        subject: str,
        difficulty: str,
        topic: str,
        *,
        diversity_seed: str | None = None,
        course_id_hint: str | None = None,
        use_gamified: bool = True,
    ) -> dict[str, Any]:
        try:
            course_content = _fetch_brainrush_context(self.rag_service, subject, topic, course_id_hint)
            if len(course_content.strip()) < MIN_BRAINRUSH_CONTEXT_CHARS:
                # Relaxed Mode: If no RAG content is found, use LLM knowledge for this question.
                course_content = f"(Aucun support de cours trouvé. Utilise tes connaissances générales sur {subject}/{topic} pour générer cette question.)"

            if use_gamified:
                for attempt in range(_MAX_MCQ_ATTEMPTS):
                    prompt = _build_gamified_mcq_prompt(
                        subject,
                        topic,
                        difficulty,
                        course_content,
                        diversity_seed=diversity_seed,
                        strict=(attempt >= 2),
                    )
                    logger.info(
                        "brainrush generate_mcq (gamified): subject=%s topic=%s attempt=%s",
                        subject,
                        topic,
                        attempt,
                    )
                    response = _call_brainrush_llm(prompt)
                    try:
                        data = self._extract_and_validate_json(response)
                    except ValueError as e:
                        logger.warning("brainrush mcq invalid JSON, attempt %s: %s", attempt, e)
                        continue
                    canonicalize_correct_answer_in_place(data)
                    val_dict = dict(data)
                    if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                        pairs = val_dict.get("correct_pairs") or {}
                        val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
                    validation = self.hallucination_guard.verify_question_validity(val_dict, course_content or "")
                    if not _passes_grounding_gate(validation):
                        logger.warning(
                            "brainrush mcq grounding rejected: issues=%s conf=%s",
                            validation.get("issues"),
                            validation.get("confidence"),
                        )
                        continue
                    opts_raw = data.get("options", ["A", "B", "C", "D"])
                    opts_clean = [str(o).strip()[:BRAINRUSH_MAX_OPTION_LEN] for o in opts_raw] if isinstance(opts_raw, list) else opts_raw
                    ca_raw = str(data.get("correct_answer", "")).strip()
                    if ca_raw not in [str(o).strip() for o in opts_raw]:
                        canonicalize_correct_answer_in_place(data)
                        ca_raw = str(data.get("correct_answer", "")).strip()
                    ca_clean = ca_raw[:BRAINRUSH_MAX_OPTION_LEN] if len(ca_raw) > BRAINRUSH_MAX_OPTION_LEN else ca_raw
                    q = {
                        "type": "MCQ",
                        "question": _clean_question_text(data.get("question", ""))[:BRAINRUSH_MAX_QUESTION_LEN],
                        "options": opts_clean,
                        "correct_answer": ca_clean,
                        "explanation": _clean_question_text(data.get("explanation", "")),
                        "difficulty": difficulty,
                        "topic": topic,
                        "points": self._calculate_points(difficulty),
                        "time_limit": self._calculate_time_limit(difficulty, "MCQ"),
                        "validation_confidence": validation.get("confidence", 0.0),
                        "is_fallback": False,
                    }
                    if ca_clean not in opts_clean:
                        canonicalize_correct_answer_in_place(q)
                    if not validate_brainrush_game_rules(q, question_type="MCQ"):
                        logger.info("brainrush mcq failed game rules, attempt %s", attempt + 1)
                        continue
                    if not brainrush_mcq_passes_level_test(q, course_content or "", topic):
                        reason = reject_level_test_question(q, slot_topic=topic, course_context=course_content or "")
                        aligned = topic_slot_aligned(q, topic)
                        logger.info(
                            "brainrush mcq failed level-test quality, attempt %s: reject=%s aligned=%s stem=%.60s",
                            attempt + 1, reason, aligned, q.get("question", ""),
                        )
                        continue
                    return q
            else:
                prompt = self.prompt_builder.build_question_generation_prompt(
                    subject, difficulty, topic, question_type="MCQ"
                )
                response = _call_brainrush_llm(prompt)
                data = self._extract_and_validate_json(response)
                val_dict = dict(data)
                validation = self.hallucination_guard.verify_question_validity(val_dict, course_content or "")
                if not _passes_grounding_gate(validation):
                    raise BrainRushGroundingError("Non-gamified MCQ failed hallucination guard.")
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
                if q["question"] and q["correct_answer"]:
                    return q

            raise BrainRushGroundingError("MCQ validation failed after all attempts.")
        except BrainRushGroundingError:
            raise
        except Exception as e:
            logger.exception("brainrush generate_mcq error: %s", e)
            raise BrainRushGroundingError(str(e)) from e

    def generate_true_false(
        self,
        subject: str,
        difficulty: str,
        topic: str,
        *,
        diversity_seed: str | None = None,
        course_id_hint: str | None = None,
        use_gamified: bool = True,
    ) -> dict[str, Any]:
        try:
            course_content = _fetch_brainrush_context(self.rag_service, subject, topic, course_id_hint)
            if len(course_content.strip()) < MIN_BRAINRUSH_CONTEXT_CHARS:
                # Relaxed Mode: If no RAG content is found, use LLM knowledge for this question.
                course_content = f"(Aucun support de cours trouvé. Utilise tes connaissances générales sur {subject}/{topic} pour générer cette question.)"

            if use_gamified:
                for attempt in range(_MAX_TF_ATTEMPTS):
                    ds = f"{diversity_seed}|tf{attempt}" if diversity_seed else f"tf{attempt}"
                    prompt = _build_gamified_tf_prompt(subject, topic, difficulty, course_content, ds)
                    logger.info(
                        "brainrush generate_true_false (gamified): subject=%s topic=%s attempt=%s",
                        subject,
                        topic,
                        attempt,
                    )
                    response = _call_brainrush_llm(prompt)
                    try:
                        data = self._extract_and_validate_json(response)
                    except ValueError as e:
                        logger.warning("brainrush tf invalid JSON, attempt %s: %s", attempt, e)
                        continue
                    val_dict = dict(data)
                    if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                        pairs = val_dict.get("correct_pairs") or {}
                        val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
                    validation = self.hallucination_guard.verify_question_validity(val_dict, course_content or "")
                    if not _passes_grounding_gate(validation):
                        logger.warning(
                            "brainrush tf grounding rejected: issues=%s conf=%s",
                            validation.get("issues"),
                            validation.get("confidence"),
                        )
                        continue
                    opts_raw = data.get("options") or ["Vrai", "Faux"]
                    olist: list[str] = []
                    for o in (opts_raw if isinstance(opts_raw, list) else ["Vrai", "Faux"]):
                        lo = str(o).strip().lower()
                        if lo in ("vrai", "true"):
                            olist.append("Vrai")
                        elif lo in ("faux", "false"):
                            olist.append("Faux")
                    if len(olist) != 2 or {x.lower() for x in olist} != {"vrai", "faux"}:
                        olist = ["Vrai", "Faux"]
                    norm = _normalize_tf_answer_to_vf(str(data.get("correct_answer", "Vrai")))
                    if norm is None:
                        norm = "vrai"
                    correct_display = olist[0]
                    for cand in olist:
                        cl = str(cand).strip().lower()
                        if norm == "vrai" and cl in ("vrai", "true"):
                            correct_display = cand
                            break
                        if norm == "faux" and cl in ("faux", "false"):
                            correct_display = cand
                            break
                    q = {
                        "type": "TrueFalse",
                        "question": _clean_question_text(data.get("question", "")),
                        "options": olist,
                        "correct_answer": correct_display,
                        "explanation": _clean_question_text(data.get("explanation", "")),
                        "difficulty": difficulty,
                        "topic": topic,
                        "points": self._calculate_points(difficulty),
                        "time_limit": self._calculate_time_limit(difficulty, "TrueFalse"),
                        "validation_confidence": validation.get("confidence", 0.0),
                        "is_fallback": False,
                    }
                    if not q["question"]:
                        continue
                    if validate_brainrush_game_rules(q, question_type="TrueFalse"):
                        return q
                    logger.info("brainrush true_false failed rules/meta, attempt %s", attempt + 1)
            else:
                prompt = self.prompt_builder.build_question_generation_prompt(
                    subject, difficulty, topic, question_type="True/False"
                )
                response = _call_brainrush_llm(prompt)
                data = self._extract_and_validate_json(response)
                val_dict = dict(data)
                if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                    pairs = val_dict.get("correct_pairs") or {}
                    val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
                validation = self.hallucination_guard.verify_question_validity(val_dict, course_content or "")
                if not _passes_grounding_gate(validation):
                    raise BrainRushGroundingError("Non-gamified True/False failed hallucination guard.")
                opts_raw = data.get("options") or ["Vrai", "Faux"]
                olist = []
                for o in (opts_raw if isinstance(opts_raw, list) else ["Vrai", "Faux"]):
                    lo = str(o).strip().lower()
                    if lo in ("vrai", "true"):
                        olist.append("Vrai")
                    elif lo in ("faux", "false"):
                        olist.append("Faux")
                if len(olist) != 2 or {x.lower() for x in olist} != {"vrai", "faux"}:
                    olist = ["Vrai", "Faux"]
                norm = _normalize_tf_answer_to_vf(str(data.get("correct_answer", "Vrai")))
                if norm is None:
                    norm = "vrai"
                correct_display = olist[0]
                for cand in olist:
                    cl = str(cand).strip().lower()
                    if norm == "vrai" and cl in ("vrai", "true"):
                        correct_display = cand
                        break
                    if norm == "faux" and cl in ("faux", "false"):
                        correct_display = cand
                        break
                q = {
                    "type": "TrueFalse",
                    "question": data.get("question", ""),
                    "options": olist,
                    "correct_answer": correct_display,
                    "explanation": data.get("explanation", ""),
                    "difficulty": difficulty,
                    "topic": topic,
                    "points": self._calculate_points(difficulty),
                    "time_limit": self._calculate_time_limit(difficulty, "TrueFalse"),
                    "validation_confidence": validation.get("confidence", 0.0),
                    "is_fallback": False,
                }
                if q["question"] and validate_brainrush_game_rules(q, question_type="TrueFalse"):
                    return q

            raise BrainRushGroundingError("True/False validation failed after all attempts.")
        except BrainRushGroundingError:
            raise
        except Exception as e:
            logger.exception("brainrush generate_true_false error: %s", e)
            raise BrainRushGroundingError(str(e)) from e

    def generate_drag_drop(
        self,
        subject: str,
        difficulty: str,
        topic: str,
        *,
        course_id_hint: str | None = None,
    ) -> dict[str, Any]:
        try:
            course_content = _fetch_brainrush_context(self.rag_service, subject, topic, course_id_hint)
            if len(course_content.strip()) < MIN_BRAINRUSH_CONTEXT_CHARS:
                # Relaxed Mode: If no RAG content is found, use LLM knowledge for this question.
                course_content = f"(Aucun support de cours trouvé. Utilise tes connaissances générales sur {subject}/{topic} pour générer cette question.)"

            for attempt in range(_MAX_DD_ATTEMPTS):
                prompt = _build_gamified_dd_prompt(
                    subject, topic, difficulty, course_content, strict=(attempt >= 1)
                )
                logger.info("brainrush generate_drag_drop: subject=%s topic=%s attempt=%s", subject, topic, attempt)
                response = _call_brainrush_llm(prompt)
                try:
                    data = self._extract_and_validate_json(response, allow_correct_pairs=True)
                except ValueError as e:
                    logger.warning("brainrush dd invalid JSON, attempt %s: %s", attempt, e)
                    continue
                val_dict = dict(data)
                if "correct_answer" not in val_dict and "correct_pairs" in val_dict:
                    pairs = val_dict.get("correct_pairs") or {}
                    val_dict["correct_answer"] = " ".join(str(v) for v in pairs.values())[:200]
                validation = self.hallucination_guard.verify_question_validity(val_dict, course_content or "")
                if not _passes_grounding_gate(validation):
                    logger.warning(
                        "brainrush dd grounding rejected: issues=%s conf=%s",
                        validation.get("issues"),
                        validation.get("confidence"),
                    )
                    continue
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
                    continue
                if validate_brainrush_game_rules(q, question_type="DragDrop"):
                    return q
                logger.info("brainrush drag_drop failed game rules, retrying (attempt %s)", attempt + 1)
            raise BrainRushGroundingError("DragDrop validation failed after all attempts.")
        except BrainRushGroundingError:
            raise
        except Exception as e:
            logger.exception("brainrush generate_drag_drop error: %s", e)
            raise BrainRushGroundingError(str(e)) from e

    def generate_brainrush_session_questions(
        self,
        *,
        num_questions: int,
        difficulty_preference: str,
        session_seed: str,
        subjects_payload: list[dict[str, Any]],
        mixed_types: bool = False,
    ) -> list[dict[str, Any]]:
        """
        10/15/20 questions with topic diversity from course modules and adaptive difficulty curve.
        If mixed_types True, use 70/30 MCQ/TF; else MCQ-only.
        """
        if num_questions not in BRAINRUSH_ALLOWED_COUNTS:
            raise ValueError("num_questions must be 10, 15, or 20")
        if not subjects_payload:
            raise ValueError("No subjects available for BrainRush")

        difficulties = distribute_difficulties(num_questions, difficulty_preference)
        questions: list[dict[str, Any]] = []
        seen_norms: list[str] = []

        if len(subjects_payload) == 1:
            info = subjects_payload[0]
            modules = info.get("modules") or []
            title = info.get("title") or info.get("group_key") or "Subject"
            declared_cids = [str(x).strip() for x in (info.get("course_ids") or []) if str(x).strip()]
            module_cids = {
                str(m.get("course_id") or "").strip()
                for m in modules
                if isinstance(m, dict) and str(m.get("course_id") or "").strip()
            }
            if len(declared_cids) > 1 and len(module_cids) <= 1:
                logger.warning(
                    "brainrush: subject has %s Mongo course id(s) but modules only reference %s",
                    len(declared_cids),
                    module_cids or "none",
                )
            _dbg_cids = {str(m.get("course_id") or "")[:24] for m in modules if isinstance(m, dict)}
            logger.info(
                "session_questions: modules_count=%s distinct_cids=%s sample_cids=%s",
                len(modules), len(_dbg_cids), sorted(_dbg_cids)[:10],
            )
            spec_need = max(num_questions + 32, num_questions * 2)
            specs = _topic_course_specs_from_modules(modules, spec_need, seed=session_seed)
            spec_idx = 0

            def _next_spec() -> dict[str, str]:
                nonlocal spec_idx
                if not specs:
                    return {"course_id": "", "topic": "general"}
                s = dict(specs[spec_idx % len(specs)])
                spec_idx += 1
                return s

            for i in range(num_questions):
                sp = _next_spec()
                topic = sp.get("topic") or "general"
                cid = sp.get("course_id") or (info.get("course_ids") or [None])[0]
                diff = difficulties[i]
                placed = False
                for attempt in range(3):
                    extra = "" if attempt == 0 else f"|d{attempt}"
                    if attempt > 0:
                        sp = _next_spec()
                        topic = sp.get("topic") or "general"
                        cid = sp.get("course_id") or (info.get("course_ids") or [None])[0]
                    try:
                        q = self._one_session_question(
                            title,
                            topic,
                            diff,
                            session_seed,
                            i,
                            course_id_hint=cid,
                            mixed_types=mixed_types,
                            index_in_set=i,
                            total=num_questions,
                            diversity_extra=extra,
                        )
                    except BrainRushGroundingError:
                        continue
                    norm = normalize_stem_for_dedup(str(q.get("question", "")))
                    if not any(stem_too_similar(norm, prev) for prev in seen_norms):
                        seen_norms.append(norm)
                        questions.append(q)
                        placed = True
                        break
                if not placed:
                    raise BrainRushGroundingError(
                        "Could not place a grounded BrainRush question for this slot after retries; "
                        "widen subject or re-embed materials."
                    )
        else:
            n_sub = len(subjects_payload)
            base = num_questions // n_sub
            rem = num_questions % n_sub
            diff_i = 0
            for j, info in enumerate(subjects_payload):
                count = base + (1 if j < rem else 0)
                modules = info.get("modules") or []
                title = info.get("title") or info.get("group_key") or "Subject"
                spec_need = max(count + 16, count * 2)
                specs = _topic_course_specs_from_modules(modules, spec_need, seed=f"{session_seed}|{j}")
                spec_idx = 0

                def _next_spec_ms() -> dict[str, str]:
                    nonlocal spec_idx
                    if not specs:
                        return {"course_id": "", "topic": "general"}
                    s = dict(specs[spec_idx % len(specs)])
                    spec_idx += 1
                    return s

                for k in range(count):
                    sp = _next_spec_ms()
                    topic = sp.get("topic") or "general"
                    cid = sp.get("course_id") or (info.get("course_ids") or [None])[0]
                    diff = difficulties[diff_i]
                    idx = len(questions)
                    placed = False
                    for attempt in range(3):
                        extra = "" if attempt == 0 else f"|d{attempt}"
                        if attempt > 0:
                            sp = _next_spec_ms()
                            topic = sp.get("topic") or "general"
                            cid = sp.get("course_id") or (info.get("course_ids") or [None])[0]
                        try:
                            q = self._one_session_question(
                                title,
                                topic,
                                diff,
                                session_seed,
                                idx,
                                course_id_hint=cid,
                                mixed_types=mixed_types,
                                index_in_set=idx,
                                total=num_questions,
                                diversity_extra=extra,
                            )
                        except BrainRushGroundingError:
                            continue
                        norm = normalize_stem_for_dedup(str(q.get("question", "")))
                        if not any(stem_too_similar(norm, prev) for prev in seen_norms):
                            seen_norms.append(norm)
                            questions.append(q)
                            placed = True
                            break
                    if not placed:
                        raise BrainRushGroundingError(
                            "Could not place a grounded BrainRush question for this slot after retries; "
                            "widen subject or re-embed materials."
                        )
                    diff_i += 1

        return questions

    def _one_session_question(
        self,
        subject_title: str,
        topic: str,
        difficulty: str,
        session_seed: str,
        question_index: int,
        *,
        course_id_hint: str | None,
        mixed_types: bool,
        index_in_set: int,
        total: int,
        diversity_extra: str = "",
    ) -> dict[str, Any]:
        div = f"{session_seed}:{question_index}{diversity_extra}"
        if not mixed_types:
            return self.generate_mcq(
                subject_title,
                difficulty,
                topic,
                diversity_seed=div,
                course_id_hint=course_id_hint,
                use_gamified=True,
            )
        # 70/30 MCQ/TF mix (DD disabled — 3b model can't reliably produce DD JSON)
        r = index_in_set % 10
        if r < 7:
            return self.generate_mcq(
                subject_title,
                difficulty,
                topic,
                diversity_seed=div,
                course_id_hint=course_id_hint,
                use_gamified=True,
            )
        return self.generate_true_false(
            subject_title,
            difficulty,
            topic,
            diversity_seed=div,
            course_id_hint=course_id_hint,
            use_gamified=True,
        )

    def generate_mixed_question_set(
        self,
        subject: str,
        difficulty: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Legacy mixed set: 60% MCQ, 30% TF, 10% DD. Uses gamified + level-test LLM.
        Topics from RAG. num_questions can be 5–50 for backward compatibility.
        """
        topics = self._get_relevant_topics(subject)
        n_mcq = max(1, int(num_questions * 0.6))
        n_tf = max(1, int(num_questions * 0.3))
        n_dd = max(0, num_questions - n_mcq - n_tf)
        questions: list[dict[str, Any]] = []
        idx = 0
        seed = str(uuid.uuid4())
        for _ in range(n_mcq):
            topic = topics[idx % len(topics)]
            questions.append(
                self.generate_mcq(subject, difficulty, topic, diversity_seed=f"{seed}-{idx}", use_gamified=True)
            )
            idx += 1
        for _ in range(n_tf):
            topic = topics[idx % len(topics)]
            questions.append(
                self.generate_true_false(subject, difficulty, topic, diversity_seed=f"{seed}-{idx}", use_gamified=True)
            )
            idx += 1
        for _ in range(n_dd):
            topic = topics[idx % len(topics)]
            questions.append(self.generate_drag_drop(subject, difficulty, topic))
            idx += 1
        random.shuffle(questions)
        return questions

    def _extract_and_validate_json(self, response: str, allow_correct_pairs: bool = False) -> dict:
        data = parse_json_value(response)
        if data is None:
            mn = (getattr(config, "OLLAMA_LEVEL_TEST_MODEL", "") or "").strip() or config.OLLAMA_MODEL
            data = repair_to_strict_json(response, model_name=mn)
        if isinstance(data, list):
            data = next((d for d in data if isinstance(d, dict) and d.get("question")), None)
        if not isinstance(data, dict):
            try:
                data = extract_json_from_response(response)
            except ValueError:
                raise ValueError("No valid JSON found in response")
        if "question" not in data:
            raise ValueError("Response missing required field: question")
        if "correct_answer" not in data and not (allow_correct_pairs and data.get("correct_pairs")):
            raise ValueError("Response missing required fields: question, correct_answer (or correct_pairs for Drag&Drop)")
        _KEY_MAP = {"q": "question", "o": "options", "a": "correct_answer", "d": "difficulty", "t": "topic", "e": "explanation"}
        for short, full in _KEY_MAP.items():
            if full not in data and short in data:
                data[full] = data.pop(short)
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
        return topics[:12]

    def _get_fallback_mcq(
        self,
        subject: str,
        topic: str,
        difficulty: str,
        *,
        course_id_hint: str | None = None,
    ) -> dict[str, Any]:
        query = f"{subject} {topic}".strip()
        ctx = ""
        cid = str(course_id_hint).strip() if course_id_hint else ""
        if cid:
            ctx = (self.rag_service.get_context_for_course_ids(query, [cid], max_chunks=8) or "").strip()
        if not ctx:
            ctx = (self.rag_service.get_context_for_query(query, max_chunks=8) or "").strip()
        base = _brainrush_fallback_mcq_from_rag(subject, topic, difficulty, ctx)
        return {
            **base,
            "points": self._calculate_points(difficulty),
            "time_limit": self._calculate_time_limit(difficulty, "MCQ"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }

    def _get_fallback_true_false(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        stem, ca = _brainrush_fallback_tf_stem(topic)
        return {
            "type": "TrueFalse",
            "question": stem[:BRAINRUSH_MAX_QUESTION_LEN],
            "options": ["Vrai", "Faux"],
            "correct_answer": ca,
            "explanation": "Réponse d'appoint : révisez le cours pour approfondir.",
            "difficulty": difficulty,
            "topic": topic,
            "points": self._calculate_points(difficulty),
            "time_limit": self._calculate_time_limit(difficulty, "TrueFalse"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }

    def _get_fallback_drag_drop(self, subject: str, topic: str, difficulty: str) -> dict[str, Any]:
        tshort = (topic or "ce thème")[:60]
        return {
            "type": "DragDrop",
            "question": f"Associez chaque libellé de gauche à la colonne de droite concernant « {tshort} » ({subject}).",
            "items": [f"Élément A : {tshort}", f"Élément B : notion clé", f"Élément C : exemple"],
            "matches": ["Colonne 1 — définition", "Colonne 2 — usage", "Colonne 3 — précaution"],
            "correct_pairs": {
                f"Élément A : {tshort}": "Colonne 1 — définition",
                f"Élément B : notion clé": "Colonne 2 — usage",
                f"Élément C : exemple": "Colonne 3 — précaution",
            },
            "explanation": "Révisez le cours pour des paires précises.",
            "difficulty": difficulty,
            "topic": topic,
            "points": self._calculate_points(difficulty) + 5,
            "time_limit": self._calculate_time_limit(difficulty, "DragDrop"),
            "validation_confidence": 0.0,
            "is_fallback": True,
        }


def generate_brainrush_session(
    generator: BrainRushQuestionGenerator,
    *,
    student_id: str,
    num_questions: int,
    difficulty_preference: str = "adaptive",
    subject_filter: list[str] | None = None,
    single_subject: str | None = None,
    mixed_question_types: bool = False,
    subjects_payload: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Build a full BrainRush session payload with diverse topics and gamified questions.
    Pass ``subjects_payload`` when resolved in the caller thread (avoids empty DB reads in worker pools).
    """
    if num_questions not in BRAINRUSH_ALLOWED_COUNTS:
        raise ValueError("num_questions must be 10, 15, or 20")

    session_seed = str(uuid.uuid4())
    subjects_payload = subjects_payload or resolve_brainrush_subjects(subject_filter, single_subject)
    if not subjects_payload:
        raise ValueError("No subjects found for BrainRush (check courses in MongoDB)")

    questions = generator.generate_brainrush_session_questions(
        num_questions=num_questions,
        difficulty_preference=difficulty_preference,
        session_seed=session_seed,
        subjects_payload=subjects_payload,
        mixed_types=mixed_question_types,
    )
    total_points = sum(int(q.get("points", 0)) for q in questions)
    estimated_time = calculate_estimated_time_seconds(questions)
    session_id = f"br_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
    subjects_covered = [s.get("title") or s.get("group_key") or "" for s in subjects_payload]

    return {
        "session_id": session_id,
        "student_id": student_id,
        "questions": questions,
        "total_questions": len(questions),
        "total_points": total_points,
        "estimated_time": estimated_time,
        "subjects_covered": subjects_covered,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_seed": session_seed,
    }


if __name__ == "__main__":
    gen = BrainRushQuestionGenerator()
    print("BrainRush generator loaded; run tests via pytest or test_brainrush_generation.py")