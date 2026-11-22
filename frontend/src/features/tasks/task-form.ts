import type { FieldIssue, Task, TaskInput, TaskUpdate } from '../../api/types';
import { cronForPreset, CUSTOM_PRESET, describeCron, presetFor, SCHEDULE_PRESETS } from '../../lib/cron';
import { builderProblem, builderToCron, cronToBuilder, defaultBuilder, type ScheduleBuilder } from '../../lib/schedule-builder';

/** What the form edits: strings for inputs, converted on submit. */
export interface TaskFormValues {
  name: string;
  schedulePreset: string;
  /** Used when `schedulePreset` is custom. */
  schedule: ScheduleBuilder;
  timezone: string;
  webhookUrl: string;
  payload: string;
  maxRetry: string;
  /** Seconds in the form, milliseconds in the API. */
  retryDelay: string;
}

export type TaskFormField = 'name' | 'schedule' | 'timezone' | 'webhookUrl' | 'payload' | 'maxRetry' | 'retryDelay';
export type TaskFormErrors = Partial<Record<TaskFormField, string>>;
export type FormMode = 'create' | 'edit';

/** DOM order; the first invalid one gets focus after a failed submit. */
export const FIELD_ORDER: readonly TaskFormField[] = [
  'name',
  'schedule',
  'timezone',
  'webhookUrl',
  'payload',
  'maxRetry',
  'retryDelay',
];

export const EXAMPLE_PAYLOAD = {
  content: 'Task executed successfully!',
  username: 'Task Bot',
  embeds: [{ title: 'Task Completed', description: 'Task #123 has been completed', color: 3066993 }],
};

const WEBHOOK_URL = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api(?:\/v\d+)?\/webhooks\/\d{17,20}\/[\w-]+\/?$/;

export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function emptyValues(): TaskFormValues {
  return {
    name: '',
    schedulePreset: SCHEDULE_PRESETS[0]!.id,
    schedule: defaultBuilder(),
    timezone: defaultTimezone(),
    webhookUrl: '',
    payload: JSON.stringify(EXAMPLE_PAYLOAD, null, 2),
    maxRetry: '3',
    retryDelay: '5',
  };
}

/** The webhook stays empty: the API only returns it masked, and empty means "keep the stored one". */
export function valuesFromTask(task: Task): TaskFormValues {
  const preset = presetFor(task.cronSchedule);
  return {
    name: task.name,
    schedulePreset: preset,
    schedule: preset === CUSTOM_PRESET ? cronToBuilder(task.cronSchedule) : defaultBuilder(),
    timezone: task.timezone,
    webhookUrl: '',
    payload: JSON.stringify(task.payload, null, 2),
    maxRetry: String(task.maxRetry),
    retryDelay: String(task.retryDelayMs / 1000),
  };
}

export function cronOf(values: TaskFormValues): string {
  return values.schedulePreset === CUSTOM_PRESET ? (builderToCron(values.schedule) ?? '') : (cronForPreset(values.schedulePreset) ?? '');
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function parsePayload(text: string): { value?: Record<string, unknown>; error?: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: 'Payload must be valid JSON.' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Payload must be a JSON object.' };
  const payload = value as { content?: unknown; embeds?: unknown };
  const hasContent = typeof payload.content === 'string' && payload.content.trim() !== '';
  const hasEmbeds = Array.isArray(payload.embeds) && payload.embeds.length > 0;
  if (!hasContent && !hasEmbeds) return { error: 'Payload needs "content" or at least one item in "embeds".' };
  return { value: value as Record<string, unknown> };
}

/**
 * Client checks for fast feedback; the API validates everything again (Discord limits, overlap of
 * retries with the schedule) and its answer is shown the same way.
 */
export function validateField(field: TaskFormField, values: TaskFormValues, mode: FormMode): string | undefined {
  switch (field) {
    case 'name':
      if (!values.name.trim()) return 'Enter a name.';
      if (values.name.trim().length > 100) return 'Use at most 100 characters.';
      return undefined;
    case 'schedule':
      if (values.schedulePreset !== CUSTOM_PRESET) return undefined;
      return (
        builderProblem(values.schedule) ??
        (describeCron(cronOf(values)) ? undefined : 'Use 5 fields: minute hour day month weekday, e.g. "*/5 * * * *".')
      );
    case 'timezone':
      return isValidTimezone(values.timezone.trim()) ? undefined : 'Pick a timezone from the list, e.g. "Asia/Jakarta".';
    case 'webhookUrl': {
      const url = values.webhookUrl.trim();
      if (!url) return mode === 'create' ? 'Enter the Discord webhook URL.' : undefined;
      return WEBHOOK_URL.test(url) ? undefined : 'Use a Discord webhook URL: https://discord.com/api/webhooks/<id>/<token>';
    }
    case 'payload':
      return parsePayload(values.payload).error;
    case 'maxRetry': {
      const n = Number(values.maxRetry);
      return values.maxRetry.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= 10
        ? undefined
        : 'Enter a whole number from 0 to 10.';
    }
    case 'retryDelay': {
      const n = Number(values.retryDelay);
      return values.retryDelay.trim() !== '' && Number.isFinite(n) && n >= 1 && n <= 3600
        ? undefined
        : 'Enter seconds from 1 to 3600.';
    }
  }
}

export function validateAll(values: TaskFormValues, mode: FormMode): TaskFormErrors {
  const errors: TaskFormErrors = {};
  for (const field of FIELD_ORDER) {
    const message = validateField(field, values, mode);
    if (message) errors[field] = message;
  }
  return errors;
}

export function toTaskInput(values: TaskFormValues): TaskInput {
  return {
    name: values.name.trim(),
    cronSchedule: cronOf(values),
    timezone: values.timezone.trim(),
    webhookUrl: values.webhookUrl.trim(),
    payload: parsePayload(values.payload).value ?? {},
    maxRetry: Number(values.maxRetry),
    retryDelayMs: Math.round(Number(values.retryDelay) * 1000),
  };
}

/** Same as create, but an empty webhook is left out so the stored one is kept. */
export function toTaskUpdate(values: TaskFormValues): TaskUpdate {
  const { webhookUrl, ...rest } = toTaskInput(values);
  return webhookUrl ? { ...rest, webhookUrl } : rest;
}

const API_FIELD: Record<string, TaskFormField> = {
  name: 'name',
  cronSchedule: 'schedule',
  timezone: 'timezone',
  webhookUrl: 'webhookUrl',
  payload: 'payload',
  maxRetry: 'maxRetry',
  retryDelayMs: 'retryDelay',
};

/**
 * Maps API issues (`payload.embeds.0.title`) onto form fields. Issues without a matching field are
 * returned separately for a form-level message.
 */
export function errorsFromApi(issues: FieldIssue[]): { fields: TaskFormErrors; other: string[] } {
  const fields: TaskFormErrors = {};
  const other: string[] = [];
  for (const { path, message } of issues) {
    const [head, ...rest] = path.split('.');
    const field = head ? API_FIELD[head] : undefined;
    if (!field) {
      other.push(path ? `${path}: ${message}` : message);
      continue;
    }
    const text = field === 'payload' && rest.length > 0 ? `${rest.join('.')}: ${message}` : message;
    fields[field] = fields[field] ? `${fields[field]} ${text}` : text;
  }
  return { fields, other };
}
