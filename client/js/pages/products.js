import { apiGet } from '../api.js';
import { addFromButton } from '../cart.js';
import { initLayout } from '../layout.js';
import {
  clear,
  el,
  productCard,
  renderEmptyState,
  renderErrorState,
  renderSkeletonCards,
  showToast,
} from '../ui.js';

const SORTS = new Set(['featured', 'newest', 'price_asc', 'price_desc', 'name']);
const PAGE_SIZE = 9;

const form = document.querySelector('[data-filter-form]');
const searchInput = document.querySelector('#search');
const categorySelect = document.querySelector('#category');
const sortSelect = document.querySelector('#sort');
const clearButton = document.querySelector('[data-clear-filters]');
const grid = document.querySelector('[data-products]');
const pagination = document.querySelector('[data-pagination]');
const resultLine = document.querySelector('[data-result-line]');
const pageCount = document.querySelector('[data-page-count]');

const state = readUrl();
let requestId = 0;
let searchTimer = null;

function readUrl() {
  const params = new URLSearchParams(window.location.search);
  const sort = params.get('sort');
  const page = Number.parseInt(params.get('page') ?? '1', 10);

  return {
    search: (params.get('search') ?? '').trim(),
    category: (params.get('category') ?? '').trim(),
    sort: SORTS.has(sort) ? sort : 'featured',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function syncControls() {
  searchInput.value = state.search;
  sortSelect.value = state.sort;
  categorySelect.value = state.category;
}

function syncUrl(mode = 'push') {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);
  if (state.sort !== 'featured') params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));

  const query = params.toString();
  const url = query ? `${window.location.pathname}?${query}` : window.location.pathname;
  window.history[`${mode}State`]({}, '', url);
}

function paginationPages(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = [...new Set([1, total, current - 1, current, current + 1])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);

  return pages;
}

function scrollToTop() {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
}

function goToPage(page) {
  state.page = page;
  syncUrl();
  scrollToTop();
  loadProducts();
}

function renderPagination({ page, totalPages }) {
  clear(pagination);
  pagination.hidden = totalPages <= 1;
  if (pagination.hidden) return;

  const previous = el('button', {
    className: 'key key--small',
    text: 'Previous',
    attrs: { type: 'button', disabled: page <= 1 },
  });
  previous.addEventListener('click', () => goToPage(page - 1));
  pagination.append(previous);

  let previousPage = 0;
  for (const pageNumber of paginationPages(page, totalPages)) {
    if (pageNumber - previousPage > 1) {
      pagination.append(
        el('span', {
          className: 'pagination-info',
          text: '…',
          attrs: { 'aria-hidden': 'true' },
        }),
      );
    }

    const button = el('button', {
      className: 'key key--small',
      text: String(pageNumber),
      attrs: {
        type: 'button',
        'aria-label': `Page ${pageNumber}`,
        ...(pageNumber === page ? { 'aria-current': 'page' } : {}),
      },
    });
    button.addEventListener('click', () => goToPage(pageNumber));
    pagination.append(button);
    previousPage = pageNumber;
  }

  const next = el('button', {
    className: 'key key--small',
    text: 'Next',
    attrs: { type: 'button', disabled: page >= totalPages },
  });
  next.addEventListener('click', () => goToPage(page + 1));
  pagination.append(next);
}

function renderProducts({ data, meta }) {
  clear(grid);

  if (data.length === 0) {
    renderEmptyState(grid, {
      title: 'No products match those filters.',
      message: 'Try a different search, or clear the filters.',
      actionLabel: 'Clear filters',
      onAction: clearFilters,
    });
    resultLine.textContent = 'No products match those filters.';
    pageCount.textContent = '';
    pagination.hidden = true;
    return;
  }

  for (const product of data) {
    grid.append(productCard(product, { onAdd: addFromButton }));
  }

  const categoryName = categorySelect.selectedOptions[0]?.textContent ?? '';
  let line = `${meta.total} ${meta.total === 1 ? 'product' : 'products'}`;
  if (state.search) line += ` matching “${state.search}”`;
  if (state.category && categoryName && categoryName !== 'All categories') {
    line += ` in ${categoryName}`;
  }

  resultLine.textContent = line;
  pageCount.textContent = `Page ${meta.page} of ${meta.totalPages}`;
  renderPagination(meta);
}

async function loadProducts() {
  const currentRequest = ++requestId;

  grid.setAttribute('aria-busy', 'true');
  renderSkeletonCards(grid, 6);
  pagination.hidden = true;
  resultLine.textContent = 'Loading the catalog.';
  pageCount.textContent = '';

  const params = new URLSearchParams({
    sort: state.sort,
    page: String(state.page),
    limit: String(PAGE_SIZE),
  });
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);

  try {
    const payload = await apiGet(`/api/products?${params.toString()}`);
    if (currentRequest !== requestId) return;
    renderProducts(payload);
  } catch (error) {
    if (currentRequest !== requestId) return;
    renderErrorState(grid, {
      title: 'The catalog did not load.',
      message: error.message || 'Try again.',
      onRetry: loadProducts,
    });
    resultLine.textContent = 'The catalog did not load.';
    pageCount.textContent = '';
  } finally {
    if (currentRequest === requestId) grid.setAttribute('aria-busy', 'false');
  }
}

function applyFilters(historyMode = 'push') {
  clearTimeout(searchTimer);
  state.search = searchInput.value.trim();
  state.category = categorySelect.value;
  state.sort = sortSelect.value;
  state.page = 1;
  syncUrl(historyMode);
  loadProducts();
}

function clearFilters() {
  clearTimeout(searchTimer);
  state.search = '';
  state.category = '';
  state.sort = 'featured';
  state.page = 1;
  searchInput.value = '';
  categorySelect.value = '';
  sortSelect.value = 'featured';
  syncUrl('push');
  loadProducts();
}

async function loadCategories() {
  try {
    const payload = await apiGet('/api/categories');
    for (const category of payload.data) {
      categorySelect.append(
        el('option', {
          text: category.name,
          attrs: { value: category.slug },
        }),
      );
    }
    categorySelect.value = state.category;
  } catch {
    categorySelect.disabled = true;
    showToast('Categories did not load. Search and sort still work.');
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters('push');
});

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  state.search = searchInput.value.trim();
  state.page = 1;
  syncUrl('replace');
  searchTimer = setTimeout(loadProducts, 300);
});

categorySelect.addEventListener('change', () => applyFilters('push'));
sortSelect.addEventListener('change', () => applyFilters('push'));
clearButton.addEventListener('click', clearFilters);

window.addEventListener('popstate', () => {
  clearTimeout(searchTimer);
  Object.assign(state, readUrl());
  syncControls();
  loadProducts();
});

initLayout();
syncControls();
loadCategories();
loadProducts();
