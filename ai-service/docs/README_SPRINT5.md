# Sprint 5 — Embedding optimization & advanced retrieval

Sprint 5 adds:

- **Embedding optimizer** — batch/parallel Ollama calls, in-memory cache (`embeddings/embedding_optimizer.py`)
- **Batch embedding processor** — course batches → Chroma (`embeddings/batch_embedding_processor.py`)
- **Disk embedding cache** — LRU + pickle persistence (`embeddings/embedding_cache.py`)
- **Multi-document retriever** — courses / exercises / documents + RRF fusion (`search/multi_document_retriever.py`)
- **Metadata filtering** — Chroma `where` builders (`search/metadata_filter.py`)
- **API routes** — `/embeddings/*`, `/search/advanced`, `/search/filtered`, `/retrieval/multi-source`, `/optimization/benchmark`, etc. (see `api.py`)

Integration tests: `tests/test_sprint5_integration.py`
