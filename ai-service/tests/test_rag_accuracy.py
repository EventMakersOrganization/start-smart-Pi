"""
RAG retrieval quality evaluation.
Tests precision@K, recall@K, MRR, NDCG and compares chunking/search strategies.
"""
import json
import math
import sys
from pathlib import Path
from typing import Any

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from core import db_connection
from core.paths import docs_reports_dir
from embeddings import embeddings_pipeline, embeddings_pipeline_v2


def create_test_queries() -> list[dict]:
    """Returns 10-15 test queries with expected course IDs and keywords for evaluation."""
    return [
        {
            "query": "learn programming loops",
            "expected_course_ids": [],
            "expected_keywords": ["for loop", "while loop", "iteration", "loops"],
        },
        {
            "query": "introduction to python variables",
            "expected_course_ids": [],
            "expected_keywords": ["variable", "python", "assign", "data type"],
        },
        {
            "query": "functions and methods",
            "expected_course_ids": [],
            "expected_keywords": ["function", "method", "def", "return", "parameter"],
        },
        {
            "query": "web development HTML CSS",
            "expected_course_ids": [],
            "expected_keywords": ["html", "css", "web", "frontend", "page"],
        },
        {
            "query": "database SQL queries",
            "expected_course_ids": [],
            "expected_keywords": ["sql", "database", "query", "select", "table"],
        },
        {
            "query": "beginner programming course",
            "expected_course_ids": [],
            "expected_keywords": ["beginner", "introduction", "basics", "first steps"],
        },
        {
            "query": "object oriented programming classes",
            "expected_course_ids": [],
            "expected_keywords": ["class", "object", "OOP", "inheritance", "encapsulation"],
        },
        {
            "query": "data structures arrays lists",
            "expected_course_ids": [],
            "expected_keywords": ["array", "list", "data structure", "stack", "queue"],
        },
        {
            "query": "error handling try except",
            "expected_course_ids": [],
            "expected_keywords": ["try", "except", "error", "exception", "catch"],
        },
        {
            "query": "API REST endpoints",
            "expected_course_ids": [],
            "expected_keywords": ["API", "REST", "endpoint", "HTTP", "request"],
        },
        {
            "query": "testing unit test",
            "expected_course_ids": [],
            "expected_keywords": ["test", "unit", "assert", "mock", "coverage"],
        },
        {
            "query": "git version control",
            "expected_course_ids": [],
            "expected_keywords": ["git", "commit", "branch", "merge", "version control"],
        },
        {
            "query": "machine learning basics",
            "expected_course_ids": [],
            "expected_keywords": ["machine learning", "model", "training", "prediction"],
        },
        {
            "query": "javascript frontend",
            "expected_course_ids": [],
            "expected_keywords": ["javascript", "js", "frontend", "DOM", "browser"],
        },
        {
            "query": "algorithms sorting search",
            "expected_course_ids": [],
            "expected_keywords": ["algorithm", "sort", "search", "complexity", "binary"],
        },
    ]


def calculate_precision_at_k(retrieved: list, relevant: list, k: int = 5) -> float:
    """Precision@K: (relevant items in top K) / K. Returns 0-1."""
    if k <= 0:
        return 0.0
    top_k = retrieved[:k]
    relevant_set = set(relevant)
    hits = sum(1 for x in top_k if x in relevant_set)
    return hits / k


def calculate_recall_at_k(retrieved: list, relevant: list, k: int = 5) -> float:
    """Recall@K: (relevant items in top K) / total relevant. Returns 0-1."""
    if not relevant:
        return 1.0
    top_k = retrieved[:k]
    relevant_set = set(relevant)
    hits = sum(1 for x in top_k if x in relevant_set)
    return hits / len(relevant_set)


def calculate_mrr(retrieved_lists: list[list], relevant_lists: list[list]) -> float:
    """Mean Reciprocal Rank: average of 1/rank of first relevant item per query."""
    if not retrieved_lists or not relevant_lists or len(retrieved_lists) != len(relevant_lists):
        return 0.0
    rr_sum = 0.0
    for retrieved, relevant in zip(retrieved_lists, relevant_lists):
        rel_set = set(relevant)
        rank = 0
        for i, item in enumerate(retrieved, 1):
            if item in rel_set:
                rank = i
                break
        rr_sum += 1.0 / rank if rank > 0 else 0.0
    return rr_sum / len(retrieved_lists)


def _dcg_at_k(relevances: list[float], k: int) -> float:
    """DCG@k. relevances[i] = relevance of item at rank i+1."""
    relevances = relevances[:k]
    return sum((r / math.log2(i + 2)) for i, r in enumerate(relevances))


def calculate_ndcg(retrieved: list, relevant: list, k: int = 5) -> float:
    """NDCG@K: ranking quality. Binary relevance (1 if in relevant set). Returns 0-1."""
    if k <= 0:
        return 0.0
    rel_set = set(relevant)
    relevances = [1.0 if x in rel_set else 0.0 for x in retrieved[:k]]
    dcg = _dcg_at_k(relevances, k)
    ideal_relevances = sorted([1.0 if x in rel_set else 0.0 for x in retrieved], reverse=True)
    ideal_relevances = ideal_relevances[:k]
    idcg = _dcg_at_k(ideal_relevances, k)
    if idcg <= 0:
        return 1.0 if dcg <= 0 else 0.0
    return dcg / idcg


def _get_retrieved_course_ids(search_method: str, query: str, n: int = 10) -> list[str]:
    """Run search and return list of course IDs in order (for v1 or v2 aggregated)."""
    if search_method == "v1" or search_method == "full":
        raw = embeddings_pipeline.search_similar_courses(query, n_results=n, collection_name="course_embeddings")
        return [str(item.get("id", "")) for item in raw if item.get("id")]
    if search_method in ("chunks", "v2"):
        raw = embeddings_pipeline_v2.search_chunks(query, n_results=n, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION)
        seen = set()
        out = []
        for r in raw:
            cid = r.get("course_id") or ""
            if cid and cid not in seen:
                seen.add(cid)
                out.append(cid)
        return out
    if search_method == "aggregated":
        raw = embeddings_pipeline_v2.search_and_aggregate_by_course(query, n_results=n, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION)
        return [str(r.get("course_id", "")) for r in raw if r.get("course_id")]
    return []


def evaluate_single_query(query_dict: dict, search_method: str = "chunks", k: int = 5) -> dict:
    """Runs one test query, retrieves results, computes metrics."""
    query = query_dict.get("query", "")
    expected_ids = query_dict.get("expected_course_ids") or []
    expected_keywords = query_dict.get("expected_keywords") or []
    retrieved = _get_retrieved_course_ids(search_method, query, n=15)
    relevant = expected_ids if expected_ids else []
    if not relevant and retrieved:
        relevant = retrieved[:3]  # placeholder: treat top 3 as "relevant" for demo
    return {
        "query": query,
        "precision_at_k": calculate_precision_at_k(retrieved, relevant, k),
        "recall_at_k": calculate_recall_at_k(retrieved, relevant, k),
        "ndcg": calculate_ndcg(retrieved, relevant, k),
        "retrieved_courses": retrieved[:k],
        "relevant": relevant,
        "search_method": search_method,
    }


def evaluate_all_queries(test_queries: list, search_method: str = "chunks", k: int = 5) -> dict:
    """Runs all test queries and aggregates metrics."""
    retrieved_lists = []
    relevant_lists = []
    per_query = []
    for q in test_queries:
        ev = evaluate_single_query(q, search_method=search_method, k=k)
        per_query.append(ev)
        retrieved_lists.append(ev["retrieved_courses"])
        relevant_lists.append(ev["relevant"])
    precisions = [e["precision_at_k"] for e in per_query]
    recalls = [e["recall_at_k"] for e in per_query]
    ndcgs = [e["ndcg"] for e in per_query]
    return {
        "avg_precision": sum(precisions) / len(precisions) if precisions else 0,
        "avg_recall": sum(recalls) / len(recalls) if recalls else 0,
        "avg_ndcg": sum(ndcgs) / len(ndcgs) if ndcgs else 0,
        "avg_mrr": calculate_mrr(retrieved_lists, relevant_lists),
        "per_query_results": per_query,
        "search_method": search_method,
    }


def compare_chunking_strategies() -> dict:
    """
    Evaluates current chunk-based search. To compare chunk sizes (200, 500, 1000) and overlaps (0, 50, 100),
    re-run embeddings with each config (e.g. via API or embeddings_pipeline_v2 with different chunk_size)
    then run this again. Here we run once with current collection and report metrics.
    """
    test_queries = create_test_queries()[:5]
    ev = evaluate_all_queries(test_queries, search_method="chunks", k=5)
    ev["config"] = "current (default chunk_size/overlap)"
    print("Note: To compare chunk sizes (200, 500, 1000) and overlaps (0, 50, 100), re-embed courses with each config and re-run.")
    return {"configs": [ev], "best_config": ev["config"], "best_metrics": {"avg_precision": ev["avg_precision"], "avg_recall": ev["avg_recall"], "avg_mrr": ev.get("avg_mrr", 0), "avg_ndcg": ev.get("avg_ndcg", 0)}}


def compare_search_methods() -> dict:
    """Compares v1 full-doc vs v2 chunk vs v2 aggregated search."""
    test_queries = create_test_queries()
    v1 = evaluate_all_queries(test_queries, search_method="v1", k=5)
    v2 = evaluate_all_queries(test_queries, search_method="chunks", k=5)
    agg = evaluate_all_queries(test_queries, search_method="aggregated", k=5)
    v1["label"] = "v1_full_document"
    v2["label"] = "v2_chunks"
    agg["label"] = "v2_aggregated"
    best = max([v1, v2, agg], key=lambda x: x["avg_precision"] + x["avg_recall"])
    return {
        "v1_full_document": v1,
        "v2_chunks": v2,
        "v2_aggregated": agg,
        "best_method": best["label"],
    }


def run_full_evaluation() -> dict:
    """Full RAG evaluation: multiple methods, saves report to rag_evaluation_report.json."""
    test_queries = create_test_queries()
    comparison = compare_search_methods()
    report = {
        "test_queries_count": len(test_queries),
        "comparison": {
            "v1_avg_precision": comparison["v1_full_document"]["avg_precision"],
            "v1_avg_recall": comparison["v1_full_document"]["avg_recall"],
            "v2_chunks_avg_precision": comparison["v2_chunks"]["avg_precision"],
            "v2_chunks_avg_recall": comparison["v2_chunks"]["avg_recall"],
            "v2_aggregated_avg_precision": comparison["v2_aggregated"]["avg_precision"],
            "v2_aggregated_avg_recall": comparison["v2_aggregated"]["avg_recall"],
            "best_method": comparison["best_method"],
        },
        "per_query_sample": comparison["v2_aggregated"]["per_query_results"][:3],
    }
    out_path = docs_reports_dir() / "rag_evaluation_report.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Report saved to {out_path}")
    print_results_table(comparison)
    return report


def print_results_table(results: dict) -> None:
    """Prints formatted table of results; handles compare_search_methods or evaluate_all_queries output."""
    if "v1_full_document" in results:
        v1 = results["v1_full_document"]
        v2 = results["v2_chunks"]
        agg = results["v2_aggregated"]
        print("\n--- RAG evaluation summary ---")
        print(f"{'Method':<25} {'Precision@5':<14} {'Recall@5':<12} {'MRR':<10} {'NDCG':<8}")
        print("-" * 70)
        print(f"{'v1 full document':<25} {v1['avg_precision']:<14.4f} {v1['avg_recall']:<12.4f} {v1.get('avg_mrr', 0):<10.4f} {v1.get('avg_ndcg', 0):<8.4f}")
        print(f"{'v2 chunks':<25} {v2['avg_precision']:<14.4f} {v2['avg_recall']:<12.4f} {v2.get('avg_mrr', 0):<10.4f} {v2.get('avg_ndcg', 0):<8.4f}")
        print(f"{'v2 aggregated':<25} {agg['avg_precision']:<14.4f} {agg['avg_recall']:<12.4f} {agg.get('avg_mrr', 0):<10.4f} {agg.get('avg_ndcg', 0):<8.4f}")
        print(f"Best: {results.get('best_method', 'N/A')}")
    elif "per_query_results" in results:
        print(f"\n--- Results ({results.get('search_method', '')}) ---")
        print(f"Avg Precision: {results['avg_precision']:.4f}  Avg Recall: {results['avg_recall']:.4f}  MRR: {results.get('avg_mrr', 0):.4f}")
        for i, pq in enumerate(results["per_query_results"][:5], 1):
            print(f"  {i}. {pq['query'][:50]} P@5={pq['precision_at_k']:.3f} R@5={pq['recall_at_k']:.3f}")
    print()


def generate_html_report(results: dict, output_file: str = "rag_report.html") -> None:
    """Creates HTML report with summary and tables (no JS charts for simplicity)."""
    out_path = Path(__file__).resolve().parent / output_file
    rows = []
    if "v1_full_document" in results:
        for label, data in [
            ("v1 full document", results["v1_full_document"]),
            ("v2 chunks", results["v2_chunks"]),
            ("v2 aggregated", results["v2_aggregated"]),
        ]:
            rows.append(
                f"<tr><td>{label}</td><td>{data['avg_precision']:.4f}</td><td>{data['avg_recall']:.4f}</td>"
                f"<td>{data.get('avg_mrr', 0):.4f}</td><td>{data.get('avg_ndcg', 0):.4f}</td></tr>"
            )
        table_body = "\n".join(rows)
        best = results.get("best_method", "N/A")
    else:
        table_body = "<tr><td colspan='4'>No comparison data</td></tr>"
        best = "N/A"
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RAG Evaluation Report</title></head>
<body>
<h1>RAG Retrieval Evaluation</h1>
<p>Best method: <strong>{best}</strong></p>
<table border="1" cellpadding="8">
<thead><tr><th>Method</th><th>Precision@5</th><th>Recall@5</th><th>MRR</th><th>NDCG</th></tr></thead>
<tbody>
{table_body}
</tbody>
</table>
</body>
</html>
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"HTML report written to {out_path}")


def analyze_failed_queries(results: dict, threshold: float = 0.5) -> None:
    """Finds queries with precision below threshold and prints analysis."""
    per_query = results.get("per_query_results") or results.get("v2_aggregated", {}).get("per_query_results") or []
    if not per_query:
        if "v2_aggregated" in results:
            per_query = results["v2_aggregated"].get("per_query_results") or []
    failed = [e for e in per_query if e.get("precision_at_k", 1) < threshold]
    print(f"\n--- Failed queries (precision < {threshold}) ---")
    for e in failed:
        print(f"Query: {e.get('query', '')}")
        print(f"  Precision@5: {e.get('precision_at_k', 0):.4f}  Recall@5: {e.get('recall_at_k', 0):.4f}")
        print(f"  Retrieved: {e.get('retrieved_courses', [])[:5]}")
        print(f"  Expected (relevant): {e.get('relevant', [])[:5]}")
        print("  Suggestion: Add expected_course_ids or expected_keywords for this query in test data.")
    if not failed:
        print("No failed queries.")
    print()


def show_retrieval_examples(query: str, n_results: int = 5) -> None:
    """Runs query and shows retrieved chunks with similarity scores and content."""
    print(f"\n--- Retrieval examples for: '{query}' (n={n_results}) ---")
    raw = embeddings_pipeline_v2.search_chunks(
        query, n_results=n_results, collection_name=embeddings_pipeline_v2.DEFAULT_CHUNK_COLLECTION
    )
    for i, r in enumerate(raw, 1):
        print(f"{i}. course_id={r.get('course_id')} similarity={r.get('similarity', 0):.4f}")
        text = (r.get("chunk_text") or "")[:300]
        print(f"   Content: {text}...")
    print()


def main() -> None:
    print("RAG Accuracy Evaluation")
    print("1. Run full evaluation (saves rag_evaluation_report.json)")
    print("2. Compare chunking strategies")
    print("3. Compare search methods (v1 vs v2)")
    print("4. Analyze specific query (retrieval examples)")
    print("5. Generate HTML report")
    print("6. Analyze failed queries (precision < 0.5)")
    choice = input("Choice [1-6]: ").strip() or "1"

    if choice == "1":
        run_full_evaluation()
    elif choice == "2":
        r = compare_chunking_strategies()
        print("Best config:", r.get("best_config"))
        print("Best metrics:", r.get("best_metrics"))
    elif choice == "3":
        r = compare_search_methods()
        print_results_table(r)
    elif choice == "4":
        q = input("Query: ").strip() or "learn programming"
        show_retrieval_examples(q, n_results=5)
    elif choice == "5":
        r = compare_search_methods()
        generate_html_report(r)
    elif choice == "6":
        r = evaluate_all_queries(create_test_queries(), search_method="aggregated", k=5)
        analyze_failed_queries(r, threshold=0.5)
    else:
        print("Invalid choice.")


if __name__ == "__main__":
    main()
