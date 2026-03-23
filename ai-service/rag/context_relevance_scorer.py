"""
Advanced context relevance scoring for RAG: similarity, intent, diversity, and quality.
"""
from __future__ import annotations

import logging
import collections
import math
import re
from typing import Any

from embeddings import embeddings_pipeline, embeddings_pipeline_v2

try:
    import ollama
except ImportError:
    ollama = None

from core import config

logger = logging.getLogger("context_relevance_scorer")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

_STOP_WORDS = frozenset(
    """
    a an the is are was were be been being to of and or for in on at by with from as it its this that
    these those what which who how when where why not no yes do does did can could should would will
    """.split()
)

_INTENT_PATTERNS = [
    ("factual", re.compile(r"\b(what is|what are|define|definition|explain|meaning of)\b", re.I), 0.85),
    ("procedural", re.compile(r"\b(how to|how do|steps|process|walkthrough|tutorial)\b", re.I), 0.9),
    ("comparative", re.compile(r"\b(difference|compare|versus|vs\.?|between .+ and)\b", re.I), 0.88),
    ("example", re.compile(r"\b(example|show me|demonstrate|sample|illustrate)\b", re.I), 0.87),
]

_DIFF_BEGINNER = re.compile(r"\b(basics?|introduction|beginner|simple|getting started|fundamental)\b", re.I)
_DIFF_ADVANCED = re.compile(r"\b(advanced|complex|in-depth|in depth|expert|sophisticated)\b", re.I)


def extract_key_terms(text: str) -> list[str]:
    """Remove stop words; return words with 4+ characters."""
    if not text:
        return []
    words = re.findall(r"\b[a-z]{4,}\b", text.lower())
    return [w for w in words if w not in _STOP_WORDS]


def calculate_diversity_score(chunks: list[dict]) -> float:
    """Average pairwise dissimilarity (1 - Jaccard overlap) of chunk texts."""
    texts = [str(c.get("chunk_text") or c.get("text") or "") for c in chunks]
    n = len(texts)
    if n < 2:
        return 1.0
    sims: list[float] = []
    for i in range(n):
        for j in range(i + 1, n):
            t1, t2 = extract_key_terms(texts[i]), extract_key_terms(texts[j])
            if not t1 and not t2:
                continue
            s1, s2 = set(t1), set(t2)
            inter = len(s1 & s2)
            union = len(s1 | s2) or 1
            jacc = inter / union
            sims.append(1.0 - jacc)
    return sum(sims) / len(sims) if sims else 0.0


def apply_position_bias(scores: list[float], decay_factor: float = 0.95) -> list[float]:
    """Apply positional decay: scores[i] *= decay_factor ** i."""
    return [float(s) * (decay_factor**i) for i, s in enumerate(scores)]


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na <= 0 or nb <= 0:
        return 0.0
    return max(0.0, min(1.0, dot / (na * nb)))


def _embed_text(text: str) -> list[float] | None:
    """Quiet embedding using ollama when available; else embeddings_pipeline."""
    if not text or not str(text).strip():
        return None
    try:
        if ollama is not None:
            r = ollama.embed(model=config.OLLAMA_MODEL, input=text[:8000])
            emb = r.get("embeddings")
            if emb:
                v = emb[0] if isinstance(emb[0], list) else emb
                return list(v) if not isinstance(v, list) else v
    except Exception as e:
        logger.debug("ollama embed failed: %s", e)
    return embeddings_pipeline.generate_embedding(text)


class ContextRelevanceScorer:
    """Scores and ranks retrieved chunks by relevance, intent, and diversity."""

    def __init__(self) -> None:
        # Lazy import avoids circular import: core.rag_service -> embeddings -> rag.context_relevance_scorer
        from core.rag_service import RAGService

        self.rag_service = RAGService.get_instance()
        self.relevance_threshold = 0.7
        self.max_context_chunks = 10

    def calculate_semantic_overlap(self, text1: str, text2: str) -> float:
        """TF-style overlap of key terms (0-1)."""
        t1 = extract_key_terms(text1)
        t2 = extract_key_terms(text2)
        if not t1 or not t2:
            return 0.0
        c1 = collections.Counter(t1)
        c2 = collections.Counter(t2)
        all_terms = set(c1) | set(c2)
        dot = sum(c1.get(t, 0) * c2.get(t, 0) for t in all_terms)
        n1 = math.sqrt(sum(v * v for v in c1.values()))
        n2 = math.sqrt(sum(v * v for v in c2.values()))
        if n1 <= 0 or n2 <= 0:
            return 0.0
        return max(0.0, min(1.0, dot / (n1 * n2)))

    def detect_query_intent(self, query: str) -> dict[str, Any]:
        """Heuristic intent and difficulty from query text."""
        q = query.lower().strip()
        best_type = "general"
        best_conf = 0.5
        for name, pattern, conf in _INTENT_PATTERNS:
            if pattern.search(q):
                best_type = name
                best_conf = conf
                break
        if best_type == "general" and len(q.split()) <= 4:
            best_conf = 0.4

        detected_difficulty: str | None = None
        if _DIFF_BEGINNER.search(q):
            detected_difficulty = "beginner"
        elif _DIFF_ADVANCED.search(q):
            detected_difficulty = "advanced"

        return {
            "intent_type": best_type,
            "confidence": round(best_conf, 3),
            "detected_difficulty": detected_difficulty,
        }

    def score_single_chunk(
        self,
        query: str,
        chunk_text: str,
        chunk_metadata: dict,
        query_embedding: list[float] | None = None,
        chunk_embedding: list[float] | None = None,
    ) -> float:
        """
        Weighted score: base similarity ~60%, exact match ~20%, metadata boosts ~20%.
        """
        q_emb = query_embedding or _embed_text(query)
        c_emb = chunk_embedding or _embed_text(chunk_text)
        base_sim = 0.0
        if q_emb and c_emb:
            base_sim = _cosine_similarity(q_emb, c_emb)
        else:
            base_sim = self.calculate_semantic_overlap(query, chunk_text)

        q_terms = set(extract_key_terms(query))
        c_terms = set(extract_key_terms(chunk_text))
        exact_match = len(q_terms & c_terms) / max(len(q_terms), 1) if q_terms else 0.0
        exact_match = min(1.0, exact_match * 1.5)

        meta_boost = 0.0
        if chunk_metadata:
            title = str(chunk_metadata.get("course_title") or "") + " " + str(
                chunk_metadata.get("module_name") or ""
            )
            if title.strip():
                overlap = self.calculate_semantic_overlap(query, title)
                meta_boost += 0.5 * overlap
            if "date" in chunk_metadata or "updated" in chunk_metadata:
                meta_boost += 0.1
            lvl = str(chunk_metadata.get("level") or "").lower()
            intent = self.detect_query_intent(query)
            dd = intent.get("detected_difficulty")
            if dd and lvl:
                if dd in lvl or (dd == "beginner" and "begin" in lvl):
                    meta_boost += 0.2
                elif dd == "advanced" and "adv" in lvl:
                    meta_boost += 0.2

        meta_boost = min(1.0, meta_boost)

        final = 0.6 * base_sim + 0.2 * exact_match + 0.2 * meta_boost
        return max(0.0, min(1.0, final))

    def score_multiple_chunks(self, query: str, chunks: list[dict]) -> list[dict]:
        """Score each chunk, sort by score, filter by threshold, add ``relevance_score``."""
        q_emb = _embed_text(query)
        out: list[dict] = []
        for ch in chunks:
            text = ch.get("chunk_text") or ch.get("text") or ""
            meta = ch.get("metadata") or {}
            score = self.score_single_chunk(
                query,
                text,
                meta,
                query_embedding=q_emb,
            )
            row = dict(ch)
            row["relevance_score"] = round(score, 4)
            out.append(row)
        out.sort(key=lambda x: x.get("relevance_score", 0) or 0, reverse=True)
        return [c for c in out if (c.get("relevance_score") or 0) >= self.relevance_threshold]

    def rank_chunks_by_relevance(
        self,
        query: str,
        chunks: list[dict],
        use_intent: bool = True,
    ) -> list[dict]:
        """Score chunks, optionally boost by intent, apply diversity (MMR-lite)."""
        intent = self.detect_query_intent(query) if use_intent else {}
        intent_type = intent.get("intent_type", "general")

        scored: list[dict] = []
        q_emb = _embed_text(query)
        for ch in chunks:
            text = ch.get("chunk_text") or ch.get("text") or ""
            meta = ch.get("metadata") or {}
            s = self.score_single_chunk(query, text, meta, query_embedding=q_emb)
            if intent_type == "procedural" and re.search(r"\b(how|step|process)\b", text, re.I):
                s = min(1.0, s + 0.05)
            if intent_type == "factual" and re.search(r"\b(is|are|means|defined)\b", text, re.I):
                s = min(1.0, s + 0.05)
            if intent_type == "example" and re.search(r"\b(example|for instance)\b", text, re.I):
                s = min(1.0, s + 0.05)
            row = dict(ch)
            row["relevance_score"] = round(s, 4)
            scored.append(row)

        scored.sort(key=lambda x: x.get("relevance_score", 0) or 0, reverse=True)

        selected: list[dict] = []
        for ch in scored:
            if len(selected) >= self.max_context_chunks:
                break
            if not selected:
                selected.append(ch)
                continue
            text = ch.get("chunk_text") or ch.get("text") or ""
            too_similar = False
            for prev in selected:
                ptext = prev.get("chunk_text") or prev.get("text") or ""
                if self.calculate_semantic_overlap(text, ptext) > 0.85:
                    too_similar = True
                    break
            if not too_similar:
                selected.append(ch)

        return selected if selected else scored[: self.max_context_chunks]

    def calculate_context_quality(self, chunks: list[dict]) -> dict[str, Any]:
        """Coverage, diversity, coherence, completeness heuristics."""
        if not chunks:
            return {
                "coverage": 0.0,
                "diversity": 0.0,
                "coherence": 0.0,
                "completeness": 0.0,
            }
        topics = set()
        for c in chunks:
            m = c.get("metadata") or {}
            topics.add(str(m.get("module_name") or m.get("chunk_type") or "general"))
        coverage = min(1.0, len(topics) / max(len(chunks), 1))

        diversity = calculate_diversity_score(chunks)

        texts = [str(c.get("chunk_text") or c.get("text") or "") for c in chunks]
        coh_vals: list[float] = []
        for i in range(len(texts) - 1):
            coh_vals.append(self.calculate_semantic_overlap(texts[i], texts[i + 1]))
        coherence = sum(coh_vals) / len(coh_vals) if coh_vals else 0.0

        avg_score = sum(
            float(c.get("relevance_score", c.get("similarity", 0.5)) or 0) for c in chunks
        ) / len(chunks)
        completeness = min(1.0, 0.5 * avg_score + 0.5 * min(1.0, len(chunks) / 5))

        return {
            "coverage": round(coverage, 4),
            "diversity": round(diversity, 4),
            "coherence": round(coherence, 4),
            "completeness": round(completeness, 4),
        }

    def get_optimal_context(self, query: str, max_chunks: int = 5) -> dict[str, Any]:
        """Retrieve chunks, rank, quality, return subset and combined text."""
        raw = embeddings_pipeline_v2.search_chunks(
            query,
            n_results=max(self.max_context_chunks, max_chunks * 2),
            collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION,
        )
        chunks = [
            {
                "chunk_id": r.get("chunk_id"),
                "chunk_text": r.get("chunk_text"),
                "metadata": r.get("metadata") or {},
                "course_id": r.get("course_id"),
                "similarity": r.get("similarity"),
            }
            for r in raw
        ]
        ranked = self.rank_chunks_by_relevance(query, chunks, use_intent=True)[:max_chunks]
        quality = self.calculate_context_quality(ranked)
        total_rel = sum(float(c.get("relevance_score", 0) or 0) for c in ranked)
        parts = []
        for c in ranked:
            t = c.get("chunk_text") or ""
            parts.append(t.strip())
        context_text = "\n\n---\n\n".join(parts)
        return {
            "chunks": ranked,
            "total_relevance_score": round(total_rel, 4),
            "quality_metrics": quality,
            "context_text": context_text,
        }


if __name__ == "__main__":
    scorer = ContextRelevanceScorer()
    scorer.relevance_threshold = 0.45  # demo-friendly when embeddings are noisy

    q = "how to use for loops in python"
    print("Query:", q)
    intent = scorer.detect_query_intent(q)
    print(
        f"Intent: {intent['intent_type'].title()} "
        f"(confidence: {intent['confidence']:.2f})\n"
    )

    sample_chunks = [
        {
            "chunk_text": "For loops iterate over sequences using the syntax for item in iterable.",
            "metadata": {"course_title": "Python Basics", "module_name": "Loops", "chunk_type": "module"},
        },
        {
            "chunk_text": "Variables store data in memory.",
            "metadata": {"course_title": "Python Basics", "module_name": "Variables"},
        },
    ]

    s0 = scorer.score_single_chunk(
        q,
        sample_chunks[0]["chunk_text"],
        sample_chunks[0]["metadata"],
    )
    print(f"Single chunk score: {s0:.4f}\n")

    ranked = scorer.score_multiple_chunks(q, sample_chunks)
    print("After threshold filter + scores:", len(ranked), "chunks")
    for c in ranked:
        print(f"  score={c.get('relevance_score')}: {(c.get('chunk_text') or '')[:60]}...")

    print("\nIntent detection samples:")
    for test_q in [
        "what is a list comprehension",
        "define recursion",
        "difference between list and tuple",
        "show me an example of a class",
    ]:
        print(f"  {test_q!r} -> {scorer.detect_query_intent(test_q)}")

    try:
        opt = scorer.get_optimal_context(q, max_chunks=5)
        print("\nOptimal context (from ChromaDB search):")
        print(f"  Chunks selected: {len(opt['chunks'])}")
        print(f"  Total relevance score: {opt['total_relevance_score']}")
        print(f"  Quality metrics: {opt['quality_metrics']}")
        if opt["chunks"]:
            top = opt["chunks"][0].get("relevance_score", 0)
            print(f"  Top chunk score: {top}")
            div = opt["quality_metrics"].get("diversity", 0)
            print(f"  Diversity: {div}")
        print(f"\nContext preview (first 200 chars):\n{opt['context_text'][:200]}...")
    except Exception as e:
        print("\nOptimal context (skipped):", e)
