import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../src/domain/task.js';
import { BullMqScheduler, type TaskQueue } from '../../../src/infrastructure/scheduler/bullmq-scheduler.js';
import {
  EXECUTE_JOB_NAME,
  schedulerIdFor,
  taskIdFromSchedulerId,
  TASK_BACKOFF_TYPE,
} from '../../../src/infrastructure/scheduler/task-queue.js';
import { taskInput } from '../../fixtures/task.js';

const task: Task = {
  ...taskInput({ cronSchedule: '0 9 * * 1-5', timezone: 'Asia/Jakarta', maxRetry: 4, retryDelayMs: 30_000 }),
  id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
  status: 'active',
  lastRunAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const expectedOpts = {
  attempts: 5,
  backoff: { type: TASK_BACKOFF_TYPE, delay: 30_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 500 },
};

function fakeQueue() {
  return {
    upsertJobScheduler: vi.fn().mockResolvedValue({}),
    removeJobScheduler: vi.fn().mockResolvedValue(true),
    add: vi.fn().mockResolvedValue({}),
    getJobSchedulers: vi.fn().mockResolvedValue([]),
  };
}

function setup() {
  const queue = fakeQueue();
  return { queue, scheduler: new BullMqScheduler(queue as unknown as TaskQueue) };
}

describe('BullMqScheduler', () => {
  it('upserts one cron scheduler per task with its timezone and retry policy', async () => {
    const { queue, scheduler } = setup();

    await scheduler.upsert(task);

    expect(queue.upsertJobScheduler).toHaveBeenCalledWith(
      `task:${task.id}`,
      { pattern: '0 9 * * 1-5', tz: 'Asia/Jakarta' },
      { name: EXECUTE_JOB_NAME, data: { taskId: task.id, trigger: 'schedule' }, opts: expectedOpts },
    );
  });

  it('removes the scheduler of a task', async () => {
    const { queue, scheduler } = setup();

    await scheduler.remove(task.id);

    expect(queue.removeJobScheduler).toHaveBeenCalledWith(`task:${task.id}`);
  });

  it('queues a manual run with the same retry policy', async () => {
    const { queue, scheduler } = setup();

    await scheduler.runNow(task);

    expect(queue.add).toHaveBeenCalledWith(EXECUTE_JOB_NAME, { taskId: task.id, trigger: 'manual' }, expectedOpts);
  });

  it('lists task ids of existing schedulers and ignores foreign ones', async () => {
    const { queue, scheduler } = setup();
    queue.getJobSchedulers.mockResolvedValue([{ key: 'task:a' }, { key: 'task:b' }, { key: 'something-else' }]);

    expect(await scheduler.scheduledTaskIds()).toEqual(['a', 'b']);
  });

  it('propagates queue failures', async () => {
    const { queue, scheduler } = setup();
    queue.upsertJobScheduler.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(scheduler.upsert(task)).rejects.toThrow('ECONNREFUSED');
  });
});

describe('scheduler ids', () => {
  it('round-trip', () => {
    expect(taskIdFromSchedulerId(schedulerIdFor('abc'))).toBe('abc');
    expect(taskIdFromSchedulerId('other:abc')).toBeNull();
  });
});
