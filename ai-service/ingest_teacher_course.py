"""
Ingest teacher's "Programmation Procedurale 1" course folder into MongoDB + ChromaDB.

Parses the fiche module for chapter metadata, extracts course content from
PPTX/PDF files, parses quiz DOCX files into MCQ exercises, then:
  1. Clears existing courses, exercises, and ChromaDB collections
  2. Inserts 8 courses (one per chapter) with version-based modules
  3. Inserts all parsed MCQ exercises linked to their parent course
  4. Triggers the embedding pipeline for RAG

Usage:
    cd ai-service
    python ingest_teacher_course.py
"""
from __future__ import annotations

import glob
import io
import logging
import re
import sys
from pathlib import Path
from typing import Any

_SERVICE_ROOT = Path(__file__).resolve().parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from bson import ObjectId
from core import config

try:
    from pymongo import MongoClient
except ImportError:
    raise ImportError("pymongo is required")

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger("ingest")

TEACHER_ROOT = Path(r"C:\Users\MSI\Downloads\Support_Cours_Préparation")

# ── Chapter metadata extracted from fiche module ─────────────────────────
# folder_num -> (title, description/objectives)
CHAPTERS: dict[int, dict[str, str]] = {
    0: {
        "title": "Chapitre 0 : Chapitre introductif",
        "description": "Mémoriser des définitions relatives à l'algorithmique et à la programmation C.",
    },
    1: {
        "title": "Chapitre 1 : Lecture & Écriture des données",
        "description": (
            "Lister les étapes pour passer d'un code source à un exécutable. "
            "Décrire la structure d'un programme C. Utiliser les variables. "
            "Examiner la portée d'une variable. Pratiquer les fonctions d'entrées/sorties. "
            "Utiliser et ordonner les opérateurs arithmétiques et logiques."
        ),
    },
    2: {
        "title": "Chapitre 2 : Les structures conditionnelles",
        "description": (
            "Appliquer la structure if else. Appliquer la structure switch. "
            "Distinguer les structures conditionnelles (if, if else et switch) du langage C."
        ),
    },
    3: {
        "title": "Chapitre 3 : Les structures itératives",
        "description": (
            "Utiliser la boucle for. Utiliser la boucle do while. "
            "Utiliser la boucle while. Différencier les structures itératives."
        ),
    },
    4: {
        "title": "Chapitre 4 : Les tableaux unidimensionnels et bidimensionnels",
        "description": (
            "Définir un tableau. Pratiquer l'ajout, la suppression et le parcours. "
            "Appliquer la recherche séquentielle et dichotomique. Ordonner un tableau. "
            "Identifier les types de tableaux. Parcourir un tableau bidimensionnel."
        ),
    },
    5: {
        "title": "Chapitre 5 : Les chaînes de caractères",
        "description": (
            "Définir une chaîne de caractères. Pratiquer les fonctions de saisie et d'affichage. "
            "Utiliser les fonctions de la bibliothèque string.h. "
            "Pratiquer les tableaux de chaînes de caractères."
        ),
    },
    6: {
        "title": "Chapitre 6 : Les structures",
        "description": (
            "Définir une structure avec des champs simples, des champs de type tableau "
            "et des champs de type enregistrement. Utiliser une variable de type structure. "
            "Utiliser un tableau de structures."
        ),
    },
    7: {
        "title": "Chapitre 7 : Les pointeurs",
        "description": (
            "Définir un pointeur. Utiliser les pointeurs dans les prototypes des fonctions "
            "et dans les sous-programmes. Appliquer les pointeurs pour la manipulation des tableaux."
        ),
    },
    8: {
        "title": "Chapitre 8 : Les fonctions",
        "description": (
            "Définir une fonction, ses intérêts et ses caractéristiques. "
            "Représenter le prototype d'une fonction. Pratiquer l'appel des fonctions. "
            "Différencier les paramètres effectifs des paramètres formels. "
            "Distinguer les modes de passage des paramètres. "
            "Utiliser les tableaux dans des fonctions."
        ),
    },
}

# Version descriptions (X.Y -> short topic) from the fiche module
VERSION_TITLES: dict[str, str] = {
    "1.1": "Étapes pour passer d'un code source à un exécutable",
    "1.2": "Structure d'un programme C",
    "1.3": "Les variables",
    "1.4": "Portée d'une variable",
    "1.5": "Fonctions d'entrées / sorties",
    "1.6": "Opérateurs arithmétiques et logiques",
    "1.7": "Priorité des opérateurs",
    "2.1": "Structure if else",
    "2.2": "Structure switch",
    "2.3": "Distinction des structures conditionnelles",
    "3.1": "Boucle for",
    "3.2": "Boucle do while",
    "3.3": "Boucle while",
    "3.4": "Différenciation des structures itératives",
    "4.1": "Définition d'un tableau",
    "4.2": "Opération d'ajout",
    "4.3": "Opération de suppression",
    "4.4": "Opération de parcours",
    "4.5": "Recherche séquentielle",
    "4.6": "Tri d'un tableau",
    "4.7": "Recherche dichotomique",
    "4.8": "Types des tableaux",
    "4.9": "Parcours d'un tableau bidimensionnel",
    "5.1": "Définition d'une chaîne de caractères",
    "5.2": "Saisie et affichage d'une chaîne",
    "5.3": "Fonctions de string.h",
    "5.4": "Tableaux de chaînes de caractères",
    "5.5": "Manipulation avancée de chaînes",
    "5.6": "Opérations sur chaînes",
    "5.7": "Exercices pratiques sur les chaînes",
    "6.1": "Définition d'une structure",
    "6.2": "Variable de type structure",
    "6.3": "Tableau de structures",
    "7.1": "Définition d'un pointeur",
    "7.2": "Pointeurs et fonctions",
    "7.3": "Pointeurs et tableaux",
    "8.1": "Définition d'une fonction",
    "8.2": "Prototype d'une fonction",
    "8.3": "Appel de fonctions",
    "8.4": "Paramètres effectifs vs formels",
    "8.5": "Modes de passage des paramètres",
    "8.6": "Tableaux dans les fonctions",
}


# ── File content extractors ──────────────────────────────────────────────

def extract_pptx_text(path: Path) -> str:
    """Extract all text from a PPTX presentation."""
    from pptx import Presentation

    prs = Presentation(str(path))
    parts: list[str] = []
    for slide in list(prs.slides):
        slide_texts: list[str] = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    t = para.text.strip()
                    if t:
                        slide_texts.append(t)
        if slide_texts:
            parts.append("\n".join(slide_texts))
    return "\n\n".join(parts)


def extract_pdf_text(path: Path) -> str:
    """Extract text from a PDF file."""
    try:
        from pypdf import PdfReader
    except ImportError:
        import PyPDF2
        reader = PyPDF2.PdfReader(str(path))
        return "\n".join(page.extract_text() or "" for page in reader.pages)
    reader = PdfReader(str(path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_course_text(cours_dir: Path) -> str:
    """Extract text from the best available file in a Cours/ folder.
    Prefers PPTX (richer text), falls back to PDF."""
    pptx_files = list(cours_dir.glob("*.pptx"))
    pdf_files = list(cours_dir.glob("*.pdf"))

    texts: list[str] = []
    if pptx_files:
        for f in sorted(pptx_files):
            try:
                texts.append(extract_pptx_text(f))
            except Exception as e:
                log.warning("  PPTX extraction failed for %s: %s", f.name, e)
    elif pdf_files:
        for f in sorted(pdf_files):
            try:
                texts.append(extract_pdf_text(f))
            except Exception as e:
                log.warning("  PDF extraction failed for %s: %s", f.name, e)

    return "\n\n".join(t for t in texts if t.strip())


# ── Quiz DOCX parser ─────────────────────────────────────────────────────

_OPTION_LINE = re.compile(r"^\s*([A-Da-d])\s*[.)]\s*(.+)", re.DOTALL)
_INLINE_OPTIONS = re.compile(
    r"[Aa]\s*[.)]\s*(.+?)\s*[Bb]\s*[.)]\s*(.+?)\s*[Cc]\s*[.)]\s*(.+?)\s*[Dd]\s*[.)]\s*(.+)"
)
_CORRECT_MARKER = re.compile(
    r"(✅|bonne\s+r[ée]ponse|r[ée]ponse\s*:)\s*[:]?\s*([A-Da-d])\s*[.)]\s*(.+)",
    re.IGNORECASE,
)


def parse_quiz_docx(path: Path) -> list[dict[str, Any]]:
    """Parse a quiz DOCX into a list of MCQ dicts."""
    import docx

    doc = docx.Document(str(path))
    raw_lines = [p.text for p in doc.paragraphs]

    questions: list[dict[str, Any]] = []
    buf_question: list[str] = []
    buf_options: list[str] = []
    correct: str | None = None

    def _flush():
        nonlocal buf_question, buf_options, correct
        q_text = "\n".join(buf_question).strip()
        if not q_text or not buf_options:
            buf_question, buf_options, correct = [], [], None
            return
        q_text = re.sub(r"^(Question\s*:?\s*)", "", q_text, flags=re.IGNORECASE).strip()
        if not correct and buf_options:
            correct = buf_options[0]
        questions.append({
            "type": "MCQ",
            "content": q_text,
            "options": list(buf_options),
            "correctAnswer": correct or buf_options[0],
            "difficulty": "medium",
        })
        buf_question, buf_options, correct = [], [], None

    for line in raw_lines:
        line_stripped = line.strip()
        if not line_stripped:
            if buf_question and buf_options:
                _flush()
            continue

        cm = _CORRECT_MARKER.search(line_stripped)
        if cm:
            correct = f"{cm.group(2).upper()}. {cm.group(3).strip()}"
            if buf_question and buf_options:
                _flush()
            continue

        im = _INLINE_OPTIONS.search(line_stripped)
        if im:
            before_a = line_stripped[:im.start()].strip()
            if before_a:
                q_part = re.sub(r"^(Question\s*:?\s*)", "", before_a, flags=re.IGNORECASE).strip()
                if q_part:
                    buf_question.append(q_part)
            buf_options = [
                f"A. {im.group(1).strip()}",
                f"B. {im.group(2).strip()}",
                f"C. {im.group(3).strip()}",
                f"D. {im.group(4).strip()}",
            ]
            continue

        om = _OPTION_LINE.match(line_stripped)
        if om:
            buf_options.append(f"{om.group(1).upper()}. {om.group(2).strip()}")
            continue

        buf_question.append(line_stripped)

    if buf_question and buf_options:
        _flush()

    return questions


# ── Walk the teacher's folder ─────────────────────────────────────────────

def discover_versions(chapter_dir: Path) -> list[dict[str, Any]]:
    """Discover all X.Y version subfolders under a chapter directory."""
    versions: list[dict[str, Any]] = []
    for child in sorted(chapter_dir.iterdir()):
        if not child.is_dir():
            continue
        if not re.match(r"\d+\.\d+$", child.name):
            continue
        v: dict[str, Any] = {"version": child.name, "path": child, "text": "", "quizzes": []}

        cours_dir = None
        for candidate in ("Cours", "cours"):
            d = child / candidate
            if d.is_dir():
                cours_dir = d
                break
        if cours_dir:
            v["text"] = extract_course_text(cours_dir)

        quiz_dir = None
        for candidate in ("Quizz", "Quiz", "quizz", "quiz"):
            d = child / candidate
            if d.is_dir():
                quiz_dir = d
                break
        if quiz_dir:
            for qf in sorted(quiz_dir.glob("*.docx")):
                try:
                    v["quizzes"].extend(parse_quiz_docx(qf))
                except Exception as e:
                    log.warning("  Quiz parse error %s: %s", qf.name, e)

        versions.append(v)
    return versions


def discover_extra_quizzes(chapter_dir: Path) -> list[dict[str, Any]]:
    """Find quizzes in non-version subfolders (e.g. 'Appliquer Structures iteratives')."""
    extras: list[dict[str, Any]] = []
    for child in chapter_dir.iterdir():
        if not child.is_dir():
            continue
        if re.match(r"\d+\.\d+$", child.name):
            continue
        for qf in sorted(child.glob("*.docx")):
            if "quiz" in qf.stem.lower():
                try:
                    extras.extend(parse_quiz_docx(qf))
                except Exception as e:
                    log.warning("  Extra quiz parse error %s: %s", qf.name, e)
    return extras


# ── Main ingestion ────────────────────────────────────────────────────────

def run_ingest():
    log.info("=" * 60)
    log.info("  Teacher Course Ingestion")
    log.info("=" * 60)
    log.info("Source: %s", TEACHER_ROOT)

    if not TEACHER_ROOT.is_dir():
        log.error("Teacher folder not found: %s", TEACHER_ROOT)
        sys.exit(1)

    # ── Connect to MongoDB ────────────────────────────────────────────
    client = MongoClient(config.MONGODB_URI)
    db = client[config.MONGODB_DB_NAME]
    courses_coll = db["courses"]
    exercises_coll = db["exercises"]
    log.info("Connected to MongoDB: %s", config.MONGODB_DB_NAME)

    # ── Clear existing data ───────────────────────────────────────────
    del_c = courses_coll.delete_many({})
    del_e = exercises_coll.delete_many({})
    log.info("Cleared %d courses and %d exercises from MongoDB", del_c.deleted_count, del_e.deleted_count)

    try:
        from core.chroma_setup import delete_collection, get_or_create_collection
        for col_name in ("course_embeddings", "course_chunks"):
            try:
                delete_collection(col_name)
                log.info("Cleared ChromaDB collection: %s", col_name)
            except Exception:
                pass
    except Exception as e:
        log.warning("ChromaDB clear skipped: %s", e)

    # ── Process chapters 1-8 ──────────────────────────────────────────
    course_ids: list[str] = []
    total_exercises = 0

    for ch_num in range(1, 9):
        ch_dir = TEACHER_ROOT / str(ch_num)
        meta = CHAPTERS.get(ch_num, {
            "title": f"Chapitre {ch_num}",
            "description": "",
        })

        log.info("")
        log.info("─── %s ───", meta["title"])

        if not ch_dir.is_dir():
            log.warning("  Chapter folder %d not found, skipping", ch_num)
            continue

        versions = discover_versions(ch_dir)
        log.info("  Found %d versions", len(versions))

        modules: list[dict[str, str]] = []
        all_quizzes: list[dict[str, Any]] = []

        for v in versions:
            ver = v["version"]
            topic = VERSION_TITLES.get(ver, f"Section {ver}")
            title = f"{ver} - {topic}"
            text = v["text"]
            if text:
                log.info("  [%s] %d chars extracted", ver, len(text))
            else:
                log.info("  [%s] no course content", ver)

            modules.append({"title": title, "description": text})
            all_quizzes.extend(v["quizzes"])

        extra_q = discover_extra_quizzes(ch_dir)
        all_quizzes.extend(extra_q)
        if extra_q:
            log.info("  +%d extra quizzes from subfolders", len(extra_q))

        course_doc = {
            "title": meta["title"],
            "description": meta["description"],
            "modules": modules,
            "level": "Beginner",
            "subject": "Programmation Procédurale 1",
        }
        result = courses_coll.insert_one(course_doc)
        cid = str(result.inserted_id)
        course_ids.append(cid)
        log.info("  => Course inserted: %s (id=%s)", meta["title"], cid)

        for q in all_quizzes:
            q["courseId"] = ObjectId(cid)
            q["subject"] = "Programmation Procédurale 1"
            q["topic"] = meta["title"]
        if all_quizzes:
            exercises_coll.insert_many(all_quizzes)
            total_exercises += len(all_quizzes)
            log.info("  => %d exercises inserted", len(all_quizzes))
        else:
            log.info("  => 0 exercises (no quizzes found)")

    # ── Trigger embedding pipeline ────────────────────────────────────
    log.info("")
    log.info("=" * 60)
    log.info("  Embedding courses into ChromaDB")
    log.info("=" * 60)

    try:
        from embeddings.embeddings_pipeline_v2 import process_and_embed_course_chunks

        embedded = 0
        for cid in course_ids:
            ok, n_chunks = process_and_embed_course_chunks(cid)
            if ok:
                log.info("  Embedded course %s -> %d chunks", cid, n_chunks)
                embedded += 1
            else:
                log.warning("  Embedding failed for course %s", cid)
        log.info("Embedded %d / %d courses", embedded, len(course_ids))
    except Exception as e:
        log.warning("Embedding step skipped (Ollama may not be running): %s", e)
        log.info("You can embed later with: POST /embed-courses or POST /batch-embed-courses")

    # ── Summary ───────────────────────────────────────────────────────
    log.info("")
    log.info("=" * 60)
    log.info("  DONE")
    log.info("=" * 60)
    log.info("Courses inserted: %d", len(course_ids))
    for i, cid in enumerate(course_ids):
        ch = CHAPTERS.get(i + 1, {})
        log.info("  %d. %s  ->  %s", i + 1, ch.get("title", "?"), cid)
    log.info("Exercises inserted: %d", total_exercises)
    log.info("Course IDs: %s", course_ids)

    return {"course_ids": course_ids, "total_exercises": total_exercises}


if __name__ == "__main__":
    run_ingest()
