import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/tokens.js';

function toRequestUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

async function loadUserFromToken(token) {
  const payload = verifyAccessToken(token);
  const [user] = await db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
  return user ?? null;
}

function readBearer(req) {
  const header = req.get('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

export async function requireAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
    return;
  }

  try {
    const user = await loadUserFromToken(token);
    if (!user) {
      next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
      return;
    }

    req.user = toRequestUser(user);
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Sign in to continue.'));
  }
}

export async function optionalAuth(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    next();
    return;
  }

  try {
    const user = await loadUserFromToken(token);
    if (user) req.user = toRequestUser(user);
  } catch {
    // Public routes treat an invalid or expired token as a guest request.
  }

  next();
}
