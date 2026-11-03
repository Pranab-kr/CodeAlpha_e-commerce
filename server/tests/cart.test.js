import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app, db, resetDb } from './helpers.js';
import { products } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';

beforeEach(async () => {
  await resetDb();
  await seed();
});

async function productId(slug) {
  const [row] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug));
  return row.id;
}

function guest() {
  return request.agent(app);
}

function cartCookie(headers) {
  return [].concat(headers['set-cookie'] ?? []).find((value) => value.startsWith('bs_cart='));
}

test('GET /api/cart creates a guest cart and sets the cookie', async () => {
  const agent = guest();
  const response = await agent.get('/api/cart');

  assert.equal(response.status, 200);
  assert.equal(response.body.data.items.length, 0);
  assert.equal(response.body.data.itemCount, 0);
  assert.equal(response.body.data.subtotalCents, 0);
  assert.equal(response.body.data.shippingCents, 0);
  assert.equal(response.body.data.totalCents, 0);
  assert.equal(response.body.data.currency, 'USD');

  const cookie = cartCookie(response.headers);
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=2592000/);
  assert.doesNotMatch(cookie, /Secure/i);

  const again = await agent.get('/api/cart');
  assert.equal(again.body.data.id, response.body.data.id);
});

test('a malformed guest cookie is replaced', async () => {
  const response = await guest().get('/api/cart').set('Cookie', 'bs_cart=not-a-uuid');

  assert.equal(response.status, 200);
  const cookie = cartCookie(response.headers);
  assert.ok(cookie);
  assert.doesNotMatch(cookie, /not-a-uuid/);
});

test('POST /api/cart/items adds a line with server totals', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');

  const response = await agent.post('/api/cart/items').send({ productId: arcId, quantity: 2 });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.items.length, 1);
  assert.equal(response.body.data.itemCount, 2);
  assert.equal(response.body.data.subtotalCents, 25800);
  assert.equal(response.body.data.shippingCents, 0);
  assert.equal(response.body.data.totalCents, 25800);

  const item = response.body.data.items[0];
  assert.equal(item.productId, arcId);
  assert.equal(item.slug, 'arc-75-keyboard');
  assert.equal(item.category.slug, 'keyboards');
  assert.equal(item.unitPriceCents, 12900);
  assert.equal(item.quantity, 2);
  assert.equal(item.lineTotalCents, 25800);
  assert.equal(item.imageUrl, null);
});

test('adding the same product twice sums the quantity and caps at stock', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');

  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 2 });
  const second = await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });

  assert.equal(second.status, 201);
  assert.equal(second.body.data.items[0].quantity, 3);
  assert.equal(second.body.data.itemCount, 3);

  const capped = await agent.post('/api/cart/items').send({ productId: arcId, quantity: 999 });
  assert.equal(capped.status, 201);
  assert.equal(capped.body.data.items[0].quantity, 18);
  assert.equal(capped.body.data.itemCount, 18);
});

test('PATCH updates a quantity and quantity 0 removes the line', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');
  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });

  const updated = await agent.patch(`/api/cart/items/${arcId}`).send({ quantity: 3 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.itemCount, 3);

  const removed = await agent.patch(`/api/cart/items/${arcId}`).send({ quantity: 0 });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.items.length, 0);
  assert.equal(removed.body.data.itemCount, 0);
});

test('DELETE /api/cart/items/:productId removes a line and is idempotent', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');
  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });

  const removed = await agent.delete(`/api/cart/items/${arcId}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.items.length, 0);

  const missing = await agent.delete(`/api/cart/items/${randomUUID()}`);
  assert.equal(missing.status, 200);
  assert.equal(missing.body.data.items.length, 0);
});

test('DELETE /api/cart clears the cart', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');
  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });

  const cleared = await agent.delete('/api/cart');
  assert.equal(cleared.status, 204);

  const empty = await agent.get('/api/cart');
  assert.equal(empty.body.data.items.length, 0);
  assert.equal(empty.body.data.itemCount, 0);
});

test('unknown products return 404 and out-of-stock products return 409', async () => {
  const agent = guest();

  const missing = await agent
    .post('/api/cart/items')
    .send({ productId: randomUUID(), quantity: 1 });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error.code, 'NOT_FOUND');

  const pouchId = await productId('carry-pouch');
  const outOfStock = await agent.post('/api/cart/items').send({ productId: pouchId, quantity: 1 });
  assert.equal(outOfStock.status, 409);
  assert.equal(outOfStock.body.error.code, 'INSUFFICIENT_STOCK');
});

test('flat shipping applies below $100 and free shipping at $100', async () => {
  const agent = guest();
  const coverId = await productId('shade-webcam-cover');
  const arcId = await productId('arc-75-keyboard');

  const small = await agent.post('/api/cart/items').send({ productId: coverId, quantity: 1 });
  assert.equal(small.body.data.subtotalCents, 900);
  assert.equal(small.body.data.shippingCents, 800);
  assert.equal(small.body.data.totalCents, 1700);

  const large = await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });
  assert.equal(large.body.data.subtotalCents, 13800);
  assert.equal(large.body.data.shippingCents, 0);
  assert.equal(large.body.data.totalCents, 13800);
});

test('a positive update on a product with no stock returns 409', async () => {
  const agent = guest();
  const arcId = await productId('arc-75-keyboard');
  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });

  await db.update(products).set({ stock: 0 }).where(eq(products.id, arcId));

  const response = await agent.patch(`/api/cart/items/${arcId}`).send({ quantity: 2 });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');
});

test('invalid bodies and ids return 422 VALIDATION_ERROR', async () => {
  const agent = guest();

  const badId = await agent.post('/api/cart/items').send({ productId: 'not-a-uuid', quantity: 1 });
  assert.equal(badId.status, 422);
  assert.equal(badId.body.error.code, 'VALIDATION_ERROR');

  const badQuantity = await agent
    .post('/api/cart/items')
    .send({ productId: randomUUID(), quantity: 0 });
  assert.equal(badQuantity.status, 422);

  const arcId = await productId('arc-75-keyboard');
  await agent.post('/api/cart/items').send({ productId: arcId, quantity: 1 });
  const negative = await agent.patch(`/api/cart/items/${arcId}`).send({ quantity: -1 });
  assert.equal(negative.status, 422);
});

test('two guests get separate carts', async () => {
  const first = guest();
  const second = guest();
  const arcId = await productId('arc-75-keyboard');

  const firstCart = await first.get('/api/cart');
  const secondCart = await second.get('/api/cart');
  assert.notEqual(firstCart.body.data.id, secondCart.body.data.id);

  await first.post('/api/cart/items').send({ productId: arcId, quantity: 1 });
  const secondView = await second.get('/api/cart');
  assert.equal(secondView.body.data.itemCount, 0);
});
