"""
Embedding generation optimizer: caching, batching, and parallel execution
for faster Ollama embedding throughput.
"""
from __future__ import annotations

import hashlib
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from core import config

try:
    import ollama
except ImportError:
    ollama = None

logger = logging.getLogger("embedding_optimizer")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)

# Approximate bytes per embedding vector (float32 * dim); conservative for batch sizing
_BYTES_PER_EMBEDDING_ESTIMATE = 3 * 1024  # ~3KB as specified


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class EmbeddingOptimizer:
    """Caches embeddings and speeds up generation via batch and parallel calls."""

    def __init__(self) -> None:
        self.batch_size = 10
        self.max_workers = 4
        self._cache: dict[str, list[float]] = {}
        self._cache_lock = threading.Lock()
        self._cache_hits = 0
        self._cache_misses = 0
        self.metrics: dict[str, Any] = {
            "last_batch_time_sec": 0.0,
            "last_parallel_time_sec": 0.0,
            "last_parallel_speedup_ratio": 0.0,
            "last_batch_speedup_ratio": 0.0,
        }

    def generate_embedding_fast(self, text: str) -> list[float] | None:
        """
        Return embedding from cache if present; otherwise call Ollama and cache.
        """
        if ollama is None:
            logger.error("ollama package not installed")
            return None
        if not text or not str(text).strip():
            return None

        key = _cache_key(text)
        with self._cache_lock:
            if key in self._cache:
                self._cache_hits += 1
                return list(self._cache[key])
            self._cache_misses += 1

        try:
            model = config.OLLAMA_MODEL
            response = ollama.embed(model=model, input=text)
            embeddings = response.get("embeddings")
            if not embeddings:
                return None
            vector = embeddings[0] if isinstance(embeddings[0], list) else embeddings
            vec = list(vector) if not isinstance(vector, list) else vector
            with self._cache_lock:
                self._cache[key] = vec
            return vec
        except Exception as e:
            logger.error("generate_embedding_fast error: %s", e)
            return None

    def generate_embeddings_batch(self, texts: list[str]) -> list[list[float] | None]:
        """
        Generate embeddings for multiple texts. Uses a single Ollama call when
        the API accepts a list input; otherwise falls back to per-text fast path.
        """
        if not texts:
            return []
        if ollama is None:
            return [None] * len(texts)

        t0 = time.perf_counter()
        out: list[list[float] | None] = [None] * len(texts)
        non_empty: list[tuple[int, str]] = [(i, t) for i, t in enumerate(texts) if t and str(t).strip()]

        # Serve from cache first
        pending: list[tuple[int, str]] = []
        for i, t in non_empty:
            key = _cache_key(t)
            with self._cache_lock:
                if key in self._cache:
                    out[i] = list(self._cache[key])
                    self._cache_hits += 1
                else:
                    self._cache_misses += 1
                    pending.append((i, t))

        if not pending:
            self.metrics["last_batch_time_sec"] = time.perf_counter() - t0
            return out

        model = config.OLLAMA_MODEL
        inputs_only = [t for _, t in pending]

        try:
            # Try batch API: input as list of strings
            response = ollama.embed(model=model, input=inputs_only)
            embeddings = response.get("embeddings")
            if embeddings and len(embeddings) == len(inputs_only):
                for j, (orig_idx, t) in enumerate(pending):
                    vec = embeddings[j]
                    vec_list = list(vec) if not isinstance(vec, list) else vec
                    out[orig_idx] = vec_list
                    with self._cache_lock:
                        self._cache[_cache_key(t)] = vec_list
            else:
                # Fallback: one call per text
                for orig_idx, t in pending:
                    out[orig_idx] = self.generate_embedding_fast(t)
        except Exception as e:
            logger.warning("batch embed failed (%s), falling back to sequential fast path", e)
            for orig_idx, t in pending:
                out[orig_idx] = self.generate_embedding_fast(t)

        self.metrics["last_batch_time_sec"] = time.perf_counter() - t0
        return out

    def generate_embeddings_parallel(self, texts: list[str]) -> list[list[float] | None]:
        """
        Split texts into batches of ``batch_size`` and process batches in parallel
        with ThreadPoolExecutor. Preserves original order.
        """
        if not texts:
            return []
        t0 = time.perf_counter()
        n = len(texts)
        out: list[list[float] | None] = [None] * n

        batches: list[tuple[int, int, list[str]]] = []
        for start in range(0, n, self.batch_size):
            end = min(start + self.batch_size, n)
            chunk = texts[start:end]
            batches.append((start, end, chunk))

        def _run_batch(start: int, end: int, chunk: list[str]) -> tuple[int, list[list[float] | None]]:
            return start, self.generate_embeddings_batch(chunk)

        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {executor.submit(_run_batch, s, e, c): (s, e) for s, e, c in batches}
            for fut in as_completed(futures):
                start, vecs = fut.result()
                for k, vec in enumerate(vecs):
                    out[start + k] = vec

        elapsed = time.perf_counter() - t0
        self.metrics["last_parallel_time_sec"] = elapsed
        return out

    def benchmark_methods(self, texts: list[str]) -> dict[str, float]:
        """
        Compare sequential (one-by-one fast), batch (single list if supported), and parallel.
        Returns timing and speedup ratios vs sequential.
        """
        if not texts:
            return {
                "sequential_time": 0.0,
                "batch_time": 0.0,
                "parallel_time": 0.0,
                "batch_speedup": 1.0,
                "parallel_speedup": 1.0,
            }

        # Cold-cache each phase so batch/parallel are not measured against a warm cache.
        def _seq() -> None:
            for t in texts:
                if t and str(t).strip():
                    self.generate_embedding_fast(t)

        self.clear_cache()
        t_seq = time.perf_counter()
        _seq()
        sequential_time = time.perf_counter() - t_seq

        self.clear_cache()
        t_b = time.perf_counter()
        self.generate_embeddings_batch(texts)
        batch_time = time.perf_counter() - t_b

        self.clear_cache()
        t_p = time.perf_counter()
        self.generate_embeddings_parallel(texts)
        parallel_time = time.perf_counter() - t_p

        batch_speedup = sequential_time / batch_time if batch_time > 0 else 1.0
        parallel_speedup = sequential_time / parallel_time if parallel_time > 0 else 1.0

        self.metrics.update(
            {
                "last_sequential_time_sec": sequential_time,
                "last_batch_time_sec": batch_time,
                "last_parallel_time_sec": parallel_time,
                "last_batch_speedup_ratio": batch_speedup,
                "last_parallel_speedup_ratio": parallel_speedup,
            }
        )

        return {
            "sequential_time": sequential_time,
            "batch_time": batch_time,
            "parallel_time": parallel_time,
            "batch_speedup": batch_speedup,
            "parallel_speedup": parallel_speedup,
        }

    def get_cache_stats(self) -> dict[str, Any]:
        """Return cache size, hits, misses, and hit rate."""
        total = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total) if total > 0 else 0.0
        with self._cache_lock:
            size = len(self._cache)
        return {
            "cache_size": size,
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "hit_rate": round(hit_rate, 4),
        }

    def clear_cache(self) -> None:
        """Clear cache and reset hit/miss counters."""
        with self._cache_lock:
            self._cache.clear()
        self._cache_hits = 0
        self._cache_misses = 0


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------


def estimate_embedding_time(num_texts: int, method: str = "sequential") -> float:
    """Rough estimate of seconds to embed ``num_texts`` items."""
    if num_texts <= 0:
        return 0.0
    method = method.lower()
    if method == "batch":
        return num_texts * 0.2
    if method == "parallel":
        return num_texts * 0.1
    return num_texts * 0.5


def calculate_optimal_batch_size(num_texts: int, available_memory_mb: int = 1000) -> int:
    """
    Estimate max batch size from available memory (~3KB per embedding).
    Returns a value between 5 and 50.
    """
    mem_bytes = max(available_memory_mb, 1) * 1024 * 1024
    max_by_mem = max(1, mem_bytes // _BYTES_PER_EMBEDDING_ESTIMATE)
    optimal = min(max_by_mem, num_texts) if num_texts else max_by_mem
    optimal = max(5, min(50, optimal))
    return int(optimal)


if __name__ == "__main__":
    samples = [
        f"Course module {i}: introduction to programming concepts, data structures, and algorithms."
        for i in range(20)
    ]

    opt = EmbeddingOptimizer()
    opt.clear_cache()

    print("Embedding optimizer benchmark (20 sample texts)")
    print("=" * 60)

    if ollama is None:
        print("ollama not installed; skipping live benchmark.")
        print("estimate_embedding_time(20, sequential):", estimate_embedding_time(20, "sequential"))
        print("calculate_optimal_batch_size(100, 1000):", calculate_optimal_batch_size(100, 1000))
    else:
        results = opt.benchmark_methods(samples)
        print(f"Sequential: {results['sequential_time']:.3f}s")
        print(
            f"Batch:      {results['batch_time']:.3f}s "
            f"({results['batch_speedup']:.2f}x speedup vs sequential)"
        )
        print(
            f"Parallel:   {results['parallel_time']:.3f}s "
            f"({results['parallel_speedup']:.2f}x speedup vs sequential)"
        )

        # Second pass to exercise cache
        print("\n--- Second run (cache warm) ---")
        opt.generate_embeddings_parallel(samples[:5])
        stats = opt.get_cache_stats()
        print(f"Cache hit rate: {stats['hit_rate'] * 100:.1f}%")
        print("Cache stats:", stats)

        opt.clear_cache()
        print("\nAfter clear_cache:", opt.get_cache_stats())

    print("\nHelpers:")
    print("  estimate_embedding_time(20):", estimate_embedding_time(20))
    print("  estimate_embedding_time(20, batch):", estimate_embedding_time(20, "batch"))
    print("  calculate_optimal_batch_size(100):", calculate_optimal_batch_size(100))
