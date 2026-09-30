// ExplAIn site behavior: waitlist sign-up, scroll reveals, current-page nav state.

// Sign-up forms POST their fields (email, first_name, interest, source) here.
// '/api/signup' is handled by server/server.js. On static hosting with no server,
// replace it with a form endpoint from your email provider.
const SIGNUP_ENDPOINT = '/api/signup';

document.querySelectorAll('[data-interest]').forEach((link) => {
  link.addEventListener('click', () => {
    const option = document.querySelector(`input[name="interest"][value="${link.dataset.interest}"]`);
    if (option) option.checked = true;
  });
});

document.querySelectorAll('.signup-form').forEach((form) => {
  const status = form.querySelector('.form-status');
  const email = form.querySelector('input[type="email"]');
  const button = form.querySelector('button[type="submit"]');
  const setStatus = (message, type = '') => { status.textContent = message; status.dataset.type = type; };

  email.addEventListener('input', () => email.removeAttribute('aria-invalid'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.elements.company_website.value) return;

    if (!email.value.trim() || !email.checkValidity()) {
      email.setAttribute('aria-invalid', 'true');
      setStatus('Please enter a valid email address.', 'error');
      email.focus();
      return;
    }

    if (!SIGNUP_ENDPOINT) {
      console.warn('ExplAIn: set SIGNUP_ENDPOINT in assets/site.js to enable sign-ups.');
      setStatus('Sign-ups open soon—please check back shortly.', 'error');
      return;
    }

    button.disabled = true;
    setStatus('Signing you up…');
    try {
      const response = await fetch(SIGNUP_ENDPOINT, {
        method: 'POST',
        body: new URLSearchParams(new FormData(form)),
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!response.ok) throw new Error(`Sign-up failed with status ${response.status}`);
      form.reset();
      form.classList.add('is-done');
      setStatus('You’re on the list. We’ll email you when the first cohort opens.', 'success');
    } catch (error) {
      console.error(error);
      setStatus('Something went wrong. Please try again in a moment.', 'error');
    } finally {
      button.disabled = false;
    }
  });
});

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  revealItems.forEach((el) => observer.observe(el));
} else {
  revealItems.forEach((el) => el.classList.add('visible'));
}
