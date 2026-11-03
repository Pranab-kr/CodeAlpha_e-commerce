import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { app, authorized, db, registerUser, resetDb } from './helpers.js';
import { products, refreshTokens, users } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';

const credentials = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-9',
};

beforeEach(async () => {
  await resetDb();
  await seed();
});

function refreshCookie(response) {
  return []
    .concat(response.headers['set-cookie'] ?? [])
    .find((value) => value.startsWith('bs_refresh='));
}

test('register returns 201, a user, an access token, and an httpOnly refresh cookie', async () => {
  const agent = request.agent(app);
  const response = await agent
    .post('/api/auth/register')
    .send({ ...credentials, email: 'ADA@Example.com' });

  assert.equal(response.status, 201);
  assert.equal(response.body.data.user.email, 'ada@example.com');
  assert.equal(response.body.data.user.name, 'Ada Lovelace');
  assert.equal(response.body.data.user.role, 'customer');
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.ok(response.body.data.user.createdAt);
  assert.ok(response.body.data.accessToken);

  const cookie = refreshCookie(response);
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.doesNotMatch(cookie, /Secure/i);

  const [row] = await db.select().from(users).where(eq(users.email, 'ada@example.com'));
  assert.notEqual(row.passwordHash, credentials.password);
  assert.match(row.passwordHash, /^\$2[aby]\$/);
});

test('the access token carries only sub and role plus standard claims', async () => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send(credentials);
  const payload = jwt.decode(response.body.data.accessToken);

  assert.ok(payload.sub);
  assert.equal(payload.role, 'customer');
  assert.equal(payload.email, undefined);
  assert.equal(payload.name, undefined);
  assert.equal(payload.iss, 'bench-supply');
  assert.equal(payload.aud, 'bench-supply-web');
  assert.ok(payload.exp > payload.iat);
});

test('duplicate email returns 409 CONFLICT', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials);
  const response = await agent
    .post('/api/auth/register')
    .send({ ...credentials, email: 'ADA@example.com' });

  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, 'CONFLICT');
  assert.equal(response.body.error.message, 'An account with that email already exists.');
});

test('login returns 200 and a token; a wrong password returns a generic 401', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials);

  const ok = await agent
    .post('/api/auth/login')
    .send({ email: 'ada@example.com', password: credentials.password });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.data.accessToken);
  assert.equal(ok.body.data.user.email, 'ada@example.com');

  const bad = await agent
    .post('/api/auth/login')
    .send({ email: 'ada@example.com', password: 'wrong-password-1' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.error.code, 'UNAUTHORIZED');
  assert.equal(bad.body.error.message, 'Email or password is incorrect.');

  const unknown = await agent
    .post('/api/auth/login')
    .send({ email: 'nobody@example.com', password: 'wrong-password-1' });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.error.message, 'Email or password is incorrect.');
});

test('GET /api/auth/me requires a Bearer token', async () => {
  const { agent, token } = await registerUser();

  const ok = await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.user.email, 'ada@example.com');
  assert.ok(ok.body.data.user.createdAt);

  const missing = await agent.get('/api/auth/me');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error.code, 'UNAUTHORIZED');

  const garbage = await agent.get('/api/auth/me').set('Authorization', 'Bearer not-a-token');
  assert.equal(garbage.status, 401);
});

test('refresh works with the cookie and fails without a valid one', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials);

  const refreshed = await agent.post('/api/auth/refresh');
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.data.accessToken);
  assert.equal(refreshed.body.data.user.email, 'ada@example.com');

  const missing = await request(app).post('/api/auth/refresh');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.error.code, 'UNAUTHORIZED');

  const forged = await request(app)
    .post('/api/auth/refresh')
    .set('Cookie', 'bs_refresh=forged-token');
  assert.equal(forged.status, 401);
});

test('an expired refresh token returns 401', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials);

  await db.update(refreshTokens).set({ expiresAt: new Date(Date.now() - 1000) });
  const response = await agent.post('/api/auth/refresh');
  assert.equal(response.status, 401);
});

test('logout revokes the refresh token and clears the cookie', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send(credentials);

  const out = await agent.post('/api/auth/logout');
  assert.equal(out.status, 204);
  const cookie = refreshCookie(out);
  assert.ok(cookie);
  assert.match(cookie, /bs_refresh=;/);

  const refreshed = await agent.post('/api/auth/refresh');
  assert.equal(refreshed.status, 401);

  const [row] = await db.select().from(refreshTokens);
  assert.ok(row.revokedAt);
});

test('logout without a cookie still returns 204', async () => {
  const response = await request(app).post('/api/auth/logout');
  assert.equal(response.status, 204);
});

test('a deleted user token is rejected', async () => {
  const { agent, token, user } = await registerUser();
  await db.delete(users).where(eq(users.id, user.id));

  const response = await agent.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 401);
});

test('registration validates the name, email, and password', async () => {
  const agent = request.agent(app);

  const badEmail = await agent
    .post('/api/auth/register')
    .send({ ...credentials, email: 'not-an-email' });
  assert.equal(badEmail.status, 422);
  assert.equal(badEmail.body.error.code, 'VALIDATION_ERROR');

  const weak = await agent
    .post('/api/auth/register')
    .send({ ...credentials, email: 'weak@example.com', password: 'onlyletters' });
  assert.equal(weak.status, 422);
  assert.ok(weak.body.error.details.some((detail) => detail.path === 'password'));

  const short = await agent
    .post('/api/auth/register')
    .send({ ...credentials, email: 'short@example.com', password: 'a1' });
  assert.equal(short.status, 422);
});

test('the guest cart merges into the user cart on register', async () => {
  const agent = request.agent(app);
  const product = (await agent.get('/api/products/arc-75-keyboard')).body.data;
  await agent.post('/api/cart/items').send({ productId: product.id, quantity: 2 });

  const registered = await agent.post('/api/auth/register').send(credentials);
  assert.equal(registered.status, 201);

  const auth = authorized(agent, registered.body.data.accessToken);
  const cart = await auth.get('/api/cart');
  assert.equal(cart.body.data.items.length, 1);
  assert.equal(cart.body.data.items[0].productId, product.id);
  assert.equal(cart.body.data.items[0].quantity, 2);
});

test('the merge sums quantities, caps at stock, and does not duplicate on a second login', async () => {
  const { agent, auth } = await registerUser();
  const [light] = await db.select().from(products).where(eq(products.slug, 'beam-task-light'));

  await auth.post('/api/cart/items').send({ productId: light.id, quantity: 10 });
  await agent.post('/api/auth/logout');

  await agent.post('/api/cart/items').send({ productId: light.id, quantity: 5 });
  const login = await agent.post('/api/auth/login').send({
    email: credentials.email,
    password: credentials.password,
  });
  assert.equal(login.status, 200);

  const authed = authorized(agent, login.body.data.accessToken);
  const first = await authed.get('/api/cart');
  assert.equal(first.body.data.items.length, 1);
  assert.equal(first.body.data.items[0].quantity, 12);

  await agent.post('/api/auth/logout');
  const secondLogin = await agent.post('/api/auth/login').send({
    email: credentials.email,
    password: credentials.password,
  });
  const again = authorized(agent, secondLogin.body.data.accessToken);
  const second = await again.get('/api/cart');
  assert.equal(second.body.data.items.length, 1);
  assert.equal(second.body.data.items[0].quantity, 12);
});

test('a signed-in cart request returns the user cart, not a guest cart', async () => {
  const { auth } = await registerUser();
  const product = (await auth.get('/api/products/arc-75-keyboard')).body.data;
  await auth.post('/api/cart/items').send({ productId: product.id, quantity: 1 });

  const cart = await auth.get('/api/cart');
  const guestView = await request(app).get('/api/cart');

  assert.notEqual(cart.body.data.id, guestView.body.data.id);
  assert.equal(cart.body.data.itemCount, 1);
  assert.equal(guestView.body.data.itemCount, 0);
});

test('the refresh token is stored only as a SHA-256 hash', async () => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send(credentials);
  const rawCookie = refreshCookie(response).split(';')[0].split('=')[1];

  const [row] = await db.select().from(refreshTokens);
  assert.equal(row.tokenHash.length, 64);
  assert.match(row.tokenHash, /^[0-9a-f]{64}$/);
  assert.notEqual(row.tokenHash, rawCookie);
});
