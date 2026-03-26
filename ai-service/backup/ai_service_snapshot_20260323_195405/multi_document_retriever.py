"""
Multi-source retrieval from course, exercise, and uploaded-document Chroma collections.
Supports Reciprocal Rank Fusion and weighted score fusion.
"""
from __future__ import annotations

import collections
import hashlib
import logging
from typing import Any, Optional

import embeddings_pipeline_v2
from context_relevance_scorer import ContextRelevanceScorer
from rag_service import RAGService

logger = logging.getLogger("multi_document_retriever")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# Collection names (exercise / document chunks stored when indexed separately)
DEFAULT_COURSES = embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
DEFAULT_EXERCISES = "exercise_chunks"
DEFAULT_DOCUMENTS = "uploaded_document_chunks"

# Fusion weights by logical source name
SOURCE_WEIGHTS = {
    "courses": 1.0,
    "exercises": 0.8,
    "documents": 0.6,
}


def _fusion_key(item: dict) -> str:
    cid = item.get("chunk_id") or ""
    text = (item.get("chunk_text") or item.get("text") or "")[:200]
    src = item.get("source") or ""
    if cid:
        return f"{src}:{cid}"
    return hashlib.sha256(f"{src}:{text}".encode()).hexdigest()[:32]


def reciprocal_rank_fusion(results_lists: list[list[dict]], k: int = 60) -> list[dict]:
    """
    RRF: score(d) = sum over lists L of 1 / (k + rank_L(d)).
    rank is 1-based index in each list.
    """
    scores: dict[str, float] = collections.defaultdict(float)
    best_item: dict[str, dict] = {}

    for lst in results_lists:
        for rank, item in enumerate(lst, start=1):
            key = _fusion_key(item)
            scores[key] += 1.0 / (k + rank)
            if key not in best_item:
                best_item[key] = dict(item)

    fused = []
    for key, sc in sorted(scores.items(), key=lambda x: -x[1]):
        row = dict(best_item[key])
        row["rrf_score"] = round(sc, 6)
        fused.append(row)
    return fused


def weighted_score_fusion(
    results_lists: list[list[dict]],
    weights: list[float],
) -> list[dict]:
    """
    Multiply each item's similarity (or relevance_score) by source weight;
    merge duplicates by sum of weighted scores.
    """
    if len(weights) != len(results_lists):
        weights = weights + [1.0] * (len(results_lists) - len(weights))

    agg: dict[str, float] = collections.defaultdict(float)
    best: dict[str, dict] = {}

    for lst, w in zip(results_lists, weights):
        for item in lst:
            key = _fusion_key(item)
            base = float(item.get("relevance_score") or item.get("similarity") or 0.0)
            agg[key] += base * w
            if key not in best:
                best[key] = dict(item)

    out = []
    for key, sc in sorted(agg.items(), key=lambda x: -x[1]):
        row = dict(best[key])
        row["weighted_fusion_score"] = round(sc, 6)
        out.append(row)
    return out


class MultiDocumentRetriever:
    """Retrieve and fuse chunks from courses, exercises, and uploaded documents."""

    def __init__(self) -> None:
        self.rag_service = RAGService.get_instance()
        self.scorer = ContextRelevanceScorer()
        self.courses_collection = DEFAULT_COURSES
        self.exercises_collection = DEFAULT_EXERCISES
        self.documents_collection = DEFAULT_DOCUMENTS
        self.fusion_weights = dict(SOURCE_WEIGHTS)

    def _ensure_collections_exist(self) -> None:
        """Create empty collections so query() does not fail."""
        for name in (self.exercises_collection, self.documents_collection):
            try:
                embeddings_pipeline_v2.get_or_create_chunked_collection(name)
            except Exception as e:
                logger.warning("could not ensure collection %s: %s", name, e)

    def _search_collection(
        self,
        query: str,
        collection_name: str,
        source: str,
        n_results: int,
    ) -> list[dict]:
        try:
            raw = embeddings_pipeline_v2.search_chunks(
                query,
                n_results=n_results,
                collection_name=collection_name,
            )
        except Exception as e:
            logger.warning("search_chunks failed for %s: %s", collection_name, e)
            return []

        out: list[dict] = []
        for r in raw:
            text = r.get("chunk_text") or ""
            meta = r.get("metadata") or {}
            rel = self.scorer.score_single_chunk(query, text, meta)
            out.append(
                {
                    "chunk_id": r.get("chunk_id"),
                    "chunk_text": text,
                    "metadata": meta,
                    "course_id": r.get("course_id"),
                    "similarity": r.get("similarity"),
                    "relevance_score": round(rel, 4),
                    "source": source,
                }
            )
        out.sort(key=lambda x: x.get("relevance_score", 0) or 0, reverse=True)
        return out[:n_results]

    def retrieve_from_courses(self, query: str, n_results: int = 5) -> list[dict]:
        return self._search_collection(query, self.courses_collection, "courses", n_results)

    def retrieve_from_exercises(self, query: str, n_results: int = 5) -> list[dict]:
        self._ensure_collections_exist()
        return self._search_collection(query, self.exercises_collection, "exercises", n_results)

    def retrieve_from_documents(self, query: str, n_results: int = 5) -> list[dict]:
        self._ensure_collections_exist()
        return self._search_collection(query, self.documents_collection, "documents", n_results)

    def retrieve_from_all_sources(self, query: str, n_per_source: int = 5) -> list[dict]:
        c = self.retrieve_from_courses(query, n_per_source)
        e = self.retrieve_from_exercises(query, n_per_source)
        d = self.retrieve_from_documents(query, n_per_source)
        return c + e + d

    def fuse_results(self, results_by_source: dict[str, list[dict]]) -> list[dict]:
        """
        Weighted RRF: apply source weights to RRF scores by scaling each list's contribution.
        """
        order = ["courses", "exercises", "documents"]
        lists = [results_by_source.get(k, []) for k in order]
        weights = [self.fusion_weights.get(k, 1.0) for k in order]

        k = 60
        scores: dict[str, float] = collections.defaultdict(float)
        best: dict[str, dict] = {}

        for lst, w, src in zip(lists, weights, order):
            for rank, item in enumerate(lst, start=1):
                key = _fusion_key(item)
                scores[key] += (w * (1.0 / (k + rank)))
                if key not in best:
                    row = dict(item)
                    row["source"] = row.get("source") or src
                    best[key] = row

        fused = []
        for key, sc in sorted(scores.items(), key=lambda x: -x[1]):
            row = dict(best[key])
            row["fusion_score"] = round(sc, 6)
            fused.append(row)
        return fused

    def retrieve_multi_source(
        self,
        query: str,
        n_results: int = 10,
        sources: Optional[list[str]] = None,
    ) -> list[dict]:
        """
        Retrieve from selected sources, fuse with RRF, re-score, return top `n_results`.
        """
        if sources is None:
            sources = ["courses", "exercises", "documents"]
        per = max(5, n_results // max(len(sources), 1) + 2)
        by_src: dict[str, list[dict]] = {}
        if "courses" in sources:
            by_src["courses"] = self.retrieve_from_courses(query, per)
        if "exercises" in sources:
            by_src["exercises"] = self.retrieve_from_exercises(query, per)
        if "documents" in sources:
            by_src["documents"] = self.retrieve_from_documents(query, per)

        fused = self.fuse_results(by_src)
        scored: list[dict] = []
        for ch in fused[: n_results * 2]:
            text = ch.get("chunk_text") or ""
            meta = ch.get("metadata") or {}
            rel = self.scorer.score_single_chunk(query, text, meta)
            row = dict(ch)
            row["relevance_score"] = round(rel, 4)
            scored.append(row)
        scored.sort(key=lambda x: x.get("relevance_score", 0) or 0, reverse=True)
        return scored[:n_results]

    def retrieve_by_topic_hierarchy(self, topic: str, include_subtopics: bool = True) -> list[dict]:
        """
        Search topic; optionally add subtopic queries from metadata keywords in first hit.
        """
        base = self.retrieve_from_courses(topic, n_results=8)
        if not include_subtopics or not base:
            return [{"level": "topic", "chunks": base}]

        # Derive subtopic keywords from module_name / chunk_type in metadata
        subtopics: set[str] = set()
        for b in base[:5]:
            m = b.get("metadata") or {}
            mod = m.get("module_name") or ""
            if mod and mod.lower() != topic.lower():
                subtopics.add(mod.split(",")[0].strip())

        combined: list[dict] = list(base)
        for st in list(subtopics)[:5]:
            combined.extend(self.retrieve_from_courses(st, n_results=3))

        seen = set()
        deduped: list[dict] = []
        for c in combined:
            k = _fusion_key(c)
            if k not in seen:
                seen.add(k)
                deduped.append(c)

        return [
            {"level": "topic", "topic": topic, "chunks": base},
            {"level": "aggregated", "subtopics": list(subtopics), "chunks": deduped},
        ]

    def get_comprehensive_coverage(self, query: str, min_chunks: int = 10) -> dict[str, Any]:
        """
        Pull from all sources until min_chunks or relevance drops below scorer threshold.
        """
        self._ensure_collections_exist()
        chunks: list[dict] = []
        seen_keys: set[str] = set()
        sources_used: set[str] = set()
        n = 5
        stop_low_relevance = False
        while len(chunks) < min_chunks and n <= 40 and not stop_low_relevance:
            batch = self.retrieve_from_all_sources(query, n_per_source=n)
            for ch in batch:
                k = _fusion_key(ch)
                if k in seen_keys:
                    continue
                rel = float(ch.get("relevance_score") or 0)
                if rel < self.scorer.relevance_threshold and len(chunks) >= 3:
                    stop_low_relevance = True
                    break
                seen_keys.add(k)
                chunks.append(ch)
                sources_used.add(ch.get("source") or "unknown")
                if len(chunks) >= min_chunks:
                    break
            if len(batch) < n * 3:
                break
            n += 5

        qm = self.scorer.calculate_context_quality(chunks)
        coverage_score = min(
            1.0,
            0.4 * (len(sources_used) / 3.0)
            + 0.3 * (len(chunks) / max(min_chunks, 1))
            + 0.3 * qm.get("diversity", 0.5),
        )
        return {
            "chunks": chunks,
            "sources_used": sorted(sources_used),
            "coverage_score": round(coverage_score, 4),
            "quality_metrics": qm,
        }


def _avg_relevance(chunks: list[dict]) -> float:
    if not chunks:
        return 0.0
    s = sum(float(c.get("relevance_score") or c.get("similarity") or 0) for c in chunks)
    return round(s / len(chunks), 4)


if __name__ == "__main__":
    mdr = MultiDocumentRetriever()

    q = "python loops"
    print(f'Query: "{q}"')
    print("Retrieved from:")

    rc = mdr.retrieve_from_courses(q, 5)
    re = mdr.retrieve_from_exercises(q, 5)
    rd = mdr.retrieve_from_documents(q, 5)
    print(f"  - Courses: {len(rc)} chunks (avg relevance: {_avg_relevance(rc)})")
    print(f"  - Exercises: {len(re)} chunks (avg relevance: {_avg_relevance(re)})")
    print(f"  - Documents: {len(rd)} chunks (avg relevance: {_avg_relevance(rd)})")

    all_tagged = mdr.retrieve_from_all_sources(q, 5)
    print(f"\nretrieve_from_all_sources (combined): {len(all_tagged)} chunks")

    fused = mdr.fuse_results({"courses": rc, "exercises": re, "documents": rd})
    print(f"After fusion: {len(fused)} unique chunks")

    rrf_only = reciprocal_rank_fusion([rc, re, rd], k=60)
    print(f"reciprocal_rank_fusion standalone: {len(rrf_only)} chunks")

    wsf = weighted_score_fusion(
        [rc, re, rd],
        [SOURCE_WEIGHTS["courses"], SOURCE_WEIGHTS["exercises"], SOURCE_WEIGHTS["documents"]],
    )
    print(f"weighted_score_fusion: {len(wsf)} chunks")

    multi = mdr.retrieve_multi_source(q, n_results=10)
    print(f"\nretrieve_multi_source (top 10): {len(multi)} chunks")

    cov = mdr.get_comprehensive_coverage(q, min_chunks=10)
    div = len(cov["sources_used"])
    print(f"\nSource diversity: {div}/3 sources used")
    print(f"Coverage score: {cov['coverage_score']}")
    print(f"  (quality_metrics: {cov.get('quality_metrics', {})})")

    hier = mdr.retrieve_by_topic_hierarchy("loops", include_subtopics=True)
    print(f"\nretrieve_by_topic_hierarchy: {len(hier)} sections")
    for part in hier:
        print(f"  - {part.get('level')}: {len(part.get('chunks', []))} chunks")
