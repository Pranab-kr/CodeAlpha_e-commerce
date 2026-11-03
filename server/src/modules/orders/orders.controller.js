import { AppError } from '../../lib/errors.js';
import { idempotencyKeySchema } from './orders.schema.js';
import * as ordersService from './orders.service.js';

function readIdempotencyKey(req) {
  const raw = req.get('idempotency-key');
  if (raw === undefined) return undefined;

  const parsed = idempotencyKeySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', [
      { path: 'Idempotency-Key', message: 'Use 8 to 128 characters.' },
    ]);
  }

  return parsed.data;
}

export async function create(req, res) {
  const order = await ordersService.createOrder(req.user.id, req.body, readIdempotencyKey(req));
  res.status(201).json({ data: order });
}

export async function list(req, res) {
  const result = await ordersService.listOrders(req.user.id, req.query);
  res.json({ data: result.data, meta: result.meta });
}

export async function detail(req, res) {
  res.json({ data: await ordersService.getOrder(req.user.id, req.params.id) });
}
