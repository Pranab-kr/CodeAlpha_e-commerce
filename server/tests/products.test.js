import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { api, resetDb } from './helpers.js';
import { seed } from '../src/db/seed.js';

before(async () => {
  await resetDb();
  await seed();
});

test('GET /api/products returns twelve seeded products', async () => {
  const response = await api().get('/api/products');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 12);
  assert.deepEqual(response.body.meta, {
    page: 1,
    limit: 12,
    total: 12,
    totalPages: 1,
  });

  const product = response.body.data.find((row) => row.slug === 'arc-75-keyboard');
  assert.ok(product);
  assert.equal(product.priceCents, 12900);
  assert.equal(product.currency, 'USD');
  assert.equal(product.inStock, true);
  assert.equal(product.imageUrl, null);
  assert.equal(product.category.slug, 'keyboards');
  assert.ok(Array.isArray(product.specs));
  assert.ok(product.specs.length > 0);
});

test('search matches names and descriptions case-insensitively', async () => {
  const lower = await api().get('/api/products?search=keyboard');
  assert.equal(lower.status, 200);
  assert.equal(lower.body.meta.total, 2);

  const upper = await api().get('/api/products?search=KEYBOARD');
  assert.equal(upper.body.meta.total, 2);

  const noResults = await api().get('/api/products?search=nothing-matches-this');
  assert.equal(noResults.status, 200);
  assert.equal(noResults.body.data.length, 0);
  assert.equal(noResults.body.meta.total, 0);
  assert.equal(noResults.body.meta.totalPages, 0);
});

test('search treats SQL wildcards literally', async () => {
  const underscore = await api().get('/api/products?search=_');
  assert.equal(underscore.status, 200);
  assert.equal(underscore.body.meta.total, 0);

  const percent = await api().get('/api/products?search=%25');
  assert.equal(percent.status, 200);
  assert.equal(percent.body.meta.total, 2);
});

test('category filter returns the lighting products', async () => {
  const response = await api().get('/api/products?category=lighting');

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.total, 2);
  assert.ok(response.body.data.every((row) => row.category.slug === 'lighting'));
});

test('price_asc sorts from the lowest price', async () => {
  const response = await api().get('/api/products?sort=price_asc');

  assert.equal(response.status, 200);
  assert.equal(response.body.data[0].slug, 'shade-webcam-cover');
  const prices = response.body.data.map((row) => row.priceCents);
  assert.deepEqual(
    prices,
    [...prices].sort((a, b) => a - b),
  );
});

test('pagination returns the requested page', async () => {
  const response = await api().get('/api/products?limit=5&page=2');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 5);
  assert.equal(response.body.meta.page, 2);
  assert.equal(response.body.meta.limit, 5);
  assert.equal(response.body.meta.total, 12);
  assert.equal(response.body.meta.totalPages, 3);
});

test('GET /api/products/:slug returns specs, category, and related products', async () => {
  const response = await api().get('/api/products/arc-75-keyboard');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.slug, 'arc-75-keyboard');
  assert.equal(response.body.data.category.slug, 'keyboards');
  assert.ok(response.body.data.specs.length >= 4);
  assert.equal(response.body.data.related.length, 1);
  assert.equal(response.body.data.related[0].slug, 'lowline-65-keyboard');
  assert.ok(response.body.data.related.every((row) => row.slug !== 'arc-75-keyboard'));
});

test('unknown product slugs return 404 NOT_FOUND', async () => {
  const response = await api().get('/api/products/not-a-product');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.code, 'NOT_FOUND');
});

test('invalid query values return 422 VALIDATION_ERROR', async () => {
  const badPage = await api().get('/api/products?page=0');
  assert.equal(badPage.status, 422);
  assert.equal(badPage.body.error.code, 'VALIDATION_ERROR');

  const badLimit = await api().get('/api/products?limit=99');
  assert.equal(badLimit.status, 422);
  assert.equal(badLimit.body.error.code, 'VALIDATION_ERROR');

  const badSort = await api().get('/api/products?sort=popular');
  assert.equal(badSort.status, 422);
  assert.equal(badSort.body.error.code, 'VALIDATION_ERROR');
});

test('GET /api/categories returns four categories with product counts', async () => {
  const response = await api().get('/api/categories');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 4);

  const bySlug = new Map(response.body.data.map((row) => [row.slug, row]));
  assert.equal(bySlug.get('keyboards').productCount, 2);
  assert.equal(bySlug.get('lighting').productCount, 2);
  assert.equal(bySlug.get('desk').productCount, 3);
  assert.equal(bySlug.get('accessories').productCount, 5);

  const total = response.body.data.reduce((sum, row) => sum + row.productCount, 0);
  assert.equal(total, 12);
});
