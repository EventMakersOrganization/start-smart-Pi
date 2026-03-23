## Sprint 2 – AI Service Integration

### 1. Overview

Sprint 2 focused on building an AI microservice for:

- **Course embeddings and semantic search** using **Ollama** + **ChromaDB**
- **Question generation** for level tests using **LangChain + Ollama**
- A **FastAPI** backend that exposes these capabilities over HTTP

**Technologies used:**

- **Python 3 + FastAPI**
- **LangChain (langchain_core, langchain_community)** + **Ollama**
- **MongoDB** (courses, exercises)
- **ChromaDB** (persistent vector store)
- **Pydantic** (request/response models)
- **Colorama** for colored CLI/test output

**Key achievements:**

- End-to-end pipeline from **course upload → embeddings → semantic search**
- Reusable **question generation utilities** with JSON outputs for MCQs
- **API layer** that the NestJS backend (or any client) can call
- **Test tooling** to validate the full Sprint 2 workflow

---

### 2. Setup Instructions

**Prerequisites**

- Python 3.10+ installed
- MongoDB running locally (default: `mongodb://localhost:27017`)
- Ollama installed and running (e.g. `ollama serve`), with your chosen model (e.g. `llama2`) pulled

**Installation**

- Create and activate a virtual environment (if not already created):

```bash
cd ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1   # PowerShell on Windows
```

- Install dependencies:

```bash
pip install -r requirements.txt
```

**Configuration**

- `.env` (already used by `config.py`):

```env
MONGODB_URI=mongodb://localhost:27017/adaptive-learning
CHROMA_PERSIST_DIRECTORY=./chroma_db
OLLAMA_MODEL=llama2
OLLAMA_BASE_URL=http://localhost:11434
```

Adjust URI/model/paths as needed.

---

### 3. File Structure (Sprint 2 additions)

- `config.py` – environment-based configuration (MongoDB, ChromaDB, Ollama).
- `db_connection.py` – MongoDB client, course helpers, insert helpers (`insert_course`, `insert_exercise`).
- `chroma_setup.py` – ChromaDB persistent client and collection helpers.
- `embeddings_pipeline.py` – core embedding/search pipeline, logging, CLI.
- `langchain_ollama.py` – LangChain-based Ollama LLM wrapper.
- `prompt_templates.py` – LangChain `PromptTemplate` definitions for level/adaptive questions.
- `question_generator.py` – high-level question generation + DB saving.
- `api.py` – FastAPI app exposing embeddings/search/question APIs.
- `test_semantic_search.py` – semantic search tests and interactive search tool.
- `test_sprint2_integration.py` – **Sprint 2 end-to-end integration tests**.
- `README_SPRINT2.md` – this document.

---

### 4. API Endpoints

Base URL (development):

```text
http://localhost:8000
```

Run the API:

```bash
python api.py
```

**Swagger UI:** `http://localhost:8000/docs`

#### 4.1 Root

- **GET `/`**

Returns basic info and an index of available endpoints.

#### 4.2 Embeddings

- **POST `/embed-courses`**

Re-embeds **all** courses from MongoDB into ChromaDB (force re-embed).

Response example:

```json
{
  "status": "success",
  "message": "Processed 10 course(s).",
  "courses_processed": 10
}
```

- **POST `/batch-embed-courses`**

Embeds **only courses without embeddings** (skips existing embeddings).

Response example:

```json
{
  "status": "success",
  "courses_processed": 10,
  "embeddings_created": 3
}
```

#### 4.3 Semantic Search

- **POST `/search`**

Request body:

```json
{
  "query": "programming basics",
  "n_results": 5
}
```

Response:

```json
{
  "status": "success",
  "query": "programming basics",
  "results": [
    {
      "course_id": "64f...",
      "title": "Introduction to Programming",
      "similarity": 0.91,
      "content": "Full text snippet..."
    }
  ]
}
```

- **GET `/search-courses?query=text&n_results=5`**

Same behavior as POST `/search`, but via query params.

#### 4.4 Course Upload & Embeddings

- **POST `/upload-course-content`**

Request body:

```json
{
  "course_id": null,
  "title": "Intro to Programming",
  "description": "Learn the basics of programming.",
  "modules": ["variables", "loops", "functions"],
  "level": "beginner"
}
```

Response:

```json
{
  "status": "success",
  "message": "Course saved and embedding created.",
  "course_id": "652...",
  "embeddings_created": 1
}
```

#### 4.5 Question Generation

- **POST `/generate-level-test`**

Request:

```json
{
  "subject": "Programming",
  "num_questions": 10,
  "difficulty": "medium",
  "course_id": "level-test"
}
```

Response:

```json
{
  "status": "success",
  "questions": [{ "id": "65a..." }],
  "question_ids": ["65a...", "65b..."]
}
```

- **POST `/generate-question`**

Preview-only single question (not saved).

Request:

```json
{
  "subject": "Mathematics",
  "difficulty": "easy",
  "topic": "linear equations"
}
```

Response:

```json
{
  "status": "success",
  "question": {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct_answer": "A",
    "explanation": "..."
  }
}
```

#### 4.6 Health & Maintenance

- **GET `/health`** – checks MongoDB, ChromaDB, and Ollama readiness.
- **DELETE `/reset-embeddings`** – drops and recreates the Chroma collection (use with caution).

---

### 5. Usage Examples

#### 5.1 Generate questions (Python, direct)

```python
from question_generator import generate_level_test_question, generate_multiple_questions

q = generate_level_test_question("Programming", difficulty="medium", topic="loops")
print(q["question"])
print(q["options"])

qs = generate_multiple_questions("Mathematics", difficulty="easy", num_questions=5)
for item in qs:
    print(item["question"])
```

#### 5.2 Embed courses (CLI)

```bash
# Embed all courses, forcing re-embed
python embeddings_pipeline.py --embed-all

# Embed a single course by MongoDB id
python embeddings_pipeline.py --embed-course 652d3b...
```

#### 5.3 Search content (CLI)

```bash
python embeddings_pipeline.py --search "programming basics" --n-results 5
```

#### 5.4 Semantic search tests and interactive mode

```bash
python test_semantic_search.py
```

Then choose:

- **1** – run automated tests
- **2** – interactive search
- **3** – performance benchmark

#### 5.5 Sprint 2 integration tests

```bash
python test_sprint2_integration.py
```

Outputs colored status in the console and writes:

```text
sprint2_test_report.txt
```

---

### 6. Testing

**Core tests**

- `test_semantic_search.py` – targeted semantic search behavior & performance.
- `test_sprint2_integration.py` – full Sprint 2 workflow:
  - LangChain + Ollama
  - Prompt templates
  - Question generation + DB
  - Course upload + embeddings
  - Semantic search

**Expected results**

- All tests **PASS** when:
  - MongoDB is reachable
  - Ollama is running and model is pulled
  - ChromaDB directory is writable

**Troubleshooting**

- If LangChain/Ollama tests fail:
  - Ensure `ollama serve` is running.
  - Check model name in `.env` (`OLLAMA_MODEL`).
- If MongoDB tests fail:
  - Verify `MONGODB_URI` and that MongoDB is running.
- If Chroma errors occur:
  - Delete `./chroma_db` and re-run embeddings or use `DELETE /reset-embeddings`.

---

### 7. Sprint 2 Completion Checklist

- [x] LangChain + Ollama integration  
- [x] Prompt templates created  
- [x] Question generation working  
- [x] API endpoints implemented  
- [x] Embeddings pipeline complete  
- [x] Semantic search tested  

---

### 8. Known Issues and Limitations

- Embedding quality depends on the chosen Ollama model (a dedicated embedding model is recommended).
- Question generation quality depends on model capabilities and may require prompt tuning.
- No authentication is implemented on the API endpoints (development-only setup).
- Multilingual search behavior depends on model multilingual support.

---

### 9. Next Steps (Sprint 3 Preview)

- Add **user-facing analytics** (e.g. question performance dashboards).
- Implement **chatbot/RAG layer** using `get_course_context` and historical student data.
- Harden the API with **auth**, **rate limiting**, and more detailed error codes.
- Add **automated CI tests** and Dockerization for deployment.

---

### 10. Screenshots / Example Outputs

You can capture:

- Swagger UI at `http://localhost:8000/docs`.
- Example JSON responses from:
  - `/search`
  - `/generate-question`
  - `/generate-level-test`
- Console output from:
  - `python test_semantic_search.py`
  - `python test_sprint2_integration.py`

These illustrate the full Sprint 2 workflow working end-to-end.

