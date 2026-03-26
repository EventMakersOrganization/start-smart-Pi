"""Hybrid cache: Redis (optional) + local disk/memory fallback."""
from __future__ import annotations

import json
import time
from typing import Any

from core import config
from optimization.response_cache import ResponseCache

try:
    import redis
except Exception:  # pragma: no cover
    redis = None


class HybridResponseCache:
    """
    Uses Redis as primary cache when configured, then local cache fallback.
    Falls back gracefully if Redis is unavailable.
    """

    def __init__(
        self,
        cache_dir: str = "./response_cache",
        max_entries: int = 2000,
        ttl_seconds: int = 3600,
        redis_url: str | None = None,
        redis_prefix: str | None = None,
    ) -> None:
        self.ttl_seconds = max(60, int(ttl_seconds))
        self.local = ResponseCache(cache_dir=cache_dir, max_entries=max_entries, ttl_seconds=self.ttl_seconds)
        self.redis_prefix = (redis_prefix or config.REDIS_CACHE_PREFIX or "startsmart:resp").strip()
        self.redis_client = None
        url = (redis_url if redis_url is not None else config.REDIS_URL).strip()
        if url and redis is not None:
            try:
                client = redis.Redis.from_url(url, decode_responses=True)
                client.ping()
                self.redis_client = client
            except Exception:
                self.redis_client = None

    @staticmethod
    def make_key(payload: dict[str, Any]) -> str:
        return ResponseCache.make_key(payload)

    def _rkey(self, key: str) -> str:
        return f"{self.redis_prefix}:{key}"

    def get(self, key: str) -> tuple[dict[str, Any] | None, int]:
        now = time.time()
        if self.redis_client is not None:
            try:
                raw = self.redis_client.get(self._rkey(key))
                if raw:
                    payload = json.loads(raw)
                    created = float(payload.get("created_at", now))
                    age = int((now - created) * 1000)
                    if age <= self.ttl_seconds * 1000:
                        val = payload.get("value")
                        if isinstance(val, dict):
                            # keep local warm for resilience
                            self.local.set(key, val)
                            return val, age
            except Exception:
                pass
        return self.local.get(key)

    def set(self, key: str, value: dict[str, Any]) -> None:
        self.local.set(key, value)
        if self.redis_client is None:
            return
        payload = {"created_at": time.time(), "value": value}
        try:
            self.redis_client.setex(self._rkey(key), self.ttl_seconds, json.dumps(payload, ensure_ascii=False, default=str))
        except Exception:
            return
