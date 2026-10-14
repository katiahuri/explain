// Checks the built site for the things search engines and people both need:
// a title that fits, a description worth clicking, one h1, a canonical URL,
// alt text, enough words to be worth indexing, and a route in from somewhere.
//
//   node scripts/seo-audit.js            audit public/, building it first
//   node scripts/seo-audit.js --json     the same findings as JSON
//
// Exports audit() so scripts/site-report.js can fold the findings into the brief.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');

const TITLE_MAX = 65;      // longer titles get cut off in results
const DESC_MIN = 70;
const DESC_MAX = 160;
const THIN_WORDS = 300;

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const attr = (html, re) => (html.match(re) || [])[1] || '';

function listPages(dir, base = '') {
  const found = [];
  for (const name of fs.readdirSync(path.join(dir, base))) {
    const rel = base ? `${base}/${name}` : name;
    const full = path.join(dir, rel);
    if (fs.statSync(full).isDirectory()) found.push(...listPages(dir, rel));
    else if (rel.endsWith('.html')) found.push(rel);
  }
  return found;
}

function listFiles(dir, base = '') {
  const found = [];
  for (const name of fs.readdirSync(path.join(dir, base))) {
    const rel = base ? `${base}/${name}` : name;
    found.push(...(fs.statSync(path.join(dir, rel)).isDirectory() ? listFiles(dir, rel) : [rel]));
  }
  return found;
}

function audit({ build = true } = {}) {
  if (build || !fs.existsSync(OUT)) {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-public.js')], { cwd: ROOT, stdio: 'pipe' });
  }

  const pages = listPages(OUT).filter((rel) => rel !== '404.html');
  const built = new Set(listFiles(OUT));
  const sitemap = fs.existsSync(path.join(OUT, 'sitemap.xml')) ? fs.readFileSync(path.join(OUT, 'sitemap.xml'), 'utf8') : '';
  const findings = [];
  const seen = { title: new Map(), description: new Map() };
  const linkedFrom = new Map(pages.map((rel) => [rel, 0]));
  const facts = [];

  for (const rel of pages) {
    const html = fs.readFileSync(path.join(OUT, rel), 'utf8');
    const title = attr(html, /<title>([\s\S]*?)<\/title>/i).trim();
    const description = attr(html, /<meta\s+name="description"\s+content="([^"]*)"/i).trim();
    const canonical = attr(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
    const h1s = (html.match(/<h1[\s>]/gi) || []).length;
    const words = strip(html).split(' ').filter(Boolean).length;
    const imagesMissingAlt = (html.match(/<img(?![^>]*\balt=)[^>]*>/gi) || []).length;
    const say = (level, message) => findings.push({ page: rel, level, message });

    // A page that asks not to be indexed is judged on none of this.
    if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) {
      say('info', 'Marked noindex, so it stays out of the sitemap and out of this audit.');
      facts.push({ page: rel, title, description, words, h1s, canonical, noindex: true });
      continue;
    }

    if (!title) say('error', 'No <title>.');
    else if (title.length > TITLE_MAX) say('warn', `Title is ${title.length} characters; search results cut off near ${TITLE_MAX}.`);

    if (!description) say('error', 'No meta description, so the search result snippet is whatever Google scrapes.');
    else if (description.length < DESC_MIN) say('warn', `Meta description is only ${description.length} characters; aim for ${DESC_MIN}-${DESC_MAX}.`);
    else if (description.length > DESC_MAX) say('warn', `Meta description is ${description.length} characters; it will be truncated after about ${DESC_MAX}.`);

    if (!canonical) say('error', 'No canonical URL. Set SITE_ORIGIN so the build can add one.');
    if (h1s === 0) say('error', 'No <h1>.');
    if (h1s > 1) say('warn', `${h1s} <h1> headings; one page, one h1.`);
    if (words < THIN_WORDS) say('warn', `Only ${words} words of text; thin pages rarely rank.`);
    if (imagesMissingAlt) say('warn', `${imagesMissingAlt} image(s) with no alt text.`);
    if (!/<html[^>]+lang=/i.test(html)) say('warn', 'No lang attribute on <html>.');
    if (sitemap && canonical && !sitemap.includes(canonical)) say('warn', 'Not listed in sitemap.xml.');
    if (!/application\/ld\+json/.test(html)) say('info', 'No structured data on this page.');

    if (title) seen.title.set(title, [...(seen.title.get(title) || []), rel]);
    if (description) seen.description.set(description, [...(seen.description.get(description) || []), rel]);

    // Count inbound internal links, so orphan pages show up, and check that
    // every one of them actually resolves to something in the build.
    const dir = rel.includes('/') ? `${rel.slice(0, rel.lastIndexOf('/'))}/` : '';
    const markup = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    for (const match of markup.matchAll(/href="([^"#?]+)/g)) {
      const href = match[1];
      if (/^(https?:|mailto:|tel:|data:)/.test(href)) continue;
      const target = href.startsWith('/')
        ? href.slice(1)
        : path.posix.normalize(dir + href.replace(/^\.\//, ''));
      const candidates = [target, `${target}.html`, `${target}/index.html`, target.replace(/\/$/, '/index.html')];
      const hit = candidates.find((candidate) => built.has(candidate));
      if (!hit) say('error', `Link to ${href} goes nowhere: no such page in the build.`);
      else if (linkedFrom.has(hit) && hit !== rel) linkedFrom.set(hit, linkedFrom.get(hit) + 1);
    }

    facts.push({ page: rel, title, description, words, h1s, canonical });
  }

  for (const [title, where] of seen.title) {
    if (where.length > 1) findings.push({ page: where.join(', '), level: 'warn', message: `Duplicate title: "${title}".` });
  }
  for (const [description, where] of seen.description) {
    if (where.length > 1) findings.push({ page: where.join(', '), level: 'warn', message: 'Duplicate meta description.' });
  }
  for (const [rel, count] of linkedFrom) {
    if (count === 0 && rel !== 'index.html') {
      findings.push({ page: rel, level: 'warn', message: 'No other page links here; search engines and visitors both need a route in.' });
    }
  }
  if (!sitemap) findings.push({ page: '(site)', level: 'error', message: 'No sitemap.xml was generated. Set SITE_ORIGIN.' });

  const rank = { error: 0, warn: 1, info: 2 };
  findings.sort((a, b) => rank[a.level] - rank[b.level] || a.page.localeCompare(b.page));
  return { pages: pages.length, findings, facts, linkedFrom: Object.fromEntries(linkedFrom) };
}

if (require.main === module) {
  const result = audit();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const counts = result.findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] || 0) + 1 }), {});
    console.log(`${result.pages} pages audited - ${counts.error || 0} errors, ${counts.warn || 0} warnings, ${counts.info || 0} notes\n`);
    for (const f of result.findings) console.log(`${f.level.toUpperCase().padEnd(5)} ${f.page.padEnd(46)} ${f.message}`);
  }
}

module.exports = { audit };
