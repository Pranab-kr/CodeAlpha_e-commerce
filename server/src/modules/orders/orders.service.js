import { randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cartItems, carts, orderItems, orders, products } from '../../db/schema.js';
import { AppError } from '../../lib/errors.js';
import { totalsFor } from '../../lib/money.js';
import { charge } from './payment.service.js';

function generateOrderNumber() {
  return `BS-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function toOrderDto(order, items) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    items: items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productSlug: item.productSlug,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
    subtotalCents: order.subtotalCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    currency: order.currency.trim(),
    shipping: {
      name: order.shippingName,
      email: order.shippingEmail,
      address1: order.shippingAddress1,
      address2: order.shippingAddress2 ?? '',
      city: order.shippingCity,
      state: order.shippingState ?? '',
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    createdAt: order.createdAt,
  };
}

async function readOrderItems(orderId) {
  return db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.createdAt), asc(orderItems.productName));
}

async function findOrderByKey(idempotencyKey) {
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.idempotencyKey, idempotencyKey))
    .limit(1);
  return order ?? null;
}

async function resolveIdempotentOrder(existing, userId) {
  if (existing.userId !== userId) {
    throw new AppError(409, 'CONFLICT', 'That idempotency key is already in use.');
  }

  return toOrderDto(existing, await readOrderItems(existing.id));
}

async function runCheckout(userId, input, idempotencyKey) {
  return db.transaction(async (tx) => {
    const [cart] = await tx
      .select()
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.status, 'active')))
      .limit(1)
      .for('update');

    if (!cart) throw new AppError(400, 'CART_EMPTY', 'Your cart is empty.');

    const lines = await tx
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.createdAt), asc(cartItems.productId));

    if (lines.length === 0) throw new AppError(400, 'CART_EMPTY', 'Your cart is empty.');

    const productIds = [...new Set(lines.map((line) => line.productId))].sort();
    const locked = await tx
      .select()
      .from(products)
      .where(inArray(products.id, productIds))
      .orderBy(asc(products.id))
      .for('update');

    const byId = new Map(locked.map((product) => [product.id, product]));
    const short = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product || product.stock < line.quantity) {
        short.push({
          productId: line.productId,
          name: product?.name ?? 'Unavailable product',
          requested: line.quantity,
          available: product?.stock ?? 0,
        });
      }
    }

    if (short.length > 0) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        'Some items are no longer available in that quantity.',
        short,
      );
    }

    const subtotalCents = lines.reduce(
      (sum, line) => sum + byId.get(line.productId).priceCents * line.quantity,
      0,
    );
    const { shippingCents, totalCents } = totalsFor(subtotalCents);
    const payment = await charge({
      amountCents: totalCents,
      currency: 'USD',
      method: input.paymentMethod,
    });

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: generateOrderNumber(),
        userId,
        status: 'paid',
        paymentStatus: 'paid',
        paymentMethod: 'mock',
        paymentReference: payment.reference,
        subtotalCents,
        shippingCents,
        totalCents,
        currency: 'USD',
        shippingName: input.shipping.name,
        shippingEmail: input.shipping.email,
        shippingAddress1: input.shipping.address1,
        shippingAddress2: input.shipping.address2 || null,
        shippingCity: input.shipping.city,
        shippingState: input.shipping.state || null,
        shippingPostalCode: input.shipping.postalCode,
        shippingCountry: input.shipping.country,
        idempotencyKey: idempotencyKey ?? null,
      })
      .returning();

    const itemRows = lines.map((line) => {
      const product = byId.get(line.productId);
      return {
        orderId: order.id,
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        unitPriceCents: product.priceCents,
        quantity: line.quantity,
        lineTotalCents: product.priceCents * line.quantity,
      };
    });

    const insertedItems = await tx.insert(orderItems).values(itemRows).returning();

    for (const line of lines) {
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${line.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(products.id, line.productId));
    }

    await tx
      .update(carts)
      .set({ status: 'converted', updatedAt: new Date() })
      .where(eq(carts.id, cart.id));

    return toOrderDto(order, insertedItems);
  });
}

export async function createOrder(userId, input, idempotencyKey, { retryOrderNumber = true } = {}) {
  if (idempotencyKey) {
    const existing = await findOrderByKey(idempotencyKey);
    if (existing) return resolveIdempotentOrder(existing, userId);
  }

  try {
    return await runCheckout(userId, input, idempotencyKey);
  } catch (error) {
    if (error instanceof AppError && error.code === 'CART_EMPTY' && idempotencyKey) {
      const existing = await findOrderByKey(idempotencyKey);
      if (existing) return resolveIdempotentOrder(existing, userId);
    }

    if (error?.code === '23505') {
      const constraint = String(error.constraint ?? '');

      if (idempotencyKey) {
        const existing = await findOrderByKey(idempotencyKey);
        if (existing) return resolveIdempotentOrder(existing, userId);
      }

      if (retryOrderNumber && constraint.includes('order_number')) {
        return createOrder(userId, input, idempotencyKey, { retryOrderNumber: false });
      }
    }

    throw error;
  }
}

export async function listOrders(userId, { page, limit }) {
  const where = eq(orders.userId, userId);

  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db.select({ total: count() }).from(orders).where(where),
  ]);

  const totals = new Map();
  if (rows.length > 0) {
    const counts = await db
      .select({
        orderId: orderItems.orderId,
        itemCount: sql`coalesce(sum(${orderItems.quantity}), 0)`,
      })
      .from(orderItems)
      .where(
        inArray(
          orderItems.orderId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(orderItems.orderId);

    for (const row of counts) totals.set(row.orderId, Number(row.itemCount));
  }

  const total = totalRows[0]?.total ?? 0;

  return {
    data: rows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalCents: order.totalCents,
      currency: order.currency.trim(),
      itemCount: totals.get(order.id) ?? 0,
      createdAt: order.createdAt,
    })),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getOrder(userId, id) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.userId, userId)))
    .limit(1);

  if (!order) throw new AppError(404, 'NOT_FOUND', 'That order is not here.');

  return toOrderDto(order, await readOrderItems(order.id));
}
