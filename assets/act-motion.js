// The syllabus diagrams play their idea once when they come into view, and again when the pointer rests on them:
// the nesting map lights from the outside in, the context window fills in order, the agent loop runs one lap.
// Every word is visible the whole time; only the highlights play. Under reduced motion nothing runs and each
// diagram rests on its finished picture.
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = document.querySelectorAll('[data-play]');
  if (!els.length || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('act-motion');

  function play(el) {
    var now = Date.now();
    if (+el.dataset.until > now) return;              // let a run finish before it can restart
    el.dataset.until = now + (+el.dataset.play || 2000);
    el.classList.remove('is-play');
    void el.offsetWidth;                               // restart the CSS animations
    el.classList.add('is-play', 'is-played');
    var motion = el.querySelector('animateMotion');
    if (motion && motion.beginElement) motion.beginElement();
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !e.target.classList.contains('is-played')) play(e.target);
    });
  }, { threshold: 0.55 });

  els.forEach(function (el) {
    io.observe(el);
    el.addEventListener('pointerenter', function () { play(el); });
  });
})();
