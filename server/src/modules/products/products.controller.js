import { getProductBySlug, listCategories, listProducts } from './products.service.js';

export async function getProducts(req, res) {
  const result = await listProducts(req.query);
  res.json({ data: result.data, meta: result.meta });
}

export async function getProduct(req, res) {
  const product = await getProductBySlug(req.params.slug);
  res.json({ data: product });
}

export async function getCategories(req, res) {
  const data = await listCategories();
  res.json({ data });
}
