import type { TaskInput } from '../../src/domain/task.js';

export const WEBHOOK_URL = 'https://discord.com/api/webhooks/123456789012345678/abcDEF_ghi-JKL0123456789wxyz';

export function taskInput(overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    name: 'Daily report',
    cronSchedule: '*/5 * * * *',
    timezone: 'UTC',
    webhookUrl: WEBHOOK_URL,
    payload: {
      content: 'Task executed successfully!',
      username: 'Task Bot',
      embeds: [{ title: 'Task Completed', description: 'Task #123 has been completed', color: 3066993 }],
    },
    maxRetry: 3,
    retryDelayMs: 5000,
    ...overrides,
  };
}
