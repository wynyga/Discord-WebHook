import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { TASK_LIMITS, TASK_LOG_STATUSES, TASK_STATUSES, type DiscordPayload } from '../../domain/task.js';

const { maxRetry, retryDelayMs } = TASK_LIMITS;

export const taskStatusEnum = pgEnum('task_status', TASK_STATUSES);
export const taskLogStatusEnum = pgEnum('task_log_status', TASK_LOG_STATUSES);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Check constraints need literal bounds, not bind parameters. */
const between = (column: AnyPgColumn, range: { min: number; max: number }) =>
  sql`${column} BETWEEN ${sql.raw(String(range.min))} AND ${sql.raw(String(range.max))}`;

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: TASK_LIMITS.nameMaxLength }).notNull(),
    cronSchedule: varchar('cron_schedule', { length: TASK_LIMITS.cronMaxLength }).notNull(),
    timezone: varchar('timezone', { length: TASK_LIMITS.timezoneMaxLength }).notNull().default('UTC'),
    webhookUrl: text('webhook_url').notNull(),
    payload: jsonb('payload').$type<DiscordPayload>().notNull(),
    maxRetry: integer('max_retry').notNull().default(maxRetry.default),
    retryDelayMs: integer('retry_delay_ms').notNull().default(retryDelayMs.default),
    status: taskStatusEnum('status').notNull().default('active'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('tasks_status_idx').on(table.status),
    index('tasks_created_at_idx').on(table.createdAt.desc()),
    check('tasks_max_retry_range', between(table.maxRetry, maxRetry)),
    check('tasks_retry_delay_ms_range', between(table.retryDelayMs, retryDelayMs)),
  ],
);

export const taskLogs = pgTable(
  'task_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    executedAt: timestamp('executed_at', { withTimezone: true }).notNull(),
    status: taskLogStatusEnum('status').notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    httpStatus: integer('http_status'),
    durationMs: integer('duration_ms'),
    message: text('message').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index('task_logs_task_id_created_at_idx').on(table.taskId, table.createdAt.desc()),
    index('task_logs_created_at_idx').on(table.createdAt.desc()),
    index('task_logs_status_idx').on(table.status),
    check('task_logs_retry_count_non_negative', sql`${table.retryCount} >= 0`),
    check('task_logs_duration_ms_non_negative', sql`${table.durationMs} >= 0`),
  ],
);

export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
export type TaskLogRow = typeof taskLogs.$inferSelect;
export type NewTaskLogRow = typeof taskLogs.$inferInsert;
