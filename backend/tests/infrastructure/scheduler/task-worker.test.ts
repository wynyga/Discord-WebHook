import { UnrecoverableError, type Job, type MinimalJob } from 'bullmq';
import { describe, expect, it, vi } from 'vitest';
import { ExecuteTask } from '../../../src/application/tasks/execute-task.js';
import type { ExecutionHandler, ExecutionResult } from '../../../src/domain/execution.js';
import { jobOptionsFor, type TaskJobData } from '../../../src/infrastructure/scheduler/task-queue.js';
import {
  processTaskJob,
  RetryLaterError,
  taskBackoffStrategy,
} from '../../../src/infrastructure/scheduler/task-worker.js';
import { discordErrors, fakeDiscord } from '../../fakes/fake-discord.js';
import { InMemoryTaskLogRepository } from '../../fakes/in-memory-task-log-repository.js';
import { InMemoryTaskRepository } from '../../fakes/in-memory-task-repository.js';
import { taskInput } from '../../fixtures/task.js';

type FakeJob = Pick<Job<TaskJobData>, 'data' | 'attemptsMade' | 'opts'>;

function job(attemptsMade: number, maxRetry = 3, retryDelayMs = 5000): FakeJob {
  return {
    data: { taskId: 'task-1', trigger: 'schedule' },
    attemptsMade,
    opts: jobOptionsFor({ maxRetry, retryDelayMs }),
  };
}

const handlerReturning = (result: ExecutionResult) => vi.fn<ExecutionHandler>().mockResolvedValue(result);

describe('processTaskJob', () => {
  it('passes the attempt number and retry budget to the handler', async () => {
    const handler = handlerReturning({ outcome: 'success' });

    await processTaskJob(job(2, 4), handler);

    expect(handler).toHaveBeenCalledWith({ taskId: 'task-1', trigger: 'schedule', attempt: 2, maxRetries: 4 });
  });

  it.each([{ outcome: 'success' }, { outcome: 'skipped', reason: 'Task is paused' }] as const)(
    'completes the job on $outcome',
    async (result) => {
      await expect(processTaskJob(job(0), handlerReturning(result))).resolves.toEqual(result);
    },
  );

  it('throws RetryLaterError so BullMQ retries', async () => {
    const err = await processTaskJob(job(0), handlerReturning({ outcome: 'retry', retryAfterMs: 2500 })).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(RetryLaterError);
    expect((err as RetryLaterError).retryAfterMs).toBe(2500);
  });

  it('throws UnrecoverableError so BullMQ stops retrying', async () => {
    await expect(processTaskJob(job(0), handlerReturning({ outcome: 'failed' }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('treats a job without attempts as having no retries', async () => {
    const handler = handlerReturning({ outcome: 'success' });

    await processTaskJob({ ...job(0), opts: {} }, handler);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
  });
});

describe('taskBackoffStrategy', () => {
  const minimal = (delay?: number) => ({ opts: { backoff: { type: 'task-delay', delay } } }) as unknown as MinimalJob;

  it("waits the task's retry delay", () => {
    expect(taskBackoffStrategy(1, 'task-delay', new RetryLaterError(), minimal(5000))).toBe(5000);
  });

  it('waits longer when Discord asked for it', () => {
    expect(taskBackoffStrategy(1, 'task-delay', new RetryLaterError(12_000), minimal(5000))).toBe(12_000);
  });

  it('never waits less than the task delay', () => {
    expect(taskBackoffStrategy(1, 'task-delay', new RetryLaterError(100), minimal(5000))).toBe(5000);
  });

  it('copes with a missing job or delay', () => {
    expect(taskBackoffStrategy(1, 'task-delay', new Error('x'), undefined)).toBe(0);
    expect(taskBackoffStrategy(1, 'task-delay', new Error('x'), minimal(undefined))).toBe(0);
  });
});

/**
 * Plays BullMQ's part (attempt counter, stop on UnrecoverableError, stop when attempts run out)
 * around the real worker logic and use case, to show the whole retry flow end to end.
 */
async function runLikeBullMq(maxRetry: number, handler: ExecutionHandler) {
  const attempts = maxRetry + 1;
  for (let attemptsMade = 0; attemptsMade < attempts; attemptsMade++) {
    try {
      return { result: await processTaskJob(job(attemptsMade, maxRetry), handler), runs: attemptsMade + 1 };
    } catch (err) {
      if (err instanceof UnrecoverableError) return { result: 'failed' as const, runs: attemptsMade + 1 };
    }
  }
  return { result: 'failed' as const, runs: attempts };
}

describe('retry flow end to end', () => {
  async function setup(status: 'active' | 'failed' = 'active') {
    const tasks = new InMemoryTaskRepository();
    const logs = new InMemoryTaskLogRepository(tasks);
    const discord = fakeDiscord();
    const task = await tasks.create({ ...taskInput({ maxRetry: 3 }), status });
    const execute = new ExecuteTask(tasks, logs, discord);
    const handler: ExecutionHandler = (request) => execute.execute({ ...request, taskId: task.id });
    return { tasks, logs, discord, task, handler };
  }

  it('recovers when a retry succeeds', async () => {
    const { logs, discord, handler } = await setup();
    discord.send.mockRejectedValueOnce(discordErrors.serverError()).mockRejectedValueOnce(discordErrors.network());

    const { result, runs } = await runLikeBullMq(3, handler);

    expect(result).toEqual({ outcome: 'success' });
    expect(runs).toBe(3);
    expect(logs.rows.map((l) => [l.status, l.retryCount])).toEqual([
      ['retrying', 0],
      ['retrying', 1],
      ['success', 2],
    ]);
  });

  it('stops after maxRetry retries and marks the task failed', async () => {
    const { tasks, logs, discord, task, handler } = await setup();
    discord.send.mockRejectedValue(discordErrors.serverError());

    const { result, runs } = await runLikeBullMq(3, handler);

    expect(result).toBe('failed');
    expect(runs).toBe(4);
    expect(logs.rows.map((l) => l.status)).toEqual(['retrying', 'retrying', 'retrying', 'failed']);
    expect((await tasks.findById(task.id))?.status).toBe('failed');
  });

  it('stops at once on a non-retryable error', async () => {
    const { logs, discord, handler } = await setup();
    discord.send.mockRejectedValue(discordErrors.unknownWebhook());

    const { runs } = await runLikeBullMq(3, handler);

    expect(runs).toBe(1);
    expect(logs.rows.map((l) => l.status)).toEqual(['failed']);
  });
});
