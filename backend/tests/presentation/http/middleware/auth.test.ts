import express from 'express';
import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { JwtTokenService } from '../../../../src/infrastructure/auth/jwt-token-service.js';
import { requireAuth } from '../../../../src/presentation/http/middleware/auth.js';
import { createErrorHandler } from '../../../../src/presentation/http/middleware/error-handler.js';
import { TEST_JWT_SECRET } from '../../../helpers/app.js';
import { silentLogger } from '../../../helpers/logger.js';

const tokens = new JwtTokenService(TEST_JWT_SECRET, '1h');

function protectedApp() {
  const app = express();
  app.get('/secret', requireAuth(tokens), (_req, res) => {
    res.json({ user: res.locals.user });
  });
  app.use(createErrorHandler(silentLogger()));
  return app;
}

describe('requireAuth', () => {
  it('lets a valid bearer token through and exposes the user', async () => {
    const { token } = await tokens.issue('admin');

    const res = await request(protectedApp()).get('/secret').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { subject: 'admin' } });
  });

  it('accepts the scheme in any case', async () => {
    const { token } = await tokens.issue('admin');

    const res = await request(protectedApp()).get('/secret').set('Authorization', `bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it.each([
    ['no header', undefined],
    ['empty bearer', 'Bearer '],
    ['basic auth', 'Basic YWRtaW46YWRtaW4='],
    ['token without scheme', 'abc.def.ghi'],
  ])('returns 401 for %s', async (_label, header) => {
    const req = request(protectedApp()).get('/secret');
    if (header !== undefined) req.set('Authorization', header);

    const res = await req;

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Missing bearer token' });
    expect(res.headers['www-authenticate']).toBe('Bearer');
  });

  it('returns 401 for a forged token', async () => {
    const res = await request(protectedApp()).get('/secret').set('Authorization', 'Bearer abc.def.ghi');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid token');
    expect(res.headers['www-authenticate']).toContain('invalid_token');
  });

  it('returns 401 for an expired token', async () => {
    const expired = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('admin')
      .setIssuer('insignia-scheduler')
      .setAudience('insignia-scheduler-api')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(TEST_JWT_SECRET));

    const res = await request(protectedApp()).get('/secret').set('Authorization', `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Token expired');
  });
});
