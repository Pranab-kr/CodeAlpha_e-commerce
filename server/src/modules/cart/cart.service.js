import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { cartItems, carts, categories, products } from '../../db/schema.js';
import { AppError, notFound } from '../../lib/errors.js';
import { readGuestCartToken, setGuestCartToken } from '../../lib/cookies.js';

export function getCartIdentity(req, res) {
  const userId = req.user?.id ?? null;
  if (userId) return { userId, guestToken: null };

  let guestToken = readGuestCartToken(req);
  if (!guestToken) {
    guestToken = randomUUID();
    setGuestCartToken(res, guestToken);
  }

  return { userId: null, guestToken };
}

async function findActiveCart({ userId, guestToken }) {
  const ownerCondition = userId ? eq(carts.userId, userId) : eq(carts.guestToken, guestToken);

  const [cart] = await db
    .select()
    .from(carts)
    .where(and(ownerCondition, eq(carts.status, 'active')))
    .limit(1);

  return cart ?? null;
}

async function getOrCreateCart(identity) {
  const existing = await findActiveCart(identity);
  if (existing) return existing;

  const values = identity.userId
    ? { userId: identity.userId }
    : { guestToken: identity.guestToken };

  const [created] = await db.insert(carts).values(values).onConflictDoNothing().returning();
  if (created) return created;

  const raced = await findActiveCart(identity);
  if (raced) return raced;

  throw new AppError(500, 'INTERNAL_ERROR', 'The cart could not be created.');
}

export async function getCartDto(cartId) {
  const rows = await db
    .select({
      productId: cartItems.productId,
      quantity: cartItems.quantity,
      name: products.name,
      slug: products.slug,
      imageUrl: products.imageUrl,
      priceCents: products.priceCents,
      currency: products.currency,
      stock: products.stock,
      categoryName: categories.name,
      categorySlug: categories.slug,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(asc(cartItems.createdAt), asc(products.name));

  const items = rows.map((row) => ({
    productId: row.productId,
    name: row.name,
    slug: row.slug,
    category: { name: row.categoryName, slug: row.categorySlug },
    imageUrl: row.imageUrl,
    unitPriceCents: row.priceCents,
    quantity: row.quantity,
    stock: row.stock,
    lineTotalCents: row.priceCents * row.quantity,
  }));

  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const shippingCents =
    items.length === 0 || subtotalCents >= env.FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : env.SHIPPING_FLAT_CENTS;

  return {
    id: cartId,
    items,
    itemCount,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: rows[0]?.currency?.trim() ?? 'USD',
  };
}

export async function readCart(identity) {
  const cart = await getOrCreateCart(identity);
  return getCartDto(cart.id);
}

export async function addItem(identity, { productId, quantity }) {
  const [product] = await db
    .select({ id: products.id, stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw notFound('That product is not here.');
  if (product.stock === 0) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', 'That product is out of stock.');
  }

  const cart = await getOrCreateCart(identity);
  const added = Math.min(quantity, product.stock);

  await db
    .insert(cartItems)
    .values({ cartId: cart.id, productId, quantity: added })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: {
        quantity: sql`LEAST(${cartItems.quantity} + ${added}, ${product.stock})`,
        updatedAt: new Date(),
      },
    });

  return getCartDto(cart.id);
}

export async function updateItem(identity, productId, quantity) {
  const cart = await getOrCreateCart(identity);
  const [line] = await db
    .select({ id: cartItems.id })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)))
    .limit(1);

  if (!line) throw notFound('That cart line is not here.');

  if (quantity === 0) {
    await db.delete(cartItems).where(eq(cartItems.id, line.id));
    return getCartDto(cart.id);
  }

  const [product] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) throw notFound('That product is not here.');
  if (product.stock === 0) {
    throw new AppError(409, 'INSUFFICIENT_STOCK', 'That product is out of stock.');
  }

  await db
    .update(cartItems)
    .set({ quantity: Math.min(quantity, product.stock), updatedAt: new Date() })
    .where(eq(cartItems.id, line.id));

  return getCartDto(cart.id);
}

export async function removeItem(identity, productId) {
  const cart = await getOrCreateCart(identity);
  await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)));
  return getCartDto(cart.id);
}

export async function clearCart(identity) {
  const cart = await getOrCreateCart(identity);
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
}
