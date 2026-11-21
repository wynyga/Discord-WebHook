import { beforeEach, describe, expect, it } from 'vitest';
import { ExecuteTask } from '../../../src/application/tasks/execute-task.js';
import type { ExecutionRequest } from '../../../src/domain/execution.js';
import type { Task, TaskStatus } from '../../../src/domain/task.js';
import { discordErrors, fakeDiscord, type FakeDiscord } from '../../fakes/fake-discord.js';
import { InMemoryTaskLogRepository } from '../../fakes/in-memory-task-log-repository.js';
import { InMemoryTaskRepository } from '../../fakes/in-memory-task-repository.js';
import { taskInput, WEBHOOK_URL } from '../../fixtures/task.js';

const NOW = new Date('2026-05-01T10:00:00Z');

let tasks: InMemoryTaskRepository;
let logs: InMemoryTaskLogRepository;
let discord: FakeDiscord;
let executeTask: ExecuteTask;

beforeEach(() => {
  tasks = new InMemoryTaskRepository();
  logs = new InMemoryTaskLogRepository(tasks);
  discord = fakeDiscord();
  executeTask = new ExecuteTask(tasks, logs, discord, () => NOW);
});

async function seedTask(status: TaskStatus = 'active'): Promise<Task> {
  return tasks.create({ ...taskInput(), status });
}

function request(task: Task, overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return { taskId: task.id, trigger: 'schedule', attempt: 0, maxRetries: 3, ...overrides };
}

describe('ExecuteTask: delivery', () => {
  it('posts the stored payload to the stored webhook', async () => {
    const task = await seedTask();

    await executeTask.execute(request(task));

    expect(discord.send).toHaveBeenCalledWith(WEBHOOK_URL, taskInput().payload);
  });

  it('fills template variables with the values of this run before sending', async () => {
    const task = await tasks.create({
      ...taskInput({ timezone: 'Asia/Jakarta' }),
      payload: { content: '{{task.name}} on {{run.date}} at {{run.time}}, attempt {{run.attempt}}' },
      status: 'active',
    });

    await executeTask.execute(request(task, { attempt: 2 }));

    // NOW is 10:00 UTC, 17:00 in Jakarta; attempt 2 (0-based) is the third try.
    expect(discord.send).toHaveBeenCalledWith(WEBHOOK_URL, { content: 'Daily report on 1 May 2026 at 17:00, attempt 3' });
    expect((await tasks.findById(task.id))?.payload.content).toContain('{{task.name}}');
  });

  it('logs a success and records the run time', async () => {
    const task = await seedTask();

    const result = await executeTask.execute(request(task));

    expect(result).toEqual({ outcome: 'success' });
    expect(logs.rows).toEqual([
      expect.objectContaining({
        taskId: task.id,
        executedAt: NOW,
        status: 'success',
        retryCount: 0,
        httpStatus: 200,
        durationMs: 42,
        message: 'Delivered to Discord (HTTP 200)',
      }),
    ]);
    expect((await tasks.findById(task.id))?.lastRunAt).toEqual(NOW);
  });

  it('heals a failed task on the next success', async () => {
    const task = await seedTask('failed');

    await executeTask.execute(request(task));

    expect((await tasks.findById(task.id))?.status).toBe('active');
  });
});

describe('ExecuteTask: skips', () => {
  it('skips a task that was deleted after the job was queued', async () => {
    const result = await executeTask.execute({
      taskId: '00000000-0000-4000-8000-000000000000',
      trigger: 'schedule',
      attempt: 0,
      maxRetries: 3,
    });

    expect(result).toEqual({ outcome: 'skipped', reason: 'Task no longer exists' });
    expect(discord.send).not.toHaveBeenCalled();
    expect(logs.rows).toHaveLength(0);
  });

  it('skips a scheduled run of a paused task', async () => {
    const task = await seedTask('paused');

    const result = await executeTask.execute(request(task));

    expect(result).toEqual({ outcome: 'skipped', reason: 'Task is paused' });
    expect(discord.send).not.toHaveBeenCalled();
  });

  it('runs a manual run of a paused task and keeps it paused', async () => {
    const task = await seedTask('paused');

    const result = await executeTask.execute(request(task, { trigger: 'manual' }));

    expect(result).toEqual({ outcome: 'success' });
    expect((await tasks.findById(task.id))?.status).toBe('paused');
  });
});

describe('ExecuteTask: retry mechanism', () => {
  it.each([
    ['server error', discordErrors.serverError],
    ['network error', discordErrors.network],
  ])('asks for a retry after a %s while retries remain', async (_label, makeError) => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(makeError());

    const result = await executeTask.execute(request(task, { attempt: 0, maxRetries: 3 }));

    expect(result).toEqual({ outcome: 'retry' });
    expect(logs.rows[0]).toMatchObject({ status: 'retrying', retryCount: 0 });
    expect(logs.rows[0]?.message).toContain('Retry 1 of 3 scheduled');
    expect((await tasks.findById(task.id))?.status).toBe('active');
  });

  it('passes on the wait Discord asks for after a 429', async () => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(discordErrors.rateLimited(2500));

    const result = await executeTask.execute(request(task));

    expect(result).toEqual({ outcome: 'retry', retryAfterMs: 2500 });
    expect(logs.rows[0]).toMatchObject({ status: 'retrying', httpStatus: 429 });
  });

  it('fails the run and the task once retries are exhausted', async () => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(discordErrors.serverError());

    const result = await executeTask.execute(request(task, { attempt: 3, maxRetries: 3 }));

    expect(result).toEqual({ outcome: 'failed' });
    expect(logs.rows[0]).toMatchObject({ status: 'failed', retryCount: 3, httpStatus: 502 });
    expect(logs.rows[0]?.message).toContain('Gave up after 3 retries');
    expect((await tasks.findById(task.id))?.status).toBe('failed');
  });

  it('fails at once when maxRetry is 0', async () => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(discordErrors.network());

    const result = await executeTask.execute(request(task, { attempt: 0, maxRetries: 0 }));

    expect(result).toEqual({ outcome: 'failed' });
    expect(logs.rows[0]?.message).toContain('Gave up after 0 retries');
  });

  it('does not retry a request Discord rejects as invalid', async () => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(discordErrors.unknownWebhook());

    const result = await executeTask.execute(request(task, { attempt: 0, maxRetries: 5 }));

    expect(result).toEqual({ outcome: 'failed' });
    expect(logs.rows[0]).toMatchObject({ status: 'failed', httpStatus: 404 });
    expect(logs.rows[0]?.message).toBe('Discord rejected the request (HTTP 404: Unknown Webhook). Not retryable');
    expect((await tasks.findById(task.id))?.status).toBe('failed');
  });

  it('keeps a paused task paused when its manual run fails', async () => {
    const task = await seedTask('paused');
    discord.send.mockRejectedValueOnce(discordErrors.unknownWebhook());

    await executeTask.execute(request(task, { trigger: 'manual' }));

    expect((await tasks.findById(task.id))?.status).toBe('paused');
  });

  it('lets unexpected errors bubble up so the queue can retry the job', async () => {
    const task = await seedTask();
    discord.send.mockRejectedValueOnce(new Error('database exploded'));

    await expect(executeTask.execute(request(task))).rejects.toThrow('database exploded');
  });
});
