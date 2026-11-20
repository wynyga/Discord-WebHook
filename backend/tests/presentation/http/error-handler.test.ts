import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from '../../../src/domain/errors.js';
import { createErrorHandler } from '../../../src/presentation/http/middleware/error-handler.js';
import { silentLogger } from '../../helpers/logger.js';

function appThrowing(error: unknown, logger = silentLogger()) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(createErrorHandler(logger));
  return app;
}

describe('createErrorHandler', () => {
  it.each([
    [new NotFoundError('Task not found'), 404, 'NOT_FOUND'],
    [new ValidationError('Bad input', { field: 'name' }), 400, 'VALIDATION'],
    [new UnauthorizedError('Missing token'), 401, 'UNAUTHORIZED'],
    [new ConflictError('Already paused'), 409, 'CONFLICT'],
  ])('maps %s to its status', async (error, status, code) => {
    const res = await request(appThrowing(error)).get('/boom');

    expect(res.status).toBe(status);
    expect(res.body.error).toMatchObject({ code, message: error.message });
  });

  it('passes details through', async () => {
    const res = await request(appThrowing(new ValidationError('Bad input', { field: 'name' }))).get('/boom');

    expect(res.body.error.details).toEqual({ field: 'name' });
  });

  it('hides unknown errors behind a logged 500', async () => {
    const logger = silentLogger();
    const spy = vi.spyOn(logger, 'error');

    const res = await request(appThrowing(new Error('db password leaked'), logger)).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error).toEqual({ code: 'INTERNAL', message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('leaked');
    expect(spy).toHaveBeenCalledOnce();
  });
});
