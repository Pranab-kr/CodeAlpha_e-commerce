import { Router } from 'express';
import { cartRouter } from './modules/cart/cart.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { categoriesRouter, productsRouter } from './modules/products/products.routes.js';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/products', productsRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/cart', cartRouter);
