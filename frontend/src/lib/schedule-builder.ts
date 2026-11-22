/**
 * Builds a 5-field cron expression from plain choices (repeat, time, days), and reads one back so
 * an existing task opens in the same view. Anything the builder cannot express stays as raw cron,
 * so nothing is lost when a task is edited.
 */

export type Frequency = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron';

export interface ScheduleBuilder {
  frequency: Frequency;
  /** Minutes between runs, for `minutes`. A divisor of 60 so the gaps stay even. */
  everyMinutes: number;
  /** Minute past the hour, for `hourly`. */
  minute: number;
  /** `HH:MM`, for `daily`, `weekly` and `monthly`. Empty while the user clears the field. */
  time: string;
  /** 0 = Sunday … 6 = Saturday, for `weekly`. */
  weekdays: number[];
  /** 1–31, for `monthly`. */
  dayOfMonth: number;
  /** Raw expression, for `cron`. */
  cron: string;
}

export const FREQUENCIES: ReadonlyArray<{ value: Frequency; label: string }> = [
  { value: 'minutes', label: 'Every few minutes' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' },
  { value: 'cron', label: 'Advanced (cron expression)' },
];

export const MINUTE_STEPS = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30] as const;

/** Monday first, as most calendars show it; values are cron's (Sunday = 0). */
export const WEEKDAYS: ReadonlyArray<{ value: number; short: string; long: string }> = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
  { value: 0, short: 'Sun', long: 'Sunday' },
];

export function defaultBuilder(): ScheduleBuilder {
  return { frequency: 'daily', everyMinutes: 15, minute: 0, time: '09:00', weekdays: [1, 2, 3, 4, 5], dayOfMonth: 1, cron: '' };
}

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(time: string): { hour: number; minute: number } | null {
  const match = TIME.exec(time);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** `1,2,3,5` → `1-3,5`; runs of three or more become ranges. */
function compactList(values: number[]): string {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    parts.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(','));
    i = j + 1;
  }
  return parts.join(',');
}

/** The cron for the current choices, or null while they are incomplete (no time, no day). */
export function builderToCron(b: ScheduleBuilder): string | null {
  switch (b.frequency) {
    case 'minutes':
      return b.everyMinutes === 1 ? '* * * * *' : `*/${b.everyMinutes} * * * *`;
    case 'hourly':
      return `${b.minute} * * * *`;
    case 'daily':
    case 'weekly':
    case 'monthly': {
      const time = parseTime(b.time);
      if (!time) return null;
      if (b.frequency === 'daily') return `${time.minute} ${time.hour} * * *`;
      if (b.frequency === 'monthly') return `${time.minute} ${time.hour} ${b.dayOfMonth} * *`;
      if (b.weekdays.length === 0) return null;
      return `${time.minute} ${time.hour} * * ${compactList(b.weekdays)}`;
    }
    case 'cron':
      return b.cron.trim() || null;
  }
}

/** What is missing, in words for the field; undefined when the choices make a schedule. */
export function builderProblem(b: ScheduleBuilder): string | undefined {
  if (b.frequency === 'cron') return b.cron.trim() ? undefined : 'Enter a cron expression.';
  if (b.frequency !== 'minutes' && b.frequency !== 'hourly' && !parseTime(b.time)) return 'Pick a time.';
  if (b.frequency === 'weekly' && b.weekdays.length === 0) return 'Pick at least one day.';
  return undefined;
}

const NUMBER = /^\d{1,2}$/;

function inRange(text: string, min: number, max: number): number | null {
  if (!NUMBER.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/** `1-5`, `1,3,5`, `0,6`, `7` (also Sunday) → day numbers; null for steps or anything else. */
function parseWeekdays(field: string): number[] | null {
  const days = new Set<number>();
  for (const part of field.split(',')) {
    const [from, to, ...rest] = part.split('-');
    if (rest.length > 0 || from === undefined) return null;
    const start = inRange(from, 0, 7);
    const end = to === undefined ? start : inRange(to, 0, 7);
    if (start === null || end === null || end < start) return null;
    for (let d = start; d <= end; d++) days.add(d % 7);
  }
  return [...days];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Opens a cron in the builder when it has one of the builder's shapes; otherwise in the
 * `cron` view with the expression as written.
 */
export function cronToBuilder(expression: string): ScheduleBuilder {
  const base = defaultBuilder();
  const raw: ScheduleBuilder = { ...base, frequency: 'cron', cron: expression.trim() };
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return raw;
  const [min, hour, dom, month, dow] = fields as [string, string, string, string, string];
  if (month !== '*') return raw;

  if (hour === '*' && dom === '*' && dow === '*') {
    if (min === '*') return { ...base, frequency: 'minutes', everyMinutes: 1 };
    const step = /^\*\/(\d+)$/.exec(min);
    if (step && (MINUTE_STEPS as readonly number[]).includes(Number(step[1]))) {
      return { ...base, frequency: 'minutes', everyMinutes: Number(step[1]) };
    }
    const minute = inRange(min, 0, 59);
    return minute === null ? raw : { ...base, frequency: 'hourly', minute };
  }

  const m = inRange(min, 0, 59);
  const h = inRange(hour, 0, 23);
  if (m === null || h === null) return raw;
  const time = `${pad(h)}:${pad(m)}`;

  if (dom === '*' && dow === '*') return { ...base, frequency: 'daily', time };
  if (dom === '*') {
    const weekdays = parseWeekdays(dow);
    return weekdays ? { ...base, frequency: 'weekly', time, weekdays } : raw;
  }
  if (dow === '*') {
    const day = inRange(dom, 1, 31);
    return day === null ? raw : { ...base, frequency: 'monthly', time, dayOfMonth: day };
  }
  return raw;
}

/**
 * Switches the repeat choice and keeps what still applies. Moving to `cron` fills in the
 * expression built so far, so the user sees what their choices meant; moving away from `cron`
 * reads the expression back when the builder can show it.
 */
export function changeFrequency(b: ScheduleBuilder, frequency: Frequency): ScheduleBuilder {
  if (frequency === 'cron') return { ...b, frequency, cron: builderToCron(b) ?? b.cron };
  if (b.frequency === 'cron') {
    const parsed = cronToBuilder(b.cron);
    if (parsed.frequency === frequency) return parsed;
    return { ...b, ...parsed, frequency, cron: b.cron };
  }
  return { ...b, frequency };
}
