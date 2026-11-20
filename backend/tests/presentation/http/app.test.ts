import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/presentation/http/app.js';
import { silentLogger } from '../../helpers/logger.js';

function buildApp(healthChecks = {}) {
  return createApp({ logger: silentLogger(), corsOrigin: ['http://localhost:5173'], healthChecks });
}

describe('GET /health', () => {
  it('returns 200 when every check passes', async () => {
    const app = buildApp({ database: async () => {}, redis: async () => {} });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', checks: { database: 'up', redis: 'up' } });
  });

  it('returns 503 when a check fails', async () => {
    const app = buildApp({
      database: async () => {},
      redis: async () => {
        throw new Error('ECONNREFUSED');
      },
    });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', checks: { database: 'up', redis: 'down' } });
  });
});

describe('app defaults', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(buildApp()).get('/nope');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await request(buildApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: 'VALIDATION', message: 'Malformed JSON body' });
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(buildApp()).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
