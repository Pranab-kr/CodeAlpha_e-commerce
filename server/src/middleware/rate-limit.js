import rateLimit from 'express-rate-limit';
import { isTest } from '../config/env.js';
import { AppError } from '../lib/errors.js';

function rateLimitHandler(req, res, next) {
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again later.'));
}

export function createRateLimiter({ windowMs, max, skip = () => isTest }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skip,
    handler: rateLimitHandler,
  });
}

export const apiRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 });

export const authRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

export const refreshRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60 });

export const orderRateLimit = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
