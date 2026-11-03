import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { getCategories, getProduct, getProducts } from './products.controller.js';
import { listProductsQuerySchema, productSlugParamsSchema } from './products.schema.js';

export const productsRouter = Router();
export const categoriesRouter = Router();

productsRouter.get('/', validate({ query: listProductsQuerySchema }), getProducts);
productsRouter.get('/:slug', validate({ params: productSlugParamsSchema }), getProduct);

categoriesRouter.get('/', getCategories);
