// The podcast guest card on a module page.
//
// Reads scripts/podcast/cast.json — the same show bible the renderer uses, so a
// guest is described in exactly one place. Each episode names the module it
// belongs to ("00 part 2", "03", "foundations-01"); that string maps back to a
// page slug here. Episodes with no module page (Foundations) get no card.
//
// Portrait: drops in assets/guests/<slug>.jpg (or .png/.webp) when that file
// exists, and falls back to a drawn portrait until it does.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const CAST = path.join(ROOT, 'scripts', 'podcast', 'cast.json');
const PHOTOS = path.join(ROOT, 'assets', 'guests');
const AUDIO = path.join(ROOT, 'media', 'podcast');
const SCRIPTS = path.join(ROOT, 'course', 'podcast', 'dist');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const nameSlug = (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// "00 part 2" -> module-00-part-2 · "03" -> module-03 · "foundations-01" -> null
function slugOf(moduleField) {
  const m = /^(\d+)(?:\s+part\s+(\d+))?$/.exec(String(moduleField || '').trim());
  if (!m) return null;
  return `module-${m[1]}` + (Number(m[2]) > 1 ? `-part-${m[2]}` : '');
}

let cache = null;
const cast = () => (cache || (cache = JSON.parse(fs.readFileSync(CAST, 'utf8'))));
const episodeFor = (slug) => cast().episodes.find((e) => slugOf(e.module) === slug) || null;

// ---------------------------------------------------------------- the drawing
// Placeholder only, until real headshots land in assets/guests/.
// One face geometry at (80,68) r 27x31, varied per guest.
const HAIR = {
  buzz: 'M55 64q0-27 25-27t25 27q-7-13-25-14t-25 14Z',
  crop: 'M53 66q-2-31 27-31t27 31q-6-17-27-18t-27 18Z',
  swept: 'M52 65q0-30 28-30t28 30q-11-20-35-13-14 4-21 13Z',
  bob: 'M51 70q-3-33 29-33t29 33v24q-9-7-12-22-17 5-34 0-3 15-12 22Z',
  long: 'M49 72q-4-35 31-35t31 35v50q-8-10-11-34H60q-3 24-11 34Z',
  wavy: 'M49 72q-4-35 31-35t31 35v44q-5 9-9 1t-5-29H63q-1 21-5 29t-9-1Z',
  bun: 'M53 66q-2-31 27-31t27 31q-6-17-27-18t-27 18Z',
};
const BEHIND = new Set(['long', 'wavy', 'bob']);

const LOOKS = {
  'Simone Vale':  { skin: '#a9683f', hair: '#2b2320', style: 'curls', cloth: '#f1f5f9', bg: ['#7c3aed', '#3b82f6'] },
  'Jax Ellery':   { skin: '#c98c5f', hair: '#241d1a', style: 'crop',  cloth: '#e2e8f0', bg: ['#1e40af', '#7c3aed'] },
  'Zoya Kellan':  { skin: '#f0c9a6', hair: '#1f2430', style: 'bob',   cloth: '#0b1026', bg: ['#0891b2', '#4f46e5'] },
  'Milo Renwick': { skin: '#e2b088', hair: '#8a5a2b', style: 'swept', cloth: '#1e293b', bg: ['#4c1d95', '#7c3aed'] },
  'Maya Voss':    { skin: '#e8b48c', hair: '#7a2f3f', style: 'wavy',  cloth: '#0b1026', bg: ['#6d28d9', '#2563eb'] },
  'Jules Akari':  { skin: '#e0a97e', hair: '#3b3f52', style: 'bun',   cloth: '#0b1026', bg: ['#9333ea', '#db2777'] },
  'Nika Soren':   { skin: '#7d4a2a', hair: '#17120f', style: 'long',  cloth: '#e2e8f0', bg: ['#0f766e', '#0ea5e9'] },
  'Zane Imani':   { skin: '#8a5433', hair: '#17120f', style: 'buzz',  cloth: '#1e293b', bg: ['#1d4ed8', '#0ea5e9'] },
  'Cleo Maren':   { skin: '#f2c9a8', hair: '#c9a227', style: 'bob',   cloth: '#0b1026', bg: ['#7c3aed', '#ec4899'] },
  'Remy Calder':  { skin: '#d9a97e', hair: '#d9d4cf', style: 'crop',  cloth: '#1e293b', bg: ['#334155', '#2563eb'] },
  'Veda Quinn':   { skin: '#c98c5f', hair: '#2b2320', style: 'long',  cloth: '#f1f5f9', bg: ['#0f766e', '#7c3aed'] },
};
const FALLBACK = { skin: '#e2b088', hair: '#2b2320', style: 'crop', cloth: '#1e293b', bg: ['#7c3aed', '#3b82f6'] };

const curls = (fill) => [[58, 55, 11], [70, 44, 12], [84, 42, 13], [98, 52, 12], [104, 64, 10], [56, 68, 9]]
  .map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`).join('');

function drawn(name, seed) {
  const L = LOOKS[name] || FALLBACK;
  const id = `p${String(seed).replace(/[^a-z0-9]/gi, '')}`;
  const hair = HAIR[L.style] || HAIR.crop;
  const back = L.style !== 'curls' && BEHIND.has(L.style) ? `<path d="${hair}" fill="${L.hair}"/>` : '';
  const front = L.style === 'curls' ? curls(L.hair)
    : (BEHIND.has(L.style) ? '' : `<path d="${hair}" fill="${L.hair}"/>`);
  const knot = L.style === 'bun' ? `<circle cx="80" cy="30" r="11" fill="${L.hair}"/>` : '';
  return `<svg class="guest-art" viewBox="0 0 160 160" role="img" aria-label="Placeholder portrait of ${esc(name)}">
            <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="${L.bg[0]}"/><stop offset="1" stop-color="${L.bg[1]}"/></linearGradient>
              <clipPath id="${id}c"><circle cx="80" cy="80" r="80"/></clipPath></defs>
            <g clip-path="url(#${id}c)">
              <circle cx="80" cy="80" r="80" fill="url(#${id})"/>
              ${knot}${back}
              <path d="M34 160q0-34 46-40 46 6 46 40Z" fill="${L.cloth}"/>
              <path d="M70 86h20v18q-10 7-20 0Z" fill="${L.skin}"/>
              <ellipse cx="80" cy="92" rx="13" ry="5" fill="rgba(0,0,0,.14)"/>
              <ellipse cx="80" cy="68" rx="27" ry="31" fill="${L.skin}"/>
              ${front}
              <path d="M64 60q6-3 12-1M84 59q6-2 12 1" stroke="${L.hair}" stroke-width="2.4" stroke-linecap="round" fill="none"/>
              <ellipse cx="70" cy="69" rx="2.7" ry="3.3" fill="#1f2430"/><ellipse cx="90" cy="69" rx="2.7" ry="3.3" fill="#1f2430"/>
              <path d="M73 83h14" stroke="#7a4a33" stroke-width="2.4" stroke-linecap="round" fill="none"/>
            </g>
          </svg>`;
}

// A real headshot wins whenever one is present.
function portrait(name, seed) {
  const slug = nameSlug(name);
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    if (fs.existsSync(path.join(PHOTOS, `${slug}.${ext}`))) {
      return `<img class="guest-art" src="assets/guests/${slug}.${ext}" width="320" height="320"
              loading="lazy" decoding="async" alt="Portrait of ${esc(name)}">`;
    }
  }
  return drawn(name, seed);
}

// Off for now. The transcript is the episode in text, so leaving it on the page
// while the audio sits behind an email would hand over the thing being asked for.
// Flipping this back on is the whole change; nothing below it has been removed.
const TRANSCRIPTS = false;

// The transcript, read from the rendered script. Only the spoken turns: the file
// opens with a title, a one-liner and the show's disclosure, all of which the page
// already says. The text is inlined rather than linked, so it is searchable and
// readable without leaving the module.
function transcript(ep) {
  if (!TRANSCRIPTS) return '';
  // Paid episodes never reach the page, for the same reason.
  if (!ep.free) return '';
  const file = path.join(SCRIPTS, `${ep.number}-${ep.slug}.txt`);
  if (!fs.existsSync(file)) return '';
  const turns = fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map((l) => /^([A-Z][\w' ]+):\s*(.+)$/.exec(l.trim()))
    .filter(Boolean)
    .map((m) => `<p><b>${esc(m[1])}</b> ${esc(m[2])}</p>`);
  if (!turns.length) return '';
  return `<details class="transcript">
              <summary>Read the transcript</summary>
              <div class="transcript-body">${turns.join('')}</div>
            </details>`;
}

// ---------------------------------------------------------------- the gate
// Listening costs an email. assets/listen.js swaps this panel for a player once
// /api/unlock has handed out a pass; the mp3 itself is served by /api/episode
// and has no public URL, so hiding the panel is not what keeps it closed.
const LOCK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm0 2a3 3 0 0 1 3 3v3H9V7a3 3 0 0 1 3-3Z"/></svg>`;

function listenGate(slug, source) {
  const id = `listen-${slug}`;
  return `<div class="listen" data-listen="${esc(slug)}">
              <div class="listen-lock" data-listen-lock>
                <p class="listen-lock-head">${LOCK} Listen free — one email</p>
                <p class="listen-note">The episode is yours for an email address. Enter it once and it plays here and anywhere else on the site, on this browser.</p>
                <form novalidate>
                  <input type="hidden" name="source" value="${esc(source)}">
                  <div class="listen-row">
                    <label class="listen-hp" for="${id}">Email address</label>
                    <input id="${id}" type="email" name="email" placeholder="you@company.com" autocomplete="email" required>
                    <button type="submit">Unlock the episode</button>
                  </div>
                  <input class="listen-hp" type="text" name="company_website" tabindex="-1" autocomplete="off" aria-hidden="true">
                </form>
                <p class="listen-status" data-listen-status role="status"></p>
              </div>
              <audio class="listen-audio" controls preload="none" data-listen-audio hidden></audio>
            </div>`;
}

// The episode itself, once it has been rendered and copied into media/podcast/.
function player(ep) {
  // Only the free episode is playable on the site; the others are named, so the
  // page still tells visitors the episode exists, without handing it over.
  if (!ep.free) {
    return `<p class="guest-ep">Episode ${esc(ep.number)} · ${esc(ep.title)}</p>
            <p class="guest-line">Included with the course.</p>`;
  }
  const slug = `${ep.number}-${ep.slug}`;
  if (!fs.existsSync(path.join(AUDIO, `${slug}.mp3`))) return '';
  return `<p class="guest-ep">Episode ${esc(ep.number)} · ${esc(ep.title)}</p>
            ${listenGate(slug, 'episode-00-module')}`;
}

const TELEGRAM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.1 3.2 2.6 10.8c-1.1.4-1.1 2 .1 2.3l4.9 1.5 1.9 5.6c.3.9 1.5 1.1 2.1.3l2.6-2.9 5 3.7c.8.6 1.9.1 2.1-.8l3-16c.2-1-.9-1.8-1.8-1.3ZM9.6 14.6l9-6.4-7.3 7.8-.3 3.6Z"/></svg>`;

// ---------------------------------------------------------------- the section
function guestSection(slug) {
  const ep = episodeFor(slug);
  if (!ep) return '';
  const g = ep.guest;
  return `
    <section class="section white" id="episode">
      <div class="shell">
        <article class="guest">
          <figure class="guest-face">${portrait(g.name, slug)}</figure>
          <div class="guest-body">
            <p class="guest-epithet">${esc(g.epithet)}</p>
            <h2>${esc(g.name)}</h2>
            <p class="guest-line">${esc(g.editorial_line)}.</p>
            ${[player(ep), transcript(ep)].filter(Boolean).join(`\n            `)}
            <div class="guest-links">
              <button class="guest-link" type="button" disabled>Let’s chat</button>
              <button class="guest-link guest-link-icon" type="button" disabled aria-label="Message ${esc(g.name)} on Telegram">${TELEGRAM}</button>
            </div>
            <p class="guest-note">Coming soon · an AI character from the show, not a real researcher.</p>
          </div>
        </article>
      </div>
    </section>
`;
}

// Styling for the transcript, kept beside it so TRANSCRIPTS drops both at once
// and a module page carries no rules for markup it no longer has.
const TRANSCRIPT_CSS = !TRANSCRIPTS ? '' : `    .transcript { margin-top: 14px; max-width: 560px; }
    .transcript summary { display: inline-flex; align-items: center; gap: 8px; color: var(--violet); font-size: 14px; font-weight: 600; cursor: pointer; }
    .transcript summary::marker { content: ""; }
    .transcript summary::before { content: "▸"; transition: transform .2s ease; }
    .transcript[open] summary::before { transform: rotate(90deg); }
    .transcript-body { max-height: 520px; margin-top: 14px; padding: 18px 20px; overflow-y: auto; border: 1px solid var(--line); border-radius: 16px; background: var(--off-white); }
    .transcript-body p { margin: 0 0 14px; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .transcript-body p:last-child { margin-bottom: 0; }
    .transcript-body b { display: block; color: var(--navy); font-size: 12px; font-weight: 600; letter-spacing: .04em; }
`;

const TRANSCRIPT_DARK_CSS = !TRANSCRIPTS ? '' : `      .transcript summary { color: #c8b9ff; }
      .transcript-body { background: #0e1533; border-color: #26315c; }
      .transcript-body p { color: #a3adca; }
      .transcript-body b { color: #e7ebfa; }
`;

const GUEST_CSS = `
    .guest { display: grid; grid-template-columns: 200px 1fr; gap: 40px; align-items: center; padding: 36px 40px; border: 1px solid var(--line); border-radius: 28px; background: #fff; }
    .guest-face { margin: 0; }
    .guest-art { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; border-radius: 50%; box-shadow: 0 16px 38px rgba(11, 16, 38, .16); }
    .guest-epithet { color: var(--violet); font-size: 12px; font-weight: 600; letter-spacing: .17em; text-transform: uppercase; }
    .guest-body h2 { margin: 8px 0 12px; font-size: clamp(30px, 3.6vw, 40px); }
    .guest-line { color: var(--muted); font-size: 17px; line-height: 1.6; }
    .guest-ep { margin-top: 22px; color: var(--navy); font-size: 14px; font-weight: 600; }
    .listen { margin-top: 10px; }
${TRANSCRIPT_CSS}    .guest-links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
    .guest-link { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 22px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--navy); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
    .guest-link:not([disabled]):hover { border-color: var(--violet); }
    .guest-link[disabled] { opacity: .45; cursor: not-allowed; }
    .guest-link-icon { padding: 0 14px; }
    .guest-link svg { width: 19px; height: 19px; fill: currentColor; }
    .guest-note { margin-top: 12px; color: var(--muted); font-size: 12.5px; }
    @media (max-width: 760px) {
      .guest { grid-template-columns: 1fr; gap: 24px; padding: 28px 24px; text-align: center; }
      .guest-face { width: 148px; margin-inline: auto; }
      .guest-links { justify-content: center; }
    }
    @media (prefers-color-scheme: dark) {
      .guest, .guest-link { background: #121a3a; border-color: #26315c; }
      .guest-body h2 { color: #f2f5ff; }
      .guest-line, .guest-note { color: #a3adca; }
      .guest-ep { color: #f2f5ff; }
${TRANSCRIPT_DARK_CSS}      .guest-epithet { color: #c8b9ff; }
      .guest-link { color: #f2f5ff; border-color: #2f3a6e; }
    }`;

module.exports = { guestSection, GUEST_CSS, episodeFor, slugOf, nameSlug };
