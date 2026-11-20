import type { ErrorRequestHandler, RequestHandler } from 'express';
import { DomainError } from '../../../domain/errors.js';
import type { Logger } from '../../../infrastructure/logger.js';

const STATUS_BY_CODE: Record<DomainError['code'], number> = {
  NOT_FOUND: 404,
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  CONFLICT: 409,
};

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
};

/** Maps domain errors to their status; anything else is logged and hidden behind a 500. */
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    if (err instanceof DomainError) {
      res.status(STATUS_BY_CODE[err.code]).json({
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    if (isBodyParserError(err)) {
      res.status(400).json({ error: { code: 'VALIDATION', message: 'Malformed JSON body' } });
      return;
    }
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
  };
}

function isBodyParserError(err: unknown): boolean {
  return err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';
}
