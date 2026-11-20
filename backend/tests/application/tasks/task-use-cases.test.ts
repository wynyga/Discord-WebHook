import { beforeEach, describe, expect, it } from 'vitest';
import { createTaskUseCases, type TaskUseCases } from '../../../src/application/tasks/index.js';
import { NotFoundError, ValidationError } from '../../../src/domain/errors.js';
import { fakeScheduler, type FakeScheduler } from '../../fakes/fake-scheduler.js';
import { InMemoryTaskRepository } from '../../fakes/in-memory-task-repository.js';
import { taskInput } from '../../fixtures/task.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000000';

let repository: InMemoryTaskRepository;
let scheduler: FakeScheduler;
let useCases: TaskUseCases;

beforeEach(() => {
  repository = new InMemoryTaskRepository();
  scheduler = fakeScheduler();
  useCases = createTaskUseCases(repository, scheduler);
});

describe('CreateTask', () => {
  it('stores an active task and schedules it', async () => {
    const task = await useCases.create.execute(taskInput());

    expect(task).toMatchObject({ ...taskInput(), status: 'active', lastRunAt: null });
    expect(repository.rows.has(task.id)).toBe(true);
    expect(scheduler.upsert).toHaveBeenCalledWith(task);
  });

  it('rejects retries that overlap the next run without storing anything', async () => {
    const input = taskInput({ cronSchedule: '* * * * *', maxRetry: 10, retryDelayMs: 10_000 });

    await expect(useCases.create.execute(input)).rejects.toThrow(ValidationError);
    expect(repository.rows.size).toBe(0);
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('rolls back the row when scheduling fails', async () => {
    scheduler.upsert.mockRejectedValueOnce(new Error('redis down'));

    await expect(useCases.create.execute(taskInput())).rejects.toThrow('redis down');
    expect(repository.rows.size).toBe(0);
  });
});

describe('GetTask and ListTasks', () => {
  it('returns a stored task', async () => {
    const created = await useCases.create.execute(taskInput());

    await expect(useCases.get.execute(created.id)).resolves.toEqual(created);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(useCases.get.execute(MISSING_ID)).rejects.toThrow(NotFoundError);
  });

  it('pages and filters by status, newest first', async () => {
    const first = await useCases.create.execute(taskInput({ name: 'first' }));
    await useCases.create.execute(taskInput({ name: 'second' }));
    const third = await useCases.create.execute(taskInput({ name: 'third' }));
    await useCases.pause.execute(first.id);

    const page1 = await useCases.list.execute({ page: 1, pageSize: 2 });
    const paused = await useCases.list.execute({ page: 1, pageSize: 10, status: 'paused' });

    expect(page1.total).toBe(3);
    expect(page1.items.map((t) => t.name)).toEqual(['third', 'second']);
    expect(page1.items[0]?.id).toBe(third.id);
    expect(paused.items.map((t) => t.name)).toEqual(['first']);
  });
});

describe('UpdateTask', () => {
  it('saves changes, keeps omitted fields and reschedules', async () => {
    const created = await useCases.create.execute(taskInput());
    scheduler.upsert.mockClear();

    const updated = await useCases.update.execute(created.id, { name: 'Renamed', cronSchedule: '0 * * * *' });

    expect(updated).toMatchObject({ name: 'Renamed', cronSchedule: '0 * * * *', webhookUrl: created.webhookUrl });
    expect(scheduler.upsert).toHaveBeenCalledWith(updated);
  });

  it('does not reschedule a paused task', async () => {
    const created = await useCases.create.execute(taskInput());
    await useCases.pause.execute(created.id);
    scheduler.upsert.mockClear();

    const updated = await useCases.update.execute(created.id, { name: 'Still paused' });

    expect(updated.status).toBe('paused');
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it('checks the retry window against the merged task', async () => {
    const created = await useCases.create.execute(taskInput({ cronSchedule: '0 * * * *', retryDelayMs: 60_000 }));

    // Only the schedule changes, but with the stored 3 x 60s retries it would now overlap.
    await expect(useCases.update.execute(created.id, { cronSchedule: '* * * * *' })).rejects.toThrow(ValidationError);
    expect((await repository.findById(created.id))?.cronSchedule).toBe('0 * * * *');
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(useCases.update.execute(MISSING_ID, { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});

describe('DeleteTask', () => {
  it('removes the schedule and the row', async () => {
    const created = await useCases.create.execute(taskInput());

    await useCases.delete.execute(created.id);

    expect(scheduler.remove).toHaveBeenCalledWith(created.id);
    expect(repository.rows.has(created.id)).toBe(false);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(useCases.delete.execute(MISSING_ID)).rejects.toThrow(NotFoundError);
    expect(scheduler.remove).not.toHaveBeenCalled();
  });
});

describe('PauseTask and ResumeTask', () => {
  it('pause removes the schedule and marks the task paused', async () => {
    const created = await useCases.create.execute(taskInput());

    const paused = await useCases.pause.execute(created.id);

    expect(paused.status).toBe('paused');
    expect(scheduler.remove).toHaveBeenCalledWith(created.id);
  });

  it('pause is idempotent', async () => {
    const created = await useCases.create.execute(taskInput());
    await useCases.pause.execute(created.id);
    scheduler.remove.mockClear();

    const again = await useCases.pause.execute(created.id);

    expect(again.status).toBe('paused');
    expect(scheduler.remove).not.toHaveBeenCalled();
  });

  it('resume reactivates and reschedules a paused task', async () => {
    const created = await useCases.create.execute(taskInput());
    await useCases.pause.execute(created.id);
    scheduler.upsert.mockClear();

    const resumed = await useCases.resume.execute(created.id);

    expect(resumed.status).toBe('active');
    expect(scheduler.upsert).toHaveBeenCalledWith(resumed);
  });

  it('resume leaves a task that is not paused alone', async () => {
    const created = await useCases.create.execute(taskInput());
    scheduler.upsert.mockClear();

    const same = await useCases.resume.execute(created.id);

    expect(same).toEqual(created);
    expect(scheduler.upsert).not.toHaveBeenCalled();
  });

  it.each(['pause', 'resume'] as const)('%s throws NotFoundError for an unknown id', async (action) => {
    await expect(useCases[action].execute(MISSING_ID)).rejects.toThrow(NotFoundError);
  });
});
