"""Errors raised when BrainRush cannot produce a RAG-grounded question."""


class BrainRushGroundingError(Exception):
    """Raised when retrieval is too thin or validation fails after all retries."""
