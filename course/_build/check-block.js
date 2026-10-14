// "Before you move on" — the module's own check question, on the module page.
//
// Every module carries a `check` in its JSON: a realistic failure, a prompt, and
// the points a good answer makes. Until now only module-00 showed it, because it
// surfaced inside the deck widget and module-00 is the only module with a deck.
//
// The reader answers first and reveals after, because reading model answers
// without having committed to one teaches very little. Nothing is stored: the
// box is deliberately not persisted, so the privacy policy's claim that the site
// keeps a single sessionStorage entry stays true.
function checkSection(m, { esc }) {
  const c = m.check;
  if (!c || !c.question) return '';
  const answers = (c.answers || []).map((a) => {
    const i = String(a).indexOf(':');
    // "Tools: fetch the fee…" reads better with the lead word set apart.
    return i > 0 && i < 24
      ? `<li><b>${esc(String(a).slice(0, i))}</b>${esc(String(a).slice(i + 1))}</li>`
      : `<li>${esc(a)}</li>`;
  }).join('');

  return `
    <section class="section" id="check">
      <div class="shell">
        <div class="section-head center">
          <p class="eyebrow">Before you move on</p>
          <h2>Can you call this one?</h2>
        </div>
        <div class="chk" data-chk>
          <p class="chk-q">${esc(c.question)}</p>
          ${c.prompt ? `<p class="chk-p">${esc(c.prompt)}</p>` : ''}
          <label class="chk-label" for="chk-answer">Your answer</label>
          <textarea class="chk-in" id="chk-answer" rows="3"
                    placeholder="Name the part that failed, and what you would change."></textarea>
          <button class="chk-btn" type="button" data-chk-show>Show how we would answer</button>
          <div class="chk-a" data-chk-answer hidden>
            <p class="chk-a-h">How we would answer</p>
            <ul>${answers}</ul>
            <p class="chk-cta">Every module ends on a question like this.
              <a href="digital-course.html#join">Join the waitlist &rarr;</a></p>
          </div>
        </div>
      </div>
    </section>
`;
}

const CHECK_CSS = `
    .chk { max-width: 760px; margin-inline: auto; padding: 36px 38px; border: 1px solid var(--line); border-radius: 26px; background: #fff; }
    .chk-q { color: var(--navy); font-size: clamp(19px, 2.2vw, 25px); font-weight: 600; line-height: 1.35; letter-spacing: -.02em; }
    .chk-p { margin-top: 12px; color: var(--muted); font-size: 15.5px; line-height: 1.6; }
    .chk-label { display: block; margin: 24px 0 8px; color: var(--violet); font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .chk-in { display: block; width: 100%; padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: var(--off-white); color: var(--navy); font: inherit; font-size: 15px; line-height: 1.55; resize: vertical; }
    .chk-in:focus { outline: 3px solid var(--violet); outline-offset: 2px; border-color: transparent; }
    .chk-in::placeholder { color: #9aa3b5; }
    .chk-btn { display: inline-flex; align-items: center; min-height: 48px; margin-top: 16px; padding: 0 24px; border: 0; border-radius: 999px; color: #fff; background: var(--grad-deep); font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: transform .2s ease; }
    .chk-btn:hover { transform: translateY(-2px); }
    .chk-btn[hidden] { display: none; }
    .chk-a { margin-top: 26px; padding-top: 24px; border-top: 1px dashed var(--line); animation: chkIn .45s cubic-bezier(.2,.7,.2,1); }
    .chk-a[hidden] { display: none; }
    @keyframes chkIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .chk-a-h { color: var(--violet); font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .chk-a ul { margin: 16px 0 0; padding-left: 20px; }
    .chk-a li { margin-bottom: 11px; color: var(--muted); font-size: 15px; line-height: 1.6; }
    .chk-a li b { color: var(--navy); }
    .chk-cta { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14.5px; }
    .chk-cta a { color: var(--violet); font-weight: 700; text-decoration: none; }
    .chk-cta a:hover { text-decoration: underline; }
    @media (max-width: 640px) { .chk { padding: 26px 22px; } }
    @media (prefers-reduced-motion: reduce) { .chk-a { animation: none; } }
    @media (prefers-color-scheme: dark) {
      .chk { background: #121a3a; border-color: #26315c; }
      .chk-q, .chk-a li b { color: #f2f5ff; }
      .chk-p, .chk-a li, .chk-cta { color: #a3adca; }
      .chk-label, .chk-a-h { color: #c8b9ff; }
      .chk-in { background: #0e1533; border-color: #2f3a6e; color: #f2f5ff; }
      .chk-in::placeholder { color: #7c87a8; }
      .chk-a { border-top-color: #26315c; }
      .chk-cta { border-top-color: #26315c; }
      .chk-cta a { color: #c8b9ff; }
    }`;

const CHECK_JS = `
  // Reveal on request. The answer box is never stored or sent anywhere.
  document.querySelectorAll('[data-chk]').forEach(function (box) {
    var btn = box.querySelector('[data-chk-show]');
    var answer = box.querySelector('[data-chk-answer]');
    btn.addEventListener('click', function () {
      answer.hidden = false;
      btn.hidden = true;
      answer.setAttribute('tabindex', '-1');
      answer.focus({ preventScroll: true });
    });
  });`;

module.exports = { checkSection, CHECK_CSS, CHECK_JS };
