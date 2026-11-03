import { env, isProduction } from '../config/env.js';

export const GUEST_CART_COOKIE = 'bs_cart';
export const GUEST_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const REFRESH_COOKIE = 'bs_refresh';
export const REFRESH_COOKIE_PATH = '/api/auth';

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

export function refreshCookieOptions({ secure = isProduction } = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: REFRESH_COOKIE_PATH,
    maxAge: env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  };
}

export function readRefreshToken(req) {
  const value = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

export function clearRefreshCookie(res) {
  const { maxAge: _maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
}
