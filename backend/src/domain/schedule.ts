import { CronExpressionParser } from 'cron-parser';
import cronstrue from 'cronstrue';
import { ValidationError } from './errors.js';
import { TASK_LIMITS, type TaskInput } from './task.js';

/** Upcoming runs sampled to find the shortest gap of an irregular expression like `0 9,17 * * *`. */
const INTERVAL_SAMPLES = 50;

/** Standard 5-field cron (minute hour day month weekday); seconds are not supported. */
export function isValidCron(expression: string): boolean {
  if (expression.trim().split(/\s+/).length !== 5) return false;
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The next `count` run times of a schedule, after `from`. */
export function nextRuns(cronSchedule: string, timezone: string, count: number, from = new Date()): Date[] {
  const expression = CronExpressionParser.parse(cronSchedule, { tz: timezone, currentDate: from });
  return Array.from({ length: count }, () => new Date(expression.next().getTime()));
}

export function shortestIntervalMs(cronSchedule: string, timezone: string, from = new Date()): number {
  const expression = CronExpressionParser.parse(cronSchedule, { tz: timezone, currentDate: from });
  let previous = expression.next().getTime();
  let shortest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < INTERVAL_SAMPLES; i++) {
    const current = expression.next().getTime();
    shortest = Math.min(shortest, current - previous);
    previous = current;
  }
  return shortest;
}

/**
 * All retries of one run must finish before the next scheduled run, so executions never overlap.
 * Throws `ValidationError` otherwise.
 */
export function assertRetryWindowFits(
  task: Pick<TaskInput, 'cronSchedule' | 'timezone' | 'maxRetry' | 'retryDelayMs'>,
  from = new Date(),
): void {
  const retryWindowMs = task.maxRetry * task.retryDelayMs;
  const intervalMs = shortestIntervalMs(task.cronSchedule, task.timezone, from);
  if (retryWindowMs >= intervalMs) {
    throw new ValidationError('Retries would overlap the next scheduled run', {
      retryWindowMs,
      shortestIntervalMs: intervalMs,
      hint: 'Lower maxRetry or retryDelayMs, or schedule the task less often',
    });
  }
}

/**
 * The schedule in words (`Every 5 minutes`, `At 09:00, Monday through Friday`), the same text the
 * frontend shows. Falls back to the expression itself and is cut to `scheduleTextMaxLength`.
 */
export function describeSchedule(expression: string): string {
  let text: string;
  try {
    text = cronstrue.toString(expression, { use24HourTimeFormat: true, throwExceptionOnParseError: true });
  } catch {
    text = expression;
  }
  const max = TASK_LIMITS.scheduleTextMaxLength;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
