import { beforeEach, describe, expect, it } from 'vitest';
import { GetDashboardSummary } from '../../src/application/dashboard/get-dashboard-summary.js';
import { ListLogs } from '../../src/application/logs/list-logs.js';
import { NotFoundError } from '../../src/domain/errors.js';
import type { TaskLogStatus } from '../../src/domain/task.js';
import { InMemoryTaskLogRepository } from '../fakes/in-memory-task-log-repository.js';
import { InMemoryTaskRepository } from '../fakes/in-memory-task-repository.js';
import { taskInput } from '../fixtures/task.js';

const NOW = new Date('2026-05-01T12:00:00Z');
const HOUR = 60 * 60 * 1000;

let tasks: InMemoryTaskRepository;
let logs: InMemoryTaskLogRepository;

beforeEach(() => {
  tasks = new InMemoryTaskRepository();
  logs = new InMemoryTaskLogRepository(tasks);
});

function addLog(taskId: string, status: TaskLogStatus, hoursAgo: number) {
  return logs.create({
    taskId,
    executedAt: new Date(NOW.getTime() - hoursAgo * HOUR),
    status,
    retryCount: 0,
    httpStatus: 200,
    durationMs: 10,
    message: status,
  });
}

describe('ListLogs', () => {
  it('lists logs with task names, filtered by task', async () => {
    const a = await tasks.create({ ...taskInput({ name: 'A' }), status: 'active' });
    const b = await tasks.create({ ...taskInput({ name: 'B' }), status: 'active' });
    await addLog(a.id, 'success', 1);
    await addLog(b.id, 'failed', 1);

    const all = await new ListLogs(logs, tasks).execute({ page: 1, pageSize: 10 });
    const onlyA = await new ListLogs(logs, tasks).execute({ page: 1, pageSize: 10, taskId: a.id });

    expect(all.total).toBe(2);
    expect(onlyA.items).toEqual([expect.objectContaining({ taskId: a.id, taskName: 'A' })]);
  });

  it('throws NotFoundError when filtering by an unknown task', async () => {
    await expect(
      new ListLogs(logs, tasks).execute({ page: 1, pageSize: 10, taskId: '00000000-0000-4000-8000-000000000000' }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('GetDashboardSummary', () => {
  it('counts tasks by status and executions of the last 24 hours', async () => {
    const active = await tasks.create({ ...taskInput(), status: 'active' });
    await tasks.create({ ...taskInput(), status: 'active' });
    await tasks.create({ ...taskInput(), status: 'paused' });
    await tasks.create({ ...taskInput(), status: 'failed' });
    await addLog(active.id, 'success', 1);
    await addLog(active.id, 'retrying', 2);
    await addLog(active.id, 'failed', 23);
    await addLog(active.id, 'success', 25); // older than 24h

    const summary = await new GetDashboardSummary(tasks, logs, () => NOW).execute();

    expect(summary).toEqual({
      tasks: { total: 4, active: 2, paused: 1, failed: 1 },
      executions24h: { total: 3, success: 1, retrying: 1, failed: 1 },
    });
  });
});
