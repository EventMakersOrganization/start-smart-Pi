"""
Canonical directories under the ai-service root (logs, generated reports).
Use these instead of scattering *.log next to random modules.
"""
from __future__ import annotations

from pathlib import Path


def service_root() -> Path:
    """Directory that contains api.py, core/, embeddings/, etc."""
    return Path(__file__).resolve().parent.parent


def logs_dir() -> Path:
    """Persistent log files (embeddings, batch processing, errors)."""
    p = service_root() / "logs"
    p.mkdir(parents=True, exist_ok=True)
    return p


def docs_reports_dir() -> Path:
    """Sprint integration reports and evaluation JSON outputs."""
    p = service_root() / "docs" / "reports"
    p.mkdir(parents=True, exist_ok=True)
    return p
