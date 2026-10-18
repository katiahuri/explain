// Renders the site's numbers as one page you can look at: dashboard.html.
//
//   node scripts/build-dashboard.js              the last 30 days, live
//   node scripts/build-dashboard.js --days=7
//   node scripts/build-dashboard.js --demo       sample data, clearly marked
//   node scripts/build-dashboard.js --from=x.json
//   node scripts/build-dashboard.js --no-list   leave the sign-up list out
//
// Same source as the written report: GET /api/stats, plus the SEO audit. The
// file is self-contained and deliberately not deployed — it is your copy of
// numbers that are nobody else's business.
const fs = require('fs');
const path = require('path');
const { audit } = require('./seo-audit');
const { observations } = require('./site-report');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dashboard.html');

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
const DEMO = process.argv.includes('--demo');
const FROM = arg('from', '');
// The list is personal data. --no-list leaves it out, for screen-sharing.
const WITH_LIST = !process.argv.includes('--no-list');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => Number(n || 0).toLocaleString('en-GB');

// ---------------------------------------------------------------- the numbers

async function load() {
  if (FROM) return JSON.parse(fs.readFileSync(path.resolve(ROOT, FROM), 'utf8'));
  if (DEMO) return demo();
  const origin = (env('SITE_ORIGIN') || '').replace(/\/+$/, '');
  const token = env('ADMIN_TOKEN');
  if (!origin) return { error: 'SITE_ORIGIN is not set, so there is no site to ask.' };
  if (!token) return { error: 'ADMIN_TOKEN is not set, so /api/stats will not answer.' };
  try {
    const response = await fetch(`${origin}/api/stats?days=${DAYS}&token=${encodeURIComponent(token)}`,
      { headers: { Accept: 'application/json' } });
    if (!response.ok) return { error: `GET /api/stats returned ${response.status}.` };
    return await response.json();
  } catch (error) {
    return { error: `Could not reach ${origin}: ${error.message}` };
  }
}

// The waitlist itself, from the same CSV export the browser downloads.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1);
}

async function loadList() {
  if (!WITH_LIST) return { skipped: true, rows: [] };
  if (DEMO || FROM) return { rows: demoList() };
  const origin = (env('SITE_ORIGIN') || '').replace(/\/+$/, '');
  const token = env('ADMIN_TOKEN');
  if (!origin || !token) return { error: 'SITE_ORIGIN or ADMIN_TOKEN is missing.', rows: [] };
  try {
    const response = await fetch(`${origin}/api/signups?token=${encodeURIComponent(token)}`);
    if (!response.ok) return { error: `GET /api/signups returned ${response.status}.`, rows: [] };
    const [header, ...body] = parseCsv(await response.text());
    const key = header.map((h) => h.trim());
    return {
      rows: body.map((cells) => Object.fromEntries(key.map((k, i) => [k, cells[i] || ''])))
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
  } catch (error) {
    return { error: `Could not reach ${origin}: ${error.message}`, rows: [] };
  }
}

function demoList() {
  const names = ['Dana', 'Yuval', 'Noa', '', 'Tomer', 'Lior', '', 'Maya'];
  const sources = ['episode-00-home', 'home', 'episode-00-home', 'module-00', 'home', 'episode-00-home', 'articles', 'home'];
  return names.map((first_name, i) => ({
    date: new Date(Date.now() - i * 36e5 * 11).toISOString(),
    email: `someone${i + 1}@example.com`,
    first_name,
    interest: i % 4 === 0 ? 'team' : 'individual',
    source: sources[i],
  }));
}

// Shaped like a real early month, so the layout is judged on realistic numbers.
function demo() {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const landings = [6, 9, 7, 11, 14, 9, 8, 12, 19, 31, 24, 17, 15, 13, 18, 22, 16, 14, 12, 15, 21, 28, 23, 19, 17, 20, 26, 24, 22, 25][i];
    return {
      day: `2026-09-${String(i + 1).padStart(2, '0')}`.replace('2026-09-31', '2026-10-01'),
      landings,
      views: Math.round(landings * 2.1),
      visitors: Math.round(landings * 0.93),
    };
  });
  const landings = [
    { path: '/', landings: 193, visitors: 178, pages_per_visit: 2.6, bounce_rate: 41, signups: 11, signup_rate: 5.7 },
    { path: '/article-confident-and-wrong', landings: 142, visitors: 139, pages_per_visit: 1.2, bounce_rate: 83, signups: 1, signup_rate: 0.7 },
    { path: '/article-retrieval-or-the-model', landings: 88, visitors: 86, pages_per_visit: 1.5, bounce_rate: 68, signups: 3, signup_rate: 3.4 },
    { path: '/digital-course', landings: 61, visitors: 57, pages_per_visit: 2.2, bounce_rate: 49, signups: 6, signup_rate: 9.8 },
    { path: '/module-04', landings: 37, visitors: 36, pages_per_visit: 1.7, bounce_rate: 62, signups: 1, signup_rate: 2.7 },
    { path: '/about', landings: 26, visitors: 25, pages_per_visit: 1.3, bounce_rate: 77, signups: 0, signup_rate: 0 },
  ];
  const sources = [
    { source: 'google', medium: 'organic', landings: 164, visitors: 158, signups: 8, signup_rate: 4.9 },
    { source: 'linkedin', medium: 'social', landings: 131, visitors: 121, signups: 2, signup_rate: 1.5 },
    { source: 'chatgpt', medium: 'ai', landings: 112, visitors: 109, signups: 9, signup_rate: 8.0 },
    { source: 'direct', medium: 'none', landings: 83, visitors: 79, signups: 2, signup_rate: 2.4 },
    { source: 'news.ycombinator.com', medium: 'referral', landings: 57, visitors: 54, signups: 1, signup_rate: 1.8 },
  ];
  return {
    demo: true,
    generated_at: new Date().toISOString(),
    days: 30,
    totals: { views: 1174, visitors: 517, landings: 547, visits: 547, signups: 22, signup_rate_per_landing: 4.02, views_per_visit: 2.15 },
    landings,
    pages: [
      { path: '/', views: 274, visitors: 241 }, { path: '/digital-course', views: 231, visitors: 192 },
      { path: '/article-confident-and-wrong', views: 169, visitors: 161 }, { path: '/syllabus', views: 148, visitors: 121 },
      { path: '/article-retrieval-or-the-model', views: 114, visitors: 102 }, { path: '/articles', views: 97, visitors: 84 },
    ],
    sources,
    referrers: [], campaigns: [],
    devices: [{ device: 'phone', views: 681 }, { device: 'desktop', views: 412 }, { device: 'tablet', views: 81 }],
    countries: [{ country: 'IL', views: 402 }, { country: 'US', views: 318 }, { country: 'GB', views: 164 }, { country: 'DE', views: 97 }],
    daily,
    events: [{ name: 'scroll75', count: 198 }, { name: 'cta', count: 94 }, { name: 'signup', count: 22 }, { name: 'outbound', count: 31 }],
    ctas: [
      { path: '/', detail: 'Join the first cohort', clicks: 51 },
      { path: '/digital-course', detail: 'Join the first cohort', clicks: 29 },
      { path: '/article-retrieval-or-the-model', detail: 'Subscribe', clicks: 14 },
    ],
  };
}

// ---------------------------------------------------------------- the marks
// Charts are hand-drawn SVG so the page stays one file with nothing to fetch.

const GRID = 'var(--grid)';

// Trend over time, one series: no legend, the title names it.
function lineChart(daily) {
  const w = 980;
  const h = 260;
  const pad = { top: 18, right: 20, bottom: 30, left: 44 };
  const max = Math.max(...daily.map((d) => d.landings), 1);
  const top = Math.ceil(max / 5) * 5;
  const x = (i) => pad.left + (i * (w - pad.left - pad.right)) / Math.max(daily.length - 1, 1);
  const y = (v) => pad.top + (1 - v / top) * (h - pad.top - pad.bottom);

  const ticks = [0, top / 2, top].map((v) => `
    <line x1="${pad.left}" y1="${y(v)}" x2="${w - pad.right}" y2="${y(v)}" stroke="${GRID}" stroke-width="1"/>
    <text x="${pad.left - 10}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join('');

  const line = daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.landings).toFixed(1)}`).join(' ');
  const area = `${line} L${x(daily.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;

  // One hit target per day, wider than the mark, carrying the tooltip.
  const hits = daily.map((d, i) => `
    <g class="hit" data-tip="${esc(d.day)} · ${d.landings} landings · ${d.visitors} people">
      <rect x="${(x(i) - (w / daily.length) / 2).toFixed(1)}" y="${pad.top}" width="${(w / daily.length).toFixed(1)}" height="${h - pad.top - pad.bottom}" fill="transparent"/>
      <line x1="${x(i).toFixed(1)}" y1="${pad.top}" x2="${x(i).toFixed(1)}" y2="${h - pad.bottom}" stroke="var(--accent)" stroke-width="1" class="crosshair"/>
      <circle cx="${x(i).toFixed(1)}" cy="${y(d.landings).toFixed(1)}" r="4.5" fill="var(--accent)" stroke="var(--surface-1)" stroke-width="2" class="dot"/>
    </g>`).join('');

  const labels = daily.map((d, i) => (i % 7 === 0 || i === daily.length - 1
    ? `<text x="${x(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" class="tick">${d.day.slice(5)}</text>` : '')).join('');

  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="Landings per day">
    ${ticks}
    <path d="${area}" fill="url(#fade)" />
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    ${labels}${hits}
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity=".22"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
  </svg>`;
}

// Magnitude, low to high: one hue, ranked, direct-labelled.
function barRows(rows, { label, value, caption }) {
  const max = Math.max(...rows.map(value), 1);
  return `<div class="bars">${rows.map((r) => `
    <div class="bar-row hit" data-tip="${esc(caption(r))}">
      <div class="bar-label" title="${esc(label(r))}">${esc(label(r))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max((value(r) / max) * 100, 1.5)}%"></div></div>
      <div class="bar-value">${num(value(r))}</div>
    </div>`).join('')}</div>`;
}

// Part-to-whole across channels: the validated categorical order, 2px gaps,
// a legend, and the table underneath carries the numbers.
const MEDIUM_ORDER = ['organic', 'ai', 'social', 'referral', 'none'];
const MEDIUM_LABEL = { organic: 'Search', ai: 'AI assistants', social: 'Social', referral: 'Referral', none: 'Direct' };

function stackedBar(sources) {
  const byMedium = new Map();
  for (const s of sources) byMedium.set(s.medium, (byMedium.get(s.medium) || 0) + s.landings);
  const parts = MEDIUM_ORDER.filter((m) => byMedium.get(m)).map((m, i) => ({
    medium: m, landings: byMedium.get(m), slot: MEDIUM_ORDER.indexOf(m) + 1,
  }));
  const total = parts.reduce((n, p) => n + p.landings, 0) || 1;

  return `<div class="stack">${parts.map((p) => `
      <div class="stack-part hit" style="flex:${p.landings};background:var(--series-${p.slot})"
           data-tip="${esc(MEDIUM_LABEL[p.medium] || p.medium)} · ${p.landings} landings · ${Math.round((p.landings / total) * 100)}%"></div>`).join('')}
    </div>
    <ul class="legend">${parts.map((p) => `
      <li><span class="swatch" style="background:var(--series-${p.slot})"></span>${esc(MEDIUM_LABEL[p.medium] || p.medium)}
        <b>${Math.round((p.landings / total) * 100)}%</b></li>`).join('')}
    </ul>`;
}

const table = (rows, columns) => (rows.length ? `<table>
  <thead><tr>${columns.map((c) => `<th scope="col"${c.right ? ' class="r"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${columns.map((c) => `<td${c.right ? ' class="r"' : ''}>${c.get(r)}</td>`).join('')}</tr>`).join('')}</tbody>
</table>` : '<p class="empty">Nothing recorded yet.</p>');

// The list, which is the only part of this page that names anybody.
function listSection(list) {
  if (list.skipped) return '';
  if (list.error) {
    return `<section><h2>The list</h2>
      <p class="lede">Could not read it: ${esc(list.error)}</p></section>`;
  }

  const rows = list.rows;
  const week = rows.filter((r) => Date.now() - Date.parse(r.date) < 7 * 864e5).length;
  const teams = rows.filter((r) => r.interest === 'team').length;
  const bySource = [...rows.reduce((m, r) => m.set(r.source || 'unknown', (m.get(r.source || 'unknown') || 0) + 1), new Map())]
    .map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);

  const when = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? esc(iso) : `${d.toISOString().slice(0, 10)} <span style="color:var(--text-muted)">${d.toISOString().slice(11, 16)}</span>`;
  };

  return `<section>
    <h2>The list</h2>
    <p class="lede">Everyone who has given you an email address, newest first. This is the
      only section that names people: the file is gitignored, never deployed, and
      <span class="mono">--no-list</span> leaves it out when you are sharing a screen.</p>

    <div class="kpis" style="margin:0 0 22px">
      <div class="kpi"><small>On the list</small><b>${num(rows.length)}</b><p class="note">all time</p></div>
      <div class="kpi"><small>Joined this week</small><b>${num(week)}</b><p class="note">last 7 days</p></div>
      <div class="kpi"><small>Signing up for a team</small><b>${num(teams)}</b><p class="note">rest are individuals</p></div>
    </div>

    ${rows.length ? `${barRows(bySource, {
      label: (r) => r.source,
      value: (r) => r.count,
      caption: (r) => `${r.source} · ${r.count} sign-up${r.count === 1 ? '' : 's'}`,
    })}
    <div style="margin-top:22px">${table(rows.slice(0, 50), [
      { label: 'When', get: (r) => when(r.date) },
      { label: 'Name', get: (r) => (r.first_name ? `<b>${esc(r.first_name)}</b>` : '<span style="color:var(--text-muted)">—</span>') },
      { label: 'Email', get: (r) => `<span class="mono">${esc(r.email)}</span>` },
      { label: 'For', get: (r) => esc(r.interest) },
      { label: 'From', get: (r) => `<span class="mono">${esc(r.source || '—')}</span>` },
    ])}</div>
    ${rows.length > 50 ? `<p class="lede" style="margin:14px 0 0">Showing the newest 50 of ${num(rows.length)}.</p>` : ''}`
      : '<p class="empty">Nobody yet.</p>'}
  </section>`;
}

// ---------------------------------------------------------------- the page

function page(stats, seo, notes, list) {
  const t = stats.totals || {};
  const findings = (seo?.findings || []).filter((f) => f.level !== 'info');
  const counts = (seo?.findings || []).reduce((acc, f) => ({ ...acc, [f.level]: (acc[f.level] || 0) + 1 }), {});
  const phone = (stats.devices || []).find((d) => d.device === 'phone')?.views || 0;
  const allViews = (stats.devices || []).reduce((n, d) => n + d.views, 0) || 1;

  const banner = stats.demo
    ? '<p class="banner">Sample data — this is what the dashboard looks like once the site is reporting. No real visitor has been counted here.</p>'
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>ExplAIn site dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root {
    color-scheme: light;
    --surface-0: #f4f6fb; --surface-1: #ffffff; --line: #e4e8f1; --grid: #eef1f7;
    --text-primary: #0b1026; --text-secondary: #4b5469; --text-muted: #7c859b;
    --accent: #7c3aed; --accent-soft: #ede9fe;
    /* Categorical slots: the validated order, stepped for a light surface. */
    --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100; --series-5: #e87ba4;
    --good: #0f8f62; --warn: #b97d00; --bad: #c2410c;
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) {
      color-scheme: dark;
      --surface-0: #080c1d; --surface-1: #121a3a; --line: #26315c; --grid: #1c2650;
      --text-primary: #f2f5ff; --text-secondary: #c3cbe2; --text-muted: #98a3c0;
      --accent: #9d64ff; --accent-soft: #1e2550;
      --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --series-5: #d55181;
      --good: #22b583; --warn: #d9a21a; --bad: #f0814f;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-0: #080c1d; --surface-1: #121a3a; --line: #26315c; --grid: #1c2650;
    --text-primary: #f2f5ff; --text-secondary: #c3cbe2; --text-muted: #98a3c0;
    --accent: #9d64ff; --accent-soft: #1e2550;
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500; --series-5: #d55181;
    --good: #22b583; --warn: #d9a21a; --bad: #f0814f;
  }

  * { box-sizing: border-box; }
  body { margin: 0; padding: 0 16px 64px; background: var(--surface-0); color: var(--text-primary);
         font-family: Poppins, ui-sans-serif, system-ui, -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
  .shell { width: min(1120px, 100%); margin: 0 auto; }
  header { padding: 40px 0 22px; }
  .eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 11px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }
  h1 { margin: 0; font-size: clamp(26px, 3.4vw, 38px); letter-spacing: -.02em; }
  .sub { margin: 8px 0 0; color: var(--text-muted); font-size: 14px; }
  .banner { margin: 18px 0 0; padding: 12px 16px; border-radius: 10px; border: 1px solid var(--line);
            background: var(--accent-soft); color: var(--text-secondary); font-size: 13px; }

  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 26px 0 8px; }
  .kpi { padding: 20px 22px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface-1); }
  .kpi small { display: block; color: var(--text-muted); font-size: 12px; font-weight: 500; letter-spacing: .06em; text-transform: uppercase; }
  .kpi b { display: block; margin-top: 8px; font-size: 40px; font-weight: 700; letter-spacing: -.03em; line-height: 1; }
  .kpi .note { margin-top: 8px; color: var(--text-secondary); font-size: 13px; }

  section { margin-top: 30px; padding: 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface-1); }
  h2 { margin: 0 0 4px; font-size: 18px; letter-spacing: -.01em; }
  .lede { margin: 0 0 20px; color: var(--text-muted); font-size: 13px; }
  .chart { width: 100%; height: auto; display: block; }
  .tick { fill: var(--text-muted); font-size: 11px; font-family: inherit; }
  .hit .crosshair, .hit .dot { opacity: 0; transition: opacity .12s; }
  .hit:hover .crosshair { opacity: .35; }
  .hit:hover .dot { opacity: 1; }

  .bars { display: grid; gap: 10px; }
  .bar-row { display: grid; grid-template-columns: minmax(120px, 230px) 1fr 54px; align-items: center; gap: 14px; }
  .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--text-secondary); }
  .bar-track { height: 16px; border-radius: 4px; background: var(--grid); }
  .bar-fill { height: 100%; border-radius: 0 4px 4px 0; background: var(--accent); }
  .bar-value { font-size: 13px; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
  .bar-row:hover .bar-fill { filter: brightness(1.08); }

  .stack { display: flex; gap: 2px; height: 30px; border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
  .stack-part { min-width: 3px; }
  .stack-part:hover { filter: brightness(1.1); }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0 0 20px; padding: 0; list-style: none; font-size: 13px; color: var(--text-secondary); }
  .legend li { display: flex; align-items: center; gap: 8px; }
  .legend b { color: var(--text-primary); }
  .swatch { width: 11px; height: 11px; border-radius: 3px; }

  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { padding: 0 10px 10px; border-bottom: 1px solid var(--line); color: var(--text-muted);
       font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; text-align: left; }
  td { padding: 11px 10px; border-bottom: 1px solid var(--grid); color: var(--text-secondary); }
  tr:last-child td { border-bottom: 0; }
  td b { color: var(--text-primary); }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: var(--text-muted); font-size: 13px; }
  .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .pill.error { color: #fff; background: var(--bad); }
  .pill.warn { color: #fff; background: var(--warn); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

  .notes { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; }
  .notes li { display: grid; grid-template-columns: 34px 1fr; gap: 14px; align-items: start;
              padding-bottom: 12px; border-bottom: 1px solid var(--grid); color: var(--text-secondary); font-size: 14px; }
  .notes li:last-child { border-bottom: 0; padding-bottom: 0; }
  .p { padding: 3px 0; border-radius: 6px; font-size: 11px; font-weight: 700; text-align: center; }
  .p1 { color: #fff; background: var(--bad); } .p2 { color: #fff; background: var(--warn); } .p3 { color: #fff; background: var(--series-1); }

  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 760px) { .two { grid-template-columns: 1fr; } .bar-row { grid-template-columns: minmax(90px, 140px) 1fr 44px; } }

  #tip { position: fixed; z-index: 9; padding: 8px 11px; border-radius: 8px; background: var(--text-primary);
         color: var(--surface-1); font-size: 12px; pointer-events: none; opacity: 0; transition: opacity .1s; white-space: nowrap; }
  footer { padding: 28px 0 0; color: var(--text-muted); font-size: 12px; }
</style>
</head>
<body>
<div id="tip" role="status"></div>
<div class="shell">
  <header>
    <p class="eyebrow">ExplAIn · site dashboard</p>
    <h1>Where people landed, and what it cost them to stay.</h1>
    <p class="sub">Last ${stats.days || DAYS} days · generated ${esc((stats.generated_at || new Date().toISOString()).replace('T', ' ').slice(0, 16))} UTC</p>
    ${banner}
  </header>

  <div class="kpis">
    <div class="kpi"><small>Landings</small><b>${num(t.landings)}</b><p class="note">${num(t.visitors)} people, ${num(t.views)} views</p></div>
    <div class="kpi"><small>Pages per visit</small><b>${t.views_per_visit ?? 0}</b><p class="note">Past 1.0 means the first page worked</p></div>
    <div class="kpi"><small>Sign-ups</small><b>${num(t.signups)}</b><p class="note">${t.signup_rate_per_landing ?? 0}% of landings</p></div>
    <div class="kpi"><small>On a phone</small><b>${Math.round((phone / allViews) * 100)}%</b><p class="note">of all page views</p></div>
  </div>

  <section>
    <h2>Landings per day</h2>
    <p class="lede">One visit counted once, on the page it started from.</p>
    ${lineChart(stats.daily || [])}
  </section>

  <section>
    <h2>Where people land</h2>
    <p class="lede">The page search, social or an assistant actually sent them to. <b>Left cold</b> is the share who did nothing at all — no scroll, no press, no sign-up. <b>One page</b> is the share who never opened a second page, which on a one-page pitch is most people even when it works.</p>
    ${barRows((stats.landings || []).slice(0, 8), {
      label: (r) => r.path,
      value: (r) => r.landings,
      caption: (r) => `${r.path} · ${r.landings} landings · ${r.bounce_rate}% did not come back for a second page · ${r.signups} sign-ups`,
    })}
    <div style="margin-top:22px">
    ${table((stats.landings || []).slice(0, 8), [
      { label: 'Page', get: (r) => `<span class="mono">${esc(r.path)}</span>` },
      { label: 'Landings', right: true, get: (r) => `<b>${num(r.landings)}</b>` },
      { label: 'Pages/visit', right: true, get: (r) => r.pages_per_visit },
      ...((stats.landings || []).some((r) => r.single_page_rate !== undefined)
        ? [{ label: 'Left cold', right: true, get: (r) => `${r.bounce_rate}%` },
           { label: 'One page', right: true, get: (r) => `${r.single_page_rate}%` }]
        : [{ label: 'One page', right: true, get: (r) => `${r.bounce_rate}%` }]),
      { label: 'Sign-ups', right: true, get: (r) => `${r.signups} <span style="color:var(--text-muted)">(${r.signup_rate}%)</span>` },
    ])}
    </div>
  </section>

  <section>
    <h2>Where they come from</h2>
    <p class="lede">Channels by share of landings, then whether that channel brings people who join the list.</p>
    ${stackedBar(stats.sources || [])}
    ${table((stats.sources || []).slice(0, 10), [
      { label: 'Source', get: (r) => `<b>${esc(r.source)}</b>` },
      { label: 'Kind', get: (r) => esc(MEDIUM_LABEL[r.medium] || r.medium) },
      { label: 'Landings', right: true, get: (r) => num(r.landings) },
      { label: 'Sign-ups', right: true, get: (r) => `${r.signups} <span style="color:var(--text-muted)">(${r.signup_rate}%)</span>` },
    ])}
  </section>

  <div class="two">
    <section style="margin-top:0">
      <h2>What they did</h2>
      <p class="lede">Actions, not page views.</p>
      ${table(stats.events || [], [
        { label: 'Action', get: (r) => esc(r.name) },
        { label: 'Count', right: true, get: (r) => num(r.count) },
      ])}
    </section>
    <section style="margin-top:0">
      <h2>Calls to action pressed</h2>
      <p class="lede">Which page someone was on when they pressed.</p>
      ${table((stats.ctas || []).slice(0, 6), [
        { label: 'On page', get: (r) => `<span class="mono">${esc(r.path)}</span>` },
        { label: 'Clicks', right: true, get: (r) => num(r.clicks) },
      ])}
    </section>
  </div>

  ${listSection(list)}

  <section>
    <h2>What the numbers say</h2>
    <p class="lede">Generated from the figures above, not from taste. P1 first.</p>
    ${notes.length ? `<ul class="notes">${notes.map((n) => `
      <li><span class="p p${n.priority}">P${n.priority}</span><span>${esc(n.note)}</span></li>`).join('')}</ul>`
      : '<p class="empty">Nothing stands out, or there is not enough traffic yet to say.</p>'}
  </section>

  <section>
    <h2>SEO audit</h2>
    <p class="lede">${seo ? `${seo.pages} pages · ${counts.error || 0} errors, ${counts.warn || 0} warnings` : 'Not run.'}</p>
    ${findings.length ? table(findings.slice(0, 20), [
      { label: 'Level', get: (r) => `<span class="pill ${r.level}">${r.level}</span>` },
      { label: 'Page', get: (r) => `<span class="mono">${esc(r.page)}</span>` },
      { label: 'Finding', get: (r) => esc(r.message) },
    ]) : '<p class="empty">Clean: no errors, no warnings.</p>'}
  </section>

  <footer>Built by <span class="mono">npm run dashboard</span> from /api/stats. Cookieless, first-party, nobody else's copy.</footer>
</div>
<script>
  // One tooltip, moved around. Hit targets are the elements carrying data-tip.
  var tip = document.getElementById('tip');
  document.addEventListener('mouseover', function (e) {
    var hit = e.target.closest('[data-tip]');
    if (!hit) return;
    tip.textContent = hit.getAttribute('data-tip');
    tip.style.opacity = '1';
  });
  document.addEventListener('mousemove', function (e) {
    if (tip.style.opacity !== '1') return;
    var box = tip.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - box.width - 8) + 'px';
    tip.style.top = Math.max(e.clientY - box.height - 12, 8) + 'px';
  });
  document.addEventListener('mouseout', function (e) {
    if (e.target.closest('[data-tip]')) tip.style.opacity = '0';
  });
</script>
</body>
</html>
`;
}

(async () => {
  const stats = await load();
  if (stats.error) {
    console.error(`No numbers to draw: ${stats.error}`);
    console.error('Try `node scripts/build-dashboard.js --demo` to see the layout with sample data.');
    process.exit(1);
  }
  const seo = audit();
  const notes = observations(stats, seo);
  const list = await loadList();
  fs.writeFileSync(OUT, page(stats, seo, notes, list));
  console.log(`Wrote dashboard.html${stats.demo ? ' (sample data)' : ''} - ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`);
})();
