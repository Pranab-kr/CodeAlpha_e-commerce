import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app, db, registerUser, resetDb } from './helpers.js';
import { carts, orderItems, orders, products } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';

const shipping = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  address1: '12 Analytical Way',
  address2: '',
  city: 'London',
  state: '',
  postalCode: 'EC1A 1BB',
  country: 'GB',
};

beforeEach(async () => {
  await resetDb();
  await seed();
});

async function addItem(client, slug, quantity = 1) {
  const product = (await client.get(`/api/products/${slug}`)).body.data;
  await client.post('/api/cart/items').send({ productId: product.id, quantity });
  return product;
}

async function productRow(slug) {
  const [row] = await db.select().from(products).where(eq(products.slug, slug));
  return row;
}

test('checkout creates an order, snapshots items, decrements stock, and converts the cart', async () => {
  const { auth, user } = await registerUser();
  const product = await addItem(auth, 'arc-75-keyboard', 2);

  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  assert.equal(response.status, 201);
  const order = response.body.data;
  assert.match(order.orderNumber, /^BS-[0-9A-F]{8}$/);
  assert.equal(order.status, 'paid');
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.paymentMethod, 'mock');
  assert.equal(order.currency, 'USD');
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productId, product.id);
  assert.equal(order.items[0].productName, 'Arc 75 Keyboard');
  assert.equal(order.items[0].productSlug, 'arc-75-keyboard');
  assert.equal(order.items[0].unitPriceCents, 12900);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].lineTotalCents, 25800);
  assert.equal(order.subtotalCents, 25800);
  assert.equal(order.shippingCents, 0);
  assert.equal(order.totalCents, 25800);
  assert.equal(order.shipping.name, 'Ada Lovelace');
  assert.equal(order.shipping.address2, '');
  assert.equal(order.shipping.city, 'London');
  assert.ok(order.createdAt);

  const updated = await productRow('arc-75-keyboard');
  assert.equal(updated.stock, 16);

  const cartRows = await db.select().from(carts).where(eq(carts.userId, user.id));
  assert.equal(cartRows.filter((row) => row.status === 'converted').length, 1);

  const nextCart = await auth.get('/api/cart');
  assert.equal(nextCart.status, 200);
  assert.equal(nextCart.body.data.items.length, 0);
  assert.notEqual(nextCart.body.data.id, cartRows[0].id);
});

test('shipping is 800 cents below $100 and free at the threshold', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'shade-webcam-cover', 1);

  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });
  assert.equal(response.status, 201);
  assert.equal(response.body.data.subtotalCents, 900);
  assert.equal(response.body.data.shippingCents, 800);
  assert.equal(response.body.data.totalCents, 1700);
});

test('the mock payment reference is recorded and no card data is accepted', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'arc-75-keyboard', 1);
  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  const [row] = await db.select().from(orders).where(eq(orders.id, response.body.data.id));
  assert.match(row.paymentReference, /^mock_/);
  assert.equal(response.body.data.card, undefined);
});

test('an empty cart returns 400 CART_EMPTY', async () => {
  const { auth } = await registerUser();
  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'CART_EMPTY');
});

test('checkout requires authentication', async () => {
  const response = await request(app).post('/api/orders').send({ shipping, paymentMethod: 'mock' });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, 'UNAUTHORIZED');
});

test('insufficient stock returns 409 details and changes nothing', async () => {
  const { auth } = await registerUser();
  const product = await addItem(auth, 'beam-task-light', 2);
  await db.update(products).set({ stock: 1 }).where(eq(products.id, product.id));

  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');
  assert.equal(response.body.error.details[0].productId, product.id);
  assert.equal(response.body.error.details[0].requested, 2);
  assert.equal(response.body.error.details[0].available, 1);

  assert.equal((await db.select().from(orders)).length, 0);
  assert.equal((await db.select().from(orderItems)).length, 0);
  assert.equal((await productRow('beam-task-light')).stock, 1);
});

test('one short line rolls back the whole order', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'arc-75-keyboard', 1);
  const light = await addItem(auth, 'beam-task-light', 2);
  await db.update(products).set({ stock: 1 }).where(eq(products.id, light.id));

  const response = await auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'INSUFFICIENT_STOCK');

  assert.equal((await db.select().from(orders)).length, 0);
  assert.equal((await productRow('arc-75-keyboard')).stock, 18);
  assert.equal((await productRow('beam-task-light')).stock, 1);
});

test('reusing an idempotency key returns the same order and decrements stock once', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'arc-75-keyboard', 1);
  const key = 'checkout-attempt-0001';

  const first = await auth
    .post('/api/orders')
    .set('Idempotency-Key', key)
    .send({ shipping, paymentMethod: 'mock' });
  const second = await auth
    .post('/api/orders')
    .set('Idempotency-Key', key)
    .send({ shipping, paymentMethod: 'mock' });

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.equal(second.body.data.id, first.body.data.id);
  assert.equal(second.body.data.orderNumber, first.body.data.orderNumber);
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await productRow('arc-75-keyboard')).stock, 17);
});

test('concurrent requests with the same idempotency key create one order', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'arc-75-keyboard', 1);
  const key = 'checkout-concurrent-0001';

  const [first, second] = await Promise.all([
    auth.post('/api/orders').set('Idempotency-Key', key).send({ shipping, paymentMethod: 'mock' }),
    auth.post('/api/orders').set('Idempotency-Key', key).send({ shipping, paymentMethod: 'mock' }),
  ]);

  assert.deepEqual([first.status, second.status], [201, 201]);
  assert.equal(first.body.data.id, second.body.data.id);
  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await productRow('arc-75-keyboard')).stock, 17);
});

test('an idempotency key owned by another user returns 409 CONFLICT', async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  await addItem(a.auth, 'arc-75-keyboard', 1);
  await addItem(b.auth, 'arc-75-keyboard', 1);
  const key = 'checkout-owned-key-01';

  const first = await a.auth
    .post('/api/orders')
    .set('Idempotency-Key', key)
    .send({ shipping, paymentMethod: 'mock' });
  assert.equal(first.status, 201);

  const second = await b.auth
    .post('/api/orders')
    .set('Idempotency-Key', key)
    .send({ shipping, paymentMethod: 'mock' });
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, 'CONFLICT');
  assert.equal(second.body.data, undefined);

  assert.equal((await db.select().from(orders)).length, 1);
  assert.equal((await productRow('arc-75-keyboard')).stock, 17);
});

test('concurrent checkout for the last item yields one 201 and one 409', async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  const product = await addItem(a.auth, 'arc-75-keyboard', 1);
  await addItem(b.auth, 'arc-75-keyboard', 1);
  await db.update(products).set({ stock: 1 }).where(eq(products.id, product.id));

  const [first, second] = await Promise.all([
    a.auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' }),
    b.auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' }),
  ]);

  assert.deepEqual([first.status, second.status].sort(), [201, 409]);
  assert.equal((await productRow('arc-75-keyboard')).stock, 0);
  assert.equal((await db.select().from(orders)).length, 1);
});

test('invalid shipping, payment method, and idempotency keys return 422', async () => {
  const { auth } = await registerUser();
  await addItem(auth, 'arc-75-keyboard', 1);

  const badShipping = await auth
    .post('/api/orders')
    .send({ shipping: { ...shipping, email: 'not-an-email' }, paymentMethod: 'mock' });
  assert.equal(badShipping.status, 422);
  assert.equal(badShipping.body.error.code, 'VALIDATION_ERROR');
  assert.ok(badShipping.body.error.details.some((detail) => detail.path === 'shipping.email'));

  const badMethod = await auth.post('/api/orders').send({ shipping, paymentMethod: 'card' });
  assert.equal(badMethod.status, 422);

  const shortKey = await auth
    .post('/api/orders')
    .set('Idempotency-Key', 'short')
    .send({ shipping, paymentMethod: 'mock' });
  assert.equal(shortKey.status, 422);
  assert.equal(shortKey.body.error.code, 'VALIDATION_ERROR');
  assert.equal(shortKey.body.error.details[0].path, 'Idempotency-Key');

  assert.equal((await db.select().from(orders)).length, 0);
});

test('order list returns only the current user orders with meta', async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  await addItem(a.auth, 'arc-75-keyboard', 2);
  const created = await a.auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });
  await addItem(b.auth, 'beam-task-light', 1);
  await b.auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  const aList = await a.auth.get('/api/orders');
  assert.equal(aList.status, 200);
  assert.equal(aList.body.data.length, 1);
  assert.equal(aList.body.data[0].id, created.body.data.id);
  assert.equal(aList.body.data[0].itemCount, 2);
  assert.equal(aList.body.data[0].currency, 'USD');
  assert.equal(aList.body.meta.total, 1);
  assert.equal(aList.body.meta.totalPages, 1);

  const bList = await b.auth.get('/api/orders');
  assert.equal(bList.body.data.length, 1);
  assert.equal(bList.body.data[0].id === created.body.data.id, false);
});

test('order detail returns the owned order and foreign ids return 404', async () => {
  const a = await registerUser({ email: 'a@example.com' });
  const b = await registerUser({ email: 'b@example.com' });
  await addItem(a.auth, 'arc-75-keyboard', 1);
  const created = await a.auth.post('/api/orders').send({ shipping, paymentMethod: 'mock' });

  const own = await a.auth.get(`/api/orders/${created.body.data.id}`);
  assert.equal(own.status, 200);
  assert.equal(own.body.data.orderNumber, created.body.data.orderNumber);
  assert.equal(own.body.data.items.length, 1);
  assert.equal(own.body.data.shipping.city, 'London');

  const foreign = await b.auth.get(`/api/orders/${created.body.data.id}`);
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.error.code, 'NOT_FOUND');

  const missing = await a.auth.get(`/api/orders/${randomUUID()}`);
  assert.equal(missing.status, 404);

  const invalid = await a.auth.get('/api/orders/not-a-uuid');
  assert.equal(invalid.status, 422);
});
