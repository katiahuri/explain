// Starts the Instagram agent when a post is due.
//
// Why this exists: the agent runs on GitHub Actions, and GitHub's own
// scheduler delivers about six runs a day against the forty-eight it is asked
// for, with gaps of five to ten hours. A post banked for 08:00 went out at
// 10:20, 12:01, 12:32 — or the next morning. Vercel's cron is punctual, so it
// calls this, and this asks GitHub to run the agent now through
// workflow_dispatch, which GitHub does start straight away.
//
// It only knocks when there is something to publish: an approved feed post or
// story whose time has come. The agent still makes every decision itself (the
// cap, the kill switch, quiet hours); this never touches Instagram and never
// changes a row. Two crons a day cover 08:00 Israel time in winter (06:00 UTC)
// and summer (05:00 UTC); the one that finds nothing due does nothing.
//
// Needs, in Vercel production:
//   CRON_SECRET        Vercel sends it as a Bearer token on every cron call
//   GH_DISPATCH_TOKEN  fine-grained GitHub token, Actions: read and write,
//                      on the agent repository only
//   IG_AGENT_REPO      owner/name of the agent repository
const { neon } = require('@neondatabase/serverless');

const CONNECTION = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const TOKEN = process.env.GH_DISPATCH_TOKEN || '';
const REPO = process.env.IG_AGENT_REPO || '';
const WORKFLOW = 'agent.yml';

/** Approved posts whose slot has arrived, oldest first. */
async function duePosts() {
  const db = neon(CONNECTION);
  return db`SELECT id, format FROM ig_posts
            WHERE status = 'approved' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()
            ORDER BY scheduled_at LIMIT 5`;
}

async function dispatch(job) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'explaincourse-ig-kick',
    },
    body: JSON.stringify({ ref: 'main', inputs: { job } }),
  });
  // 204 is success; GitHub sends no body.
  if (r.status !== 204) throw new Error(`GitHub said ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }
  if (!CONNECTION || !TOKEN || !REPO) {
    return res.status(500).json({ ok: false, error: 'Not configured.' });
  }

  try {
    const due = await duePosts();
    if (!due.length) return res.status(200).json({ ok: true, dispatched: false, due: [] });

    // A feed post and a story are separate lanes in the agent, each its own job.
    const jobs = [...new Set(due.map((p) => (p.format === 'story' ? 'story' : 'post')))];
    for (const job of jobs) await dispatch(job);
    return res.status(200).json({ ok: true, dispatched: jobs, due: due.map((p) => p.id) });
  } catch (error) {
    return res.status(502).json({ ok: false, error: error.message });
  }
};
