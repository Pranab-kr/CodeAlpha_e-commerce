import { apiGet } from '../api.js';
import { requireAuth, signOut } from '../auth.js';
import { formatDate, formatMoney } from '../format.js';
import { initLayout } from '../layout.js';
import { clear, el, renderEmptyState, renderErrorState, renderSkeletonRows } from '../ui.js';

const nameHost = document.querySelector('[data-account-name]');
const emailHost = document.querySelector('[data-account-email]');
const line = document.querySelector('[data-account-line]');
const ordersHost = document.querySelector('[data-orders]');
const logoutButton = document.querySelector('[data-logout]');

function renderOrderTable(orders) {
  clear(ordersHost);

  const scroll = el('div', {
    className: 'table-scroll',
    attrs: { tabindex: '0', role: 'region', 'aria-label': 'Order history' },
  });

  const table = el('table', { className: 'order-table' }, [
    el('thead', {}, [
      el('tr', {}, [
        el('th', { text: 'Order', attrs: { scope: 'col' } }),
        el('th', { text: 'Date', attrs: { scope: 'col' } }),
        el('th', { text: 'Status', attrs: { scope: 'col' } }),
        el('th', { text: 'Total', attrs: { scope: 'col' } }),
        el('th', { text: '', attrs: { scope: 'col' } }),
      ]),
    ]),
  ]);

  const body = el('tbody');
  for (const order of orders) {
    body.append(
      el('tr', {}, [
        el('td', { className: 'order-number', text: order.orderNumber }),
        el('td', { text: formatDate(order.createdAt) }),
        el('td', { text: order.status }),
        el('td', {
          className: 'price-cell',
          text: formatMoney(order.totalCents, order.currency),
        }),
        el('td', {}, [
          el('a', {
            text: 'View order',
            attrs: { href: `order.html?id=${encodeURIComponent(order.id)}` },
          }),
        ]),
      ]),
    );
  }

  table.append(body);
  scroll.append(table);
  ordersHost.append(scroll);
}

async function loadOrders() {
  ordersHost.setAttribute('aria-busy', 'true');
  renderSkeletonRows(ordersHost, 3);

  try {
    const payload = await apiGet('/api/orders?limit=10');

    if (payload.data.length === 0) {
      renderEmptyState(ordersHost, {
        title: 'No orders yet.',
        message: 'Your order history will appear here after checkout.',
        actionLabel: 'Shop the catalog',
        actionHref: 'products.html',
      });
    } else {
      renderOrderTable(payload.data);
    }
  } catch (error) {
    renderErrorState(ordersHost, {
      title: 'Your orders did not load.',
      message: error.message || 'Try again.',
      onRetry: loadOrders,
    });
  } finally {
    ordersHost.setAttribute('aria-busy', 'false');
  }
}

function renderAccount(user) {
  document.title = 'Account: Bench Supply';
  nameHost.textContent = user.name;
  emailHost.textContent = user.email;
  line.textContent = 'Your cart and orders follow this account.';
  loadOrders();
}

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Signing out…';
  await signOut();
  window.location.assign('/index.html');
});

async function main() {
  initLayout();
  const user = await requireAuth({ next: '/account.html' });
  if (user) renderAccount(user);
}

main();
