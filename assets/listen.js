// The free episode asks for an email before it plays.
//
// Markup contract, anywhere on the site:
//   <div class="listen" data-listen="00-how-we-got-here"> … </div>
// with a [data-listen-lock] panel holding a form, and a [data-listen-audio]
// player that stays empty until the pass is in hand. The audio src is only
// ever set after the server says so: the file has no public URL.
(function () {
  var gates = document.querySelectorAll('[data-listen]');
  if (!gates.length) return;

  function open(gate) {
    var audio = gate.querySelector('[data-listen-audio]');
    var lock = gate.querySelector('[data-listen-lock]');
    if (lock) lock.hidden = true;
    if (!audio) return;
    if (!audio.getAttribute('src')) {
      audio.setAttribute('src', '/api/episode?ep=' + encodeURIComponent(gate.dataset.listen));
    }
    audio.hidden = false;
  }

  function openAll() { gates.forEach(open); }

  // One question for the whole page: has this browser already paid in an email?
  fetch('/api/unlock', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) { if (data && data.unlocked) openAll(); })
    .catch(function () { /* offline or no API: the form is still there */ });

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
      say('Opening the episode…');
      fetch('/api/unlock', {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'Unlock failed.');
          openAll();
          var source = form.querySelector('input[name="source"]');
          // assets/track.js counts this the same as any other sign-up.
          window.dispatchEvent(new CustomEvent('explain:signup', {
            detail: { source: source ? source.value : 'episode' },
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
