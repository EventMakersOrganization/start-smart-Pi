"""
Intelligent embedding cache: in-memory LRU + disk persistence with size limits.
"""
from __future__ import annotations

import hashlib
import json
import os
import pickle
import time
from collections import OrderedDict
from typing import Any, Optional

# --- Persistence helpers -----------------------------------------------------


def save_cache_to_disk(cache_key: str, embedding: list[float], cache_dir: str) -> str:
    """
    Serialize embedding with timestamp metadata; write to cache_dir.
    Returns path written.
    """
    os.makedirs(cache_dir, exist_ok=True)
    safe_name = cache_key.replace("/", "_").replace("\\", "_")
    path = os.path.join(cache_dir, f"{safe_name}.pkl")
    payload = {
        "embedding": embedding,
        "created_at": time.time(),
        "version": 1,
    }
    with open(path, "wb") as f:
        pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)
    meta_path = os.path.join(cache_dir, f"{safe_name}.meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({"created_at": payload["created_at"], "cache_key": cache_key}, f)
    return path


def load_cache_from_disk(
    cache_key: str,
    cache_dir: str,
    max_age_seconds: float = 30 * 24 * 3600,
) -> Optional[list[float]]:
    """Load embedding if file exists and not older than max_age_seconds (default 30 days)."""
    safe_name = cache_key.replace("/", "_").replace("\\", "_")
    path = os.path.join(cache_dir, f"{safe_name}.pkl")
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "rb") as f:
            data = pickle.load(f)
        if isinstance(data, dict) and "embedding" in data:
            created = float(data.get("created_at", 0))
            if time.time() - created > max_age_seconds:
                return None
            return data["embedding"]
        # Legacy: raw list pickle
        if isinstance(data, list):
            return data
    except (OSError, pickle.PickleError, EOFError, TypeError):
        return None
    return None


def delete_disk_entry(cache_key: str, cache_dir: str) -> None:
    safe_name = cache_key.replace("/", "_").replace("\\", "_")
    for ext in (".pkl", ".meta.json"):
        p = os.path.join(cache_dir, f"{safe_name}{ext}")
        try:
            if os.path.isfile(p):
                os.remove(p)
        except OSError:
            pass


def get_disk_cache_size(cache_dir: str) -> float:
    """Total size of cache directory in MB."""
    if not os.path.isdir(cache_dir):
        return 0.0
    total = 0
    for root, _dirs, files in os.walk(cache_dir):
        for name in files:
            fp = os.path.join(root, name)
            try:
                total += os.path.getsize(fp)
            except OSError:
                pass
    return total / (1024.0 * 1024.0)


# --- LRU ---------------------------------------------------------------------


class LRUCache:
    """OrderedDict-backed LRU: most recently used at the end."""

    def __init__(self, max_size: int = 10_000) -> None:
        self._max_size = max(1, max_size)
        self._data: OrderedDict[Any, Any] = OrderedDict()

    def get(self, key: Any) -> Any:
        if key not in self._data:
            return None
        self._data.move_to_end(key)
        return self._data[key]

    def set(self, key: Any, value: Any) -> None:
        if key in self._data:
            self._data.move_to_end(key)
        self._data[key] = value
        while len(self._data) > self._max_size:
            self._data.popitem(last=False)

    def evict_oldest(self) -> None:
        if self._data:
            self._data.popitem(last=False)

    def resize(self, max_size: int) -> None:
        self._max_size = max(1, max_size)
        while len(self._data) > self._max_size:
            self._data.popitem(last=False)

    def __len__(self) -> int:
        return len(self._data)

    def clear(self) -> None:
        self._data.clear()

    def pop(self, key: Any, default: Any = None) -> Any:
        return self._data.pop(key, default)

    def keys(self):
        return self._data.keys()


# --- Embedding cache ---------------------------------------------------------


class EmbeddingCache:
    """
    Two-tier cache: memory LRU + pickle files on disk.
    Enforces max_size_mb on disk usage via eviction of oldest files.
    """

    def __init__(self, cache_dir: str = "./cache", max_size_mb: int = 100) -> None:
        self.cache_dir = os.path.abspath(cache_dir)
        self.max_size_mb = max(1, max_size_mb)
        os.makedirs(self.cache_dir, exist_ok=True)
        # Memory: bound by entry count (rough cap; disk enforces MB)
        self._memory_max = max(100, min(50_000, self.max_size_mb * 200))
        self._memory = LRUCache(max_size=self._memory_max)
        self._stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "cache_writes": 0,
        }

    @staticmethod
    def generate_cache_key(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    def get(self, text: str) -> Optional[list[float]]:
        self._stats["total_requests"] += 1
        key = self.generate_cache_key(text)
        mem = self._memory.get(key)
        if mem is not None:
            self._stats["cache_hits"] += 1
            return mem
        emb = load_cache_from_disk(key, self.cache_dir)
        if emb is not None:
            self._stats["cache_hits"] += 1
            self._memory.set(key, emb)
            return emb
        self._stats["cache_misses"] += 1
        return None

    def set(self, text: str, embedding: list[float]) -> None:
        key = self.generate_cache_key(text)
        self._memory.set(key, embedding)
        save_cache_to_disk(key, embedding, self.cache_dir)
        self._stats["cache_writes"] += 1
        self._enforce_disk_limit()

    def get_batch(self, texts: list[str]) -> dict[str, list[float]]:
        out: dict[str, list[float]] = {}
        for t in texts:
            e = self.get(t)
            if e is not None:
                out[t] = e
        return out

    def set_batch(self, text_embedding_pairs: list[tuple[str, list[float]]]) -> int:
        """Cache many embeddings; one disk size check at the end (faster than repeated set())."""
        n = 0
        for text, emb in text_embedding_pairs:
            key = self.generate_cache_key(text)
            self._memory.set(key, emb)
            save_cache_to_disk(key, emb, self.cache_dir)
            self._stats["cache_writes"] += 1
            n += 1
        self._enforce_disk_limit()
        return n

    def clear_old_entries(self, max_age_days: int = 30) -> int:
        """Remove disk entries older than max_age_days. Returns files removed count."""
        if not os.path.isdir(self.cache_dir):
            return 0
        cutoff = time.time() - max_age_days * 24 * 3600
        removed = 0
        for name in os.listdir(self.cache_dir):
            if not name.endswith(".pkl"):
                continue
            path = os.path.join(self.cache_dir, name)
            try:
                if os.path.getmtime(path) < cutoff:
                    key_hex = name[:-4]
                    delete_disk_entry(key_hex, self.cache_dir)
                    self._memory.pop(key_hex, None)
                    removed += 1
            except OSError:
                continue
        return removed

    def get_cache_stats(self) -> dict[str, Any]:
        tr = self._stats["total_requests"]
        hits = self._stats["cache_hits"]
        misses = self._stats["cache_misses"]
        hit_rate = (hits / tr) if tr > 0 else 0.0
        disk_mb = get_disk_cache_size(self.cache_dir)
        oldest_days = self._oldest_disk_entry_age_days()
        return {
            "total_requests": tr,
            "cache_hits": hits,
            "cache_misses": misses,
            "hit_rate": round(hit_rate, 4),
            "memory_cache_size": len(self._memory),
            "disk_cache_size_mb": round(disk_mb, 4),
            "oldest_entry_age_days": oldest_days,
            "cache_writes": self._stats["cache_writes"],
        }

    def _oldest_disk_entry_age_days(self) -> float:
        if not os.path.isdir(self.cache_dir):
            return 0.0
        oldest: Optional[float] = None
        now = time.time()
        for name in os.listdir(self.cache_dir):
            if not name.endswith(".pkl"):
                continue
            path = os.path.join(self.cache_dir, name)
            try:
                m = os.path.getmtime(path)
                oldest = m if oldest is None else min(oldest, m)
            except OSError:
                continue
        if oldest is None:
            return 0.0
        return round((now - oldest) / (24 * 3600), 4)

    def clear_all(self) -> None:
        self._memory.clear()
        if os.path.isdir(self.cache_dir):
            for name in os.listdir(self.cache_dir):
                path = os.path.join(self.cache_dir, name)
                try:
                    if os.path.isfile(path):
                        os.remove(path)
                except OSError:
                    pass
        self._stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "cache_writes": 0,
        }

    def optimize_cache(self) -> None:
        """Evict LRU memory entries and oldest disk files until under max_size_mb."""
        target_bytes = self.max_size_mb * 1024 * 1024
        # Shrink memory LRU gradually
        while len(self._memory) > self._memory_max // 2:
            self._memory.evict_oldest()
        # Disk: remove oldest .pkl until size OK
        safety = 0
        while (
            get_disk_cache_size(self.cache_dir) * 1024 * 1024 > target_bytes * 0.95
            and safety < 5_000_000
        ):
            safety += 1
            files: list[tuple[float, str]] = []
            for name in os.listdir(self.cache_dir):
                if not name.endswith(".pkl"):
                    continue
                path = os.path.join(self.cache_dir, name)
                try:
                    files.append((os.path.getmtime(path), path))
                except OSError:
                    continue
            if not files:
                break
            files.sort(key=lambda x: x[0])
            oldest_path = files[0][1]
            key_hex = os.path.basename(oldest_path)[:-4]
            delete_disk_entry(key_hex, self.cache_dir)
            self._memory.pop(key_hex, None)

    def _enforce_disk_limit(self) -> None:
        self.optimize_cache()


if __name__ == "__main__":
    import shutil
    import tempfile

    tmp = tempfile.mkdtemp(prefix="emb_cache_test_")
    cache = EmbeddingCache(cache_dir=tmp, max_size_mb=50)

    samples = [f"This is sample text number {i} for embedding cache." for i in range(100)]
    fake_emb = lambda i: [float((i + j) % 17) / 17.0 for j in range(128)]

    # Cold: all miss
    t0 = time.perf_counter()
    for i, s in enumerate(samples):
        v = cache.get(s)
        assert v is None
    cold_time = time.perf_counter() - t0

    # Write
    for i, s in enumerate(samples):
        cache.set(s, fake_emb(i))
    stats_after_set = cache.get_cache_stats()
    print(f"Cached {stats_after_set['cache_writes']} embeddings")
    print(f"Cache size: {stats_after_set['disk_cache_size_mb']:.1f} MB")

    # Warm: all hit (memory)
    t1 = time.perf_counter()
    for s in samples:
        e = cache.get(s)
        assert e is not None
    warm_time = time.perf_counter() - t1

    # New cache instance: load from disk
    cache2 = EmbeddingCache(cache_dir=tmp, max_size_mb=50)
    for s in samples[:10]:
        assert cache2.get(s) is not None

    # Batch
    batch_hits = cache.get_batch(samples[:20])
    assert len(batch_hits) == 20
    n = cache.set_batch([(f"batch {i}", fake_emb(i)) for i in range(5)])
    assert n == 5

    st = cache.get_cache_stats()
    hr = st["hit_rate"] * 100
    avg_lookup = warm_time / max(len(samples), 1)
    gen_est = 0.5  # illustrative vs cold network/model
    print(f"Hit rate: {hr:.0f}%")
    print(f"Average lookup time: {avg_lookup:.6f}s (vs {gen_est}s for generation)")
    if avg_lookup > 0:
        print(f"Speed improvement: {gen_est / avg_lookup:.0f}x for cached items")

    # Stats line
    print("\nFull stats:", json.dumps(st, indent=2))

    # Example-style: fresh cache, 100 writes then 100 reads (high hit rate)
    demo_dir = tempfile.mkdtemp(prefix="emb_demo_")
    demo = EmbeddingCache(cache_dir=demo_dir, max_size_mb=100)
    demo_texts = [f"Example embedding text #{i}" for i in range(100)]
    demo.set_batch([(t, fake_emb(i)) for i, t in enumerate(demo_texts)])
    t_demo = time.perf_counter()
    for t in demo_texts:
        assert demo.get(t) is not None
    demo_lookup = (time.perf_counter() - t_demo) / len(demo_texts)
    ds = demo.get_cache_stats()
    print("\n--- Example output (warm cache) ---")
    print(f"Cached {ds['cache_writes']} embeddings")
    print(f"Cache size: {ds['disk_cache_size_mb']:.1f} MB")
    print(f"Hit rate: {ds['hit_rate'] * 100:.0f}%")
    print(
        f"Average lookup time: {demo_lookup:.4f}s (vs {gen_est}s for generation)"
    )
    if demo_lookup > 0:
        print(f"Speed improvement: {gen_est / demo_lookup:.0f}x for cached items")

    shutil.rmtree(demo_dir, ignore_errors=True)

    # Size limit: tiny budget forces disk eviction
    tiny_dir = tempfile.mkdtemp(prefix="emb_tiny_")
    tiny = EmbeddingCache(cache_dir=tiny_dir, max_size_mb=1)
    for i in range(200):
        tiny.set(f"key-{i}", [0.1] * 512)
    sz = tiny.get_cache_stats()["disk_cache_size_mb"]
    assert sz <= 1.1, f"disk should stay near limit, got {sz} MB"
    shutil.rmtree(tiny_dir, ignore_errors=True)

    # Cleanup old (nothing old in fresh tmp)
    removed = cache.clear_old_entries(max_age_days=0)
    print(f"clear_old_entries (max_age_days=0) removed entries: {removed}")

    cache.optimize_cache()
    print("optimize_cache() done")

    cache.clear_all()
    assert len(os.listdir(tmp)) == 0 or not any(f.endswith(".pkl") for f in os.listdir(tmp))

    shutil.rmtree(tmp, ignore_errors=True)
    print("Tests OK.")
