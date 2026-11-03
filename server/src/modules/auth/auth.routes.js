import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { authRateLimit, refreshRateLimit } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { login, logout, me, refresh, register } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimit, validate({ body: registerSchema }), register);
authRouter.post('/login', authRateLimit, validate({ body: loginSchema }), login);
authRouter.post('/refresh', refreshRateLimit, refresh);
authRouter.post('/logout', logout);
authRouter.get('/me', requireAuth, me);
