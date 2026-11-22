import { describe, expect, it } from 'vitest';
import { task } from '../../test/fixtures';
import {
  emptyValues,
  errorsFromApi,
  toTaskInput,
  toTaskUpdate,
  validateAll,
  validateField,
  valuesFromTask,
  type TaskFormValues,
} from './task-form';
import { cronToBuilder, defaultBuilder } from '../../lib/schedule-builder';

const WEBHOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';

function values(overrides: Partial<TaskFormValues> = {}): TaskFormValues {
  return { ...emptyValues(), name: 'Ping', webhookUrl: WEBHOOK, timezone: 'UTC', ...overrides };
}

describe('validation', () => {
  it('accepts a complete form', () => {
    expect(validateAll(values(), 'create')).toEqual({});
  });

  it.each([
    ['name', { name: '  ' }, 'Enter a name.'],
    ['name', { name: 'x'.repeat(101) }, 'Use at most 100 characters.'],
    ['schedule', { schedulePreset: 'custom', schedule: { ...defaultBuilder(), frequency: 'cron', cron: '' } }, 'Enter a cron expression.'],
    ['schedule', { schedulePreset: 'custom', schedule: { ...defaultBuilder(), frequency: 'cron', cron: '0 0 * * * *' } }, 'Use 5 fields'],
    ['schedule', { schedulePreset: 'custom', schedule: { ...defaultBuilder(), frequency: 'daily', time: '' } }, 'Pick a time.'],
    ['schedule', { schedulePreset: 'custom', schedule: { ...defaultBuilder(), frequency: 'weekly', weekdays: [] as number[] } }, 'Pick at least one day.'],
    ['timezone', { timezone: 'Mars/Base' }, 'Pick a timezone'],
    ['webhookUrl', { webhookUrl: '' }, 'Enter the Discord webhook URL.'],
    ['webhookUrl', { webhookUrl: 'https://example.com/hook' }, 'Use a Discord webhook URL'],
    ['payload', { payload: '{oops' }, 'Payload must be valid JSON.'],
    ['payload', { payload: '[1,2]' }, 'Payload must be a JSON object.'],
    ['payload', { payload: '{"username":"bot"}' }, 'needs "content"'],
    ['maxRetry', { maxRetry: '11' }, 'from 0 to 10'],
    ['maxRetry', { maxRetry: '1.5' }, 'from 0 to 10'],
    ['maxRetry', { maxRetry: '' }, 'from 0 to 10'],
    ['retryDelay', { retryDelay: '0' }, 'from 1 to 3600'],
  ] as const)('reports %s for %j', (field, override, message) => {
    expect(validateField(field, values(override), 'create')).toContain(message);
  });

  it('allows an empty webhook when editing (keeps the stored one)', () => {
    expect(validateField('webhookUrl', values({ webhookUrl: '' }), 'edit')).toBeUndefined();
  });

  it('accepts other Discord webhook hosts', () => {
    const url = 'https://canary.discord.com/api/v10/webhooks/123456789012345678/tok';
    expect(validateField('webhookUrl', values({ webhookUrl: url }), 'create')).toBeUndefined();
  });

  it('ignores the custom schedule while a preset is chosen', () => {
    const junk = { ...defaultBuilder(), frequency: 'cron' as const, cron: 'junk' };
    expect(validateField('schedule', values({ schedulePreset: 'hourly', schedule: junk }), 'create')).toBeUndefined();
  });
});

describe('conversion', () => {
  it('builds the API input: preset cron, parsed payload, seconds to ms', () => {
    const input = toTaskInput(values({ schedulePreset: 'weekdays', retryDelay: '2.5', maxRetry: '4', name: ' Ping ' }));

    expect(input).toMatchObject({
      name: 'Ping',
      cronSchedule: '0 9 * * 1-5',
      maxRetry: 4,
      retryDelayMs: 2500,
      webhookUrl: WEBHOOK,
    });
    expect(input.payload).toHaveProperty('content', 'Task executed successfully!');
  });

  it('uses the custom schedule when chosen', () => {
    const weekly = { ...defaultBuilder(), frequency: 'weekly' as const, time: '14:30', weekdays: [4, 1] };
    expect(toTaskInput(values({ schedulePreset: 'custom', schedule: weekly })).cronSchedule).toBe('30 14 * * 1,4');
    const raw = { ...defaultBuilder(), frequency: 'cron' as const, cron: ' 15 3 * * * ' };
    expect(toTaskInput(values({ schedulePreset: 'custom', schedule: raw })).cronSchedule).toBe('15 3 * * *');
  });

  it('leaves out an empty webhook on update', () => {
    expect(toTaskUpdate(values({ webhookUrl: '' }))).not.toHaveProperty('webhookUrl');
    expect(toTaskUpdate(values())).toHaveProperty('webhookUrl', WEBHOOK);
  });

  it('fills the form from a task without its masked webhook', () => {
    const form = valuesFromTask(task({ cronSchedule: '15 3 * * *', retryDelayMs: 30_000 }));

    expect(form).toMatchObject({
      schedulePreset: 'custom',
      schedule: cronToBuilder('15 3 * * *'),
      webhookUrl: '',
      retryDelay: '30',
      maxRetry: '3',
      timezone: 'Asia/Jakarta',
    });
    expect(JSON.parse(form.payload)).toEqual({ content: 'Task executed successfully!' });
  });

  it('recognises a preset schedule', () => {
    expect(valuesFromTask(task({ cronSchedule: '0 * * * *' }))).toMatchObject({ schedulePreset: 'hourly' });
  });
});

describe('errorsFromApi', () => {
  it('maps API paths onto form fields', () => {
    const { fields, other } = errorsFromApi([
      { path: 'cronSchedule', message: 'Bad cron' },
      { path: 'retryDelayMs', message: 'Too small' },
      { path: 'payload.embeds.0.title', message: 'Too long' },
      { path: 'payload', message: 'Needs content' },
      { path: 'status', message: 'Unknown key' },
      { path: '', message: 'Body problem' },
    ]);

    expect(fields).toEqual({
      schedule: 'Bad cron',
      retryDelay: 'Too small',
      payload: 'embeds.0.title: Too long Needs content',
    });
    expect(other).toEqual(['status: Unknown key', 'Body problem']);
  });
});
