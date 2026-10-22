// ExplAIn site server: serves the public site and collects waitlist sign-ups.
// No dependencies — plain Node.
//
//   node server/server.js                 http://localhost:3000
//   node server/server.js --port=8080     another port
//   ADMIN_TOKEN=secret node server/...    enables /api/signups export
//
// Sign-ups are appended to server/data/signups.json and mirrored to signups.csv.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { unlocked, passCookie } = require('../api/_listen');
const { previewStart, PREVIEW_BYTES } = require('../api/episode');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const STORE = path.join(DATA_DIR, 'signups.json');
const CSV = path.join(DATA_DIR, 'signups.csv');
const MEDIA = path.join(ROOT, 'media', 'podcast');
const portArg = process.argv.find((a) => a.startsWith('--port='));
const PORT = Number(portArg?.split('=')[1]) || Number(process.env.PORT) || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

// What the public may load. Instructor material (decks, scripts, content sources,
// the certificate generator) is deliberately absent.
const PUBLIC_FILES = new Set([
  'index.html', 'digital-course.html', 'articles.html', 'about.html', 'syllabus.html',
  'privacy.html', 'terms.html', 'content/articles.js', 'course/module-00/worksheet.html', 'course/module-00/deck.html',
  'course/module-01/worksheet.html',
]);
const PUBLIC_PREFIXES = ['assets/'];
const PUBLIC_PATTERNS = [/^module-\d\d(-part-\d)?\.html$/, /^article-[a-z0-9-]+\.html$/];

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const isPublic = (rel) => PUBLIC_FILES.has(rel) || PUBLIC_PREFIXES.some((p) => rel.startsWith(p)) || PUBLIC_PATTERNS.some((re) => re.test(rel));

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf8')); } catch { return []; }
}

function writeStore(rows) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(rows, null, 2));
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['date,email,first_name,interest,source']
    .concat(rows.map((r) => [r.date, r.email, r.first_name, r.interest, r.source].map(cell).join(',')))
    .join('\n');
  fs.writeFileSync(CSV, `${csv}\n`);
}

// Basic abuse control: at most 5 sign-up attempts per IP per 10 minutes.
const attempts = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  recent.push(now);
  attempts.set(ip, recent);
  return recent.length > 5;
}

const send = (res, status, body, type = 'application/json; charset=utf-8') =>
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(body);

function handleSignup(req, res, ip, opts = {}) {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 10_000) req.destroy();
  });
  req.on('end', () => {
    if (rateLimited(ip)) return send(res, 429, JSON.stringify({ error: 'Too many attempts. Try again later.' }));

    let fields = {};
    try {
      fields = req.headers['content-type']?.includes('application/json')
        ? JSON.parse(raw)
        : Object.fromEntries(new URLSearchParams(raw));
    } catch {
      return send(res, 400, JSON.stringify({ error: 'Could not read the form.' }));
    }

    if (fields.company_website) return send(res, 200, JSON.stringify({ ok: true })); // honeypot: pretend success
    const email = String(fields.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) {
      return send(res, 400, JSON.stringify({ error: 'Please enter a valid email address.' }));
    }

    const rows = readStore();
    const entry = {
      date: new Date().toISOString(),
      email,
      first_name: String(fields.first_name || '').trim().slice(0, 80),
      interest: ['individual', 'team'].includes(fields.interest) ? fields.interest : 'individual',
      source: String(fields.source || opts.defaultSource || '').trim().slice(0, 40),
    };
    const existing = rows.findIndex((r) => r.email === email);
    if (existing >= 0) rows[existing] = { ...rows[existing], ...entry };
    else rows.push(entry);
    writeStore(rows);

    console.log(`[signup] ${entry.interest} · ${entry.source || 'site'} · total ${rows.length}`);
    if (opts.pass) res.setHeader('Set-Cookie', passCookie(req));
    send(res, 200, JSON.stringify({ ok: true, unlocked: Boolean(opts.pass) }));
  });
}

// Audio needs byte ranges: without them a player cannot read the duration or
// seek, so a 16MB episode shows 0:00 until it has downloaded in full.
function sendFile(req, res, file, extra) {
  const size = fs.statSync(file).size;
  const headers = { ...extra, 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' };

  const asked = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (asked) {
    const start = asked[1] ? parseInt(asked[1], 10) : 0;
    const end = asked[2] ? Math.min(parseInt(asked[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  const ip = req.socket.remoteAddress || 'unknown';
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (req.method === 'POST' && pathname === '/api/signup') return handleSignup(req, res, ip);

  if (req.method === 'GET' && pathname === '/api/signups') {
    if (!ADMIN_TOKEN) return send(res, 404, JSON.stringify({ error: 'Export is disabled. Start the server with ADMIN_TOKEN set.' }));
    if (url.searchParams.get('token') !== ADMIN_TOKEN) return send(res, 401, JSON.stringify({ error: 'Wrong token.' }));
    const csv = fs.existsSync(CSV) ? fs.readFileSync(CSV) : 'date,email,first_name,interest,source\n';
    return res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="explain-signups.csv"' }).end(csv);
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, signups: readStore().length }));
  }

  // The free episode is behind an email. /api/unlock hands out the pass,
  // /api/episode is the only way to the audio: it is not under assets/.
  if (pathname === '/api/unlock') {
    if (req.method === 'GET') return send(res, 200, JSON.stringify({ unlocked: unlocked(req) }));
    if (req.method === 'POST') return handleSignup(req, res, ip, { pass: true, defaultSource: 'episode-00' });
    return send(res, 405, JSON.stringify({ error: 'Method not allowed.' }));
  }

  if (pathname === '/api/episode') {
    // The opening is free to everyone; the rest needs the pass. Mirrors api/episode.js.
    const wantsPreview = url.searchParams.get('preview') === '1';
    if (!wantsPreview && !unlocked(req)) return send(res, 403, JSON.stringify({ error: 'Enter your email to unlock this episode.' }));
    const name = url.searchParams.get('ep') || '';
    if (!/^[a-z0-9-]{1,80}$/.test(name)) return send(res, 404, JSON.stringify({ error: 'No such episode.' }));
    const audio = path.join(MEDIA, `${name}.mp3`);
    if (!fs.existsSync(audio)) return send(res, 404, JSON.stringify({ error: 'No such episode.' }));
    if (wantsPreview) {
      const from = previewStart(audio);
      const length = Math.min(PREVIEW_BYTES, fs.statSync(audio).size - from);
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': length, 'Accept-Ranges': 'none' });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(audio, { start: from, end: from + length - 1 }).pipe(res);
    }
    return sendFile(req, res, audio, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, JSON.stringify({ error: 'Method not allowed.' }));

  // Static files
  let rel = pathname.replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (!rel.includes('.')) rel += '.html'; // /about → about.html
  rel = path.posix.normalize(rel);

  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !isPublic(rel) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    const notFound = fs.readFileSync(path.join(__dirname, '404.html'));
    return res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(notFound);
  }

  const ext = path.extname(file).toLowerCase();
  return sendFile(req, res, file, {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=3600',
  });
});

server.listen(PORT, () => {
  console.log(`ExplAIn site running at http://localhost:${PORT}`);
  console.log(`Sign-ups: ${readStore().length} in server/data/signups.csv`);
  if (!ADMIN_TOKEN) console.log('Export endpoint disabled. Start with ADMIN_TOKEN=... to enable /api/signups.');
});
