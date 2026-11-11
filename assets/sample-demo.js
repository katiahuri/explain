// Module 04 on the homepage, run live: the bars grow to each token's probability, a sampling pass runs down the
// rows and settles on one token (picked by those probabilities, so now and then it is Lyon), and the token is
// written into the sentence. It plays once when it comes into view; "Sample again" runs it again.
// Without script the table stands with its bars drawn; under reduced motion each run happens at once.
(function () {
  var root = document.querySelector('[data-sample]');
  if (!root) return;
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-tok]'));
  var out = root.querySelector('.xm__out');
  var log = document.querySelector('[data-runlog]');
  var again = document.querySelector('[data-sample-again]');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var run = 0, busy = false;
  root.classList.add('sd-js');

  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function pick() {
    var total = rows.reduce(function (a, r) { return a + +r.dataset.p; }, 0);
    var x = Math.random() * total;
    for (var i = 0; i < rows.length; i++) { x -= +rows[i].dataset.p; if (x < 0) return i; }
    return 0;
  }
  function mark(i, cls) { rows.forEach(function (r, j) { r.classList.toggle(cls, j === i); }); }

  async function play() {
    if (busy) return;
    busy = true; run += 1;
    if (again) again.disabled = true;
    rows.forEach(function (r) { r.classList.remove('is-scan', 'is-pick'); });
    out.textContent = '';
    root.classList.remove('is-grown'); void root.offsetWidth; root.classList.add('is-grown');
    await wait(1000);
    var k = pick();
    if (!reduce) {
      var steps = rows.length * 2 + k, delay = 70;
      for (var s = 0; s <= steps; s++) { mark(s % rows.length, 'is-scan'); await wait(delay); delay += 14; }
    }
    mark(-1, 'is-scan'); mark(k, 'is-pick');
    var tok = rows[k].dataset.tok;
    for (var c = 0; c <= tok.length; c++) { out.textContent = ' ' + tok.slice(0, c); await wait(55); }
    if (log) log.textContent = 'Run ' + run + ': ' + tok + (tok === 'Paris' ? '.' : '. Fluent, and wrong.');
    if (again) again.disabled = false;
    busy = false;
  }

  if (again) again.addEventListener('click', play);
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); play(); }
    }, { threshold: 0.5 });
    io.observe(root);
  } else { play(); }
})();
