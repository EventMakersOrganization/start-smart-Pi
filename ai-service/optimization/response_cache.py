"""Small response cache for latency-sensitive API endpoints."""
from __future__ import annotations

import hashlib
import json
import os
import pickle
import time
from collections import OrderedDict
from typing import Any


class ResponseCache:
    """Two-tier cache: in-memory LRU + disk persistence."""

    def __init__(self, cache_dir: str = "./response_cache", max_entries: int = 2000, ttl_seconds: int = 3600) -> None:
        self.cache_dir = os.path.abspath(cache_dir)
        os.makedirs(self.cache_dir, exist_ok=True)
        self.max_entries = max(100, max_entries)
        self.ttl_seconds = max(60, ttl_seconds)
        self._mem: OrderedDict[str, dict[str, Any]] = OrderedDict()

    @staticmethod
    def make_key(payload: dict[str, Any]) -> str:
        raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def get(self, key: str) -> tuple[dict[str, Any] | None, int]:
        now = time.time()
        data = self._mem.get(key)
        if data is not None:
            age = int((now - float(data.get("created_at", now))) * 1000)
            if age <= self.ttl_seconds * 1000:
                self._mem.move_to_end(key)
                return data.get("value"), age
            self._mem.pop(key, None)

        disk_path = os.path.join(self.cache_dir, f"{key}.pkl")
        if not os.path.isfile(disk_path):
            return None, 0
        try:
            with open(disk_path, "rb") as f:
                payload = pickle.load(f)
            created = float(payload.get("created_at", now))
            age = int((now - created) * 1000)
            if age > self.ttl_seconds * 1000:
                try:
                    os.remove(disk_path)
                except OSError:
                    pass
                return None, 0
            self._set_mem(key, payload)
            return payload.get("value"), age
        except Exception:
            return None, 0

    def set(self, key: str, value: dict[str, Any]) -> None:
        payload = {"created_at": time.time(), "value": value}
        self._set_mem(key, payload)
        disk_path = os.path.join(self.cache_dir, f"{key}.pkl")
        try:
            with open(disk_path, "wb") as f:
                pickle.dump(payload, f, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception:
            pass

    def _set_mem(self, key: str, payload: dict[str, Any]) -> None:
        self._mem[key] = payload
        self._mem.move_to_end(key)
        while len(self._mem) > self.max_entries:
            self._mem.popitem(last=False)
