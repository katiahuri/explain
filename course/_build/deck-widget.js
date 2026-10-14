// The free deck, shown on the module page itself.
//
// Renders the same slides as the standalone deck, from the same module JSON and
// through the same slideBody()/fromModule() renderers, so the two cannot drift.
// Everything is scoped under .deckw because the module page already owns generic
// class names like .map, .box and .cards.
//
// Each slide keeps its own `style` (light / accent / dark) and `eyebrow` from the
// content, so the strip reads like a deck rather than a list of cards.
//
// Without JavaScript it is a horizontally scrollable, snapping strip with every
// slide fully visible. The script adds the buttons, the counter, arrow keys and
// the entrance animation — and only it can hide anything, so no-JS never breaks.
const { slideBody, fromModule } = require('./web-deck');

function deckSection(m, { esc, mapBoxes, partName }) {
  const slides = m.slides
    .map((s) => {
      const body = slideBody(s, { esc, mapBoxes }) || fromModule(s, m, { esc });
      if (!body) return null;
      const h = /<h2>([\s\S]*?)<\/h2>/.exec(body);
      const heading = h ? h[1].replace(/<[^>]*>/g, '').trim() : '';
      return { body, heading, style: s.style || 'light', eyebrow: s.eyebrow || '' };
    })
    .filter(Boolean);
  if (!slides.length) return '';

  const total = slides.length;
  const items = slides.map((s, i) => `
          <article class="deckw-slide" data-style="${esc(s.style)}" role="group"
                   aria-roledescription="slide" aria-label="Slide ${i + 1} of ${total}">
            <div class="deckw-inner">${s.eyebrow ? `
              <p class="deckw-eyebrow">${esc(s.eyebrow)}</p>` : ''}${s.body}
            </div>
          </article>`).join('');

  return `
    <section class="section white" id="deck">
      <div class="shell">
        <div class="section-head">
          <p class="eyebrow">The free deck</p>
          <h2>${esc(partName(m))} as slides</h2>
        </div>
        <div class="deckw" data-deck>
          <div class="deckw-track" tabindex="0" aria-label="${esc(partName(m))} slides">${items}
          </div>
          <div class="deckw-rail"><span class="deckw-fill" data-deck-fill></span></div>
          <ol class="deckw-grid" data-deck-grid hidden>${slides.map((s, i) => `
            <li><button class="deckw-thumb" type="button" data-deck-to="${i}" data-style="${esc(s.style)}">
              <span class="t-num">${String(i + 1).padStart(2, '0')}</span>${s.eyebrow ? `
              <span class="t-eyebrow">${esc(s.eyebrow)}</span>` : ''}
              <span class="t-title">${esc(s.heading || 'Slide ' + (i + 1))}</span>
            </button></li>`).join('')}
          </ol>
          <div class="deckw-bar">
            <button class="deckw-btn" type="button" data-deck-prev aria-label="Previous slide">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
            </button>
            <p class="deckw-count"><b data-deck-at>1</b> / ${total}</p>
            <button class="deckw-btn" type="button" data-deck-next aria-label="Next slide">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
            </button>
            <button class="deckw-all" type="button" data-deck-all aria-expanded="false">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>
              <span data-deck-all-label>All ${total} slides</span>
            </button>
          </div>
        </div>
      </div>
    </section>
`;
}

const DECK_CSS = `
    .deckw { position: relative; }
    .deckw-track { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; }
    .deckw-track::-webkit-scrollbar { display: none; }
    .deckw-track:focus-visible { outline: 3px solid var(--violet); outline-offset: 5px; border-radius: 30px; }
    .deckw-slide { flex: 0 0 100%; scroll-snap-align: center; display: flex; }

    /* A slide, not a card: centred, generous, one idea at a time. */
    .deckw-inner { flex: 1; display: grid; align-content: center; justify-items: center; gap: 0;
      min-height: clamp(360px, 44vw, 520px); padding: clamp(32px, 5vw, 64px) clamp(24px, 6vw, 80px);
      border-radius: 28px; background: var(--off-white); border: 1px solid var(--line); text-align: center; }
    .deckw-eyebrow { color: var(--violet); font-size: 11.5px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
    .deckw-inner h2 { max-width: 20ch; margin-top: 18px; font-size: clamp(27px, 3.6vw, 46px); line-height: 1.08; letter-spacing: -.035em; }
    .deckw-inner .sub { max-width: 54ch; margin-top: 20px; color: var(--muted); font-size: clamp(15px, 1.5vw, 19px); line-height: 1.6; }
    .deckw-inner .pill { margin-top: 26px; padding: 9px 18px; border-radius: 999px; color: var(--violet-deep, #4c1d95); background: var(--lavender); font-size: 13px; font-weight: 600; }
    .deckw-inner .note { max-width: 54ch; margin-top: 18px; color: var(--muted); font-size: 14px; }

    /* Dense slides stay centred as a block, but read left inside. */
    .deckw-inner .two, .deckw-inner .cards, .deckw-inner .steps, .deckw-inner .scroll-x,
    .deckw-inner .rings, .deckw-inner .points, .deckw-inner details { width: 100%; max-width: 860px; margin-top: 30px; text-align: left; }
    .deckw-inner .two { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .deckw-inner .col { padding: 22px 24px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
    .deckw-inner .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; }
    .deckw-inner .cards article { padding: 20px 22px; border: 1px solid var(--line); border-radius: 18px; background: #fff; }
    .deckw-inner .cards span { display: block; margin-bottom: 10px; color: var(--violet); font-size: 12px; font-weight: 700; letter-spacing: .14em; }
    .deckw-inner h3 { margin: 0 0 6px; font-size: 16.5px; }
    .deckw-inner p { color: var(--muted); font-size: 14.5px; line-height: 1.6; }
    .deckw-inner ul, .deckw-inner ol { padding-left: 20px; }
    .deckw-inner li { margin-bottom: 9px; color: var(--muted); font-size: 14.5px; line-height: 1.55; }
    .deckw-inner li h3 { color: var(--navy); }
    .deckw-inner .steps { list-style: none; counter-reset: s; padding-left: 0; }
    .deckw-inner .steps li { counter-increment: s; position: relative; padding-left: 40px; }
    .deckw-inner .steps li::before { content: counter(s); position: absolute; left: 0; top: 0; display: grid; place-items: center; width: 27px; height: 27px; border-radius: 9px; color: #fff; background: var(--grad-deep); font-size: 12px; font-weight: 700; }
    .deckw-inner .scroll-x { overflow-x: auto; }
    .deckw-inner table { width: 100%; border-collapse: collapse; font-size: 14px; }
    .deckw-inner th, .deckw-inner td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--line); color: var(--muted); }
    .deckw-inner thead th { color: var(--navy); font-size: 11.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
    .deckw-inner tbody th { color: var(--navy); font-weight: 600; }
    .deckw-inner summary { color: var(--violet); font-size: 15px; font-weight: 600; cursor: pointer; }

    /* The two emphatic slide styles, straight from the content. */
    .deckw-slide[data-style="accent"] .deckw-inner { border-color: transparent; background: var(--grad-deep); }
    .deckw-slide[data-style="dark"] .deckw-inner { border-color: transparent; background: linear-gradient(150deg, #070b1d, #0b1026 55%, #141d48); }
    .deckw-slide[data-style="accent"] h2, .deckw-slide[data-style="dark"] h2,
    .deckw-slide[data-style="accent"] h3, .deckw-slide[data-style="dark"] h3 { color: #fff; }
    .deckw-slide[data-style="accent"] .deckw-eyebrow, .deckw-slide[data-style="dark"] .deckw-eyebrow { color: #e4dcff; }
    .deckw-slide[data-style="accent"] .sub, .deckw-slide[data-style="dark"] .sub,
    .deckw-slide[data-style="accent"] p, .deckw-slide[data-style="dark"] p,
    .deckw-slide[data-style="accent"] li, .deckw-slide[data-style="dark"] li { color: #ccd4ec; }
    .deckw-slide[data-style="accent"] .pill, .deckw-slide[data-style="dark"] .pill { color: #fff; background: rgba(255,255,255,.14); }

    /* Entrance: only once the script has taken over. */
    .deckw.is-ready .deckw-slide .deckw-inner > * { opacity: 0; transform: translateY(16px); }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > * { animation: deckIn .55s cubic-bezier(.2,.7,.2,1) forwards; }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > *:nth-child(1) { animation-delay: .04s; }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > *:nth-child(2) { animation-delay: .12s; }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > *:nth-child(3) { animation-delay: .20s; }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > *:nth-child(4) { animation-delay: .28s; }
    .deckw.is-ready .deckw-slide.is-on .deckw-inner > *:nth-child(n+5) { animation-delay: .34s; }
    @keyframes deckIn { to { opacity: 1; transform: none; } }

    /* Overview: every slide at once, pick one to read. */
    .deckw.is-overview .deckw-track, .deckw.is-overview .deckw-rail { display: none; }
    .deckw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(216px, 1fr)); gap: 14px; margin: 0; padding: 0; list-style: none; }
    .deckw-grid[hidden] { display: none; }
    .deckw-thumb { display: flex; flex-direction: column; align-items: flex-start; gap: 7px; width: 100%; min-height: 136px; padding: 18px 20px; border: 1px solid var(--line); border-radius: 18px; background: var(--off-white); font: inherit; text-align: left; cursor: pointer; transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
    .deckw-thumb:hover { transform: translateY(-2px); border-color: var(--violet); box-shadow: 0 14px 30px rgba(11,16,38,.1); }
    .deckw-thumb[data-style="accent"] { border-color: transparent; background: var(--grad-deep); }
    .deckw-thumb[data-style="dark"] { border-color: transparent; background: linear-gradient(150deg, #070b1d, #0b1026 55%, #141d48); }
    .t-num { color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: .16em; }
    .t-eyebrow { color: var(--violet); font-size: 10.5px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
    .t-title { color: var(--navy); font-size: 15px; font-weight: 600; line-height: 1.35; }
    .deckw-thumb[data-style="accent"] .t-num, .deckw-thumb[data-style="dark"] .t-num,
    .deckw-thumb[data-style="accent"] .t-eyebrow, .deckw-thumb[data-style="dark"] .t-eyebrow { color: #e4dcff; }
    .deckw-thumb[data-style="accent"] .t-title, .deckw-thumb[data-style="dark"] .t-title { color: #fff; }
    .deckw-thumb.is-current { border-color: var(--violet); box-shadow: 0 0 0 2px var(--violet); }
    .deckw-all { display: inline-flex; align-items: center; gap: 9px; min-height: 48px; margin-left: 8px; padding: 0 20px; border: 1px solid var(--line); border-radius: 999px; background: #fff; color: var(--navy); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: border-color .2s ease; }
    .deckw-all:hover { border-color: var(--violet); }
    .deckw-all svg { width: 16px; height: 16px; fill: currentColor; }

    .deckw-rail { height: 3px; margin: 22px auto 0; border-radius: 3px; background: var(--line); overflow: hidden; }
    .deckw-fill { display: block; height: 100%; width: 0; border-radius: 3px; background: var(--grad-deep); transition: width .4s cubic-bezier(.2,.7,.2,1); }
    .deckw-bar { display: flex; align-items: center; justify-content: center; gap: 18px; margin-top: 18px; }
    .deckw-btn { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid var(--line); border-radius: 50%; background: #fff; color: var(--navy); cursor: pointer; transition: border-color .2s ease, transform .2s ease; }
    .deckw-btn:hover:not(:disabled) { border-color: var(--violet); transform: translateY(-1px); }
    .deckw-btn:disabled { opacity: .3; cursor: not-allowed; }
    .deckw-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .deckw-count { color: var(--muted); font-size: 14px; font-variant-numeric: tabular-nums; }
    .deckw-count b { color: var(--navy); }

    @media (max-width: 760px) {
      .deckw-inner { min-height: 0; padding: 30px 24px; }
      .deckw-inner .two, .deckw-inner .cards { grid-template-columns: 1fr; }
      .deckw-inner h2 { max-width: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .deckw-track { scroll-behavior: auto; }
      .deckw.is-ready .deckw-slide .deckw-inner > * { opacity: 1; transform: none; animation: none; }
      .deckw-fill { transition: none; }
    }
    @media (prefers-color-scheme: dark) {
      .deckw-inner { background: #0e1533; border-color: #26315c; }
      .deckw-inner .col, .deckw-inner .cards article, .deckw-btn { background: #121a3a; border-color: #26315c; }
      .deckw-inner p, .deckw-inner li, .deckw-inner th, .deckw-inner td, .deckw-inner .sub, .deckw-inner .note { color: #a3adca; }
      .deckw-inner h2, .deckw-inner h3, .deckw-inner thead th, .deckw-inner tbody th, .deckw-count b { color: #f2f5ff; }
      .deckw-inner .pill { color: #e4dcff; background: #1e2550; }
      .deckw-btn, .deckw-all { color: #f2f5ff; background: #121a3a; border-color: #26315c; }
      .deckw-rail { background: #26315c; }
      .deckw-thumb { background: #0e1533; border-color: #26315c; }
      .t-title { color: #f2f5ff; }
      .t-num { color: #98a3c0; }
      .t-eyebrow { color: #c8b9ff; }
    }`;

const DECK_JS = `
  // The strip scrolls and snaps on its own. This adds the controls, the progress
  // rail and the entrance animation, and marks the deck ready so the CSS may hide
  // off-slide content — nothing is hidden when this never runs.
  document.querySelectorAll('[data-deck]').forEach(function (deck) {
    var track = deck.querySelector('.deckw-track');
    var slides = [].slice.call(deck.querySelectorAll('.deckw-slide'));
    var at = deck.querySelector('[data-deck-at]');
    var fill = deck.querySelector('[data-deck-fill]');
    var prev = deck.querySelector('[data-deck-prev]');
    var next = deck.querySelector('[data-deck-next]');
    var i = 0;
    deck.classList.add('is-ready');

    function paint() {
      slides.forEach(function (s, n) {
        // Re-trigger the animation each time a slide comes round again.
        if (n === i) { s.classList.remove('is-on'); void s.offsetWidth; s.classList.add('is-on'); }
        else { s.classList.remove('is-on'); }
      });
      at.textContent = i + 1;
      fill.style.width = ((i + 1) / slides.length * 100) + '%';
      prev.disabled = i === 0;
      next.disabled = i === slides.length - 1;
    }
    function go(n) {
      i = Math.max(0, Math.min(slides.length - 1, n));
      track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: 'smooth' });
      paint();
    }
    var grid = deck.querySelector('[data-deck-grid]');
    var all = deck.querySelector('[data-deck-all]');
    var allLabel = deck.querySelector('[data-deck-all-label]');
    var thumbs = [].slice.call(deck.querySelectorAll('.deckw-thumb'));
    var openLabel = allLabel.textContent;

    function overview(on) {
      deck.classList.toggle('is-overview', on);
      grid.hidden = !on;
      all.setAttribute('aria-expanded', String(on));
      allLabel.textContent = on ? 'Back to reading' : openLabel;
      if (on) thumbs.forEach(function (t, n) { t.classList.toggle('is-current', n === i); });
    }
    all.addEventListener('click', function () { overview(grid.hidden); });
    thumbs.forEach(function (t) {
      t.addEventListener('click', function () {
        overview(false);
        go(parseInt(t.getAttribute('data-deck-to'), 10));
        track.focus({ preventScroll: true });
      });
    });

    prev.addEventListener('click', function () { go(i - 1); });
    next.addEventListener('click', function () { go(i + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    });
    var t;
    track.addEventListener('scroll', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var mid = track.scrollLeft + track.clientWidth / 2;
        for (var n = 0; n < slides.length; n++) {
          var left = slides[n].offsetLeft - track.offsetLeft;
          if (mid >= left && mid < left + slides[n].offsetWidth) { if (n !== i) { i = n; paint(); } break; }
        }
      }, 90);
    });
    paint();
  });`;

module.exports = { deckSection, DECK_CSS, DECK_JS };
