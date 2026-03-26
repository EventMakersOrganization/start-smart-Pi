"""Async refresh helpers for non-blocking cache warmup."""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any, Callable

_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai-refresh")


def submit_refresh(fn: Callable[..., Any], *args, **kwargs):
    """Fire-and-forget background task."""
    return _pool.submit(fn, *args, **kwargs)


def run_with_timeout(fn: Callable[..., Any], timeout_seconds: float, *args, **kwargs) -> tuple[Any | None, bool]:
    """
    Run function in worker thread with timeout.
    Returns (result, timed_out).
    """
    fut = _pool.submit(fn, *args, **kwargs)
    try:
        return fut.result(timeout=timeout_seconds), False
    except TimeoutError:
        return None, True
    except Exception:
        return None, False
