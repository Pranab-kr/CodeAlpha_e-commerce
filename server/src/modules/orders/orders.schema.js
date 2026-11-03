import { z } from 'zod';

const shippingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(80, 'Use 80 characters or fewer.'),
  email: z.string().trim().toLowerCase().pipe(z.string().email('Enter a valid email.')),
  address1: z
    .string()
    .trim()
    .min(3, 'Enter at least 3 characters.')
    .max(120, 'Use 120 characters or fewer.'),
  address2: z.string().trim().max(120, 'Use 120 characters or fewer.').default(''),
  city: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(80, 'Use 80 characters or fewer.'),
  state: z.string().trim().max(80, 'Use 80 characters or fewer.').default(''),
  postalCode: z
    .string()
    .trim()
    .min(3, 'Enter at least 3 characters.')
    .max(20, 'Use 20 characters or fewer.'),
  country: z
    .string()
    .trim()
    .min(2, 'Enter at least 2 characters.')
    .max(56, 'Use 56 characters or fewer.'),
});

export const createOrderSchema = z.object({
  shipping: shippingSchema,
  paymentMethod: z.literal('mock').default('mock'),
});

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8, 'Use 8 to 128 characters.')
  .max(128, 'Use 8 to 128 characters.');

export const listOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(10),
});

export const orderParamsSchema = z.object({ id: z.string().uuid('Choose a valid order.') });
