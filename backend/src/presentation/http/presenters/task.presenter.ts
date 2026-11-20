import { maskWebhookUrl } from '../../../domain/discord-webhook.js';
import type { Page } from '../../../domain/pagination.js';
import type { Task } from '../../../domain/task.js';

/** API shape of a task; the webhook token never leaves the server. */
export function toTaskResponse(task: Task) {
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
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
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
