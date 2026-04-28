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
# Prefer env override; default to llama3.2:1b (lightweight), fall back automatically
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

# Model priority: lightweight first to prevent OOM/crashes
_MODEL_PRIORITY = ["qwen2.5:0.5b", "llama3.2:1b", "qwen2.5:1.5b", "qwen2.5:3b", "mistral:latest"]


def _resolve_model(preferred: str, base_url: str) -> str:
    """Return `preferred` if installed, else first model from priority list, else first available."""
    try:
        resp = requests.get(f"{base_url}/api/tags", timeout=5)
        if resp.ok:
            installed = {m["name"] for m in resp.json().get("models", [])}
            installed_bases = {m.split(":")[0] for m in installed}

            logger.info("[ScriptGenerator] Installed models: %s", sorted(installed))

            # Exact match for preferred
            if preferred in installed:
                return preferred
            # Base-name match for preferred (e.g. "qwen2.5:3b" vs "qwen2.5:3b-instruct-q4")
            pref_base = preferred.split(":")[0]
            for m in installed:
                if m.split(":")[0] == pref_base:
                    logger.info("[ScriptGenerator] Resolved '%s' → '%s'", preferred, m)
                    return m

            # Walk priority list
            for candidate in _MODEL_PRIORITY:
                if candidate in installed:
                    logger.warning("[ScriptGenerator] '%s' not found; using '%s'", preferred, candidate)
                    return candidate
                cand_base = candidate.split(":")[0]
                for m in installed:
                    if m.split(":")[0] == cand_base:
                        logger.warning("[ScriptGenerator] '%s' not found; using '%s'", preferred, m)
                        return m

            # Last resort: whatever is installed
            first = next(iter(installed), None)
            if first:
                logger.warning("[ScriptGenerator] Falling back to first available model: '%s'", first)
                return first
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ScriptGenerator] Could not query Ollama tags: %s", exc)
    return preferred  # best-effort — Ollama will surface the error


_SYSTEM_PROMPT = (
    "You are an expert educational video creator. Convert course material into a structured, engaging script. "
    "Output ONLY valid JSON. Be descriptive and detailed."
)

_USER_TEMPLATE = """\
Convert the following course content into a video script.

COURSE CONTENT:
{content}

Return ONLY a raw JSON object (no markdown, no extra text) with this schema:
{{
  "title": "<title>",
  "language": "<en/fr>",
  "scenes": [
    {{
      "scene_number": 1,
      "title": "<scene title>",
      "narration": "<detailed spoken text, 50-100 words>",
      "key_points": ["<point 1>", "<point 2>", "<point 3>"],
      "duration_estimate_seconds": <integer 15-45>
    }}
  ]
}}

Rules:
- 4 to 6 scenes total.
- Narration: Natural, professional teaching style.
- Key points: 3 points per scene.
- Duration: Estimate seconds based on narration length (~3 words/sec).
- Output raw JSON only."""


class ScriptGenerator:
    """Generate a structured video script from course text using Ollama."""

    def __init__(self, model: str | None = None):
        self.base_url = OLLAMA_BASE_URL
        self.model = _resolve_model(model or OLLAMA_MODEL, self.base_url)
        logger.info("[ScriptGenerator] Initialized with model='%s'", self.model)

    def generate(self, course_content: str, max_content_chars: int = 1500) -> dict:
        """
        Generate a video script from raw course text.

        Args:
            course_content: Raw course text (markdown, plain text, etc.)
            max_content_chars: Truncate content to avoid token overflow (default 2000)

        Returns:
            Parsed script dict with title, language, and scenes list
        """
        content = course_content[:max_content_chars].strip()
        if not content:
            raise ValueError("Course content cannot be empty")

        prompt = _USER_TEMPLATE.format(content=content)

        logger.info(
            "[ScriptGenerator] Calling Ollama model=%s content_len=%d prompt_len=%d",
            self.model, len(content), len(prompt),
        )

        # Use /api/chat — handles system messages more reliably across models
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": prompt},
            ],
            "stream": False,
            "format": "json",  # Force Ollama to return valid JSON
            "options": {
                "temperature": 0.2,   
                "num_ctx": 2048,      
                "num_predict": 1000,   # plenty of room for 4-6 scenes
            },
        }

        try:
            resp = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=300,
            )
            if not resp.ok:
                # Log full body so we can see the real error
                logger.error(
                    "[ScriptGenerator] Ollama error %s: %s",
                    resp.status_code, resp.text[:500],
                )
            resp.raise_for_status()
            raw_text = resp.json().get("message", {}).get("content", "")
        except requests.RequestException as exc:
            logger.error("[ScriptGenerator] Ollama request failed: %s", exc)
            raise RuntimeError(f"Ollama unavailable: {exc}") from exc

        script = self._parse_json(raw_text)
        self._validate(script)
        logger.info("[ScriptGenerator] Script generated: %d scenes", len(script["scenes"]))
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
