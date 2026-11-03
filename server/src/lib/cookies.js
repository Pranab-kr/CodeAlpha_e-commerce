import { isProduction } from '../config/env.js';

export const GUEST_CART_COOKIE = 'bs_cart';
export const GUEST_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readGuestCartToken(req) {
  const value = req.cookies?.[GUEST_CART_COOKIE];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) return null;
  return value;
}

export function setGuestCartToken(res, token) {
  res.cookie(GUEST_CART_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: GUEST_CART_MAX_AGE_MS,
  });
}

export function clearGuestCartToken(res) {
  res.clearCookie(GUEST_CART_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
  });
}
