import { initLayout } from '../layout.js';
import { productPlate, renderSkeletonCards, renderSkeletonRows } from '../ui.js';

const HERO_STOCK = [18, 24, 12, 30, 40, 35, 20, 15, 50, 45, 100, 0];
const GLYPH_RAMP = ' .:-=+*#%@';

function drawHeroField() {
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
        const stock = HERO_STOCK[(row * columns + column + frame) % HERO_STOCK.length];
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

function renderShell() {
  initLayout();

  const featured = document.querySelector('[data-featured]');
  if (featured) renderSkeletonCards(featured, 4);

  const categories = document.querySelector('[data-categories]');
  if (categories) renderSkeletonRows(categories, 4);

  const materialsPlate = document.querySelector('[data-materials-plate]');
  if (materialsPlate) {
    materialsPlate.append(
      productPlate(
        {
          name: 'Arc 75 Keyboard',
          slug: 'arc-75-keyboard',
          stock: 18,
          category: { name: 'Keyboards' },
        },
        { size: 'large' },
      ),
    );
  }

  drawHeroField();
}

renderShell();
