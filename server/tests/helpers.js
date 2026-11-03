import { after } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db, pool } from '../src/db/client.js';

export const app = createApp();
export { db, pool };

export function api() {
  return request(app);
}

export async function resetDb() {
  await pool.query(
    'TRUNCATE TABLE order_items, orders, cart_items, carts, refresh_tokens, products, categories, users RESTART IDENTITY CASCADE',
  );
}

export function authorized(agent, token) {
  const method = (name) => (path) => agent[name](path).set('Authorization', `Bearer ${token}`);
  return {
    get: method('get'),
    post: method('post'),
    patch: method('patch'),
    delete: method('delete'),
  };
}

export async function registerUser({
  email = 'ada@example.com',
  name = 'Ada Lovelace',
  password = 'correct-horse-9',
} = {}) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/register').send({ name, email, password });
  if (response.status !== 201) {
    throw new Error(`registerUser failed: ${response.status} ${response.text}`);
  }

  const token = response.body.data.accessToken;
  return { agent, auth: authorized(agent, token), user: response.body.data.user, token, password };
}

export async function loginUser({ email = 'ada@example.com', password = 'correct-horse-9' } = {}) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`loginUser failed: ${response.status} ${response.text}`);
  }

  const token = response.body.data.accessToken;
  return { agent, auth: authorized(agent, token), user: response.body.data.user, token };
}

after(async () => {
  await pool.end();
});
