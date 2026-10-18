// GET /api/stats?token=…&days=30 — the numbers behind the site, as JSON.
//
// This is what the site-analyst agent reads. Everything here is an aggregate:
// no row in the answer describes one person. Needs ADMIN_TOKEN, same as the
// sign-up export.
const { connect } = require('./_db');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const token = process.env.ADMIN_TOKEN || '';
  if (!token) return res.status(404).json({ error: 'Stats are disabled. Set ADMIN_TOKEN to enable them.' });
  if (req.query.token !== token) return res.status(401).json({ error: 'Wrong token.' });

  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const window = `${days} days`;

  try {
    const db = await connect();

    const [totals] = await db`
      SELECT COUNT(*)::int                                   AS views,
             COUNT(DISTINCT visitor_hash)::int               AS visitors,
             COUNT(*) FILTER (WHERE is_landing)::int         AS landings,
             COUNT(DISTINCT visit_id) FILTER (WHERE visit_id <> '')::int AS visits
      FROM pageviews WHERE at > NOW() - ${window}::interval
    `;

    // Where people arrive, and whether that page holds them.
    const landings = await db`
      SELECT p.path,
             COUNT(*)::int AS landings,
             COUNT(DISTINCT p.visitor_hash)::int AS visitors,
             COALESCE(ROUND(AVG(v.depth)::numeric, 2), 1) AS pages_per_visit,
             COUNT(*) FILTER (WHERE v.depth = 1)::int AS single_page_visits,
             COUNT(*) FILTER (WHERE v.depth = 1 AND NOT COALESCE(v.engaged, false))::int AS left_cold,
             COUNT(*) FILTER (WHERE v.converted)::int AS signups
      FROM pageviews p
      LEFT JOIN (
        SELECT pv.visit_id,
               COUNT(*)::int AS depth,
               EXISTS (SELECT 1 FROM events e WHERE e.visit_id = pv.visit_id AND e.name = 'signup') AS converted,
               EXISTS (SELECT 1 FROM events e WHERE e.visit_id = pv.visit_id
                       AND e.name IN ('signup', 'cta', 'scroll75')) AS engaged
        FROM pageviews pv WHERE pv.visit_id <> '' GROUP BY pv.visit_id
      ) v ON v.visit_id = p.visit_id
      WHERE p.is_landing AND p.at > NOW() - ${window}::interval
      GROUP BY p.path ORDER BY landings DESC LIMIT 40
    `;

    const pages = await db`
      SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT visitor_hash)::int AS visitors
      FROM pageviews WHERE at > NOW() - ${window}::interval
      GROUP BY path ORDER BY views DESC LIMIT 40
    `;

    const sources = await db`
      SELECT source, medium, COUNT(*)::int AS landings, COUNT(DISTINCT visitor_hash)::int AS visitors
      FROM pageviews WHERE is_landing AND at > NOW() - ${window}::interval
      GROUP BY source, medium ORDER BY landings DESC LIMIT 25
    `;

    // Which channels bring people who actually join the list.
    const sourcePerformance = await db`
      SELECT p.source, p.medium,
             COUNT(*)::int AS landings,
             COUNT(*) FILTER (WHERE v.converted)::int AS signups
      FROM pageviews p
      LEFT JOIN (
        SELECT pv.visit_id,
               EXISTS (SELECT 1 FROM events e WHERE e.visit_id = pv.visit_id AND e.name = 'signup') AS converted
        FROM pageviews pv WHERE pv.visit_id <> '' GROUP BY pv.visit_id
      ) v ON v.visit_id = p.visit_id
      WHERE p.is_landing AND p.at > NOW() - ${window}::interval
      GROUP BY p.source, p.medium ORDER BY landings DESC LIMIT 25
    `;

    const referrers = await db`
      SELECT referrer_host, COUNT(*)::int AS landings
      FROM pageviews WHERE is_landing AND referrer_host <> '' AND at > NOW() - ${window}::interval
      GROUP BY referrer_host ORDER BY landings DESC LIMIT 25
    `;

    const campaigns = await db`
      SELECT campaign, COUNT(*)::int AS landings
      FROM pageviews WHERE campaign <> '' AND at > NOW() - ${window}::interval
      GROUP BY campaign ORDER BY landings DESC LIMIT 25
    `;

    const devices = await db`
      SELECT device, COUNT(*)::int AS views FROM pageviews
      WHERE device <> '' AND at > NOW() - ${window}::interval
      GROUP BY device ORDER BY views DESC
    `;

    const countries = await db`
      SELECT country, COUNT(*)::int AS views FROM pageviews
      WHERE country <> '' AND at > NOW() - ${window}::interval
      GROUP BY country ORDER BY views DESC LIMIT 15
    `;

    const daily = await db`
      SELECT to_char(date_trunc('day', at), 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS views,
             COUNT(*) FILTER (WHERE is_landing)::int AS landings,
             COUNT(DISTINCT visitor_hash)::int AS visitors
      FROM pageviews WHERE at > NOW() - ${window}::interval
      GROUP BY 1 ORDER BY 1
    `;

    const events = await db`
      SELECT name, COUNT(*)::int AS count FROM events
      WHERE at > NOW() - ${window}::interval GROUP BY name ORDER BY count DESC
    `;

    // Which page someone was on when they pressed a call to action.
    const ctas = await db`
      SELECT path, detail, COUNT(*)::int AS clicks FROM events
      WHERE name = 'cta' AND at > NOW() - ${window}::interval
      GROUP BY path, detail ORDER BY clicks DESC LIMIT 25
    `;

    const [signups] = await db`
      SELECT COUNT(*)::int AS count FROM signups WHERE created_at > NOW() - ${window}::interval
    `;

    const rate = (part, whole) => (whole ? Number(((part / whole) * 100).toFixed(2)) : 0);

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      days,
      totals: {
        ...totals,
        signups: signups.count,
        signup_rate_per_landing: rate(signups.count, totals.landings),
        views_per_visit: totals.visits ? Number((totals.views / totals.visits).toFixed(2)) : 0,
      },
      landings: landings.map((row) => ({
        ...row,
        pages_per_visit: Number(row.pages_per_visit),
        bounce_rate: rate(row.left_cold, row.landings),
        single_page_rate: rate(row.single_page_visits, row.landings),
        signup_rate: rate(row.signups, row.landings),
      })),
      pages,
      sources: sources.map((row) => {
        const performance = sourcePerformance.find((p) => p.source === row.source && p.medium === row.medium);
        const signups = performance ? performance.signups : 0;
        return { ...row, signups, signup_rate: rate(signups, row.landings) };
      }),
      referrers,
      campaigns,
      devices,
      countries,
      daily,
      events,
      ctas,
    });
  } catch (error) {
    console.error('[stats]', error);
    return res.status(500).json({ error: 'Could not read the numbers.' });
  }
};
