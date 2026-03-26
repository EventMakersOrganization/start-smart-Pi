# StartSmart AI Service

FastAPI microservice for **course embeddings**, **semantic search**, **RAG** (retrieval-augmented generation), **question generation** (including BrainRush), and **embedding optimization**. It connects to **MongoDB** (courses), **ChromaDB** (vectors), and **Ollama** (embeddings + LLM).

---

## 1. Project overview

| Area | Role |
|------|------|
| **Core** | Config (`.env`), MongoDB access, Chroma client, unified `RAGService` |
| **Embeddings** | V1/V2 pipelines, optimizer, batch processor, disk cache |
| **RAG** | Chunking, prompts, hallucination guard, relevance scoring |
| **Search** | Multi-source retrieval, metadata filters |
| **Generation** | Level-test questions, BrainRush, validators, prompts |
| **Utils** | LangChain ↔ Ollama bridge |
| **Tests** | Integration and accuracy tests |
| **Cache / logs** | Runtime cache dir and log output (configure paths in code or `.env`) |
| **Docs** | Sprint notes and demos |

**Technologies:** Python 3.11+, FastAPI, Uvicorn, pymongo, chromadb, ollama (HTTP API), LangChain (optional).

---

## 2. Directory structure

```
ai-service/
├── api.py                 # FastAPI app entry (run from this folder)
├── requirements.txt
├── .env                   # Secrets (not committed)
├── seed_data.py           # Sample Mongo data
├── reorganize_files.py    # One-time layout helper (optional)
│
├── core/                  # Config, DB, Chroma, RAGService
├── embeddings/            # Pipelines, optimizer, cache, batch processor
├── rag/                   # Chunking, prompts, guard, relevance scorer
├── search/                # Multi-doc retriever, metadata_filter
├── generation/            # Questions, BrainRush, validator, templates
├── utils/                 # langchain_ollama
├── optimization/          # Reserved / future tuning utilities
├── tests/                 # All *test*.py integration scripts
├── cache/                 # Optional local cache (e.g. embedding_cache default)
├── logs/                  # Embedding & batch logs (see logs/README.md)
├── docs/                  # Sprint READMEs, demos
│   └── reports/           # sprint*_test_report.txt, rag_evaluation_report.json
└── …
```

---

## 3. Setup

### Prerequisites

- Python 3.11+
- MongoDB (local or URI)
- ChromaDB (persistent dir — default `./chroma_db` under `ai-service`)
- Ollama with an embedding + chat model (e.g. `llama2`)

### Installation

```bash
cd ai-service
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### Environment

Copy or create `.env` in **`ai-service/`** (same folder as `api.py`):

- `MONGODB_URI`, `MONGODB_DB_NAME`
- `CHROMA_PERSIST_DIRECTORY` (e.g. `./chroma_db`)
- `OLLAMA_MODEL`, `OLLAMA_BASE_URL`

### Database

Start MongoDB; use `seed_data.py` if you need sample courses:

```bash
python seed_data.py
```

### Ollama

Install [Ollama](https://ollama.com), pull a model, ensure the API is listening (default `http://localhost:11434`).

---

## 4. Running the API

From **`ai-service`**:

```bash
python api.py
```

Or:

```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

| URL | Purpose |
|-----|---------|
| **http://localhost:8000/docs** | Swagger UI |
| **http://localhost:8000/redoc** | ReDoc |
| **GET /health** | Mongo + Chroma + Ollama check |

Imports assume the **ai-service directory is on `PYTHONPATH`** (running `python api.py` adds it automatically).

---

## 5. Project structure (packages)

Python packages use **absolute imports** from the repo root folder `ai-service/`:

- `from core import config, db_connection, chroma_setup`
- `from core.rag_service import RAGService`
- `from embeddings import embeddings_pipeline_v2`
- `from rag import document_chunker`
- `from generation import question_generator`
- `from search.metadata_filter import MetadataFilter`

---

## 6. Sprint progress

| Sprint | Status | Doc |
|--------|--------|-----|
| Sprint 1 | Foundation | — |
| Sprint 2 | ✅ | [docs/README_SPRINT2.md](docs/README_SPRINT2.md) |
| Sprint 3 | ✅ | [docs/README_SPRINT3.md](docs/README_SPRINT3.md) |
| Sprint 4 | ✅ | [docs/README_SPRINT4.md](docs/README_SPRINT4.md) |
| Sprint 5 | ✅ | [docs/README_SPRINT5.md](docs/README_SPRINT5.md) |
| Sprint 6 | 🚧 In progress | — |

---

## 7. Testing

Run from **`ai-service`**:

```bash
# Single integration suite (example)
python tests/test_sprint5_integration.py

# Or pytest
pytest tests/ -q
```

Integration test reports are written under **`docs/reports/`** (e.g. `sprint4_test_report.txt`, `sprint5_test_report.txt`, `rag_evaluation_report.json`).

Performance / benchmarks are included in Sprint 5 tests and optional API route `GET /optimization/benchmark`.

---

## 8. Documentation

- Sprint notes: **`docs/README_SPRINT2.md`** … **`docs/README_SPRINT5.md`**
- **Swagger:** `/docs` when the server is running
- Architecture: see sections above and inline docstrings in `core/rag_service.py`

---

## 9. Contributing

- Prefer **type hints** and **small, focused** modules under the package that fits the feature.
- After moving files, keep **`sys.path`** behavior: run CLI entrypoints from `ai-service/` or install as a package.
- Add or update **`tests/`** for new endpoints or retrieval behavior.
- Run **`python -m py_compile api.py`** and a quick **`import api`** smoke test before committing.

---

## 10. Sprint links

- [Sprint 2 README](docs/README_SPRINT2.md)
- [Sprint 3 README](docs/README_SPRINT3.md)
- [Sprint 4 README](docs/README_SPRINT4.md)
- [Sprint 5 README](docs/README_SPRINT5.md)

---

## Troubleshooting

- **`ImportError` / circular import:** Run from `ai-service/`; avoid importing half-initialized packages from `__init__.py` in tight cycles.
- **`.env` not found:** Path is resolved to **`ai-service/.env`** (parent of `core/config.py`).
- **Chroma / Mongo connection errors:** Check `GET /health` and env vars.
