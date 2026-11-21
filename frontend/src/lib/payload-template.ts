/**
 * Mirror of the backend's template variables (backend/src/domain/payload-template.ts). The backend
 * fills them at send time and validates them on save; here they power the insert buttons and the
 * preview.
 */
import { describeCron } from './cron';

/** Same cut as the backend's `scheduleTextMaxLength`. */
const SCHEDULE_TEXT_MAX = 200;

export const TEMPLATE_VARIABLES = [
  { name: 'task.name', description: 'Task name' },
  { name: 'task.schedule', description: 'Schedule in words, e.g. Every 5 minutes' },
  { name: 'task.cron', description: 'Cron expression, e.g. */5 * * * *' },
  { name: 'task.timezone', description: 'Task timezone' },
  { name: 'run.date', description: 'Run date, e.g. 21 Nov 2026' },
  { name: 'run.time', description: 'Run time, e.g. 09:00' },
  { name: 'run.datetime', description: 'Run date and time' },
  { name: 'run.weekday', description: 'Weekday, e.g. Friday' },
  { name: 'run.iso', description: 'ISO time (UTC), for the embed timestamp' },
  { name: 'run.attempt', description: 'Attempt number, 1 for the first try' },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]['name'];
export type TemplateValues = Record<TemplateVariable, string>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.name));
const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

export const token = (name: TemplateVariable) => `{{${name}}}`;

/** Same output as the backend for the same run, so the preview matches what Discord receives. */
export function templateValues(
  task: { name: string; cronSchedule: string; timezone: string },
  at: Date,
  attempt = 1,
): TemplateValues {
  let timeZone = task.timezone;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
  } catch {
    timeZone = 'UTC';
  }
  const inZone = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone, ...options }).format(at);
  const date = inZone({ day: 'numeric', month: 'short', year: 'numeric' });
  const time = inZone({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return {
    'task.name': task.name,
    'task.schedule': scheduleText(task.cronSchedule),
    'task.cron': task.cronSchedule,
    'task.timezone': task.timezone,
    'run.date': date,
    'run.time': time,
    'run.datetime': `${date}, ${time}`,
    'run.weekday': inZone({ weekday: 'long' }),
    'run.iso': at.toISOString(),
    'run.attempt': String(attempt),
  };
}

function scheduleText(cron: string): string {
  const text = describeCron(cron) ?? cron;
  return text.length > SCHEDULE_TEXT_MAX ? `${text.slice(0, SCHEDULE_TEXT_MAX - 1)}…` : text;
}

/** Fills variables in every string of a parsed payload; unknown ones stay as written. */
export function renderTemplate<T>(value: T, values: TemplateValues): T {
  if (typeof value === 'string') {
    return value.replace(VARIABLE, (whole, name: string) =>
      KNOWN.has(name) ? values[name as TemplateVariable] : whole,
    ) as T;
  }
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, values)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, renderTemplate(v, values)])) as T;
  }
  return value;
}

/** Names of `{{variables}}` that the backend would reject. */
export function unknownVariables(value: unknown): string[] {
  if (typeof value === 'string') {
    return [...value.matchAll(VARIABLE)].map((m) => m[1]!).filter((name) => !KNOWN.has(name));
  }
  if (Array.isArray(value)) return value.flatMap(unknownVariables);
  if (value && typeof value === 'object') return Object.values(value).flatMap(unknownVariables);
  return [];
}
