import { ApiError, apiFetch } from '../api.js';
import { requireAuth } from '../auth.js';
import { loadCart } from '../cart.js';
import { formatMoney, itemCountText } from '../format.js';
import { initLayout } from '../layout.js';
import {
  clear,
  clearFormErrors,
  el,
  focusFirstInvalid,
  renderErrorState,
  renderSkeletonRows,
  showFieldError,
  showFormError,
} from '../ui.js';

const form = document.querySelector('[data-checkout-form]');
const submit = document.querySelector('[data-submit]');
const content = document.querySelector('[data-checkout-content]');
const stateHost = document.querySelector('[data-checkout-state]');
const pageLine = document.querySelector('[data-checkout-line]');
const itemsHost = document.querySelector('[data-checkout-items]');
const stockError = document.querySelector('[data-stock-error]');

let attemptKey = null;
let submitting = false;

function fieldErrors(details) {
  let handled = false;

  for (const detail of details) {
    const field = String(detail.path ?? '')
      .split('.')
      .pop();
    const target = field ? form.elements.namedItem(field) : null;
    if (field && target) {
      showFieldError(form, field, detail.message);
      handled = true;
    }
  }

  if (handled) focusFirstInvalid(form);
  else showFormError(form, details[0]?.message ?? 'Check the highlighted fields.');
}

function renderStockError(details) {
  stockError.hidden = false;
  clear(stockError);
  stockError.append(el('p', { text: 'Some items are no longer available in that quantity.' }));

  const list = el('ul');
  for (const detail of details) {
    list.append(
      el('li', {
        text: `${detail.name}: requested ${detail.requested}, available ${detail.available}.`,
      }),
    );
  }

  stockError.append(
    list,
    el('a', { className: 'text-link', text: 'Back to cart', attrs: { href: 'cart.html' } }),
  );
}

function renderSummary(cart) {
  clear(itemsHost);
  for (const item of cart.items) {
    itemsHost.append(
      el('div', { className: 'checkout-item' }, [
        el('div', {}, [
          el('p', { className: 'checkout-item-name', text: item.name }),
          el('p', {
            className: 'checkout-item-meta',
            text: `${item.quantity} × ${formatMoney(item.unitPriceCents, cart.currency)}`,
          }),
        ]),
        el('span', {
          className: 'checkout-item-total',
          text: formatMoney(item.lineTotalCents, cart.currency),
        }),
      ]),
    );
  }

  document.querySelector('[data-summary-subtotal]').textContent = formatMoney(
    cart.subtotalCents,
    cart.currency,
  );
  document.querySelector('[data-summary-shipping]').textContent = formatMoney(
    cart.shippingCents,
    cart.currency,
  );
  document.querySelector('[data-summary-total]').textContent = formatMoney(
    cart.totalCents,
    cart.currency,
  );
}

function prefill(user) {
  const name = form.elements.namedItem('name');
  const email = form.elements.namedItem('email');
  if (name && !name.value) name.value = user.name ?? '';
  if (email && !email.value) email.value = user.email ?? '';
}

function readShipping() {
  const data = new FormData(form);
  const values = {};

  for (const field of [
    'name',
    'email',
    'address1',
    'address2',
    'city',
    'state',
    'postalCode',
    'country',
  ]) {
    values[field] = String(data.get(field) ?? '').trim();
  }

  return values;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting) return;

  clearFormErrors(form);
  stockError.hidden = true;
  clear(stockError);
  submitting = true;
  submit.disabled = true;
  submit.textContent = 'Placing order…';

  try {
    const fresh = await loadCart({ force: true });
    if (!fresh || fresh.items.length === 0) {
      window.location.assign('/cart.html');
      return;
    }
    renderSummary(fresh);

    if (!attemptKey) attemptKey = crypto.randomUUID();

    const payload = await apiFetch('/api/orders', {
      method: 'POST',
      body: { shipping: readShipping(), paymentMethod: 'mock' },
      headers: { 'Idempotency-Key': attemptKey },
    });

    attemptKey = null;
    window.location.assign(`/order.html?id=${encodeURIComponent(payload.data.id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      window.location.assign('/login.html?next=%2Fcheckout.html');
      return;
    }

    if (error instanceof ApiError && error.code === 'CART_EMPTY') {
      window.location.assign('/cart.html');
      return;
    }

    if (error instanceof ApiError && error.code === 'INSUFFICIENT_STOCK') {
      renderStockError(Array.isArray(error.details) ? error.details : []);
      return;
    }

    if (
      error instanceof ApiError &&
      error.code === 'VALIDATION_ERROR' &&
      Array.isArray(error.details) &&
      error.details.length > 0
    ) {
      fieldErrors(error.details);
      return;
    }

    showFormError(form, error.message || 'The order could not be placed. Try again.');
  } finally {
    submitting = false;
    submit.disabled = false;
    submit.textContent = 'Place order';
  }
});

async function load() {
  stateHost.hidden = false;
  stateHost.setAttribute('aria-busy', 'true');
  content.hidden = true;
  pageLine.textContent = 'Loading your cart.';
  renderSkeletonRows(stateHost, 2);

  try {
    const cart = await loadCart({ force: true });
    if (!cart || cart.items.length === 0) {
      window.location.replace('/cart.html');
      return;
    }

    renderSummary(cart);
    pageLine.textContent = itemCountText(cart.itemCount);
    stateHost.hidden = true;
    stateHost.setAttribute('aria-busy', 'false');
    content.hidden = false;
  } catch (error) {
    pageLine.textContent = 'The cart did not load.';
    renderErrorState(stateHost, {
      title: 'Checkout did not load.',
      message: error.message || 'Try again.',
      onRetry: load,
    });
  }
}

async function main() {
  initLayout();
  const user = await requireAuth({ next: '/checkout.html' });
  if (!user) return;

  prefill(user);
  await load();
}

main();
