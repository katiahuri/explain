// The gate in front of the free episode.
//
//   GET  /api/unlock  — does this browser already hold a pass?
//   POST /api/unlock  — an email opens the episode and joins the waitlist.
//
// There is no password and no account: the email is the price of listening.
const { connect, hashIp } = require('./_db');
const { unlocked, passCookie } = require('./_listen');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 8; // per IP per 10 minutes

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');

  if (req.method === 'GET') return res.status(200).json({ unlocked: unlocked(req) });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const fields = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};

  // Honeypot: bots fill the hidden field. Let them think it worked, store nothing,
  // and hand out no pass.
  if (fields.company_website) return res.status(200).json({ ok: true });

  const email = String(fields.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const source = String(fields.source || 'episode-00').trim().slice(0, 40);

  try {
    const db = await connect();
    const ip = hashIp((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown');

    const [{ count }] = await db`
      SELECT COUNT(*)::int AS count FROM signup_attempts
      WHERE ip_hash = ${ip} AND at > NOW() - INTERVAL '10 minutes'
    `;
    if (count >= MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    await db`INSERT INTO signup_attempts (ip_hash) VALUES (${ip})`;

    // Someone already on the list keeps the name and interest they gave before.
    await db`
      INSERT INTO signups (email, first_name, interest, source)
      VALUES (${email}, '', 'individual', ${source})
      ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
    `;
  } catch (error) {
    // A database outage should cost us the lead, not the listener: they gave us
    // an email, so the episode opens either way.
    console.error('[unlock]', error);
  }

  res.setHeader('Set-Cookie', passCookie(req));
  return res.status(200).json({ ok: true, unlocked: true });
};
