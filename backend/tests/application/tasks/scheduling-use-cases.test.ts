import { beforeEach, describe, expect, it } from 'vitest';
import { ReconcileSchedules } from '../../../src/application/tasks/reconcile-schedules.js';
import { RunTaskNow } from '../../../src/application/tasks/run-task-now.js';
import { NotFoundError } from '../../../src/domain/errors.js';
import { fakeScheduler, type FakeScheduler } from '../../fakes/fake-scheduler.js';
import { InMemoryTaskRepository } from '../../fakes/in-memory-task-repository.js';
import { taskInput } from '../../fixtures/task.js';

let tasks: InMemoryTaskRepository;
let scheduler: FakeScheduler;

beforeEach(() => {
  tasks = new InMemoryTaskRepository();
  scheduler = fakeScheduler();
});

describe('RunTaskNow', () => {
  it('queues one run of the task', async () => {
    const task = await tasks.create({ ...taskInput(), status: 'paused' });

    await new RunTaskNow(tasks, scheduler).execute(task.id);

    expect(scheduler.runNow).toHaveBeenCalledWith(task);
  });

  it('throws NotFoundError for an unknown id', async () => {
    await expect(new RunTaskNow(tasks, scheduler).execute('00000000-0000-4000-8000-000000000000')).rejects.toThrow(
      NotFoundError,
    );
    expect(scheduler.runNow).not.toHaveBeenCalled();
  });
});

describe('ReconcileSchedules', () => {
  it('schedules active and failed tasks and removes stale schedules', async () => {
    const active = await tasks.create({ ...taskInput(), status: 'active' });
    const failed = await tasks.create({ ...taskInput(), status: 'failed' });
    const paused = await tasks.create({ ...taskInput(), status: 'paused' });
    scheduler.scheduledTaskIds.mockResolvedValue([active.id, paused.id, 'deleted-task']);

    const result = await new ReconcileSchedules(tasks, scheduler).execute();

    expect(scheduler.upsert.mock.calls.map(([task]) => task.id).sort()).toEqual([active.id, failed.id].sort());
    expect(scheduler.remove.mock.calls.map(([id]) => id).sort()).toEqual([paused.id, 'deleted-task'].sort());
    expect(result).toEqual({ scheduled: 2, removed: 2 });
  });

  it('does nothing on an empty system', async () => {
    expect(await new ReconcileSchedules(tasks, scheduler).execute()).toEqual({ scheduled: 0, removed: 0 });
  });
});
