import { z } from 'zod';
import { isDiscordWebhookUrl } from '../../../domain/discord-webhook.js';
import { isValidCron, isValidTimezone } from '../../../domain/schedule.js';
import { TASK_LIMITS, TASK_STATUSES } from '../../../domain/task.js';
import { pageQueryShape } from './pagination.schema.js';
import { payloadTemplateSchema } from './payload-template.schema.js';

const { maxRetry, retryDelayMs } = TASK_LIMITS;

/** Shared fields without defaults, so a PATCH never resets omitted values. */
const taskFields = {
  name: z.string().trim().min(1).max(TASK_LIMITS.nameMaxLength),
  cronSchedule: z
    .string()
    .trim()
    .max(TASK_LIMITS.cronMaxLength)
    .refine(isValidCron, 'Must be a 5-field cron expression, e.g. "*/5 * * * *"'),
  timezone: z
    .string()
    .trim()
    .max(TASK_LIMITS.timezoneMaxLength)
    .refine(isValidTimezone, 'Must be an IANA timezone, e.g. "Asia/Jakarta"'),
  webhookUrl: z
    .string()
    .trim()
    .max(500)
    .refine(isDiscordWebhookUrl, 'Must be a Discord webhook URL: https://discord.com/api/webhooks/<id>/<token>'),
  payload: payloadTemplateSchema,
  maxRetry: z.int().min(maxRetry.min).max(maxRetry.max),
  retryDelayMs: z.int().min(retryDelayMs.min).max(retryDelayMs.max),
};

export const createTaskSchema = z.strictObject({
  ...taskFields,
  timezone: taskFields.timezone.default('UTC'),
  maxRetry: taskFields.maxRetry.default(maxRetry.default),
  retryDelayMs: taskFields.retryDelayMs.default(retryDelayMs.default),
});

export const updateTaskSchema = z
  .strictObject(taskFields)
  .partial()
  .refine((changes) => Object.keys(changes).length > 0, 'Provide at least one field to update');

export const listTasksQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  ...pageQueryShape,
});

export const taskIdParamsSchema = z.object({ id: z.uuid('Task id must be a UUID') });
