import { ApiError } from '../api.js';
import { getCurrentUser, refreshSession, signIn } from '../auth.js';
import { sanitizeNext } from '../format.js';
import { initLayout } from '../layout.js';
import { clearFormErrors, focusFirstInvalid, showFieldError, showFormError } from '../ui.js';

const form = document.querySelector('[data-auth-form]');
const submit = document.querySelector('[data-submit]');
const registerLink = document.querySelector('[data-register-link]');
const params = new URLSearchParams(window.location.search);
const rawNext = params.get('next');
const next = sanitizeNext(rawNext);

if (rawNext) {
  registerLink.href = `register.html?next=${encodeURIComponent(sanitizeNext(rawNext))}`;
}

function fieldErrors(details) {
  for (const detail of details) {
    const field = String(detail.path ?? '')
      .split('.')
      .pop();
    if (field) showFieldError(form, field, detail.message);
  }
  focusFirstInvalid(form);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormErrors(form);

  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const label = submit.textContent;

  submit.disabled = true;
  submit.textContent = 'Signing in…';

  try {
    await signIn(email, password);
    window.location.assign(next);
  } catch (error) {
    if (error instanceof ApiError && Array.isArray(error.details) && error.details.length > 0) {
      fieldErrors(error.details);
    } else {
      showFormError(form, error.message || 'Sign in failed. Try again.');
    }
  } finally {
    submit.disabled = false;
    submit.textContent = label;
  }
});

initLayout();
refreshSession().then((restored) => {
  if (restored && getCurrentUser()) window.location.replace(next);
});
