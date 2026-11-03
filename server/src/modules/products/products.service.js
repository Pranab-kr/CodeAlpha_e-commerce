import { and, asc, count, desc, eq, ilike, ne, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { categories, products } from '../../db/schema.js';
import { LOW_STOCK_THRESHOLD } from './products.constants.js';
import { notFound } from '../../lib/errors.js';

const productColumns = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  description: products.description,
  specs: products.specs,
  priceCents: products.priceCents,
  currency: products.currency,
  stock: products.stock,
  imageUrl: products.imageUrl,
  featured: products.featured,
  categoryName: categories.name,
  categorySlug: categories.slug,
  categoryId: categories.id,
};

function toProductDto(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    specs: Array.isArray(row.specs) ? row.specs : [],
    priceCents: row.priceCents,
    currency: row.currency.trim(),
    stock: row.stock,
    inStock: row.stock > 0,
    lowStock: row.stock > 0 && row.stock <= LOW_STOCK_THRESHOLD,
    imageUrl: row.imageUrl,
    featured: row.featured,
    category: {
      name: row.categoryName,
      slug: row.categorySlug,
    },
  };
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function sortOrder(sort) {
  switch (sort) {
    case 'newest':
      return [desc(products.createdAt), desc(products.id)];
    case 'price_asc':
      return [asc(products.priceCents), asc(products.name)];
    case 'price_desc':
      return [desc(products.priceCents), asc(products.name)];
    case 'name':
      return [asc(products.name)];
    case 'featured':
    default:
      return [desc(products.featured), asc(products.name)];
  }
}

export async function listProducts({ search, category, sort, page, limit }) {
  const conditions = [];

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern)));
  }

  if (category) {
    conditions.push(eq(categories.slug, category));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rowsQuery = db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .orderBy(...sortOrder(sort))
    .limit(limit)
    .offset((page - 1) * limit);

  const countQuery = db
    .select({ value: count() })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id));

  if (where) {
    rowsQuery.where(where);
    countQuery.where(where);
  }

  const [rows, countRows] = await Promise.all([rowsQuery, countQuery]);
  const total = countRows[0]?.value ?? 0;

  return {
    data: rows.map(toProductDto),
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

export async function getProductBySlug(slug) {
  const [row] = await db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row) {
    throw notFound('That product is not here.');
  }

  const relatedRows = await db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.categoryId, row.categoryId), ne(products.id, row.id)))
    .orderBy(desc(products.featured), asc(products.name))
    .limit(3);

  return {
    ...toProductDto(row),
    related: relatedRows.map(toProductDto),
  };
}

export async function listCategories() {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      description: categories.description,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .groupBy(categories.id, categories.name, categories.slug, categories.description)
    .orderBy(asc(categories.name));

  return rows;
}
