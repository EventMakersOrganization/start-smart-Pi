"""
Unified RAG service interface for chunked retrieval and answering.
Other components (NestJS backend, chatbot, tests) should depend on this
instead of calling low-level pipelines directly.
"""
from __future__ import annotations

import logging
from typing import Any, ClassVar

from . import chroma_setup, db_connection
from embeddings import embeddings_pipeline, embeddings_pipeline_v2
from rag import document_chunker
from utils import langchain_ollama


logger = logging.getLogger("rag_service")
if not logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_handler)
logger.setLevel(logging.INFO)


class RAGService:
    """
    High-level RAG operations: indexing, search, context building, and Q&A.
    """

    _instance: ClassVar["RAGService | None"] = None

    def __init__(self) -> None:
        self.chunk_collection_name = embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
        # Eagerly warm up Chroma client; errors will surface in health_check as well.
        try:
            chroma_setup.get_chroma_client()
        except Exception as e:  # noqa: BLE001
            logger.warning("RAGService: failed to initialize Chroma client at startup: %s", e)
        logger.info("RAGService initialized with chunk collection '%s'", self.chunk_collection_name)

    # --- Singleton access -------------------------------------------------

    @classmethod
    def get_instance(cls) -> "RAGService":
        if cls._instance is None:
            cls._instance = RAGService()
        return cls._instance

    # --- Public API -------------------------------------------------------

    def add_document(self, doc_type: str, document: dict) -> dict:
        """
        Adds a document (course/exercise/text) to the RAG system.
        - Chunks the document
        - Embeds chunks
        - Stores in ChromaDB
        Returns {success, document_id, chunks_created}.
        """
        doc_type = (doc_type or "text").lower()
        try:
            if not isinstance(document, dict):
                raise ValueError("document must be a dict")
            if doc_type == "course":
                document_id = str(document.get("id") or document.get("_id") or document.get("course_id") or "")
                if not document_id:
                    raise ValueError("course document must have 'id' or '_id'")
                chunks = document_chunker.chunk_course_content(document)
            elif doc_type == "exercise":
                chunk = document_chunker.chunk_exercise_content(document)
                document_id = str(chunk.get("metadata", {}).get("exercise_id") or document.get("id") or "")
                chunks = [chunk] if chunk else []
            else:
                # Generic text document
                text = document.get("text", "")
                document_id = str(document.get("id") or document.get("document_id") or "") or f"text_{id(document)}"
                raw_chunks = document_chunker.chunk_text_recursive(text)
                chunks = [
                    {
                        "chunk_id": f"{document_id}_chunk_{i}",
                        "course_id": str(document.get("course_id") or ""),
                        "chunk_type": "text",
                        "text": t,
                        "metadata": {"chunk_index": i, "document_id": document_id},
                    }
                    for i, t in enumerate(raw_chunks)
                ]

            if not chunks:
                logger.info("RAGService.add_document: no chunks produced for doc_type=%s", doc_type)
                return {"success": True, "document_id": document_id, "chunks_created": 0}

            chunks = embeddings_pipeline_v2.embed_all_chunks(chunks, show_progress=False)
            stored = embeddings_pipeline_v2.store_chunks_in_chromadb(
                chunks, collection_name=self.chunk_collection_name
            )
            return {"success": True, "document_id": document_id, "chunks_created": stored}
        except Exception as e:  # noqa: BLE001
            logger.exception("RAGService.add_document error for doc_type=%s: %s", doc_type, e)
            return {"success": False, "document_id": None, "chunks_created": 0, "error": str(e)}

    def search(
        self,
        query: str,
        n_results: int = 5,
        filter_by: dict | None = None,
    ) -> list[dict]:
        """
        High-level search returning course-level results.
        Uses chunk-based search aggregated by course.
        Returns list of {course_id, title, similarity, content, chunks}.
        """
        query = (query or "").strip()
        if not query:
            return []
        try:
            if filter_by:
                # filter_by is passed on as a where-clause when searching chunks
                chunks = embeddings_pipeline_v2.search_chunks(
                    query,
                    n_results=n_results * 5,
                    filter_metadata=filter_by,
                    collection_name=self.chunk_collection_name,
                )
                # Aggregate manually by course for this filtered case
                by_course: dict[str, dict[str, Any]] = {}
                for c in chunks:
                    cid = c.get("course_id") or "unknown"
                    if cid not in by_course:
                        by_course[cid] = {"course_id": cid, "chunks": [], "total_similarity": 0.0}
                    by_course[cid]["chunks"].append(c)
                    by_course[cid]["total_similarity"] += float(c.get("similarity") or 0.0)
                aggregated = sorted(
                    by_course.values(),
                    key=lambda x: -x["total_similarity"],
                )[:n_results]
            else:
                aggregated = embeddings_pipeline_v2.search_and_aggregate_by_course(
                    query, n_results=n_results, collection_name=self.chunk_collection_name
                )

            results: list[dict] = []
            for item in aggregated:
                cid = item.get("course_id") or ""
                # Fetch course metadata if available
                course = db_connection.get_course_by_id(cid) if cid else None
                title = ""
                if course:
                    title = str(course.get("title") or "")
                elif item.get("chunks"):
                    first_meta = (item["chunks"][0].get("metadata") or {})
                    title = str(first_meta.get("course_title") or "")
                content = ""
                if course:
                    content = (course.get("description") or "")[:2000]
                if not content and item.get("chunks"):
                    content = (item["chunks"][0].get("chunk_text") or "")[:2000]
                results.append(
                    {
                        "course_id": cid,
                        "title": title,
                        "similarity": float(item.get("total_similarity") or 0.0),
                        "content": content,
                        "chunks": item.get("chunks", []),
                    }
                )
            return self._rank_results(results)
        except Exception as e:  # noqa: BLE001
            logger.error("RAGService.search error: %s", e)
            return []

    def get_context_for_query(self, query: str, max_chunks: int = 8) -> str:
        """
        Retrieves context for a query by searching top chunks and concatenating them.
        Returns formatted context string suitable for LLM prompts.
        Fetches extra candidates, filters by a similarity floor, and keeps
        up to *max_chunks* of the best results.
        """
        query = (query or "").strip()
        if not query:
            return ""
        try:
            candidates = embeddings_pipeline_v2.search_chunks(
                query,
                n_results=max_chunks + 5,
                collection_name=self.chunk_collection_name,
            )
            # Keep only chunks above a minimum similarity floor
            _SIM_FLOOR = 0.35
            chunks = [c for c in candidates if (c.get("similarity") or 0) >= _SIM_FLOOR]
            chunks = chunks[:max_chunks]

            parts = []
            for c in chunks:
                meta = c.get("metadata") or {}
                course_title = meta.get("course_title") or meta.get("module_name") or ""
                label = meta.get("chunk_type", "chunk")
                if course_title:
                    label = f"{course_title} - {label}"
                text = c.get("chunk_text") or ""
                parts.append(f"[{label}]\n{text}")
            return "\n\n---\n\n".join(parts)
        except Exception as e:  # noqa: BLE001
            logger.error("RAGService.get_context_for_query error: %s", e)
            return ""

    def answer_question_with_rag(self, question: str, max_chunks: int = 5) -> dict:
        """
        1. Searches for relevant chunks
        2. Builds a RAG prompt with context
        3. Generates an answer via LLM
        4. Returns {answer, sources, confidence}
        """
        question = (question or "").strip()
        if not question:
            return {"answer": "", "sources": [], "confidence": 0.0}
        try:
            chunks = embeddings_pipeline_v2.search_chunks(
                question,
                n_results=max_chunks,
                collection_name=self.chunk_collection_name,
            )
            context = self._build_context_from_chunks(chunks)
            prompt = self._build_rag_prompt(question, context)
            answer_text = langchain_ollama.generate_response(prompt)
            sources = self._format_sources(chunks)

            # Simple confidence heuristic: average similarity of used chunks
            if chunks:
                sims = [float(c.get("similarity") or 0.0) for c in chunks]
                confidence = max(0.0, min(1.0, sum(sims) / len(sims)))
            else:
                confidence = 0.0

            return {"answer": answer_text, "sources": sources, "confidence": confidence}
        except Exception as e:  # noqa: BLE001
            logger.error("RAGService.answer_question_with_rag error: %s", e)
            return {"answer": "", "sources": [], "confidence": 0.0, "error": str(e)}

    def get_course_recommendations(
        self,
        student_profile: dict,
        n_recommendations: int = 3,
    ) -> list[dict]:
        """
        Uses RAG to recommend courses based on student's weak areas and interests.
        Returns ranked course recommendations with simple metadata and scores.
        """
        try:
            weak_areas = student_profile.get("weak_areas") or []
            interests = student_profile.get("interests") or []
            if not isinstance(weak_areas, list):
                weak_areas = [weak_areas]
            if not isinstance(interests, list):
                interests = [interests]
            tokens = [str(x) for x in weak_areas + interests if x]
            query = " ".join(tokens) or "course recommendations"
            aggregated = embeddings_pipeline_v2.search_and_aggregate_by_course(
                query,
                n_results=n_recommendations,
                collection_name=self.chunk_collection_name,
            )
            recs: list[dict] = []
            for item in aggregated:
                cid = item.get("course_id") or ""
                course = db_connection.get_course_by_id(cid) if cid else None
                title = (course or {}).get("title") or ""
                level = (course or {}).get("level") or ""
                recs.append(
                    {
                        "course_id": cid,
                        "title": title,
                        "level": level,
                        "score": float(item.get("total_similarity") or 0.0),
                    }
                )
            return self._rank_results(recs)
        except Exception as e:  # noqa: BLE001
            logger.error("RAGService.get_course_recommendations error: %s", e)
            return []

    def bulk_index_courses(self, course_ids: list[str] | None = None) -> dict:
        """
        Indexes multiple courses into the chunk-based collection.
        If course_ids is None, indexes all courses.
        Returns statistics: {indexed, total_chunks}.
        """
        try:
            if not course_ids:
                total_chunks = embeddings_pipeline_v2.process_all_courses_chunked(
                    collection_name=self.chunk_collection_name
                )
                return {"indexed": "all", "total_chunks": total_chunks}
            total_chunks = 0
            indexed = 0
            for cid in course_ids:
                ok, count = embeddings_pipeline_v2.process_and_embed_course_chunks(
                    cid, collection_name=self.chunk_collection_name
                )
                if ok:
                    indexed += 1
                    total_chunks += count
            return {"indexed": indexed, "total_chunks": total_chunks}
        except Exception as e:  # noqa: BLE001
            logger.error("RAGService.bulk_index_courses error: %s", e)
            return {"indexed": 0, "total_chunks": 0, "error": str(e)}

    def health_check(self) -> dict:
        """
        Checks ChromaDB, Ollama LLM, and MongoDB connections.
        Returns a status report.
        """
        mongo_ok = False
        chroma_ok = False
        llm_ok = False
        try:
            mongo_ok = db_connection.test_connection()
        except Exception:  # noqa: BLE001
            mongo_ok = False
        try:
            chroma_setup.get_chroma_client()
            chroma_ok = True
        except Exception:  # noqa: BLE001
            chroma_ok = False
        try:
            llm_ok = langchain_ollama.test_ollama_connection()
        except Exception:  # noqa: BLE001
            llm_ok = False
        overall = "healthy" if (mongo_ok and chroma_ok and llm_ok) else "degraded"
        return {
            "status": overall,
            "mongodb": "ok" if mongo_ok else "error",
            "chromadb": "ok" if chroma_ok else "error",
            "ollama_llm": "ok" if llm_ok else "error",
        }

    # --- Helper methods ---------------------------------------------------

    def _build_rag_prompt(self, question: str, context: str) -> str:
        """
        Builds a simple but effective RAG prompt for the LLM.
        """
        return (
            "You are an educational assistant. Use ONLY the following context to answer.\n"
            "If the answer is not in the context, say you are not sure.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}\n\n"
            "Answer in a clear and concise way suitable for a student."
        )

    def _build_context_from_chunks(self, chunks: list[dict]) -> str:
        parts = []
        for c in chunks:
            meta = c.get("metadata") or {}
            label = meta.get("chunk_type", "chunk")
            module_name = meta.get("module_name")
            if module_name:
                label += f" ({module_name})"
            text = c.get("chunk_text") or ""
            parts.append(f"[{label}] {text}")
        return "\n\n---\n\n".join(parts)

    def _rank_results(self, results: list[dict]) -> list[dict]:
        """
        Re-rank results using similarity score (and optionally future signals).
        """
        return sorted(results, key=lambda x: float(x.get("similarity") or x.get("score") or 0.0), reverse=True)

    def _format_sources(self, chunks: list[dict]) -> list[dict]:
        """
        Converts raw chunk search results into a compact source list for citation.
        Returns [{course_id, course_title, chunk_text, similarity}].
        """
        sources: list[dict] = []
        for c in chunks:
            meta = c.get("metadata") or {}
            course_id = c.get("course_id") or ""
            title = meta.get("course_title") or ""
            snippet = (c.get("chunk_text") or "")[:300]
            sources.append(
                {
                    "course_id": course_id,
                    "course_title": title,
                    "chunk_text": snippet,
                    "similarity": float(c.get("similarity") or 0.0),
                }
            )
        return sources


if __name__ == "__main__":
    rag = RAGService.get_instance()

    # Example 1: Answer question
    question = "What are the basics of Python programming?"
    result = rag.answer_question_with_rag(question)
    print("RAG answer:", result)

    # Example 2: Get recommendations
    profile = {
        "weak_areas": ["loops", "functions"],
        "interests": ["web development"],
    }
    recs = rag.get_course_recommendations(profile)
    print("Recommendations:", recs)

