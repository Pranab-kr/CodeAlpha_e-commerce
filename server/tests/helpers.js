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

after(async () => {
  await pool.end();
});
