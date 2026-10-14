// Renders a module's slides as a self-contained HTML deck, for modules marked "web_deck": true.
// This is the public, free version of a deck: the slides an attendee sees in the room and nothing
// more. Speaker notes and the facilitator script stay out of it on purpose.
const MAP_NOTE = 'Every later module zooms into one box.';

const num = (n) => String(n).padStart(2, '0');

function slideBody(s, { esc, mapBoxes }) {
  switch (s.type) {
    case 'statement':
      return `
        <h2>${esc(s.title)}</h2>
        ${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ''}
        ${s.pill ? `<p class="pill">${esc(s.pill)}</p>` : ''}`;

    case 'table': {
      const head = s.columns.map((c) => `<th${c ? '' : ' class="blank"'}>${esc(c)}</th>`).join('');
      const body = s.rows.map((r) => `<tr>${r.map((c, i) => `<${i === 0 ? 'th scope="row"' : 'td'}>${esc(c)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('');
      return `
        <h2>${esc(s.title)}</h2>
        <div class="scroll-x"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    case 'compare': {
      const col = (x, kind) => `
        <article class="col ${kind}">
          <h3>${esc(x.title)}</h3>
          <p>${esc(x.sub)}</p>
          <ul>${x.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </article>`;
      return `
        <h2>${esc(s.title)}</h2>
        <div class="two">${col(s.left, 'a')}${col(s.right, 'b')}</div>`;
    }

    case 'cards':
      return `
        <h2>${esc(s.title)}</h2>
        <div class="cards">${s.cards.map((c, i) => `
          <article><span>${num(i + 1)}</span><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></article>`).join('')}</div>`;

    case 'steps':
      return `
        <h2>${esc(s.title)}</h2>
        <ol class="steps">${s.steps.map((c) => `
          <li><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p></li>`).join('')}</ol>`;

    case 'rings':
      return `
        <h2>${esc(s.title)}</h2>
        <div class="two">
          <ul class="rings">${s.rings.map((r, i) => `<li style="--depth:${i}">${esc(r)}</li>`).join('')}</ul>
          <ul class="points">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
        </div>`;

    case 'map':
      return `
        <h2>${esc(s.title)}</h2>
        <div class="map">${mapBoxes.map(([t, h]) => `
          <div class="box${t === 'Model' ? ' model' : ''}"><h3>${esc(t)}</h3><p>${esc(h)}</p></div>`).join('')}</div>
        <p class="note">${esc(MAP_NOTE)}</p>`;

    default:
      return '';
  }
}

// Slides whose content lives elsewhere in the JSON, not on the slide object.
function fromModule(s, m, { esc }) {
  if (s.type === 'exercise') {
    const ex = m.exercise;
    return `
      <h2>${esc(ex.title)}</h2>
      <p class="sub">${esc(ex.prompt)}</p>
      <div class="two">
        <ul class="points">${ex.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        <ol class="steps tight">${ex.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      </div>`;
  }
  if (s.type === 'myths') {
    return `
      <h2>${esc(s.title || 'Five myths to leave at the door')}</h2>
      <div class="scroll-x"><table class="myths">
        <thead><tr><th>Myth</th><th>What is actually true</th></tr></thead>
        <tbody>${m.myths.map((x) => `<tr><th scope="row">${esc(x.myth)}</th><td>${esc(x.truth)}</td></tr>`).join('')}</tbody>
      </table></div>`;
  }
  if (s.type === 'check') {
    const ch = m.check;
    return `
      <h2>${esc(ch.question)}</h2>
      <p class="sub">${esc(ch.prompt)}</p>
      <details><summary>Show the answer</summary>
        <ul class="answers">${ch.answers.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      </details>`;
  }
  return '';
}

function buildWebDeck(m, { esc, mapBoxes, partName, partSlug, clip }) {
  const slides = m.slides.map((s, i) => {
    const kind = s.type === 'statement' ? (s.style || 'light') : 'light';
    const body = ['exercise', 'myths', 'check'].includes(s.type)
      ? fromModule(s, m, { esc })
      : slideBody(s, { esc, mapBoxes });
    return `
    <section class="slide ${kind} t-${s.type}" id="s${i + 1}" aria-label="Slide ${i + 1} of ${m.slides.length}">
      <div class="inner">
        ${s.eyebrow ? `<p class="eyebrow">${esc(s.eyebrow)}</p>` : ''}
        ${body}
      </div>
    </section>`;
  }).join('');

  const title = `${m.title} — ExplAIn ${partName(m)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="robots" content="noindex">
  <meta name="description" content="${esc(clip(`The free ExplAIn ${partName(m)} deck: ${m.summary}`))}">
  <meta name="theme-color" content="#0B1026">
  <link rel="icon" type="image/png" href="../../assets/icon.png">
  <link rel="apple-touch-icon" href="../../assets/icon.png">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(clip(m.summary))}">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js from course/content/${partSlug(m)}.json — edit the JSON, not this file. -->
  <style>
    :root {
      --navy: #0b1026; --navy-2: #121a3a; --edge: #2a3566; --violet: #7c3aed; --violet-l: #a78bfa;
      --violet-d: #4c1d95; --blue: #3b82f6; --lav: #ede9fe; --lav-line: #ddd6fe;
      --off-white: #f8fafc; --body: #4a5568; --line: #e4e8f1;
      --grad: linear-gradient(115deg, #7c3aed, #3b82f6);
      color-scheme: dark;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--body); background: var(--navy); font-family: Poppins, ui-sans-serif, system-ui, sans-serif; line-height: 1.55; -webkit-font-smoothing: antialiased; }
    h1, h2, h3 { margin: 0; color: #fff; font-weight: 700; letter-spacing: -.03em; }
    :focus-visible { outline: 3px solid #9d64ff; outline-offset: 3px; }

    /* ---- top bar ---- */
    .bar { position: fixed; inset: 0 0 auto; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; background: rgba(9,13,33,.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid rgba(255,255,255,.08); }
    .bar a.logo img { display: block; height: 30px; width: auto; }
    .bar .meta { color: #b8c2df; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; }
    .bar .meta b { color: #fff; font-weight: 600; }
    .free { padding: 4px 11px; border-radius: 999px; color: #fff; background: var(--grad); font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; }
    .progress { position: fixed; top: 0; left: 0; z-index: 21; height: 3px; background: var(--grad); transition: width .25s ease; }

    /* ---- slides ---- */
    main { padding: 70px 0 96px; }
    .slide { display: none; }
    .slide.on { display: block; }
    .inner { width: min(1000px, calc(100% - 44px)); margin: 24px auto; padding: 52px 56px; border-radius: 26px; color: #c9d0e4; background: linear-gradient(150deg, #070b1d, #0b1026 55%, #111a44); border: 1px solid var(--edge); box-shadow: 0 24px 60px rgba(4,8,24,.45); }
    .slide.accent .inner { color: #efeaff; background: linear-gradient(125deg, var(--violet-d), var(--violet) 60%, var(--blue)); border-color: transparent; }
    h2, h3 { color: #fff; }

    .eyebrow { display: inline-flex; align-items: center; gap: 12px; margin: 0 0 20px; color: var(--violet-l); font-size: 12px; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; }
    .eyebrow::before { content: ""; width: 30px; height: 2px; border-radius: 2px; background: currentColor; }
    .slide.accent .eyebrow { color: var(--lav-line); }

    h2 { font-size: clamp(27px, 3.6vw, 42px); line-height: 1.12; }
    .t-statement h2 { font-size: clamp(30px, 4.4vw, 50px); }
    .sub { margin: 18px 0 0; font-size: clamp(16px, 1.8vw, 20px); }
    .pill { display: inline-block; margin: 26px 0 0; padding: 9px 18px; border-radius: 999px; color: var(--violet-d); background: var(--lav); font-size: 14px; font-weight: 600; }
    .slide.accent .pill { color: #fff; background: rgba(255,255,255,.14); }
    .note { margin: 18px 0 0; color: #8a93a6; font-size: 13px; text-align: center; }

    .scroll-x { margin-top: 26px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: clamp(14px, 1.5vw, 16px); }
    th, td { padding: 13px 16px; text-align: left; vertical-align: top; }
    thead th { color: var(--lav-line); background: var(--violet-d); font-size: 11.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; white-space: nowrap; }
    thead th:first-child { border-radius: 10px 0 0 10px; }
    thead th:last-child { border-radius: 0 10px 10px 0; }
    thead th.blank { background: transparent; }
    tbody tr + tr th, tbody tr + tr td { border-top: 1px solid #26315c; }
    tbody th { color: #fff; font-weight: 600; white-space: nowrap; }
    tbody td { color: #e6e9f3; }
    .myths tbody th { color: #fff; font-weight: 500; white-space: normal; }
    .myths tbody td { color: #c9d0e4; }

    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 26px; }
    .col { padding: 24px 26px; border: 1px solid #26315c; border-radius: 18px; background: #121a3a; }
    .col.a { border-color: var(--violet-d); background: #1b1248; }
    .col h3 { font-size: 19px; }
    .col p { margin: 6px 0 14px; color: #9aa5c4; font-size: 14px; }
    .col ul { margin: 0; padding-left: 18px; }
    .col li + li { margin-top: 7px; }
    .col li { font-size: 15px; }

    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-top: 26px; }
    .cards article { padding: 22px; border: 1px solid #26315c; border-radius: 18px; background: #121a3a; }
    .cards span { display: block; margin-bottom: 14px; color: var(--violet-l); font-size: 12px; font-weight: 600; letter-spacing: .16em; }
    .cards h3 { font-size: 17px; }
    .cards p { margin: 7px 0 0; color: #bfc7dc; font-size: 14px; }

    .steps { margin: 26px 0 0; padding-left: 22px; }
    .steps li + li { margin-top: 14px; }
    .steps h3 { font-size: 17px; }
    .steps p { margin: 4px 0 0; color: #bfc7dc; font-size: 14px; }
    .steps.tight li { font-size: 15px; }
    .steps.tight li + li { margin-top: 8px; }

    .rings { margin: 0; padding: 0; list-style: none; }
    .rings li { margin-left: calc(var(--depth) * 18px); padding: 13px 18px; border: 1px solid #26315c; border-radius: 14px; background: #121a3a; color: var(--lav-line); font-weight: 500; font-size: 15px; }
    .rings li:last-child { border-color: var(--violet); background: var(--violet); color: #fff; }
    .rings li + li { margin-top: 8px; }
    .points { margin: 0; padding-left: 20px; }
    .points li + li { margin-top: 10px; }
    .points li { font-size: 15px; }

    .map { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 26px; }
    .box { padding: 18px 20px; border: 1px solid #26315c; border-radius: 16px; background: #121a3a; }
    .box h3 { font-size: 16px; font-weight: 600; }
    .box p { margin: 3px 0 0; color: #bfc7dc; font-size: 13px; }
    .box.model { display: flex; flex-direction: column; justify-content: center; border: 0; background: var(--grad); box-shadow: 0 14px 32px rgba(99,82,246,.3); }
    .box.model h3 { color: #fff; font-size: 21px; }
    .box.model p { color: #efeaff; }

    details { margin-top: 26px; padding: 20px 24px; border: 1px solid #26315c; border-radius: 18px; background: rgba(255,255,255,.04); }
    summary { color: var(--violet-l); font-weight: 600; font-size: 15px; cursor: pointer; }
    .answers { margin: 16px 0 0; padding-left: 20px; }
    .answers li + li { margin-top: 9px; }
    .answers li { font-size: 15px; }

    /* ---- bottom nav ---- */
    .nav { position: fixed; inset: auto 0 0; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px 20px; background: rgba(9,13,33,.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,.08); }
    .nav button { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 20px; border: 1px solid rgba(255,255,255,.22); border-radius: 999px; color: #fff; background: rgba(255,255,255,.06); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
    .nav button:hover:not(:disabled) { background: rgba(255,255,255,.14); }
    .nav button:disabled { opacity: .35; cursor: default; }
    .nav .count { min-width: 74px; color: #b8c2df; font-size: 13px; letter-spacing: .1em; text-align: center; font-variant-numeric: tabular-nums; }
    .nav a.cta { display: inline-flex; align-items: center; min-height: 42px; padding: 0 20px; border-radius: 999px; color: #fff; background: var(--grad); font-size: 14px; font-weight: 600; text-decoration: none; }

    @media (max-width: 760px) {
      .inner { width: calc(100% - 24px); padding: 32px 24px; border-radius: 20px; }
      .two, .map { grid-template-columns: 1fr; }
      .bar .meta span { display: none; }
      .nav a.cta { display: none; }
      th, td { padding: 11px 12px; }
    }
    @media print {
      body { background: #fff; color: #1a2032; }
      .bar, .nav, .progress { display: none; }
      main { padding: 0; }
      .slide { display: block !important; break-after: page; }
      .inner, .slide.accent .inner { color: #1a2032; background: #fff; box-shadow: none; border: 1px solid #e4e8f1; }
      h2, h3, tbody th { color: #0b1026; }
      .col, .col.a, .cards article, .box, .rings li, details { background: #fff; border-color: #e4e8f1; color: #1a2032; }
      .col p, .cards p, .steps p, .box p, tbody td, .myths tbody td { color: #4a5568; }
      details { display: block; }
      details > summary { display: none; }
    }
  </style>
</head>
<body>
  <div class="progress" id="progress" style="width:0"></div>
  <header class="bar">
    <a class="logo" href="../../index.html" aria-label="ExplAIn home"><img src="../../assets/logo-white.png" alt="ExplAIn" width="545" height="201"></a>
    <p class="meta"><b>${esc(partName(m))}</b> <span>· ${esc(m.label)}</span></p>
    <span class="free">Free</span>
  </header>

  <main id="deck">${slides}
  </main>

  <nav class="nav" aria-label="Deck navigation">
    <button type="button" id="prev" aria-label="Previous slide">← Back</button>
    <span class="count" id="count" aria-live="polite"></span>
    <button type="button" id="next" aria-label="Next slide">Next →</button>
    <a class="cta" href="../../${esc(partSlug(m))}.html">Module notes</a>
  </nav>

  <script>
    (function () {
      var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
      var prev = document.getElementById('prev'), next = document.getElementById('next');
      var count = document.getElementById('count'), progress = document.getElementById('progress');
      var at = 0;

      function show(i, push) {
        at = Math.max(0, Math.min(slides.length - 1, i));
        slides.forEach(function (s, j) { s.classList.toggle('on', j === at); });
        count.textContent = (at + 1) + ' / ' + slides.length;
        progress.style.width = ((at + 1) / slides.length * 100) + '%';
        prev.disabled = at === 0;
        next.disabled = at === slides.length - 1;
        if (push && history.replaceState) history.replaceState(null, '', '#s' + (at + 1));
        window.scrollTo(0, 0);
      }

      function fromHash() {
        var n = parseInt((location.hash || '').replace('#s', ''), 10);
        show(isNaN(n) ? 0 : n - 1, false);
      }

      prev.addEventListener('click', function () { show(at - 1, true); });
      next.addEventListener('click', function () { show(at + 1, true); });
      window.addEventListener('hashchange', fromHash);
      document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'SUMMARY' && (e.key === ' ' || e.key === 'Enter')) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { show(at + 1, true); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { show(at - 1, true); e.preventDefault(); }
        else if (e.key === 'Home') { show(0, true); }
        else if (e.key === 'End') { show(slides.length - 1, true); }
      });

      var x0 = null;
      document.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
      document.addEventListener('touchend', function (e) {
        if (x0 === null) return;
        var dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 60) show(at + (dx < 0 ? 1 : -1), true);
        x0 = null;
      }, { passive: true });

      fromHash();
    })();
  </script>
</body>
</html>
`;
}

module.exports = { buildWebDeck, slideBody, fromModule };
