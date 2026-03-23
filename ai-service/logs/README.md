# Runtime logs

Log files written by embedding pipelines and batch jobs:

| File | Writer |
|------|--------|
| `embeddings.log` | `embeddings/embeddings_pipeline.py` |
| `embeddings_error.log` | `embeddings/embeddings_pipeline.py` (errors) |
| `embeddings_v2.log` | `embeddings/embeddings_pipeline_v2.py` |
| `batch_processing.log` | `embeddings/batch_embedding_processor.py` |

Paths are resolved via `core.paths.logs_dir()` (always under this `logs/` folder).
