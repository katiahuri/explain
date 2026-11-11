// The phone and tablet menu for pages built on site.css (and the generated module pages): a button
// beside the logo opens the nav's links as a full-screen sheet. Without script the links stay hidden
// below 1024px and the footer carries the same links.
(function () {
  document.querySelectorAll('.site-nav').forEach(function (nav) {
    var links = nav.querySelector('.nav-links');
    if (!links || nav.querySelector('.nav-toggle')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Menu');
    var open = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    var shut = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4 4 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    btn.innerHTML = open;
    links.parentNode.insertBefore(btn, links.nextSibling);
    function set(on) {
      nav.classList.toggle('is-open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      btn.innerHTML = on ? shut : open;
      document.documentElement.style.overflow = on ? 'hidden' : '';
    }
    btn.addEventListener('click', function () { set(!nav.classList.contains('is-open')); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (m) { if (m.matches) set(false); });
  });
})();
