import { z } from 'zod';

export const addCartItemSchema = z.object({
  productId: z.string().uuid('Choose a valid product.'),
  quantity: z.number().int().min(1).max(999).default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(999),
});

export const cartProductParamsSchema = z.object({
  productId: z.string().uuid('Choose a valid product.'),
});
