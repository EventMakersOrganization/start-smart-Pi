"""
AvatarService — integrates with D-ID API to produce a talking-avatar video.

D-ID free trial: https://www.d-id.com  (sign up → ~20 free credits, 1 credit ≈ 1 min video)
API docs: https://docs.d-id.com

Flow:
  1. POST /talks  →  { id: "tlk_xxx" }          (create job)
  2. GET  /talks/{id}  →  poll until done
  3. Return result_url  (CDN link to the mp4)

If D-ID is not configured (no API key) the service falls back gracefully by returning None,
so the NestJS layer can still serve the slides-only video.
"""

from __future__ import annotations

import logging
import os
import time

import requests

logger = logging.getLogger(__name__)

DID_API_KEY  = os.getenv("DID_API_KEY", "")
DID_BASE_URL = os.getenv("DID_BASE_URL", "https://api.d-id.com")

# Default presenter (D-ID built-in avatar — no upload needed)
DEFAULT_PRESENTER_URL = (
    "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg"
)

# Voice provider settings (Microsoft Azure Neural TTS — built into D-ID)
DEFAULT_VOICE_EN = "en-US-JennyNeural"
DEFAULT_VOICE_FR = "fr-FR-DeniseNeural"

POLL_INTERVAL  = 4   # seconds between status polls
MAX_POLL_TRIES = 45  # max wait ≈ 3 minutes


class AvatarService:
    """Create a talking-avatar video via D-ID REST API."""

    def __init__(self):
        self._api_key = DID_API_KEY
        self._base    = DID_BASE_URL.rstrip("/")

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def create_video(
        self,
        narration_text: str,
        language: str = "en",
        presenter_url: str | None = None,
    ) -> str | None:
        """
        Submit a D-ID talks job and wait for completion.

        Args:
            narration_text: Full spoken script (all scenes joined).
            language: "en" or "fr" — selects the voice.
            presenter_url: Optional custom avatar image URL.

        Returns:
            CDN URL of the finished MP4, or None if D-ID is unavailable.
        """
        if not self.available:
            logger.warning("[AvatarService] DID_API_KEY not set — skipping avatar generation")
            return None

        voice = DEFAULT_VOICE_FR if language == "fr" else DEFAULT_VOICE_EN
        source = presenter_url or DEFAULT_PRESENTER_URL

        # Truncate to D-ID's text limit (≈ 4 000 chars per request)
        text = narration_text[:4000].strip()

        logger.info(f"[AvatarService] Creating D-ID talk | voice={voice} | chars={len(text)}")
        talk_id = self._create_talk(text, voice, source)
        if not talk_id:
            return None

        result_url = self._poll(talk_id)
        logger.info(f"[AvatarService] Done → {result_url}")
        return result_url

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _headers(self) -> dict:
        import base64
        # D-ID uses Basic auth where username=api_key and password is empty
        token = base64.b64encode(f"{self._api_key}:".encode()).decode()
        return {
            "Authorization": f"Basic {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _create_talk(self, text: str, voice: str, source_url: str) -> str | None:
        payload = {
            "source_url": source_url,
            "script": {
                "type": "text",
                "subtitles": False,
                "provider": {
                    "type": "microsoft",
                    "voice_id": voice,
                },
                "input": text,
            },
            "config": {
                "fluent": True,
                "pad_audio": 0.0,
                "stitch": True,
            },
        }
        try:
            resp = requests.post(
                f"{self._base}/talks",
                headers=self._headers(),
                json=payload,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            talk_id = data.get("id")
            logger.info(f"[AvatarService] Talk job created: {talk_id}")
            return talk_id
        except requests.HTTPError as exc:
            logger.error(f"[AvatarService] D-ID create failed: {exc.response.text}")
            return None
        except requests.RequestException as exc:
            logger.error(f"[AvatarService] D-ID request error: {exc}")
            return None

    def _poll(self, talk_id: str) -> str | None:
        for attempt in range(MAX_POLL_TRIES):
            time.sleep(POLL_INTERVAL)
            try:
                resp = requests.get(
                    f"{self._base}/talks/{talk_id}",
                    headers=self._headers(),
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
                status = data.get("status", "")
                logger.debug(f"[AvatarService] Poll #{attempt + 1} status={status}")

                if status == "done":
                    return data.get("result_url")
                if status in ("error", "rejected"):
                    logger.error(f"[AvatarService] D-ID error: {data}")
                    return None
            except requests.RequestException as exc:
                logger.warning(f"[AvatarService] Poll error: {exc}")

        logger.error("[AvatarService] Timed out waiting for D-ID video")
        return None
