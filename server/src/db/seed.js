import { fileURLToPath } from 'node:url';
import { closeDb, db } from './client.js';
import { categories, products } from './schema.js';
import { categoriesSeed, productsSeed } from './seed-data.js';

export async function seed() {
  await db.transaction(async (tx) => {
    for (const category of categoriesSeed) {
      await tx
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.slug,
          set: {
            name: category.name,
            description: category.description,
            updatedAt: new Date(),
          },
        });
    }

    const categoryRows = await tx
      .select({ id: categories.id, slug: categories.slug })
      .from(categories);
    const categoryIds = new Map(categoryRows.map((row) => [row.slug, row.id]));

    for (const product of productsSeed) {
      const categoryId = categoryIds.get(product.categorySlug);
      if (!categoryId) {
        throw new Error(`Seed category missing: ${product.categorySlug}`);
      }

      const values = {
        categoryId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        specs: product.specs,
        priceCents: product.priceCents,
        stock: product.stock,
        featured: product.featured,
        imageUrl: `/assets/products/${product.slug}.jpg`,
      };

      await tx
        .insert(products)
        .values(values)
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            ...values,
            updatedAt: new Date(),
          },
        });
    }
  });
}

async function main() {
  try {
    await seed();
    const rows = await db.select({ slug: products.slug }).from(products);
    console.log(`Seed complete: ${categoriesSeed.length} categories, ${rows.length} products.`);
  } catch (error) {
    console.error('Seed failed.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
