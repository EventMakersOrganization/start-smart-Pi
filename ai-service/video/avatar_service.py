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

from core import config

DID_API_KEY  = config.DID_API_KEY
DID_BASE_URL = config.DID_BASE_URL

# Default presenter (D-ID built-in avatar — no upload needed)
DEFAULT_PRESENTER_URL = (
    "https://d-id-public-bucket.s3.us-west-2.amazonaws.com/guy.jpg"
)

# Voice provider settings (Microsoft Azure Neural TTS — built into D-ID)
DEFAULT_VOICE_EN = "en-US-AndrewNeural"
DEFAULT_VOICE_FR = "fr-FR-HenriNeural"

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
        local_image_path: str | None = None,
    ) -> str | None:
        """
        Submit a D-ID talks job and wait for completion.

        Args:
            narration_text: Full spoken script (all scenes joined).
            language: "en" or "fr" — selects the voice.
            presenter_url: Optional custom avatar image URL.
            local_image_path: Optional path to a local image file.

        Returns:
            CDN URL of the finished MP4, or None if D-ID is unavailable.
        """
        if not self.available:
            logger.warning("[AvatarService] DID_API_KEY not set — skipping avatar generation")
            return None

        voice = DEFAULT_VOICE_FR if language == "fr" else DEFAULT_VOICE_EN
        
        # If we have a local path, upload it to D-ID first
        source = presenter_url
        if local_image_path and os.path.exists(local_image_path):
            source = self.upload_image(local_image_path)
        
        source = source or DEFAULT_PRESENTER_URL

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

    def upload_image(self, image_file_path: str) -> str | None:
        """Upload a local image to D-ID and return the remote URL."""
        logger.info(f"[AvatarService] Uploading image: {image_file_path}")
        try:
            with open(image_file_path, 'rb') as f:
                files = {"image": f}
                resp = requests.post(
                    f"{self._base}/images",
                    headers=self._headers(is_json=False),
                    files=files,
                    timeout=30
                )
            if resp.status_code not in [200, 201]:
                logger.error(f"[AvatarService] Image upload failed: {resp.text}")
                return None
            
            data = resp.json()
            return data.get("url")
        except Exception as e:
            logger.error(f"[AvatarService] Upload error: {str(e)}")
            return None

    def _headers(self, is_json=True) -> dict:
        import base64
        # D-ID uses Basic auth. If the key already contains ':', use it directly.
        # Otherwise, append ':' as username: (password is empty for standard keys).
        auth_val = self._api_key if ":" in self._api_key else f"{self._api_key}:"
        token = base64.b64encode(auth_val.encode()).decode()
        h = {
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
        }
        if is_json:
            h["Content-Type"] = "application/json"
        return h

    def _create_talk(self, text: str, voice: str, source_url: str) -> str | None:
        # ─── SANITIZATION ───
        # D-ID can fail with a 500 error if the text contains emojis or special unicode.
        import unicodedata
        clean_text = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
        
        payload = {
            "source_url": source_url,
            "script": {
                "type": "text",
                "subtitles": False,
                "provider": {
                    "type": "microsoft",
                    "voice_id": voice,
                },
                "input": clean_text,
            },
            "config": {
                "fluent": True,
                "pad_audio": 0.0,
                "stitch": True
            }
        }
        try:
            resp = requests.post(
                f"{self._base}/talks",
                headers=self._headers(),
                json=payload,
                timeout=60
            )
            if resp.status_code != 201:
                logger.error(f"[AvatarService] D-ID create failed ({resp.status_code}): {resp.text}")
                # Print to stdout so user can see it immediately
                print(f"\n[AvatarService] !!! D-ID API ERROR {resp.status_code} !!!")
                print(f"RESPONSE: {resp.text}\n")
                return None
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
