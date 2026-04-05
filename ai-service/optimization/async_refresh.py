"""Async refresh helpers for non-blocking cache warmup."""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import Any, Callable

logger = logging.getLogger(__name__)

_pool = ThreadPoolExecutor(max_workers=4, thread_name_prefix="ai-refresh")


def submit_refresh(fn: Callable[..., Any], *args, **kwargs):
    """Fire-and-forget background task."""
    return _pool.submit(fn, *args, **kwargs)


def run_with_timeout(
    fn: Callable[..., Any],
    timeout_seconds: float,
    *args: Any,
    reraise: tuple[type[BaseException], ...] = (),
    **kwargs: Any,
) -> tuple[Any | None, bool]:
    """
    Run function in worker thread with timeout.
    Returns (result, timed_out).
    Exception types in *reraise* are propagated to the caller instead of being swallowed.
    """
    fut = _pool.submit(fn, *args, **kwargs)
    try:
        return fut.result(timeout=timeout_seconds), False
    except TimeoutError:
        return None, True
    except Exception as e:
        for t in reraise:
            if isinstance(e, t):
                raise
        logger.exception("run_with_timeout: worker raised (not a timeout)")
        return None, False
