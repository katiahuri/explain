"""Renders the brand backgrounds the PowerPoint decks use (PowerPoint shapes can't hold these gradients).

Run once: python make-assets.py  ->  writes PNGs into ./assets
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).parent / "assets"
OUT.mkdir(exist_ok=True)
W, H = 1920, 1080


def hex_rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def save(arr, name):
    Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save(OUT / name, optimize=True)


yy, xx = np.mgrid[0:H, 0:W].astype(float)

# Accent: 115deg linear gradient, deep violet -> blue
angle = math.radians(115 - 90)
t = (xx / W) * math.cos(angle) + (yy / H) * math.sin(angle)
t = (t - t.min()) / (t.max() - t.min())
a, b = hex_rgb("6D28D9"), hex_rgb("3B82F6")
save(a + (b - a) * t[..., None], "bg-accent.png")

# Dark: navy with a soft blue glow top-right and a violet glow bottom
navy = hex_rgb("0B1026")
glow1 = hex_rgb("1E2A6B")
glow2 = hex_rgb("2A1B5E")
d1 = np.sqrt(((xx - 0.80 * W) / W) ** 2 + ((yy - 0.28 * H) / W) ** 2)
d2 = np.sqrt(((xx - 0.60 * W) / W) ** 2 + ((yy - 1.05 * H) / W) ** 2)
w1 = np.clip(1 - d1 / 0.42, 0, 1)[..., None] ** 1.6
w2 = np.clip(1 - d2 / 0.45, 0, 1)[..., None] ** 1.8 * 0.7
save(navy + (glow1 - navy) * w1 + (glow2 - navy) * w2, "bg-dark.png")

# Orbit illustration (transparent), drawn at 4x and downsampled for smooth edges
S = 4
size = 900 * S
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
c = size / 2
R = 420 * S
draw.ellipse([c - R, c - R, c + R, c + R], outline=(255, 255, 255, 22), width=3 * S)

# Gradient arc from 10 o'clock clockwise to 5 o'clock
violet, blue = hex_rgb("9D64FF"), hex_rgb("3B82F6")
start, end = -150, 60
steps = 240
for i in range(steps):
    a0 = start + (end - start) * i / steps
    a1 = start + (end - start) * (i + 1) / steps
    col = violet + (blue - violet) * (i / steps)
    draw.arc([c - R, c - R, c + R, c + R], a0, a1 + 0.4, fill=tuple(int(v) for v in col) + (255,), width=6 * S)

# Planet with a radial highlight
pr = 250 * S
planet = Image.new("RGBA", (size, size), (0, 0, 0, 0))
pa = np.zeros((size, size, 4), dtype=float)
py, px = np.mgrid[0:size, 0:size].astype(float)
dist = np.sqrt((px - c) ** 2 + (py - c) ** 2)
hd = np.sqrt((px - (c - 0.3 * pr)) ** 2 + (py - (c - 0.35 * pr)) ** 2) / (1.35 * pr)
hd = np.clip(hd, 0, 1)[..., None]
inner, mid, outer = hex_rgb("3A50B8"), hex_rgb("1A2566"), hex_rgb("0B1026")
col = np.where(hd < 0.55, inner + (mid - inner) * (hd / 0.55), mid + (outer - mid) * ((hd - 0.55) / 0.45))
pa[..., :3] = col
pa[..., 3] = np.where(dist <= pr, 255, 0)
planet = Image.fromarray(pa.astype(np.uint8), "RGBA")
img.alpha_composite(planet)
draw = ImageDraw.Draw(img)
draw.ellipse([c - pr, c - pr, c + pr, c + pr], outline=(157, 100, 255, 110), width=3 * S)

for ang, rad, col in ((-150, 18, (157, 100, 255, 255)), (60, 20, (59, 130, 246, 255))):
    x = c + R * math.cos(math.radians(ang))
    y = c + R * math.sin(math.radians(ang))
    draw.ellipse([x - rad * S, y - rad * S, x + rad * S, y + rad * S], fill=col)

img.resize((900, 900), Image.LANCZOS).save(OUT / "orbit.png", optimize=True)
print("wrote", sorted(p.name for p in OUT.iterdir()))
