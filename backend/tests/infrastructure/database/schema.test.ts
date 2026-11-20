import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { TASK_LOG_STATUSES, TASK_STATUSES } from '../../../src/domain/task.js';
import { taskLogStatusEnum, taskLogs, taskStatusEnum, tasks } from '../../../src/infrastructure/database/schema.js';

function columnsOf(table: typeof tasks | typeof taskLogs) {
  return Object.fromEntries(getTableConfig(table).columns.map((c) => [c.name, c]));
}

describe('tasks table', () => {
  const config = getTableConfig(tasks);
  const columns = columnsOf(tasks);

  it('has every column the brief requires', () => {
    expect(config.name).toBe('tasks');
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'cron_schedule',
        'webhook_url',
        'payload',
        'max_retry',
        'status',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('stores the payload as JSONB', () => {
    expect(columns.payload?.getSQLType()).toBe('jsonb');
    expect(columns.payload?.notNull).toBe(true);
  });

  it('uses generated uuid ids and timezone-aware timestamps', () => {
    expect(columns.id?.getSQLType()).toBe('uuid');
    expect(columns.id?.primary).toBe(true);
    expect(columns.id?.hasDefault).toBe(true);
    for (const name of ['created_at', 'updated_at', 'last_run_at']) {
      expect(columns[name]?.getSQLType()).toBe('timestamp with time zone');
    }
  });

  it('bounds retries with check constraints', () => {
    expect(config.checks.map((c) => c.name)).toEqual(['tasks_max_retry_range', 'tasks_retry_delay_ms_range']);
  });
});

describe('task_logs table', () => {
  const config = getTableConfig(taskLogs);
  const columns = columnsOf(taskLogs);

  it('has every column the brief requires', () => {
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        'id',
        'task_id',
        'executed_at',
        'status',
        'retry_count',
        'message',
        'created_at',
        'duration_ms',
        'http_status',
      ]),
    );
  });

  it('deletes logs together with their task', () => {
    const [fk] = config.foreignKeys;
    const ref = fk?.reference();

    expect(config.foreignKeys).toHaveLength(1);
    expect(ref?.foreignTable).toBe(tasks);
    expect(ref?.columns.map((c) => c.name)).toEqual(['task_id']);
    expect(fk?.onDelete).toBe('cascade');
  });

  it('indexes logs by task and recency', () => {
    expect(config.indexes.map((i) => i.config.name)).toContain('task_logs_task_id_created_at_idx');
  });
});

describe('enums', () => {
  it('match the domain statuses', () => {
    expect(taskStatusEnum.enumValues).toEqual([...TASK_STATUSES]);
    expect(taskLogStatusEnum.enumValues).toEqual([...TASK_LOG_STATUSES]);
  });
});
