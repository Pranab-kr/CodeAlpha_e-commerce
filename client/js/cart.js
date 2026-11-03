import { apiDelete, apiGet, apiPatch, apiPost } from './api.js';
import { showToast } from './ui.js';

let cart = null;
let inFlight = null;

function emit() {
  window.dispatchEvent(new CustomEvent('cart:changed', { detail: { cart } }));
}

export async function loadCart({ force = false } = {}) {
  if (cart && !force) return cart;
  if (inFlight && !force) return inFlight;

  inFlight = apiGet('/api/cart')
    .then((payload) => {
      cart = payload.data;
      return cart;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export function getCachedCart() {
  return cart;
}

export async function addItem(productId, quantity = 1) {
  const payload = await apiPost('/api/cart/items', { productId, quantity });
  cart = payload.data;
  emit();
  return cart;
}

export async function updateItem(productId, quantity) {
  const payload = await apiPatch(`/api/cart/items/${encodeURIComponent(productId)}`, {
    quantity,
  });
  cart = payload.data;
  emit();
  return cart;
}

export async function removeItem(productId) {
  const payload = await apiDelete(`/api/cart/items/${encodeURIComponent(productId)}`);
  cart = payload.data;
  emit();
  return cart;
}

export async function clearCart() {
  await apiDelete('/api/cart');
  const payload = await apiGet('/api/cart');
  cart = payload.data;
  emit();
  return cart;
}

export async function addFromButton(product, button, quantity = 1) {
  if (!button || button.disabled) return;

  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Adding…';

  try {
    await addItem(product.id, quantity);
    showToast(`${product.name} added to cart.`);
  } catch (error) {
    showToast(error.message || 'That item could not be added.');
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}
