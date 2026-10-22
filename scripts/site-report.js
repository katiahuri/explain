// The brief the site-analyst agent reads: how many people landed, where they
// landed, where they came from, what they did next, and which pages are
// holding the site back.
//
//   node scripts/site-report.js                 last 30 days
//   node scripts/site-report.js --days=7
//   node scripts/site-report.js --json          the same thing as JSON
//   node scripts/site-report.js --no-seo        traffic only, skip the audit
//
// Needs SITE_ORIGIN and ADMIN_TOKEN, read from the environment or .env.local.
// Without them it still runs the SEO audit and says the traffic half is blind.
const fs = require('fs');
const path = require('path');
const { audit } = require('./seo-audit');

const ROOT = path.resolve(__dirname, '..');

// .env.local is the same file the Vercel CLI writes, so nothing new to keep in sync.
function env(name) {
  if (process.env[name]) return process.env[name];
  try {
    const line = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
      .split('\n').find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim().replace(/^["']|["']$/g, '') : '';
  } catch {
    return '';
  }
}

const arg = (name, fallback) => {
  const found = process.argv.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1] : fallback;
};

const DAYS = Math.max(1, parseInt(arg('days', '30'), 10) || 30);
const ORIGIN = (arg('origin', env('SITE_ORIGIN')) || '').replace(/\/+$/, '');
const TOKEN = env('ADMIN_TOKEN');

async function traffic() {
  if (!ORIGIN) return { error: 'SITE_ORIGIN is not set, so there is no site to ask.' };
  if (!TOKEN) return { error: 'ADMIN_TOKEN is not set, so /api/stats will not answer.' };
  const url = `${ORIGIN}/api/stats?days=${DAYS}&token=${encodeURIComponent(TOKEN)}`;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) return { error: `GET /api/stats returned ${response.status}.` };
    return await response.json();
  } catch (error) {
    return { error: `Could not reach ${ORIGIN}: ${error.message}` };
  }
}

// Plain, countable observations. No judgement here that the numbers do not support.
function observations(stats, seo) {
  const out = [];
  const add = (priority, area, note) => out.push({ priority, area, note });
  if (stats.error) return out;

  const { totals, landings = [], sources = [], pages = [], devices = [], daily = [], events = [], ctas = [] } = stats;
  const seen = new Set(pages.map((p) => p.path));
  const eventCount = (name) => (events.find((e) => e.name === name) || {}).count || 0;

  if (totals.landings < 50) {
    add(1, 'traffic', `Only ${totals.landings} landings in ${stats.days} days. Every rate below is directional, not conclusive.`);
  }

  for (const page of landings.filter((l) => l.landings >= 20)) {
    if (page.bounce_rate >= 70) {
      // Only the new endpoint can tell "did nothing" from "saw one page".
      const honest = page.single_page_rate !== undefined;
      add(1, 'page', honest
        ? `${page.path}: ${page.landings} landings, ${page.bounce_rate}% leave without scrolling, pressing anything or signing up. The page is found but does not hold anyone.`
        : `${page.path}: ${page.landings} landings, ${page.bounce_rate}% never opened a second page. On a one-page pitch that counts people who read it all and signed up, so treat it as an upper bound.`);
    }
    if (page.signups === 0) {
      add(2, 'page', `${page.path}: ${page.landings} landings and no sign-ups. Check that the call to action is visible before the fold.`);
    }
    const clicks = ctas.filter((c) => c.path === page.path).reduce((n, c) => n + c.clicks, 0);
    if (clicks === 0) add(2, 'page', `${page.path}: nobody pressed a call to action here.`);
  }

  const best = [...landings].filter((l) => l.landings >= 10).sort((a, b) => b.signup_rate - a.signup_rate)[0];
  if (best && best.signup_rate > 0) {
    add(3, 'page', `${best.path} converts best at ${best.signup_rate}%. Whatever it does, the weaker landing pages should copy.`);
  }

  for (const source of sources.filter((s) => s.landings >= 10)) {
    if (source.medium === 'organic') add(3, 'seo', `${source.landings} landings from ${source.source} search. Search is working; more indexable pages compound it.`);
    if (source.medium === 'ai') add(2, 'seo', `${source.landings} landings came from an AI assistant (${source.source}). Pages that state facts plainly get quoted; keep writing them.`);
    if (source.signups === 0) add(2, 'traffic', `${source.source} sent ${source.landings} landings and nobody joined the list.`);
  }

  const heard = funnel(stats.listens);
  const started = heard[0].people;
  if (started) {
    const through = heard[5].people;
    const half = heard[3].people;
    add(2, 'podcast', `${started} pressed play on the episode; ${half} reached halfway and ${through} heard it through.`);
    if (started >= 5 && half / started < 0.3) {
      add(2, 'podcast', `Most people who start the episode leave before halfway. The opening minutes are where to look.`);
    }
  }

  const organic = sources.filter((s) => s.medium === 'organic').reduce((n, s) => n + s.landings, 0);
  if (totals.landings >= 50 && organic / Math.max(totals.landings, 1) < 0.1) {
    add(1, 'seo', `Search is ${Math.round((organic / totals.landings) * 100)}% of landings. The site depends on links people share by hand.`);
  }

  const phone = (devices.find((d) => d.device === 'phone') || {}).views || 0;
  const allViews = devices.reduce((n, d) => n + d.views, 0);
  if (allViews && phone / allViews > 0.5) {
    add(2, 'design', `${Math.round((phone / allViews) * 100)}% of views are on a phone. Judge every change at 375px first.`);
  }

  if (totals.landings >= 30 && eventCount('scroll75') / totals.landings < 0.25) {
    add(2, 'content', `Only ${eventCount('scroll75')} of ${totals.landings} landings read 75% down a page. The opening is not holding people.`);
  }

  // Published, indexable, and nobody has ever opened it.
  const unvisited = (seo.facts || []).map((f) => f.page)
    .filter((rel) => rel !== '404.html')
    .map((rel) => `/${rel.replace(/index\.html$/, '').replace(/\.html$/, '')}`.replace(/\/{2,}/g, '/'))
    .filter((url) => !seen.has(url));
  if (unvisited.length) {
    add(3, 'seo', `${unvisited.length} published page(s) had no views at all: ${unvisited.slice(0, 6).join(', ')}${unvisited.length > 6 ? ' …' : ''}`);
  }

  if (daily.length >= 8) {
    const half = Math.floor(daily.length / 2);
    const sum = (rows) => rows.reduce((n, r) => n + r.landings, 0);
    const before = sum(daily.slice(0, half));
    const after = sum(daily.slice(half));
    if (before > 0) {
      const change = Math.round(((after - before) / before) * 100);
      if (Math.abs(change) >= 20) {
        add(2, 'traffic', `Landings are ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% in the second half of the window (${before} then ${after}).`);
      }
    }
  }

  return out.sort((a, b) => a.priority - b.priority);
}

// The podcast funnel: pressed play, then each quarter they stayed for.
const STAGES = [
  ['preview', 'Played the opening'],
  ['listen', 'Unlocked the rest'],
  ['listen25', 'Heard a quarter'],
  ['listen50', 'Heard half'],
  ['listen75', 'Heard three quarters'],
  ['listen100', 'Heard it through'],
];

function funnel(listens = []) {
  return STAGES.map(([name, label]) => {
    const rows = listens.filter((r) => r.name === name);
    return {
      name,
      label,
      people: rows.reduce((n, r) => n + r.people, 0),
      count: rows.reduce((n, r) => n + r.count, 0),
    };
  });
}

const table = (rows, columns) => {
  if (!rows.length) return '_No rows._\n';
  const head = `| ${columns.map((c) => c.label).join(' | ')} |`;
  const rule = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${columns.map((c) => String(c.get(r) ?? '')).join(' | ')} |`).join('\n');
  return `${head}\n${rule}\n${body}\n`;
};

function markdown(stats, seo, notes) {
  const lines = [];
  const say = (...parts) => lines.push(...parts);

  say(`# ExplAIn site report — last ${DAYS} days`, '', `Generated ${new Date().toISOString().replace('T', ' ').slice(0, 16)} UTC`, '');

  if (stats.error) {
    say('## Traffic', '', `**No traffic data.** ${stats.error}`, '',
      'See ANALYTICS.md for what to set. The SEO audit below does not need it.', '');
  } else {
    const t = stats.totals;
    say('## The numbers', '',
      `- **${t.landings}** landings (**${t.visitors}** people, **${t.views}** page views)`,
      `- **${t.views_per_visit}** pages per visit`,
      `- **${t.signups}** sign-ups — **${t.signup_rate_per_landing}%** of landings`,
      '', '## Where people land', '',
      table(stats.landings.slice(0, 15), [
        { label: 'Page', get: (r) => r.path },
        { label: 'Landings', get: (r) => r.landings },
        { label: 'People', get: (r) => r.visitors },
        { label: 'Pages/visit', get: (r) => r.pages_per_visit },
        ...(stats.landings.some((r) => r.single_page_rate !== undefined)
          ? [{ label: 'Left cold', get: (r) => `${r.bounce_rate}%` },
             { label: 'One page', get: (r) => `${r.single_page_rate}%` }]
          : [{ label: 'One page', get: (r) => `${r.bounce_rate}%` }]),
        { label: 'Sign-ups', get: (r) => `${r.signups} (${r.signup_rate}%)` },
      ]),
      '## Where they come from', '',
      table(stats.sources.slice(0, 12), [
        { label: 'Source', get: (r) => r.source },
        { label: 'Kind', get: (r) => r.medium },
        { label: 'Landings', get: (r) => r.landings },
        { label: 'People', get: (r) => r.visitors },
        { label: 'Sign-ups', get: (r) => `${r.signups} (${r.signup_rate}%)` },
      ]),
      '## Every page, by views', '',
      table(stats.pages.slice(0, 15), [
        { label: 'Page', get: (r) => r.path },
        { label: 'Views', get: (r) => r.views },
        { label: 'People', get: (r) => r.visitors },
      ]),
      '## What they did', '',
      table(stats.events, [
        { label: 'Action', get: (r) => r.name },
        { label: 'Count', get: (r) => r.count },
      ]),
      '', '### Calls to action pressed', '',
      table(stats.ctas.slice(0, 10), [
        { label: 'On page', get: (r) => r.path },
        { label: 'Button', get: (r) => r.detail },
        { label: 'Clicks', get: (r) => r.clicks },
      ]),
      '## The podcast', '',
      table(funnel(stats.listens).filter((r, i) => i === 0 || r.count), [
        { label: 'Stage', get: (r) => r.label },
        { label: 'People', get: (r) => r.people },
        { label: 'Times', get: (r) => r.count },
      ]),
      '## By day', '',
      table(stats.daily.slice(-14), [
        { label: 'Day', get: (r) => r.day },
        { label: 'Landings', get: (r) => r.landings },
        { label: 'Views', get: (r) => r.views },
        { label: 'People', get: (r) => r.visitors },
      ]),
      '## Devices and countries', '',
      table(stats.devices, [{ label: 'Device', get: (r) => r.device }, { label: 'Views', get: (r) => r.views }]),
      '',
      table(stats.countries.slice(0, 8), [{ label: 'Country', get: (r) => r.country }, { label: 'Views', get: (r) => r.views }]),
    );
  }

  if (seo) {
    const counts = seo.findings.reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] || 0) + 1 }), {});
    say('## SEO audit', '', `${seo.pages} pages — ${counts.error || 0} errors, ${counts.warn || 0} warnings, ${counts.info || 0} notes`, '',
      table(seo.findings.filter((f) => f.level !== 'info').slice(0, 40), [
        { label: 'Level', get: (r) => r.level },
        { label: 'Page', get: (r) => r.page },
        { label: 'Finding', get: (r) => r.message },
      ]));
  }

  say('## What the numbers say', '');
  if (!notes.length) say('_Nothing stands out, or there is not enough traffic yet to say._', '');
  for (const note of notes) say(`- **[P${note.priority} ${note.area}]** ${note.note}`);
  say('');

  return lines.join('\n');
}

module.exports = { observations, markdown, funnel, STAGES };

if (require.main === module) {
  (async () => {
    const stats = await traffic();
    const seo = process.argv.includes('--no-seo') ? null : audit();
    const notes = seo ? observations(stats, seo) : [];

    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ days: DAYS, origin: ORIGIN, stats, seo, observations: notes }, null, 2));
    } else {
      console.log(markdown(stats, seo, notes));
    }
  })();
}
