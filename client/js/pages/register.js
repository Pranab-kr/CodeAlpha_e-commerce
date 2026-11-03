import { ApiError } from '../api.js';
import { getCurrentUser, refreshSession, signUp } from '../auth.js';
import { sanitizeNext } from '../format.js';
import { initLayout } from '../layout.js';
import { clearFormErrors, focusFirstInvalid, showFieldError, showFormError } from '../ui.js';

const form = document.querySelector('[data-auth-form]');
const submit = document.querySelector('[data-submit]');
const loginLink = document.querySelector('[data-login-link]');
const params = new URLSearchParams(window.location.search);
const rawNext = params.get('next');
const next = sanitizeNext(rawNext);

if (rawNext) {
  loginLink.href = `login.html?next=${encodeURIComponent(sanitizeNext(rawNext))}`;
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
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const label = submit.textContent;

  submit.disabled = true;
  submit.textContent = 'Creating account…';

  try {
    await signUp(name, email, password);
    window.location.assign(next);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CONFLICT') {
      showFieldError(form, 'email', error.message);
      focusFirstInvalid(form);
    } else if (
      error instanceof ApiError &&
      Array.isArray(error.details) &&
      error.details.length > 0
    ) {
      fieldErrors(error.details);
    } else {
      showFormError(form, error.message || 'The account could not be created. Try again.');
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
