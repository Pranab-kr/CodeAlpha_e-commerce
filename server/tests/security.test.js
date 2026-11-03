import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { app, resetDb } from './helpers.js';
import { refreshCookieOptions } from '../src/lib/cookies.js';
import { errorHandler } from '../src/middleware/error.js';
import { originCheck } from '../src/middleware/origin.js';
import { createRateLimiter } from '../src/middleware/rate-limit.js';
import { seed } from '../src/db/seed.js';

beforeEach(async () => {
  await resetDb();
  await seed();
});

test('security headers are present and CORS is absent', async () => {
  const response = await request(app).get('/api/health');

  assert.equal(response.status, 200);

  const csp = response.headers['content-security-policy'];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.match(csp, /img-src 'self' data:/);
  assert.match(csp, /font-src 'self'/);
  assert.match(csp, /connect-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  assert.match(csp, /form-action 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);

  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.ok(response.headers['referrer-policy']);
  assert.equal(response.headers['access-control-allow-origin'], undefined);
});

test('the 100kb body limit rejects oversized JSON with a standard error shape', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: 'ada@example.com', password: 'x'.repeat(120_000) });

  assert.equal(response.status, 413);
  assert.equal(response.body.error.code, 'PAYLOAD_TOO_LARGE');
  assert.equal(response.body.error.message, 'Request body is too large.');
});

test('malformed JSON returns a standard 400 error', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .set('Content-Type', 'application/json')
    .send('{"email":');

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
});

test('the rate limiter factory returns 429 with the standard error shape', async () => {
  const limited = express();
  limited.use(createRateLimiter({ windowMs: 60_000, max: 2, skip: () => false }));
  limited.get('/api/test', (req, res) => res.json({ data: { ok: true } }));
  limited.use(errorHandler);

  assert.equal((await request(limited).get('/api/test')).status, 200);
  assert.equal((await request(limited).get('/api/test')).status, 200);

  const third = await request(limited).get('/api/test');
  assert.equal(third.status, 429);
  assert.equal(third.body.error.code, 'RATE_LIMITED');
  assert.equal(third.body.error.message, 'Too many requests. Try again later.');
});

test('the origin check rejects a mismatch and allows a match or no origin', async () => {
  const originApp = express();
  originApp.use(express.json());
  originApp.use(originCheck({ enabled: true, allowedOrigin: 'https://bench.test' }));
  originApp.post('/api/test', (req, res) => res.json({ data: { ok: true } }));
  originApp.get('/api/test', (req, res) => res.json({ data: { ok: true } }));
  originApp.use(errorHandler);

  const bad = await request(originApp)
    .post('/api/test')
    .set('Origin', 'https://evil.test')
    .send({});
  assert.equal(bad.status, 403);
  assert.equal(bad.body.error.code, 'FORBIDDEN');

  const good = await request(originApp)
    .post('/api/test')
    .set('Origin', 'https://bench.test')
    .send({});
  assert.equal(good.status, 200);

  const missing = await request(originApp).post('/api/test').send({});
  assert.equal(missing.status, 200);

  const mismatchOnRead = await request(originApp)
    .get('/api/test')
    .set('Origin', 'https://evil.test');
  assert.equal(mismatchOnRead.status, 200);
});

test('the refresh cookie has httpOnly, SameSite=Lax, the auth path, and production Secure', async () => {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({
    name: 'Ada',
    email: 'ada@example.com',
    password: 'correct-horse-9',
  });

  const cookie = []
    .concat(response.headers['set-cookie'] ?? [])
    .find((value) => value.startsWith('bs_refresh='));
  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.doesNotMatch(cookie, /Secure/i);

  const secureOptions = refreshCookieOptions({ secure: true });
  assert.equal(secureOptions.secure, true);
  assert.equal(secureOptions.httpOnly, true);
  assert.equal(secureOptions.sameSite, 'lax');
  assert.equal(secureOptions.path, '/api/auth');
  assert.equal(secureOptions.maxAge, 7 * 24 * 60 * 60 * 1000);
});

test('the guest cart cookie has httpOnly, SameSite=Lax, and the root path', async () => {
  const response = await request(app).get('/api/cart');
  const cookie = []
    .concat(response.headers['set-cookie'] ?? [])
    .find((value) => value.startsWith('bs_cart='));

  assert.ok(cookie);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Secure/i);
});

test('a 500 response does not leak stacks, SQL, or secrets', async () => {
  const originalError = console.error;
  console.error = () => {};

  const failing = express();
  failing.get('/boom', () => {
    throw new Error('password=secret SELECT * FROM users');
  });
  failing.use(errorHandler);

  try {
    const response = await request(failing).get('/boom');
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong.',
      },
    });
    assert.doesNotMatch(JSON.stringify(response.body), /secret|SELECT|password/i);
  } finally {
    console.error = originalError;
  }
});
