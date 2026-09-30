// GET /api/health — confirms the site and its database are reachable.
const { connect } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const db = await connect();
    const [{ count }] = await db`SELECT COUNT(*)::int AS count FROM signups`;
    return res.status(200).json({ ok: true, signups: count });
  } catch (error) {
    return res.status(500).json({ ok: false, error: 'Database not reachable.' });
  }
};
