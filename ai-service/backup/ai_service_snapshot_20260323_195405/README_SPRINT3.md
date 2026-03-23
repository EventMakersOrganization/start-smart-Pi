## Sprint 3 – RAG Improvements and Unified Service

### 1. Overview

Sprint 3 focused on turning the Sprint 2 semantic search prototype into a **production‑ready RAG (Retrieval‑Augmented Generation) system**:

- **Chunk‑level indexing and retrieval** for courses and documents
- A new **RAG service layer** (`rag_service.py`) as the single entry point for RAG operations
- **Document upload and chunking APIs** for PDFs/TXT/DOCX and existing course data
- A **RAG evaluation suite** to quantify retrieval quality (Precision@K, Recall@K, MRR, NDCG)

Compared to Sprint 2 (full‑document embeddings only), Sprint 3 adds:

- **Finer‑grained retrieval** using intelligently chunked course content
- **Context‑aware question answering** via RAG
- **Course recommendations** driven by retrieved content and student profiles

---

### 2. Key Components

- `document_chunker.py` – intelligent document and course chunking:
  - Recursive text splitting
  - Course‑aware chunks (overview + module chunks)
  - Exercise chunking with metadata
- `embeddings_pipeline_v2.py` – chunk‑based embedding and search pipeline:
  - Dedicated `course_chunks` collection in ChromaDB
  - Chunk embedding, storage, and search helpers
  - Migration from full‑document embeddings (v1) to chunked (v2)
- `rag_service.py` – high‑level RAG interface:
  - Indexing (`add_document`, `bulk_index_courses`)
  - Retrieval (`search`, `get_context_for_query`)
  - RAG Q&A (`answer_question_with_rag`)
  - Course recommendations and health check
- `api.py` – FastAPI endpoints extended with:
  - Document upload + chunking
  - Chunk‑based search
  - Core RAG endpoints (`/rag/answer`, `/rag/recommendations`, `/rag/health`)
- `test_rag_accuracy.py` – retrieval accuracy and comparison harness:
  - Precision@K, Recall@K, MRR, NDCG
  - Compare v1 (full doc) vs v2 (chunks & aggregated)
  - HTML report and JSON report generation

---

### 3. RAG Architecture (ASCII Diagram)

```text
        +-------------------+          +--------------------------+
        |   NestJS / UI     |  HTTP    |   FastAPI AI Service     |
        |  (frontend)       +--------->|        (api.py)          |
        +-------------------+          +------------+-------------+
                                                      |
                                                      v
                                         +-------------------------+
                                         |      RAGService         |
                                         |    (rag_service.py)     |
                                         +-----------+-------------+
                                                     /|\
                                                      |
          +----------------------+   +----------------+-----------------+
          |  Chunking Layer      |   |   Storage & LLM Layer            |
          |  (document_chunker)  |   |  (embeddings_v2, Chroma, Ollama) |
          +----------+-----------+   +----------------+-----------------+
                     |                                |
                     v                                v
        +------------------------+       +-----------------------------+
        |  Course / Exercise     |       |  ChromaDB course_chunks     |
        |  Documents (MongoDB)   |       |  + embeddings_pipeline_v2   |
        +------------------------+       +-----------------------------+
```

---

### 4. Document Chunking Strategy

- **Why chunking?**
  - Full‑document embeddings often dilute signal and mix multiple topics.
  - Chunk‑level retrieval lets the system fetch **just the relevant parts** of a course.
  - RAG answers become **more precise and less hallucination‑prone**.

- **Chunking rules:**
  - **General text**: `chunk_text_recursive(text, chunk_size=500, chunk_overlap=50)`
    - Recursive splitting on paragraphs → sentences → characters
    - Overlap preserves context at chunk boundaries
  - **Courses (`chunk_course_content`)**:
    - **Chunk 1**: `title + description` (overview)
    - **Subsequent chunks**: modules combined until a minimum size threshold
    - Metadata includes `course_title`, `module_name`, `chunk_index`
  - **Exercises (`chunk_exercise_content`)**:
    - Single focused chunk with:
      - Question text
      - Type and difficulty
      - Options (if present) and exercise ID

- **Metadata preservation:**
  - Each chunk is stored in Chroma with:
    - `course_id`, `chunk_type`, `chunk_index`
    - `course_title`, `module_name`
  - This allows:
    - Per‑course aggregation of chunk scores
    - Clean source formatting in RAG answers

---

### 5. Retrieval Accuracy (v1 vs v2)

`test_rag_accuracy.py` provides:

- A configurable set of **test queries** with expected topics/keywords
- Metrics:
  - **Precision@5** – relevant courses in top 5
  - **Recall@5** – how many relevant courses are recovered
  - **MRR** – rank of the first relevant result
  - **NDCG@5** – ranking quality, not just presence
- Comparison functions:
  - `compare_search_methods()`:
    - **v1** – full‑document search (`embeddings_pipeline`)
    - **v2 chunks** – chunk‑level search
    - **v2 aggregated** – chunk scores aggregated per course

Typical outcome (example pattern, actual numbers depend on data):

- v2 (chunk or aggregated) improves:
  - **Precision@5**: more of the top results are truly relevant
  - **Recall@5**: more of the relevant courses are found
  - **NDCG@5**: relevant courses appear higher in the ranking

Reports:

- JSON: `rag_evaluation_report.json`
- HTML: `rag_report.html`

---

### 6. API Endpoints (Sprint 3 Additions)

Existing Sprint 2 endpoints remain, plus the following:

- **Chunking & indexing**
  - `POST /upload-document`
    - Upload and index a document (PDF/TXT/DOCX) with chunking.
  - `POST /upload-course-chunked`
    - Chunk‑based indexing for an existing course (`course_id` or full course object).
  - `POST /batch-process-chunks`
    - Process **all courses** using the chunked embedding pipeline.

- **Chunk‑based search**
  - `POST /search-chunks`
    - Body: `{ "query": str, "n_results": int, "aggregate_by_course": bool }`
    - Returns either:
      - Individual chunk matches (with content, similarity, metadata), or
      - Aggregated per‑course scores with top chunk snippets.

- **RAG core**
  - `POST /rag/answer`
    - Body: `{ "question": "..." , "max_chunks": 5 }`
    - Returns: `{ "answer", "sources", "confidence" }`
  - `POST /rag/recommendations`
    - Body: `{ "student_profile": { ... }, "n_results": 3 }`
    - Returns ranked course recommendations.
  - `GET /rag/health`
    - Aggregated health of MongoDB, ChromaDB, and the Ollama LLM.

New `/search` (existing endpoint) now delegates to `RAGService.search`, using **chunk‑aggregated course scores** under the hood.

---

### 7. Usage Examples

Assuming `uvicorn api:app --reload --port 8000` from `ai-service`:

#### 7.1 Upload a document (TXT/PDF/DOCX)

```bash
curl -X POST "http://localhost:8000/upload-document" ^
  -H "accept: application/json" ^
  -H "Content-Type: multipart/form-data" ^
  -F "file=@path/to/course_notes.txt" ^
  -F "doc_type=general" ^
  -F "metadata={\"course_id\":\"<optional-course-id>\",\"chunk_size\":500,\"chunk_overlap\":50}"
```

#### 7.2 Search with RAG (course‑level)

```bash
curl -X POST "http://localhost:8000/search" ^
  -H "Content-Type: application/json" ^
  -d "{\"query\": \"learn python loops\", \"n_results\": 5}"
```

#### 7.3 Chunk‑level search

```bash
curl -X POST "http://localhost:8000/search-chunks" ^
  -H "Content-Type: application/json" ^
  -d "{\"query\": \"for loops in python\", \"n_results\": 10, \"aggregate_by_course\": false}"
```

#### 7.4 Answer a question with RAG

```bash
curl -X POST "http://localhost:8000/rag/answer" ^
  -H "Content-Type: application/json" ^
  -d "{\"question\": \"What are the basics of Python programming?\", \"max_chunks\": 5}"
```

#### 7.5 Get course recommendations

```bash
curl -X POST "http://localhost:8000/rag/recommendations" ^
  -H "Content-Type: application/json" ^
  -d "{
        \"student_profile\": {
          \"weak_areas\": [\"loops\", \"functions\"],
          \"interests\": [\"web development\"]
        },
        \"n_results\": 3
      }"
```

---

### 8. Testing and Evaluation

From `ai-service`:

```bash
python test_rag_accuracy.py
```

Menu options:

- **1 – Run full evaluation**
  - Runs comparisons and writes `rag_evaluation_report.json`.
- **2 – Compare chunking strategies**
  - Evaluates the current chunk configuration (note: real chunk size/overlap comparison would re‑embed data per config).
- **3 – Compare search methods**
  - Full‑document vs chunk vs aggregated chunk search.
- **4 – Analyze specific query**
  - Shows retrieved chunks and similarity scores for a query.
- **5 – Generate HTML report**
  - Writes `rag_report.html` with a metrics summary.
- **6 – Analyze failed queries**
  - Lists low‑precision queries and suggests adding better labels/ground truth.

Expected behaviour:

- Chunk‑based and aggregated search should outperform v1 full‑document search on most RAG‑style queries.
- Reports and tables help guide future tuning (chunk sizes, prompts, etc.).

---

### 9. Integration Guidelines

#### 9.1 NestJS backend

- Call RAG endpoints from the NestJS AI integration module:
  - `/rag/answer` – for chatbot‑style answers with context
  - `/rag/recommendations` – for personalized course suggestions
  - `/search` or `/search-chunks` – for search UIs
- Keep existing Sprint 2 endpoints for backwards compatibility where needed (`/embed-courses`, `/generate-level-test`, etc.).

Typical usage (NestJS service pseudocode):

```ts
const res = await this.http.post(`${AI_SERVICE_URL}/rag/answer`, {
  question,
  max_chunks: 5,
}).toPromise();

return res.data; // { answer, sources, confidence }
```

#### 9.2 Frontend (Angular)

- Use the AI service to:
  - Search: call `POST /search` or `POST /search-chunks`
  - Ask questions: call `POST /rag/answer`
  - Show recommendations: call `POST /rag/recommendations`
- Student dashboard can surface:
  - Suggested courses (from recommendations)
  - Explanations / tutoring answers with their sources.

---

### 10. Sprint 3 Completion Checklist

- [x] **Document chunking implemented** (`document_chunker.py`)
- [x] **Enhanced embeddings pipeline v2** (`embeddings_pipeline_v2.py`)
- [x] **Semantic search with chunks** (`search_chunks`, `/search-chunks`, `/search`)
- [x] **RAG accuracy testing suite** (`test_rag_accuracy.py`)
- [x] **API endpoints for document upload & chunking** (`/upload-document`, `/upload-course-chunked`, `/batch-process-chunks`)
- [x] **RAG service interface** (`rag_service.py`)
- [x] **Integration ready** (NestJS + frontend can call clean RAG endpoints)

---

### 11. Performance Metrics (Targets / Observations)

Exact numbers depend on dataset and hardware, but the system is designed for:

- **Search latency**:
  - Typical query → embedding → Chroma search: **tens to low hundreds of ms** (excluding LLM answer generation).
- **Indexing speed**:
  - Chunking + embedding per course depends on model speed; designed to run in batch via:
    - `POST /batch-process-chunks`
    - or `RAGService.bulk_index_courses`.
- **Accuracy metrics**:
  - Tracked via:
    - Precision@5, Recall@5
    - MRR, NDCG@5
  - v2 chunk‑based retrieval is expected to **outperform** v1 on most RAG‑style queries.

---

### 12. Next Steps – Sprint 4 Preview

- **Context‑aware chatbot**
  - Multi‑turn conversations using RAG context windows
  - Conversation memory and follow‑up question handling
- **Hallucination reduction**
  - More conservative prompting and answer styles
  - Explicit “I don’t know” / “Not in context” responses
  - Source highlighting and explanation auditing
- **BrainRush integration**
  - Use RAG results to drive adaptive quizzes
  - Track student progress and adapt future recommendations
  - Close the loop: RAG answers → learning analytics → next recommendations

