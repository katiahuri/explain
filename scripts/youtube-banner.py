"""Renders the YouTube channel banner: assets/youtube-banner.png, 2560x1440.

Same navy, glows, grid and orbit mark as the site hero, in YouTube's canvas.
YouTube crops the one image four ways, so the layout keeps every word inside
the 1546x423 band that survives on a phone, and lets the decoration live in
the wider strip desktop shows.

Needs Pillow and numpy, so it is not part of the Vercel build. Run it when the
brand or the tagline changes, then commit the PNG:

    python scripts/youtube-banner.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "youtube-banner.png"

W, H = 2560, 1440          # full canvas: what a TV shows
SAFE_W, SAFE_H = 1546, 423  # the centre band that survives on a phone
SAFE_X, SAFE_Y = (W - SAFE_W) // 2, (H - SAFE_H) // 2
MID = H // 2

hex_rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)
NAVY, GLOW_BLUE, GLOW_VIOLET = hex_rgb("0B1026"), hex_rgb("1E2A6B"), hex_rgb("2A1B5E")
VIOLET, BLUE = hex_rgb("9D64FF"), hex_rgb("3B82F6")

# Background: the hero's two glows, placed in the strip desktop actually shows.
yy, xx = np.mgrid[0:H, 0:W].astype(float)
glow = lambda cx, cy, r, p: np.clip(
    1 - np.sqrt(((xx - cx * W) / W) ** 2 + ((yy - cy * H) / W) ** 2) / r, 0, 1
)[..., None] ** p
w_blue = glow(0.80, 0.28, 0.46, 1.6)
w_violet = glow(0.14, 0.86, 0.52, 1.8) * 0.85
banner = Image.fromarray(
    np.clip(NAVY + (GLOW_BLUE - NAVY) * w_blue + (GLOW_VIOLET - NAVY) * w_violet, 0, 255).astype(np.uint8)
).convert("RGBA")

# The hero's faint grid, fading in from the left the way its mask does.
grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(grid)
CELL = 96
for x in range(0, W, CELL):
    gd.line([(x, 0), (x, H)], fill=(255, 255, 255, 26), width=2)
for y in range(MID % CELL, H, CELL):
    gd.line([(0, y), (W, y)], fill=(255, 255, 255, 26), width=2)
ramp = np.clip(np.linspace(0, 1, W) / 0.8, 0, 1) ** 1.4
fade = np.tile((ramp * 255).astype(np.uint8), (H, 1))
grid.putalpha(Image.fromarray((np.array(grid.getchannel("A")) * (fade / 255)).astype(np.uint8)))
banner.alpha_composite(grid)


def orbit(size, ring_alpha, sweep=True, fill=None):
    """The deck's orbit mark: a faint ring, a gradient sweep, an optional core."""
    S = 3
    img = Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size * S // 2
    R = c - 6 * S
    box = [c - R, c - R, c + R, c + R]
    d.ellipse(box, outline=(255, 255, 255, ring_alpha), width=2 * S)
    if sweep:
        for i in range(260):
            a0 = -152 + 214 * i / 260
            col = VIOLET + (BLUE - VIOLET) * (i / 260)
            d.arc(box, a0, a0 + 1.4, fill=tuple(int(v) for v in col) + (255,), width=5 * S)
    if fill:
        pr = int(R * 0.58)
        d.ellipse([c - pr, c - pr, c + pr, c + pr], fill=fill, outline=(157, 100, 255, 110), width=2 * S)
    return img.resize((size, size), Image.LANCZOS)


# Decoration sits in the desktop strip, clear of the phone-safe band.
mark = orbit(600, 34, sweep=True, fill=(26, 37, 102, 70))
banner.alpha_composite(mark, (2010, MID - 300))
ghost = orbit(520, 22, sweep=False)
banner.alpha_composite(ghost, (-170, MID - 260))

draw = ImageDraw.Draw(banner)

FONTS = ROOT / "scripts" / "fonts"
WIN = Path("C:/Windows/Fonts")
POPPINS = {700: "poppins-700.ttf", 600: "poppins-600.ttf", 500: "poppins-500.ttf"}
FALLBACK = {700: "segoeuib.ttf", 600: "seguisb.ttf", 500: "segoeui.ttf"}


def font(weight, size):
    """Poppins, the site's face, with Segoe UI as og-card.py's stand-in."""
    local = FONTS / POPPINS[weight]
    return ImageFont.truetype(str(local if local.exists() else WIN / FALLBACK[weight]), size)


def advances(text, f, track):
    return [f.getlength(ch) + track for ch in text]


def run_width(text, f, track):
    """Width of a tracked run: the trailing letter carries no space after it."""
    return sum(advances(text, f, track)) - (track if text else 0)


def tracked_mask(text, f, track):
    """Render a run into a mask, so it can take a solid colour or a gradient."""
    pad = 10
    asc, desc = f.getmetrics()
    mask = Image.new("L", (int(run_width(text, f, track)) + 2 * pad, asc + desc + 2 * pad), 0)
    d = ImageDraw.Draw(mask)
    x = float(pad)
    for ch, adv in zip(text, advances(text, f, track)):
        d.text((x, pad), ch, font=f, fill=255)
        x += adv
    return mask, pad


def put_run(text, f, track, left, baseline_top, fill=None, gradient=False):
    """Draw one tracked run; gradient runs get the brand violet-to-blue sweep."""
    mask, pad = tracked_mask(text, f, track)
    if gradient:
        t = (np.mgrid[0:mask.height, 0:mask.width][1] / max(mask.width - 1, 1))[..., None]
        paint = Image.fromarray(np.clip(VIOLET + (BLUE - VIOLET) * t, 0, 255).astype(np.uint8))
    else:
        paint = Image.new("RGB", mask.size, fill)
    banner.paste(paint, (int(left) - pad, int(baseline_top) - pad), mask)


# Headline: the site's own hero line, on one line.
HEAD_WHITE, HEAD_GRAD = "Understand AI. Apply it. ", "Own it."
HEAD_MAX = 1340

sub = font(500, 30)
SUB = "The system around the model: context, tools, orchestration, guardrails, evaluation."
sub_w = run_width(SUB, sub, 0)

name = font(600, 24)
NAME, name_track = "KATIA STAINFELD HURI", 0.2 * 24
name_w = run_width(NAME, name, name_track)

url = font(600, 22)
URL, url_track = "EXPLAINCOURSE.COM", 0.2 * 22
url_w = run_width(URL, url, url_track)

logo = Image.open(ROOT / "assets" / "logo-white.png").convert("RGBA")
LOGO_W = 300
logo = logo.resize((LOGO_W, round(LOGO_W * logo.height / logo.width)), Image.LANCZOS)

# One stack, centred in the phone-safe band: name, logo, headline, line, URL.
GAP_NAME, GAP_LOGO, GAP_SUB, GAP_URL = 24, 38, 30, 24
PAD = 16
asc = lambda f: f.getmetrics()[0]
fixed = (asc(name) + GAP_NAME + logo.height + GAP_LOGO + GAP_SUB
         + asc(sub) + GAP_URL + asc(url))

# The headline takes whatever is left: it has to clear both the band's width
# and its height, since YouTube crops to 1546x423 on a phone.
size = 96
while size > 40:
    head = font(700, size)
    track = -0.045 * size
    head_w = run_width(HEAD_WHITE, head, track) + run_width(HEAD_GRAD, head, track)
    if head_w <= HEAD_MAX and fixed + asc(head) <= SAFE_H - 2 * PAD:
        break
    size -= 2

stack = fixed + asc(head)
y = SAFE_Y + (SAFE_H - stack) // 2
cx = W // 2

put_run(NAME, name, name_track, cx - name_w / 2, y, fill=(184, 194, 223))
y += asc(name) + GAP_NAME

banner.alpha_composite(logo, (cx - LOGO_W // 2, y))
y += logo.height + GAP_LOGO

x = cx - head_w / 2
put_run(HEAD_WHITE, head, track, x, y, fill=(255, 255, 255))
put_run(HEAD_GRAD, head, track, x + run_width(HEAD_WHITE, head, track) + track, y, gradient=True)
y += asc(head) + GAP_SUB

put_run(SUB, sub, 0, cx - sub_w / 2, y, fill=(201, 208, 228))
y += asc(sub) + GAP_URL

# The short gradient rule the site sets before every label, split either side.
rule_y = y + asc(url) // 2 - 1
for side in (-1, 1):
    x0, x1 = sorted((cx + side * (url_w / 2 + 22), cx + side * (url_w / 2 + 56)))
    draw.rounded_rectangle([x0, rule_y, x1, rule_y + 3], radius=2, fill=(124, 58, 237))
put_run(URL, url, url_track, cx - url_w / 2, y, fill=(154, 165, 196))

banner.convert("RGB").save(OUT, optimize=True)
print(f"Wrote {OUT.relative_to(ROOT)} ({W}x{H}, {OUT.stat().st_size // 1024} KB) — headline at {size}px")
