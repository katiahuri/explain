"""Renders the social card every page shares: assets/og-card.png, 1200x630.

The card is the page scripts/og-card.html, set in the site's own face (Onest, from Google Fonts) and colours,
screenshotted in headless Edge. Not part of the Vercel build: run it when the card's words change, then commit
the PNG:

    python scripts/og-card.py
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "og-card.png"
PAGE = (ROOT / "scripts" / "og-card.html").as_uri()
EDGE = next(p for p in [
    Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
    Path("C:/Program Files/Microsoft/Edge/Application/msedge.exe"),
] if p.exists())

subprocess.run([
    str(EDGE), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1200,630", "--virtual-time-budget=4000", f"--screenshot={OUT}", PAGE,
], check=True, capture_output=True)
print(f"Wrote {OUT.relative_to(ROOT)} (1200x630, {OUT.stat().st_size // 1024} KB)")
