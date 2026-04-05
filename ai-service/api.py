"""
FastAPI application - AI service API for embeddings, search, RAG, and question generation.
"""
import json
import logging
import math
import re
import sys
import time
import unicodedata
import uuid
from datetime import datetime, timezone
import hashlib
from functools import partial
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

# Ensure ai-service root is on sys.path when running: python api.py
_SERVICE_ROOT = Path(__file__).resolve().parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from core import chroma_setup, config, db_connection
from core.rag_service import RAGService
from embeddings import embeddings_pipeline, embeddings_pipeline_v2
from embeddings.batch_embedding_processor import BatchEmbeddingProcessor
from embeddings.embedding_cache import EmbeddingCache
from embeddings.embedding_optimizer import EmbeddingOptimizer, estimate_embedding_time
from generation import question_generator
from generation.brainrush_errors import BrainRushGroundingError
from generation.brainrush_question_generator import (
    BrainRushQuestionGenerator,
    brainrush_session_question_ok,
    calculate_estimated_time_seconds,
    generate_brainrush_session,
    resolve_brainrush_subjects,
)
from rag import document_chunker
from rag.context_relevance_scorer import ContextRelevanceScorer
from rag.hallucination_guard import HallucinationGuard
from rag.rag_prompt_builder import RAGPromptBuilder
from search.metadata_filter import MetadataFilter
from search.multi_document_retriever import MultiDocumentRetriever
from generation.answer_evaluator import AnswerEvaluator
from generation.difficulty_classifier import DifficultyClassifier
from optimization.ai_feedback_loop import AIFeedbackLoop
from optimization.ai_monitor import AIPerformanceMonitor
from optimization.eval_benchmark_store import EvalBenchmarkStore
from optimization.intervention_effectiveness import InterventionEffectivenessTracker
from optimization.hybrid_response_cache import HybridResponseCache
from optimization.async_refresh import run_with_timeout, submit_refresh
from level_test.adaptive_engine import AdaptiveLevelTest
from level_test.scoring import compute_subject_mastery, generate_student_profile
from learning_state import StudentStateStore
from adaptive import AdaptivePolicyEngine, PacingEngine, InterventionEngine
from generation.tutor_response_builder import TutorResponseBuilder
from recommendation.continuous_recommender import ContinuousRecommender
from analytics.learning_analytics_service import LearningAnalyticsService
from quality.question_guardrails import QuestionGuardrails
from utils import langchain_ollama

try:
    import ollama
except ImportError:
    ollama = None

import uvicorn

logger = logging.getLogger("api")

# Max upload size (bytes) for document upload
MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx"}

app = FastAPI(
    title="StartSmart AI Service",
    description="API for course embeddings, semantic search, RAG, and AI question generation",
    version="1.0.0",
)

# RAG service singleton
rag_service = RAGService.get_instance()

# Sprint 4: BrainRush, prompt builder, hallucination guard
brainrush_generator = BrainRushQuestionGenerator()
prompt_builder = RAGPromptBuilder(rag_service)
hallucination_guard_instance = HallucinationGuard(rag_service)

# Sprint 5 singletons
optimizer = EmbeddingOptimizer()
batch_processor = BatchEmbeddingProcessor()
relevance_scorer = ContextRelevanceScorer()
multi_retriever = MultiDocumentRetriever()
metadata_filter = MetadataFilter()
embedding_cache = EmbeddingCache()

# Sprint 6 singletons
answer_evaluator = AnswerEvaluator()
difficulty_classifier = DifficultyClassifier()
ai_feedback_loop = AIFeedbackLoop()
ai_monitor = AIPerformanceMonitor()
eval_benchmark_store = EvalBenchmarkStore()
intervention_effectiveness_tracker = InterventionEffectivenessTracker()
response_cache = HybridResponseCache(cache_dir="./response_cache", max_entries=3000, ttl_seconds=3600)

# Sprint 7 singletons
adaptive_level_test = AdaptiveLevelTest()
student_state_store = StudentStateStore()
policy_engine = AdaptivePolicyEngine()
pacing_engine = PacingEngine()
intervention_engine = InterventionEngine()
tutor_response_builder = TutorResponseBuilder()
continuous_recommender = ContinuousRecommender()
learning_analytics_service = LearningAnalyticsService()
question_guardrails = QuestionGuardrails()

# Single LLM call + embedding search: local Ollama often needs >25s for long prompt + ~1500 output tokens.
CHAT_SOFT_BUDGET = 5.0
# Wall-clock for monitoring / logging only (do not use this as the LLM phase budget — see CHAT_LLM_HARD_BUDGET).
CHAT_HARD_BUDGET = 95.0
# Budget for the Ollama call ONLY (must NOT share the same t0 as embedding search, or retrieval eats all seconds).
CHAT_LLM_HARD_BUDGET = 120.0
# Max thread wait for one Ollama invoke.
CHAT_LLM_MAX_WAIT_SEC = 120.0
BRAINRUSH_SOFT_BUDGET = 2.5
BRAINRUSH_HARD_BUDGET = 5.0
# Full BrainRush session (10–20 LLM calls); separate from single-question budget.
# Sequential LLM calls (10–20 questions); local Ollama often needs >120s total.
BRAINRUSH_SESSION_BUDGET = 240.0
CACHE_SCHEMA_VERSION = "chat_v21_adaptive_tutor_format"

# CORS: allow all origins for development (NestJS backend can call this API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic models ---


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search text")
    n_results: int = Field(default=5, ge=1, le=50, description="Number of results to return")


class SearchResultItem(BaseModel):
    course_id: str
    title: str
    similarity: float
    content: str


class SearchResponse(BaseModel):
    status: str
    query: str
    results: list[SearchResultItem]


class CourseUploadRequest(BaseModel):
    course_id: str | None = Field(default=None, description="Optional course ID (MongoDB _id)")
    title: str = Field(..., description="Course title")
    description: str = Field(default="", description="Course description")
    modules: list = Field(default_factory=list, description="Course modules")
    level: str = Field(default="beginner", description="Course level")


class LevelTestRequest(BaseModel):
    subject: str = Field(..., description="Subject for the test")
    num_questions: int = Field(default=10, ge=1, le=50, description="Number of questions")
    difficulty: str = Field(default="medium", description="Overall difficulty (easy/medium/hard)")
    course_id: str = Field(default="level-test", description="Course ID to attach questions to")


class QuestionGenerateRequest(BaseModel):
    subject: str = Field(..., description="Subject")
    difficulty: str = Field(default="medium", description="Difficulty")
    topic: str = Field(default="general", description="Topic")


class DocumentUploadMetadata(BaseModel):
    """Optional metadata for document upload (JSON string or dict)."""
    doc_type: str = Field(default="general", description="course | exercise | general")
    course_id: str | None = Field(default=None, description="Optional course ID to attach chunks to")
    title: str | None = Field(default=None, description="Document title")
    chunk_size: int = Field(default=500, ge=100, le=2000, description="Chunk size for general text")
    chunk_overlap: int = Field(default=50, ge=0, le=500, description="Chunk overlap")


class ChunkedSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Search text")
    n_results: int = Field(default=10, ge=1, le=50, description="Number of results")
    aggregate_by_course: bool = Field(default=False, description="Group results by course")


class CourseContextRequest(BaseModel):
    """Optional body for course context (GET uses path param)."""
    max_chunks: int = Field(default=20, ge=1, le=100, description="Max chunks to include in context")


class RAGAnswerRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    max_chunks: int = Field(default=5, ge=1, le=20, description="Max chunks to use as context")


class RAGRecommendationsRequest(BaseModel):
    student_profile: dict = Field(default_factory=dict, description="Student profile with weak_areas/interests")
    n_results: int = Field(default=3, ge=1, le=10, description="Number of recommendations to return")


class BrainRushQuestionRequest(BaseModel):
    subject: str = Field(..., description="Subject area")
    difficulty: str = Field(default="medium", description="easy | medium | hard")
    topic: str = Field(default="general", description="Specific topic")
    question_type: str = Field(default="MCQ", description="MCQ | TrueFalse | DragDrop")
    student_id: str | None = Field(default=None, description="Optional student for adaptive difficulty")


class BrainRushSessionRequest(BaseModel):
    subject: str | None = Field(
        default=None,
        description="Optional single logical subject; omit to sample across all available course groups (multi-subject).",
    )
    difficulty: str = Field(
        default="medium",
        description="Base difficulty for adaptive policy when student_id is set (easy | medium | hard).",
    )
    difficulty_preference: str = Field(
        default="adaptive",
        description="Per-question difficulty: adaptive (curves for 10/15/20) or fixed easy | medium | hard.",
    )
    num_questions: int = Field(default=10, description="Must be exactly 10, 15, or 20.")
    student_id: str | None = Field(
        default=None,
        description="Optional; used for adaptive policy and analytics (recommended for multi-subject sessions).",
    )
    subject_filter: list[str] | None = Field(
        default=None,
        description="Optional course titles, subject names, or course ids to restrict which groups are included.",
    )
    mixed_question_types: bool = Field(
        default=False,
        description="If true, mix MCQ / TrueFalse / DragDrop (~60/30/10); if false, MCQ-only (faster).",
    )

    @field_validator("num_questions")
    @classmethod
    def _validate_brainrush_session_count(cls, v: int) -> int:
        if v not in (10, 15, 20):
            raise ValueError("num_questions must be 10, 15, or 20")
        return v

    @field_validator("difficulty_preference")
    @classmethod
    def _validate_difficulty_preference(cls, v: str) -> str:
        vv = (v or "adaptive").strip().lower()
        if vv not in ("adaptive", "easy", "medium", "hard"):
            raise ValueError("difficulty_preference must be adaptive, easy, medium, or hard")
        return vv


class ChatbotRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_history: list[dict[str, str]] = Field(default_factory=list, description="Previous messages")
    student_id: str | None = Field(default=None, description="Optional student for personalized tutoring style")
    mode: str | None = Field(default=None, description="Optional style override: explain_like_beginner | step_by_step | analogy_fun_mode | challenge_mode")


class DirectTutorRequest(BaseModel):
    """No RAG: single-turn tutor answer with structured sections (for testing or simple Q&A)."""

    prompt: str = Field(..., min_length=1, max_length=4000, description="User question only")
    max_tokens: int = Field(default=1500, ge=800, le=2048, description="Ollama num_predict (output cap)")


class ValidateAnswerRequest(BaseModel):
    question: str = Field(..., description="The question that was asked")
    student_answer: str = Field(..., description="Student's answer")
    correct_answer: str = Field(..., description="Correct answer")


# --- Sprint 5 Pydantic models ---


class BatchProcessRequest(BaseModel):
    course_ids: list[str] | None = Field(default=None, description="If None, process all courses from DB")
    use_optimization: bool = Field(default=True, description="Use batch/parallel optimizer; if False, sequential v2 embed")


class AdvancedSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="Search query")
    n_results: int = Field(default=10, ge=1, le=50)
    sources: list[str] | None = Field(
        default=None,
        description="Subset of: courses, exercises, documents",
    )
    filters: dict[str, Any] | None = Field(default=None, description="Metadata filter criteria (e.g. difficulty, course_id)")
    use_relevance_scoring: bool = Field(default=True, description="Apply ContextRelevanceScorer")


class CacheStatsRequest(BaseModel):
    action: str = Field(
        ...,
        description="One of: get_stats, clear, optimize",
    )


class FilteredSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    filters: dict[str, Any] = Field(default_factory=dict, description="Metadata criteria for metadata_filter.build_filter")
    n_results: int = Field(default=10, ge=1, le=50)


class MultiSourceRetrievalRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    n_results: int = Field(default=10, ge=1, le=50)
    sources: list[str] | None = Field(
        default=None,
        description="courses | exercises | documents (default all)",
    )


# --- Sprint 6 Pydantic models ---


class EvaluateAnswerRequest(BaseModel):
    question: dict = Field(..., description="Full question dict (question, options, correct_answer, ...)")
    student_answer: Any = Field(..., description="Student's answer (str, bool, or dict for DnD)")
    time_taken: float | None = Field(default=None, description="Seconds the student spent")


class BatchEvaluateRequest(BaseModel):
    submissions: list[dict] = Field(
        ...,
        description="List of {question: dict, student_answer: Any, time_taken: float|None}",
    )


class ClassifyDifficultyRequest(BaseModel):
    question: dict = Field(..., description="Full question dict to classify")


class BatchClassifyRequest(BaseModel):
    questions: list[dict] = Field(..., description="List of question dicts")


class RecordFeedbackRequest(BaseModel):
    signal_type: str = Field(..., description="question_quality | answer_accuracy | response_latency | user_rating | difficulty_mismatch | hallucination")
    value: float = Field(..., description="Numeric signal value")
    metadata: dict[str, Any] | None = Field(default=None, description="Extra context")


class UserRatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="1-5 star rating")
    context: str = Field(default="", description="What the rating is about")
    metadata: dict[str, Any] | None = Field(default=None)


# --- Sprint 7 Pydantic models ---


class LevelTestStartRequest(BaseModel):
    student_id: str = Field(..., description="Unique student identifier")
    subjects: list[str] | None = Field(
        default=None,
        description="Optional filter: course IDs and/or logical subject keys. Omit to test all.",
    )
    regenerate: bool = Field(
        default=False,
        description="If true, bypass in-memory cache and generate a fresh question pool.",
    )


class LevelTestSubmitRequest(BaseModel):
    session_id: str = Field(..., description="Active session ID")
    answer: str = Field(..., description="Student answer text")


class LevelTestCompleteRequest(BaseModel):
    session_id: str = Field(..., description="Session ID to finalise")


class PersonalizedRecommendationsRequest(BaseModel):
    student_profile: dict = Field(..., description="Profile from a completed level test")
    n_results: int = Field(default=5, ge=1, le=20, description="Number of recommendations")


class LearningEventRequest(BaseModel):
    student_id: str = Field(..., description="Unique student identifier")
    event_type: str = Field(..., description="quiz | exercise | chat | brainrush")
    score: float | None = Field(default=None, ge=0, le=100, description="Optional event score 0..100")
    duration_sec: int | None = Field(default=None, ge=0, le=86400, description="Optional study duration for event")
    metadata: dict[str, Any] | None = Field(default=None, description="Extra event context")


# --- Helpers: file content extraction ---


def _read_file_content(file: UploadFile, max_bytes: int = MAX_UPLOAD_BYTES) -> str:
    """Read and decode file content. Supports TXT; PDF/DOCX if libs available."""
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Max size: {max_bytes // (1024*1024)} MB")
    file.file.seek(0)

    suffix = (file.filename or "").lower()
    if suffix.endswith(".txt"):
        return content.decode("utf-8", errors="replace")
    if suffix.endswith(".pdf"):
        try:
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except ImportError:
            try:
                import PyPDF2
                import io
                reader = PyPDF2.PdfReader(io.BytesIO(content))
                return "\n".join(page.extract_text() or "" for page in reader.pages)
            except ImportError:
                raise HTTPException(
                    status_code=501,
                    detail="PDF support requires pypdf or PyPDF2. Install: pip install pypdf",
                )
    if suffix.endswith(".docx"):
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except ImportError:
            raise HTTPException(
                status_code=501,
                detail="DOCX support requires python-docx. Install: pip install python-docx",
            )
    raise HTTPException(status_code=400, detail="Unsupported file type. Use .txt, .pdf, or .docx")


def _sanitize_query(q: str, max_len: int = 2000) -> str:
    """Sanitize search query: strip and limit length."""
    if not q or not isinstance(q, str):
        return ""
    return re.sub(r"\s+", " ", q.strip())[:max_len]


def _state_hash(state: dict[str, Any] | None) -> str:
    """Coarse hash of learner state fields relevant to adaptation."""
    if not state:
        return "none"
    payload = {
        "pace_mode": state.get("pace_mode"),
        "confidence_score": round(float(state.get("confidence_score", 0.0)), 2),
        "recent_scores": list(state.get("recent_scores", []))[-5:],
    }
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _cache_key(endpoint: str, payload: dict[str, Any]) -> str:
    return response_cache.make_key({"endpoint": endpoint, **payload})


def _token_count(text: str) -> int:
    import re
    return len(re.findall(r"\b[\w-]+\b", text or ""))


def _is_followup_message(text: str) -> bool:
    q = (text or "").strip().lower()
    followups = {
        "pas a pas", "pas à pas", "explique pas a pas", "explique pas à pas",
        "continue", "plus", "encore", "detaille", "détaille", "exemple",
        "more", "go on", "step by step", "explain step by step",
    }
    if q in followups:
        return True
    return _token_count(q) <= 5


def _effective_question(question: str, history: list[dict[str, str]] | None) -> str:
    """
    Keep topic continuity for short follow-up prompts like:
    'pas a pas', 'continue', 'more details'.
    """
    q = (question or "").strip()
    if not _is_followup_message(q):
        return q
    hist = history or []
    prev_user = ""
    for msg in reversed(hist):
        role = str(msg.get("role", "")).lower()
        content = str(msg.get("content", "")).strip()
        if role == "user" and content and content != q:
            prev_user = content
            break
    if not prev_user:
        return q
    return f"{prev_user}\nInstruction de suivi: {q}"


def _format_conversation_history_for_prompt(
    history: list[dict[str, str]] | None,
    *,
    max_messages: int = 10,
    max_chars_per_msg: int = 900,
    max_total_chars: int = 4500,
) -> str:
    """Recent turns for the tutor prompt (pronouns + topic continuity)."""
    if not history:
        return ""
    lines: list[str] = []
    total = 0
    tail = history[-max_messages:]
    for m in tail:
        role = str(m.get("role", "")).lower()
        content = str(m.get("content", "")).strip()
        if not content:
            continue
        if len(content) > max_chars_per_msg:
            content = content[:max_chars_per_msg] + "…"
        if role == "user":
            label = "Etudiant"
        elif role in ("assistant", "ai", "tutor"):
            label = "Tuteur"
        else:
            label = role.capitalize() or "Message"
        block = f"{label}: {content}"
        total += len(block)
        if total > max_total_chars:
            break
        lines.append(block)
    return "\n\n".join(lines)


def _should_merge_retrieval_with_previous(question: str) -> bool:
    """
    True when the current message likely continues the previous topic (follow-up).
    Used to widen embedding search with the prior user message.
    """
    q = (question or "").strip().lower()
    if len(q) < 6:
        return True
    follow_markers = (
        "maintenant",
        "ensuite",
        "toujours",
        "donc",
        "aussi",
        "et apres",
        "et après",
        "comment les",
        "pourquoi les",
        "comment l'",
        "les utiliser",
        "utiliser dans",
        "dans une fonction",
        "dans un programme",
        "comme avant",
        "plus de details",
        "plus de détails",
        "autre exemple",
        "encore un",
    )
    if any(m in q for m in follow_markers):
        return True
    # Do not block merge on "tableau" / "array" — follow-ups like "dans un tableau" often continue
    # the same topic (e.g. tableau de structures), not a new subject.
    topic_words = (
        "pointeur",
        "pointer",
        "boucle",
        "loop",
        "chaine",
        "chaîne",
        "string",
        "fichier",
        "file",
        "malloc",
        "preprocesseur",
        "#include",
    )
    if any(w in q for w in topic_words):
        return False
    if re.search(r"\bstruct\b", q):
        return False
    if " les " in f" {q} " or q.startswith("les "):
        return True
    return False


def _trim_history_exclude_current_turn(
    history: list[dict[str, str]] | None,
    current_question: str,
) -> list[dict[str, str]]:
    """
    Backend may append the current user message to history; drop it so we do not duplicate
    the question in CONVERSATION + USER MESSAGE, and so retrieval 'previous' is the prior turn.
    """
    if not history:
        return []
    cur = (current_question or "").strip()
    if not cur:
        return list(history)
    last = history[-1]
    if str(last.get("role", "")).lower() == "user" and str(last.get("content", "")).strip() == cur:
        return history[:-1]
    return list(history)


def _retrieval_query_for_chat(question: str, history: list[dict[str, str]] | None) -> str:
    """RAG query: merge previous user message when follow-up refers to the same topic."""
    q = (question or "").strip()
    hist = history or []
    prev_users = [
        str(m.get("content", "")).strip()
        for m in hist
        if str(m.get("role", "")).lower() == "user" and str(m.get("content", "")).strip()
    ]
    if not prev_users or not _should_merge_retrieval_with_previous(q):
        return q
    prev = prev_users[-1]
    merged = f"{prev} {q}"
    return merged[:800]


def _conversation_text_for_signals(history: list[dict[str, str]] | None) -> str:
    """Recent user+assistant text for retrieval alignment (not shown to the model)."""
    parts: list[str] = []
    for m in (history or [])[-8:]:
        parts.append(str(m.get("content", "")))
    return " ".join(parts).lower()


_RAG_STOPWORDS = frozenset(
    """
    the and for are but not you all can her was one our out day get has him his how its may new now old
    see two who way use any from this that with have this will just than then them they what when your
    more most some such time very also back been call came come each even ever here just like long
    made make many much must only over part same seem show such take than that their them these they
    thing think those though three through under until very want well were what when where which while
    whom whose would about after again against
    le la les des un une dans pour avec sans sous entre chez est pas que qui dont sur son ses leur
    cette comme aussi plus tout tres etre etre et ou si ne ai a ce ca ces cet cette celui celle
    mais meme deja tres bien alors ainsi donc voici ainsi
    chapitre section partie version cours module lecon numero introduction
    """.split()
)

# Tokens in syllabus/module labels — ignored when measuring "extra" words in a title vs. a short query.
_RAG_MODULE_BOILERPLATE = frozenset(
    """
    chapitre section partie version cours module lecon numero introduction
    """.split()
)


def _tokenize_rag_overlap(text: str) -> set[str]:
    """Lowercase tokens (accent-folded) for generic lexical overlap; drops very common words."""
    raw = _fold_accents((text or "").lower())
    words = re.findall(r"[a-zà-ÿ]{3,}", raw, flags=re.IGNORECASE)
    out: set[str] = set()
    for w in words:
        wl = w.lower()
        if wl in _RAG_STOPWORDS:
            continue
        out.add(wl)
    return out


def _rag_token_set_matches_term(toks: set[str], term: str) -> bool:
    """Match query token to chunk/title tokens; simple French plural overlap (structure ↔ structures)."""
    if term in toks:
        return True
    if len(term) >= 5 and term.endswith("s") and term[:-1] in toks:
        return True
    if len(term) >= 4 and (term + "s") in toks:
        return True
    return False


def _strip_noise_for_retrieval_snippet(text: str) -> str:
    """Remove fenced code blocks from prior tutor answer so keywords still matter for embedding."""
    t = re.sub(r"```[\s\S]*?```", " ", text or "")
    t = re.sub(r"\s+", " ", t).strip()
    return t[:520]


def _augment_retrieval_query_from_history(
    base: str,
    history: list[dict[str, str]] | None,
) -> str:
    """
    Append a snippet of the last assistant message so the embedding query reflects the *ongoing*
    lesson topic (works for any subject — pointers, files, structs, etc.).
    """
    b = (base or "").strip()
    if not history:
        return b[:900]
    last_asst = ""
    for m in reversed(history):
        if str(m.get("role", "")).lower() in ("assistant", "ai", "tutor"):
            last_asst = str(m.get("content") or "").strip()
            break
    if len(last_asst) < 40:
        return b[:900]
    snippet = _strip_noise_for_retrieval_snippet(last_asst)
    if len(snippet) < 25:
        return b[:900]
    merged = f"{b} {snippet}".strip()
    return merged[:900]


def _local_idf_weights_for_candidates(
    chunks: list[dict[str, Any]], qset: set[str]
) -> dict[str, float]:
    """IDF over the current candidate set only — down-weights terms that appear in many chunks."""
    n = len(chunks)
    df: dict[str, int] = {t: 0 for t in qset}
    for c in chunks:
        meta = c.get("metadata") or {}
        blob = " ".join(
            [
                str(c.get("chunk_text") or ""),
                str(meta.get("module_name") or ""),
                str(meta.get("course_title") or ""),
            ]
        )
        toks = _tokenize_rag_overlap(blob)
        for t in qset:
            if t in toks:
                df[t] += 1
    return {t: math.log((n + 1.0) / (df[t] + 0.5)) for t in qset}


def _rerank_chunks_by_lexical_alignment(
    chunks: list[dict[str, Any]],
    alignment_text: str,
) -> list[dict[str, Any]]:
    """
    Re-score chunks using local IDF (within the retrieved set) and stronger weight on chunk body
    than on module titles. For short queries, penalize module/course titles that add extra topic
    words beyond the question (e.g. \"structures iteratives\" vs \"structures\" only) so the
    narrowest-matching chapter wins. Plural/singular overlap is handled for French.
    """
    if not chunks or not (alignment_text or "").strip():
        return chunks
    qset = _tokenize_rag_overlap(alignment_text)
    if not qset:
        return chunks

    idf = _local_idf_weights_for_candidates(chunks, qset)
    denom = sum(idf[t] * 0.65 for t in qset) or 1.0
    short_query = len(qset) <= 6
    title_surplus_query = len(qset) <= 4

    def blended_score(c: dict[str, Any]) -> float:
        meta = c.get("metadata") or {}
        body = _tokenize_rag_overlap(str(c.get("chunk_text") or ""))
        mod = _tokenize_rag_overlap(
            " ".join(
                [
                    str(meta.get("module_name") or ""),
                    str(meta.get("course_title") or ""),
                ]
            )
        )
        bonus = 0.0
        for t in qset:
            w = idf.get(t, 0.0)
            if _rag_token_set_matches_term(body, t):
                bonus += w * 0.65
            elif _rag_token_set_matches_term(mod, t):
                bonus += w * 0.22
        norm_bonus = bonus / denom
        if title_surplus_query:
            # Prefer titles that are not a strict superset of the query terms (fewer extra topic words).
            extra_topic = mod - qset - _RAG_MODULE_BOILERPLATE
            extra_disc = {t for t in extra_topic if len(t) >= 5}
            norm_bonus -= 0.075 * min(len(extra_disc), 10)
        norm_bonus = max(0.0, norm_bonus)
        base = float(c.get("similarity") or 0.0)
        return base + 0.48 * norm_bonus

    return sorted((dict(x) for x in chunks), key=blended_score, reverse=True)


def _module_title_surplus_count(chunk: dict[str, Any], qset: set[str]) -> int:
    """Count discriminative tokens in module/course title not present in the query overlap set."""
    meta = chunk.get("metadata") or {}
    mod = _tokenize_rag_overlap(
        " ".join(
            [
                str(meta.get("module_name") or ""),
                str(meta.get("course_title") or ""),
            ]
        )
    )
    extra_topic = mod - qset - _RAG_MODULE_BOILERPLATE
    extra_disc = {t for t in extra_topic if len(t) >= 5}
    return len(extra_disc)


def _filter_chunks_by_minimal_title_surplus(
    chunks: list[dict[str, Any]],
    alignment_text: str,
) -> list[dict[str, Any]]:
    """
    For short queries (<=4 content tokens), keep only chunks whose module titles add the fewest
    extra topic words versus the question — narrowest chapter-title match. If that leaves fewer
    than two chunks, merge in the next surplus tier so the pipeline still has context.
    """
    if not chunks:
        return chunks
    qset = _tokenize_rag_overlap(alignment_text or "")
    if len(qset) > 4:
        return chunks

    def surplus(c: dict[str, Any]) -> int:
        return _module_title_surplus_count(c, qset)

    sur_values = [surplus(c) for c in chunks]
    m = min(sur_values)
    out: list[dict[str, Any]] = [dict(c) for c in chunks if surplus(c) == m]
    if len(out) >= 2:
        return out
    # Fewer than two at min tier: add next tier(s) in original order until at least two or exhausted.
    tiers_sorted = sorted(set(sur_values))
    for tier in tiers_sorted:
        if tier <= m:
            continue
        for c in chunks:
            if surplus(c) != tier:
                continue
            out.append(dict(c))
            if len(out) >= 2:
                return out
    return out if out else [dict(x) for x in chunks]


def _clean_extracted_sentence(text: str) -> str:
    s = str(text or "").replace("\n", " ").strip()
    s = re.sub(r"\s+", " ", s)
    # Remove noisy chapter headers / numbering from raw chunks.
    s = re.sub(r"\bchapitre\s*\d+\s*[:\-]?\s*", "", s, flags=re.IGNORECASE)
    s = re.sub(r"^\s*[\d\-\)\(•\.:]+\s*", "", s)
    s = re.sub(r"\s{2,}", " ", s).strip(" -:;,.")
    return s


def _context_similarity(answer: str, context: str) -> float:
    a = re.sub(r"\s+", " ", (answer or "").strip().lower())
    c = re.sub(r"\s+", " ", (context or "").strip().lower())
    if not a or not c:
        return 0.0
    # Keep bounded size for latency.
    return SequenceMatcher(None, a[:1800], c[:2200]).ratio()


def _sections_complete(text: str) -> bool:
    """True if all four emoji sections exist and each has substantive body text."""
    t = (text or "").strip()
    if not t:
        return False
    parts = [p for p in re.split(r"(?=📘|🧠|✅|🎯)", t) if p.strip()]
    found = [p for p in parts if p.strip() and p.strip()[0] in "📘🧠✅🎯"]
    if len(found) < 4:
        return False
    kinds: set[str] = set()
    for p in found:
        em = p.strip()
        if em.startswith("📘"):
            kinds.add("c")
        elif em.startswith("🧠"):
            kinds.add("e")
        elif em.startswith("✅"):
            kinds.add("x")
        elif em.startswith("🎯"):
            kinds.add("m")
        else:
            continue
        lines = p.strip().splitlines()
        if len(lines) < 2:
            return False
        body = "\n".join(lines[1:]).strip()
        if len(re.sub(r"\s+", "", body)) < 12:
            return False
    return kinds == {"c", "e", "x", "m"}


def _has_placeholder_ellipsis(text: str) -> bool:
    """True if prose contains ellipsis used as filler (outside typical code string literals)."""
    t = text or ""
    if "..." not in t and "…" not in t:
        return False
    prose = re.sub(r"```[\s\S]*?```", "", t)
    if "..." not in prose and "…" not in prose:
        return False
    # Strip quoted strings that often contain format dots
    prose2 = re.sub(r'"[^"]*"', "", prose)
    prose2 = re.sub(r"'[^']*'", "", prose2)
    if "..." in prose2 or "…" in prose2:
        return True
    return False


def _strip_fenced_code_blocks(text: str) -> str:
    return re.sub(r"```[\s\S]*?```", "", text or "")


def _slice_between_markers(text: str, start_marker: str, end_marker: str | None) -> str:
    """Extract body after start_marker up to end_marker (exclusive). If end_marker is None, use rest of text."""
    t = text or ""
    i = t.find(start_marker)
    if i < 0:
        return ""
    start_i = i + len(start_marker)
    if end_marker:
        j = t.find(end_marker, start_i)
        chunk = t[start_i:j] if j >= 0 else t[start_i:]
    else:
        chunk = t[start_i:]
    lines = chunk.splitlines()
    while lines and not lines[0].strip():
        lines = lines[1:]
    if lines and re.match(r"^\s*(Explanation|Example|Mini exercise)\s*:?\s*$", lines[0], re.I):
        lines = lines[1:]
    return "\n".join(lines).strip()


def _explanation_meets_depth(text: str) -> bool:
    body = _slice_between_markers(text, "🧠", "✅")
    body = _strip_fenced_code_blocks(body)
    if len(body.strip()) < 40:
        return False
    parts = [p.strip() for p in re.split(r"(?<=[.!?])\s+", body) if len(p.strip()) > 12]
    if len(parts) >= 3:
        return True
    lines = [ln.strip() for ln in body.splitlines() if ln.strip() and not ln.strip().startswith("#")]
    substantial = [ln for ln in lines if len(re.sub(r"^[-*•]\s*", "", ln)) > 12]
    return len(substantial) >= 3


def _example_meets_depth(text: str) -> bool:
    body = _slice_between_markers(text, "✅", "🎯")
    if len(body.strip()) < 20:
        return False
    full = text or ""
    if "```" in full:
        return True
    return bool(re.search(r"[{;}]|#include|def\s+\w+|int\s+\w+|for\s*\(|while\s*\(|printf|print\(", body))


def _exercise_meets_depth(text: str) -> bool:
    body = _slice_between_markers(text, "🎯", None)
    return bool(body.strip()) and ("?" in body or "？" in body)


def _tutor_pedagogical_depth_ok(text: str) -> bool:
    """At least 3 explanation units, real code in Example, question mark in Mini exercise."""
    t = text or ""
    if not all(x in t for x in ("📘", "🧠", "✅", "🎯")):
        return False
    return (
        _explanation_meets_depth(t)
        and _example_meets_depth(t)
        and _exercise_meets_depth(t)
    )


def _anti_copy_violation(answer: str, cleaned_source: str, summary: str) -> bool:
    """True if the answer is too close to cleaned raw source or to Stage A summary (not expanded)."""
    a = (answer or "").strip()
    if not a:
        return False
    if cleaned_source and _context_similarity(a, cleaned_source) >= 0.74:
        return True
    if summary and len(summary.strip()) > 40 and _context_similarity(a, summary) >= 0.85:
        return True
    return False


def _is_low_quality_answer(
    answer: str, question: str, cleaned_source: str = "", summary: str = ""
) -> bool:
    a = (answer or "").strip()
    if not a:
        return True
    low = a.lower()
    # Unwanted template traces.
    forbidden_markers = [
        "reponse directe:",
        "explication pas a pas:",
        "step-by-step:",
        "common mistakes:",
        "d'apres les chapitres du cours",
        "from the course sources",
    ]
    if any(m in low for m in forbidden_markers):
        return True
    if cleaned_source:
        if summary:
            if _anti_copy_violation(a, cleaned_source, summary):
                return True
        elif _context_similarity(a, cleaned_source) >= 0.78:
            return True
    if not _sections_complete(a):
        return True
    if _has_placeholder_ellipsis(a):
        return True
    # If user asked step-by-step, we require at least a few list lines.
    q = (question or "").lower()
    asks_steps = ("pas a pas" in q) or ("pas à pas" in q) or ("step by step" in q)
    if asks_steps and len(re.findall(r"(?m)^\s*[-*]\s+", a)) < 3:
        return True
    if _has_instruction_leakage(a):
        return True
    return False


def _detect_language(question: str, history: list[dict[str, str]] | None = None) -> str:
    """Heuristic language detector focused on FR/EN tutoring chats."""
    text = " ".join(
        [
            str(question or ""),
            " ".join(str(m.get("content", "")) for m in (history or [])[-3:] if str(m.get("role", "")).lower() == "user"),
        ]
    ).lower()
    fr_hits = [
        " je ", " j'", " pas ", " avec ", " pour ", " pourquoi ", " comment ", " explique",
        " début", " debut", "pointeur", "tableau", "fonction", "donner", "plus claire",
    ]
    en_hits = [
        " the ", " and ", " with ", " why ", " how ", " explain ", "beginner", "pointer",
        "step by step", "clear answer",
    ]
    fr_score = sum(1 for t in fr_hits if t in f" {text} ")
    en_score = sum(1 for t in en_hits if t in f" {text} ")
    return "fr" if fr_score >= en_score else "en"


def _is_clarification_request(question: str) -> bool:
    q = (question or "").lower()
    markers = [
        "j'ai pas compris", "jai pas compris", "pas compris", "explique autrement",
        "plus clair", "plus claire", "reexplique", "réexplique", "simplifie",
        "i didn't understand", "did not understand", "explain differently", "simpler",
    ]
    return any(m in q for m in markers)


def _has_instruction_leakage(text: str) -> bool:
    """True if the model answered with meta-instructions instead of teaching content."""
    if not (text or "").strip():
        return False
    low = (text or "").lower()
    bad_substrings = [
        "explain this",
        "write an example",
        "write this",
        "explain the following",
    ]
    if any(s in low for s in bad_substrings):
        return True
    for raw_line in (text or "").splitlines():
        line = raw_line.strip().lower()
        if line.startswith("explique ") or line.startswith("écris ") or line.startswith("ecris "):
            return True
        if line.startswith("donne ") or line.startswith("donne-moi"):
            return True
        if line.startswith("write ") and not line.startswith("printf"):
            return True
    return False


def _classify_user_intent(question: str) -> str:
    q = (question or "").lower()
    if any(k in q for k in ["quiz", "qcm", "question", "exercise", "exercice", "test me"]):
        return "quiz"
    if any(k in q for k in ["bug", "error", "erreur", "debug", "fix", "corriger"]):
        return "debugging"
    if any(k in q for k in ["example", "exemple", "montre", "show me", "sample"]):
        return "example"
    # Use scorer heuristic for remaining.
    try:
        info = relevance_scorer.detect_query_intent(question)
        t = str(info.get("intent_type", "general"))
        if t == "example":
            return "example"
    except Exception:
        pass
    return "explanation"


def _format_context_chunks_for_prompt(chunks: list[dict[str, Any]]) -> str:
    """Label chunks for the CONTEXT block without mixing with instructions."""
    parts: list[str] = []
    for i, c in enumerate(chunks[:5], start=1):
        t = str(c.get("chunk_text") or "").strip()
        if not t:
            continue
        parts.append(f"[chunk{i}]\n{t[:900]}")
    return "\n\n".join(parts)


def _few_shot_teacher_example(lang: str) -> str:
    if lang == "fr":
        return """EXAMPLE (reference style only — answer the USER MESSAGE below, not this example):

User: Explique les boucles for et while

Assistant:
📘 Concept:
Les boucles permettent de répéter un bloc de code.

🧠 Explanation:
La boucle while exécute un bloc tant qu'une condition est vraie.
La boucle for est utilisée quand on connaît le nombre d'itérations.

✅ Example:
int i = 0;
while (i < 3) {
  printf("%d", i);
  i++;
}

for (int j = 0; j < 3; j++) {
  printf("%d", j);
}

🎯 Mini exercise:
Quelle est la différence principale entre for et while ?
"""
    return """EXAMPLE (reference style only — answer the USER MESSAGE below, not this example):

User: Explain for and while loops

Assistant:
📘 Concept:
Loops repeat a block of code until a condition is met or for a fixed count.

🧠 Explanation:
A while loop runs while its condition stays true.
A for loop is often used when you know how many iterations you need.

✅ Example:
int i = 0;
while (i < 3) {
  printf("%d", i);
  i++;
}

for (int j = 0; j < 3; j++) {
  printf("%d", j);
}

🎯 Mini exercise:
When would you choose while instead of for?
"""


def _system_grounding_safety() -> str:
    return (
        "GROUNDING (still part of SYSTEM rules):\n"
        "1. Base your answer primarily on the CONTEXT block below.\n"
        "2. Do NOT invent facts, formulas, or code not supported by CONTEXT.\n"
        "3. You MAY rephrase, summarize, and explain in your own words.\n"
        "4. If CONTEXT is insufficient, say so briefly, then help with what is available.\n"
    )


def _select_diverse_chunks(query: str, chunks: list[dict[str, Any]], n_max: int = 5) -> list[dict[str, Any]]:
    if not chunks:
        return []
    ranked = relevance_scorer.rank_chunks_by_relevance(query, chunks, use_intent=True) or chunks
    selected: list[dict[str, Any]] = []

    def _signature(c: dict[str, Any]) -> str:
        meta = c.get("metadata") or {}
        return f"{meta.get('course_title','')}|{meta.get('module_name','')}|{c.get('course_id','')}"

    def _overlap(a: str, b: str) -> float:
        ta = set(re.findall(r"\b[\w-]{4,}\b", (a or "").lower()))
        tb = set(re.findall(r"\b[\w-]{4,}\b", (b or "").lower()))
        if not ta or not tb:
            return 0.0
        return len(ta & tb) / max(len(ta | tb), 1)

    seen_sig: set[str] = set()
    for c in ranked:
        if len(selected) >= n_max:
            break
        text = str(c.get("chunk_text") or "")
        sig = _signature(c)
        if sig in seen_sig:
            continue
        if any(_overlap(text, str(s.get("chunk_text") or "")) > 0.62 for s in selected):
            continue
        selected.append(c)
        seen_sig.add(sig)

    if len(selected) < 3:
        for c in ranked:
            if len(selected) >= min(3, len(ranked)):
                break
            if c not in selected:
                selected.append(c)
    return selected[:n_max]


def _fold_accents(s: str) -> str:
    """Lowercase ASCII fold for French keyword matching (e.g. chaînes → chaines)."""
    if not s:
        return ""
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    ).lower()


def _llm_failure_plain_message(lang: str) -> str:
    """No fake Concept/Example templates — honest short message when the LLM path fails."""
    if lang == "fr":
        return (
            "Je n'ai pas pu generer une reponse complete a temps avec le modele local. "
            "Reessaie dans quelques secondes. Si le probleme continue, formule une seule question courte et precise.\n\n"
            "Exemple: « Comment declarer et lire une chaine de caracteres en C ? »"
        )
    return (
        "The tutor model could not finish a full answer in time. Please try again in a few seconds, "
        "or ask one shorter, specific question."
    )


def _is_llm_failure_plain_response(text: str) -> bool:
    """True for the deterministic timeout message — must not be wrapped in tutor section headers."""
    t = (text or "").strip()
    if not t:
        return False
    return (
        "Je n'ai pas pu generer une reponse complete a temps avec le modele local." in t
        or "The tutor model could not finish a full answer in time." in t
    )


def _select_tutor_chunks(query: str, chunks: list[dict[str, Any]], n_max: int = 5) -> list[dict[str, Any]]:
    """
    Group chunks from the same course as the top-ranked hit first, then dedupe by text.
    Chunks are ordered by embedding + _rerank_chunks_by_lexical_alignment; the first item sets
    the primary chapter so Concept/Explanation/Example stay coherent in the LLM.
    """
    if not chunks:
        return []
    primary = _course_key(chunks[0])
    same_course = [c for c in chunks if _course_key(c) == primary]
    rest = [c for c in chunks if _course_key(c) != primary]
    ordered = same_course + rest
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for c in ordered:
        if len(out) >= n_max:
            break
        t = str(c.get("chunk_text") or "").strip()
        sig = _normalize_sentence_key(t[:500])
        if sig in seen:
            continue
        seen.add(sig)
        out.append(c)
    return out


def _normalize_sentence_key(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())[:220]


def _course_key(chunk: dict[str, Any]) -> str:
    """Stable key so chunks from the same course stay grouped in the tutor context."""
    cid = str(chunk.get("course_id") or "").strip()
    if cid:
        return f"id:{cid}"
    meta = chunk.get("metadata") or {}
    ct = str(meta.get("course_title") or "").strip()
    mn = str(meta.get("module_name") or "").strip()
    return f"t:{ct}|m:{mn[:160]}"


def _chunks_for_sources_display(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Chunks shown as Sources in the API: only the same course as [Source 1] (top-ranked
    after rerank), so unrelated chapters do not appear when the answer was grounded on one chapter.
    """
    if not chunks:
        return []
    primary = _course_key(chunks[0])
    out = [c for c in chunks if _course_key(c) == primary]
    return out if out else [chunks[0]]


def _format_labeled_course_context(chunks: list[dict[str, Any]]) -> str:
    """Build CONTEXT with [Source n] labels so the model anchors all sections on the same excerpt."""
    parts: list[str] = []
    for i, c in enumerate(chunks[:5], start=1):
        meta = c.get("metadata") or {}
        title = str(meta.get("course_title") or "").strip() or "Cours"
        mod = str(meta.get("module_name") or "").strip() or "Module"
        body = str(c.get("chunk_text") or "").strip()
        if not body:
            continue
        parts.append(f"[Source {i}] {title} — {mod}\n{body}")
    return "\n\n".join(parts)


def _clean_course_chunk_text(text: str) -> str:
    """Dedupe sentences, drop noisy lines, trim fragments before Stage A."""
    raw = str(text or "").replace("\r", "\n")
    pieces = re.split(r"(?<=[.!?])\s+|\n+", raw)
    seen: set[str] = set()
    out: list[str] = []
    for ch in pieces:
        s = ch.strip()
        if not s:
            continue
        if len(s) < 12 and "`" not in s and "{" not in s:
            continue
        if re.match(r"^[\d\-\)\.\s•:]+$", s):
            continue
        sig = _normalize_sentence_key(s)
        if len(sig) < 10:
            continue
        if sig in seen:
            continue
        seen.add(sig)
        out.append(s)
    joined = " ".join(out)
    if not joined.strip():
        one = " ".join(x.strip() for x in raw.splitlines() if x.strip())
        return one[:1200]
    return joined[:900]


def _clean_chunks_for_pipeline(chunks: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for c in chunks[:5]:
        ct = str(c.get("chunk_text") or "")
        cleaned = _clean_course_chunk_text(ct)
        if len(cleaned.strip()) < 12:
            continue
        nc = dict(c)
        nc["chunk_text"] = cleaned
        out.append(nc)
    if not out and chunks:
        c0 = dict(chunks[0])
        c0["chunk_text"] = str(c0.get("chunk_text") or "")[:2000]
        return [c0]
    return out[:5]


_TUTOR_SYSTEM_PROMPT_FR = """\
Tu es un tuteur IA expert integre dans une plateforme d'apprentissage adaptative.

Ton role est d'AIDER LES ETUDIANTS A COMPRENDRE, pas de repeter ou copier le contenu du cours.

========================
COMPORTEMENT PRINCIPAL
========================

- Tu enseignes comme un tuteur humain.
- Tu expliques les concepts clairement et simplement.
- Tu t'adaptes au niveau debutant sauf indication contraire.
- Tu ne copies JAMAIS le texte du cours/contexte.
- Tu REFORMULES TOUJOURS avec tes propres mots.
- Tu ne produis JAMAIS d'instructions ou de placeholders (comme "...", "explique ceci", etc.).
- Tu generes TOUJOURS des reponses completes et significatives.

========================
REGLES D'UTILISATION DU CONTEXTE
========================

Tu recois du contenu de cours comme CONTEXT.

IMPORTANT:
- Ce contexte est BRUT et peut etre mal ecrit.
- NE copie PAS les phrases.
- NE les repete PAS.
- Tu dois COMPRENDRE le contenu, puis le REECRIRE de maniere plus claire.
- Ajoute les explications manquantes UNIQUEMENT dans le meme theme que [Source 1] (titre de module).

Si le contexte est insuffisant pour repondre precisement:
- Dis-le en une phrase courte; n'importe PAS de notions d'autres chapitres pour combler.
- N'utilise pas des connaissances generales pour melanger des sujets (ex: autre chapitre du cours) non demandes.

Si un bloc CONVERSATION est fourni:
- Utilise-le pour savoir de QUOI parle l'etudiant (ex: "les pointeurs") quand la question dit "les", "ca", "maintenant", etc.
- Ne change PAS de sujet (ex: boucles for/while) si la suite logique porte sur le theme deja discute.

COHERENCE (OBLIGATOIRE — toutes les sections sur le meme theme):
- Le CONTEXT est decoupe en [Source 1], [Source 2], ... avec le titre du cours et du module pour chaque extrait.
- [Source 1] est le plus pertinent en tete: base TOUTES les sections (Concept, Explanation, Example, Mini exercise) sur le meme theme que [Source 1].
- Le titre du module de [Source 1] fixe le sens du sujet (pas un sens vague ou un autre cours): toutes les sections doivent avoir ce meme sens.
- Si la meme expression apparait dans plusieurs titres de chapitres, ne melange pas: explique le sens du chapitre de [Source 1], pas un autre chapitre qui ne partage qu'une partie du titre.
- Les extraits suivants ne servent qu'en appoint si [Source 1] ne suffit pas; ils ne doivent pas contredire ou remplacer le theme principal.

========================
CONTROLE DU SUJET (OBLIGATOIRE)
========================

- Identifie le sujet EXACT demande par la question (un seul theme principal).
- Ne reponds QUE sur ce sujet; n'introduis pas des sous-themes ou chapitres voisins sauf si l'etudiant les demande explicitement.
- Deux titres de chapitre qui partagent un mot ne sont PAS le meme sujet: ne les fusionne pas.
- Ne propose pas de comparaisons avec d'autres chapitres sauf demande explicite.
- Si tu risques de melanger deux themes, limite-toi a [Source 1] et dis en une phrase que les autres themes sont vus ailleurs.

AUTO-VERIFICATION avant d'envoyer la reponse:
- Est-ce que chaque section ne parle que du sujet demande et du theme de [Source 1] ?
- Ai-je melange un autre chapitre par erreur ? Si oui, supprime ou corrige.

========================
STYLE D'ENSEIGNEMENT
========================

Quand tu reponds:

1. Commence par une DEFINITION SIMPLE
2. Explique etape par etape
3. Utilise un langage clair et amical
4. Ajoute un exemple pratique
5. Souligne les differences s'il y a plusieurs concepts
6. Aide l'etudiant a reflechir (pas seulement a lire)

Tu dois ressembler a:
- un professeur patient
- clair et structure
- utile et encourageant

========================
STRUCTURE DE REPONSE (OBLIGATOIRE)
========================

Tu DOIS TOUJOURS suivre cette structure:

📘 Concept:
- Donne une definition courte et claire

🧠 Explanation:
- Explique en termes simples (au moins 3-5 phrases)
- Decompose l'idee etape par etape
- Si tu compares (ex: for vs while), explique clairement les differences

✅ Example:
- Donne un VRAI exemple (code ou vie reelle)
- Il doit etre complet et comprehensible

🎯 Mini exercise:
- Pose une petite question pour tester la comprehension

REMPLISSAGE DES QUATRE SECTIONS (CRITIQUE):
- Ne mets PAS toute la reponse sous 📘 Concept seul. Chaque section doit contenir du texte utile.
- 🧠 Explanation: au moins 2 phrases qui developpent le concept (pas une ligne vide).
- ✅ Example: au moins un exemple concret (code court ou cas pratique).
- 🎯 Mini exercise: au moins une question claire se terminant souvent par « ? ».
- Si tu ecris plusieurs paragraphes, repartis-les entre les sections au lieu de tout empiler sous Concept.

========================
FORMATAGE (INTERFACE)
========================

- Utilise du Markdown (style GitHub): blocs de code avec balises de langue (ex: ```c ... ```).
- N'ecris pas une ligne qui contient uniquement --- (ligne horizontale); cela casse l'interface.

========================
REGLES STRICTES
========================

- JAMAIS de sections vides
- JAMAIS de "..." ou placeholders
- JAMAIS de "fais ceci" ou "explique ceci"
- JAMAIS de copie du texte du contexte
- JAMAIS de contenu brut du cours

Si tu le fais, ta reponse est INVALIDE.

========================
QUALITE REQUISE
========================

Avant de repondre, assure-toi que:

- La reponse est claire pour un debutant
- L'explication est complete dans le cadre du sujet de [Source 1] uniquement
- L'exemple est correct et utile
- Toutes les sections sont remplies
- Aucun melange de chapitres non demande

Produis toujours des reponses a ce niveau de clarte et de completude."""

_TUTOR_SYSTEM_PROMPT_EN = """\
You are an expert AI tutor integrated into an adaptive learning platform.

Your role is to HELP STUDENTS UNDERSTAND, not to repeat or copy course material.

========================
CORE BEHAVIOR
========================

- You teach like a human tutor.
- You explain concepts clearly and simply.
- You adapt to beginner-level unless told otherwise.
- You NEVER copy text from the course/context.
- You ALWAYS reformulate in your own words.
- You NEVER output instructions or placeholders (like "...", "explain this", etc.).
- You ALWAYS generate complete, meaningful answers.

========================
CONTEXT USAGE RULES
========================

You may receive course content as CONTEXT.

IMPORTANT:
- This context is RAW and may be poorly written.
- DO NOT copy sentences from it.
- DO NOT repeat it.
- You must UNDERSTAND it, then REWRITE it in a better way.
- Add missing explanations ONLY within the same topic as [Source 1] (module title).

If context is insufficient to answer precisely:
- Say so briefly; do NOT import ideas from unrelated chapters to fill gaps.
- Do NOT use general knowledge to mix in other course topics the student did not ask about.

If a CONVERSATION block is provided:
- Use it to know WHAT the student means (e.g. "pointers") when they say "them", "it", "now", etc.
- Do NOT switch topic (e.g. to unrelated loops) if the follow-up clearly continues the same thread.

COHERENCE (MANDATORY — one topic across all sections):
- CONTEXT is split into [Source 1], [Source 2], ... each labeled with course and module title.
- [Source 1] is the best match first: base ALL sections (Concept, Explanation, Example, Mini exercise) on the SAME topic as [Source 1].
- The [Source 1] module title fixes the meaning of the topic (not a vague gloss or a different subject): all sections must follow that same meaning.
- If a word appears in several chapter titles, do not mix meanings: explain the chapter [Source 1] is about, not a different chapter that only shares a word in the title.
- Later sources are supplementary only; they must not override or contradict the primary topic.

========================
TOPIC CONTROL (MANDATORY)
========================

- Identify the EXACT topic the question asks for (one main theme).
- Answer ONLY on that topic; do not bring in neighboring subtopics or chapters unless the student explicitly asks.
- Two chapter titles that share a word are NOT the same topic: do not merge them.
- Do not offer comparisons with other chapters unless explicitly requested.
- If you risk mixing two themes, stay with [Source 1] only and say in one sentence that other themes are covered elsewhere.

SELF-CHECK before sending:
- Does every section stick to the requested topic and [Source 1]'s theme?
- Did you accidentally mix another chapter? If yes, remove or fix.

========================
TEACHING STYLE
========================

When answering:

1. Start with a SIMPLE definition
2. Explain step-by-step
3. Use clear and friendly language
4. Add a practical example
5. Highlight differences if multiple concepts exist
6. Help the student think (not just read)

You should sound like:
- a patient teacher
- clear and structured
- helpful and encouraging

========================
RESPONSE STRUCTURE (MANDATORY)
========================

You MUST ALWAYS follow this structure:

📘 Concept:
- Give a short and clear definition

🧠 Explanation:
- Explain in simple terms (at least 3-5 sentences)
- Break down the idea step by step
- If comparing (e.g. for vs while), explain differences clearly

✅ Example:
- Give a REAL example (code or real-life)
- It must be complete and understandable

🎯 Mini exercise:
- Ask a small question to test understanding

FOUR-SECTION FILL (CRITICAL):
- Do NOT put the entire answer under 📘 Concept only. Each section must contain useful text.
- 🧠 Explanation: at least 2 sentences that expand the concept (not a blank line).
- ✅ Example: at least one concrete example (short code or real-life case).
- 🎯 Mini exercise: at least one clear question (often ending with ?).
- If you write several paragraphs, spread them across sections instead of stacking everything under Concept.

========================
FORMATTING (UI)
========================

- Use GitHub-flavored Markdown: fenced code blocks with language tags (e.g. ```c ... ```).
- Do not output a line that contains only --- (horizontal rule); it breaks the UI.

========================
STRICT RULES
========================

- NEVER leave sections empty
- NEVER write "..." or placeholders
- NEVER say "do this" or "explain this"
- NEVER copy the context text
- NEVER output raw course content

If you do, your answer is INVALID.

========================
QUALITY REQUIREMENTS
========================

Before answering, make sure:

- The answer is clear for a beginner
- The explanation is complete within [Source 1]'s topic only
- The example is correct and useful
- All sections are filled
- No unrelated chapter mixing

Always produce answers at this level of clarity and completeness."""

_TUTOR_FEW_SHOT_FR = (
    "EXAMPLE (reference de style uniquement — reponds a USER MESSAGE ci-dessous, PAS a cet exemple):\n\n"
    "User: Explique les boucles for et while\n\n"
    "Assistant:\n"
    "📘 Concept:\n"
    "Les boucles permettent de repeter un bloc de code.\n\n"
    "🧠 Explanation:\n"
    "La boucle while execute un bloc tant qu'une condition est vraie.\n"
    "La boucle for est utilisee quand on connait le nombre d'iterations.\n\n"
    "✅ Example:\n"
    "int i = 0;\n"
    "while (i < 3) { printf(\"%d\", i); i++; }\n"
    "for (int j = 0; j < 3; j++) { printf(\"%d\", j); }\n\n"
    "🎯 Mini exercise:\n"
    "Quelle est la difference principale entre for et while ?\n"
)

_TUTOR_FEW_SHOT_EN = (
    "EXAMPLE (reference style only — answer USER MESSAGE below, NOT this example):\n\n"
    "User: Explain for and while loops\n\n"
    "Assistant:\n"
    "📘 Concept:\n"
    "Loops repeat a block of code until a condition is met or for a fixed count.\n\n"
    "🧠 Explanation:\n"
    "A while loop runs while its condition stays true.\n"
    "A for loop is often used when you know how many iterations you need.\n\n"
    "✅ Example:\n"
    "int i = 0;\n"
    "while (i < 3) { printf(\"%d\", i); i++; }\n"
    "for (int j = 0; j < 3; j++) { printf(\"%d\", j); }\n\n"
    "🎯 Mini exercise:\n"
    "When would you choose while instead of for?\n"
)

_TUTOR_SYSTEM_PROMPT_FR_TARGETED = """\
Tu es un tuteur IA. Tu t'appuies sur le CONTEXT (sources [Source 1], etc.).

- Reformule; ne copie pas le cours mot a mot.
- Reste sur le theme de [Source 1] si le contexte est decoupe par source.
- La question demande souvent UNE chose precise (ex: un exemple de code, une reponse courte).
- Reponds DIRECTEMENT: pas de lecon complete avec les quatre sections 📘 🧠 ✅ 🎯.
- Pas de repetition de tout le chapitre precedent: si on demande seulement un exemple, donne l'exemple (code dans ```c ... ``` si C) et au plus une ou deux phrases utiles.
- N'utilise les en-tetes emoji que si tu juges necessaire; sinon texte libre ou code seul.
- Markdown: blocs ```lang ... ```; pas de ligne --- seule."""

_TUTOR_SYSTEM_PROMPT_EN_TARGETED = """\
You are a tutor AI. Use the CONTEXT ([Source 1], etc.).

- Paraphrase; do not copy course text verbatim.
- Stay aligned with [Source 1] when sources are labeled.
- The question often asks for ONE specific thing (e.g. a code example, a short answer).
- Answer DIRECTLY: do NOT output a full lesson with four sections 📘 🧠 ✅ 🎯.
- Do not repeat an earlier full lesson: if they only asked for an example, give the example (code in ```c ... ``` when C) plus at most a line or two if helpful.
- Use emoji section headers only if clearly useful; otherwise plain text or code only.
- Markdown: use ```lang ... ``` fences; do not output a line with only ---."""

_TUTOR_FEW_SHOT_TARGETED_FR = (
    "EXEMPLE (style uniquement — reponds a USER MESSAGE ci-dessous, PAS a cet exemple):\n\n"
    "User: Donne un exemple de printf\n\n"
    "Assistant:\n"
    "```c\nprintf(\"n = %%d\\\\n\", n);\n```\n"
    "Affiche la valeur de n sur la sortie standard.\n"
)

_TUTOR_FEW_SHOT_TARGETED_EN = (
    "EXAMPLE (style only — answer USER MESSAGE below, NOT this example):\n\n"
    "User: Give one printf example\n\n"
    "Assistant:\n"
    "```c\nprintf(\"n = %d\\n\", n);\n```\n"
    "Prints the value of n to stdout.\n"
)


def _tutor_response_mode(question: str) -> str:
    """
    full = four emoji sections (concept / explanation / example / mini exercise).
    targeted = answer only what was asked (code snippet, short reply, etc.).
    """
    q = (question or "").strip()
    if not q:
        return "full"
    low = _fold_accents(q.lower())

    if re.search(r"\bexplique\b", low) and re.search(
        r"\b(donne|exemple|example|montre|montrez)\b", low
    ):
        return "full"
    if re.search(r"\bexplain\b", low) and re.search(r"\b(give|show|example)\b", low):
        return "full"

    if re.search(
        r"(c'est quoi|qu'est-ce que|quest-ce que|qu'est ce que|que signifie|"
        r"what is|what are|defin(is|ir|ition)\b|pourquoi\b|^why\b|difference entre|"
        r"compare| vs |comment fonctionne)",
        low,
    ):
        return "full"

    words = re.findall(r"[a-zà-êëïéèùçôû]+", low)
    if len(words) <= 2 and not re.search(
        r"exemple|example|code|donne|montre|give|show|write|snippet", low
    ):
        return "full"

    if re.search(
        r"(^|\b)(donne[rz]?|donne-moi|montre[rz]?|montre-moi|montrez|un\s+exemple|"
        r"exemples?\s+de|exemple\s+de\s+code|snippet|peux-tu\s+donner|pourrais-tu\s+donner|"
        r"give\s+me\s+an?\s+example|show\s+me\s+(the\s+)?(code|example)|write\s+(a\s+)?(code|snippet)|"
        r"juste\s+(un|une|le|la)|only\s+(a|the|an)\s+)",
        low,
    ):
        return "targeted"

    if re.search(r"\bcode\b", low) and re.search(
        r"(exemple|example|donne|show|give|write|montre)", low
    ):
        return "targeted"

    if re.search(
        r"(^|\s)(resume|summarize|en\s+une\s+phrase|in\s+one\s+sentence)\b", low
    ):
        return "targeted"

    return "full"


def _build_tutor_prompt(
    *,
    question: str,
    context: str,
    lang: str,
    conversation_block: str = "",
    response_mode: str = "full",
) -> str:
    """
    SYSTEM + CONTEXT + optional CONVERSATION (history) + few-shot + USER (current question).
    response_mode: "full" = four emoji sections; "targeted" = answer only what was asked.
    """
    if response_mode == "targeted":
        sys_prompt = _TUTOR_SYSTEM_PROMPT_FR_TARGETED if lang == "fr" else _TUTOR_SYSTEM_PROMPT_EN_TARGETED
        few_shot = _TUTOR_FEW_SHOT_TARGETED_FR if lang == "fr" else _TUTOR_FEW_SHOT_TARGETED_EN
        fmt = (
            "FORMAT: Reponse directe adaptee a la question (pas de template quatre sections obligatoire)."
            if lang == "fr"
            else "FORMAT: Direct answer matching the question (no mandatory four-section template)."
        )
    else:
        sys_prompt = _TUTOR_SYSTEM_PROMPT_FR if lang == "fr" else _TUTOR_SYSTEM_PROMPT_EN
        few_shot = _TUTOR_FEW_SHOT_FR if lang == "fr" else _TUTOR_FEW_SHOT_EN
        fmt = (
            "FORMAT DE SORTIE: Reponds avec les QUATRE sections remplies (Concept court; puis Explanation; puis Example; puis Mini exercise). "
            "Ne regroupe pas tout le texte sous Concept."
            if lang == "fr"
            else "OUTPUT FORMAT: Respond with ALL FOUR sections filled (short Concept; then Explanation; then Example; then Mini exercise). "
            "Do not put all text under Concept only."
        )
    ctx = (context or "").strip()[:8000]
    q = (question or "").strip()
    conv = (conversation_block or "").strip()
    if lang == "fr":
        conv_section = (
            "========================\n"
            "CONVERSATION (messages precedents — pour comprendre pronoms et sujet en cours):\n"
            "========================\n"
            f"{conv}\n\n"
        )
    else:
        conv_section = (
            "========================\n"
            "CONVERSATION (recent turns — resolve pronouns and ongoing topic):\n"
            "========================\n"
            f"{conv}\n\n"
        )
    mid = f"{ctx}\n\n{conv_section}{few_shot}" if conv else f"{ctx}\n\n{few_shot}"
    return (
        f"{sys_prompt}\n\n"
        f"========================\n"
        f"CONTEXT (course material — DO NOT copy, reformulate):\n"
        f"========================\n"
        f"{mid}\n\n"
        f"========================\n"
        f"USER MESSAGE:\n"
        f"========================\n"
        f"{q}\n\n"
        f"{fmt}"
    )


def _build_direct_tutor_prompt(user_prompt: str) -> str:
    """No retrieval / no course context: just the system prompt + question."""
    sys_prompt = _TUTOR_SYSTEM_PROMPT_EN
    q = (user_prompt or "").strip()
    return (
        f"{sys_prompt}\n\n"
        f"{_TUTOR_FEW_SHOT_EN}\n\n"
        f"========================\n"
        f"USER MESSAGE:\n"
        f"========================\n"
        f"{q}"
    )


def _tutor_extract_section_body(text: str, start: str, end: str | None) -> str:
    """Body text between a section header and the next header (or end of string)."""
    i = text.find(start)
    if i < 0:
        return ""
    i += len(start)
    if end:
        j = text.find(end, i)
        chunk = text[i:j] if j >= 0 else text[i:]
    else:
        chunk = text[i:]
    return chunk.strip()


def _tutor_section_body_too_thin(s: str, min_non_space: int = 12) -> bool:
    return len(re.sub(r"\s+", "", s or "")) < min_non_space


def _redistribute_tutor_sections_if_needed(text: str, lang: str) -> str:
    """
    If the model put almost everything under Concept and left other sections empty,
    split Concept paragraphs across Explanation / Example / Mini exercise.
    """
    if _is_llm_failure_plain_response(text):
        return text
    concept = _tutor_extract_section_body(text, "📘 Concept:", "🧠 Explanation:")
    expl = _tutor_extract_section_body(text, "🧠 Explanation:", "✅ Example:")
    ex = _tutor_extract_section_body(text, "✅ Example:", "🎯 Mini exercise:")
    mini = _tutor_extract_section_body(text, "🎯 Mini exercise:", None)

    if not (
        _tutor_section_body_too_thin(expl)
        and _tutor_section_body_too_thin(ex)
        and _tutor_section_body_too_thin(mini)
    ):
        return text
    if len(re.sub(r"\s+", "", concept)) < 120:
        return text

    paras = [p.strip() for p in re.split(r"\n\s*\n+", concept) if p.strip()]
    if len(paras) < 2:
        return text

    if len(paras) >= 4:
        new_c = paras[0]
        new_e = "\n\n".join(paras[1:-2])
        new_x = paras[-2]
        new_m = paras[-1]
    elif len(paras) == 3:
        new_c, new_e, new_x = paras[0], paras[1], paras[2]
        new_m = (
            "Peux-tu resumer en une phrase pourquoi ce concept est utile dans un programme ?"
            if lang == "fr"
            else "In one sentence, why is this concept useful in a program?"
        )
    else:
        new_c, new_e = paras[0], paras[1]
        new_x = (
            "Exemple: applique la definition ci-dessus a un petit cas concret (voir aussi le cours)."
            if lang == "fr"
            else "Example: apply the definition above to a small concrete case (see the course)."
        )
        new_m = (
            "Quelle nuance importante retiens-tu par rapport a une simple variable ?"
            if lang == "fr"
            else "What key nuance matters compared to a plain variable?"
        )

    return (
        f"📘 Concept:\n{new_c}\n\n"
        f"🧠 Explanation:\n{new_e}\n\n"
        f"✅ Example:\n{new_x}\n\n"
        f"🎯 Mini exercise:\n{new_m}"
    )


def _normalize_tutor_markdown(text: str, lang: str, response_mode: str = "full") -> str:
    """Ensure section headers exist for full mode; targeted answers stay as-is (no forced template)."""
    out = (text or "").strip()
    if not out:
        return out
    if _is_llm_failure_plain_response(out):
        return out
    tail_note = ""
    if "[Note:" in out:
        ni = out.find("[Note:")
        tail_note = out[ni:].strip()
        out = out[:ni].rstrip()
    if response_mode == "targeted":
        if tail_note:
            out = f"{out}\n\n{tail_note}"
        return out
    if "📘" not in out:
        out = "📘 Concept:\n" + out
    if "🧠" not in out:
        out += "\n\n🧠 Explanation:\n"
    if "✅" not in out:
        out += "\n\n✅ Example:\n"
    if "🎯" not in out:
        out += "\n\n🎯 Mini exercise:\n"
    out = _redistribute_tutor_sections_if_needed(out, lang)
    if tail_note:
        out = f"{out}\n\n{tail_note}"
    return out


def _run_chatbot_pipeline(
    *,
    effective_question: str,
    lang: str,
    context: str,
    conversation_block: str = "",
    t0: float,
    budget_hard: float,
    response_mode: str = "full",
) -> tuple[str, str, bool, bool]:
    """
    Single LLM call pipeline. No multi-stage, no quality gates, no retries eating the budget.
    Returns (final_answer, tier_used, llm_called, fallback_used).
    """
    if not context.strip():
        return _llm_failure_plain_message(lang), "fallback", False, True

    remaining = budget_hard - (time.time() - t0)
    if remaining < 2.0:
        return _llm_failure_plain_message(lang), "fallback", False, True

    prompt = _build_tutor_prompt(
        question=effective_question,
        context=context,
        lang=lang,
        conversation_block=conversation_block,
        response_mode=response_mode,
    )
    logger.info("TUTOR PROMPT length=%d chars", len(prompt))

    llm_wait = max(5.0, min(remaining - 1.0, CHAT_LLM_MAX_WAIT_SEC))
    answer, timed_out = run_with_timeout(
        langchain_ollama.generate_response_explain,
        llm_wait,
        prompt,
    )

    if timed_out:
        logger.warning(
            "chatbot LLM timed out after %.1fs (prompt_len=%d)",
            llm_wait,
            len(prompt),
        )
        return _llm_failure_plain_message(lang), "fallback", True, True

    if not (answer or "").strip():
        logger.error(
            "chatbot LLM returned empty (no timeout; check Ollama logs / model error). prompt_len=%d",
            len(prompt),
        )
        return _llm_failure_plain_message(lang), "fallback", True, True

    return answer.strip(), "full", True, False


def _embedding_optimize_metrics(batch_stats: dict[str, Any]) -> dict[str, float]:
    """Derive time_saved and speedup from batch processing stats vs sequential estimate."""
    tc = int(batch_stats.get("total_chunks") or 0)
    tt = float(batch_stats.get("total_time") or 0.0)
    seq_est = estimate_embedding_time(tc, "sequential") if tc else 0.0
    time_saved = max(0.0, seq_est - tt)
    speedup = (seq_est / tt) if tt > 0 else 1.0
    return {
        "time_saved_sec": round(time_saved, 4),
        "speedup_ratio": round(speedup, 4),
        "sequential_estimate_sec": round(seq_est, 4),
    }


def _metadata_matches_simple(meta: dict, criteria: dict) -> bool:
    """Lightweight post-filter for chunk metadata vs flat criteria dict."""
    if not criteria:
        return True
    try:
        from search.metadata_filter import FIELD_TO_CHROMA
    except ImportError:
        FIELD_TO_CHROMA = {}
    flat = dict(meta or {})
    for key, val in criteria.items():
        if key in ("logic", "rules", "$and", "$or"):
            continue
        if isinstance(val, dict):
            continue
        ck = FIELD_TO_CHROMA.get(key, key)
        mv = flat.get(ck, flat.get(key))
        if mv is None:
            return False
        if isinstance(val, (list, tuple, set)):
            if str(mv) not in {str(x) for x in val}:
                return False
        else:
            if str(mv) != str(val):
                return False
    return True


def _process_courses_sequential_v2(course_ids: list[str] | None) -> dict[str, Any]:
    """Non-optimized path: one course at a time via process_and_embed_course_chunks."""
    import time as time_mod

    t0 = time_mod.perf_counter()
    if course_ids is None:
        courses = db_connection.get_all_courses() or []
        ids = [str(c.get("id") or c.get("_id", "")) for c in courses if c.get("id") or c.get("_id")]
    else:
        ids = list(course_ids)
    total_chunks = 0
    for cid in ids:
        if not cid:
            continue
        _ok, n = embeddings_pipeline_v2.process_and_embed_course_chunks(
            cid,
            collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        total_chunks += int(n)
    elapsed = time_mod.perf_counter() - t0
    n_courses = len([i for i in ids if i])
    return {
        "total_courses": n_courses,
        "total_chunks": total_chunks,
        "total_time": round(elapsed, 3),
        "avg_time_per_course": round(elapsed / n_courses, 3) if n_courses else 0.0,
        "batches": 1,
        "mode": "sequential_v2",
    }


# --- Endpoints ---


@app.get("/")
async def root():
    """Welcome message and API info with available endpoints."""
    return {
        "message": "Welcome to StartSmart AI Service",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "GET /": "This info",
            "POST /embed-courses": "Trigger embedding of all courses into ChromaDB",
            "POST /search": "Semantic search (body: { query, n_results? })",
            "GET /search-courses": "Semantic search via query params (?query=...&n_results=5)",
            "GET /health": "Health check (MongoDB, ChromaDB, Ollama)",
            "DELETE /reset-embeddings": "Delete and recreate ChromaDB collection (use with caution)",
            "POST /upload-course-content": "Upload course to MongoDB and create embedding",
            "POST /batch-embed-courses": "Embed all courses that don't have embeddings yet",
            "POST /generate-level-test": "Generate and save level test questions",
            "POST /generate-question": "Generate single question (preview, no save)",
            "POST /upload-document": "Upload PDF/TXT/DOCX; chunk and embed; store in ChromaDB",
            "POST /upload-course-chunked": "Upload course using chunk-based pipeline (course_id or full course)",
            "POST /batch-process-chunks": "Process all courses with chunking (replaces batch-embed with chunks)",
            "POST /search-chunks": "Semantic search over chunks (optional aggregate_by_course)",
            "GET /course-context/{course_id}": "Get RAG context for a course (all chunks combined)",
            "POST /migrate-to-chunks": "Migrate v1 embeddings to chunk-based system",
            "GET /compare-search/{query}": "Compare old vs chunk-based search for a query",
            "POST /rag/answer": "Core RAG endpoint: answer question with retrieved context",
            "POST /rag/recommendations": "Course recommendations using RAG and student profile",
            "GET /rag/health": "Health check for RAG components (Mongo, Chroma, LLM)",
            "POST /brainrush/generate-question": "Generate BrainRush question (MCQ/TrueFalse/DragDrop)",
            "POST /brainrush/generate-session": "BrainRush game session (10/15/20 Q, gamified RAG, level-test LLM)",
            "POST /brainrush/create-session": "Alias of generate-session",
            "GET /brainrush/preview-session": "Preview session (no response cache; query params)",
            "GET /brainrush/topics/{subject}": "Get available topics for a subject from RAG",
            "POST /chatbot/ask": "Chatbot Q&A with RAG and hallucination guard",
            "POST /chatbot/direct": "Tutor answer without retrieval (single-turn, num_predict)",
            "POST /chatbot/validate-answer": "Generate explanation for answer correctness",
            "POST /embeddings/optimize": "Sprint 5: batch-embed courses with optimization metrics",
            "POST /embeddings/batch-process": "Sprint 5: batch process courses (statistics)",
            "GET /embeddings/cache-stats": "Sprint 5: embedding disk cache statistics",
            "POST /embeddings/cache-clear": "Sprint 5: clear embedding disk cache",
            "POST /embeddings/cache-control": "Sprint 5: cache action get_stats | clear | optimize",
            "POST /search/advanced": "Sprint 5: multi-source search + optional metadata filters",
            "POST /search/filtered": "Sprint 5: semantic search with metadata filters",
            "GET /metadata/available-values/{field}": "Sprint 5: distinct metadata values for UI filters",
            "POST /retrieval/multi-source": "Sprint 5: fused multi-source retrieval with attribution",
            "GET /optimization/benchmark": "Sprint 5: embedding optimizer benchmark (sequential vs batch vs parallel)",
            "POST /evaluate/answer": "Sprint 6: evaluate student answer with scoring and feedback",
            "POST /evaluate/batch": "Sprint 6: batch evaluate multiple answers",
            "POST /classify/difficulty": "Sprint 6: classify question difficulty level",
            "POST /classify/difficulty-batch": "Sprint 6: batch classify question difficulties",
            "POST /classify/suggest-adjustment": "Sprint 6: suggest how to adjust question difficulty",
            "POST /feedback/record": "Sprint 6: record AI feedback signal",
            "POST /feedback/user-rating": "Sprint 6: record user rating (1-5)",
            "GET /feedback/recommendations": "Sprint 6: AI tuning recommendations from feedback",
            "GET /feedback/stats/{signal_type}": "Sprint 6: stats for a feedback signal type",
            "GET /monitor/health": "Sprint 6: comprehensive system health check",
            "GET /monitor/stats": "Sprint 6: API performance stats (latency, throughput)",
            "GET /monitor/errors": "Sprint 6: recent failed API requests",
            "GET /monitor/throughput": "Sprint 6: requests per minute",
            "GET /monitor/eval-benchmark": "Step 5: unified AI quality/latency benchmark snapshot",
            "POST /monitor/eval-benchmark/run": "Step 5: run + persist eval benchmark snapshot",
            "GET /monitor/eval-benchmark/history": "Step 5: recent benchmark runs history",
            "GET /monitor/eval-benchmark/regression": "Step 5: regression check latest run vs baseline",
            "POST /level-test/start": "Sprint 7: start an adaptive level test session",
            "POST /level-test/submit-answer": "Sprint 7: submit answer for current question",
            "POST /level-test/complete": "Sprint 7: finalise level test and get profile",
            "GET /level-test/session/{session_id}": "Sprint 7: get session state",
            "POST /recommendations/personalized": "Sprint 7: personalised learning-path from profile",
            "GET /learning-state/{student_id}": "Sprint 7+: get persisted adaptive learning state",
            "POST /learning-state/event": "Sprint 7+: record learning event and refresh pace/confidence",
            "POST /learning-state/sync-from-level-test/{session_id}": "Sprint 7+: recompute learner state from level-test profile",
            "GET /analytics/learning/{student_id}": "Sprint 7+: learner dashboard analytics view",
            "GET /analytics/pace/{student_id}": "Sprint 7+: learner pace trend",
            "GET /analytics/concepts/{student_id}": "Sprint 7+: concept strengths and weaknesses",
            "GET /interventions/effectiveness/{student_id}": "Step 4: effectiveness stats for one learner",
            "GET /interventions/effectiveness": "Step 4: global intervention effectiveness stats",
        },
    }


@app.post("/embed-courses")
async def embed_courses():
    """Triggers process_all_courses() with re-embed and returns status and count."""
    try:
        count = embeddings_pipeline.process_all_courses(force_reembed=True)
        return {
            "status": "success",
            "message": f"Processed {count} course(s).",
            "courses_processed": count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """Semantic search over course embeddings."""
    try:
        raw = rag_service.search(request.query, n_results=request.n_results)
        results = []
        for item in raw:
            results.append(
                SearchResultItem(
                    course_id=item.get("course_id", ""),
                    title=item.get("title", ""),
                    similarity=round(float(item.get("similarity") or 0.0), 4),
                    content=(item.get("content") or "")[:2000],
                )
            )
        return SearchResponse(status="success", query=request.query, results=results)
    except Exception as e:
        logger.exception("search error")
        raise HTTPException(status_code=500, detail=f"RAG search failed: {e}")


@app.get("/search-courses")
async def search_courses(
    query: str = Query(..., description="Search text"),
    n_results: int = Query(default=5, ge=1, le=50, description="Number of results"),
):
    """Semantic search via query params. Alternative to POST /search."""
    try:
        raw = embeddings_pipeline.search_similar_courses(
            query_text=query,
            n_results=n_results,
        )
        results = []
        for item in raw:
            dist = item.get("distance", 1.0)
            similarity = 1.0 / (1.0 + float(dist)) if dist is not None else 0.0
            meta = item.get("metadata") or {}
            results.append({
                "course_id": item.get("id", ""),
                "title": meta.get("title", ""),
                "similarity": round(similarity, 4),
                "content": (item.get("document") or "")[:2000],
            })
        return {"status": "success", "query": query, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-course-content")
async def upload_course_content(body: CourseUploadRequest):
    """Saves course to MongoDB and generates embedding in ChromaDB."""
    try:
        course_doc = {
            "title": body.title,
            "description": body.description,
            "modules": body.modules,
            "level": body.level,
        }
        if body.course_id:
            course_doc["course_id"] = body.course_id
        course_id = db_connection.insert_course(course_doc)
        if not course_id:
            raise HTTPException(status_code=500, detail="Failed to insert course")
        course = {
            "id": course_id,
            "title": body.title,
            "description": body.description,
            "modules": body.modules,
            "level": body.level,
        }
        # Chunk-based RAG indexing
        rag_result = rag_service.add_document("course", course)
        # Also maintain v1 full-document embedding for backwards compatibility
        collection = chroma_setup.get_or_create_collection(collection_name="course_embeddings")
        ok = embeddings_pipeline.process_single_course(course, collection)
        return {
            "status": "success",
            "message": "Course saved; chunked and full-document embeddings created.",
            "course_id": course_id,
            "embeddings_created": 1 if ok else 0,
            "chunks_created": rag_result.get("chunks_created", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("upload_course_content error")
        raise HTTPException(status_code=500, detail=f"Failed to upload course: {e}")


@app.post("/batch-embed-courses")
async def batch_embed_courses():
    """Embeds only courses that don't already have embeddings in ChromaDB."""
    try:
        # process_all_courses will skip existing embeddings when force_reembed=False
        created = embeddings_pipeline.process_all_courses(force_reembed=False)
        # For summary, also report total courses in DB
        courses = db_connection.get_all_courses()
        total = len(courses) if courses else 0
        return {
            "status": "success",
            "courses_processed": total,
            "embeddings_created": created,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-level-test")
async def generate_level_test(body: LevelTestRequest):
    """Generates level test questions and saves to database."""
    try:
        question_ids = question_generator.generate_and_save_level_test(
            subject=body.subject,
            num_questions=body.num_questions,
            course_id=body.course_id,
        )
        questions = []
        for qid in question_ids:
            questions.append({"id": qid})
        return {
            "status": "success",
            "questions": questions,
            "question_ids": question_ids,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-question")
async def generate_question(body: QuestionGenerateRequest):
    """Generates a single question (preview only, not saved)."""
    try:
        # Optional RAG context to enrich debugging / future prompts
        context = rag_service.get_context_for_query(body.subject, max_chunks=5)
        q = question_generator.generate_level_test_question(
            subject=body.subject,
            difficulty=body.difficulty,
            topic=body.topic,
        )
        if q is None:
            raise HTTPException(status_code=503, detail="Failed to generate question (check Ollama)")
        return {"status": "success", "question": q, "context": context}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    """Health check: MongoDB, ChromaDB, Ollama."""
    mongodb_ok = False
    chromadb_ok = False
    ollama_ok = False

    try:
        mongodb_ok = db_connection.test_connection()
    except Exception:
        mongodb_ok = False

    try:
        chroma_setup.get_chroma_client()
        chromadb_ok = True
    except Exception:
        chromadb_ok = False

    if ollama is not None:
        try:
            ollama.list()
            ollama_ok = True
        except Exception:
            ollama_ok = False

    overall = "healthy" if (mongodb_ok and chromadb_ok and ollama_ok) else "degraded"
    return {
        "status": overall,
        "mongodb": "ok" if mongodb_ok else "error",
        "chromadb": "ok" if chromadb_ok else "error",
        "ollama": "ok" if ollama_ok else "error",
    }


@app.delete("/reset-embeddings")
async def reset_embeddings():
    """Deletes and recreates the ChromaDB collection. Use with caution."""
    try:
        chroma_setup.delete_collection(collection_name="course_embeddings")
        chroma_setup.get_or_create_collection(collection_name="course_embeddings")
        return {
            "status": "success",
            "message": "Embeddings collection reset successfully. Re-run POST /embed-courses to repopulate.",
            "warning": "Use with caution: all existing embeddings were deleted.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# --- Chunking / RAG v2 endpoints ---


@app.post("/upload-document")
async def upload_document(
    file: UploadFile = File(...),
    doc_type: str = Form("general"),
    metadata: str = Form("{}"),
):
    """
    Accepts PDF, TXT, or DOCX. Chunks document, generates embeddings, stores in ChromaDB.
    Form: file, doc_type (course|exercise|general), metadata (JSON).
    """
    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Missing filename")
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Allowed types: {', '.join(ALLOWED_EXTENSIONS)}")
        text = _read_file_content(file)
        if not text.strip():
            raise HTTPException(status_code=400, detail="File is empty or could not extract text")
        meta = {}
        try:
            meta = json.loads(metadata) if metadata else {}
        except json.JSONDecodeError:
            pass
        doc_type = (meta.get("doc_type") or doc_type or "general").lower()
        if doc_type not in ("course", "exercise", "general"):
            doc_type = "general"
        chunk_size = int(meta.get("chunk_size", 500))
        chunk_overlap = int(meta.get("chunk_overlap", 50))
        course_id = meta.get("course_id") or ""
        document_id = str(uuid.uuid4())[:8]

        if doc_type == "general":
            chunks = document_chunker.chunk_text_recursive(text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            chunk_dicts = [
                {
                    "chunk_id": f"doc_{document_id}_chunk_{i}",
                    "course_id": course_id,
                    "chunk_type": "text",
                    "text": t,
                    "metadata": {"chunk_index": i, "document_id": document_id},
                }
                for i, t in enumerate(chunks)
            ]
        else:
            chunk_dicts = document_chunker.smart_chunk_document(doc_type, {"text": text, "course_id": course_id}, chunk_size=chunk_size)
            for i, c in enumerate(chunk_dicts):
                c["chunk_id"] = c.get("chunk_id") or f"doc_{document_id}_chunk_{i}"
                if course_id:
                    c["course_id"] = course_id

        if not chunk_dicts:
            return JSONResponse(
                status_code=200,
                content={"status": "success", "chunks_created": 0, "document_id": document_id, "message": "No chunks produced"},
            )
        chunk_dicts = embeddings_pipeline_v2.embed_all_chunks(chunk_dicts, show_progress=False)
        stored = embeddings_pipeline_v2.store_chunks_in_chromadb(chunk_dicts, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION)
        return {
            "status": "success",
            "chunks_created": stored,
            "document_id": document_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("upload_document error")
        raise HTTPException(status_code=500, detail=str(e))


class UploadCourseChunkedBody(BaseModel):
    course_id: str | None = Field(default=None, description="Course ID to fetch from MongoDB")
    course: dict | None = Field(default=None, description="Full course object (if not using course_id)")


@app.post("/upload-course-chunked")
async def upload_course_chunked(body: UploadCourseChunkedBody):
    """Uses chunk-based pipeline: fetch course by ID or use provided course object, chunk, embed, store."""
    try:
        if body.course_id and not body.course:
            course = db_connection.get_course_by_id(body.course_id)
            if not course:
                raise HTTPException(status_code=404, detail=f"Course not found: {body.course_id}")
            ok, chunks_created = embeddings_pipeline_v2.process_and_embed_course_chunks(
                str(course.get("id") or course.get("_id", "")),
                collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
            )
            return {
                "status": "success" if ok else "partial",
                "course_id": str(course.get("id") or course.get("_id", "")),
                "chunks_created": chunks_created,
            }
        elif body.course:
            course = body.course
            cid = str(course.get("id") or course.get("_id", ""))
            if not cid:
                raise HTTPException(status_code=400, detail="Course object must have id or _id")
            chunks = document_chunker.chunk_course_content(course)
            if not chunks:
                return {"status": "success", "course_id": cid, "chunks_created": 0}
            chunks = embeddings_pipeline_v2.embed_all_chunks(chunks, show_progress=False)
            stored = embeddings_pipeline_v2.store_chunks_in_chromadb(
                chunks, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
            )
            return {"status": "success", "course_id": cid, "chunks_created": stored}
        else:
            raise HTTPException(status_code=400, detail="Provide course_id or course object")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("upload_course_chunked error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch-process-chunks")
async def batch_process_chunks():
    """Process all courses with chunking; returns progress and statistics."""
    try:
        total = embeddings_pipeline_v2.process_all_courses_chunked(
            collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        return {
            "status": "success",
            "chunks_created": total,
            "message": f"Processed all courses; {total} chunk(s) stored.",
        }
    except Exception as e:
        logger.exception("batch_process_chunks error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search-chunks")
async def search_chunks_endpoint(body: ChunkedSearchRequest):
    """Semantic search over chunks. Optionally aggregate results by course."""
    try:
        query = _sanitize_query(body.query)
        if not query:
            raise HTTPException(status_code=400, detail="Query is required")
        if body.aggregate_by_course:
            ranked = embeddings_pipeline_v2.search_and_aggregate_by_course(
                query, n_results=body.n_results, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
            )
            results = [
                {
                    "course_id": r.get("course_id"),
                    "total_similarity": r.get("total_similarity", 0),
                    "chunk_count": len(r.get("chunks", [])),
                    "chunks": [{"chunk_id": c.get("chunk_id"), "similarity": c.get("similarity"), "snippet": (c.get("chunk_text") or "")[:200]} for c in r.get("chunks", [])[:5]],
                }
                for r in ranked
            ]
        else:
            raw = embeddings_pipeline_v2.search_chunks(
                query, n_results=body.n_results, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
            )
            results = [
                {
                    "chunk_id": r.get("chunk_id"),
                    "course_id": r.get("course_id"),
                    "similarity": r.get("similarity"),
                    "chunk_text": (r.get("chunk_text") or "")[:2000],
                    "metadata": r.get("metadata"),
                }
                for r in raw
            ]
        return {"status": "success", "query": query, "results": results}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("search_chunks error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/course-context/{course_id}")
async def course_context(
    course_id: str,
    max_chunks: int = Query(default=20, ge=1, le=100),
):
    """Retrieves all chunks for a course and returns combined RAG context."""
    try:
        course_id = _sanitize_query(course_id, max_len=100) or course_id
        context = embeddings_pipeline_v2.get_course_context(
            course_id, max_chunks=max_chunks, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
        )
        coll = embeddings_pipeline_v2.get_or_create_chunked_collection(embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION)
        try:
            peek = coll.get(where={"course_id": course_id}, limit=max_chunks, include=[])
            chunk_count = len(peek.get("ids") or [])
        except Exception:
            chunk_count = 0
        return {"course_id": course_id, "context": context, "chunk_count": chunk_count}
    except Exception as e:
        logger.exception("course_context error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/migrate-to-chunks")
async def migrate_to_chunks():
    """Migrates old (v1) embeddings to chunk-based system. Returns migration report."""
    try:
        total = embeddings_pipeline_v2.migrate_from_v1_to_v2(
            v1_collection_name="course_embeddings",
            v2_collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        return {
            "status": "success",
            "chunks_created": total,
            "message": f"Migration complete. {total} chunk(s) stored in chunk collection.",
        }
    except Exception as e:
        logger.exception("migrate_to_chunks error")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/compare-search/{query:path}")
async def compare_search(query: str):
    """Compares old (full-doc) vs chunk-based search. Returns side-by-side comparison data."""
    try:
        q = _sanitize_query(query)
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")
        v1 = embeddings_pipeline.search_similar_courses(q, n_results=5, collection_name="course_embeddings")
        v2_ranked = embeddings_pipeline_v2.search_and_aggregate_by_course(
            q, n_results=5, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
        )
        return {
            "query": q,
            "v1_full_document": [
                {"id": r.get("id"), "distance": r.get("distance"), "title": (r.get("metadata") or {}).get("title")}
                for r in v1
            ],
            "v2_chunk_aggregated": [
                {"course_id": r.get("course_id"), "total_similarity": r.get("total_similarity"), "chunk_count": len(r.get("chunks", []))}
                for r in v2_ranked
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("compare_search error")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/answer")
async def rag_answer(body: RAGAnswerRequest):
    """Core RAG endpoint: answer question using retrieved context and LLM."""
    try:
        result = rag_service.answer_question_with_rag(body.question, max_chunks=body.max_chunks)
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        logger.exception("rag_answer error")
        raise HTTPException(status_code=500, detail=f"RAG answer failed: {e}")


@app.post("/rag/recommendations")
async def rag_recommendations(body: RAGRecommendationsRequest):
    """Course recommendations using RAG and student profile."""
    try:
        recs = rag_service.get_course_recommendations(
            student_profile=body.student_profile,
            n_recommendations=body.n_results,
        )
        return {"status": "success", "recommendations": recs}
    except Exception as e:  # noqa: BLE001
        logger.exception("rag_recommendations error")
        raise HTTPException(status_code=500, detail=f"RAG recommendations failed: {e}")


@app.get("/rag/health")
async def rag_health():
    """Health status for RAG components (MongoDB, ChromaDB, LLM)."""
    try:
        return rag_service.health_check()
    except Exception as e:  # noqa: BLE001
        logger.exception("rag_health error")
        raise HTTPException(status_code=500, detail=f"RAG health check failed: {e}")


# --- BrainRush Sprint 4 endpoints ---


async def _brainrush_session_core(body: BrainRushSessionRequest, *, preview: bool) -> dict[str, Any]:
    """BrainRush session: 10/15/20 questions, gamified RAG, level-test LLM stack."""
    t0 = time.time()
    route = "/brainrush/generate-session"

    chosen_preference = body.difficulty_preference
    policy = None
    sid = body.student_id or ""
    if sid and sid != "__preview__":
        state = student_state_store.get_state(sid)
        conf = float((state or {}).get("confidence_score", 0.5))
        recent_scores = list((state or {}).get("recent_scores", []))[-3:]
        pseudo_recent = [{"is_correct": (float(s) >= 50), "response_time_sec": 15} for s in recent_scores]
        policy = policy_engine.decide_next_difficulty(
            current_difficulty=body.difficulty,
            recent_answers=pseudo_recent,
            confidence_score=conf,
            hint_used=False,
        )
        if chosen_preference != "adaptive":
            chosen_preference = policy["target_difficulty"]

    # Do not cache full BrainRush sessions: each game must get a new session_seed and new
    # questions. Identical POST bodies would otherwise return stale JSON instantly (no LLM).

    student_for_session = body.student_id or "anonymous"
    if preview:
        student_for_session = "__preview__"

    subjects_resolved = resolve_brainrush_subjects(body.subject_filter, body.subject)
    if not subjects_resolved:
        raise HTTPException(
            status_code=400,
            detail="No subjects found for BrainRush. Ensure MongoDB has courses and subject/subject_filter match your data.",
        )

    _gen_session = partial(
        generate_brainrush_session,
        brainrush_generator,
        student_id=student_for_session,
        num_questions=body.num_questions,
        difficulty_preference=chosen_preference,
        subject_filter=body.subject_filter,
        single_subject=body.subject,
        mixed_question_types=body.mixed_question_types,
        subjects_payload=subjects_resolved,
    )
    try:
        session_dict, timed_out = run_with_timeout(
            _gen_session,
            BRAINRUSH_SESSION_BUDGET,
            reraise=(BrainRushGroundingError,),
        )
    except BrainRushGroundingError as e:
        raise HTTPException(
            status_code=503,
            detail=str(e)
            or "Insufficient grounded content for BrainRush; widen subject or re-embed materials.",
        ) from e

    tier_used = "compact"
    fallback_used = False
    llm_called = True

    if timed_out or session_dict is None or not (session_dict.get("questions") if session_dict else []):
        raise HTTPException(
            status_code=503,
            detail="BrainRush session could not be generated in time or returned no grounded questions. "
            "Widen subject or re-embed materials.",
        )

    questions = list(session_dict.get("questions") or [])

    cleaned: list[Any] = []
    for q in questions:
        if brainrush_session_question_ok(q):
            cleaned.append(q)
        else:
            logger.warning("brainrush session: skipping invalid question: %s", str(q.get("question", ""))[:60])
    questions = cleaned
    if not questions:
        raise HTTPException(
            status_code=503,
            detail="BrainRush session produced no valid questions. Try again or adjust course materials.",
        )

    session_dict = dict(session_dict or {})
    session_dict["questions"] = questions
    session_dict["total_questions"] = len(questions)
    session_dict["total_points"] = sum(int(q.get("points", 0)) for q in questions)
    session_dict["estimated_time"] = calculate_estimated_time_seconds(questions)

    total_points = int(session_dict["total_points"])
    avg_q_conf = 0.0
    if questions:
        conf_vals = [float((q or {}).get("validation_confidence", 0.0)) for q in questions]
        avg_q_conf = sum(conf_vals) / max(len(conf_vals), 1)

    ai_feedback_loop.record_signal(
        "question_quality",
        max(0.0, min(100.0, avg_q_conf * 100.0)),
        {
            "subject": body.subject or "multi",
            "difficulty": chosen_preference,
            "count": len(questions),
            "question_type": "brainrush_session",
        },
    )
    logger.info(
        "brainrush session: subject=%s num=%s total_pts=%s preview=%s",
        body.subject,
        len(questions),
        total_points,
        preview,
    )

    session_info = {
        "total_points": total_points,
        "avg_difficulty": chosen_preference,
        "session_id": session_dict.get("session_id"),
        "estimated_time": session_dict.get("estimated_time"),
        "subjects_covered": session_dict.get("subjects_covered", []),
    }

    result = {
        "status": "success",
        "questions": questions,
        "session": session_dict,
        "session_info": session_info,
        "difficulty_policy": policy,
        "cache_hit": False,
        "tier_used": tier_used,
        "preview": preview,
    }

    ai_monitor.record_request(
        route,
        time.time() - t0,
        True,
        {
            "cache_hit": False,
            "tier_used": tier_used,
            "llm_called": llm_called,
            "fallback_used": fallback_used,
            "timed_out": timed_out,
            "preview": preview,
        },
    )
    ai_feedback_loop.record_response_latency(
        route,
        time.time() - t0,
        {
            "cache_hit": False,
            "tier_used": tier_used,
            "subject": body.subject or "",
            "difficulty": chosen_preference,
        },
    )
    return result


@app.post("/brainrush/generate-question")
async def brainrush_generate_question(body: BrainRushQuestionRequest):
    """Generate a BrainRush question (MCQ, TrueFalse, or DragDrop)."""
    t0 = time.time()
    try:
        cache_payload = {
            "student_id": body.student_id or "",
            "subject": body.subject,
            "difficulty": body.difficulty,
            "topic": body.topic,
            "question_type": body.question_type,
        }
        ckey = _cache_key("/brainrush/generate-question", cache_payload)
        cached, cache_age_ms = response_cache.get(ckey)
        if cached is not None:
            elapsed_cached = time.time() - t0
            ai_feedback_loop.record_response_latency(
                "/brainrush/generate-question",
                elapsed_cached,
                {"cache_hit": True, "tier_used": "cache", "subject": body.subject, "topic": body.topic},
            )
            ai_monitor.record_request(
                "/brainrush/generate-question",
                elapsed_cached,
                True,
                {"cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache", "llm_called": False, "fallback_used": False},
            )
            return {"status": "success", **cached, "cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache"}

        chosen_difficulty = body.difficulty
        state = None
        policy = None
        if body.student_id:
            state = student_state_store.get_state(body.student_id)
            conf = float((state or {}).get("confidence_score", 0.5))
            recent_scores = list((state or {}).get("recent_scores", []))[-3:]
            pseudo_recent = [{"is_correct": (float(s) >= 50), "response_time_sec": 15} for s in recent_scores]
            policy = policy_engine.decide_next_difficulty(
                current_difficulty=body.difficulty,
                recent_answers=pseudo_recent,
                confidence_score=conf,
                hint_used=False,
            )
            chosen_difficulty = policy["target_difficulty"]
        qtype = body.question_type.strip().lower()
        def _generate_compact():
            if qtype in ("dragdrop", "drag&drop", "drag and drop"):
                return brainrush_generator.generate_drag_drop(body.subject, chosen_difficulty, body.topic)
            if qtype in ("truefalse", "true/false", "true false"):
                return brainrush_generator.generate_true_false(body.subject, chosen_difficulty, body.topic)
            return brainrush_generator.generate_mcq(body.subject, chosen_difficulty, body.topic)

        try:
            question, timed_out = run_with_timeout(
                _generate_compact,
                BRAINRUSH_HARD_BUDGET,
                reraise=(BrainRushGroundingError,),
            )
        except BrainRushGroundingError as e:
            raise HTTPException(
                status_code=503,
                detail=str(e)
                or "Insufficient grounded content for BrainRush; widen subject or re-embed materials.",
            ) from e

        tier_used = "compact"
        fallback_used = False
        llm_called = True
        if timed_out or not question:
            raise HTTPException(
                status_code=503,
                detail="BrainRush question could not be generated in time or with sufficient grounded content.",
            )

        q_check = question_guardrails.validate_question(question)
        if not q_check["is_valid"]:
            raise HTTPException(
                status_code=503,
                detail="Generated question failed guardrails: " + "; ".join(q_check.get("issues") or []),
            )
        conf = question.get("validation_confidence", 0.0)
        ai_feedback_loop.record_question_feedback(
            {
                "subject": body.subject,
                "topic": body.topic,
                "difficulty": chosen_difficulty,
                "question": question.get("question", ""),
            },
            quality_score=max(0.0, min(100.0, float(conf) * 100.0)),
            difficulty_matched=(chosen_difficulty == body.difficulty),
        )
        logger.info("brainrush generate-question: subject=%s topic=%s type=%s confidence=%.2f",
                    body.subject, body.topic, question.get("type"), conf)
        result = {
            "status": "success",
            "question": question,
            "validation_confidence": conf,
            "difficulty_policy": policy,
            "selected_difficulty": chosen_difficulty,
            "cache_hit": False,
            "tier_used": tier_used,
        }
        response_cache.set(
            ckey,
            {
                "question": question,
                "validation_confidence": conf,
                "difficulty_policy": policy,
                "selected_difficulty": chosen_difficulty,
                "tier_used": tier_used,
            },
        )
        ai_monitor.record_request(
            "/brainrush/generate-question",
            time.time() - t0,
            True,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "llm_called": llm_called,
                "fallback_used": fallback_used,
                "timed_out": timed_out,
            },
        )
        ai_feedback_loop.record_response_latency(
            "/brainrush/generate-question",
            time.time() - t0,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "subject": body.subject,
                "topic": body.topic,
                "difficulty": chosen_difficulty,
            },
        )
        return result
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request(
            "/brainrush/generate-question",
            time.time() - t0,
            False,
            {"error": str(e), "cache_hit": False},
        )
        logger.exception("brainrush generate-question error")
        raise HTTPException(status_code=500, detail=f"BrainRush question generation failed: {e}")


@app.post("/brainrush/generate-session")
@app.post("/brainrush/create-session")
async def brainrush_generate_session(body: BrainRushSessionRequest):
    """Generate a BrainRush session (10/15/20 questions, gamified RAG, level-test LLM)."""
    t0 = time.time()
    try:
        return await _brainrush_session_core(body, preview=False)
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request(
            "/brainrush/generate-session",
            time.time() - t0,
            False,
            {"error": str(e), "cache_hit": False},
        )
        logger.exception("brainrush generate-session error")
        raise HTTPException(status_code=500, detail=f"BrainRush session generation failed: {e}") from e


@app.get("/brainrush/preview-session")
async def brainrush_preview_session(
    num_questions: int = Query(10, description="Must be 10, 15, or 20"),
    subject: str | None = Query(None, description="Optional single subject; omit for multi-subject preview"),
    difficulty: str = Query("medium", description="Base difficulty for policy (easy | medium | hard)"),
    difficulty_preference: str = Query("adaptive", description="adaptive | easy | medium | hard"),
    mixed_question_types: bool = Query(False),
    subject_filter: str | None = Query(None, description="Comma-separated course/subject filters"),
):
    """Preview session shape without caching (uses internal preview student id)."""
    t0 = time.time()
    if num_questions not in (10, 15, 20):
        raise HTTPException(status_code=400, detail="num_questions must be 10, 15, or 20")
    filt: list[str] | None = None
    if subject_filter and subject_filter.strip():
        filt = [s.strip() for s in subject_filter.split(",") if s.strip()]
    try:
        body = BrainRushSessionRequest(
            subject=subject,
            difficulty=difficulty,
            difficulty_preference=difficulty_preference,
            num_questions=num_questions,
            student_id="__preview__",
            subject_filter=filt,
            mixed_question_types=mixed_question_types,
        )
        return await _brainrush_session_core(body, preview=True)
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve)) from ve
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request(
            "/brainrush/preview-session",
            time.time() - t0,
            False,
            {"error": str(e), "cache_hit": False},
        )
        logger.exception("brainrush preview-session error")
        raise HTTPException(status_code=500, detail=f"BrainRush preview session failed: {e}") from e


@app.get("/brainrush/subjects")
async def brainrush_subjects():
    """Return distinct subject names from the course database for the lobby topic picker."""
    try:
        courses = db_connection.get_all_courses()
        seen: set[str] = set()
        subjects: list[str] = []
        for c in courses:
            s = (c.get("subject") or "").strip()
            if s and s.lower() not in seen:
                seen.add(s.lower())
                subjects.append(s)
        return {"status": "success", "subjects": subjects}
    except Exception as e:  # noqa: BLE001
        logger.exception("brainrush subjects error")
        raise HTTPException(status_code=500, detail=f"Failed to fetch subjects: {e}")


@app.get("/brainrush/topics/{subject}")
async def brainrush_topics(subject: str):
    """Get available topics for a subject from RAG."""
    try:
        topics = brainrush_generator._get_relevant_topics(_sanitize_query(subject, max_len=100) or subject)
        return {"status": "success", "subject": subject, "topics": topics}
    except Exception as e:  # noqa: BLE001
        logger.exception("brainrush topics error")
        raise HTTPException(status_code=500, detail=f"Failed to fetch topics: {e}")


# --- Chatbot Sprint 4 endpoints ---


@app.post("/chatbot/ask")
async def chatbot_ask(body: ChatbotRequest):
    """Chatbot Q&A with RAG context and hallucination prevention."""
    t0 = time.time()
    try:
        state = student_state_store.get_state(body.student_id) if body.student_id else None
        effective_question = _effective_question(body.question, body.conversation_history)
        lang = _detect_language(effective_question, body.conversation_history)
        intent = _classify_user_intent(effective_question)
        response_mode = _tutor_response_mode(effective_question)
        state_sig = _state_hash(state)
        cache_payload = {
            "student_id": body.student_id or "",
            "question": effective_question,
            "history_tail": body.conversation_history[-4:],
            "mode": body.mode or "",
            "intent": intent,
            "response_mode": response_mode,
            "state_sig": state_sig,
            "schema_v": CACHE_SCHEMA_VERSION,
        }
        ckey = _cache_key("/chatbot/ask", cache_payload)
        cached, cache_age_ms = response_cache.get(ckey)
        if cached is not None:
            elapsed_cached = time.time() - t0
            ai_feedback_loop.record_response_latency(
                "/chatbot/ask",
                elapsed_cached,
                {"cache_hit": True, "tier_used": "cache", "student_id": body.student_id or ""},
            )
            ai_monitor.record_request(
                "/chatbot/ask",
                elapsed_cached,
                True,
                {"cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache", "llm_called": False, "fallback_used": False},
            )
            return {"status": "success", **cached, "cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache"}

        hist_trimmed = _trim_history_exclude_current_turn(body.conversation_history, body.question)
        retrieval_base = _retrieval_query_for_chat(body.question, hist_trimmed)
        retrieval_query = _augment_retrieval_query_from_history(retrieval_base, hist_trimmed)
        conversation_block = _format_conversation_history_for_prompt(hist_trimmed)
        align_text = f"{retrieval_query} {_conversation_text_for_signals(hist_trimmed)}"

        raw_chunks = embeddings_pipeline_v2.search_chunks(
            retrieval_query,
            n_results=16,
            collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        raw_chunks = _rerank_chunks_by_lexical_alignment(raw_chunks, align_text)
        raw_chunks = _filter_chunks_by_minimal_title_surplus(raw_chunks, align_text)
        chunks = _select_tutor_chunks(retrieval_query, raw_chunks, n_max=5)

        cleaned_chunks = _clean_chunks_for_pipeline(chunks)
        cleaned_concat = _format_labeled_course_context(cleaned_chunks)

        # LLM budget must start AFTER retrieval/chunk work — otherwise embedding search consumes CHAT_HARD_BUDGET
        # and the model hits "could not finish in time" even when Ollama never got a fair slice of wall time.
        t_llm = time.time()
        final_answer, tier_used, llm_called, fallback_used = _run_chatbot_pipeline(
            effective_question=effective_question,
            lang=lang,
            context=cleaned_concat,
            conversation_block=conversation_block,
            t0=t_llm,
            budget_hard=CHAT_LLM_HARD_BUDGET,
            response_mode=response_mode,
        )

        source_chunks = _chunks_for_sources_display(chunks)
        sources = [
            {
                "course_id": c.get("course_id", ""),
                "course_title": (c.get("metadata") or {}).get("course_title", ""),
                "chunk_text": (c.get("chunk_text") or "")[:200],
                "similarity": c.get("similarity"),
            }
            for c in source_chunks
        ]
        context_for_validation = (
            cleaned_concat if cleaned_concat.strip() else "\n".join((c.get("chunk_text") or "") for c in chunks)
        )
        logger.info("RAW LLM RESPONSE (before normalize): %s", final_answer)
        final_answer = _normalize_tutor_markdown(final_answer, lang, response_mode=response_mode)

        if _is_llm_failure_plain_response(final_answer):
            pp = {
                "cleaned_response": final_answer,
                "is_safe": True,
                "validation": {
                    "confidence": 1.0,
                    "is_valid": True,
                    "issues": [],
                    "skipped_grounding": True,
                    "reason": "llm_timeout_or_unavailable",
                },
            }
        else:
            pp = hallucination_guard_instance.post_process_response(final_answer, context_for_validation)
        val = pp.get("validation", {}) if isinstance(pp, dict) else {}
        grounded_conf = float(val.get("confidence", 0.0)) if isinstance(val, dict) else 0.0
        hallucination_risk = max(0.0, min(1.0, 1.0 - grounded_conf))
        ai_feedback_loop.record_hallucination(
            response_preview=pp.get("cleaned_response", ""),
            confidence=hallucination_risk,
            metadata={"endpoint": "/chatbot/ask", "tier_used": tier_used, "student_id": body.student_id or ""},
        )

        pace_decision = pacing_engine.decide(state)
        selected_style = body.mode or tutor_response_builder.select_style(
            pace_mode=pace_decision.get("pace_mode", "slow"),
            confidence_score=float((state or {}).get("confidence_score", 0.4)),
        )
        pedagogical = tutor_response_builder.build(
            question=effective_question,
            raw_answer=pp.get("cleaned_response", ""),
            style=selected_style,
            sources=sources,
        )
        intervention = intervention_engine.evaluate(
            recent_answers=[(state or {}).get("last_event", {})] if state else [],
            confidence_score=float((state or {}).get("confidence_score", 0.4)),
        )
        result = {
            "status": "success",
            "answer": pp.get("cleaned_response", ""),
            "validation": pp.get("validation", {}),
            "sources": sources,
            "pedagogical_response": pedagogical,
            "pace_decision": pace_decision,
            "intervention": intervention,
            "cache_hit": False,
            "tier_used": tier_used,
            "intent": intent,
            "response_mode": response_mode,
        }
        response_cache.set(
            ckey,
            {
                "answer": pp.get("cleaned_response", ""),
                "validation": pp.get("validation", {}),
                "sources": sources,
                "pedagogical_response": pedagogical,
                "pace_decision": pace_decision,
                "intervention": intervention,
                "tier_used": tier_used,
                "intent": intent,
                "response_mode": response_mode,
            },
        )

        ai_monitor.record_request(
            "/chatbot/ask",
            time.time() - t0,
            True,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "intent": intent,
                "llm_called": llm_called,
                "fallback_used": fallback_used,
                "soft_budget_s": CHAT_SOFT_BUDGET,
                "hard_budget_s": CHAT_HARD_BUDGET,
                "llm_phase_budget_s": CHAT_LLM_HARD_BUDGET,
            },
        )
        ai_feedback_loop.record_response_latency(
            "/chatbot/ask",
            time.time() - t0,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "student_id": body.student_id or "",
                "mode": body.mode or "",
                "intent": intent,
            },
        )
        return result
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request(
            "/chatbot/ask",
            time.time() - t0,
            False,
            {"error": str(e), "cache_hit": False},
        )
        logger.exception("chatbot ask error")
        raise HTTPException(status_code=500, detail=f"Chatbot failed: {e}")


@app.post("/chatbot/direct")
async def chatbot_direct(body: DirectTutorRequest):
    """
    Single-turn tutor: no embedding retrieval and no course chunks.
    max_tokens maps to Ollama num_predict (default 1500).
    """
    t0 = time.time()
    try:
        prompt = _build_direct_tutor_prompt(body.prompt)
        raw = langchain_ollama.generate_response_explain(prompt, num_predict=body.max_tokens)
        text = (raw or "").strip()
        return {
            "status": "success",
            "answer": text,
            "prompt": body.prompt,
            "max_tokens": body.max_tokens,
            "elapsed_ms": int((time.time() - t0) * 1000),
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("chatbot direct error")
        raise HTTPException(status_code=500, detail=f"Failed: {e}") from e


@app.post("/chatbot/validate-answer")
async def chatbot_validate_answer(body: ValidateAnswerRequest):
    """Generate explanation for whether the student's answer is correct."""
    try:
        prompt = prompt_builder.build_explanation_prompt(
            body.question, body.student_answer, body.correct_answer
        )
        logger.info("chatbot validate-answer: question=%s", body.question[:50])
        explanation = langchain_ollama.generate_response(prompt)
        is_correct = body.student_answer.strip().lower() == body.correct_answer.strip().lower()
        return {"status": "success", "is_correct": is_correct, "explanation": explanation}
    except Exception as e:  # noqa: BLE001
        logger.exception("chatbot validate-answer error")
        raise HTTPException(status_code=500, detail=f"Validate answer failed: {e}")


# --- Sprint 5: optimization, cache, advanced search ---


@app.post("/embeddings/optimize")
def embeddings_optimize(body: BatchProcessRequest):
    """
    Process courses with EmbeddingOptimizer-backed batch pipeline.
    Returns estimated time saved vs sequential embedding and speedup ratio.
    """
    try:
        if body.use_optimization:
            stats = batch_processor.process_courses_batch(body.course_ids)
        else:
            stats = _process_courses_sequential_v2(body.course_ids)
        metrics = _embedding_optimize_metrics(stats)
        logger.info(
            "embeddings/optimize: courses=%s chunks=%s time=%s speedup=%s",
            stats.get("total_courses"),
            stats.get("total_chunks"),
            stats.get("total_time"),
            metrics.get("speedup_ratio"),
        )
        return {
            "status": "success",
            "time_saved": metrics["time_saved_sec"],
            "time_saved_sec": metrics["time_saved_sec"],
            "speedup_ratio": metrics["speedup_ratio"],
            "sequential_estimate_sec": metrics["sequential_estimate_sec"],
            "courses_processed": stats.get("total_courses", 0),
            "total_chunks": stats.get("total_chunks", 0),
            "total_time_sec": stats.get("total_time", 0),
            "stats": stats,
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("embeddings_optimize error")
        raise HTTPException(status_code=500, detail=f"Optimize failed: {e}")


@app.post("/embeddings/batch-process")
def embeddings_batch_process(body: BatchProcessRequest):
    """Batch-embed courses using BatchEmbeddingProcessor (same pipeline as optimize without extra metrics)."""
    try:
        if body.use_optimization:
            stats = batch_processor.process_courses_batch(body.course_ids)
        else:
            stats = _process_courses_sequential_v2(body.course_ids)
        logger.info("embeddings/batch-process: %s", stats)
        return {"status": "success", "processing_statistics": stats}
    except Exception as e:  # noqa: BLE001
        logger.exception("embeddings_batch_process error")
        raise HTTPException(status_code=500, detail=f"Batch process failed: {e}")


@app.get("/embeddings/cache-stats")
def embeddings_cache_stats_get():
    """Statistics for the on-disk EmbeddingCache (hit rate, size, age)."""
    try:
        stats = embedding_cache.get_cache_stats()
        return {"status": "success", **stats}
    except Exception as e:  # noqa: BLE001
        logger.exception("embeddings_cache_stats_get error")
        raise HTTPException(status_code=500, detail=f"Cache stats failed: {e}")


@app.post("/embeddings/cache-clear")
def embeddings_cache_clear():
    """Clear all entries in the embedding disk cache."""
    try:
        embedding_cache.clear_all()
        logger.info("embedding disk cache cleared")
        return {"status": "success", "message": "Embedding cache cleared (memory + disk)."}
    except Exception as e:  # noqa: BLE001
        logger.exception("embeddings_cache_clear error")
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {e}")


@app.post("/embeddings/cache-control")
def embeddings_cache_control(body: CacheStatsRequest):
    """Dispatch cache actions: get_stats, clear, optimize."""
    try:
        action = (body.action or "").lower().strip()
        if action == "get_stats":
            return {"status": "success", **embedding_cache.get_cache_stats()}
        if action == "clear":
            embedding_cache.clear_all()
            return {"status": "success", "message": "Cache cleared."}
        if action == "optimize":
            embedding_cache.optimize_cache()
            return {
                "status": "success",
                "message": "Cache optimized (LRU + disk size limit).",
                **embedding_cache.get_cache_stats(),
            }
        raise HTTPException(status_code=400, detail="action must be get_stats, clear, or optimize")
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("embeddings_cache_control error")
        raise HTTPException(status_code=500, detail=f"Cache control failed: {e}")


@app.post("/search/advanced")
def search_advanced(body: AdvancedSearchRequest):
    """
    Multi-source retrieval (courses / exercises / documents), optional metadata filters,
    and relevance scoring.
    """
    try:
        q = _sanitize_query(body.query)
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")
        sources = body.sources or ["courses", "exercises", "documents"]
        # Pull extra candidates when filtering
        take = body.n_results * 3 if body.filters else body.n_results
        results = multi_retriever.retrieve_multi_source(q, n_results=take, sources=sources)
        if body.filters:
            results = [r for r in results if _metadata_matches_simple(r.get("metadata") or {}, body.filters)]
        results = results[: body.n_results]
        if not body.use_relevance_scoring:
            for r in results:
                r["relevance_score"] = float(r.get("similarity") or 0.0)
        sources_used = sorted({str(r.get("source") or "unknown") for r in results})
        rel_scores = [float(r.get("relevance_score") or 0.0) for r in results]
        logger.info("search/advanced: query=%s n=%s sources_used=%s", q[:80], len(results), sources_used)
        return {
            "status": "success",
            "query": q,
            "results": results,
            "relevance_scores": rel_scores,
            "sources_used": sources_used,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("search_advanced error")
        raise HTTPException(status_code=500, detail=f"Advanced search failed: {e}")


@app.post("/search/filtered")
def search_filtered(body: FilteredSearchRequest):
    """Semantic search over the default chunk collection with Chroma metadata filters."""
    try:
        q = _sanitize_query(body.query)
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")
        raw = metadata_filter.search_with_filters(q, body.filters, n_results=body.n_results)
        logger.info("search/filtered: query=%s n=%s", q[:80], len(raw))
        return {"status": "success", "query": q, "filters": body.filters, "results": raw}
    except Exception as e:  # noqa: BLE001
        logger.exception("search_filtered error")
        raise HTTPException(status_code=500, detail=f"Filtered search failed: {e}")


@app.get("/metadata/available-values/{field}")
def metadata_available_values(field: str):
    """Distinct metadata values for a field (e.g. course_id, chunk_type, topic→module_name)."""
    try:
        field = _sanitize_query(field, max_len=64) or field
        values = metadata_filter.get_available_metadata_values(field)
        return {"status": "success", "field": field, "values": values}
    except Exception as e:  # noqa: BLE001
        logger.exception("metadata_available_values error")
        raise HTTPException(status_code=500, detail=f"metadata available-values failed: {e}")


@app.post("/retrieval/multi-source")
def retrieval_multi_source(body: MultiSourceRetrievalRequest):
    """Fused retrieval across document sources with source attribution."""
    try:
        q = _sanitize_query(body.query)
        if not q:
            raise HTTPException(status_code=400, detail="Query is required")
        fused = multi_retriever.retrieve_multi_source(
            q,
            n_results=body.n_results,
            sources=body.sources,
        )
        by_source: dict[str, list[dict[str, Any]]] = {}
        for row in fused:
            src = str(row.get("source") or "unknown")
            by_source.setdefault(src, []).append(row)
        logger.info("retrieval/multi-source: query=%s total=%s", q[:80], len(fused))
        return {
            "status": "success",
            "query": q,
            "results": fused,
            "by_source": by_source,
            "fusion_weights": multi_retriever.fusion_weights,
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("retrieval_multi_source error")
        raise HTTPException(status_code=500, detail=f"Multi-source retrieval failed: {e}")


@app.get("/optimization/benchmark")
def optimization_benchmark(
    sample_size: int = Query(default=12, ge=3, le=50, description="Number of sample strings to embed"),
):
    """Compare sequential vs batch vs parallel embedding (requires Ollama)."""
    try:
        samples = [
            f"Benchmark sample text {i}: programming, data structures, and learning objectives."
            for i in range(sample_size)
        ]
        bench = optimizer.benchmark_methods(samples)
        opt_stats = optimizer.get_cache_stats()
        logger.info(
            "optimization/benchmark: seq=%.3f batch=%.3f parallel=%.3f",
            bench.get("sequential_time", 0),
            bench.get("batch_time", 0),
            bench.get("parallel_time", 0),
        )
        return {
            "status": "success",
            "sample_size": sample_size,
            "metrics": bench,
            "optimizer_cache_after_benchmark": opt_stats,
        }
    except Exception as e:  # noqa: BLE001
        logger.exception("optimization_benchmark error")
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {e}")


# ==========================================================================
# Sprint 6: Answer evaluation, difficulty classification, feedback, monitoring
# ==========================================================================


@app.post("/evaluate/answer")
async def evaluate_answer(body: EvaluateAnswerRequest):
    """Evaluate a student answer with scoring, partial credit, and feedback."""
    t0 = time.time()
    try:
        result = answer_evaluator.evaluate(body.question, body.student_answer, body.time_taken)
        latency = time.time() - t0
        ai_monitor.record_request("/evaluate/answer", latency, True)
        ai_feedback_loop.record_signal("answer_accuracy", 1.0 if result["is_correct"] else 0.0, {
            "topic": body.question.get("topic", ""),
            "difficulty": body.question.get("difficulty", ""),
        })
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request("/evaluate/answer", time.time() - t0, False, {"error": str(e)})
        logger.exception("evaluate/answer error")
        raise HTTPException(status_code=500, detail=f"Answer evaluation failed: {e}")


@app.post("/evaluate/batch")
async def evaluate_batch(body: BatchEvaluateRequest):
    """Evaluate multiple answers at once with aggregate statistics."""
    t0 = time.time()
    try:
        result = answer_evaluator.evaluate_batch(body.submissions)
        ai_monitor.record_request("/evaluate/batch", time.time() - t0, True)
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request("/evaluate/batch", time.time() - t0, False, {"error": str(e)})
        logger.exception("evaluate/batch error")
        raise HTTPException(status_code=500, detail=f"Batch evaluation failed: {e}")


@app.post("/classify/difficulty")
async def classify_difficulty(body: ClassifyDifficultyRequest):
    """Classify the difficulty level of a question."""
    t0 = time.time()
    try:
        result = difficulty_classifier.classify_question(body.question)
        ai_monitor.record_request("/classify/difficulty", time.time() - t0, True)
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request("/classify/difficulty", time.time() - t0, False, {"error": str(e)})
        logger.exception("classify/difficulty error")
        raise HTTPException(status_code=500, detail=f"Difficulty classification failed: {e}")


@app.post("/classify/difficulty-batch")
async def classify_difficulty_batch(body: BatchClassifyRequest):
    """Classify difficulty for a batch of questions."""
    t0 = time.time()
    try:
        result = difficulty_classifier.classify_batch(body.questions)
        ai_monitor.record_request("/classify/difficulty-batch", time.time() - t0, True)
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request("/classify/difficulty-batch", time.time() - t0, False, {"error": str(e)})
        logger.exception("classify/difficulty-batch error")
        raise HTTPException(status_code=500, detail=f"Batch difficulty classification failed: {e}")


@app.post("/classify/suggest-adjustment")
async def classify_suggest_adjustment(body: ClassifyDifficultyRequest):
    """Suggest how to adjust a question to match its claimed difficulty."""
    try:
        result = difficulty_classifier.suggest_difficulty_adjustment(body.question)
        return {"status": "success", **result}
    except Exception as e:  # noqa: BLE001
        logger.exception("classify/suggest-adjustment error")
        raise HTTPException(status_code=500, detail=f"Suggestion failed: {e}")


@app.post("/feedback/record")
async def feedback_record(body: RecordFeedbackRequest):
    """Record an AI feedback signal (quality, accuracy, latency, etc.)."""
    try:
        doc_id = ai_feedback_loop.record_signal(body.signal_type, body.value, body.metadata)
        return {"status": "success", "id": doc_id}
    except Exception as e:  # noqa: BLE001
        logger.exception("feedback/record error")
        raise HTTPException(status_code=500, detail=f"Record feedback failed: {e}")


@app.post("/feedback/user-rating")
async def feedback_user_rating(body: UserRatingRequest):
    """Record a 1-5 user rating for an AI response."""
    try:
        doc_id = ai_feedback_loop.record_user_rating(body.rating, body.context, body.metadata)
        return {"status": "success", "id": doc_id}
    except Exception as e:  # noqa: BLE001
        logger.exception("feedback/user-rating error")
        raise HTTPException(status_code=500, detail=f"User rating failed: {e}")


@app.get("/feedback/recommendations")
async def feedback_recommendations():
    """Generate AI tuning recommendations based on accumulated feedback."""
    try:
        report = ai_feedback_loop.generate_tuning_recommendations()
        return {"status": "success", **report}
    except Exception as e:  # noqa: BLE001
        logger.exception("feedback/recommendations error")
        raise HTTPException(status_code=500, detail=f"Recommendations failed: {e}")


@app.get("/feedback/stats/{signal_type}")
async def feedback_stats(signal_type: str, last_n: int = Query(default=200, ge=1, le=5000)):
    """Get stats for a specific feedback signal type."""
    try:
        stats = ai_feedback_loop.get_signal_stats(signal_type, last_n=last_n)
        return {"status": "success", **stats}
    except Exception as e:  # noqa: BLE001
        logger.exception("feedback/stats error")
        raise HTTPException(status_code=500, detail=f"Feedback stats failed: {e}")


@app.get("/monitor/health")
async def monitor_health():
    """Comprehensive system health: RAG components + API performance."""
    try:
        health = ai_monitor.get_system_health()
        return {"status": "success", **health}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/health error")
        raise HTTPException(status_code=500, detail=f"Health check failed: {e}")


@app.get("/monitor/stats")
async def monitor_stats(minutes: int = Query(default=60, ge=1, le=1440)):
    """API performance stats: latency, throughput, success rate."""
    try:
        stats = ai_monitor.get_endpoint_stats(minutes=minutes)
        return {"status": "success", **stats}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/stats error")
        raise HTTPException(status_code=500, detail=f"Monitor stats failed: {e}")


@app.get("/monitor/errors")
async def monitor_errors(last_n: int = Query(default=50, ge=1, le=500)):
    """Recent failed API requests."""
    try:
        errors = ai_monitor.get_error_log(last_n=last_n)
        return {"status": "success", "errors": errors, "count": len(errors)}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/errors error")
        raise HTTPException(status_code=500, detail=f"Error log failed: {e}")


@app.get("/monitor/throughput")
async def monitor_throughput(minutes: int = Query(default=60, ge=1, le=1440)):
    """Requests per minute over the given window."""
    try:
        tp = ai_monitor.get_throughput(minutes=minutes)
        return {"status": "success", **tp}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/throughput error")
        raise HTTPException(status_code=500, detail=f"Throughput check failed: {e}")


@app.get("/monitor/eval-benchmark")
async def monitor_eval_benchmark(last_n: int = Query(default=200, ge=20, le=5000)):
    """Unified benchmark snapshot for quality, safety, and intervention outcomes."""
    try:
        latency = ai_feedback_loop.get_signal_stats("response_latency", last_n=last_n)
        accuracy = ai_feedback_loop.get_signal_stats("answer_accuracy", last_n=last_n)
        hallucination = ai_feedback_loop.get_signal_stats("hallucination", last_n=last_n)
        user_rating = ai_feedback_loop.get_signal_stats("user_rating", last_n=last_n)
        intervention_stats = intervention_effectiveness_tracker.get_stats(student_id=None, last_n=last_n)

        quality_gate = {
            "latency_ok": float(latency.get("mean", 99.0)) <= 2.5 if latency.get("count") else False,
            "accuracy_ok": float(accuracy.get("mean", 0.0)) >= 0.7 if accuracy.get("count") else False,
            "hallucination_ok": float(hallucination.get("mean", 1.0)) <= 0.2 if hallucination.get("count") else True,
            "rating_ok": float(user_rating.get("mean", 0.0)) >= 3.8 if user_rating.get("count") else False,
            "intervention_ok": float(intervention_stats.get("effective_rate", 0.0)) >= 0.55
            if intervention_stats.get("count")
            else False,
        }
        passed = all(quality_gate.values())
        payload = {
            "status": "success",
            "passed": passed,
            "quality_gate": quality_gate,
            "signals": {
                "response_latency": latency,
                "answer_accuracy": accuracy,
                "hallucination": hallucination,
                "user_rating": user_rating,
            },
            "interventions": intervention_stats,
        }
        return payload
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/eval-benchmark error")
        raise HTTPException(status_code=500, detail=f"Eval benchmark failed: {e}")


@app.post("/monitor/eval-benchmark/run")
async def monitor_eval_benchmark_run(last_n: int = Query(default=200, ge=20, le=5000)):
    """Run benchmark and persist snapshot for trend analysis."""
    result = await monitor_eval_benchmark(last_n=last_n)
    run_id = eval_benchmark_store.save_run(
        {
            "passed": result.get("passed"),
            "quality_gate": result.get("quality_gate", {}),
            "signals": result.get("signals", {}),
            "interventions": result.get("interventions", {}),
            "last_n": last_n,
        }
    )
    regression = eval_benchmark_store.regression_report(last_n_baseline=10)
    return {"status": "success", "run_id": run_id, "benchmark": result, "regression": regression}


@app.get("/monitor/eval-benchmark/history")
async def monitor_eval_benchmark_history(last_n: int = Query(default=30, ge=1, le=500)):
    """Get recent persisted benchmark runs."""
    try:
        return {"status": "success", "runs": eval_benchmark_store.history(last_n=last_n)}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/eval-benchmark/history error")
        raise HTTPException(status_code=500, detail=f"Eval benchmark history failed: {e}")


@app.get("/monitor/eval-benchmark/regression")
async def monitor_eval_benchmark_regression(last_n_baseline: int = Query(default=10, ge=1, le=100)):
    """Detect whether latest persisted benchmark regressed vs recent baseline."""
    try:
        return {"status": "success", **eval_benchmark_store.regression_report(last_n_baseline=last_n_baseline)}
    except Exception as e:  # noqa: BLE001
        logger.exception("monitor/eval-benchmark/regression error")
        raise HTTPException(status_code=500, detail=f"Eval benchmark regression failed: {e}")


# ==========================================================================
# Sprint 7: Adaptive level test & personalised recommendations
# ==========================================================================


@app.post("/level-test/start")
async def level_test_start(body: LevelTestStartRequest):
    """Start an adaptive level-test session for a student."""
    t0 = time.time()
    try:
        result = adaptive_level_test.start_test(
            body.student_id,
            body.subjects,
            regenerate=body.regenerate,
        )
        ai_monitor.record_request("/level-test/start", time.time() - t0, True)
        return {"status": "success", **result}
    except Exception as e:
        ai_monitor.record_request("/level-test/start", time.time() - t0, False, {"error": str(e)})
        logger.exception("level-test/start error")
        raise HTTPException(status_code=500, detail=f"Failed to start level test: {e}")


@app.post("/level-test/submit-answer")
async def level_test_submit_answer(body: LevelTestSubmitRequest):
    """Submit answer for the current question and get feedback + next question."""
    t0 = time.time()
    try:
        result = adaptive_level_test.submit_answer(body.session_id, body.answer)
        ai_monitor.record_request("/level-test/submit-answer", time.time() - t0, True)
        return {"status": "success", **result}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        ai_monitor.record_request("/level-test/submit-answer", time.time() - t0, False, {"error": str(e)})
        logger.exception("level-test/submit-answer error")
        raise HTTPException(status_code=500, detail=f"Submit answer failed: {e}")


@app.post("/level-test/complete")
async def level_test_complete(body: LevelTestCompleteRequest):
    """Finalise the level test and compute the student profile."""
    t0 = time.time()
    try:
        profile = adaptive_level_test.complete_test(body.session_id)
        state = student_state_store.upsert_from_level_test(profile, body.session_id)
        ai_monitor.record_request("/level-test/complete", time.time() - t0, True)
        return {"status": "success", "profile": profile, "learning_state": state}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        ai_monitor.record_request("/level-test/complete", time.time() - t0, False, {"error": str(e)})
        logger.exception("level-test/complete error")
        raise HTTPException(status_code=500, detail=f"Complete test failed: {e}")


@app.get("/level-test/session/{session_id}")
async def level_test_session(session_id: str):
    """Retrieve a level-test session by ID (read-only)."""
    try:
        session = adaptive_level_test.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"status": "success", "session": session}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("level-test/session error")
        raise HTTPException(status_code=500, detail=f"Failed to get session: {e}")


@app.post("/recommendations/personalized")
async def recommendations_personalized(body: PersonalizedRecommendationsRequest):
    """Generate personalised learning-path recommendations from a student profile."""
    t0 = time.time()
    try:
        profile = body.student_profile
        weaknesses = profile.get("weaknesses", [])
        recommendations = profile.get("recommendations", [])

        enriched: list[dict[str, Any]] = []
        for rec in recommendations[:body.n_results]:
            subject_title = rec.get("subject", "")
            focus_topics = rec.get("focus_topics", [])

            rag_context = ""
            if focus_topics:
                query = f"{subject_title}: {', '.join(focus_topics[:3])}"
                rag_context = rag_service.get_context_for_query(query, max_chunks=3)
            elif subject_title:
                rag_context = rag_service.get_context_for_query(subject_title, max_chunks=2)

            enriched.append({
                **rec,
                "relevant_material_preview": rag_context[:500] if rag_context else "",
            })

        continuous = []
        student_id = str(profile.get("student_id") or "")
        if student_id:
            ls = student_state_store.get_state(student_id) or {}
            continuous = continuous_recommender.recommend(ls, n_results=body.n_results)
        ai_monitor.record_request("/recommendations/personalized", time.time() - t0, True)
        return {
            "status": "success",
            "overall_level": profile.get("overall_level", ""),
            "overall_mastery": profile.get("overall_mastery", 0),
            "recommendations": enriched,
            "continuous_recommendations": continuous,
        }
    except Exception as e:
        ai_monitor.record_request("/recommendations/personalized", time.time() - t0, False, {"error": str(e)})
        logger.exception("recommendations/personalized error")
        raise HTTPException(status_code=500, detail=f"Personalized recommendations failed: {e}")


@app.get("/learning-state/{student_id}")
async def get_learning_state(student_id: str):
    """Get the persisted learner state for a student."""
    try:
        state = student_state_store.get_state(student_id)
        if not state:
            raise HTTPException(status_code=404, detail="Learning state not found for this student")
        return {"status": "success", "learning_state": state}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("learning-state/get error")
        raise HTTPException(status_code=500, detail=f"Failed to get learning state: {e}")


@app.post("/learning-state/event")
async def record_learning_event(body: LearningEventRequest):
    """Record one learning event and update pace/confidence/engagement."""
    t0 = time.time()
    try:
        state = student_state_store.record_learning_event(
            student_id=body.student_id,
            event_type=body.event_type,
            score=body.score,
            duration_sec=body.duration_sec,
            metadata=body.metadata,
        )
        pace_decision = pacing_engine.decide(state)
        concept = ""
        if body.metadata and isinstance(body.metadata, dict):
            concept = str(body.metadata.get("concept", body.metadata.get("topic", ""))).strip().lower().replace(" ", "_")
        concept_events = list((state or {}).get("concept_events", []))
        if concept:
            relevant = [e for e in concept_events if str(e.get("concept", "")) == concept][-5:]
        else:
            relevant = concept_events[-5:]
        intervention = intervention_engine.evaluate(
            recent_answers=relevant,
            confidence_score=float((state or {}).get("confidence_score", 0.4)),
        )
        effectiveness_outcome = None
        if concept and body.score is not None:
            # Resolve any pending intervention first with this new score.
            effectiveness_outcome = intervention_effectiveness_tracker.resolve_with_event(
                student_id=body.student_id,
                concept=concept,
                new_score=body.score,
                metadata={"event_type": body.event_type},
            )
        if concept and intervention.get("triggered"):
            intervention_effectiveness_tracker.register_intervention(
                student_id=body.student_id,
                concept=concept,
                intervention_type=str(intervention.get("type", "unknown")),
                baseline_score=body.score,
                metadata={"recommended_action": intervention.get("recommended_action")},
            )
        effectiveness_stats = intervention_effectiveness_tracker.get_stats(student_id=body.student_id, last_n=100)
        continuous = continuous_recommender.recommend(state, n_results=5)
        ai_monitor.record_request("/learning-state/event", time.time() - t0, True)
        return {
            "status": "success",
            "learning_state": state,
            "pace_decision": pace_decision,
            "intervention": intervention,
            "intervention_effectiveness_outcome": effectiveness_outcome,
            "intervention_effectiveness_stats": effectiveness_stats,
            "continuous_recommendations": continuous,
        }
    except ValueError as ve:
        ai_monitor.record_request("/learning-state/event", time.time() - t0, False, {"error": str(ve)})
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        ai_monitor.record_request("/learning-state/event", time.time() - t0, False, {"error": str(e)})
        logger.exception("learning-state/event error")
        raise HTTPException(status_code=500, detail=f"Failed to record learning event: {e}")


@app.post("/learning-state/sync-from-level-test/{session_id}")
async def sync_learning_state_from_level_test(session_id: str):
    """Rebuild learner state from an existing level-test session/profile."""
    t0 = time.time()
    try:
        session = adaptive_level_test.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        profile = session.get("profile")
        if not profile:
            profile = generate_student_profile(session)
        state = student_state_store.upsert_from_level_test(profile, session_id=session_id)
        ai_monitor.record_request("/learning-state/sync-from-level-test", time.time() - t0, True)
        return {"status": "success", "profile": profile, "learning_state": state}
    except HTTPException:
        raise
    except ValueError as ve:
        ai_monitor.record_request("/learning-state/sync-from-level-test", time.time() - t0, False, {"error": str(ve)})
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        ai_monitor.record_request("/learning-state/sync-from-level-test", time.time() - t0, False, {"error": str(e)})
        logger.exception("learning-state/sync-from-level-test error")
        raise HTTPException(status_code=500, detail=f"Failed to sync learning state: {e}")


@app.get("/analytics/learning/{student_id}")
async def analytics_learning(student_id: str):
    """Full learner analytics payload for dashboard."""
    try:
        state = student_state_store.get_state(student_id)
        if not state:
            raise HTTPException(status_code=404, detail="Learning state not found for this student")
        recs = continuous_recommender.recommend(state, n_results=5)
        return {
            "status": "success",
            "daily_progress": learning_analytics_service.daily_progress(state),
            "concepts": learning_analytics_service.concept_strengths_weaknesses(state),
            "pace": learning_analytics_service.pace_trend(state),
            "predicted_success": learning_analytics_service.predicted_success(recs),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analytics/learning error")
        raise HTTPException(status_code=500, detail=f"Analytics learning failed: {e}")


@app.get("/analytics/pace/{student_id}")
async def analytics_pace(student_id: str):
    """Learner pace trend summary."""
    try:
        state = student_state_store.get_state(student_id)
        if not state:
            raise HTTPException(status_code=404, detail="Learning state not found for this student")
        return {"status": "success", **learning_analytics_service.pace_trend(state)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analytics/pace error")
        raise HTTPException(status_code=500, detail=f"Analytics pace failed: {e}")


@app.get("/analytics/concepts/{student_id}")
async def analytics_concepts(student_id: str):
    """Concept mastery strengths and weaknesses."""
    try:
        state = student_state_store.get_state(student_id)
        if not state:
            raise HTTPException(status_code=404, detail="Learning state not found for this student")
        return {"status": "success", **learning_analytics_service.concept_strengths_weaknesses(state)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analytics/concepts error")
        raise HTTPException(status_code=500, detail=f"Analytics concepts failed: {e}")


@app.get("/interventions/effectiveness/{student_id}")
async def interventions_effectiveness_student(student_id: str):
    """Intervention effectiveness statistics for a specific learner."""
    try:
        return {
            "status": "success",
            "student_id": student_id,
            "stats": intervention_effectiveness_tracker.get_stats(student_id=student_id, last_n=300),
        }
    except Exception as e:
        logger.exception("interventions/effectiveness/{student_id} error")
        raise HTTPException(status_code=500, detail=f"Intervention effectiveness failed: {e}")


@app.get("/interventions/effectiveness")
async def interventions_effectiveness_global():
    """Global intervention effectiveness statistics."""
    try:
        return {
            "status": "success",
            "stats": intervention_effectiveness_tracker.get_stats(student_id=None, last_n=500),
        }
    except Exception as e:
        logger.exception("interventions/effectiveness error")
        raise HTTPException(status_code=500, detail=f"Global intervention effectiveness failed: {e}")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
