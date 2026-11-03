import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { refreshTokens, users } from '../../db/schema.js';
import {
  clearGuestCartToken,
  clearRefreshCookie,
  readGuestCartToken,
  readRefreshToken,
  setRefreshCookie,
} from '../../lib/cookies.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { createRefreshToken, hashRefreshToken, signAccessToken } from '../../lib/tokens.js';
import { mergeGuestCart } from '../cart/cart.service.js';

function toUserDto(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function issueSession(user, req, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = createRefreshToken();

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + env.REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    userAgent: req.get('user-agent') ?? null,
    ip: req.ip ?? null,
  });

  setRefreshCookie(res, refreshToken);
  return { user: toUserDto(user), accessToken };
}

async function mergeGuestCartForRequest(req, res, userId) {
  const guestToken = readGuestCartToken(req);
  if (!guestToken) return;

  await mergeGuestCart({ userId, guestToken });
  clearGuestCartToken(res);
}

export async function register(input, req, res) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1);

  if (existing) {
    throw new AppError(409, 'CONFLICT', 'An account with that email already exists.');
  }

  let user;
  try {
    const [created] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      })
      .returning();
    user = created;
  } catch (error) {
    if (error.code === '23505') {
      throw new AppError(409, 'CONFLICT', 'An account with that email already exists.');
    }
    throw error;
  }

  await mergeGuestCartForRequest(req, res, user.id);
  return issueSession(user, req, res);
}

export async function login(input, req, res) {
  const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Email or password is incorrect.');

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) throw new AppError(401, 'UNAUTHORIZED', 'Email or password is incorrect.');

  await mergeGuestCartForRequest(req, res, user.id);
  return issueSession(user, req, res);
}

export async function refresh(req) {
  const token = readRefreshToken(req);
  if (!token) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.');

  const [row] = await db
    .select({ user: users })
    .from(refreshTokens)
    .innerJoin(users, eq(refreshTokens.userId, users.id))
    .where(
      and(
        eq(refreshTokens.tokenHash, hashRefreshToken(token)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row?.user) throw new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.');

  return { user: toUserDto(row.user), accessToken: signAccessToken(row.user) };
}

export async function logout(req, res) {
  const token = readRefreshToken(req);
  if (token) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)));
  }

  clearRefreshCookie(res);
}

export function me(req) {
  return { user: toUserDto(req.user) };
}
