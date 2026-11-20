import { maskWebhookUrl } from '../../../domain/discord-webhook.js';
import type { Page } from '../../../domain/pagination.js';
import { nextRuns } from '../../../domain/schedule.js';
import type { Task } from '../../../domain/task.js';

const DETAIL_NEXT_RUNS = 5;

/** API shape of a task; the webhook token never leaves the server. */
export function toTaskResponse(task: Task, now = new Date()) {
  // A paused task has no upcoming run.
  const upcoming = task.status === 'paused' ? null : nextRuns(task.cronSchedule, task.timezone, 1, now)[0];
  return {
    id: task.id,
    name: task.name,
    cronSchedule: task.cronSchedule,
    timezone: task.timezone,
    webhookUrl: maskWebhookUrl(task.webhookUrl),
    payload: task.payload,
    maxRetry: task.maxRetry,
    retryDelayMs: task.retryDelayMs,
    status: task.status,
    lastRunAt: task.lastRunAt?.toISOString() ?? null,
    nextRunAt: upcoming?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Detail view: adds the next few run times, empty while paused. */
export function toTaskDetailResponse(task: Task, now = new Date()) {
  return {
    ...toTaskResponse(task, now),
    nextRuns:
      task.status === 'paused'
        ? []
        : nextRuns(task.cronSchedule, task.timezone, DETAIL_NEXT_RUNS, now).map((date) => date.toISOString()),
  };
}

export function toPageResponse<T, R>(page: Page<T>, map: (item: T) => R) {
  return {
    data: page.items.map(map),
    meta: {
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: Math.ceil(page.total / page.pageSize),
    },
  };
}
