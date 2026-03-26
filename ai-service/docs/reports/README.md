# Generated reports

This folder holds **machine-generated** outputs from integration tests and RAG evaluation:

- `sprint2_test_report.txt`, `sprint4_test_report.txt`, `sprint5_test_report.txt` — written by `tests/test_sprint*_integration.py`
- `rag_evaluation_report.json` — written by `tests/test_rag_accuracy.py` (`run_full_evaluation()`)

Paths are created via `core.paths.docs_reports_dir()`.
