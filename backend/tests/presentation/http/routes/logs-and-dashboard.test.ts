import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TaskLogStatus } from '../../../../src/domain/task.js';
import { taskInput } from '../../../fixtures/task.js';
import { buildTestApp } from '../../../helpers/app.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let ctx: ReturnType<typeof buildTestApp>;
let auth: string;

beforeEach(async () => {
  ctx = buildTestApp();
  auth = await ctx.authHeader();
});

const get = (path: string) => request(ctx.app).get(path).set('Authorization', auth);

async function seed() {
  const a = await ctx.repository.create({ ...taskInput({ name: 'Task A' }), status: 'active' });
  const b = await ctx.repository.create({ ...taskInput({ name: 'Task B' }), status: 'failed' });
  const add = (taskId: string, status: TaskLogStatus) =>
    ctx.logRepository.create({
      taskId,
      executedAt: new Date(),
      status,
      retryCount: 0,
      httpStatus: 200,
      durationMs: 40,
      message: 'msg',
    });
  await add(a.id, 'success');
  await add(b.id, 'retrying');
  await add(b.id, 'failed');
  return { a, b };
}

describe('POST /tasks/:id/run', () => {
  it('queues a run and answers 202', async () => {
    const { a } = await seed();

    const res = await request(ctx.app).post(`/tasks/${a.id}/run`).set('Authorization', auth);

    expect(res.status).toBe(202);
    expect(res.body.data).toEqual({ taskId: a.id, status: 'queued' });
    expect(ctx.scheduler.runNow).toHaveBeenCalledWith(expect.objectContaining({ id: a.id }));
  });

  it('returns 404 for an unknown task', async () => {
    const res = await request(ctx.app).post(`/tasks/${MISSING_ID}/run`).set('Authorization', auth);

    expect(res.status).toBe(404);
  });
});

describe('GET /logs', () => {
  it('lists every log newest first with task names', async () => {
    await seed();

    const res = await get('/logs');

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ total: 3, page: 1 });
    expect(res.body.data[0]).toMatchObject({ taskName: 'Task B', status: 'failed', httpStatus: 200, durationMs: 40 });
    expect(res.body.data[0].executedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('filters by task and status', async () => {
    const { b } = await seed();

    const res = await get(`/logs?taskId=${b.id}&status=retrying`);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ taskId: b.id, status: 'retrying' });
  });

  it.each(['/logs?status=done', '/logs?taskId=42', '/logs?pageSize=1000'])('rejects %s', async (path) => {
    expect((await get(path)).status).toBe(400);
  });

  it('needs a token', async () => {
    expect((await request(ctx.app).get('/logs')).status).toBe(401);
  });
});

describe('GET /tasks/:id/logs', () => {
  it('lists the logs of one task', async () => {
    const { a } = await seed();

    const res = await get(`/tasks/${a.id}/logs`);

    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { taskName: string }) => l.taskName)).toEqual(['Task A']);
  });

  it('returns 404 for an unknown task', async () => {
    expect((await get(`/tasks/${MISSING_ID}/logs`)).status).toBe(404);
  });
});

describe('GET /dashboard/summary', () => {
  it('returns task and execution counts', async () => {
    await seed();

    const res = await get('/dashboard/summary');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      tasks: { total: 2, active: 1, paused: 0, failed: 1 },
      executions24h: { total: 3, success: 1, retrying: 1, failed: 1 },
    });
  });

  it('needs a token', async () => {
    expect((await request(ctx.app).get('/dashboard/summary')).status).toBe(401);
  });
});
