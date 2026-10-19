// The morning brief: rebuild dashboard.html, then email the short version.
//
//   node scripts/daily-brief.js            rebuild and send
//   node scripts/daily-brief.js --dry-run  rebuild and print the email instead
//
// Sending needs two settings in .env.local:
//   RESEND_API_KEY=re_...        from resend.com
//   BRIEF_TO=you@example.com     where to send it
//   BRIEF_FROM=brief@your-verified-domain   (optional; Resend must own the domain)
//
// Without a key it still rebuilds the dashboard and says what is missing, so a
// scheduled run never fails just because email is not set up yet.
const fs = require('fs');
const path = require('path');
const { build, env } = require('./build-dashboard');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => Number(n || 0).toLocaleString('en-GB');

// Yesterday against the day before, which is the only comparison a daily
// brief can make honestly.
function movement(daily = []) {
  if (daily.length < 2) return null;
  const [before, latest] = daily.slice(-2);
  const change = before.landings ? Math.round(((latest.landings - before.landings) / before.landings) * 100) : null;
  return { latest, before, change };
}

function emailHtml({ stats, notes, list }) {
  const t = stats.totals || {};
  const move = movement(stats.daily);
  const ink = 'font:15px/1.6 Helvetica,Arial,sans-serif; color:#3f4859;';
  const cell = 'padding:9px 12px; border-bottom:1px solid #e4e8f1; font:13px/1.5 Helvetica,Arial,sans-serif;';

  const tile = (label, value, note) => `
    <td style="padding:0 8px 0 0; width:33%;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ff; border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <div style="font:600 10px/1.4 Helvetica,Arial,sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#7c3aed;">${esc(label)}</div>
          <div style="margin-top:4px; font:700 26px/1.1 Helvetica,Arial,sans-serif; color:#0b1026;">${esc(value)}</div>
          <div style="margin-top:3px; font:12px/1.4 Helvetica,Arial,sans-serif; color:#667085;">${esc(note)}</div>
        </td></tr>
      </table>
    </td>`;

  const landings = (stats.landings || []).slice(0, 5).map((r) => `
    <tr>
      <td style="${cell}"><b style="color:#0b1026;">${esc(r.path)}</b></td>
      <td style="${cell} text-align:right;">${num(r.landings)}</td>
      <td style="${cell} text-align:right;">${r.bounce_rate}%</td>
      <td style="${cell} text-align:right;">${r.signups}</td>
    </tr>`).join('');

  const findings = notes.slice(0, 5).map((n) => `
    <li style="margin:0 0 10px; ${ink}"><b style="color:#0b1026;">P${n.priority}</b> ${esc(n.note)}</li>`).join('');

  return `<!doctype html>
<html><body style="margin:0; background:#f2f4fa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4fa; padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:100%; background:#fff; border-radius:14px; overflow:hidden;">
    <tr><td style="background:#0b1026; padding:22px 28px;">
      <div style="font:700 19px/1 Helvetica,Arial,sans-serif; color:#fff;">expl<span style="color:#9d64ff;">AI</span>n</div>
      <div style="margin-top:6px; font:600 11px/1.4 Helvetica,Arial,sans-serif; letter-spacing:.16em; text-transform:uppercase; color:#b8c2df;">Site brief · last ${stats.days} days</div>
    </td></tr>
    <tr><td style="padding:24px 28px 8px;">
      ${move ? `<p style="margin:0 0 18px; ${ink}">Yesterday: <b style="color:#0b1026;">${num(move.latest.landings)} landings</b>${
        move.change === null ? '' : `, ${move.change >= 0 ? 'up' : 'down'} ${Math.abs(move.change)}% on the day before`}.</p>` : ''}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        ${tile('Landings', num(t.landings), `${num(t.visitors)} people`)}
        ${tile('Sign-ups', num(t.signups), `${t.signup_rate_per_landing}% of landings`)}
        ${tile('On the list', num((list.rows || []).length), 'all time')}
      </tr></table>
    </td></tr>
    <tr><td style="padding:22px 28px 0;">
      <h2 style="margin:0 0 10px; font:600 15px/1.3 Helvetica,Arial,sans-serif; color:#0b1026;">Where people land</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <th style="${cell} text-align:left; color:#667085; font-weight:600;">Page</th>
          <th style="${cell} text-align:right; color:#667085; font-weight:600;">Landings</th>
          <th style="${cell} text-align:right; color:#667085; font-weight:600;">Left cold</th>
          <th style="${cell} text-align:right; color:#667085; font-weight:600;">Joined</th>
        </tr>
        ${landings}
      </table>
    </td></tr>
    <tr><td style="padding:22px 28px 26px;">
      <h2 style="margin:0 0 10px; font:600 15px/1.3 Helvetica,Arial,sans-serif; color:#0b1026;">What the numbers say</h2>
      ${findings ? `<ul style="margin:0; padding-left:18px;">${findings}</ul>`
        : `<p style="margin:0; ${ink}">Nothing stands out today.</p>`}
      <p style="margin:20px 0 0; font:12px/1.6 Helvetica,Arial,sans-serif; color:#98a3c0;">
        The full dashboard is attached, including the sign-up list. Built from your own
        site's numbers: no third party ever sees them.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

(async () => {
  const result = await build();
  const html = emailHtml(result);
  const to = env('BRIEF_TO');
  const key = env('RESEND_API_KEY');
  const from = env('BRIEF_FROM') || 'onboarding@resend.dev';

  if (DRY) {
    const out = path.join(ROOT, 'email-drafts', 'daily-brief.html');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    return console.log(`Dry run: wrote email-drafts/daily-brief.html (would send to ${to || 'nobody — BRIEF_TO is unset'}).`);
  }

  if (!key || !to) {
    return console.log('Dashboard rebuilt. Email skipped: set RESEND_API_KEY and BRIEF_TO in .env.local to turn it on.');
  }

  const attachment = fs.readFileSync(path.join(ROOT, 'dashboard.html')).toString('base64');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `ExplAIn: ${num(result.stats.totals.landings)} landings, ${num(result.stats.totals.signups)} sign-ups`,
      html,
      attachments: [{ filename: 'dashboard.html', content: attachment }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Email failed (${response.status}): ${body.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Dashboard rebuilt and the brief sent to ${to}.`);
})();
