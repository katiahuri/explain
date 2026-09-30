// Copies only the public site into public/ for deployment.
// Instructor material (decks, facilitator scripts, course sources, the
// certificate generator) is never copied, so it cannot be published.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');

const FILES = [
  'index.html', 'digital-course.html', 'articles.html', 'about.html', 'syllabus.html',
  'content/articles.js', 'course/workbook.html', 'course/module-00/worksheet.html',
];
const DIRS = ['assets', 'course/cheatsheets'];
const PATTERNS = [/^module-\d\d\.html$/, /^article-[a-z0-9-]+\.html$/];

const copy = (rel, from = path.join(ROOT, rel)) => {
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(to).size;
};

fs.rmSync(OUT, { recursive: true, force: true });

let count = 0;
let bytes = 0;

for (const rel of FILES) {
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error(`Missing public file: ${rel}`);
  bytes += copy(rel);
  count += 1;
}

for (const dir of DIRS) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(path.join(ROOT, rel)).isFile()) { bytes += copy(rel); count += 1; }
  }
}

for (const name of fs.readdirSync(ROOT)) {
  if (PATTERNS.some((re) => re.test(name))) { bytes += copy(name); count += 1; }
}

// The 404 page Vercel serves for unknown paths.
bytes += copy('404.html', path.join(ROOT, 'server', '404.html'));
count += 1;

console.log(`Built public/ - ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
