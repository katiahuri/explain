// Renders a module as a printable deck: one A4 portrait page per slide, each slide
// in the real deck look with its speaker notes underneath. This is the paid version of
// a deck — it carries everything the .pptx carries, including the answer keys that only
// live in the notes, so the PDF alone is enough to teach or study from.
//
// Output: course/slides/…-Slides.html, which package.py prints to PDF.
const { slideBody, fromModule } = require('./web-deck');

const CLOSING = /^next\b/i;
const OWN_IT = /own it\.?$/i;

const clock = (mins) => `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;

// Speaker notes arrive as plain text: blank lines separate paragraphs and a leading
// "- " marks a bullet. Keep that shape, so an answer key still reads as a list.
function notesHtml(text, esc) {
  if (!text) return '';
  return text.trim().split(/\n{2,}/).map((para) => {
    const lines = para.split('\n');
    const lead = lines[0].startsWith('- ') ? '' : lines.shift();
    const bullets = lines.filter((l) => l.trim().startsWith('- ')).map((l) => l.replace(/^\s*-\s*/, ''));
    const rest = lines.filter((l) => !l.trim().startsWith('- ') && l.trim()).join(' ');
    return [
      lead ? `<p>${esc(lead)}</p>` : '',
      rest ? `<p>${esc(rest)}</p>` : '',
      bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '',
    ].join('');
  }).join('');
}

// The two slide kinds the printable deck draws differently from the free web deck:
// the check lands as a full accent statement, because its answers are in the notes,
// and the cheat sheet slide exists only in the paid deck.
function printBody(s, m, { esc, mapBoxes }) {
  if (s.type === 'check') {
    return `
        <h2>${esc(m.check.question)}</h2>
        <p class="sub">${esc(m.check.prompt)}</p>`;
  }
  if (s.type === 'cheatsheet') {
    const cs = m.cheatsheet;
    const panel = (label, items, kind, tag) => `
          <article class="col ${kind}">
            <h3>${esc(label)}</h3>
            <${tag}>${items.map((it) => `<li>${esc(it)}</li>`).join('')}</${tag}>
          </article>`;
    return `
        <h2>${esc(cs.big_idea)}</h2>
        <div class="two">${panel('Ask on every project', cs.ask, 'a', 'ol')}${panel('Rules of thumb', cs.rules, 'b', 'ul')}</div>`;
  }
  if (s.type === 'exercise' || s.type === 'myths') return fromModule(s, m, { esc });
  return slideBody(s, { esc, mapBoxes });
}

// Slide sequence, identical to the .pptx: the closing slide is generated, so content
// slides that duplicate it are dropped, and the cheat sheet goes before the check.
// Answer keys are appended to the notes of the slides they belong to.
function slideList(m) {
  const slides = m.slides.filter((s) => !(s.type === 'statement' && (CLOSING.test(s.title || '') || OWN_IT.test(s.title || ''))));
  if (m.cheatsheet) {
    const at = slides.findIndex((s) => s.type === 'check');
    slides.splice(at < 0 ? slides.length : at, 0, {
      type: 'cheatsheet',
      eyebrow: 'Cheat sheet · take it with you',
      notes: 'Point people to the printable cheat sheet in their workbook. Walk the questions quickly: these are what to ask on their own projects, starting tomorrow.',
    });
  }
  return slides.map((s) => {
    let notes = s.notes || '';
    if (s.type === 'exercise') notes += `\n\nWhat strong answers include:\n${m.exercise.good_answers.map((g) => `- ${g.item}: ${g.answer}`).join('\n')}`;
    if (s.type === 'check') notes += `\n\nAnswer key:\n${m.check.answers.map((a) => `- ${a}`).join('\n')}`;
    return { ...s, notes: notes.trim() };
  });
}

const LOGO = 'logo-white.png';
const EDITION = 'Slides with speaker notes';

// Dark futuristic editorial, the deck as it looks in the room. Every colour is a token,
// so the palette is in one place rather than scattered through the rules below.
const CSS = `
    @page { size: A4 portrait; margin: 0; }
    :root {
      --bg: #05080f; --card: #080d1a; --card-line: #223050;
      --panel: #121a3a; --panel-line: #26315c; --panel-alt: #1b1248; --panel-alt-line: #1b2b45;
      --accent: #46dff2; --accent-2: #a78bfa; --accent-ink: #080d1a;
      --head-bg: #1b2b45; --head-ink: #46dff2; --rule: #1d2740; --dot: #2a3a5c;
      --grad: linear-gradient(115deg, #46dff2, #3b82f6);
      --accent-bg: linear-gradient(135deg, #0a1326, #0e1b33 55%, #102a3f);
      --accent-line: #1e3350; --accent-body: #eaf7fb;
      --node-glow: 0 0 4mm 1mm #46dff2; --node-glow-2: 0 0 4mm 1mm #a78bfa;
      --ink: #f3f6ff; --ink-strong: #ffffff; --body: #a9b6cd; --panel-ink: #e6e9f3;
      --dim: #bfc7dc; --dim-2: #9aa5c4; --faint: #8a93a6; --faint-2: #5f6a82;
      --runner-ink: #6d7893; --quote: #dfe6f7; --lead: #93a0ba; --notes-ink: #b2bdd2;
      --myth-ink: #c9d0e4; --sheet-ink: #cfd7e8; --model-ink: #efeaff;
      color-scheme: dark;
    }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; color: var(--body); background: var(--bg); font-family: Inter, ui-sans-serif, system-ui, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    h1, h2, h3 { margin: 0; color: var(--ink); font-family: 'Space Grotesk', Inter, sans-serif; font-weight: 700; letter-spacing: -.02em; }

    /* ---- one page per slide ---- */
    .page { position: relative; width: 210mm; height: 296mm; padding: 13mm 14mm 11mm; display: flex; flex-direction: column; overflow: hidden; background: var(--bg); break-after: page; break-inside: avoid; }
    .page:last-child { break-after: auto; }
    .runner { display: flex; align-items: baseline; justify-content: space-between; gap: 8mm; margin-bottom: 4mm; font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; }
    .runner b { color: var(--accent); font-weight: 600; }
    .runner span { color: var(--runner-ink); letter-spacing: .1em; font-variant-numeric: tabular-nums; }

    /* ---- the slide: a 16:9 card whose every text size is relative to its own font-size ---- */
    .inner {
      position: relative; width: 182mm; height: 102.4mm; margin: 0 auto; overflow: hidden;
      font-size: 2.8mm; border-radius: 2.6mm; color: var(--body); background: var(--card); border: .3mm solid var(--card-line);
    }
    .accent .inner { color: var(--accent-body); background: var(--accent-bg); border-color: var(--accent-line); }
    .well { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; }
    .stage { width: 100%; padding: 5% 5.2%; transform-origin: center center; display: flex; flex-direction: column; justify-content: center; }
    .stage > :first-child { margin-top: 0; }
    /* Signature vocabulary: faint dot grid, thin orbital arc, one glowing node. */
    .deco { position: absolute; inset: 0; z-index: 1; overflow: hidden; }
    .deco i { position: absolute; inset: 0; opacity: .5; background-image: radial-gradient(var(--dot) 1px, transparent 1px); background-size: 5.4mm 5.4mm;
      -webkit-mask-image: radial-gradient(120% 90% at 100% 0%, #000 0%, transparent 62%); mask-image: radial-gradient(120% 90% at 100% 0%, #000 0%, transparent 62%); }
    .deco b { position: absolute; right: -16%; top: -42%; width: 68%; aspect-ratio: 1; border: .25mm solid var(--accent); border-radius: 50%; opacity: .2; }
    .deco s { position: absolute; right: 14%; top: 16%; width: 1.9mm; height: 1.9mm; border-radius: 50%; background: var(--accent); box-shadow: var(--node-glow); opacity: .75; }
    .accent .deco b { border-color: var(--accent-2); }
    .accent .deco s { background: var(--accent-2); box-shadow: var(--node-glow-2); }

    .eyebrow { display: inline-flex; align-items: center; gap: .75em; margin: 0 0 .7em; color: var(--accent); font-size: .94em; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; }
    .eyebrow::before { content: ""; width: 1.9em; height: .13em; border-radius: .13em; background: currentColor; }
    h2 { font-size: 2.875em; line-height: 1.08; }
    .t-statement h2, .t-check h2 { font-size: 3.25em; }
    .sub { margin: .5em 0 0; max-width: 88%; color: var(--body); font-size: 1.81em; line-height: 1.3; }
    .pill { align-self: flex-start; margin: 1em 0 0; padding: .45em 1.1em; border-radius: 99em; color: var(--accent-ink); background: var(--accent); font-size: 1.19em; font-weight: 600; }
    .note { margin: 1.1em 0 0; color: var(--faint); font-size: .81em; text-align: center; }

    table { width: 100%; border-collapse: collapse; margin-top: 1.6em; font-size: 1em; }
    th, td { padding: .8em 1em; text-align: left; vertical-align: top; }
    thead th { color: var(--head-ink); background: var(--head-bg); font-size: .72em; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; }
    thead th.blank { background: transparent; }
    tbody tr + tr th, tbody tr + tr td { border-top: .2mm solid var(--panel-line); }
    tbody th { color: var(--ink-strong); font-weight: 600; }
    tbody td { color: var(--panel-ink); }
    .myths tbody th { font-weight: 500; }
    .myths tbody td { color: var(--myth-ink); }

    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; margin-top: 1.6em; }
    .col { padding: 1.5em 1.6em; border: .2mm solid var(--panel-line); border-radius: 1.1em; background: var(--panel); }
    .col.a { border-color: var(--panel-alt-line); background: var(--panel-alt); }
    .col h3 { font-size: 1.19em; }
    .col p { margin: .4em 0 .9em; color: var(--dim-2); font-size: .875em; }
    .col ul, .col ol { margin: .6em 0 0; padding-left: 1.2em; }
    .col li + li { margin-top: .45em; }
    .col li { color: var(--panel-ink); font-size: .94em; }

    .bio { display: grid; grid-template-columns: 27% 1fr; gap: 6%; align-items: center; }
    .bio img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; object-position: 50% 20%; border: .2mm solid var(--card-line); border-radius: 1.1em; }
    .bio h2 { font-size: 2.5em; }
    .bio .sub { max-width: 100%; font-size: 1.31em; }
    .facts { margin: 1.1em 0 0; padding: 0; list-style: none; }
    .facts li { position: relative; padding-left: 1.4em; color: var(--dim); font-size: 1em; }
    .facts li + li { margin-top: .55em; }
    .facts li::before { content: ""; position: absolute; left: 0; top: .62em; width: .75em; height: .14em; border-radius: .14em; background: var(--accent); }

    .cards { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: .9em; margin-top: 1.6em; }
    .cards article { padding: 1.4em; border: .2mm solid var(--panel-line); border-radius: 1.1em; background: var(--panel); }
    .cards span { display: block; margin-bottom: .9em; color: var(--accent); font-size: .75em; font-weight: 600; letter-spacing: .16em; }
    .cards h3 { font-size: 1.06em; }
    .cards p { margin: .45em 0 0; color: var(--dim); font-size: .875em; }

    .steps { margin: 1.6em 0 0; padding-left: 1.4em; }
    .steps li + li { margin-top: .9em; }
    .steps li::marker { color: var(--accent); font-weight: 700; }
    .steps h3 { font-size: 1.06em; }
    .steps p { margin: .25em 0 0; color: var(--dim); font-size: .875em; }
    .steps.tight li { font-size: .94em; }
    .steps.tight li + li { margin-top: .5em; }

    .rings { margin: 0; padding: 0; list-style: none; }
    .rings li { margin-left: calc(var(--depth) * 1.1em); padding: .8em 1.1em; border: .2mm solid var(--panel-line); border-radius: .9em; background: var(--panel); color: var(--accent); font-size: .94em; font-weight: 500; }
    .rings li:last-child { border-color: var(--accent-2); background: var(--accent-2); color: #fff; }
    .rings li + li { margin-top: .5em; }
    .points { margin: 0; padding-left: 1.25em; }
    .points li + li { margin-top: .6em; }
    .points li { font-size: .94em; }

    .map { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75em; margin-top: 1.6em; }
    .box { padding: 1.1em 1.25em; border: .2mm solid var(--panel-line); border-radius: 1em; background: var(--panel); }
    .box h3 { font-size: 1em; font-weight: 600; }
    .box p { margin: .2em 0 0; color: var(--dim); font-size: .81em; }
    .box.model { display: flex; flex-direction: column; justify-content: center; border: 0; background: var(--grad); }
    .box.model h3 { color: #fff; font-size: 1.31em; }
    .box.model p { color: var(--model-ink); }

    .scroll-x { overflow: visible; }
    details { margin-top: 1.6em; }
    summary { display: none; }
    .answers { margin: 0; padding-left: 1.25em; }
    .answers li { font-size: .94em; }

    /* ---- speaker notes, under the slide ---- */
    .frame { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
    .notes { flex: 0 1 auto; min-height: 0; max-height: 116mm; margin-top: 7mm; overflow: hidden; }
    .notes h3 { margin-bottom: 2mm; color: var(--accent); font-family: Inter, sans-serif; font-size: 7.5pt; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; }
    .notes .body { max-height: 109mm; color: var(--notes-ink); font-size: 10pt; line-height: 1.55; overflow: hidden; }
    .notes p { margin: 0 0 2.4mm; }
    .notes ul { margin: 0 0 2.4mm; padding-left: 5mm; }
    .notes li { margin-bottom: 1.4mm; }
    .notes li::marker { color: var(--accent); }
    .notes .none { color: var(--faint-2); font-style: italic; }

    /* ---- cover, at a glance and close pages ---- */
    .cover { justify-content: flex-end; padding-bottom: 20mm; background: var(--card); }
    .cover .deco i { background-size: 8mm 8mm; }
    /* The file carries width/height attributes, so height must be reset or the logo squashes. */
    .cover img.logo { position: absolute; top: 15mm; left: 14mm; z-index: 2; width: 44mm; height: auto; }
    .cover .body { position: relative; z-index: 2; }
    .cover .kicker { margin: 0 0 3mm; color: var(--accent); font-size: 10pt; font-weight: 600; letter-spacing: .3em; text-transform: uppercase; }
    .cover h1 { font-size: 34pt; line-height: 1.06; }
    .cover .quote { margin: 6mm 0 0; color: var(--quote); font-size: 15pt; }
    .cover .summary { margin: 4mm 0 0; color: var(--lead); font-size: 10pt; }
    .cover .edition { position: absolute; right: 12mm; bottom: 8mm; z-index: 2; color: var(--faint-2); font-size: 8pt; letter-spacing: .16em; text-transform: uppercase; }

    .sheet { background: var(--card); }
    .sheet h1 { font-size: 22pt; line-height: 1.15; }
    .sheet .lead { margin: 2mm 0 7mm; color: var(--lead); font-size: 10pt; }
    .sheet .cols { display: grid; grid-template-columns: 1fr; gap: 8mm; min-height: 0; font-size: 9.5pt; overflow: hidden; }
    .sheet h2 { margin-bottom: 3mm; color: var(--accent); font-family: Inter, sans-serif; font-size: .84em; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; }
    .sheet section + section { margin-top: 8mm; }
    .sheet .out { margin: 0; padding: 0; list-style: none; }
    .sheet .out li { padding: 2.6mm 0; border-top: .2mm solid var(--rule); font-size: 1em; }
    .sheet .out li:first-child { border-top: 0; }
    .sheet .out b { display: block; color: var(--ink-strong); font-weight: 600; }
    .sheet .out span { color: var(--lead); }
    .sheet ul.plain { margin: 0; padding-left: 4.5mm; font-size: 1em; }
    .sheet ul.plain li { margin-bottom: 1.6mm; }
    .sheet ul.plain li::marker { color: var(--accent); }
    .sheet table { margin-top: 0; font-size: .95em; }
    .sheet th, .sheet td { padding: 2.2mm 3mm; }
    .sheet thead th { font-size: .79em; }
    .sheet p.body { margin: 0; color: var(--sheet-ink); font-size: 1em; }
    .sheet p.body b { color: var(--ink-strong); }
`;

const FIT = `
      // One constant 16:9 frame per slide and one fixed notes well per page: scale or
      // shrink whatever would overflow, so nothing is ever cut off in the PDF. Must run
      // after the webfonts load, or the measurement is taken with the fallback font.
      (function () {
        function shrink(sel, from, floor) {
          Array.prototype.forEach.call(document.querySelectorAll(sel), function (box) {
            var size = from;
            box.style.fontSize = size + 'pt';
            while (size > floor && box.scrollHeight > box.clientHeight + 1) {
              size -= 0.2;
              box.style.fontSize = size + 'pt';
            }
          });
        }
        function fit() {
          Array.prototype.forEach.call(document.querySelectorAll('.inner'), function (inner) {
            var well = inner.querySelector('.well'), stage = inner.querySelector('.stage');
            if (!well || !stage) return;
            stage.style.transform = 'none';
            var need = stage.scrollHeight, avail = well.clientHeight;
            if (avail > 0 && need > avail) stage.style.transform = 'scale(' + (avail / need) + ')';
          });
          shrink('.notes .body', 10, 6.4);
          shrink('.sheet .cols', 9.5, 6.4);
        }
        fit();
        window.addEventListener('load', fit);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
      })();
`;

function buildPrintDeck(m, next, { esc, mapBoxes, partName, partCaps, noDot }) {
  const slides = slideList(m);
  const total = slides.length + 3; // cover + at a glance + slides + close
  let page = 1; // the cover is page 1
  const runner = (label) => {
    page += 1;
    return `<div class="runner"><b>${esc(partCaps(m))} · ${esc(m.label.toUpperCase())}</b><span>${esc(label)} · ${page} / ${total}</span></div>`;
  };
  const deco = '<div class="deco" aria-hidden="true"><i></i><b></b><s></s></div>';

  let at = 0;
  const runOfShow = m.blocks.map((b) => {
    const row = [`${clock(at)}–${clock(at + b.minutes)}`, b.name, b.goal];
    at += b.minutes;
    return row;
  });

  const cover = `
  <section class="page cover">
    ${deco}
    <img class="logo" src="../../assets/${LOGO}" alt="ExplAIn" width="545" height="201">
    <div class="body">
      <p class="kicker">${esc(partCaps(m))} · ${esc(m.label.toUpperCase())}</p>
      <h1>${esc(m.title)}</h1>
      <p class="quote">“${esc(m.quote)}”</p>
      <p class="summary">${esc(m.summary)}</p>
    </div>
    <p class="edition">${EDITION} · ${total} pages</p>
  </section>`;

  const glance = `
  <section class="page sheet">
    ${runner('At a glance')}
    <h1>At a glance</h1>
    <p class="lead">${m.minutes || 120} minutes · ${m.blocks.length} blocks · ${slides.length} slides</p>
    <div class="cols">
      <div>
        <section>
          <h2>Run of show</h2>
          <table>
            <thead><tr><th>Time</th><th>Block</th><th>Goal</th></tr></thead>
            <tbody>${runOfShow.map(([t, n, g]) => `<tr><th scope="row">${esc(t)}</th><td>${esc(n)}</td><td>${esc(g)}</td></tr>`).join('')}</tbody>
          </table>
        </section>
      </div>
      <div>
        <section>
          <h2>What people leave knowing</h2>
          <ul class="out">${m.learn.map((l) => `<li><b>${esc(noDot(l.title))}</b><span>${esc(l.text)}</span></li>`).join('')}</ul>
        </section>
        <section>
          <h2>Materials</h2>
          <ul class="plain">${m.materials.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
      </div>
    </div>
  </section>`;

  const body = slides.map((s, i) => {
    const kind = s.type === 'statement' ? (s.style || '') : s.type === 'check' ? 'accent' : '';
    const notes = notesHtml(s.notes, esc);
    return `
  <section class="page ${kind}">
    ${runner(`Slide ${i + 1}`)}
    <div class="frame">
      <div class="inner t-${s.type}">
        ${deco}
        <div class="well"><div class="stage">
          ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
          ${printBody(s, m, { esc, mapBoxes })}
        </div></div>
      </div>
      <div class="notes">
        <h3>Speaker notes</h3>
        <div class="body">${notes || '<p class="none">No notes for this slide.</p>'}</div>
      </div>
    </div>
  </section>`;
  }).join('');

  // Last page: where the room goes next, plus the two things that live on no slide.
  const close = `
  <section class="page sheet">
    ${runner('Close')}
    <h1>${esc(next ? `Next · ${partName(next)}: ${next.title}` : 'Don’t just use AI. Own it.')}</h1>
    <p class="lead">${esc(next
      ? 'Close by pointing at the workbook, then name what is coming.'
      : 'Close the course: thank the group, point everyone to their workbook summary, and repeat the line.')}</p>
    <div class="cols">
      <div>
        <section>
          <h2>${next ? 'Before next session' : 'Keep going'}</h2>
          <p class="body">${esc(m.homework)}</p>
        </section>
        <section>
          <h2>Check question · answer key</h2>
          <p class="body"><b>${esc(m.check.question)}</b> ${esc(m.check.prompt)}</p>
          <ul class="plain">${m.check.answers.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        </section>
      </div>
      <div>
        <section>
          <h2>Parking lot · asked now, answered later</h2>
          <table>
            <thead><tr><th>If someone asks</th><th>Where it lands</th></tr></thead>
            <tbody>${m.parking.map((x) => `<tr><th scope="row">${esc(x.question)}</th><td>${esc(x.where)}</td></tr>`).join('')}</tbody>
          </table>
        </section>
      </div>
    </div>
  </section>`;

  const title = `ExplAIn ${partName(m)} — ${m.title} — slides with speaker notes`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${esc(title)}</title>
  <meta name="robots" content="noindex">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js from course/content/*.json — edit the JSON, not this file. -->
  <style>${CSS}
  </style>
</head>
<body>
${cover}
${glance}
${body}
${close}
  <script>${FIT}
  </script>
</body>
</html>
`;
}

module.exports = { buildPrintDeck, slideList, printBody, notesHtml, CSS, FIT };
