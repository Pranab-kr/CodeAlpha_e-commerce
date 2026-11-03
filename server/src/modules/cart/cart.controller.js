import {
  addItem,
  clearCart,
  getCartIdentity,
  readCart,
  removeItem,
  updateItem,
} from './cart.service.js';

export async function getCart(req, res) {
  const identity = getCartIdentity(req, res);
  const cart = await readCart(identity);
  res.json({ data: cart });
}

export async function postCartItem(req, res) {
  const identity = getCartIdentity(req, res);
  const cart = await addItem(identity, req.body);
  res.status(201).json({ data: cart });
}

export async function patchCartItem(req, res) {
  const identity = getCartIdentity(req, res);
  const cart = await updateItem(identity, req.params.productId, req.body.quantity);
  res.json({ data: cart });
}

export async function deleteCartItem(req, res) {
  const identity = getCartIdentity(req, res);
  const cart = await removeItem(identity, req.params.productId);
  res.json({ data: cart });
}

export async function deleteCart(req, res) {
  const identity = getCartIdentity(req, res);
  await clearCart(identity);
  res.status(204).end();
}
