"""
ScriptGenerator — uses Ollama to turn raw course text into a structured video script.

Output JSON shape:
{
  "title": "...",
  "language": "en",
  "scenes": [
    {
      "scene_number": 1,
      "title": "Introduction",
      "narration": "Full spoken text for this scene...",
      "key_points": ["point 1", "point 2"],
      "duration_estimate_seconds": 45
    },
    ...
  ]
}
"""

from __future__ import annotations

import json
import logging
import os
import re

import requests

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = "qwen2.5:3b"

_SYSTEM_PROMPT = """You are an expert educational content creator.
Your task is to convert raw course material into a structured, engaging video script.
The script must be friendly, clear, and suitable for a 3-6 minute explainer video.
Always respond with VALID JSON only — no markdown fences, no extra text."""

_USER_TEMPLATE = """Convert the following course content into a video script.

COURSE CONTENT:
{content}

Return a JSON object with this EXACT schema (no extra fields):
{{
  "title": "<short video title>",
  "language": "<en or fr>",
  "scenes": [
    {{
      "scene_number": 1,
      "title": "<scene heading>",
      "narration": "<full spoken narration — 50-120 words>",
      "key_points": ["<bullet 1>", "<bullet 2>", "<bullet 3>"],
      "duration_estimate_seconds": <integer 30-90>
    }}
  ]
}}

Rules:
- Between 4 and 7 scenes total
- Each narration is natural spoken English or French (match the course language)
- Key points are SHORT (max 8 words each)
- Do NOT include code snippets in narration — describe concepts only
- Respond with raw JSON only"""


class ScriptGenerator:
    """Generate a structured video script from course text using Ollama."""

    def __init__(self, model: str | None = None):
        self.model = model or OLLAMA_MODEL
        self.base_url = OLLAMA_BASE_URL

    def generate(self, course_content: str, max_content_chars: int = 4000) -> dict:
        """
        Generate a video script from raw course text.

        Args:
            course_content: Raw course text (markdown, plain text, etc.)
            max_content_chars: Truncate content to avoid token overflow

        Returns:
            Parsed script dict with title, language, and scenes list
        """
        content = course_content[:max_content_chars].strip()
        if not content:
            raise ValueError("Course content cannot be empty")

        prompt = _USER_TEMPLATE.format(content=content)

        logger.info(f"[ScriptGenerator] Calling Ollama model={self.model}, content_len={len(content)}")

        try:
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "system": _SYSTEM_PROMPT,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 2048,
                    },
                },
                timeout=300,
            )
            resp.raise_for_status()
            raw_text = resp.json().get("response", "")
        except requests.RequestException as exc:
            logger.error(f"[ScriptGenerator] Ollama request failed: {exc}")
            raise RuntimeError(f"Ollama unavailable: {exc}") from exc

        script = self._parse_json(raw_text)
        self._validate(script)
        logger.info(f"[ScriptGenerator] Script generated: {len(script['scenes'])} scenes")
        return script

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_json(raw: str) -> dict:
        """Strip markdown fences and parse JSON — resilient to Ollama formatting artifacts."""
        # Remove ```json ... ``` fences
        cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
        # Find first { ... } block
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not match:
            raise ValueError(f"No JSON object found in Ollama response: {raw[:300]}")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON from Ollama: {exc}\nRaw: {raw[:300]}") from exc

    @staticmethod
    def _validate(script: dict) -> None:
        """Basic schema validation — raise ValueError on bad structure."""
        if "scenes" not in script or not isinstance(script["scenes"], list):
            raise ValueError("Script must have a 'scenes' list")
        if len(script["scenes"]) < 1:
            raise ValueError("Script must have at least 1 scene")
        for i, s in enumerate(script["scenes"]):
            if "narration" not in s:
                raise ValueError(f"Scene {i} missing 'narration'")
