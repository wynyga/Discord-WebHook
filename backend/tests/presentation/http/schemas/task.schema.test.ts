import { describe, expect, it } from 'vitest';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamsSchema,
  updateTaskSchema,
} from '../../../../src/presentation/http/schemas/task.schema.js';
import { taskInput, WEBHOOK_URL } from '../../../fixtures/task.js';

const minimal = { name: 'Ping', cronSchedule: '*/5 * * * *', webhookUrl: WEBHOOK_URL, payload: { content: 'hi' } };

describe('createTaskSchema', () => {
  it('fills defaults for timezone and retries', () => {
    expect(createTaskSchema.parse(minimal)).toEqual({
      ...minimal,
      timezone: 'UTC',
      maxRetry: 3,
      retryDelayMs: 5000,
    });
  });

  it('trims text fields', () => {
    expect(createTaskSchema.parse({ ...minimal, name: '  Ping  ' }).name).toBe('Ping');
  });

  it.each([
    ['empty name', { name: '' }],
    ['long name', { name: 'x'.repeat(101) }],
    ['bad cron', { cronSchedule: 'every minute' }],
    ['cron with seconds', { cronSchedule: '0 */5 * * * *' }],
    ['bad timezone', { timezone: 'Mars/Olympus' }],
    ['non-Discord webhook', { webhookUrl: 'https://example.com/hook' }],
    ['negative retries', { maxRetry: -1 }],
    ['too many retries', { maxRetry: 11 }],
    ['fractional retries', { maxRetry: 1.5 }],
    ['delay too short', { retryDelayMs: 999 }],
    ['delay too long', { retryDelayMs: 3_600_001 }],
    ['invalid payload', { payload: {} }],
    ['status is not settable', { status: 'paused' }],
  ])('rejects %s', (_label, override) => {
    expect(createTaskSchema.safeParse({ ...minimal, ...override }).success).toBe(false);
  });

  it.each(['name', 'cronSchedule', 'webhookUrl', 'payload'])('requires %s', (field) => {
    const input: Record<string, unknown> = { ...minimal };
    delete input[field];

    expect(createTaskSchema.safeParse(input).success).toBe(false);
  });
});

describe('updateTaskSchema', () => {
  it('keeps omitted fields out instead of applying defaults', () => {
    expect(updateTaskSchema.parse({ name: 'New' })).toEqual({ name: 'New' });
  });

  it('accepts a full task', () => {
    expect(updateTaskSchema.safeParse(taskInput()).success).toBe(true);
  });

  it('rejects an empty body', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('validates the fields it gets', () => {
    expect(updateTaskSchema.safeParse({ cronSchedule: 'nope' }).success).toBe(false);
  });
});

describe('listTasksQuerySchema', () => {
  it('coerces query strings and applies defaults', () => {
    expect(listTasksQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(listTasksQuerySchema.parse({ page: '2', pageSize: '50', status: 'failed' })).toEqual({
      page: 2,
      pageSize: 50,
      status: 'failed',
    });
  });

  it.each([{ page: '0' }, { pageSize: '101' }, { status: 'running' }, { page: 'abc' }])('rejects %j', (query) => {
    expect(listTasksQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('taskIdParamsSchema', () => {
  it('requires a UUID', () => {
    expect(taskIdParamsSchema.safeParse({ id: '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e' }).success).toBe(true);
    expect(taskIdParamsSchema.safeParse({ id: '42' }).success).toBe(false);
  });
});
