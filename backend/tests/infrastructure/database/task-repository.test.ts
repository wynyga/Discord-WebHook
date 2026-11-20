import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleTaskRepository } from '../../../src/infrastructure/database/task-repository.js';
import { taskInput } from '../../fixtures/task.js';
import { createTestDatabase } from '../../helpers/pglite.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let repository: DrizzleTaskRepository;

beforeAll(async () => {
  database = await createTestDatabase();
  repository = new DrizzleTaskRepository(database.db);
});

beforeEach(() => database.reset());

afterAll(() => database.close());

describe('DrizzleTaskRepository', () => {
  it('creates a task with database defaults', async () => {
    const task = await repository.create({ ...taskInput(), status: 'active' });

    expect(task).toMatchObject({ ...taskInput(), status: 'active', lastRunAt: null });
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(task.createdAt).toBeInstanceOf(Date);
  });

  it('round-trips the JSONB payload unchanged', async () => {
    const { id } = await repository.create({ ...taskInput(), status: 'active' });

    expect((await repository.findById(id))?.payload).toEqual(taskInput().payload);
  });

  it('returns null for an unknown id', async () => {
    expect(await repository.findById(MISSING_ID)).toBeNull();
    expect(await repository.update(MISSING_ID, { name: 'x' })).toBeNull();
    expect(await repository.delete(MISSING_ID)).toBe(false);
  });

  it('lists newest first with paging and a status filter', async () => {
    for (const name of ['a', 'b', 'c']) await repository.create({ ...taskInput({ name }), status: 'active' });
    await repository.create({ ...taskInput({ name: 'p' }), status: 'paused' });

    const page = await repository.list({ page: 2, pageSize: 2 });
    const paused = await repository.list({ page: 1, pageSize: 10, status: 'paused' });

    expect(page.total).toBe(4);
    expect(page.items.map((t) => t.name)).toEqual(['b', 'a']);
    expect(paused).toMatchObject({ total: 1, items: [{ name: 'p' }] });
  });

  it('updates only the given fields and bumps updatedAt', async () => {
    const created = await repository.create({ ...taskInput(), status: 'active' });

    const updated = await repository.update(created.id, { name: 'Renamed', status: 'paused' });

    expect(updated).toMatchObject({ name: 'Renamed', status: 'paused', cronSchedule: created.cronSchedule });
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
  });

  it('treats an empty update as a read', async () => {
    const created = await repository.create({ ...taskInput(), status: 'active' });

    expect(await repository.update(created.id, {})).toEqual(created);
  });

  it('deletes a task', async () => {
    const { id } = await repository.create({ ...taskInput(), status: 'active' });

    expect(await repository.delete(id)).toBe(true);
    expect(await repository.findById(id)).toBeNull();
  });

  it('counts tasks per status, including empty ones', async () => {
    await repository.create({ ...taskInput(), status: 'active' });
    await repository.create({ ...taskInput(), status: 'active' });
    await repository.create({ ...taskInput(), status: 'failed' });

    expect(await repository.countByStatus()).toEqual({ active: 2, paused: 0, failed: 1 });
  });

  it('lists every task that should be scheduled, skipping paused ones', async () => {
    await repository.create({ ...taskInput({ name: 'active' }), status: 'active' });
    await repository.create({ ...taskInput({ name: 'failed' }), status: 'failed' });
    await repository.create({ ...taskInput({ name: 'paused' }), status: 'paused' });

    const names = (await repository.listSchedulable()).map((t) => t.name).sort();

    expect(names).toEqual(['active', 'failed']);
  });

  it('lets the database reject out-of-range retries', async () => {
    await expect(repository.create({ ...taskInput({ maxRetry: 11 }), status: 'active' })).rejects.toThrow();
  });
});
