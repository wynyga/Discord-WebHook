import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp, TEST_ADMIN } from '../../../helpers/app.js';

describe('POST /auth/login', () => {
  it('returns a bearer token that unlocks the API', async () => {
    const { app } = buildTestApp();

    const login = await request(app).post('/auth/login').send(TEST_ADMIN);
    const tasks = await request(app).get('/tasks').set('Authorization', `Bearer ${login.body.data.token}`);

    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ tokenType: 'Bearer', token: expect.any(String) });
    expect(Date.parse(login.body.data.expiresAt)).toBeGreaterThan(Date.now());
    expect(tasks.status).toBe(200);
  });

  it('rejects wrong credentials with a generic message', async () => {
    const res = await request(buildTestApp().app)
      .post('/auth/login')
      .send({ username: TEST_ADMIN.username, password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toEqual({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
  });

  it('validates the body', async () => {
    const res = await request(buildTestApp().app).post('/auth/login').send({ username: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ path: 'password' })]);
  });

  it('rate limits repeated attempts', async () => {
    const { app } = buildTestApp({ loginRateLimit: { windowMs: 60_000, limit: 2 } });
    const attempt = () => request(app).post('/auth/login').send({ username: 'admin', password: 'wrong' });

    await attempt();
    await attempt();
    const blocked = await attempt();

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
  });
});
