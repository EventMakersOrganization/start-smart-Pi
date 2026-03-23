"""
Semantic search tests and interactive tooling for course embeddings.
"""
import sys
import time
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

from core import db_connection
from embeddings import embeddings_pipeline


def _print_results(label, results, top_n=3):
    print(f"\n=== {label} ===")
    for i, item in enumerate(results[:top_n], start=1):
        meta = item.get("metadata") or {}
        dist = item.get("distance", 1.0)
        similarity = 1.0 / (1.0 + float(dist)) if dist is not None else 0.0
        title = meta.get("title", "")
        snippet = (item.get("document") or "")[:80]
        print(f"{i}. sim={similarity:.4f}  title={title}  snippet='{snippet}...'")


def test_basic_search():
    """
    Tests search with simple queries and prints top 3 results for each.
    """
    queries = [
        "programming basics",
        "mathematics calculus",
        "data structures",
        "web development",
    ]
    for q in queries:
        start = time.perf_counter()
        results = embeddings_pipeline.search_similar_courses(q, n_results=3)
        elapsed = time.perf_counter() - start
        _print_results(f"Basic search: '{q}' (time={elapsed:.3f}s)", results, top_n=3)
    return True


def test_search_by_difficulty():
    """
    Tests if search tends to respect difficulty metadata (beginner vs advanced).
    """
    beginner_query = "beginner introduction course"
    advanced_query = "advanced in-depth course"

    beg_results = embeddings_pipeline.search_similar_courses(beginner_query, n_results=5)
    adv_results = embeddings_pipeline.search_similar_courses(advanced_query, n_results=5)

    def _count_level(results, level):
        return sum(1 for r in results if (r.get("metadata") or {}).get("level") == level)

    beg_beginner = _count_level(beg_results, "beginner")
    adv_advanced = _count_level(adv_results, "advanced")

    print("\n=== Difficulty search test ===")
    print(f"Beginner query matched {beg_beginner} 'beginner' results out of {len(beg_results)}")
    print(f"Advanced query matched {adv_advanced} 'advanced' results out of {len(adv_results)}")
    return True


def test_search_accuracy():
    """
    For a few known courses, search using part of their description
    and see if they appear in top results. Prints accuracy %.
    """
    courses = db_connection.get_all_courses()
    if not courses:
        print("\n[accuracy] No courses in database; skipping accuracy test.")
        return True

    max_cases = min(5, len(courses))
    hits = 0
    total = 0

    print("\n=== Search accuracy test ===")
    for course in courses[:max_cases]:
        cid = course.get("id")
        desc = (course.get("description") or "")[:120]
        if not desc:
            continue
        total += 1
        results = embeddings_pipeline.search_similar_courses(desc, n_results=5)
        found = any(r.get("id") == cid for r in results)
        if found:
            hits += 1
        print(f"Course id={cid} in top results: {found}")

    if total == 0:
        print("[accuracy] No suitable courses with description; skipping.")
        return True

    accuracy = 100.0 * hits / total
    print(f"[accuracy] {hits}/{total} matched (accuracy={accuracy:.1f}%).")
    return True


def test_multilingual_search():
    """
    Tests multilingual queries (e.g. French, Tunisia context) if the model supports it.
    """
    queries = [
        "introduction à la programmation",
        "mathématiques de base",
        "développement web moderne",
    ]
    for q in queries:
        start = time.perf_counter()
        results = embeddings_pipeline.search_similar_courses(q, n_results=3)
        elapsed = time.perf_counter() - start
        _print_results(f"Multilingual search: '{q}' (time={elapsed:.3f}s)", results, top_n=3)
    return True


def run_all_tests():
    """
    Runs all test functions and prints a summary report.
    """
    tests = [
        ("basic_search", test_basic_search),
        ("search_by_difficulty", test_search_by_difficulty),
        ("search_accuracy", test_search_accuracy),
        ("multilingual_search", test_multilingual_search),
    ]
    results = {}
    print("\n=== Running all semantic search tests ===")
    for name, fn in tests:
        try:
            ok = fn()
            results[name] = bool(ok)
        except Exception as e:
            print(f"[test {name}] ERROR: {e}")
            results[name] = False

    print("\n=== Test summary ===")
    for name, ok in results.items():
        status = "PASS" if ok else "FAIL"
        print(f"{name}: {status}")
    return results


def interactive_search():
    """
    Interactive search mode: prompt the user for queries and display formatted results.
    """
    print("\n=== Interactive semantic search ===")
    print("Type 'quit' to exit.\n")
    times = []
    try:
        while True:
            query = input("Search query> ").strip()
            if query.lower() in {"quit", "exit"}:
                break
            if not query:
                continue
            start = time.perf_counter()
            results = embeddings_pipeline.search_similar_courses(query, n_results=5)
            elapsed = time.perf_counter() - start
            times.append(elapsed)
            _print_results(f"Results for '{query}' (time={elapsed:.3f}s)", results, top_n=5)
    except KeyboardInterrupt:
        print("\nInterrupted by user.")

    if times:
        avg = sum(times) / len(times)
        print(f"\nAverage interactive search time over {len(times)} queries: {avg:.3f}s")


def performance_benchmark():
    """
    Simple performance benchmark: run several searches and report average latency.
    """
    queries = [
        "intro to programming",
        "calculus derivatives",
        "object oriented design",
        "database systems",
        "machine learning basics",
    ]
    times = []
    print("\n=== Performance benchmark ===")
    for q in queries:
        start = time.perf_counter()
        _ = embeddings_pipeline.search_similar_courses(q, n_results=5)
        elapsed = time.perf_counter() - start
        times.append(elapsed)
        print(f"Query '{q}' took {elapsed:.3f}s")

    if times:
        avg = sum(times) / len(times)
        print(f"\nAverage search time over {len(times)} benchmark queries: {avg:.3f}s")
    return True


def main():
    while True:
        print("\n=== Semantic Search Test Menu ===")
        print("1) Run all automated tests")
        print("2) Interactive search mode")
        print("3) Performance benchmark")
        print("q) Quit")
        choice = input("Select an option: ").strip().lower()
        if choice == "1":
            run_all_tests()
        elif choice == "2":
            interactive_search()
        elif choice == "3":
            performance_benchmark()
        elif choice in {"q", "quit"}:
            break
        else:
            print("Invalid option. Please choose 1, 2, 3, or q.")


if __name__ == "__main__":
    main()

