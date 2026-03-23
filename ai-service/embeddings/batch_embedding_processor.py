"""
Efficient batch processing of course chunks into ChromaDB using EmbeddingOptimizer.
"""
from __future__ import annotations

import logging
import time
from typing import Any

from core import chroma_setup, db_connection
from core.paths import logs_dir
from rag import document_chunker

from . import embeddings_pipeline_v2
from .embedding_optimizer import EmbeddingOptimizer, estimate_embedding_time

try:
    from tqdm import tqdm
except ImportError:
    def tqdm(iterable, **kwargs):  # type: ignore[misc]
        return iterable

logger = logging.getLogger("batch_embedding_processor")
logger.setLevel(logging.INFO)
logger.handlers.clear()
_LOG_PATH = logs_dir() / "batch_processing.log"
_fh = logging.FileHandler(_LOG_PATH, encoding="utf-8")
_fh.setLevel(logging.INFO)
_fh.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
logger.addHandler(_fh)


DEFAULT_COLLECTION = embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
# Rough seconds per chunk for "legacy" sequential embed (one HTTP call per chunk)
_ESTIMATE_SEC_PER_CHUNK_LEGACY = 0.45


def chunk_documents_batch(documents: list[dict]) -> list[dict]:
    """
    Chunk multiple course documents and flatten into one list.
    Adds lightweight batch metadata on each chunk dict (not all keys go to Chroma).
    """
    all_chunks: list[dict] = []
    for batch_index, doc in enumerate(documents):
        if not doc:
            continue
        chunks = document_chunker.chunk_course_content(doc)
        for ch in chunks:
            meta = ch.setdefault("metadata", {})
            meta["batch_index"] = int(batch_index)
            ch["_batch_source"] = f"batch_{batch_index}"
        all_chunks.extend(chunks)
    return all_chunks


def _course_has_chunks_in_chroma(course_id: str, collection_name: str = DEFAULT_COLLECTION) -> bool:
    try:
        coll = embeddings_pipeline_v2.get_or_create_chunked_collection(collection_name)
        r = coll.get(where={"course_id": str(course_id)}, limit=1, include=[])
        ids = r.get("ids") or []
        return len(ids) > 0
    except Exception as e:
        logger.warning("course chunk check failed for %s: %s", course_id, e)
        return False


def get_courses_needing_embedding(limit: int | None = None, collection_name: str = DEFAULT_COLLECTION) -> list[str]:
    """
    Return course IDs that have no rows in the chunk collection for that course_id.
    """
    courses = db_connection.get_all_courses()
    pending: list[str] = []
    for c in courses:
        cid = str(c.get("id") or c.get("_id", ""))
        if not cid:
            continue
        if not _course_has_chunks_in_chroma(cid, collection_name):
            pending.append(cid)
            if limit is not None and len(pending) >= limit:
                break
    logger.info("get_courses_needing_embedding: %s pending (limit=%s)", len(pending), limit)
    return pending


def _embed_chunks_with_optimizer(
    chunks: list[dict],
    optimizer: EmbeddingOptimizer,
) -> list[dict]:
    """Attach embedding vectors to chunk dicts using the optimizer (batch + parallel)."""
    if not chunks:
        return []
    texts = [(c.get("text") or "") for c in chunks]
    vectors = optimizer.generate_embeddings_parallel(texts)
    for c, v in zip(chunks, vectors):
        c["embedding"] = v
    return chunks


class BatchEmbeddingProcessor:
    """Batch course processing: chunk → embed (optimized) → store in ChromaDB."""

    def __init__(self) -> None:
        self.optimizer = EmbeddingOptimizer()
        self.collection_name = DEFAULT_COLLECTION
        self._collection = embeddings_pipeline_v2.get_or_create_chunked_collection(self.collection_name)
        self.batch_size = 20  # courses per batch

    def process_courses_batch(self, course_ids: list[str] | None = None) -> dict[str, Any]:
        """
        Process courses in batches: chunk, parallel embed, store.
        """
        t0 = time.perf_counter()
        if course_ids is None:
            courses = db_connection.get_all_courses()
        else:
            courses = []
            for cid in course_ids:
                c = db_connection.get_course_by_id(cid)
                if c:
                    courses.append(c)
                else:
                    logger.warning("process_courses_batch: course not found: %s", cid)

        if not courses:
            return {
                "total_courses": 0,
                "total_chunks": 0,
                "total_time": 0.0,
                "avg_time_per_course": 0.0,
                "chunks_per_second": 0.0,
                "batches": 0,
            }

        total_chunks_stored = 0
        n_courses = len(courses)
        n_batches = (n_courses + self.batch_size - 1) // self.batch_size

        iterator = range(0, n_courses, self.batch_size)
        if n_batches > 1:
            iterator = tqdm(
                iterator,
                desc="Course batches",
                total=n_batches,
                unit="batch",
            )

        for batch_idx, start in enumerate(iterator):
            end = min(start + self.batch_size, n_courses)
            batch_courses = courses[start:end]
            print(f"Processing batch {batch_idx + 1}/{n_batches} (courses {start + 1}-{end}/{n_courses})...")
            logger.info(
                "batch %s/%s courses %s-%s",
                batch_idx + 1,
                n_batches,
                start + 1,
                end,
            )

            chunks = chunk_documents_batch(batch_courses)
            if not chunks:
                continue
            chunks = _embed_chunks_with_optimizer(chunks, self.optimizer)
            stored = embeddings_pipeline_v2.store_chunks_in_chromadb(
                chunks, collection_name=self.collection_name
            )
            total_chunks_stored += stored
            logger.info("batch stored %s chunks (total so far %s)", stored, total_chunks_stored)

        elapsed = time.perf_counter() - t0
        avg = elapsed / n_courses if n_courses else 0.0
        cps = total_chunks_stored / elapsed if elapsed > 0 else 0.0

        stats = {
            "total_courses": n_courses,
            "total_chunks": total_chunks_stored,
            "total_time": round(elapsed, 3),
            "avg_time_per_course": round(avg, 3),
            "chunks_per_second": round(cps, 3),
            "batches": n_batches,
        }
        logger.info("process_courses_batch complete: %s", stats)
        return stats

    def process_pending_documents(self) -> dict[str, Any]:
        """Embed all courses that have no chunk embeddings yet."""
        pending = get_courses_needing_embedding()
        if not pending:
            logger.info("process_pending_documents: nothing pending")
            return {"status": "ok", "pending_count": 0, "stats": {}}
        stats = self.process_courses_batch(pending)
        return {"status": "ok", "pending_count": len(pending), "stats": stats}

    def reprocess_all_with_optimization(self) -> dict[str, Any]:
        """
        Clear chunk collection and rebuild with optimized pipeline.
        Compares actual optimized time vs an estimated legacy sequential time.
        """
        courses = db_connection.get_all_courses()
        n_courses = len(courses)
        est_chunks = max(n_courses * 4, 1)  # rough average chunks per course
        legacy_estimate_sec = est_chunks * _ESTIMATE_SEC_PER_CHUNK_LEGACY

        t0 = time.perf_counter()
        try:
            chroma_setup.delete_collection(collection_name=self.collection_name)
        except Exception as e:
            logger.warning("delete_collection: %s", e)
        embeddings_pipeline_v2.get_or_create_chunked_collection(self.collection_name)
        self._collection = embeddings_pipeline_v2.get_or_create_chunked_collection(self.collection_name)

        stats = self.process_courses_batch()
        optimized_sec = stats.get("total_time", time.perf_counter() - t0)

        speedup = legacy_estimate_sec / optimized_sec if optimized_sec > 0 else 1.0
        return {
            **stats,
            "legacy_sequential_estimate_sec": round(legacy_estimate_sec, 2),
            "optimized_total_sec": optimized_sec,
            "estimated_speedup_vs_sequential": round(speedup, 2),
        }

    def process_single_course_optimized(self, course_id: str) -> dict[str, Any]:
        t0 = time.perf_counter()
        course = db_connection.get_course_by_id(course_id)
        if not course:
            return {"course_id": course_id, "chunks_created": 0, "time_taken": 0.0, "error": "not_found"}
        chunks = document_chunker.chunk_course_content(course)
        if not chunks:
            return {"course_id": course_id, "chunks_created": 0, "time_taken": round(time.perf_counter() - t0, 3)}
        chunks = _embed_chunks_with_optimizer(chunks, self.optimizer)
        stored = embeddings_pipeline_v2.store_chunks_in_chromadb(chunks, collection_name=self.collection_name)
        elapsed = time.perf_counter() - t0
        return {
            "course_id": course_id,
            "chunks_created": stored,
            "time_taken": round(elapsed, 3),
        }

    def get_processing_queue_size(self) -> int:
        return len(get_courses_needing_embedding())

    def estimate_processing_time(self, num_courses: int) -> dict[str, float]:
        """Estimate hours for sequential vs optimized embedding (heuristic)."""
        if num_courses <= 0:
            return {"sequential_estimate": 0.0, "optimized_estimate": 0.0, "time_saved": 0.0}
        chunks_per_course = 5
        n_chunks = num_courses * chunks_per_course
        seq_sec = estimate_embedding_time(n_chunks, "sequential")
        opt_sec = estimate_embedding_time(n_chunks, "parallel")
        seq_h = seq_sec / 3600.0
        opt_h = opt_sec / 3600.0
        return {
            "sequential_estimate": round(seq_h, 4),
            "optimized_estimate": round(opt_h, 4),
            "time_saved": round(seq_h - opt_h, 4),
        }


if __name__ == "__main__":
    print("Batch embedding processor — demo")
    print("=" * 60)

    proc = BatchEmbeddingProcessor()
    cache_stats = proc.optimizer.get_cache_stats()
    print("Initial cache stats:", cache_stats)

    all_courses = db_connection.get_all_courses()
    n_all = len(all_courses)
    sample_ids = [str(c.get("id")) for c in all_courses[:5]] if n_all else []

    if sample_ids:
        print(f"\nProcessing sample batch of {len(sample_ids)} courses...")
        stats = proc.process_courses_batch(sample_ids)
        print("Batch stats:", stats)
    else:
        print("No courses in MongoDB; skipping sample batch.")

    print("\nPending queue size:", proc.get_processing_queue_size())

    est = proc.estimate_processing_time(max(1, n_all))
    print("\nFull-database time estimate (hours):")
    print(f"  Sequential (heuristic): {est['sequential_estimate']}")
    print(f"  Optimized (heuristic):  {est['optimized_estimate']}")
    print(f"  Time saved (hours):     {est['time_saved']}")

    print("\nCache stats after run:", proc.optimizer.get_cache_stats())

    if n_all > 5:
        print("\nNote: run process_pending_documents() or reprocess_all_with_optimization() for full DB.")
