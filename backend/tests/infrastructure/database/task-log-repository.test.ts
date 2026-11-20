import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { TaskLogStatus } from '../../../src/domain/task.js';
import { DrizzleTaskLogRepository } from '../../../src/infrastructure/database/task-log-repository.js';
import { DrizzleTaskRepository } from '../../../src/infrastructure/database/task-repository.js';
import { taskInput } from '../../fixtures/task.js';
import { createTestDatabase } from '../../helpers/pglite.js';

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let tasks: DrizzleTaskRepository;
let logs: DrizzleTaskLogRepository;

beforeAll(async () => {
  database = await createTestDatabase();
  tasks = new DrizzleTaskRepository(database.db);
  logs = new DrizzleTaskLogRepository(database.db);
});

beforeEach(() => database.reset());

afterAll(() => database.close());

function log(taskId: string, status: TaskLogStatus, retryCount = 0) {
  return logs.create({
    taskId,
    executedAt: new Date(),
    status,
    retryCount,
    httpStatus: status === 'success' ? 200 : 502,
    durationMs: 35,
    message: `${status} message`,
  });
}

describe('DrizzleTaskLogRepository', () => {
  it('stores an attempt with every field', async () => {
    const task = await tasks.create({ ...taskInput(), status: 'active' });

    const created = await log(task.id, 'retrying', 2);

    expect(created).toMatchObject({ taskId: task.id, status: 'retrying', retryCount: 2, httpStatus: 502, durationMs: 35 });
    expect(created.createdAt).toBeInstanceOf(Date);
  });

  it('lists newest first with the task name and filters', async () => {
    const a = await tasks.create({ ...taskInput({ name: 'Task A' }), status: 'active' });
    const b = await tasks.create({ ...taskInput({ name: 'Task B' }), status: 'active' });
    await log(a.id, 'retrying');
    await log(a.id, 'success', 1);
    await log(b.id, 'failed');

    const all = await logs.list({ page: 1, pageSize: 10 });
    const onlyA = await logs.list({ page: 1, pageSize: 10, taskId: a.id });
    const failedA = await logs.list({ page: 1, pageSize: 10, taskId: a.id, status: 'failed' });
    const page2 = await logs.list({ page: 2, pageSize: 2 });

    expect(all.total).toBe(3);
    expect(all.items[0]).toMatchObject({ taskName: 'Task B', status: 'failed' });
    expect(onlyA.items.map((l) => l.status)).toEqual(['success', 'retrying']);
    expect(failedA.total).toBe(0);
    expect(page2.items).toHaveLength(1);
  });

  it('counts attempts per status since a point in time', async () => {
    const task = await tasks.create({ ...taskInput(), status: 'active' });
    await log(task.id, 'success');
    await log(task.id, 'success');
    await log(task.id, 'failed');

    expect(await logs.countByStatusSince(new Date(Date.now() - 60_000))).toEqual({
      success: 2,
      retrying: 0,
      failed: 1,
    });
    expect(await logs.countByStatusSince(new Date(Date.now() + 60_000))).toEqual({
      success: 0,
      retrying: 0,
      failed: 0,
    });
  });

  it('counts attempts per hour and status', async () => {
    const task = await tasks.create({ ...taskInput(), status: 'active' });
    await log(task.id, 'success');
    await log(task.id, 'success');
    await log(task.id, 'failed');

    const rows = await logs.countByHourSince(new Date(Date.now() - 3_600_000));
    const currentHour = Math.floor(Date.now() / 3_600_000) * 3_600_000;

    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.hour.getTime()).toBe(currentHour);
    expect(Object.fromEntries(rows.map((r) => [r.status, r.count]))).toEqual({ success: 2, failed: 1 });
  });

  it('loses the logs of a deleted task (cascade)', async () => {
    const task = await tasks.create({ ...taskInput(), status: 'active' });
    await log(task.id, 'success');

    await tasks.delete(task.id);

    expect((await logs.list({ page: 1, pageSize: 10 })).total).toBe(0);
  });

  it('rejects a log for a task that does not exist', async () => {
    await expect(log('00000000-0000-4000-8000-000000000000', 'success')).rejects.toThrow();
  });
});
