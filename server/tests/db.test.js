import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pool, resetDb } from './helpers.js';
import { db } from '../src/db/client.js';
import { categories, users } from '../src/db/schema.js';

const TABLES = [
  'users',
  'refresh_tokens',
  'categories',
  'products',
  'carts',
  'cart_items',
  'orders',
  'order_items',
];

test('all eight tables exist', async () => {
  const result = await pool.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_name = any($1)`,
    [TABLES],
  );
  const found = result.rows.map((row) => row.table_name).sort();
  assert.deepEqual(found, [...TABLES].sort());
});

test('unique constraints reject duplicate rows', async () => {
  await resetDb();

  await db.insert(categories).values({
    name: 'Desk',
    slug: 'desk',
    description: 'Desk things.',
  });

  await assert.rejects(
    db.insert(categories).values({
      name: 'Desk again',
      slug: 'desk',
      description: 'Duplicate slug.',
    }),
    (error) => error.cause?.code === '23505' || error.code === '23505',
  );

  await db.insert(users).values({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    passwordHash: 'not-a-real-hash',
  });

  await assert.rejects(
    db.insert(users).values({
      name: 'Ada Again',
      email: 'ada@example.com',
      passwordHash: 'not-a-real-hash',
    }),
    (error) => error.cause?.code === '23505' || error.code === '23505',
  );

  await resetDb();
});
