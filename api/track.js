// POST /api/track — records one pageview or one event.
//
// Cookieless and anonymous: no identifiers are stored, the referrer is reduced
// to its host, and the visitor hash includes the date so it cannot follow
// anyone past midnight. Always answers 204, so a visitor never sees a failure
// and tracking can never break a page.
const { connect, hashVisitor } = require('./_db');

const PATHS = /^\/[A-Za-z0-9/._-]{0,120}$/;
const EVENTS = new Set(['signup', 'cta', 'outbound', 'scroll75', 'pdf',
  'listen', 'listen25', 'listen50', 'listen75', 'listen100']);
const DEVICES = new Set(['phone', 'tablet', 'desktop']);

const text = (value, max) => String(value ?? '').trim().slice(0, max);

// Search engines and chat assistants send traffic worth naming separately.
const KNOWN = [
  [/(^|\.)google\./, 'google', 'organic'],
  [/(^|\.)bing\.com$/, 'bing', 'organic'],
  [/duckduckgo\.com$/, 'duckduckgo', 'organic'],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, 'linkedin', 'social'],
  [/(^|\.)(x|twitter)\.com$|^t\.co$/, 'x', 'social'],
  [/(^|\.)reddit\.com$/, 'reddit', 'social'],
  [/news\.ycombinator\.com$/, 'hackernews', 'social'],
  [/(^|\.)(chatgpt|openai)\.com$/, 'chatgpt', 'ai'],
  [/(^|\.)(claude|anthropic)\.(ai|com)$/, 'claude', 'ai'],
  [/(^|\.)perplexity\.ai$/, 'perplexity', 'ai'],
  [/(^|\.)substack\.com$/, 'substack', 'referral'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'youtube', 'social'],
];

// A visit with no UTM tags still has a source: whoever linked to it.
function attribute(fields, host) {
  const source = text(fields.source, 40).toLowerCase();
  const medium = text(fields.medium, 40).toLowerCase();
  if (source) return { source, medium: medium || 'referral' };
  if (!host) return { source: 'direct', medium: 'none' };
  const match = KNOWN.find(([re]) => re.test(host));
  return match ? { source: match[1], medium: match[2] } : { source: host, medium: 'referral' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body || {};
  const path = text(body.path, 120) || '/';
  if (!PATHS.test(path)) return res.status(204).end();

  try {
    const db = await connect();
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const visitor = hashVisitor(ip, text(req.headers['user-agent'], 200), day);
    const visitId = text(body.visit, 32);

    if (body.event) {
      const name = text(body.event, 20);
      if (!EVENTS.has(name)) return res.status(204).end();
      await db`
        INSERT INTO events (name, path, visit_id, detail)
        VALUES (${name}, ${path}, ${visitId}, ${text(body.detail, 80)})
      `;
      return res.status(204).end();
    }

    const host = text(body.referrer, 80).toLowerCase().replace(/^www\./, '');
    const { source, medium } = attribute(body, host);
    const device = DEVICES.has(body.device) ? body.device : '';

    await db`
      INSERT INTO pageviews
        (path, visit_id, is_landing, referrer_host, source, medium, campaign, device, country, visitor_hash)
      VALUES
        (${path}, ${visitId}, ${Boolean(body.landing)}, ${host}, ${source}, ${medium},
         ${text(body.campaign, 40)}, ${device}, ${text(req.headers['x-vercel-ip-country'], 2)}, ${visitor})
    `;
    return res.status(204).end();
  } catch (error) {
    // A missing database or a bad write must never reach the visitor.
    console.error('[track]', error.message);
    return res.status(204).end();
  }
};

function safeJson(raw) {
  try { return JSON.parse(raw); } catch { return {}; }
}
