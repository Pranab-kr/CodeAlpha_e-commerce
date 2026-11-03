import assert from 'node:assert/strict';
import { test } from 'node:test';
import { count, eq, lte, and, gt } from 'drizzle-orm';
import { db, resetDb } from './helpers.js';
import { categories, products } from '../src/db/schema.js';
import { seed } from '../src/db/seed.js';

test('seed creates four categories and twelve products', async () => {
  await resetDb();
  await seed();

  const [categoryCount] = await db.select({ value: count() }).from(categories);
  const [productCount] = await db.select({ value: count() }).from(products);

  assert.equal(categoryCount.value, 4);
  assert.equal(productCount.value, 12);
});

test('seed is idempotent', async () => {
  await resetDb();
  await seed();
  const first = await db.select({ id: products.id, slug: products.slug }).from(products);
  await seed();
  const second = await db.select({ id: products.id, slug: products.slug }).from(products);

  assert.equal(second.length, 12);
  assert.deepEqual(second.map((row) => row.id).sort(), first.map((row) => row.id).sort());
});

test('seed includes the out-of-stock product, low stock, and specs', async () => {
  await resetDb();
  await seed();

  const [pouch] = await db.select().from(products).where(eq(products.slug, 'carry-pouch'));
  assert.equal(pouch.stock, 0);
  assert.ok(Array.isArray(pouch.specs));
  assert.ok(pouch.specs.length > 0);

  const lowStock = await db
    .select({ slug: products.slug })
    .from(products)
    .where(and(gt(products.stock, 0), lte(products.stock, 15)));

  assert.ok(lowStock.some((row) => row.slug === 'beam-task-light'));
  assert.ok(lowStock.some((row) => row.slug === 'rise-laptop-stand'));
});
