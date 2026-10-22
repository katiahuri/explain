// GET /api/episode?ep=00-how-we-got-here — streams a podcast episode, but only
// to a browser holding a pass from /api/unlock.
//
// The audio deliberately does not live in public/: if it did, the file would
// have a plain URL and the gate would be decoration. It is read from media/,
// which vercel.json bundles into this function and the build never publishes.
const fs = require('fs');
const path = require('path');
const { unlocked } = require('./_listen');

// The opening of the episode is free to everyone: a stranger should be able to
// hear the thing before being asked for an email. The preview is served as a
// whole small file, so the player shows its real length and cannot seek past it.
const PREVIEW_BYTES = 720 * 1000; // about 90 seconds at this episode's bitrate

// The first MPEG frame of a file like this carries a Xing/Info header naming
// the length of the WHOLE episode. Serve bytes from after it and the player
// works the length out from what it is actually given, so the scrubber tells
// the truth about the preview instead of promising seventeen minutes.
function previewStart(file) {
  const head = Buffer.alloc(65536);
  const fd = fs.openSync(file, 'r');
  const read = fs.readSync(fd, head, 0, head.length, 0);
  fs.closeSync(fd);

  let at = 0;
  // An ID3v2 tag sits in front, with a syncsafe length in bytes 6-9.
  if (read > 10 && head.toString('latin1', 0, 3) === 'ID3') {
    at = 10 + ((head[6] & 0x7f) << 21 | (head[7] & 0x7f) << 14 | (head[8] & 0x7f) << 7 | (head[9] & 0x7f));
  }
  while (at < read - 4 && !(head[at] === 0xff && (head[at + 1] & 0xe0) === 0xe0)) at += 1;
  if (at >= read - 4) return 0;

  const MPEG1 = ((head[at + 1] >> 3) & 3) === 3;
  const BITRATES = MPEG1
    ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const RATES = MPEG1 ? [44100, 48000, 32000] : [22050, 24000, 16000];
  const bitrate = BITRATES[(head[at + 2] >> 4) & 0xf] * 1000;
  const rate = RATES[(head[at + 2] >> 2) & 3];
  if (!bitrate || !rate) return 0;

  const padding = (head[at + 2] >> 1) & 1;
  const frame = Math.floor((MPEG1 ? 144 : 72) * bitrate / rate) + padding;
  return at + frame;
}

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
  const wantsPreview = String((req.query && req.query.preview) || '') === '1';
  if (!wantsPreview && !unlocked(req)) {
    return res.status(403).json({ error: 'Enter your email to unlock this episode.' });
  }

  const file = fileFor((req.query && req.query.ep) || '');
  if (!file) return res.status(404).json({ error: 'No such episode.' });

  // The preview is its own little file: one response, no ranges, hard cap.
  if (wantsPreview) {
    const from = previewStart(file);
    const length = Math.min(PREVIEW_BYTES, fs.statSync(file).size - from);
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': length,
      'Accept-Ranges': 'none',
      'Cache-Control': 'public, max-age=3600',
    });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start: from, end: from + length - 1 }).pipe(res);
  }

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

module.exports.previewStart = previewStart;
module.exports.PREVIEW_BYTES = PREVIEW_BYTES;
