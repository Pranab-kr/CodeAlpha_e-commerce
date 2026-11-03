import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { orderRateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { create, detail, list } from './orders.controller.js';
import { createOrderSchema, listOrdersQuerySchema, orderParamsSchema } from './orders.schema.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.post('/', orderRateLimit, validate({ body: createOrderSchema }), create);
ordersRouter.get('/', validate({ query: listOrdersQuerySchema }), list);
ordersRouter.get('/:id', validate({ params: orderParamsSchema }), detail);
