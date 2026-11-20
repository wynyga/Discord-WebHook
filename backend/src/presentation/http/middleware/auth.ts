import type { RequestHandler } from 'express';
import type { TokenService } from '../../../domain/auth.js';
import { UnauthorizedError } from '../../../domain/errors.js';

declare global {
  // Express augments its Request through this global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      user?: { subject: string };
    }
  }
}

const BEARER = /^Bearer\s+(\S+)$/i;

/** Rejects requests without a valid `Authorization: Bearer <jwt>` header. */
export function requireAuth(tokens: TokenService): RequestHandler {
  return async (req, res, next) => {
    const match = BEARER.exec(req.get('authorization') ?? '');
    if (!match?.[1]) {
      res.set('WWW-Authenticate', 'Bearer');
      throw new UnauthorizedError('Missing bearer token');
    }
    try {
      res.locals.user = await tokens.verify(match[1]);
    } catch (err) {
      res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
      throw err;
    }
    next();
  };
}
