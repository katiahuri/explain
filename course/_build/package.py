"""Exports the cheat sheets to PDF (via headless Edge or Chrome) and zips all course materials.

Outputs:
  course/cheatsheets/module-NN.pdf                 one page per module
  course/cheatsheets/ExplAIn-Course-Cheat-Sheets.pdf   all modules, one per page
  course/dist/ExplAIn-Course-Materials.zip         decks, facilitator scripts and cheat sheets
"""
import pathlib
import shutil
import subprocess
import zipfile

course = pathlib.Path(__file__).resolve().parent.parent
sheets = course / "cheatsheets"

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    shutil.which("chromium") or "", shutil.which("google-chrome") or "",
]
browser = next((b for b in BROWSERS if b and pathlib.Path(b).exists()), None)


def to_pdf(html: pathlib.Path, pdf: pathlib.Path) -> None:
    subprocess.run([
        browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=10000",
        f"--print-to-pdf={pdf}", html.resolve().as_uri(),
    ], check=True, capture_output=True, timeout=120)


if browser:
    for html in sorted(sheets.glob("module-*.html")):
        to_pdf(html, html.with_suffix(".pdf"))
    to_pdf(sheets / "index.html", sheets / "ExplAIn-Course-Cheat-Sheets.pdf")
    print(f"OK cheat sheet PDFs in {sheets.relative_to(course.parent)}")
    to_pdf(course / "certificate" / "index.html", course / "certificate" / "ExplAIn-Certificate-Sample.pdf")
    print("OK certificate sample PDF")
else:
    print("SKIPPED cheat sheet PDFs: no Edge or Chrome found")

out = course / "dist" / "ExplAIn-Course-Materials.zip"
out.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(course / "README.md", "ExplAIn-Course-Materials/README.md")
    for f in sorted(course.glob("module-*/*")):
        if f.suffix in (".pptx", ".docx"):
            z.write(f, f"ExplAIn-Course-Materials/{f.parent.name}/{f.name}")
    for f in sorted(sheets.glob("*.pdf")):
        z.write(f, f"ExplAIn-Course-Materials/cheat-sheets/{f.name}")
    for f in sorted((course / "certificate").glob("*")):
        if f.suffix in (".pptx", ".pdf"):
            z.write(f, f"ExplAIn-Course-Materials/certificate/{f.name}")
print(f"OK {out.relative_to(course.parent)} ({out.stat().st_size / 1e6:.1f} MB)")

# Public website, ready to upload: no instructor decks, scripts, sources or certificate tools.
site = course.parent
PUBLIC = ["index.html", "digital-course.html", "articles.html", "about.html", "syllabus.html",
          *sorted(p.name for p in site.glob("module-*.html")), *sorted(p.name for p in site.glob("article-*.html")),
          "assets", "content/articles.js",
          "course/workbook.html", "course/cheatsheets",
          "course/module-00/deck.html", "course/module-00-part-2/worksheet.html"]
web = course / "dist" / "ExplAIn-Website.zip"
with zipfile.ZipFile(web, "w", zipfile.ZIP_DEFLATED) as z:
    for entry in PUBLIC:
        p = site / entry
        for f in ([p] if p.is_file() else sorted(x for x in p.rglob("*") if x.is_file())):
            z.write(f, f"ExplAIn-Website/{f.relative_to(site).as_posix()}")
print(f"OK {web.relative_to(site)} ({web.stat().st_size / 1e6:.1f} MB)")

# Everything: website, all materials, certificate tools and the sources needed to rebuild.
SKIP = {"node_modules", "dist", ".claude", ".git"}
full = course / "dist" / "ExplAIn-Complete.zip"
with zipfile.ZipFile(full, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(site.rglob("*")):
        if f.is_file() and not SKIP.intersection(f.relative_to(site).parts):
            z.write(f, f"ExplAIn/{f.relative_to(site).as_posix()}")
print(f"OK {full.relative_to(site)} ({full.stat().st_size / 1e6:.1f} MB)")
