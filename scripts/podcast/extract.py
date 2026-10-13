# Pulls the spoken text out of the facilitator scripts so the podcast pipeline
# has something to work from:
#   course/podcast/raw/NN-slug.txt    one plain-text file per episode
#
# Reads the episode list from scripts/podcast/cast.json. Handles .docx (a zip of
# XML, no dependencies needed) and .txt. Nothing here is deployed; the whole
# course/podcast/ folder is gitignored.
# Usage: python scripts/podcast/extract.py
import html
import json
import pathlib
import re
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
CAST = json.loads((ROOT / "scripts/podcast/cast.json").read_text(encoding="utf-8"))
OUT = ROOT / "course/podcast/raw"


def from_docx(path):
    xml = zipfile.ZipFile(path).read("word/document.xml").decode("utf-8")
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab/>", "\t", xml)
    xml = re.sub(r"<w:br/>", "\n", xml)
    return html.unescape(re.sub(r"<[^>]+>", "", xml))


def tidy(text):
    # Word leaves smart quotes and dashes that read badly downstream.
    swaps = {"‘": "'", "’": "'", "“": '"', "”": '"',
             "–": "-", "—": " - ", "…": "...", " ": " "}
    for bad, good in swaps.items():
        text = text.replace(bad, good)
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in text.split("\n")]
    out = []
    for line in lines:
        if not line and out and not out[-1]:
            continue  # collapse runs of blank lines
        out.append(line)
    return "\n".join(out).strip() + "\n"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for ep in CAST["episodes"]:
        src = ROOT / ep["source"]
        if not src.exists():
            missing.append(ep["source"])
            continue
        raw = from_docx(src) if src.suffix == ".docx" else src.read_text(encoding="utf-8", errors="replace")
        dest = OUT / f"{ep['number']}-{ep['slug']}.txt"
        dest.write_text(tidy(raw), encoding="utf-8")
        words = len(dest.read_text(encoding="utf-8").split())
        print(f"{dest.relative_to(ROOT)}  {words} words")
    for m in missing:
        print(f"MISSING  {m}")


if __name__ == "__main__":
    main()
