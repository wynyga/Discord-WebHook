import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp } from '../../../helpers/app.js';
import { taskInput, WEBHOOK_URL } from '../../../fixtures/task.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const MASKED_WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/****wxyz';

let ctx: ReturnType<typeof buildTestApp>;
let auth: string;

beforeEach(async () => {
  ctx = buildTestApp();
  auth = await ctx.authHeader();
});

const api = () => ({
  post: (path: string) => request(ctx.app).post(path).set('Authorization', auth),
  get: (path: string) => request(ctx.app).get(path).set('Authorization', auth),
  patch: (path: string) => request(ctx.app).patch(path).set('Authorization', auth),
  delete: (path: string) => request(ctx.app).delete(path).set('Authorization', auth),
});

async function createTask(overrides = {}) {
  const res = await api().post('/tasks').send(taskInput(overrides));
  return res.body.data as { id: string; status: string };
}

describe('auth on /tasks', () => {
  it.each([
    ['get', '/tasks'],
    ['post', '/tasks'],
    ['get', `/tasks/${MISSING_ID}`],
    ['patch', `/tasks/${MISSING_ID}`],
    ['delete', `/tasks/${MISSING_ID}`],
    ['post', `/tasks/${MISSING_ID}/pause`],
    ['post', `/tasks/${MISSING_ID}/resume`],
  ] as const)('%s %s needs a token', async (method, path) => {
    const res = await request(ctx.app)[method](path);

    expect(res.status).toBe(401);
  });
});

describe('POST /tasks', () => {
  it('creates a task and masks the webhook in the response', async () => {
    const res = await api().post('/tasks').send(taskInput());

    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/tasks/${res.body.data.id}`);
    expect(res.body.data).toMatchObject({
      name: 'Daily report',
      status: 'active',
      webhookUrl: MASKED_WEBHOOK,
      payload: taskInput().payload,
      lastRunAt: null,
    });
    expect(JSON.stringify(res.body)).not.toContain(WEBHOOK_URL);
    expect(ctx.scheduler.upsert).toHaveBeenCalledOnce();
  });

  it('stores the real webhook URL', async () => {
    const { id } = await createTask();

    expect((await ctx.repository.findById(id))?.webhookUrl).toBe(WEBHOOK_URL);
  });

  it('returns field-level validation errors', async () => {
    const res = await api()
      .post('/tasks')
      .send({ ...taskInput(), cronSchedule: 'nope', webhookUrl: 'https://example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['cronSchedule', 'webhookUrl']);
  });

  it('rejects overlapping retries', async () => {
    const res = await api()
      .post('/tasks')
      .send(taskInput({ cronSchedule: '* * * * *', maxRetry: 10, retryDelayMs: 10_000 }));

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Retries would overlap the next scheduled run');
  });
});

describe('GET /tasks', () => {
  it('lists tasks with paging metadata', async () => {
    await createTask({ name: 'one' });
    await createTask({ name: 'two' });
    await createTask({ name: 'three' });

    const res = await api().get('/tasks?page=1&pageSize=2');

    expect(res.status).toBe(200);
    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['three', 'two']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('filters by status', async () => {
    const { id } = await createTask({ name: 'paused one' });
    await createTask({ name: 'active one' });
    await api().post(`/tasks/${id}/pause`);

    const res = await api().get('/tasks?status=paused');

    expect(res.body.data.map((t: { name: string }) => t.name)).toEqual(['paused one']);
  });

  it('rejects an invalid query', async () => {
    const res = await api().get('/tasks?status=running');

    expect(res.status).toBe(400);
  });
});

describe('GET /tasks/:id', () => {
  it('returns one task', async () => {
    const { id } = await createTask();

    const res = await api().get(`/tasks/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('returns 404 for an unknown id', async () => {
    expect((await api().get(`/tasks/${MISSING_ID}`)).status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    expect((await api().get('/tasks/42')).status).toBe(400);
  });
});

describe('PATCH /tasks/:id', () => {
  it('updates given fields and keeps the stored webhook when none is sent', async () => {
    const { id } = await createTask();

    const res = await api().patch(`/tasks/${id}`).send({ name: 'Renamed', maxRetry: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: 'Renamed', maxRetry: 1, webhookUrl: MASKED_WEBHOOK });
    expect((await ctx.repository.findById(id))?.webhookUrl).toBe(WEBHOOK_URL);
  });

  it('rejects an empty body', async () => {
    const { id } = await createTask();

    expect((await api().patch(`/tasks/${id}`).send({})).status).toBe(400);
  });

  it('rejects changing the status directly', async () => {
    const { id } = await createTask();

    expect((await api().patch(`/tasks/${id}`).send({ status: 'paused' })).status).toBe(400);
  });

  it('returns 404 for an unknown id', async () => {
    expect((await api().patch(`/tasks/${MISSING_ID}`).send({ name: 'x' })).status).toBe(404);
  });
});

describe('DELETE /tasks/:id', () => {
  it('deletes the task and its schedule', async () => {
    const { id } = await createTask();

    const res = await api().delete(`/tasks/${id}`);

    expect(res.status).toBe(204);
    expect(ctx.scheduler.remove).toHaveBeenCalledWith(id);
    expect((await api().get(`/tasks/${id}`)).status).toBe(404);
  });

  it('returns 404 for an unknown id', async () => {
    expect((await api().delete(`/tasks/${MISSING_ID}`)).status).toBe(404);
  });
});

describe('pause and resume', () => {
  it('pauses and resumes a task', async () => {
    const { id } = await createTask();

    const paused = await api().post(`/tasks/${id}/pause`);
    const resumed = await api().post(`/tasks/${id}/resume`);

    expect(paused.status).toBe(200);
    expect(paused.body.data.status).toBe('paused');
    expect(resumed.body.data.status).toBe('active');
    expect(ctx.scheduler.remove).toHaveBeenCalledWith(id);
  });

  it.each(['pause', 'resume'])('%s returns 404 for an unknown id', async (action) => {
    expect((await api().post(`/tasks/${MISSING_ID}/${action}`)).status).toBe(404);
  });
});
