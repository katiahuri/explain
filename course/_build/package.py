"""Exports the cheat sheets to PDF (via headless Edge or Chrome) and zips all course materials.

Outputs:
  course/slides/ExplAIn-Module-NN-*-Slides.pdf     the full deck, one PDF per module
  course/cheatsheets/module-NN.pdf                 one page per module
  course/cheatsheets/ExplAIn-Course-Cheat-Sheets.pdf   all modules, one per page
  course/dist/ExplAIn-Course-Materials.zip         decks, facilitator scripts and cheat sheets
"""
import pathlib
import shutil
import subprocess
import tempfile
import time
import zipfile

course = pathlib.Path(__file__).resolve().parent.parent
sheets = course / "cheatsheets"
slides = course / "slides"

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    shutil.which("chromium") or "", shutil.which("google-chrome") or "",
]
browsers = [b for b in BROWSERS if b and pathlib.Path(b).exists()]
browser = browsers[0] if browsers else None


def render(browser: str, html: pathlib.Path, pdf: pathlib.Path) -> bool:
    # --user-data-dir is not optional: with a profile already open, the browser hands the
    # job to the running instance and exits before the PDF is on disk.
    pdf.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        subprocess.run([
            browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            f"--user-data-dir={profile}", "--virtual-time-budget=20000",
            f"--print-to-pdf={pdf}", html.resolve().as_uri(),
        ], check=True, capture_output=True, timeout=180)
    for _ in range(40):
        if pdf.exists():
            return True
        time.sleep(0.25)
    return False


def to_pdf(html: pathlib.Path, pdf: pathlib.Path, tries: int = 2) -> None:
    # Headless Edge exits 0 having written nothing now and then, and can stay in that
    # state for a whole run once it gets there. So retry, then fall through to whatever
    # other Chromium is installed rather than failing the build.
    for browser in browsers:
        for attempt in range(1, tries + 1):
            if render(browser, html, pdf):
                return
            print(f"   {pathlib.Path(browser).stem} wrote no PDF for {html.name} ({attempt}/{tries})")
    raise RuntimeError(f"no browser could render {html.name}; tried {', '.join(browsers)}")


if browsers:
    for html in sorted(sheets.glob("module-*.html")):
        to_pdf(html, html.with_suffix(".pdf"))
    to_pdf(sheets / "index.html", sheets / "ExplAIn-Course-Cheat-Sheets.pdf")
    print(f"OK cheat sheet PDFs in {sheets.relative_to(course.parent)}")
    to_pdf(course / "certificate" / "index.html", course / "certificate" / "ExplAIn-Certificate-Sample.pdf")
    print("OK certificate sample PDF")
    if slides.is_dir():
        for html in sorted(slides.glob("ExplAIn-*.html")):
            to_pdf(html, html.with_suffix(".pdf"))
        print(f"OK {len(list(slides.glob('*.pdf')))} printable decks in {slides.relative_to(course.parent)}")
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
    for f in sorted(slides.glob("*.pdf")):
        z.write(f, f"ExplAIn-Course-Materials/slides-pdf/{f.name}")
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
