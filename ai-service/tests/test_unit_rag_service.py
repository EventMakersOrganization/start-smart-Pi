"""Unit tests for core.rag_service using mocked dependencies."""
from __future__ import annotations

from unittest.mock import patch


def test_search_returns_ranked_course_results():
    from core.rag_service import RAGService

    fake_aggregated = [
        {
            "course_id": "c1",
            "total_similarity": 0.9,
            "chunks": [{"chunk_text": "Loops basics", "metadata": {"course_title": "Prog 1"}}],
        },
        {
            "course_id": "c2",
            "total_similarity": 0.6,
            "chunks": [{"chunk_text": "Functions intro", "metadata": {"course_title": "Prog 2"}}],
        },
    ]

    with patch("core.rag_service.chroma_setup.get_chroma_client"), \
         patch("core.rag_service.embeddings_pipeline_v2.search_and_aggregate_by_course", return_value=fake_aggregated), \
         patch("core.rag_service.db_connection.get_course_by_id", side_effect=lambda cid: {"title": f"title-{cid}", "description": f"desc-{cid}"}):
        svc = RAGService()
        out = svc.search("loops", n_results=2)

    assert len(out) == 2
    assert out[0]["course_id"] == "c1"
    assert out[0]["title"] == "title-c1"
    assert out[0]["similarity"] >= out[1]["similarity"]


def test_answer_question_with_rag_contract():
    from core.rag_service import RAGService

    fake_chunks = [
        {
            "chunk_text": "A variable stores a value.",
            "course_id": "c1",
            "similarity": 0.8,
            "metadata": {"course_title": "Programming"},
        }
    ]

    with patch("core.rag_service.chroma_setup.get_chroma_client"), \
         patch("core.rag_service.embeddings_pipeline_v2.search_chunks", return_value=fake_chunks), \
         patch("core.rag_service.langchain_ollama.generate_response", return_value="A variable stores data."), \
         patch("core.rag_service.db_connection.get_course_by_id", return_value={"title": "Programming"}):
        svc = RAGService()
        out = svc.answer_question_with_rag("What is a variable?", max_chunks=3)

    assert "answer" in out
    assert "sources" in out
    assert "confidence" in out
    assert out["answer"] != ""
    assert 0.0 <= float(out["confidence"]) <= 1.0
