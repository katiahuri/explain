"""Renders the YouTube video watermark: assets/youtube-watermark.png, 150x150.

The branding image YouTube overlays in the corner of the player. It is the
site's own icon mark, redrawn at this size rather than upscaled, on the navy
tile - a transparent mark would disappear over light footage.

Needs Pillow and numpy, so it is not part of the Vercel build. Run it when the
mark changes, then commit the PNG:

    python scripts/youtube-watermark.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "youtube-watermark.png"

SIZE, S = 150, 6        # drawn at 6x, then downsampled for clean edges
N = SIZE * S

hex_rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)
VIOLET, BLUE = hex_rgb("9D64FF"), hex_rgb("3B82F6")

# The tile: the icon's navy with the hero's blue glow in the upper right.
yy, xx = np.mgrid[0:N, 0:N].astype(float)
navy, glow = hex_rgb("0B1026"), hex_rgb("24307A")
w = np.clip(1 - np.sqrt(((xx - 0.80 * N) / N) ** 2 + ((yy - 0.16 * N) / N) ** 2) / 0.78, 0, 1)[..., None] ** 1.5
tile = Image.fromarray(np.clip(navy + (glow - navy) * w, 0, 255).astype(np.uint8)).convert("RGBA")

# Rounded-square alpha, plus a hairline edge so the badge reads on pale video.
corner = Image.new("L", (N, N), 0)
ImageDraw.Draw(corner).rounded_rectangle([0, 0, N - 1, N - 1], radius=int(0.23 * N), fill=255)
tile.putalpha(corner)
ImageDraw.Draw(tile).rounded_rectangle(
    [S, S, N - 1 - S, N - 1 - S], radius=int(0.23 * N) - S, outline=(255, 255, 255, 46), width=S)

d = ImageDraw.Draw(tile)
cx, cy, R = N // 2, int(0.52 * N), int(0.33 * N)
box = [cx - R, cy - R, cx + R, cy + R]

# The orbit: a faint full ring, then the brand sweep over most of it.
d.ellipse(box, outline=(255, 255, 255, 34), width=int(1.6 * S))
for i in range(240):
    a0 = 20 + 290 * i / 240
    col = VIOLET + (BLUE - VIOLET) * (i / 240)
    d.arc(box, a0, a0 + 1.6, fill=tuple(int(v) for v in col) + (255,), width=int(2.2 * S))

# The two nodes the icon sets on the ring.
for ang, col in ((-128, VIOLET), (-14, BLUE)):
    a = np.radians(ang)
    nx, ny = cx + R * np.cos(a), cy + R * np.sin(a)
    r = 3.4 * S
    d.ellipse([nx - r, ny - r, nx + r, ny + r], fill=tuple(int(v) for v in col) + (255,))

FONTS = ROOT / "scripts" / "fonts"
local = FONTS / "poppins-700.ttf"
f = ImageFont.truetype(str(local if local.exists() else Path("C:/Windows/Fonts/segoeuib.ttf")), int(0.42 * N))

# "AI" in the brand gradient, lifted a few steps: at player size the glyph is
# only some 40px across, and the site's own violet goes muddy on dark footage.
LIT_VIOLET, LIT_BLUE = hex_rgb("B98CFF"), hex_rgb("63A6FB")
mask = Image.new("L", (N, N), 0)
ImageDraw.Draw(mask).text((cx, cy), "AI", font=f, fill=255, anchor="mm")
t = (np.mgrid[0:N, 0:N][1] / (N - 1))[..., None]
paint = Image.fromarray(np.clip(LIT_VIOLET + (LIT_BLUE - LIT_VIOLET) * t, 0, 255).astype(np.uint8)).convert("RGBA")
paint.putalpha(mask)
tile.alpha_composite(paint)

tile.resize((SIZE, SIZE), Image.LANCZOS).save(OUT, optimize=True)
print(f"Wrote {OUT.relative_to(ROOT)} ({SIZE}x{SIZE}, {OUT.stat().st_size // 1024} KB)")
