import { apiGet } from '../api.js';
import { initLayout } from '../layout.js';
import {
  clear,
  el,
  productCard,
  productPlate,
  renderEmptyState,
  renderErrorState,
  renderSkeletonCards,
  renderSkeletonRows,
} from '../ui.js';

const GLYPH_RAMP = ' .:-=+*#%@';
const fieldState = { stocks: [], started: false };

function drawHeroField(stocks) {
  fieldState.stocks = stocks;
  if (fieldState.started || stocks.length === 0) return;
  fieldState.started = true;

  const canvas = document.querySelector('[data-hero-field]');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const rootStyles = getComputedStyle(document.documentElement);
  const tints = ['--color-glyph-1', '--color-glyph-2', '--color-glyph-3', '--color-glyph-4'].map(
    (token) => rootStyles.getPropertyValue(token).trim(),
  );
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cellWidth = 8;
  const cellHeight = 16;

  let width = 0;
  let height = 0;
  let frame = 0;
  let lastTime = 0;
  let animationId = 0;
  let visible = true;

  function draw() {
    if (!width || !height) return;
    context.clearRect(0, 0, width, height);
    context.textBaseline = 'top';
    context.font = '500 12px "JetBrains Mono", monospace';

    const columns = Math.ceil(width / cellWidth);
    const rows = Math.ceil(height / cellHeight);
    const startColumn = Math.floor(columns * 0.42);

    for (let row = 0; row < rows; row += 1) {
      for (let column = startColumn; column < columns; column += 1) {
        const stock =
          fieldState.stocks[(row * columns + column + frame) % fieldState.stocks.length];
        const wave = Math.sin(column * 0.33 + row * 0.55 + frame * 0.045);
        const intensity = Math.min(1, (stock / 100) * 0.55 + Math.abs(wave) * 0.45);
        if (intensity < 0.12) continue;

        const level = Math.min(3, Math.floor(intensity * 4));
        context.fillStyle = tints[level];
        const character = GLYPH_RAMP[Math.floor(intensity * (GLYPH_RAMP.length - 1))];
        context.fillText(character, column * cellWidth, row * cellHeight);
      }
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    width = rect.width;
    height = rect.height;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }

  function loop(time) {
    if (!visible) return;
    if (time - lastTime >= 33) {
      frame += 1;
      lastTime = time;
      draw();
    }
    animationId = requestAnimationFrame(loop);
  }

  function start() {
    cancelAnimationFrame(animationId);
    if (motionQuery.matches) {
      draw();
      return;
    }
    animationId = requestAnimationFrame(loop);
  }

  resize();

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) {
        lastTime = 0;
        animationId = requestAnimationFrame(loop);
      } else {
        cancelAnimationFrame(animationId);
      }
    });
    observer.observe(canvas);
  }

  motionQuery.addEventListener('change', start);
  start();
}

function renderFeatured(products) {
  const featured = document.querySelector('[data-featured]');
  if (!featured) return;

  featured.setAttribute('aria-busy', 'false');

  if (products.length === 0) {
    renderEmptyState(featured, {
      title: 'The short list is empty.',
      message: 'The catalog is being prepared.',
    });
    return;
  }

  clear(featured);
  for (const product of products) {
    featured.append(productCard(product, { addLabel: 'Cart arrives in phase 2' }));
  }
}

function categoryRow(category) {
  return el(
    'a',
    {
      className: 'category-row',
      attrs: { href: `products.html?category=${encodeURIComponent(category.slug)}` },
    },
    [
      el('h3', { text: category.name }),
      el('p', { text: category.description }),
      el('span', {
        className: 'category-count',
        text: `${category.productCount} ${category.productCount === 1 ? 'product' : 'products'}`,
      }),
    ],
  );
}

function renderCategories(categories) {
  const host = document.querySelector('[data-categories]');
  if (!host) return;

  host.setAttribute('aria-busy', 'false');

  if (categories.length === 0) {
    renderEmptyState(host, {
      title: 'No categories yet.',
      message: 'The catalog has no categories.',
    });
    return;
  }

  clear(host);
  for (const category of categories) host.append(categoryRow(category));
}

function renderMaterialsPlate(product) {
  const host = document.querySelector('[data-materials-plate]');
  if (!host) return;

  clear(host);
  host.append(productPlate(product, { size: 'large' }));
}

async function loadHome() {
  const featuredHost = document.querySelector('[data-featured]');
  const categoryHost = document.querySelector('[data-categories]');

  if (featuredHost) renderSkeletonCards(featuredHost, 4);
  if (categoryHost) renderSkeletonRows(categoryHost, 4);

  const [productsResult, categoriesResult] = await Promise.allSettled([
    apiGet('/api/products?sort=featured&limit=48'),
    apiGet('/api/categories'),
  ]);

  if (productsResult.status === 'fulfilled') {
    const products = productsResult.value.data;
    renderFeatured(products.slice(0, 4));
    drawHeroField(products.map((product) => product.stock));

    const materialsProduct = products.find((product) => product.slug === 'arc-75-keyboard');
    if (materialsProduct) renderMaterialsPlate(materialsProduct);
  } else if (featuredHost) {
    featuredHost.setAttribute('aria-busy', 'false');
    renderErrorState(featuredHost, {
      title: 'The short list did not load.',
      message: productsResult.reason?.message || 'Try again.',
      onRetry: loadHome,
    });
  }

  if (categoriesResult.status === 'fulfilled') {
    renderCategories(categoriesResult.value.data);
  } else if (categoryHost) {
    categoryHost.setAttribute('aria-busy', 'false');
    renderErrorState(categoryHost, {
      title: 'Categories did not load.',
      message: categoriesResult.reason?.message || 'Try again.',
      onRetry: loadHome,
    });
  }
}

initLayout();
renderMaterialsPlate({
  name: 'Arc 75 Keyboard',
  slug: 'arc-75-keyboard',
  stock: 18,
  category: { name: 'Keyboards' },
});
loadHome();
