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
        total_scenes = len(scenes)
        for scene in scenes:
            idx = scene.get("scene_number", len(paths) + 1)
            path = self._render_scene(scene, idx, total_scenes, job_dir, Image, ImageDraw, ImageFont)
            paths.append(path)
            logger.info(f"[SlideRenderer] Rendered slide {idx}: {path.name}")

        return paths

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _render_scene(self, scene: dict, idx: int, total_scenes: int, out_dir: Path, Image, ImageDraw, ImageFont) -> Path:
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
        y_cursor += 50

        # Render based on visual schema
        schema = scene.get("visual_schema", "bullet_list")
        if schema == "process_flow":
            self._draw_process_flow(draw, scene.get("key_points", []), y_cursor, bullet_font)
        elif schema == "concept_map":
            self._draw_concept_map(draw, scene.get("title", ""), scene.get("key_points", []), y_cursor, bullet_font)
        elif schema == "cycle":
            self._draw_cycle(draw, scene.get("key_points", []), bullet_font)
        else:
            self._draw_bullets(draw, scene.get("key_points", []), y_cursor, bullet_font)

        # Progress bar at bottom
        progress_w = int((idx / max(1, total_scenes)) * self.WIDTH)
        draw.rectangle([(0, self.HEIGHT - 10), (progress_w, self.HEIGHT)], fill=self.ACCENT)

        path = out_dir / f"slide_{idx:02d}.png"
        img.save(str(path), "PNG")
        return path

    def _draw_bullets(self, draw, points, y, font):
        for point in points[:5]:
            bullet = f"  ▶  {point}"
            wrapped = textwrap.wrap(bullet, width=60)
            for wline in wrapped[:2]:
                draw.text((90, y), wline, font=font, fill=self.BULLET_COLOR)
                y += 44
            y += 12

    def _draw_process_flow(self, draw, points, y, font):
        x = 120
        box_w = 280
        box_h = 100
        for i, point in enumerate(points[:3]):
            # Box
            draw.rounded_rectangle([(x, y), (x + box_w, y + box_h)], radius=15, outline=self.ACCENT, width=3)
            # Text
            txt = textwrap.fill(point, width=15)
            draw.text((x + box_w/2, y + box_h/2), txt, font=font, fill=self.TITLE_COLOR, anchor="mm", align="center")
            
            if i < 2: # Arrow
                draw.line([(x + box_w + 10, y + box_h/2), (x + box_w + 50, y + box_h/2)], fill=self.ACCENT, width=5)
                draw.polygon([(x + box_w + 50, y + box_h/2 - 10), (x + box_w + 70, y + box_h/2), (x + box_w + 50, y + box_h/2 + 10)], fill=self.ACCENT)
            x += 380

    def _draw_concept_map(self, draw, center_text, points, y, font):
        cx, cy = self.WIDTH // 2, y + 150
        # Center node
        draw.ellipse([(cx - 100, cy - 60), (cx + 100, cy + 60)], outline=self.ACCENT, width=4)
        draw.text((cx, cy), textwrap.fill(center_text, width=12), font=font, fill=self.TITLE_COLOR, anchor="mm", align="center")
        
        # Sub nodes
        angles = [210, 330, 90] # degrees
        for i, point in enumerate(points[:3]):
            angle_rad = angles[i] * 3.1415 / 180
            px = cx + 280 * 1.5 * (0.5 * (angles[i]==330) - 0.5*(angles[i]==210)) # simple Manual layout
            if i == 0: px, py = cx - 350, cy + 100
            elif i == 1: px, py = cx + 350, cy + 100
            else: px, py = cx, cy + 220
            
            draw.line([(cx, cy), (px, py)], fill=self.ACCENT, width=2)
            draw.rounded_rectangle([(px - 120, py - 40), (px + 120, py + 40)], radius=10, fill=self.BG_TOP, outline=self.BULLET_COLOR)
            draw.text((px, py), textwrap.fill(point, width=18), font=font, fill=self.BULLET_COLOR, anchor="mm", align="center")

    def _draw_cycle(self, draw, points, font):
        cx, cy = self.WIDTH // 2, self.HEIGHT // 2 + 50
        radius = 200
        for i, point in enumerate(points[:4]):
            angle = (i * 90 - 45) * 3.1415 / 180
            px = cx + radius * 1.4 * (1 if i in (1,2) else -1) # rough
            # Position manually for 4 steps cycle
            positions = [(cx, cy - 180), (cx + 250, cy), (cx, cy + 180), (cx - 250, cy)]
            px, py = positions[i]
            
            draw.rounded_rectangle([(px - 100, py - 50), (px + 100, py + 50)], radius=20, outline=self.ACCENT, width=3)
            draw.text((px, py), textwrap.fill(point, width=12), font=font, fill=self.TITLE_COLOR, anchor="mm", align="center")
            
            # Simple curved arrow logic... skip for now but draw connecting lines
            # next_p = positions[(i+1)%4]
            # draw.line([(px, py), next_p], fill=self.ACCENT, width=2)

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
