"""
Sprint 2 integration tests - end-to-end checks for:
- LangChain + Ollama
- Prompt templates
- Question generation
- Course upload and embeddings
- Semantic search

Writes a summary report to sprint2_test_report.txt.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Optional

import db_connection
import embeddings_pipeline
import langchain_ollama
import prompt_templates
import question_generator

try:
    import requests
except ImportError:
    requests = None

try:
    from colorama import Fore, Style, init as colorama_init
except ImportError:  # graceful degradation
    Fore = type("F", (), {"GREEN": "", "RED": "", "YELLOW": "", "CYAN": "", "MAGENTA": "", "RESET": ""})
    Style = type("S", (), {"BRIGHT": "", "RESET_ALL": ""})

    def colorama_init(*args, **kwargs):
        return None


colorama_init(autoreset=True)

ROOT = Path(__file__).resolve().parent
REPORT_PATH = ROOT / "sprint2_test_report.txt"


def _c(text: str, color: str) -> str:
    return f"{color}{text}{Style.RESET_ALL}"


@dataclass
class TestResult:
    name: str
    passed: bool
    details: str = ""
    duration_sec: float = 0.0
    metrics: Dict[str, Any] | None = None


def test_langchain_ollama() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    try:
        t0 = time.perf_counter()
        ok_conn = langchain_ollama.test_ollama_connection()
        conn_time = time.perf_counter() - t0
        metrics["connection_ok"] = ok_conn
        metrics["connection_time_sec"] = round(conn_time, 3)

        prompt = "Summarize Sprint 2 in one short sentence."
        t1 = time.perf_counter()
        resp = langchain_ollama.generate_response(prompt)
        resp_time = time.perf_counter() - t1
        metrics["prompt_time_sec"] = round(resp_time, 3)
        metrics["response_preview"] = (resp or "")[:120]

        passed = ok_conn and bool(resp)
        details = "LangChain+Ollama connection and simple prompt executed."
    except Exception as e:
        passed = False
        details = f"Error: {e}"
    duration = time.perf_counter() - start
    return TestResult("LangChain_Ollama", passed, details, duration, metrics)


def _test_prompt_with_template(prompt: str) -> Dict[str, Any]:
    from question_generator import parse_json_response, validate_question

    resp = langchain_ollama.generate_response(prompt)
    data = parse_json_response(resp)
    valid = False
    if isinstance(data, list) and data:
        data = data[0]
    if isinstance(data, dict):
        valid = validate_question(data)
    return {
        "raw_response_preview": (resp or "")[:160],
        "json_valid": data is not None,
        "question_valid": valid,
    }


def test_prompt_templates() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    try:
        level_prompt = prompt_templates.get_level_test_prompt("Mathematics", "easy", "algebra")
        multi_prompt = prompt_templates.get_multiple_questions_prompt("Programming", "medium", 3, "loops, functions")
        adaptive_prompt = prompt_templates.get_adaptive_question_prompt(
            "Physics", "kinematics", "medium", "student struggled with velocity problems"
        )

        metrics["level"] = _test_prompt_with_template(level_prompt)
        metrics["multiple"] = _test_prompt_with_template(multi_prompt)
        metrics["adaptive"] = _test_prompt_with_template(adaptive_prompt)

        # Pass if at least one template produced valid JSON + valid question (LLM output can vary)
        any_valid = any(
            v.get("json_valid") and v.get("question_valid") for v in metrics.values()
        )
        passed = any_valid
        details = "At least one prompt template produced valid JSON questions." if passed else "No template returned valid JSON question output."
    except Exception as e:
        passed = False
        details = f"Error: {e}"
    duration = time.perf_counter() - start
    return TestResult("Prompt_Templates", passed, details, duration, metrics)


def test_question_generation() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    inserted_ids: List[str] = []
    try:
        # Single question
        q_single = question_generator.generate_level_test_question("Programming", "medium", "loops")
        metrics["single_valid"] = question_generator.validate_question(q_single)

        # Multiple
        qs_multi = question_generator.generate_multiple_questions("Programming", "medium", 3, topics=None)
        metrics["multiple_count"] = len(qs_multi)
        metrics["multiple_all_valid"] = all(question_generator.validate_question(q) for q in qs_multi)

        # Save to DB (attach to synthetic course id label)
        for q in qs_multi[:2]:
            qid = question_generator.save_question_to_db(q, course_id="SPRINT2_TEST_COURSE", source="Sprint2Test")
            if qid:
                inserted_ids.append(qid)
        metrics["saved_question_ids"] = inserted_ids

        passed = bool(q_single) and metrics["single_valid"] and metrics["multiple_all_valid"]
        details = f"Generated {1 + len(qs_multi)} questions; saved {len(inserted_ids)} to DB."
    except Exception as e:
        passed = False
        details = f"Error: {e}"
    duration = time.perf_counter() - start
    metrics["inserted_ids"] = inserted_ids
    return TestResult("Question_Generation", passed, details, duration, metrics)


def _try_api_course_upload(course_payload: Dict[str, Any]) -> Optional[str]:
    if requests is None:
        return None
    try:
        resp = requests.post("http://localhost:8000/upload-course-content", json=course_payload, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("course_id")
    except Exception:
        return None
    return None


def test_course_upload_and_embedding() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    course_id: Optional[str] = None
    title = "Sprint2 Test Course Integration"
    try:
        payload = {
            "course_id": None,
            "title": title,
            "description": "This is a Sprint 2 integration test course about programming fundamentals.",
            "modules": ["intro", "variables", "loops"],
            "level": "beginner",
        }

        # Prefer API, fall back to direct DB + pipeline
        course_id = _try_api_course_upload(payload)
        metrics["via_api"] = bool(course_id)
        if not course_id:
            # direct DB insert
            course_id = db_connection.insert_course(
                {
                    "title": title,
                    "description": payload["description"],
                    "modules": payload["modules"],
                    "level": payload["level"],
                }
            )
            metrics["via_db_direct"] = bool(course_id)
            if not course_id:
                raise RuntimeError("Failed to insert test course into DB")
            ok = embeddings_pipeline.embed_course_by_id(course_id, force_reembed=True)
            metrics["embedded_ok"] = ok
        else:
            metrics["embedded_ok"] = True  # API already embeds

        ctx = embeddings_pipeline.get_course_context(course_id)
        # Avoid bool(embedding) when embedding is a numpy array (ambiguous truth value)
        metrics["context_has_embedding"] = ctx is not None and ctx.get("embedding") is not None

        search_results = embeddings_pipeline.search_similar_courses(title, n_results=3)
        metrics["search_result_count"] = len(search_results)
        metrics["search_top_id"] = search_results[0].get("id") if search_results else None

        passed = metrics["embedded_ok"] and metrics["context_has_embedding"] and metrics["search_result_count"] > 0
        details = "Test course created, embedded, and retrievable via search."
    except Exception as e:
        passed = False
        details = f"Error: {e}"
    duration = time.perf_counter() - start
    metrics["course_id"] = course_id
    return TestResult("Course_Upload_Embedding", passed, details, duration, metrics)


def test_semantic_search_integration() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    try:
        queries = [
            "introduction to programming",
            "mathematics basics",
            "web development",
        ]
        total_time = 0.0
        counts: Dict[str, int] = {}
        for q in queries:
            t0 = time.perf_counter()
            res = embeddings_pipeline.search_similar_courses(q, n_results=5)
            dt = time.perf_counter() - t0
            total_time += dt
            counts[q] = len(res)
        avg_time = total_time / len(queries) if queries else 0.0
        metrics["query_counts"] = counts
        metrics["avg_search_time_sec"] = round(avg_time, 3)
        passed = all(c > 0 for c in counts.values())
        details = "Semantic search returned results for all test queries." if passed else "Some queries returned no results."
    except Exception as e:
        passed = False
        details = f"Error: {e}"
    duration = time.perf_counter() - start
    return TestResult("Semantic_Search", passed, details, duration, metrics)


def cleanup_test_data() -> TestResult:
    start = time.perf_counter()
    metrics: Dict[str, Any] = {}
    deleted_courses = 0
    try:
        # Remove test courses by title prefix and clear their embeddings
        db = getattr(db_connection, "_db", None)
        if db is not None:
            courses_coll = db["courses"]
            test_courses = list(courses_coll.find({"title": {"$regex": "^Sprint2 Test"}}))
            test_ids = [str(c["_id"]) for c in test_courses]
            if test_ids:
                res = courses_coll.delete_many({"_id": {"$in": [c["_id"] for c in test_courses]}})
                deleted_courses = res.deleted_count
                coll = chroma_setup.get_or_create_collection(collection_name="course_embeddings")  # type: ignore[name-defined]
                coll.delete(ids=[str(cid) for cid in test_ids])
        metrics["deleted_courses"] = deleted_courses
        passed = True
        details = f"Deleted {deleted_courses} Sprint2 test courses and cleared their embeddings."
    except Exception as e:
        passed = False
        details = f"Error during cleanup: {e}"
    duration = time.perf_counter() - start
    return TestResult("Cleanup", passed, details, duration, metrics)


def write_report(results: List[TestResult]) -> None:
    summary = {
        "overall_passed": all(r.passed for r in results),
        "tests": [asdict(r) for r in results],
    }
    lines = []
    lines.append("Sprint 2 Integration Test Report")
    lines.append("=" * 32)
    lines.append("")
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        lines.append(f"{r.name}: {status} (duration={r.duration_sec:.3f}s)")
        if r.details:
            lines.append(f"  Details: {r.details}")
        if r.metrics:
            lines.append(f"  Metrics: {json.dumps(r.metrics, indent=2, default=str)}")
        lines.append("")
    lines.append("Overall result: " + ("PASS" if summary["overall_passed"] else "FAIL"))
    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main():
    print(_c("=== Sprint 2 Integration Tests ===", Fore.CYAN))
    results: List[TestResult] = []

    tests = [
        test_langchain_ollama,
        test_prompt_templates,
        test_question_generation,
        test_course_upload_and_embedding,
        test_semantic_search_integration,
    ]

    for fn in tests:
        print(_c(f"\nRunning {fn.__name__}...", Fore.YELLOW))
        res = fn()
        results.append(res)
        status_color = Fore.GREEN if res.passed else Fore.RED
        print(_c(f"{res.name}: {'PASS' if res.passed else 'FAIL'} ({res.duration_sec:.3f}s)", status_color))

    # Optional cleanup prompt
    try:
        choice = input("\nCleanup test data? [y/N]: ").strip().lower()
        if choice == "y":
            print(_c("Running cleanup...", Fore.MAGENTA))
            res = cleanup_test_data()
            results.append(res)
            status_color = Fore.GREEN if res.passed else Fore.RED
            print(_c(f"{res.name}: {'PASS' if res.passed else 'FAIL'} ({res.duration_sec:.3f}s)", status_color))
    except EOFError:
        # Non-interactive environment
        pass

    write_report(results)
    overall_passed = all(r.passed for r in results if r.name != "Cleanup")
    final_color = Fore.GREEN if overall_passed else Fore.RED
    print(_c(f"\nReport written to {REPORT_PATH}", Fore.CYAN))
    print(_c("Overall result: " + ("PASS" if overall_passed else "FAIL"), final_color))


if __name__ == "__main__":
    main()

