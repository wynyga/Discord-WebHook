import { Queue } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExecuteTask } from '../../src/application/tasks/execute-task.js';
import { ReconcileSchedules } from '../../src/application/tasks/reconcile-schedules.js';
import type { Task } from '../../src/domain/task.js';
import { createRedisConnection, type RedisConnection } from '../../src/infrastructure/redis.js';
import { BullMqScheduler } from '../../src/infrastructure/scheduler/bullmq-scheduler.js';
import { TASK_QUEUE_NAME, type TaskJobData } from '../../src/infrastructure/scheduler/task-queue.js';
import { TaskWorker } from '../../src/infrastructure/scheduler/task-worker.js';
import { discordErrors, fakeDiscord } from '../fakes/fake-discord.js';
import { InMemoryTaskLogRepository } from '../fakes/in-memory-task-log-repository.js';
import { InMemoryTaskRepository } from '../fakes/in-memory-task-repository.js';
import { taskInput } from '../fixtures/task.js';
import { silentLogger } from '../helpers/logger.js';

/**
 * Runs against a real Redis: `TEST_REDIS_URL=redis://localhost:6379 npm test`.
 * Skipped otherwise. It flushes the given Redis database, so never point it at real data.
 */
const REDIS_URL = process.env.TEST_REDIS_URL;

async function waitFor(condition: () => boolean, timeoutMs = 15_000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error('Timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe.skipIf(!REDIS_URL)('BullMQ integration (real Redis)', () => {
  let redis: RedisConnection;
  let queue: Queue<TaskJobData>;
  let worker: TaskWorker;
  let tasks: InMemoryTaskRepository;
  let logs: InMemoryTaskLogRepository;
  let discord: ReturnType<typeof fakeDiscord>;
  let scheduler: BullMqScheduler;

  beforeAll(async () => {
    redis = createRedisConnection(REDIS_URL!);
    await redis.client.flushdb();
    queue = new Queue<TaskJobData>(TASK_QUEUE_NAME, { connection: redis.client });
    scheduler = new BullMqScheduler(queue);
  });

  beforeEach(async () => {
    tasks = new InMemoryTaskRepository();
    logs = new InMemoryTaskLogRepository(tasks);
    discord = fakeDiscord();
    const execute = new ExecuteTask(tasks, logs, discord);
    // A previous worker would pick up this test's jobs with the previous test's fakes.
    if (worker) await worker.close();
    worker = new TaskWorker(redis.client, (request) => execute.execute(request), silentLogger(), 2);
    worker.start();
  });

  afterAll(async () => {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await redis.close();
  });

  async function createTask(overrides: Partial<Task> = {}) {
    return tasks.create({ ...taskInput({ maxRetry: 2, retryDelayMs: 1000, ...overrides }), status: 'active' });
  }

  it('answers a ping', async () => {
    await expect(redis.ping()).resolves.toBeUndefined();
  });

  it('retries with the task delay and stops at the first success', async () => {
    const task = await createTask();
    discord.send.mockRejectedValueOnce(discordErrors.serverError()).mockRejectedValueOnce(discordErrors.network());

    await scheduler.runNow(task);
    await waitFor(() => logs.rows.some((l) => l.status === 'success'));

    expect(logs.rows.map((l) => [l.status, l.retryCount])).toEqual([
      ['retrying', 0],
      ['retrying', 1],
      ['success', 2],
    ]);
    const [first, , last] = logs.rows;
    expect(last!.executedAt.getTime() - first!.executedAt.getTime()).toBeGreaterThanOrEqual(1900);
  });

  it('gives up after maxRetry retries and marks the task failed', async () => {
    const task = await createTask({ maxRetry: 1 });
    discord.send.mockRejectedValue(discordErrors.serverError());

    await scheduler.runNow(task);
    await waitFor(() => logs.rows.some((l) => l.status === 'failed'));
    await new Promise((resolve) => setTimeout(resolve, 1500)); // no extra attempt may follow

    expect(logs.rows.map((l) => l.status)).toEqual(['retrying', 'failed']);
    expect((await tasks.findById(task.id))?.status).toBe('failed');
  });

  it('does not retry a non-retryable error', async () => {
    const task = await createTask();
    discord.send.mockRejectedValue(discordErrors.unknownWebhook());

    await scheduler.runNow(task);
    await waitFor(() => logs.rows.length > 0);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    expect(logs.rows.map((l) => l.status)).toEqual(['failed']);
  });

  it('waits as long as Discord asks after a 429', async () => {
    const task = await createTask();
    discord.send.mockRejectedValueOnce(discordErrors.rateLimited(2500));

    await scheduler.runNow(task);
    await waitFor(() => logs.rows.some((l) => l.status === 'success'));

    const [limited, success] = logs.rows;
    expect(success!.executedAt.getTime() - limited!.executedAt.getTime()).toBeGreaterThanOrEqual(2400);
  });

  it('registers, reconciles and removes cron schedules', async () => {
    const kept = await createTask({ cronSchedule: '0 9 * * *', timezone: 'Asia/Jakarta' });
    const paused = await createTask();
    await scheduler.upsert(kept);
    await scheduler.upsert(paused);
    await tasks.update(paused.id, { status: 'paused' });

    await new ReconcileSchedules(tasks, scheduler).execute();
    const [schedule] = await queue.getJobSchedulers();

    expect(await scheduler.scheduledTaskIds()).toEqual([kept.id]);
    expect(schedule).toMatchObject({ key: `task:${kept.id}`, pattern: '0 9 * * *', tz: 'Asia/Jakarta' });

    await scheduler.remove(kept.id);
    expect(await scheduler.scheduledTaskIds()).toEqual([]);
  });
});
