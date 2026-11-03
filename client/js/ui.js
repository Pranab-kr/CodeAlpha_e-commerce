import { formatMoney, stockText } from './format.js';

export function el(tag, options = {}, children = []) {
  const node = document.createElement(tag);

  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) {
      if (value === undefined || value === null || value === false) continue;
      node.setAttribute(name, value === true ? '' : String(value));
    }
  }
  if (options.dataset) Object.assign(node.dataset, options.dataset);

  for (const child of [].concat(children)) {
    if (child !== null && child !== undefined) node.append(child);
  }

  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

let toastRegion = null;
let toastTimer = null;

export function showToast(message) {
  if (!toastRegion) {
    toastRegion = el('div', {
      className: 'toast-region',
      attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' },
    });
    document.body.append(toastRegion);
  }

  clearTimeout(toastTimer);
  clear(toastRegion);

  const toast = el('div', { className: 'toast' }, [
    el('p', { className: 'toast-message', text: message }),
    el('button', {
      className: 'toast-dismiss',
      text: 'Dismiss',
      attrs: { type: 'button' },
    }),
  ]);

  toast.querySelector('.toast-dismiss').addEventListener('click', () => {
    clear(toastRegion);
  });

  toastRegion.append(toast);
  toastTimer = setTimeout(() => clear(toastRegion), 6000);
}

export function announce(message) {
  let region = document.querySelector('[data-announce]');
  if (!region) {
    region = el('span', {
      className: 'visually-hidden',
      attrs: { 'aria-live': 'polite' },
      dataset: { announce: '' },
    });
    document.body.append(region);
  }
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

function skuFor(slug) {
  return `BS-${slug.replaceAll('-', ' ').toUpperCase()}`;
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function glyphField(product, rows) {
  const ramp = ' .:-=+*#%@';
  let seed = hashString(`${product.slug}:${product.stock ?? 0}`);
  const cols = 46;
  const lines = [];

  for (let row = 0; row < rows; row += 1) {
    let line = '';
    for (let col = 0; col < cols; col += 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const value = (seed >>> 16) % 100;
      const bias = product.stock === 0 ? 12 : Math.min(70, 20 + product.stock);
      const index = Math.max(
        0,
        Math.min(ramp.length - 1, Math.round(((value + bias) / 170) * (ramp.length - 1))),
      );
      line += ramp[index];
    }
    lines.push(line);
  }

  return lines.join('\n');
}

export function productPlate(product, { size = 'card' } = {}) {
  const plate = el('div', {
    className: `plate plate--${size}`,
    attrs: { 'aria-hidden': 'true' },
  });

  plate.append(
    el('pre', {
      className: 'plate-glyphs',
      text: glyphField(product, size === 'large' ? 20 : 10),
    }),
  );

  plate.append(
    el('div', { className: 'plate-content' }, [
      el('span', { className: 'plate-category', text: product.category?.name ?? 'Bench Supply' }),
      el('span', { className: 'plate-sku', text: skuFor(product.slug) }),
      el('span', { className: 'plate-name', text: product.name }),
    ]),
  );

  return plate;
}

export function stockLine(stock) {
  return el('span', { className: 'stock' }, [
    el('span', { className: 'stock-square', attrs: { 'aria-hidden': 'true' } }),
    el('span', { text: stockText(stock) }),
  ]);
}

export function productCard(product, { onAdd = null, addLabel = 'Add to cart' } = {}) {
  const card = el('article', { className: 'product-card' });

  card.append(productPlate(product, { size: 'card' }));

  const title = el('a', {
    className: 'card-name',
    text: product.name,
    attrs: { href: `/product.html?slug=${encodeURIComponent(product.slug)}` },
  });

  card.append(
    el('div', { className: 'card-body' }, [
      el('span', { className: 'card-category', text: product.category?.name ?? 'Bench Supply' }),
      title,
      el('div', { className: 'card-meta' }, [
        el('span', { className: 'price', text: formatMoney(product.priceCents, product.currency) }),
        stockLine(product.stock),
      ]),
    ]),
  );

  const disabled = product.stock <= 0 || !onAdd;
  const button = el('button', {
    className: 'key key--small key--block card-add',
    text: product.stock <= 0 ? 'Out of stock' : addLabel,
    attrs: {
      type: 'button',
      disabled,
      'aria-label':
        product.stock <= 0 ? `${product.name} is out of stock` : `Add ${product.name} to cart`,
    },
  });

  if (onAdd && product.stock > 0) {
    button.addEventListener('click', () => onAdd(product, button));
  }

  card.append(button);
  return card;
}

export function renderSkeletonCards(container, count = 4) {
  clear(container);
  for (let i = 0; i < count; i += 1) {
    container.append(
      el('div', { className: 'skeleton-card', attrs: { 'aria-hidden': 'true' } }, [
        el('div', { className: 'skeleton-plate' }),
        el('div', { className: 'skeleton-line skeleton-line--short' }),
        el('div', { className: 'skeleton-line' }),
        el('div', { className: 'skeleton-line skeleton-line--medium' }),
      ]),
    );
  }
}

export function renderSkeletonRows(container, count = 4) {
  clear(container);
  for (let i = 0; i < count; i += 1) {
    container.append(
      el('div', { className: 'skeleton-row', attrs: { 'aria-hidden': 'true' } }, [
        el('div', { className: 'skeleton-line skeleton-line--medium' }),
        el('div', { className: 'skeleton-line' }),
      ]),
    );
  }
}

export function renderEmptyState(container, { title, message, actionLabel, actionHref, onAction }) {
  clear(container);
  const panel = el('div', { className: 'state-panel cut' }, [
    el('h2', { className: 'state-title', text: title }),
    el('p', { className: 'state-message', text: message }),
  ]);

  if (actionLabel && typeof actionHref === 'string') {
    panel.append(
      el('a', {
        className: 'key key--small state-action',
        text: actionLabel,
        attrs: { href: actionHref },
      }),
    );
  } else if (actionLabel && onAction) {
    const button = el('button', {
      className: 'key key--small state-action',
      text: actionLabel,
      attrs: { type: 'button' },
    });
    button.addEventListener('click', onAction);
    panel.append(button);
  }

  container.append(panel);
}

export function renderErrorState(container, { title, message, onRetry }) {
  clear(container);
  const panel = el('div', { className: 'state-panel cut', attrs: { role: 'alert' } }, [
    el('h2', { className: 'state-title', text: title }),
    el('p', { className: 'state-message', text: message }),
  ]);

  if (onRetry) {
    const button = el('button', {
      className: 'key key--small state-action',
      text: 'Try again',
      attrs: { type: 'button' },
    });
    button.addEventListener('click', onRetry);
    panel.append(button);
  }

  container.append(panel);
}
