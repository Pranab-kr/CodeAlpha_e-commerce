import { ApiError, apiGet } from '../api.js';
import { addFromButton } from '../cart.js';
import { formatMoney } from '../format.js';
import { initLayout } from '../layout.js';
import { clear, el, productCard, productPlate, renderErrorState, stockLine } from '../ui.js';

const params = new URLSearchParams(window.location.search);
const slug = (params.get('slug') ?? '').trim();
const root = document.querySelector('[data-product-root]');
const stateHost = document.querySelector('[data-product-state]');
const relatedSection = document.querySelector('[data-related-section]');
const relatedGrid = document.querySelector('[data-related]');
const categoryCrumb = document.querySelector('[data-breadcrumb-category]');
const productCrumb = document.querySelector('[data-breadcrumb-product]');

function setBreadcrumb(product) {
  clear(categoryCrumb);
  categoryCrumb.append(
    el('a', {
      text: product.category.name,
      attrs: { href: `products.html?category=${encodeURIComponent(product.category.slug)}` },
    }),
  );
  productCrumb.textContent = product.name;
}

function createStepper(max) {
  const minus = el('button', {
    text: '-',
    attrs: { type: 'button', 'aria-label': 'Decrease quantity' },
  });
  const input = el('input', {
    attrs: {
      id: 'product-quantity',
      type: 'number',
      min: '1',
      max: String(Math.max(1, max)),
      value: '1',
      inputmode: 'numeric',
    },
  });
  const plus = el('button', {
    text: '+',
    attrs: { type: 'button', 'aria-label': 'Increase quantity' },
  });
  const wrapper = el('div', { className: 'stepper' }, [minus, input, plus]);

  function readValue() {
    const parsed = Number.parseInt(input.value, 10);
    return Number.isFinite(parsed) ? parsed : 1;
  }

  function clamp() {
    const value = Math.min(Math.max(readValue(), 1), Math.max(1, max));
    input.value = String(value);
    minus.disabled = max === 0 || value <= 1;
    plus.disabled = max === 0 || value >= max;
    input.disabled = max === 0;
  }

  minus.addEventListener('click', () => {
    input.value = String(Math.max(1, readValue() - 1));
    clamp();
  });
  plus.addEventListener('click', () => {
    input.value = String(Math.min(max, readValue() + 1));
    clamp();
  });
  input.addEventListener('change', clamp);
  clamp();

  return {
    wrapper,
    getQuantity: () => Math.min(Math.max(readValue(), 1), Math.max(1, max)),
  };
}

function specsTable(specs) {
  const table = el('table', { className: 'specs' }, [
    el('caption', { className: 'visually-hidden', text: 'Specifications' }),
  ]);
  const body = el('tbody');

  for (const spec of specs) {
    body.append(
      el('tr', {}, [
        el('th', { text: spec.label, attrs: { scope: 'row' } }),
        el('td', { text: spec.value }),
      ]),
    );
  }

  table.append(body);
  return table;
}

function renderProduct(product) {
  document.title = `${product.name}: Bench Supply`;
  categoryCrumb.hidden = false;
  productCrumb.hidden = false;
  setBreadcrumb(product);
  stateHost.hidden = true;
  root.hidden = false;
  clear(root);

  const visual = el('div', { className: 'product-visual' }, [
    productPlate(product, { size: 'large' }),
  ]);

  const stepper = createStepper(product.stock);
  const quantityField = el('div', { className: 'field' }, [
    el('label', { text: 'Quantity', attrs: { for: 'product-quantity' } }),
    stepper.wrapper,
  ]);

  const addButton = el('button', {
    className: 'key key--primary',
    text: product.stock <= 0 ? 'Out of stock' : 'Add to cart',
    attrs: {
      type: 'button',
      ...(product.stock <= 0 ? { disabled: true } : {}),
    },
  });

  if (product.stock > 0) {
    addButton.addEventListener('click', () =>
      addFromButton(product, addButton, stepper.getQuantity()),
    );
  }

  const info = el('div', { className: 'product-info' }, [
    el('span', { className: 'product-category', text: product.category.name }),
    el('h1', { text: product.name }),
    el('span', {
      className: 'product-price',
      text: formatMoney(product.priceCents, product.currency),
    }),
    el('p', { className: 'product-description', text: product.description }),
    stockLine(product.stock),
    el('div', { className: 'quantity-row' }, [quantityField, addButton]),
    el('div', { className: 'product-facts' }, [
      el('p', { text: 'Ships in 1-2 business days.' }),
      el('p', { text: '30-day returns on unused gear.' }),
    ]),
  ]);

  if (product.specs.length > 0) info.append(specsTable(product.specs));

  root.append(el('div', { className: 'product-layout' }, [visual, info]));

  if (product.related.length > 0) {
    clear(relatedGrid);
    for (const related of product.related) {
      relatedGrid.append(productCard(related, { onAdd: addFromButton }));
    }
    relatedSection.hidden = false;
  } else {
    relatedSection.hidden = true;
  }
}

function showNotFound() {
  document.title = 'Product not found: Bench Supply';
  categoryCrumb.hidden = true;
  productCrumb.hidden = true;
  root.hidden = true;
  stateHost.hidden = false;
  clear(stateHost);
  stateHost.append(
    el('div', { className: 'state-panel cut' }, [
      el('h1', { className: 'state-title', text: 'That product is not here.' }),
      el('p', {
        className: 'state-message',
        text: 'Check the address, or browse the catalog.',
      }),
      el('a', {
        className: 'key key--primary state-action',
        text: 'Back to the catalog',
        attrs: { href: 'products.html' },
      }),
    ]),
  );
}

function showError(error) {
  document.title = 'Product unavailable: Bench Supply';
  categoryCrumb.hidden = true;
  productCrumb.hidden = true;
  root.hidden = true;
  stateHost.hidden = false;
  renderErrorState(stateHost, {
    title: 'The product did not load.',
    message: error.message || 'Try again.',
    onRetry: loadProduct,
  });
}

async function loadProduct() {
  if (!slug) {
    showNotFound();
    return;
  }

  root.hidden = false;
  stateHost.hidden = true;
  relatedSection.hidden = true;
  root.setAttribute('aria-busy', 'true');

  try {
    const payload = await apiGet(`/api/products/${encodeURIComponent(slug)}`);
    renderProduct(payload.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) showNotFound();
    else showError(error);
  } finally {
    root.setAttribute('aria-busy', 'false');
  }
}

initLayout();
loadProduct();
