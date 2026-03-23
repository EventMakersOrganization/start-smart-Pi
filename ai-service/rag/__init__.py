"""
RAG: chunking (heavy submodules imported on demand to avoid circular imports).
"""

from . import document_chunker

__all__ = ["document_chunker"]
