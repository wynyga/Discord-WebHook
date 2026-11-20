import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';

describe('GET /health', () => {
  it('returns 200 when every check passes', async () => {
    const { app } = buildTestApp({ healthChecks: { database: async () => {}, redis: async () => {} } });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('returns 503 when a check fails', async () => {
    const { app } = buildTestApp({
      healthChecks: {
        database: async () => {},
        redis: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'up', redis: 'down' } });
  });

  it('treats a hanging check as down instead of hanging', async () => {
    const { createHealthRouter } = await import('../../../src/presentation/http/routes/health.js');
    const express = (await import('express')).default;
    const app = express().use(createHealthRouter({ redis: () => new Promise<void>(() => {}) }, 20));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks).toEqual({ redis: 'down' });
  });

  it('needs no token', async () => {
    const res = await request(buildTestApp().app).get('/health');

    expect(res.status).toBe(200);
  });
});

describe('app defaults', () => {
  it('hides unknown routes behind auth', async () => {
    const res = await request(buildTestApp().app).get('/nope');

    expect(res.status).toBe(401);
  });

  it('returns a JSON 404 for unknown routes when authenticated', async () => {
    const { app, authHeader } = buildTestApp();

    const res = await request(app).get('/nope').set('Authorization', await authHeader());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildTestApp().app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'Malformed JSON body' });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(buildTestApp().app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
