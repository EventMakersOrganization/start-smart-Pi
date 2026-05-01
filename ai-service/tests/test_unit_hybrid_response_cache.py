from __future__ import annotations

from optimization.hybrid_response_cache import HybridResponseCache


def test_hybrid_cache_fallback_without_redis():
    cache = HybridResponseCache(
        cache_dir="./response_cache_test",
        max_entries=200,
        ttl_seconds=120,
        redis_url="",  # force local-only mode
    )
    key = cache.make_key({"k": "v"})
    cache.set(key, {"answer": "ok"})
    val, age = cache.get(key)
    assert isinstance(val, dict)
    assert val.get("answer") == "ok"
    assert age >= 0


def test_hybrid_cache_miss_returns_none():
    cache = HybridResponseCache(
        cache_dir="./response_cache_test",
        max_entries=200,
        ttl_seconds=120,
        redis_url="",
    )
    key = "nonexistent-key-12345"
    val, age = cache.get(key)
    assert val is None
    assert age == 0
