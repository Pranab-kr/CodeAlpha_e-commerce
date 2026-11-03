import { getCurrentUser, markSessionReady, refreshSession } from './auth.js';
import { loadCart } from './cart.js';
import { el } from './ui.js';

function currentPath() {
  return window.location.pathname === '/' ? '/' : window.location.pathname;
}

function isActive(match) {
  const path = currentPath();
  return match.includes(path);
}

function wordmark() {
  return el('a', { className: 'wordmark', attrs: { href: '/index.html' } }, [
    el('span', { className: 'wordmark-mark', attrs: { 'aria-hidden': 'true' } }),
    el('span', { text: 'Bench Supply' }),
  ]);
}

function cartBadge() {
  return el('span', {
    className: 'cart-badge',
    text: '0',
    attrs: { 'data-cart-badge': '', hidden: true, 'aria-hidden': 'true' },
  });
}

const navItems = [
  { label: 'Catalog', href: '/products.html', match: ['/products.html', '/product.html'] },
  { label: 'Cart', href: '/cart.html', match: ['/cart.html'], cart: true },
  {
    label: 'Sign in',
    href: '/login.html',
    match: ['/login.html', '/register.html', '/account.html'],
    auth: true,
  },
];

function navLinks() {
  return navItems.map((item) => {
    const link = el(
      'a',
      {
        className: `nav-link${item.cart ? ' cart-link' : ''}`,
        attrs: {
          href: item.href,
          ...(item.auth ? { 'data-auth-link': '' } : {}),
        },
      },
      item.cart ? [el('span', { text: item.label }), cartBadge()] : item.label,
    );

    if (!item.auth && isActive(item.match)) link.setAttribute('aria-current', 'page');
    return link;
  });
}

function updateAuthLinks(user) {
  const path = currentPath();

  document.querySelectorAll('[data-auth-link]').forEach((link) => {
    link.textContent = user ? 'Account' : 'Sign in';
    link.setAttribute('href', user ? '/account.html' : '/login.html');

    const active = user
      ? path === '/account.html'
      : path === '/login.html' || path === '/register.html';

    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function initMobileMenu(toggle, menu) {
  const desktop = window.matchMedia('(min-width: 60.0625rem)');
  let lastFocused = null;

  function focusable() {
    return [...menu.querySelectorAll('a[href], button:not([disabled])')];
  }

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusable();
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open() {
    lastFocused = document.activeElement;
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeydown);
    const items = focusable();
    if (items[0]) items[0].focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeydown);
    if (restoreFocus && lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  toggle.addEventListener('click', () => {
    if (menu.hidden) open();
    else close();
  });

  menu.addEventListener('click', (event) => {
    if (event.target.closest('a')) close({ restoreFocus: false });
  });

  desktop.addEventListener('change', (event) => {
    if (event.matches) close({ restoreFocus: false });
  });
}

function renderHeader(host) {
  const toggle = el('button', {
    className: 'menu-toggle key key--small',
    text: 'Menu',
    attrs: {
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'site-menu',
    },
  });

  const menu = el(
    'nav',
    {
      className: 'site-menu',
      attrs: { id: 'site-menu', 'aria-label': 'Mobile menu', hidden: true },
    },
    [el('div', { className: 'container site-menu-inner' }, navLinks())],
  );

  const header = el('header', { className: 'site-header' }, [
    el('div', { className: 'container header-inner' }, [
      wordmark(),
      el('div', { className: 'header-right' }, [
        el('nav', { className: 'header-nav', attrs: { 'aria-label': 'Main' } }, navLinks()),
        toggle,
      ]),
      el('span', {
        className: 'visually-hidden',
        attrs: { 'data-cart-announce': '', 'aria-live': 'polite' },
      }),
    ]),
    menu,
  ]);

  host.append(header);
  initMobileMenu(toggle, menu);
}

function renderFooter(host) {
  const footer = el('footer', { className: 'site-footer' }, [
    el('div', { className: 'container footer-inner' }, [
      el('div', { className: 'footer-brand' }, [
        wordmark(),
        el('p', { className: 'footer-line', text: 'Tools for a working desk.' }),
      ]),
      el('nav', { className: 'footer-nav', attrs: { 'aria-label': 'Footer' } }, [
        el('a', { text: 'Catalog', attrs: { href: '/products.html' } }),
        el('a', { text: 'Cart', attrs: { href: '/cart.html' } }),
        el('a', { text: 'Delivery and returns', attrs: { href: '/index.html#delivery' } }),
      ]),
      el('div', { className: 'footer-meta' }, [
        el('p', { text: 'Demo store. No real payments.' }),
        el('p', { text: 'Express, Postgres, Drizzle, and plain HTML.' }),
        el('p', {
          text: 'Product images are replaceable slots; Cobalt plates stand in for photographs.',
        }),
      ]),
    ]),
  ]);

  host.append(footer);
}

let lastCount = null;

function updateCartBadge(count) {
  document.querySelectorAll('[data-cart-badge]').forEach((badge) => {
    badge.textContent = String(count);
    badge.hidden = count <= 0;
  });

  if (lastCount !== null && lastCount !== count) {
    const live = document.querySelector('[data-cart-announce]');
    if (live) live.textContent = `${count} ${count === 1 ? 'item' : 'items'} in cart.`;
  }

  lastCount = count;
}

export function initLayout() {
  const headerHost = document.getElementById('site-header');
  const footerHost = document.getElementById('site-footer');

  if (headerHost) renderHeader(headerHost);
  if (footerHost) renderFooter(footerHost);

  updateAuthLinks(getCurrentUser());

  window.addEventListener('cart:changed', (event) => {
    updateCartBadge(event.detail?.cart?.itemCount ?? 0);
  });

  window.addEventListener('auth:changed', (event) => {
    updateAuthLinks(event.detail?.user ?? null);
    loadCart({ force: true })
      .then((cart) => updateCartBadge(cart.itemCount))
      .catch(() => {});
  });

  refreshSession({ announce: false })
    .then(() => {
      markSessionReady();
      updateAuthLinks(getCurrentUser());
      return loadCart();
    })
    .then((cart) => updateCartBadge(cart.itemCount))
    .catch(() => {
      markSessionReady();
    });
}

export { updateCartBadge };
