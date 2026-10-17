// Copies only the public site into public/ for deployment, and adds the parts
// that only make sense once the site has an address: canonical URLs, social
// cards, structured data, the analytics beacon, robots.txt, sitemap.xml and
// the RSS feed.
//
// Instructor material (decks, facilitator scripts, course sources, the
// certificate generator) is never copied, so it cannot be published.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public');

// .env.local is the same file the Vercel CLI writes, so nothing new to keep in sync.
function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split('\n').find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

// The site's address. SITE_ORIGIN is set in the Vercel project and in
// .env.local, so local builds carry the same canonical URLs as production.
// Vercel's own VERCEL_PROJECT_PRODUCTION_URL is the fallback.
const ORIGIN = (env('SITE_ORIGIN')
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/+$/, '');

const FILES = [
  'index.html', 'digital-course.html', 'articles.html', 'about.html', 'syllabus.html',
  'content/articles.js', 'course/module-00/worksheet.html', 'course/module-00/deck.html',
  'course/module-01/worksheet.html',
];
// The cheat sheets are paid: they ship with The Book, not with the public site.
const DIRS = ['assets'];
const PATTERNS = [/^module-\d\d(-part-\d)?\.html$/, /^article-[a-z0-9-]+\.html$/];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const readJson = (rel) => { try { return JSON.parse(read(rel)); } catch { return null; } };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The articles and the Dispatch issues are one list.
const articles = (readJson('content/articles.json') || { articles: [] }).articles;

// cleanUrls is on in vercel.json, so /about.html is served at /about.
function urlFor(rel) {
  const clean = rel.replace(/\\/g, '/').replace(/index\.html$/, '').replace(/\.html$/, '');
  return `/${clean}`.replace(/\/{2,}/g, '/');
}

const tag = (html, re) => (html.match(re) || [])[1] || '';
const titleOf = (html) => tag(html, /<title>([\s\S]*?)<\/title>/i);
const descOf = (html) => tag(html, /<meta\s+name="description"\s+content="([^"]*)"/i);

function jsonLd(url, rel, title, description) {
  const org = {
    '@type': 'Organization',
    name: 'ExplAIn',
    url: `${ORIGIN}/`,
    logo: `${ORIGIN}/assets/logo.png`,
    sameAs: ['https://www.linkedin.com/in/katia-stainfeld-huri-6a268478'],
  };
  const course = () => ({
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: 'ExplAIn — a practical AI course for technical people',
    description,
    url: `${ORIGIN}${url}`,
    provider: org,
    teaches: 'AI systems: context, knowledge, memory, tools, orchestration, guardrails and evaluation',
    inLanguage: 'en',
  });

  if (url === '/') {
    return [
      { '@context': 'https://schema.org', ...org },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'ExplAIn',
        url: `${ORIGIN}/`,
        description,
        publisher: { '@type': 'Organization', name: 'ExplAIn' },
      },
      course(),
    ];
  }
  if (url === '/digital-course' || url === '/syllabus') return [course()];

  if (/^module-\d\d(-part-\d)?\.html$/.test(rel)) {
    return [{
      '@context': 'https://schema.org',
      '@type': 'LearningResource',
      name: title,
      description,
      url: `${ORIGIN}${url}`,
      learningResourceType: 'Course module',
      isPartOf: { '@type': 'Course', name: 'ExplAIn', url: `${ORIGIN}/digital-course` },
      provider: org,
    }];
  }

  const slug = (rel.match(/^article-([a-z0-9-]+)\.html$/) || [])[1];
  const entry = slug && articles.find((a) => a.slug === slug);
  if (entry) {
    return [{
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: entry.title,
      description: entry.dek || description,
      url: `${ORIGIN}${url}`,
      datePublished: entry.date,
      dateModified: entry.date,
      image: `${ORIGIN}/assets/og-card.png`,
      author: { '@type': 'Person', name: 'Katia Stainfeld Huri', url: `${ORIGIN}/about` },
      publisher: org,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}${url}` },
    }];
  }

  if (url === '/about') {
    return [{
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      url: `${ORIGIN}${url}`,
      mainEntity: {
        '@type': 'Person',
        name: 'Katia Stainfeld Huri',
        jobTitle: 'Founder, ExplAIn',
        description,
        sameAs: ['https://www.linkedin.com/in/katia-stainfeld-huri-6a268478'],
      },
    }];
  }
  return [];
}

// Everything a page needs that depends on knowing the site's address.
function enhance(html, rel) {
  if (/rel="canonical"/.test(html)) return html;

  const url = urlFor(rel);
  const title = titleOf(html);
  const description = descOf(html);
  const image = `${ORIGIN}/assets/og-card.png`;
  const head = [];

  if (ORIGIN) {
    head.push(`<link rel="canonical" href="${ORIGIN}${url}">`);
    head.push(`<meta property="og:url" content="${ORIGIN}${url}">`);
  }
  head.push('<meta property="og:site_name" content="ExplAIn">');
  head.push('<meta property="og:locale" content="en">');
  if (!/property="og:title"/.test(html) && title) head.push(`<meta property="og:title" content="${esc(title)}">`);
  if (!/property="og:description"/.test(html) && description) {
    head.push(`<meta property="og:description" content="${esc(description)}">`);
  }
  if (!/property="og:type"/.test(html)) head.push('<meta property="og:type" content="website">');
  if (ORIGIN) {
    head.push(`<meta property="og:image" content="${image}">`);
    head.push('<meta property="og:image:width" content="1200">');
    head.push('<meta property="og:image:height" content="630">');
    head.push('<meta property="og:image:alt" content="ExplAIn — don’t just use AI. Own it.">');
    head.push('<meta name="twitter:card" content="summary_large_image">');
    head.push(`<meta name="twitter:image" content="${image}">`);
    if (title) head.push(`<meta name="twitter:title" content="${esc(title)}">`);
    if (description) head.push(`<meta name="twitter:description" content="${esc(description)}">`);
    head.push(`<link rel="alternate" type="application/rss+xml" title="ExplAIn" href="${ORIGIN}/feed.xml">`);
  }

  const data = ORIGIN ? jsonLd(url, rel, title, description) : [];
  for (const block of data) {
    head.push(`<script type="application/ld+json">${JSON.stringify(block)}</script>`);
  }

  let out = html.replace('</head>', `  ${head.join('\n  ')}\n</head>`);
  // The beacon loads last and never blocks the page.
  out = out.replace('</body>', '  <script src="/assets/track.js" defer></script>\n</body>');
  return out;
}

const copy = (rel, from = path.join(ROOT, rel)) => {
  const to = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (rel.endsWith('.html')) {
    fs.writeFileSync(to, enhance(fs.readFileSync(from, 'utf8'), rel));
  } else {
    fs.copyFileSync(from, to);
  }
  return fs.statSync(to).size;
};

fs.rmSync(OUT, { recursive: true, force: true });

let count = 0;
let bytes = 0;
const pages = [];

// A page that asks not to be indexed stays out of the sitemap too.
const NOINDEX = /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i;
const track = (rel) => {
  if (!rel.endsWith('.html')) return;
  if (NOINDEX.test(fs.readFileSync(path.join(OUT, rel), 'utf8'))) return;
  pages.push(rel);
};

for (const rel of FILES) {
  if (!fs.existsSync(path.join(ROOT, rel))) throw new Error(`Missing public file: ${rel}`);
  bytes += copy(rel);
  track(rel);
  count += 1;
}

// Walks subdirectories too: assets/guests lives one level down,
// and a non-recursive copy left every headshot 404ing in production. The episode
// itself is not here: it lives in media/, behind /api/episode.
function copyTree(dir) {
  for (const name of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (fs.statSync(path.join(ROOT, rel)).isDirectory()) { copyTree(rel); continue; }
    bytes += copy(rel); track(rel); count += 1;
  }
}
for (const dir of DIRS) copyTree(dir);

for (const name of fs.readdirSync(ROOT)) {
  if (PATTERNS.some((re) => re.test(name))) { bytes += copy(name); track(name); count += 1; }
}

// The 404 page Vercel serves for unknown paths. It stays out of the sitemap.
bytes += copy('404.html', path.join(ROOT, 'server', '404.html'));
count += 1;

const write = (rel, body) => {
  fs.writeFileSync(path.join(OUT, rel), body);
  bytes += fs.statSync(path.join(OUT, rel)).size;
  count += 1;
};

if (ORIGIN) {
  // How important each kind of page is, first match wins.
  const WEIGHT = [
    [/^index\.html$/, '1.0'], [/^digital-course\.html$/, '0.9'], [/^syllabus\.html$/, '0.9'],
    [/^articles\.html$/, '0.8'], [/^about\.html$/, '0.7'],
    [/^article-/, '0.7'], [/^module-/, '0.6'],
  ];
  const urls = pages.map((rel) => {
    const stat = fs.statSync(path.join(ROOT, rel));
    const weight = (WEIGHT.find(([re]) => re.test(rel)) || [null, '0.5'])[1];
    return [
      '  <url>',
      `    <loc>${ORIGIN}${urlFor(rel)}</loc>`,
      `    <lastmod>${stat.mtime.toISOString().slice(0, 10)}</lastmod>`,
      `    <priority>${weight}</priority>`,
      '  </url>',
    ].join('\n');
  });
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

  write('robots.txt', ['User-agent: *', 'Allow: /', 'Disallow: /api/', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n'));

  // One feed for the articles and the Dispatch issues, newest first.
  const items = articles.map((a) => ({ ...a, url: `/article-${a.slug}` }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))).map((item) => [
    '    <item>',
    `      <title>${esc(item.title)}</title>`,
    `      <link>${ORIGIN}${item.url}</link>`,
    `      <guid isPermaLink="true">${ORIGIN}${item.url}</guid>`,
    `      <pubDate>${new Date(`${item.date}T09:00:00Z`).toUTCString()}</pubDate>`,
    `      <description>${esc(item.dek || '')}</description>`,
    '    </item>',
  ].join('\n')).join('\n');

  write('feed.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>ExplAIn</title>',
    `    <link>${ORIGIN}/</link>`,
    `    <atom:link href="${ORIGIN}/feed.xml" rel="self" type="application/rss+xml"/>`,
    '    <description>Practical writing on AI systems: mechanisms, trade-offs and decisions you can use this week.</description>',
    '    <language>en</language>',
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n'));
} else {
  console.warn('! SITE_ORIGIN is not set, so canonical URLs, sitemap.xml, robots.txt and feed.xml were skipped.');
}

console.log(`Built public/ - ${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB${ORIGIN ? ` - ${ORIGIN}` : ''}`);
