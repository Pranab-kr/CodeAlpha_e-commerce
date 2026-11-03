import { env, isProduction } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck(req, res, next) {
  if (!isProduction || !STATE_CHANGING.has(req.method)) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (!origin || origin !== env.APP_ORIGIN) {
    next(new AppError(403, 'FORBIDDEN', 'Request origin is not allowed.'));
    return;
  }

  next();
}
