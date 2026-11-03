import { apiGet } from '../api.js';
import {
  addFromButton,
  clearCart,
  getCachedCart,
  loadCart,
  removeItem,
  updateItem,
} from '../cart.js';
import { formatPrice } from '../currency.js';
import { itemCountText } from '../format.js';
import { initLayout } from '../layout.js';
import {
  clear,
  el,
  productCard,
  productPlate,
  renderEmptyState,
  renderErrorState,
  renderSkeletonRows,
  showToast,
} from '../ui.js';

const linesHost = document.querySelector('[data-cart-lines]');
const summary = document.querySelector('[data-cart-summary]');
const pageLine = document.querySelector('[data-cart-line]');
const clearButton = document.querySelector('[data-clear-cart]');
const emptySection = document.querySelector('[data-empty-featured]');
const emptyProducts = document.querySelector('[data-empty-products]');

let busyProductId = null;
let clearing = false;
let emptyFeaturedLoaded = false;

function createControls(item) {
  const busy = busyProductId === item.productId || clearing;

  const minus = el('button', {
    text: '-',
    attrs: {
      type: 'button',
      'aria-label': `Decrease ${item.name} quantity`,
      disabled: busy || item.quantity <= 1,
    },
  });
  const input = el('input', {
    attrs: {
      type: 'number',
      min: '1',
      max: String(Math.max(1, item.stock)),
      value: String(item.quantity),
      inputmode: 'numeric',
      'aria-label': `Quantity for ${item.name}`,
      disabled: busy || item.stock === 0,
    },
  });
  const plus = el('button', {
    text: '+',
    attrs: {
      type: 'button',
      'aria-label': `Increase ${item.name} quantity`,
      disabled: busy || item.quantity >= item.stock,
    },
  });

  minus.addEventListener('click', () => changeQuantity(item.productId, item.quantity - 1));
  plus.addEventListener('click', () => changeQuantity(item.productId, item.quantity + 1));
  input.addEventListener('change', () => {
    const parsed = Number.parseInt(input.value, 10);
    const value = Math.min(
      Math.max(Number.isFinite(parsed) ? parsed : item.quantity, 1),
      Math.max(1, item.stock),
    );

    if (value !== item.quantity) changeQuantity(item.productId, value);
    else input.value = String(item.quantity);
  });

  const remove = el('button', {
    className: 'remove-link',
    text: 'Remove',
    attrs: { type: 'button', disabled: busy },
  });
  remove.addEventListener('click', () => removeLine(item.productId));

  return el('div', { className: 'cart-line-controls' }, [
    el('div', { className: 'stepper' }, [minus, input, plus]),
    remove,
  ]);
}

function cartLine(item, cart) {
  const busy = busyProductId === item.productId || clearing;

  const main = el('div', { className: 'cart-line-main' }, [
    el('a', {
      className: 'cart-line-name',
      text: item.name,
      attrs: { href: `product.html?slug=${encodeURIComponent(item.slug)}` },
    }),
    el('span', { className: 'cart-line-category', text: item.category.name }),
    el('span', {
      className: 'cart-line-unit',
      text: `${formatPrice(item.unitPriceCents, cart.currency)} each`,
    }),
    createControls(item),
  ]);

  if (item.stock === 0) {
    main.append(
      el('span', {
        className: 'cart-line-note',
        text: 'Out of stock. Remove this line to check out.',
      }),
    );
  } else if (item.quantity > item.stock) {
    main.append(el('span', { className: 'cart-line-note', text: `Only ${item.stock} in stock.` }));
  }

  return el(
    'div',
    {
      className: `cart-line${busy ? ' is-updating' : ''}`,
      attrs: { 'aria-busy': busy ? 'true' : 'false' },
    },
    [
      productPlate(
        {
          name: item.name,
          slug: item.slug,
          stock: item.stock,
          imageUrl: item.imageUrl,
          category: item.category,
        },
        { size: 'card' },
      ),
      main,
      el('span', {
        className: 'cart-line-total',
        text: formatPrice(item.lineTotalCents, cart.currency),
      }),
    ],
  );
}

function renderSummary(cart) {
  summary.hidden = false;

  const subtotal = document.querySelector('[data-summary-subtotal]');
  const shipping = document.querySelector('[data-summary-shipping]');
  const total = document.querySelector('[data-summary-total]');

  subtotal.textContent = formatPrice(cart.subtotalCents, cart.currency);
  shipping.textContent = formatPrice(cart.shippingCents, cart.currency);
  total.textContent = formatPrice(cart.totalCents, cart.currency);

  const note = document.querySelector('[data-free-shipping-note]');
  if (note) {
    note.textContent = `Free shipping at ${formatPrice(10000, 'USD')}. Checkout is a demo; no payment is taken.`;
  }
}

function hideEmptyFeatured() {
  emptySection.hidden = true;
}

async function showEmptyFeatured() {
  emptySection.hidden = false;
  if (emptyFeaturedLoaded) return;

  try {
    const payload = await apiGet('/api/products?sort=featured&limit=3');
    clear(emptyProducts);
    for (const product of payload.data) {
      emptyProducts.append(productCard(product, { onAdd: addFromButton }));
    }
    emptyFeaturedLoaded = true;
  } catch {
    emptySection.hidden = true;
  }
}

function renderCart(cart) {
  if (!cart) return;

  pageLine.textContent = itemCountText(cart.itemCount);
  linesHost.setAttribute('aria-busy', 'false');

  if (cart.items.length === 0) {
    renderEmptyState(linesHost, {
      title: 'Your cart is empty.',
      message: 'Add a tool from the catalog to start.',
      actionLabel: 'Shop the catalog',
      actionHref: 'products.html',
    });
    summary.hidden = true;
    clearButton.hidden = true;
    showEmptyFeatured();
    return;
  }

  summary.hidden = false;
  clearButton.hidden = false;
  clearButton.disabled = clearing || busyProductId !== null;

  renderSummary(cart);
  clear(linesHost);
  for (const item of cart.items) linesHost.append(cartLine(item, cart));

  hideEmptyFeatured();
}

async function changeQuantity(productId, quantity) {
  if (busyProductId || clearing) return;

  busyProductId = productId;
  renderCart(getCachedCart());

  try {
    await updateItem(productId, quantity);
  } catch (error) {
    showToast(error.message || 'The quantity could not be updated.');
  } finally {
    busyProductId = null;
    renderCart(getCachedCart());
  }
}

async function removeLine(productId) {
  if (busyProductId || clearing) return;

  busyProductId = productId;
  renderCart(getCachedCart());

  try {
    await removeItem(productId);
  } catch (error) {
    showToast(error.message || 'That line could not be removed.');
  } finally {
    busyProductId = null;
    renderCart(getCachedCart());
  }
}

async function handleClearCart() {
  if (clearing || busyProductId) return;

  clearing = true;
  renderCart(getCachedCart());

  try {
    await clearCart();
  } catch (error) {
    showToast(error.message || 'The cart could not be cleared.');
  } finally {
    clearing = false;
    renderCart(getCachedCart());
  }
}

function showLoading() {
  linesHost.setAttribute('aria-busy', 'true');
  renderSkeletonRows(linesHost, 3);
  pageLine.textContent = 'Loading cart.';
  summary.hidden = true;
  clearButton.hidden = true;
  emptySection.hidden = true;
}

function showError(error) {
  renderErrorState(linesHost, {
    title: 'The cart did not load.',
    message: error.message || 'Try again.',
    onRetry: () => loadCartPage({ force: true }),
  });
  pageLine.textContent = 'The cart did not load.';
  summary.hidden = true;
  clearButton.hidden = true;
  emptySection.hidden = true;
}

async function loadCartPage({ force = false } = {}) {
  showLoading();
  try {
    renderCart(await loadCart({ force }));
  } catch (error) {
    showError(error);
  }
}

clearButton.addEventListener('click', handleClearCart);

window.addEventListener('cart:changed', (event) => renderCart(event.detail.cart));
window.addEventListener('currency:changed', () => renderCart(getCachedCart()));

initLayout();
loadCartPage();
