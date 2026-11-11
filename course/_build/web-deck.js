// Renders a module's slides as a self-contained HTML deck, for modules marked "web_deck": true.
// This is the public, free version of a deck: the slides an attendee sees in the room and nothing
// more. Speaker notes and the facilitator script stay out of it on purpose.
const MAP_NOTE = 'Every later module zooms into one box.';

const num = (n) => String(n).padStart(2, '0');

function slideBody(s, { esc, mapBoxes, asset = '../../assets/' }) {
  switch (s.type) {
    case 'statement':
      return `
        <h2>${esc(s.title)}</h2>
        ${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ''}
        ${s.pill ? `<p class="pill">${esc(s.pill)}</p>` : ''}`;

    case 'bio':
      return `
        <div class="bio">
          <img src="${asset}${esc(s.photo)}" alt="${esc(s.title)}" width="1000" height="1333">
          <div>
            <h2>${esc(s.title)}</h2>
            ${s.sub ? `<p class="sub">${esc(s.sub)}</p>` : ''}
            <ul class="facts">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          </div>
        </div>`;

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
  <meta name="theme-color" content="#eef0f3">
  <link rel="icon" type="image/png" href="../../assets/icon-cobalt.png">
  <link rel="apple-touch-icon" href="../../assets/icon-cobalt.png">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(clip(m.summary))}">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400..700&family=JetBrains+Mono:wght@400..500&display=swap" rel="stylesheet">
  <!-- Generated by course/_build/build.js from course/content/${partSlug(m)}.json — edit the JSON, not this file. -->
  <style>
    /* The web deck in the site's system: white slides on the cool grey ground, a near-black ink, one cobalt accent,
       Onest. "Accent" slides are the one dark variant: the ink with white type. */
    :root {
      --ground: #eef0f3; --surface: #e2e5ea; --card: #ffffff; --ink: #0b0c0e; --ink-2: #23262c; --muted: #5d6470;
      --accent: #1f2de6; --accent-deep: #1621a8; --accent-soft: #e4e6fb; --line: #d5d9e0;
      --navy: var(--card); --navy-2: var(--surface); --edge: var(--line); --violet: var(--accent); --violet-l: var(--accent);
      --cyan: var(--accent); --amber: #b54708; --violet-d: var(--surface); --blue: var(--accent); --lav: var(--accent); --lav-line: var(--ink);
      --off-white: var(--ground); --body: var(--ink-2); --grad: var(--accent);
      color-scheme: light;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--ink-2); background: var(--ground); font-family: Onest, ui-sans-serif, system-ui, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    h1, h2, h3 { margin: 0; color: var(--ink); font-family: Onest, ui-sans-serif, sans-serif; font-weight: 400; letter-spacing: -.03em; }
    h3 { font-weight: 500; letter-spacing: -.01em; }
    code, pre, .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    :focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }

    /* ---- top bar ---- */
    .bar { position: fixed; inset: 0 0 auto; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 24px; background: var(--ground); border-bottom: 1px solid var(--line); }
    .bar a.logo img { display: block; height: 26px; width: auto; }
    .bar .meta { margin: 0; color: var(--muted); font-size: 14px; }
    .bar .meta b { color: var(--ink); font-weight: 500; }
    .free { padding: 3px 10px; border-radius: 8px; color: #fff; background: var(--accent); font-size: 13px; font-weight: 500; }
    .progress { position: fixed; top: 0; left: 0; z-index: 21; height: 3px; background: var(--accent); transition: width .25s ease; }

    /* ---- slides ---- */
    main { padding: 70px 0 96px; }
    .slide { display: none; }
    .slide.on { display: block; }
    .inner {
      position: relative; width: min(1040px, calc(100% - 44px), calc((100vh - 200px) * 16 / 9));
      aspect-ratio: 16 / 9; height: auto; margin: 24px auto; padding: 0; overflow: hidden;
      border-radius: 20px; color: var(--ink-2); background: var(--card);
      border: 1px solid var(--line);
    }
    .slide.accent .inner { color: #d4d6db; background: var(--ink); border-color: var(--ink); }
    .well { position: absolute; inset: 0; z-index: 2; display: flex; align-items: center; }
    .stage { width: 100%; padding: 5% 5.2%; transform-origin: center center; display: flex; flex-direction: column; justify-content: center; }
    .stage > :first-child { margin-top: 0; }
    /* One quiet mark per slide: a thin ring and a small node in the accent. */
    .deco { position: absolute; inset: 0; z-index: 1; pointer-events: none; overflow: hidden; }
    .deco i { display: none; }
    .deco b { position: absolute; right: -16%; top: -42%; width: 68%; aspect-ratio: 1; border: 1px solid var(--line); border-radius: 50%; }
    .deco s { position: absolute; right: 14%; top: 16%; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    .slide.accent .deco b { border-color: rgba(255,255,255,.16); }
    .slide.accent .deco s { background: #fff; }
    h2, h3 { color: var(--ink); }
    .slide.accent h2, .slide.accent h3 { color: #fff; }

    .eyebrow { display: block; margin: 0 0 .7em; color: var(--muted); font-size: clamp(12px, 1.3vw, 15px); font-weight: 500; }
    .slide.accent .eyebrow { color: #9aa0aa; }

    h2 { font-size: clamp(26px, 3.9vw, 46px); line-height: 1.08; }
    .t-statement h2 { font-size: clamp(30px, 4.6vw, 52px); }
    .sub { margin: .5em 0 0; font-size: clamp(17px, 2.5vw, 29px); line-height: 1.3; color: var(--muted); max-width: 88%; }
    .slide.accent .sub { color: #b9bcc3; }
    .pill { align-self: flex-start; margin: 1em 0 0; padding: .45em 1.1em; border-radius: 10px; color: #fff; background: var(--accent); font-size: clamp(13px, 1.7vw, 19px); font-weight: 500; }
    .slide.accent .pill { color: var(--ink); background: #fff; }
    .note { margin: 18px 0 0; color: var(--muted); font-size: 14px; text-align: center; }

    .scroll-x { margin-top: 26px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: clamp(14px, 1.5vw, 16px); }
    th, td { padding: 13px 16px; text-align: left; vertical-align: top; }
    thead th { color: var(--ink); background: var(--surface); font-size: 13px; font-weight: 500; white-space: nowrap; }
    thead th:first-child { border-radius: 10px 0 0 10px; }
    thead th:last-child { border-radius: 0 10px 10px 0; }
    thead th.blank { background: transparent; }
    tbody tr + tr th, tbody tr + tr td { border-top: 1px solid var(--line); }
    tbody th { color: var(--ink); font-weight: 500; white-space: nowrap; }
    tbody td { color: var(--ink-2); }
    .myths tbody th { color: var(--ink); font-weight: 500; white-space: normal; }
    .myths tbody td { color: var(--ink-2); }

    .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 26px; }
    .col { padding: 24px 26px; border: 1px solid var(--line); border-radius: 16px; background: var(--ground); }
    .col.a { border-color: var(--accent); background: var(--card); box-shadow: inset 0 0 0 1px var(--accent); }
    .col h3 { font-size: 19px; }
    .col p { margin: 6px 0 14px; color: var(--muted); font-size: 15px; }
    .col ul { margin: 0; padding-left: 18px; }
    .col li + li { margin-top: 7px; }
    .col li { font-size: 15px; }

    .bio { display: grid; grid-template-columns: 27% 1fr; gap: 6%; align-items: center; }
    .bio img { display: block; width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; object-position: 50% 20%; border-radius: 16px; border: 1px solid var(--line); }
    .bio h2 { font-size: clamp(24px, 3.4vw, 40px); }
    .bio .sub { max-width: 100%; font-size: clamp(15px, 2vw, 22px); }
    .facts { margin: 1.1em 0 0; padding: 0; list-style: none; }
    .facts li { position: relative; padding-left: 22px; color: var(--ink-2); font-size: clamp(13px, 1.6vw, 17px); }
    .facts li + li { margin-top: .6em; }
    .facts li::before { content: ""; position: absolute; left: 0; top: .62em; width: 11px; height: 2px; border-radius: 2px; background: var(--accent); }

    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-top: 26px; }
    .cards article { padding: 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--ground); }
    .cards span { display: block; margin-bottom: 14px; color: var(--muted); font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 13px; }
    .cards h3 { font-size: 17px; }
    .cards p { margin: 7px 0 0; color: var(--ink-2); font-size: 14px; }

    .steps { margin: 26px 0 0; padding-left: 22px; }
    .steps li + li { margin-top: 14px; }
    .steps h3 { font-size: 17px; }
    .steps p { margin: 4px 0 0; color: var(--ink-2); font-size: 14px; }
    .steps.tight li { font-size: 15px; }
    .steps.tight li + li { margin-top: 8px; }

    .rings { margin: 0; padding: 0; list-style: none; }
    .rings li { margin-left: calc(var(--depth) * 18px); padding: 13px 18px; border: 1px solid var(--line); border-radius: 12px; background: var(--ground); color: var(--ink); font-weight: 500; font-size: 15px; }
    .rings li:last-child { border-color: var(--accent); background: var(--accent); color: #fff; }
    .rings li + li { margin-top: 8px; }
    .points { margin: 0; padding-left: 20px; }
    .points li + li { margin-top: 10px; }
    .points li { font-size: 15px; }

    .map { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 26px; }
    .box { padding: 18px 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--ground); }
    .box h3 { font-size: 16px; font-weight: 500; }
    .box p { margin: 3px 0 0; color: var(--muted); font-size: 14px; }
    .box.model { display: flex; flex-direction: column; justify-content: center; border: 0; background: var(--ink); }
    .box.model h3 { color: #fff; font-size: 21px; font-weight: 400; }
    .box.model p { color: #c9ccd2; }

    details { margin-top: 26px; padding: 20px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--ground); }
    summary { color: var(--accent); font-weight: 500; font-size: 15px; cursor: pointer; }
    .answers { margin: 16px 0 0; padding-left: 20px; }
    .answers li + li { margin-top: 9px; }
    .answers li { font-size: 15px; }

    /* ---- bottom nav ---- */
    .nav { position: fixed; inset: auto 0 0; z-index: 20; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px 20px; background: var(--ground); border-top: 1px solid var(--line); }
    .nav button { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 20px; border: 0; border-radius: 12px; color: var(--ink); background: var(--surface); font: inherit; font-size: 15px; font-weight: 500; cursor: pointer; }
    .nav button:hover:not(:disabled) { background: var(--line); }
    .nav button:disabled { opacity: .4; cursor: default; }
    .nav .count { min-width: 74px; color: var(--muted); font-size: 14px; text-align: center; font-variant-numeric: tabular-nums; }
    .nav a.cta { display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px; border-radius: 12px; color: #fff; background: var(--accent); font-size: 15px; font-weight: 500; text-decoration: none; }
    .nav a.cta:hover { background: var(--accent-deep); }

    @media (max-width: 760px) {
      .inner { width: calc(100% - 24px); border-radius: 14px; }
      .stage { padding: 5.5% 5.5%; }
      .two, .map { grid-template-columns: 1fr; }
      .bio { grid-template-columns: 1fr; gap: 16px; }
      .bio img { width: 120px; }
      .bar .meta span { display: none; }
      .nav a.cta { display: none; }
      th, td { padding: 11px 12px; }
    }
    @media print {
      body { background: #fff; color: var(--ink-2); }
      .bar, .nav, .progress { display: none; }
      main { padding: 0; }
      .slide { display: block !important; break-after: page; }
      .inner, .slide.accent .inner { color: var(--ink-2); background: #fff; box-shadow: none; border: 1px solid var(--line); }
      .slide.accent h2, .slide.accent h3 { color: var(--ink); }
      .stage { transform: none !important; }
      .deco { display: none; }
      details { display: block; }
      details > summary { display: none; }
    }
  </style>
</head>
<body>
  <div class="progress" id="progress" style="width:0"></div>
  <header class="bar">
    <a class="logo" href="../../index.html" aria-label="ExplAIn home"><img src="../../assets/logo-ink.png" alt="ExplAIn" width="545" height="201"></a>
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

      // One constant 16:9 frame per slide: move the content into a well and scale
      // anything that would overflow. Must run after the webfont loads, or the
      // measurement is taken with the fallback font and the dense slides clip.
      Array.prototype.forEach.call(document.querySelectorAll('.slide .inner'), function (inner) {
        var deco = document.createElement('div');
        deco.className = 'deco';
        deco.setAttribute('aria-hidden', 'true');
        deco.innerHTML = '<i></i><b></b><s></s>';
        var well = document.createElement('div');
        well.className = 'well';
        var stage = document.createElement('div');
        stage.className = 'stage';
        while (inner.firstChild) stage.appendChild(inner.firstChild);
        well.appendChild(stage);
        inner.appendChild(deco);
        inner.appendChild(well);
      });
      function fitSlides() {
        Array.prototype.forEach.call(document.querySelectorAll('.slide .inner'), function (inner) {
          var slide = inner.parentNode;
          var well = inner.querySelector('.well'), stage = inner.querySelector('.stage');
          if (!well || !stage) return;
          var hidden = slide.className.indexOf(' on') === -1;
          if (hidden) { slide.style.visibility = 'hidden'; slide.style.display = 'block'; }
          stage.style.transform = 'none';
          var need = stage.scrollHeight, avail = well.clientHeight;
          if (avail > 0 && need > avail) stage.style.transform = 'scale(' + (avail / need) + ')';
          if (hidden) { slide.style.display = ''; slide.style.visibility = ''; }
        });
      }
      fitSlides();
      window.addEventListener('resize', fitSlides);
      window.addEventListener('load', fitSlides);
      document.addEventListener('toggle', fitSlides, true);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSlides);

      fromHash();
    })();
  </script>
</body>
</html>
`;
}

module.exports = { buildWebDeck, slideBody, fromModule };
