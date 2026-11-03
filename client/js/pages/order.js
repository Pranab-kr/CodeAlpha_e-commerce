import { ApiError, apiGet } from '../api.js';
import { requireAuth } from '../auth.js';
import { formatDate, formatMoney } from '../format.js';
import { initLayout } from '../layout.js';
import { clear, el, renderErrorState } from '../ui.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const params = new URLSearchParams(window.location.search);
const id = (params.get('id') ?? '').trim();
const title = document.querySelector('[data-order-title]');
const line = document.querySelector('[data-order-line]');
const loading = document.querySelector('[data-order-loading]');
const stateHost = document.querySelector('[data-order-state]');
const receipt = document.querySelector('[data-order-receipt]');
const itemsBody = document.querySelector('[data-order-items]');
const addressHost = document.querySelector('[data-order-address]');

function textNode(text) {
  return document.createTextNode(text);
}

function showLoading(message = 'Loading order.') {
  line.textContent = message;
  loading.hidden = false;
  stateHost.hidden = true;
  receipt.hidden = true;
}

function showNotFound() {
  document.title = 'Order not found: Bench Supply';
  title.textContent = 'Order';
  line.textContent = 'The order could not be found.';
  loading.hidden = true;
  receipt.hidden = true;
  stateHost.hidden = false;
  clear(stateHost);

  stateHost.append(
    el('div', { className: 'state-panel cut' }, [
      el('h2', { className: 'state-title', text: 'That order is not here.' }),
      el('p', {
        className: 'state-message',
        text: 'Check the link, or review the orders on your account.',
      }),
      el('div', { className: 'receipt-actions' }, [
        el('a', {
          className: 'key key--primary key--small',
          text: 'Back to account',
          attrs: { href: 'account.html' },
        }),
        el('a', {
          className: 'text-link',
          text: 'Shop the catalog',
          attrs: { href: 'products.html' },
        }),
      ]),
    ]),
  );
}

function showError(error) {
  document.title = 'Order unavailable: Bench Supply';
  title.textContent = 'Order';
  line.textContent = 'The order did not load.';
  loading.hidden = true;
  receipt.hidden = true;
  stateHost.hidden = false;
  renderErrorState(stateHost, {
    title: 'The order did not load.',
    message: error.message || 'Try again.',
    onRetry: load,
  });
}

function renderAddress(shipping) {
  clear(addressHost);
  const lines = [
    shipping.name,
    shipping.address1,
    shipping.address2,
    [shipping.city, shipping.state, shipping.postalCode].filter(Boolean).join(', '),
    shipping.country,
    shipping.email,
  ].filter(Boolean);

  for (const addressLine of lines) {
    addressHost.append(el('p', { text: addressLine }));
  }
}

function renderItems(order) {
  clear(itemsBody);

  for (const item of order.items) {
    itemsBody.append(
      el('tr', {}, [
        el('td', {}, [
          el('a', {
            text: item.productName,
            attrs: { href: `product.html?slug=${encodeURIComponent(item.productSlug)}` },
          }),
        ]),
        el('td', {
          className: 'price-cell',
          text: formatMoney(item.unitPriceCents, order.currency),
        }),
        el('td', { className: 'price-cell', text: String(item.quantity) }),
        el('td', {
          className: 'price-cell',
          text: formatMoney(item.lineTotalCents, order.currency),
        }),
      ]),
    );
  }
}

function renderReceipt(order) {
  document.title = `Order ${order.orderNumber}: Bench Supply`;
  title.textContent = '';
  title.append(
    textNode('Order '),
    el('span', { className: 'order-number', text: order.orderNumber }),
  );
  line.textContent = `Placed ${formatDate(order.createdAt)}.`;
  document.querySelector('[data-order-date]').textContent = formatDate(order.createdAt);
  document.querySelector('[data-order-status]').textContent = order.status;
  document.querySelector('[data-order-payment]').textContent = order.paymentStatus;
  document.querySelector('[data-order-number]').textContent = order.orderNumber;
  document.querySelector('[data-order-subtotal]').textContent = formatMoney(
    order.subtotalCents,
    order.currency,
  );
  document.querySelector('[data-order-shipping]').textContent = formatMoney(
    order.shippingCents,
    order.currency,
  );
  document.querySelector('[data-order-total]').textContent = formatMoney(
    order.totalCents,
    order.currency,
  );

  renderAddress(order.shipping);
  renderItems(order);

  loading.hidden = true;
  stateHost.hidden = true;
  receipt.hidden = false;
}

async function load() {
  if (!UUID_PATTERN.test(id)) {
    showNotFound();
    return;
  }

  showLoading();
  try {
    const payload = await apiGet(`/api/orders/${encodeURIComponent(id)}`);
    renderReceipt(payload.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) showNotFound();
    else showError(error);
  }
}

async function main() {
  initLayout();
  const next = `/order.html?id=${encodeURIComponent(id)}`;
  const user = await requireAuth({ next: id ? next : '/account.html' });
  if (!user) return;

  await load();
}

main();
