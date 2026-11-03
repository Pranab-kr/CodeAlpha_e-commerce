import { sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('customer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    check('users_role_check', sql`${table.role} in ('customer', 'admin')`),
  ],
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_unique').on(table.tokenHash),
    index('refresh_tokens_user_id_idx').on(table.userId),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('categories_slug_unique').on(table.slug)],
);

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description').notNull(),
    specs: jsonb('specs')
      .$type()
      .notNull()
      .default(sql`'[]'::jsonb`),
    priceCents: integer('price_cents').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    stock: integer('stock').notNull().default(0),
    imageUrl: text('image_url'),
    featured: boolean('featured').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('products_slug_unique').on(table.slug),
    index('products_category_id_idx').on(table.categoryId),
    index('products_featured_idx').on(table.featured),
    check('products_price_cents_check', sql`${table.priceCents} >= 0`),
    check('products_stock_check', sql`${table.stock} >= 0`),
  ],
);

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    guestToken: text('guest_token'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'carts_owner_exclusive',
      sql`(${table.userId} is not null) <> (${table.guestToken} is not null)`,
    ),
    check('carts_status_check', sql`${table.status} in ('active', 'converted')`),
    uniqueIndex('carts_user_active_unique')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    uniqueIndex('carts_guest_token_unique')
      .on(table.guestToken)
      .where(sql`${table.guestToken} is not null`),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cartId: uuid('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('cart_items_cart_product_unique').on(table.cartId, table.productId),
    index('cart_items_cart_id_idx').on(table.cartId),
    check('cart_items_quantity_check', sql`${table.quantity} > 0`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('paid'),
    paymentStatus: text('payment_status').notNull().default('paid'),
    paymentMethod: text('payment_method').notNull().default('mock'),
    paymentReference: text('payment_reference'),
    subtotalCents: integer('subtotal_cents').notNull(),
    shippingCents: integer('shipping_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    shippingName: text('shipping_name').notNull(),
    shippingEmail: text('shipping_email').notNull(),
    shippingAddress1: text('shipping_address1').notNull(),
    shippingAddress2: text('shipping_address2'),
    shippingCity: text('shipping_city').notNull(),
    shippingState: text('shipping_state'),
    shippingPostalCode: text('shipping_postal_code').notNull(),
    shippingCountry: text('shipping_country').notNull(),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('orders_order_number_unique').on(table.orderNumber),
    uniqueIndex('orders_idempotency_key_unique').on(table.idempotencyKey),
    index('orders_user_created_idx').on(table.userId, table.createdAt),
    check(
      'orders_status_check',
      sql`${table.status} in ('pending', 'paid', 'processing', 'shipped', 'cancelled')`,
    ),
    check(
      'orders_payment_status_check',
      sql`${table.paymentStatus} in ('pending', 'paid', 'failed', 'refunded')`,
    ),
    check('orders_subtotal_cents_check', sql`${table.subtotalCents} >= 0`),
    check('orders_shipping_cents_check', sql`${table.shippingCents} >= 0`),
    check('orders_total_cents_check', sql`${table.totalCents} >= 0`),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    productName: text('product_name').notNull(),
    productSlug: text('product_slug').notNull(),
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCents: integer('line_total_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('order_items_order_id_idx').on(table.orderId),
    check('order_items_unit_price_cents_check', sql`${table.unitPriceCents} >= 0`),
    check('order_items_quantity_check', sql`${table.quantity} > 0`),
    check('order_items_line_total_cents_check', sql`${table.lineTotalCents} >= 0`),
  ],
);
