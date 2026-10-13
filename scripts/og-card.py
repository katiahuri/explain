"""Renders the social card every page shares: assets/og-card.png, 1200x630.

Needs Pillow and numpy, so it is not part of the Vercel build. Run it when the
brand or the tagline changes, then commit the PNG:

    python scripts/og-card.py
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "og-card.png"
W, H = 1200, 630

hex_rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)

# The same navy and glows as the deck backgrounds, at card proportions.
yy, xx = np.mgrid[0:H, 0:W].astype(float)
navy, glow_blue, glow_violet = hex_rgb("0B1026"), hex_rgb("1E2A6B"), hex_rgb("2A1B5E")
d1 = np.sqrt(((xx - 0.82 * W) / W) ** 2 + ((yy - 0.20 * H) / W) ** 2)
d2 = np.sqrt(((xx - 0.10 * W) / W) ** 2 + ((yy - 1.05 * H) / W) ** 2)
w1 = np.clip(1 - d1 / 0.45, 0, 1)[..., None] ** 1.6
w2 = np.clip(1 - d2 / 0.50, 0, 1)[..., None] ** 1.8 * 0.8
card = Image.fromarray(
    np.clip(navy + (glow_blue - navy) * w1 + (glow_violet - navy) * w2, 0, 255).astype(np.uint8)
)
draw = ImageDraw.Draw(card)

FONTS = Path("C:/Windows/Fonts")
font = lambda name, size: ImageFont.truetype(str(FONTS / name), size)
bold, semibold, regular = font("segoeuib.ttf", 68), font("seguisb.ttf", 26), font("segoeui.ttf", 30)

logo = Image.open(ROOT / "assets" / "logo-white.png").convert("RGBA")
logo = logo.resize((380, round(380 * logo.height / logo.width)), Image.LANCZOS)
card.paste(logo, (76, 66), logo)

# Eyebrow: the short rule the site puts before every section label.
draw.rounded_rectangle([76, 214, 106, 217], radius=2, fill=(124, 58, 237))
draw.text((120, 204), "A PRACTICAL AI COURSE FOR TECHNICAL PEOPLE", font=semibold, fill=(184, 194, 223))

draw.text((76, 268), "Don’t just use AI.", font=bold, fill=(255, 255, 255))

# "Own it." carries the brand gradient, as it does in the headings.
line = "Own it."
box = draw.textbbox((0, 0), line, font=bold)
text_w, text_h = box[2] - box[0], box[3] - box[1] + box[1] + 24
mask = Image.new("L", (text_w + 8, text_h + 8), 0)
ImageDraw.Draw(mask).text((0, 0), line, font=bold, fill=255)
t = (np.mgrid[0:mask.height, 0:mask.width][1] / max(mask.width - 1, 1))[..., None]
violet, blue = hex_rgb("9D64FF"), hex_rgb("3B82F6")
grad = Image.fromarray(np.clip(violet + (blue - violet) * t, 0, 255).astype(np.uint8))
card.paste(grad, (76, 352), mask)

draw.text((76, 470), "Nine modules on the system around the model:", font=regular, fill=(201, 208, 228))
draw.text((76, 512), "context, tools, orchestration, guardrails, evaluation.", font=regular, fill=(201, 208, 228))

# The orbit mark from the decks, quoted in the corner.
S = 4
ring = Image.new("RGBA", (420 * S, 420 * S), (0, 0, 0, 0))
rd = ImageDraw.Draw(ring)
c, R = 210 * S, 190 * S
rd.ellipse([c - R, c - R, c + R, c + R], outline=(255, 255, 255, 30), width=2 * S)
for i in range(240):
    a0 = -150 + 210 * i / 240
    col = violet + (blue - violet) * (i / 240)
    rd.arc([c - R, c - R, c + R, c + R], a0, a0 + 1.3, fill=tuple(int(v) for v in col) + (255,), width=5 * S)
pr = 110 * S
rd.ellipse([c - pr, c - pr, c + pr, c + pr], fill=(26, 37, 102, 235), outline=(157, 100, 255, 120), width=2 * S)
card.paste(ring.resize((420, 420), Image.LANCZOS), (760, 118), ring.resize((420, 420), Image.LANCZOS))

card.save(OUT, optimize=True)
print(f"Wrote {OUT.relative_to(ROOT)} ({W}x{H}, {OUT.stat().st_size // 1024} KB)")
