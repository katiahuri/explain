// POST /api/signup — adds someone to the waitlist.
const { connect, hashIp } = require('./_db');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_ATTEMPTS = 5; // per IP per 10 minutes

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const fields = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};

  // Honeypot: bots fill the hidden field, so pretend it worked and store nothing.
  if (fields.company_website) return res.status(200).json({ ok: true });

  const email = String(fields.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const entry = {
    email,
    first_name: String(fields.first_name || '').trim().slice(0, 80),
    interest: ['individual', 'team'].includes(fields.interest) ? fields.interest : 'individual',
    source: String(fields.source || '').trim().slice(0, 40),
  };

  try {
    const db = await connect();
    const ip = hashIp((req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown');

    const [{ count }] = await db`
      SELECT COUNT(*)::int AS count FROM signup_attempts
      WHERE ip_hash = ${ip} AND at > NOW() - INTERVAL '10 minutes'
    `;
    if (count >= MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    await db`INSERT INTO signup_attempts (ip_hash) VALUES (${ip})`;

    // Signing up twice updates the existing row rather than adding a duplicate.
    await db`
      INSERT INTO signups (email, first_name, interest, source)
      VALUES (${entry.email}, ${entry.first_name}, ${entry.interest}, ${entry.source})
      ON CONFLICT (email) DO UPDATE
        SET first_name = EXCLUDED.first_name,
            interest   = EXCLUDED.interest,
            source     = EXCLUDED.source,
            updated_at = NOW()
    `;

    // Old attempt rows are only needed for the rate-limit window.
    await db`DELETE FROM signup_attempts WHERE at < NOW() - INTERVAL '1 hour'`;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[signup]', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again in a moment.' });
  }
};
