"""
SlideRenderer — generates PNG slide images from a video script using Pillow.

Each scene → one 1280×720 PNG with:
  - Gradient background
  - Scene title
  - Key points as bullet list
  - Scene number badge
"""

from __future__ import annotations

import logging
import os
import textwrap
from pathlib import Path

logger = logging.getLogger(__name__)

# Output directory (created automatically)
OUTPUT_DIR = Path(os.getenv("VIDEO_OUTPUT_DIR", "./generated_videos"))


def _try_import_pillow():
    try:
        from PIL import Image, ImageDraw, ImageFont
        return Image, ImageDraw, ImageFont
    except ImportError:
        raise ImportError(
            "Pillow is required for slide rendering. Install: pip install Pillow"
        )


class SlideRenderer:
    """Render PNG slides for each scene of a video script."""

    WIDTH = 1280
    HEIGHT = 720

    # Design palette
    BG_TOP = (15, 23, 42)       # dark navy
    BG_BOTTOM = (30, 41, 59)    # slightly lighter
    ACCENT = (99, 102, 241)     # indigo
    TITLE_COLOR = (255, 255, 255)
    BULLET_COLOR = (203, 213, 225)
    SCENE_NUM_BG = (99, 102, 241)
    SCENE_NUM_FG = (255, 255, 255)

    def render_all(self, script: dict, job_id: str) -> list[Path]:
        """
        Render one PNG per scene.

        Returns:
            List of absolute Paths to generated PNG files (in order).
        """
        Image, ImageDraw, ImageFont = _try_import_pillow()
        job_dir = OUTPUT_DIR / job_id / "slides"
        job_dir.mkdir(parents=True, exist_ok=True)

        paths: list[Path] = []
        scenes = script.get("scenes", [])
        for scene in scenes:
            idx = scene.get("scene_number", len(paths) + 1)
            path = self._render_scene(scene, idx, job_dir, Image, ImageDraw, ImageFont)
            paths.append(path)
            logger.info(f"[SlideRenderer] Rendered slide {idx}: {path.name}")

        return paths

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _render_scene(self, scene: dict, idx: int, out_dir: Path, Image, ImageDraw, ImageFont) -> Path:
        img = Image.new("RGB", (self.WIDTH, self.HEIGHT))
        draw = ImageDraw.Draw(img)

        # Gradient background (top → bottom)
        for y in range(self.HEIGHT):
            ratio = y / self.HEIGHT
            r = int(self.BG_TOP[0] + (self.BG_BOTTOM[0] - self.BG_TOP[0]) * ratio)
            g = int(self.BG_TOP[1] + (self.BG_BOTTOM[1] - self.BG_TOP[1]) * ratio)
            b = int(self.BG_TOP[2] + (self.BG_BOTTOM[2] - self.BG_TOP[2]) * ratio)
            draw.line([(0, y), (self.WIDTH, y)], fill=(r, g, b))

        # Accent left bar
        draw.rectangle([(60, 80), (68, self.HEIGHT - 80)], fill=self.ACCENT)

        # Load fonts (fallback to default if not available)
        title_font = self._load_font(ImageFont, size=52)
        bullet_font = self._load_font(ImageFont, size=32)
        badge_font = self._load_font(ImageFont, size=28)

        # Scene number badge
        badge_text = f"Scene {idx}"
        draw.rounded_rectangle([(80, 80), (230, 130)], radius=12, fill=self.SCENE_NUM_BG)
        draw.text((155, 105), badge_text, font=badge_font, fill=self.SCENE_NUM_FG, anchor="mm")

        # Scene title
        title_text = scene.get("title", f"Scene {idx}")
        title_lines = textwrap.wrap(title_text, width=42)
        y_cursor = 160
        for line in title_lines[:2]:
            draw.text((90, y_cursor), line, font=title_font, fill=self.TITLE_COLOR)
            y_cursor += 62

        # Divider
        y_cursor += 10
        draw.line([(90, y_cursor), (self.WIDTH - 90, y_cursor)], fill=self.ACCENT, width=2)
        y_cursor += 30

        # Bullet points
        key_points = scene.get("key_points", [])[:5]
        for point in key_points:
            bullet = f"  ▶  {point}"
            wrapped = textwrap.wrap(bullet, width=60)
            for wline in wrapped[:2]:
                draw.text((90, y_cursor), wline, font=bullet_font, fill=self.BULLET_COLOR)
                y_cursor += 44
            y_cursor += 8

        path = out_dir / f"slide_{idx:02d}.png"
        img.save(str(path), "PNG")
        return path

    @staticmethod
    def _load_font(ImageFont, size: int):
        """Try to load a system font; fall back to Pillow default."""
        candidates = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]
        for path in candidates:
            if os.path.exists(path):
                try:
                    return ImageFont.truetype(path, size)
                except Exception:
                    continue
        return ImageFont.load_default()
