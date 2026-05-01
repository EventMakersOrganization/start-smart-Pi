from __future__ import annotations
from unittest.mock import MagicMock, patch

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


def test_hybrid_cache_redis_hit(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.get.return_value = '{"created_at": 1000, "value": {"answer": "redis_ok"}}'
    
    # Mock time.time to be 1100, so age is (1100-1000)*1000 = 100000ms
    monkeypatch.setattr("time.time", lambda: 1100.0)
    
    cache = HybridResponseCache(redis_url="redis://localhost")
    cache.redis_client = mock_redis
    
    val, age = cache.get("some_key")
    assert val == {"answer": "redis_ok"}
    assert age == 100000


def test_hybrid_cache_redis_miss_local_hit(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.get.return_value = None
    
    cache = HybridResponseCache(redis_url="redis://localhost")
    cache.redis_client = mock_redis
    
    # Manually set local
    cache.local.set("some_key", {"answer": "local_only"})
    
    val, age = cache.get("some_key")
    assert val == {"answer": "local_only"}
    mock_redis.get.assert_called_once()


def test_hybrid_cache_redis_failure_fallback(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.get.side_effect = Exception("Redis connection lost")
    
    cache = HybridResponseCache(redis_url="redis://localhost")
    cache.redis_client = mock_redis
    
    cache.local.set("some_key", {"answer": "fallback_ok"})
    
    # Should not raise exception, should return local data
    val, age = cache.get("some_key")
    assert val == {"answer": "fallback_ok"}


def test_hybrid_cache_set_both(monkeypatch):
    mock_redis = MagicMock()
    monkeypatch.setattr("time.time", lambda: 2000.0)
    
    cache = HybridResponseCache(redis_url="redis://localhost")
    cache.redis_client = mock_redis
    
    cache.set("key123", {"data": "val"})
    
    # Verify local set
    local_val, _ = cache.local.get("key123")
    assert local_val == {"data": "val"}
    
    # Verify redis setex
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert "key123" in args[0]
    assert args[1] == cache.ttl_seconds
    assert '"data": "val"' in args[2]


def test_hybrid_cache_empty_key():
    cache = HybridResponseCache(redis_url="")
    # Should handle empty input gracefully if possible, or at least not crash
    key = cache.make_key({})
    cache.set(key, {"a": "b"})
    val, _ = cache.get(key)
    assert val == {"a": "b"}
