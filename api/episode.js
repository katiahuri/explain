// GET /api/episode?ep=00-how-we-got-here — streams a podcast episode, but only
// to a browser holding a pass from /api/unlock.
//
// The audio deliberately does not live in public/: if it did, the file would
// have a plain URL and the gate would be decoration. It is read from media/,
// which vercel.json bundles into this function and the build never publishes.
const fs = require('fs');
const path = require('path');
const { unlocked } = require('./_listen');

// A serverless response has to stay small, so every reply is a byte range.
// Players ask for the next one as they go, which is also what makes seeking work.
const CHUNK = 2 * 1024 * 1024;

// Vercel runs the function from the project root; locally __dirname is api/.
const DIRS = [path.join(process.cwd(), 'media', 'podcast'), path.join(__dirname, '..', 'media', 'podcast')];
const MEDIA = DIRS.find((dir) => fs.existsSync(dir)) || DIRS[0];

// Only names we found on disk are servable, so the query string can never
// reach a path of its own choosing.
function fileFor(name) {
  if (!/^[a-z0-9-]{1,80}$/.test(String(name || ''))) return null;
  const file = path.join(MEDIA, `${name}.mp3`);
  return fs.existsSync(file) ? file : null;
}

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  if (!unlocked(req)) {
    return res.status(403).json({ error: 'Enter your email to unlock this episode.' });
  }

  const file = fileFor((req.query && req.query.ep) || '');
  if (!file) return res.status(404).json({ error: 'No such episode.' });

  const size = fs.statSync(file).size;
  const asked = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  const start = asked && asked[1] ? parseInt(asked[1], 10) : 0;
  if (start >= size) {
    return res.writeHead(416, { 'Content-Range': `bytes */${size}` }).end();
  }
  const wanted = asked && asked[2] ? Math.min(parseInt(asked[2], 10), size - 1) : size - 1;
  const end = Math.min(wanted, start + CHUNK - 1);

  res.writeHead(206, {
    'Content-Type': 'audio/mpeg',
    'Content-Range': `bytes ${start}-${end}/${size}`,
    'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
  });
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(file, { start, end }).pipe(res);
};
