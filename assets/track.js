// ExplAIn analytics beacon: counts pageviews, landings and a few actions.
//
// No cookies, no fingerprinting, no third party, nothing stored in the browser
// except one random id that lasts until the tab closes — just enough to tell a
// landing page apart from a page someone clicked through to. Honours Do Not
// Track and Global Privacy Control, and stays quiet on localhost.
(function () {
  var nav = window.navigator;
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return;
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;

  var ENDPOINT = '/api/track';

  function id() {
    try {
      var existing = sessionStorage.getItem('explain_visit');
      if (existing) return { visit: existing, landing: false };
      var fresh = (Math.random().toString(36) + Math.random().toString(36)).replace(/0\./g, '').slice(0, 16);
      sessionStorage.setItem('explain_visit', fresh);
      return { visit: fresh, landing: true };
    } catch (error) {
      // Private mode or blocked storage: still count the view, call it a landing.
      return { visit: '', landing: true };
    }
  }

  var visit = id();

  function device() {
    var width = window.innerWidth || 0;
    if (width < 640) return 'phone';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  // Clean URLs are on, so /digital-course and /digital-course.html are one page.
  function page() {
    var path = location.pathname.replace(/index\.html$/, '').replace(/\.html$/, '');
    return path === '' ? '/' : path;
  }

  function referrerHost() {
    try {
      var host = new URL(document.referrer).hostname;
      return host === location.hostname ? '' : host;
    } catch (error) {
      return '';
    }
  }

  function send(payload) {
    payload.path = page();
    payload.visit = visit.visit;
    var body = JSON.stringify(payload);
    try {
      if (nav.sendBeacon && nav.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return;
    } catch (error) { /* fall through to fetch */ }
    fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
      .catch(function () {});
  }

  var params = new URLSearchParams(location.search);
  send({
    landing: visit.landing,
    referrer: visit.landing ? referrerHost() : '',
    source: params.get('utm_source') || '',
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    device: device(),
  });

  function event(name, detail) { send({ event: name, detail: detail || '' }); }

  // Which calls to action people actually press, and which get ignored.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (/#join|#pricing|#episode/.test(href)) return event('cta', (link.textContent || '').trim().slice(0, 40));
    if (/\.pdf$/i.test(href)) return event('pdf', href.split('/').pop().slice(0, 40));
    if (link.hostname && link.hostname !== location.hostname) return event('outbound', link.hostname.slice(0, 40));
  }, true);

  // Read far enough down to count as having read the page.
  var deep = false;
  window.addEventListener('scroll', function () {
    if (deep) return;
    var seen = window.scrollY + window.innerHeight;
    var total = document.documentElement.scrollHeight;
    if (total > 0 && seen / total >= 0.75) { deep = true; event('scroll75'); }
  }, { passive: true });

  // assets/site.js announces a successful waitlist sign-up.
  window.addEventListener('explain:signup', function (e) {
    event('signup', (e.detail && e.detail.source) || '');
  });
})();
