"""Unit tests for rag.document_chunker — pure text processing, no services."""
import pytest

from rag.document_chunker import (
    chunk_text_recursive,
    _chunk_fallback,
    chunk_by_sentences,
    chunk_course_content,
    chunk_exercise_content,
)


class TestChunkTextRecursive:
    def test_basic_split(self):
        text = "Hello world. " * 100
        chunks = chunk_text_recursive(text, chunk_size=100, chunk_overlap=10)
        assert len(chunks) > 1
        for c in chunks:
            assert len(c) <= 110  # chunk_size + some tolerance

    def test_empty_text(self):
        assert chunk_text_recursive("") == []
        assert chunk_text_recursive("   ") == []

    def test_short_text(self):
        chunks = chunk_text_recursive("Short text.", chunk_size=500)
        assert len(chunks) == 1
        assert chunks[0] == "Short text."


class TestChunkFallback:
    def test_basic(self):
        text = "A" * 200
        chunks = _chunk_fallback(text, chunk_size=50, chunk_overlap=10)
        assert len(chunks) > 1
        assert chunks[0] == "A" * 50

    def test_empty(self):
        assert _chunk_fallback("", 50, 10) == []


class TestChunkBySentences:
    def test_splits_sentences(self):
        text = "First sentence. Second sentence. Third sentence. Fourth. Fifth. Sixth."
        chunks = chunk_by_sentences(text, max_sentences=3)
        assert len(chunks) >= 2

    def test_empty(self):
        assert chunk_by_sentences("") == []


class TestChunkCourseContent:
    def test_course_with_modules(self):
        course = {
            "id": "c1",
            "title": "Python Basics",
            "description": "Learn Python fundamentals.",
            "modules": [
                {"title": "Variables", "description": "Variables store data. " * 30},
                {"title": "Loops", "description": "For loops iterate over sequences. " * 30},
            ],
        }
        chunks = chunk_course_content(course)
        assert len(chunks) >= 2
        assert all("course_id" in c for c in chunks)

    def test_course_empty_modules(self):
        course = {"id": "c2", "title": "Empty", "description": "No modules.", "modules": []}
        chunks = chunk_course_content(course)
        assert len(chunks) >= 1  # at least overview chunk


class TestChunkExerciseContent:
    def test_exercise(self):
        exercise = {
            "id": "e1",
            "courseId": "c1",
            "content": "Write a function to add two numbers.",
            "difficulty": "easy",
        }
        chunk = chunk_exercise_content(exercise)
        assert isinstance(chunk, dict)
        assert "chunk_text" in chunk or "text" in chunk or "metadata" in chunk
