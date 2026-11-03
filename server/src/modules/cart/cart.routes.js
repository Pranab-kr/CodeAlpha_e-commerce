import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import {
  deleteCart,
  deleteCartItem,
  getCart,
  patchCartItem,
  postCartItem,
} from './cart.controller.js';
import { addCartItemSchema, cartProductParamsSchema, updateCartItemSchema } from './cart.schema.js';

export const cartRouter = Router();

cartRouter.get('/', getCart);
cartRouter.post('/items', validate({ body: addCartItemSchema }), postCartItem);
cartRouter.patch(
  '/items/:productId',
  validate({ params: cartProductParamsSchema, body: updateCartItemSchema }),
  patchCartItem,
);
cartRouter.delete(
  '/items/:productId',
  validate({ params: cartProductParamsSchema }),
  deleteCartItem,
);
cartRouter.delete('/', deleteCart);
