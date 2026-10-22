// The free episode plays its opening to anyone, then asks for an email.
//
// Markup contract, anywhere on the site:
//   <div class="listen" data-listen="00-how-we-got-here"> … </div>
// with a [data-listen-lock] panel holding a form, and a [data-listen-audio]
// player. A stranger gets the preview straight away; the full file is only ever
// fetched once the server has handed out a pass, and it has no public URL.
(function () {
  var gates = document.querySelectorAll('[data-listen]');
  if (!gates.length) return;

  function source(slug, preview) {
    return '/api/episode?ep=' + encodeURIComponent(slug) + (preview ? '&preview=1' : '');
  }

  // How many people press play, and how far they get. Milestones only: the
  // position is never reported, and each mark fires once per mode.
  function meter(audio, episode) {
    var reached = {};
    var started = {};
    var tell = function (name) {
      window.dispatchEvent(new CustomEvent('explain:listen', { detail: { name: name, episode: episode } }));
    };

    audio.addEventListener('play', function () {
      var mode = audio.dataset.mode;
      if (started[mode]) return;
      started[mode] = true;
      tell(mode === 'preview' ? 'preview' : 'listen');
    });

    audio.addEventListener('timeupdate', function () {
      if (audio.dataset.mode !== 'full') return;
      var total = audio.duration;
      if (!total || !isFinite(total)) return;
      var percent = (audio.currentTime / total) * 100;
      [25, 50, 75].forEach(function (mark) {
        if (percent >= mark && !reached[mark]) { reached[mark] = true; tell('listen' + mark); }
      });
      if (percent >= 99 && !reached[100]) { reached[100] = true; tell('listen100'); }
    });

    audio.addEventListener('ended', function () {
      if (audio.dataset.mode === 'full' && !reached[100]) { reached[100] = true; tell('listen100'); }
    });
  }

  // The opening, free to everyone, with the ask held back until it runs out.
  function preview(gate) {
    var audio = gate.querySelector('[data-listen-audio]');
    if (!audio || audio.dataset.mode) return;

    // Hold the ask back until the opening has run out. Every page with a gate
    // gets this, so none of them have to hide it in their own markup.
    var waiting = gate.querySelector('[data-listen-lock]');
    if (waiting) waiting.hidden = true;

    audio.dataset.mode = 'preview';
    audio.setAttribute('preload', 'metadata');
    audio.setAttribute('src', source(gate.dataset.listen, true));
    audio.hidden = false;
    meter(audio, gate.dataset.listen);

    audio.addEventListener('ended', function () {
      if (audio.dataset.mode !== 'preview') return;
      gate.classList.add('is-preview-over');
      var lock = gate.querySelector('[data-listen-lock]');
      if (!lock) return;
      lock.hidden = false;

      // Keep the icon, change the words: the ask has earned its place now.
      var head = lock.querySelector('.listen-lock-head');
      if (head) {
        var icon = head.querySelector('svg');
        head.textContent = '';
        if (icon) head.appendChild(icon);
        head.appendChild(document.createTextNode(' That was the opening — hear the rest'));
      }

      var email = lock.querySelector('input[type="email"]');
      if (email) email.focus({ preventScroll: true });
    });
  }

  // The pass is in hand: swap in the whole file and carry on where it stopped.
  function full(gate) {
    var audio = gate.querySelector('[data-listen-audio]');
    var lock = gate.querySelector('[data-listen-lock]');
    if (lock) lock.hidden = true;
    gate.classList.remove('is-preview-over');
    if (!audio || audio.dataset.mode === 'full') return;

    var resumeAt = audio.dataset.mode === 'preview' ? audio.currentTime : 0;
    var playing = audio.dataset.mode === 'preview' && !audio.paused;
    if (!audio.dataset.mode) meter(audio, gate.dataset.listen);

    audio.dataset.mode = 'full';
    audio.setAttribute('preload', 'metadata');
    audio.setAttribute('src', source(gate.dataset.listen, false));
    audio.hidden = false;

    if (resumeAt > 1 || playing) {
      var carryOn = function () {
        try { audio.currentTime = resumeAt; } catch (error) { /* some browsers refuse; start over */ }
        audio.play().catch(function () { /* autoplay refused: the controls are right there */ });
      };
      // A cached file can have its metadata before the listener is attached.
      if (audio.readyState >= 1) carryOn();
      else {
        audio.addEventListener('loadedmetadata', function once() {
          audio.removeEventListener('loadedmetadata', once);
          carryOn();
        });
      }
    }
  }

  var previewAll = function () { gates.forEach(preview); };
  var fullAll = function () { gates.forEach(full); };

  // One question for the whole page: has this browser already paid in an email?
  // Until it answers, the opening is already playable.
  previewAll();
  fetch('/api/unlock', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data && data.unlocked) fullAll(); })
    .catch(function () { /* offline or no API: the preview still plays */ });

  gates.forEach(function (gate) {
    var form = gate.querySelector('form');
    if (!form) return;
    var status = gate.querySelector('[data-listen-status]');
    var email = form.querySelector('input[type="email"]');
    var button = form.querySelector('button[type="submit"]');
    var say = function (message, type) {
      if (!status) return;
      status.textContent = message;
      status.dataset.type = type || '';
    };

    email.addEventListener('input', function () { email.removeAttribute('aria-invalid'); });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (form.elements.company_website && form.elements.company_website.value) return;

      if (!email.value.trim() || !email.checkValidity()) {
        email.setAttribute('aria-invalid', 'true');
        say('Please enter a valid email address.', 'error');
        email.focus();
        return;
      }

      button.disabled = true;
      say('Opening the rest…');
      fetch('/api/unlock', {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'Unlock failed.');
          fullAll();
          var field = form.querySelector('input[name="source"]');
          // assets/track.js counts this the same as any other sign-up.
          window.dispatchEvent(new CustomEvent('explain:signup', {
            detail: { source: field ? field.value : 'episode' },
          }));
        })
        .catch(function (error) {
          console.error(error);
          say(error.message || 'Something went wrong. Please try again in a moment.', 'error');
        })
        .finally(function () { button.disabled = false; });
    });
  });
}());
