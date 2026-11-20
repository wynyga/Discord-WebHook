import type { Paged, Task, TaskLog } from '../api/types';

export function task(overrides: Partial<Task> = {}): Task {
  return {
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

export function page<T>(items: T[], meta: Partial<Paged<T>['meta']> = {}): Paged<T> {
  return { data: items, meta: { page: 1, pageSize: 10, total: items.length, totalPages: 1, ...meta } };
}
