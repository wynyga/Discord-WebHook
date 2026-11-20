import type { DashboardSummary, Paged, Task, TaskDetail, TaskLog } from '../api/types';

export function taskDetail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    ...task(overrides),
    nextRuns: [
      '2026-11-23T02:00:00.000Z',
      '2026-11-24T02:00:00.000Z',
      '2026-11-25T02:00:00.000Z',
      '2026-11-26T02:00:00.000Z',
      '2026-11-27T02:00:00.000Z',
    ],
    ...overrides,
  };
}

export function task(overrides: Partial<Task> = {}): Task {
  return {
    nextRunAt: '2026-11-23T02:00:00.000Z',
    id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e',
    name: 'Daily report',
    cronSchedule: '0 9 * * 1-5',
    timezone: 'Asia/Jakarta',
    webhookUrl: 'https://discord.com/api/webhooks/123456789012345678/****wxyz',
    payload: { content: 'Task executed successfully!' },
    maxRetry: 3,
    retryDelayMs: 5000,
    status: 'active',
    lastRunAt: null,
    createdAt: '2026-11-20T08:00:00.000Z',
    updatedAt: '2026-11-20T08:00:00.000Z',
    ...overrides,
  };
}

export function log(overrides: Partial<TaskLog> = {}): TaskLog {
  return {
    id: 'log-1',
    taskId: task().id,
    taskName: 'Daily report',
    executedAt: '2026-11-20T09:00:00.000Z',
    status: 'success',
    retryCount: 0,
    httpStatus: 200,
    durationMs: 312,
    message: 'Delivered to Discord (HTTP 200)',
    createdAt: '2026-11-20T09:00:00.000Z',
    ...overrides,
  };
}

/** A dashboard summary with 24 hourly buckets; the last hour holds the given counts. */
export function summary(
  tasks: DashboardSummary['tasks'] = { total: 0, active: 0, paused: 0, failed: 0 },
  lastHour: { success: number; retrying: number; failed: number } = { success: 0, retrying: 0, failed: 0 },
): DashboardSummary {
  const start = Date.parse('2026-11-20T00:00:00.000Z');
  const activity24h = Array.from({ length: 24 }, (_, i) => ({
    hour: new Date(start + i * 3_600_000).toISOString(),
    ...(i === 23 ? lastHour : { success: 0, retrying: 0, failed: 0 }),
  }));
  const total = lastHour.success + lastHour.retrying + lastHour.failed;
  return { tasks, executions24h: { ...lastHour, total }, activity24h };
}

export function page<T>(items: T[], meta: Partial<Paged<T>['meta']> = {}): Paged<T> {
  return { data: items, meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1, ...meta } };
}
