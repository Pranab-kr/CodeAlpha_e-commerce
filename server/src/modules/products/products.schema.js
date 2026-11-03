import { z } from 'zod';

function emptyToUndefined(value) {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

export const listProductsQuerySchema = z.object({
  search: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(120, 'Search must be 120 characters or fewer.').optional(),
  ),
  category: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'Category must be a slug.')
      .optional(),
  ),
  sort: z.enum(['featured', 'newest', 'price_asc', 'price_desc', 'name']).default('featured'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const productSlugParamsSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'Invalid product slug.'),
});
