import { env, isProduction } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function originCheck({ enabled = isProduction, allowedOrigin = env.APP_ORIGIN } = {}) {
  return (req, res, next) => {
    if (!enabled || !STATE_CHANGING.has(req.method)) {
      next();
      return;
    }

    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) {
      next(new AppError(403, 'FORBIDDEN', 'Request origin is not allowed.'));
      return;
    }

    next();
  };
}
