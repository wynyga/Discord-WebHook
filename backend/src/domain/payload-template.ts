import { describeSchedule } from './schedule.js';
import type { Task } from './task.js';

/**
 * Variables a payload may contain as `{{name}}`. They are filled in at send time, so the stored
 * payload is the template and every run sends its own values.
 */
export const TEMPLATE_VARIABLES = [
  { name: 'task.name', description: 'Task name' },
  { name: 'task.schedule', description: 'Schedule in words, e.g. Every 5 minutes' },
  { name: 'task.cron', description: 'Cron expression, e.g. */5 * * * *' },
  { name: 'task.timezone', description: 'Task timezone' },
  { name: 'run.date', description: 'Run date in the task timezone, e.g. 21 Nov 2026' },
  { name: 'run.time', description: 'Run time in the task timezone, e.g. 09:00' },
  { name: 'run.datetime', description: 'Run date and time, e.g. 21 Nov 2026, 09:00' },
  { name: 'run.weekday', description: 'Weekday in the task timezone, e.g. Friday' },
  { name: 'run.iso', description: 'Run time as ISO 8601 (UTC), for an embed timestamp' },
  { name: 'run.attempt', description: 'Attempt number: 1 first, 2 for the first retry' },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]['name'];
export type TemplateValues = Record<TemplateVariable, string>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.name));
/** `{{ name }}`; spaces inside the braces are allowed. */
const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

type Path = Array<string | number>;

export interface UnknownVariable {
  path: Path;
  name: string;
}

/** Every `{{name}}` that is not a known variable, with the path of the string it sits in. */
export function findUnknownVariables(value: unknown, path: Path = []): UnknownVariable[] {
  if (typeof value === 'string') {
    return [...value.matchAll(VARIABLE)]
      .map((match) => match[1]!)
      .filter((name) => !KNOWN.has(name))
      .map((name) => ({ path, name }));
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => findUnknownVariables(item, [...path, i]));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => findUnknownVariables(item, [...path, key]));
  }
  return [];
}

/**
 * Replaces variables in every string of the payload. Works on the parsed value, never on JSON
 * text, so a value containing quotes or braces cannot break the structure. Keys are not touched.
 */
export function renderTemplate<T>(value: T, values: TemplateValues): T {
  if (typeof value === 'string') {
    return value.replace(VARIABLE, (whole, name: string) =>
      KNOWN.has(name) ? values[name as TemplateVariable] : whole,
    ) as T;
  }
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, values)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderTemplate(item, values)])) as T;
  }
  return value;
}

/** Values for one run. Dates use the task timezone; `attempt` is 1-based. */
export function templateValues(
  task: Pick<Task, 'name' | 'cronSchedule' | 'timezone'>,
  executedAt: Date,
  attempt: number,
): TemplateValues {
  const inZone = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-GB', { timeZone: task.timezone, ...options }).format(executedAt);
  const date = inZone({ day: 'numeric', month: 'short', year: 'numeric' });
  const time = inZone({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return {
    'task.name': task.name,
    'task.schedule': describeSchedule(task.cronSchedule),
    'task.cron': task.cronSchedule,
    'task.timezone': task.timezone,
    'run.date': date,
    'run.time': time,
    'run.datetime': `${date}, ${time}`,
    'run.weekday': inZone({ weekday: 'long' }),
    'run.iso': executedAt.toISOString(),
    'run.attempt': String(attempt),
  };
}

/**
 * The longest value each variable can take. Validating a template rendered with these proves the
 * real message stays within Discord's limits on every run.
 */
export function worstCaseValues(limits: {
  nameMaxLength: number;
  cronMaxLength: number;
  scheduleTextMaxLength: number;
  timezoneMaxLength: number;
}): TemplateValues {
  return {
    'task.name': 'x'.repeat(limits.nameMaxLength),
    'task.schedule': 'x'.repeat(limits.scheduleTextMaxLength),
    'task.cron': 'x'.repeat(limits.cronMaxLength),
    'task.timezone': 'x'.repeat(limits.timezoneMaxLength),
    'run.date': '30 Sept 2026',
    'run.time': '23:59',
    'run.datetime': '30 Sept 2026, 23:59',
    'run.weekday': 'Wednesday',
    'run.iso': '2026-09-30T23:59:59.999Z',
    'run.attempt': '11',
  };
}
