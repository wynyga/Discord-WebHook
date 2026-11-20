import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Login } from '../../../application/auth/login.js';
import { loginSchema } from '../schemas/auth.schema.js';
import { parseInput } from '../validation.js';

export interface LoginRateLimit {
  windowMs: number;
  limit: number;
}

export function createAuthRouter(login: Login, limits: LoginRateLimit): Router {
  const router = Router();

  const limiter = rateLimit({
    ...limits,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } },
  });

  router.post('/auth/login', limiter, async (req, res) => {
    const { username, password } = parseInput(loginSchema, req.body);
    const { token, expiresAt } = await login.execute(username, password);
    res.json({ data: { token, tokenType: 'Bearer', expiresAt: expiresAt.toISOString() } });
  });

  return router;
}
