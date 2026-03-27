"""
FastAPI application - AI service API for embeddings, search, RAG, and question generation.
"""
import json
import logging
import re
import sys
import time
import uuid
import hashlib
from pathlib import Path
from typing import Any

# Ensure ai-service root is on sys.path when running: python api.py
_SERVICE_ROOT = Path(__file__).resolve().parent
if str(_SERVICE_ROOT) not in sys.path:
    sys.path.insert(0, str(_SERVICE_ROOT))

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from core import chroma_setup, config, db_connection
from core.rag_service import RAGService
from embeddings import embeddings_pipeline, embeddings_pipeline_v2
from embeddings.batch_embedding_processor import BatchEmbeddingProcessor
from embeddings.embedding_cache import EmbeddingCache
from embeddings.embedding_optimizer import EmbeddingOptimizer, estimate_embedding_time
from generation import question_generator
from generation.brainrush_question_generator import BrainRushQuestionGenerator
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

# Latency budgets (balanced target)
CHAT_SOFT_BUDGET = 2.5
CHAT_HARD_BUDGET = 4.0
BRAINRUSH_SOFT_BUDGET = 2.5
BRAINRUSH_HARD_BUDGET = 5.0

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
    subject: str = Field(..., description="Subject area")
    difficulty: str = Field(default="medium", description="easy | medium | hard")
    num_questions: int = Field(default=10, ge=5, le=50, description="Number of questions")
    student_id: str | None = Field(default=None, description="Optional student for adaptive difficulty")


class ChatbotRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000, description="User question")
    conversation_history: list[dict[str, str]] = Field(default_factory=list, description="Previous messages")
    student_id: str | None = Field(default=None, description="Optional student for personalized tutoring style")
    mode: str | None = Field(default=None, description="Optional style override: explain_like_beginner | step_by_step | analogy_fun_mode | challenge_mode")


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
    subjects: list[str] | None = Field(default=None, description="Course IDs to test (None = all)")


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
            "POST /brainrush/generate-session": "Generate mixed BrainRush question set",
            "GET /brainrush/topics/{subject}": "Get available topics for a subject from RAG",
            "POST /chatbot/ask": "Chatbot Q&A with RAG and hallucination guard",
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

        question, timed_out = run_with_timeout(_generate_compact, BRAINRUSH_HARD_BUDGET)
        tier_used = "compact"
        fallback_used = False
        llm_called = True
        if timed_out or not question:
            tier_used = "fallback"
            fallback_used = True
            llm_called = False
            question = question_guardrails.fallback_question(body.subject, body.topic, chosen_difficulty)

        q_check = question_guardrails.validate_question(question)
        if not q_check["is_valid"]:
            tier_used = "fallback"
            fallback_used = True
            question = question_guardrails.fallback_question(body.subject, body.topic, chosen_difficulty)
            question["quality_issues"] = q_check["issues"]
            question["validation_confidence"] = q_check["confidence"]
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
        if tier_used == "fallback":
            def _refresh_brainrush_q():
                q2 = _generate_compact()
                qc2 = question_guardrails.validate_question(q2 or {})
                if not qc2["is_valid"]:
                    q2 = question_guardrails.fallback_question(body.subject, body.topic, chosen_difficulty)
                response_cache.set(
                    ckey,
                    {
                        "question": q2,
                        "validation_confidence": q2.get("validation_confidence", 0.0),
                        "difficulty_policy": policy,
                        "selected_difficulty": chosen_difficulty,
                        "tier_used": "compact",
                    },
                )
            submit_refresh(_refresh_brainrush_q)
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
async def brainrush_generate_session(body: BrainRushSessionRequest):
    """Generate a mixed BrainRush question set."""
    t0 = time.time()
    try:
        cache_payload = {
            "student_id": body.student_id or "",
            "subject": body.subject,
            "difficulty": body.difficulty,
            "num_questions": body.num_questions,
        }
        ckey = _cache_key("/brainrush/generate-session", cache_payload)
        cached, cache_age_ms = response_cache.get(ckey)
        if cached is not None:
            elapsed_cached = time.time() - t0
            ai_feedback_loop.record_response_latency(
                "/brainrush/generate-session",
                elapsed_cached,
                {"cache_hit": True, "tier_used": "cache", "subject": body.subject},
            )
            ai_monitor.record_request(
                "/brainrush/generate-session",
                elapsed_cached,
                True,
                {"cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache", "llm_called": False, "fallback_used": False},
            )
            return {"status": "success", **cached, "cache_hit": True, "cache_age_ms": cache_age_ms, "tier_used": "cache"}

        chosen_difficulty = body.difficulty
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
        questions, timed_out = run_with_timeout(
            brainrush_generator.generate_mixed_question_set,
            BRAINRUSH_HARD_BUDGET,
            body.subject,
            chosen_difficulty,
            body.num_questions,
        )
        tier_used = "compact"
        fallback_used = False
        llm_called = True
        if timed_out or not questions:
            tier_used = "fallback"
            fallback_used = True
            llm_called = False
            questions = [
                question_guardrails.fallback_question(body.subject, "general", chosen_difficulty)
                for _ in range(body.num_questions)
            ]
        cleaned = []
        for q in questions:
            qc = question_guardrails.validate_question(q)
            if qc["is_valid"]:
                cleaned.append(q)
            else:
                tier_used = "fallback"
                fallback_used = True
                cleaned.append(question_guardrails.fallback_question(body.subject, q.get("topic", "general"), chosen_difficulty))
        questions = cleaned
        total_points = sum(q.get("points", 0) for q in questions)
        avg_q_conf = 0.0
        if questions:
            conf_vals = [float((q or {}).get("validation_confidence", 0.0)) for q in questions]
            avg_q_conf = sum(conf_vals) / max(len(conf_vals), 1)
        ai_feedback_loop.record_signal(
            "question_quality",
            max(0.0, min(100.0, avg_q_conf * 100.0)),
            {
                "subject": body.subject,
                "difficulty": chosen_difficulty,
                "count": len(questions),
                "question_type": "mixed",
            },
        )
        logger.info("brainrush generate-session: subject=%s num=%s total_pts=%s",
                    body.subject, len(questions), total_points)
        result = {
            "status": "success",
            "questions": questions,
            "session_info": {"total_points": total_points, "avg_difficulty": chosen_difficulty},
            "difficulty_policy": policy,
            "cache_hit": False,
            "tier_used": tier_used,
        }
        response_cache.set(
            ckey,
            {
                "questions": questions,
                "session_info": {"total_points": total_points, "avg_difficulty": chosen_difficulty},
                "difficulty_policy": policy,
                "tier_used": tier_used,
            },
        )
        if tier_used == "fallback":
            def _refresh_brainrush_session():
                qset = brainrush_generator.generate_mixed_question_set(body.subject, chosen_difficulty, body.num_questions)
                cleaned2 = []
                for q in qset:
                    qc = question_guardrails.validate_question(q)
                    cleaned2.append(q if qc["is_valid"] else question_guardrails.fallback_question(body.subject, q.get("topic", "general"), chosen_difficulty))
                response_cache.set(
                    ckey,
                    {
                        "questions": cleaned2,
                        "session_info": {"total_points": sum(q.get("points", 0) for q in cleaned2), "avg_difficulty": chosen_difficulty},
                        "difficulty_policy": policy,
                        "tier_used": "compact",
                    },
                )
            submit_refresh(_refresh_brainrush_session)
        ai_monitor.record_request(
            "/brainrush/generate-session",
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
            "/brainrush/generate-session",
            time.time() - t0,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "subject": body.subject,
                "difficulty": chosen_difficulty,
            },
        )
        return result
    except Exception as e:  # noqa: BLE001
        ai_monitor.record_request(
            "/brainrush/generate-session",
            time.time() - t0,
            False,
            {"error": str(e), "cache_hit": False},
        )
        logger.exception("brainrush generate-session error")
        raise HTTPException(status_code=500, detail=f"BrainRush session generation failed: {e}")


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
        state_sig = _state_hash(state)
        cache_payload = {
            "student_id": body.student_id or "",
            "question": body.question,
            "history_tail": body.conversation_history[-4:],
            "mode": body.mode or "",
            "state_sig": state_sig,
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

        # Tier B: compact prompt + top 3 chunks
        chunks = embeddings_pipeline_v2.search_chunks(
            body.question,
            n_results=3,
            collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        context_quick = "\n\n".join((c.get("chunk_text") or "")[:350] for c in chunks[:3])
        compact_prompt = (
            "You are an educational assistant. Use ONLY this context.\n"
            "If uncertain, say so.\n"
            f"Context:\n{context_quick}\n\n"
            f"Question: {body.question}\n"
            "Answer in <=5 short lines."
        )
        quick_answer, quick_timeout = run_with_timeout(langchain_ollama.generate_response, CHAT_SOFT_BUDGET, compact_prompt)
        tier_used = "compact"
        llm_called = True
        fallback_used = False
        if quick_timeout or not quick_answer:
            tier_used = "fallback"
            llm_called = False
            fallback_used = True
            quick_answer = "I need a bit more context. Try asking with a specific concept (e.g. variables, loops, functions)."

        elapsed = time.time() - t0
        use_full = elapsed < CHAT_SOFT_BUDGET and quick_answer and not quick_timeout
        final_answer = quick_answer
        if use_full:
            # Tier C: full path but bounded by hard budget remainder
            prompt = prompt_builder.build_chatbot_prompt(body.question, body.conversation_history)
            prompt = hallucination_guard_instance.add_hallucination_prevention_instructions(prompt)
            remaining = max(0.3, CHAT_HARD_BUDGET - (time.time() - t0))
            full_answer, full_timeout = run_with_timeout(langchain_ollama.generate_response, remaining, prompt)
            if full_answer and not full_timeout:
                final_answer = full_answer
                tier_used = "full"
            elif full_timeout:
                tier_used = "compact"

        sources = [
            {
                "course_id": c.get("course_id", ""),
                "course_title": (c.get("metadata") or {}).get("course_title", ""),
                "chunk_text": (c.get("chunk_text") or "")[:200],
                "similarity": c.get("similarity"),
            }
            for c in chunks
        ]
        context_for_validation = "\n".join((c.get("chunk_text") or "") for c in chunks)
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
            question=body.question,
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
            },
        )

        # If we returned non-full tier, warm full result in background for next call.
        if tier_used != "full":
            def _refresh_full():
                prompt2 = prompt_builder.build_chatbot_prompt(body.question, body.conversation_history)
                prompt2 = hallucination_guard_instance.add_hallucination_prevention_instructions(prompt2)
                full = langchain_ollama.generate_response(prompt2)
                pp2 = hallucination_guard_instance.post_process_response(full, context_for_validation)
                response_cache.set(
                    ckey,
                    {
                        "answer": pp2.get("cleaned_response", ""),
                        "validation": pp2.get("validation", {}),
                        "sources": sources,
                        "pedagogical_response": pedagogical,
                        "pace_decision": pace_decision,
                        "intervention": intervention,
                        "tier_used": "full",
                    },
                )
            submit_refresh(_refresh_full)

        ai_monitor.record_request(
            "/chatbot/ask",
            time.time() - t0,
            True,
            {
                "cache_hit": False,
                "tier_used": tier_used,
                "llm_called": llm_called,
                "fallback_used": fallback_used,
                "soft_budget_s": CHAT_SOFT_BUDGET,
                "hard_budget_s": CHAT_HARD_BUDGET,
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
        result = adaptive_level_test.start_test(body.student_id, body.subjects)
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
