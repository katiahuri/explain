// GET /api/signups?token=... — downloads the waitlist as CSV.
// Disabled unless ADMIN_TOKEN is set in the Vercel project's environment variables.
const { connect } = require('./_db');

const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return res.status(404).json({ error: 'Export is disabled. Set ADMIN_TOKEN to enable it.' });
  if (req.query.token !== token) return res.status(401).json({ error: 'Wrong token.' });

  try {
    const db = await connect();
    const rows = await db`
      SELECT created_at, email, first_name, interest, source FROM signups ORDER BY created_at
    `;
    const csv = ['date,email,first_name,interest,source']
      .concat(rows.map((r) => [r.created_at.toISOString(), r.email, r.first_name, r.interest, r.source].map(cell).join(',')))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="explain-signups.csv"');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(`${csv}\n`);
  } catch (error) {
    console.error('[signups]', error);
    return res.status(500).json({ error: 'Could not read the list.' });
  }
};
