import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/domain/errors.js';
import {
  assertRetryWindowFits,
  isValidCron,
  isValidTimezone,
  nextRuns,
  shortestIntervalMs,
} from '../../src/domain/schedule.js';

const FROM = new Date('2026-03-01T00:00:00Z');
const MINUTE = 60_000;

describe('isValidCron', () => {
  it.each(['* * * * *', '*/5 * * * *', '0 9 * * 1-5', '0 0 1 * *', '30 8,17 * * *'])('accepts %s', (expr) => {
    expect(isValidCron(expr)).toBe(true);
  });

  it.each([
    ['empty', ''],
    ['seconds field', '0 * * * * *'],
    ['too few fields', '* * * *'],
    ['out of range', '61 * * * *'],
    ['garbage', 'every day'],
  ])('rejects %s', (_label, expr) => {
    expect(isValidCron(expr)).toBe(false);
  });
});

describe('isValidTimezone', () => {
  it.each(['UTC', 'Asia/Jakarta', 'America/New_York'])('accepts %s', (tz) => {
    expect(isValidTimezone(tz)).toBe(true);
  });

  it.each(['Mars/Olympus', 'GMT+99', ''])('rejects %j', (tz) => {
    expect(isValidTimezone(tz)).toBe(false);
  });
});

describe('nextRuns', () => {
  it('lists upcoming runs in the task timezone', () => {
    // 09:00 in Jakarta (UTC+7) is 02:00 UTC; FROM is a Sunday, so weekdays start on Monday.
    const runs = nextRuns('0 9 * * 1-5', 'Asia/Jakarta', 3, FROM);

    expect(runs.map((d) => d.toISOString())).toEqual([
      '2026-03-02T02:00:00.000Z',
      '2026-03-03T02:00:00.000Z',
      '2026-03-04T02:00:00.000Z',
    ]);
  });
});

describe('shortestIntervalMs', () => {
  it('measures regular schedules', () => {
    expect(shortestIntervalMs('*/5 * * * *', 'UTC', FROM)).toBe(5 * MINUTE);
    expect(shortestIntervalMs('0 * * * *', 'UTC', FROM)).toBe(60 * MINUTE);
  });

  it('finds the shortest gap of irregular schedules', () => {
    // 09:00 and 09:10 every day: the gaps are 10 minutes and 23h50m.
    expect(shortestIntervalMs('0,10 9 * * *', 'UTC', FROM)).toBe(10 * MINUTE);
  });
});

describe('assertRetryWindowFits', () => {
  const base = { cronSchedule: '*/5 * * * *', timezone: 'UTC' };

  it('accepts retries that end before the next run', () => {
    expect(() => assertRetryWindowFits({ ...base, maxRetry: 3, retryDelayMs: 60_000 }, FROM)).not.toThrow();
  });

  it('accepts no retries at all', () => {
    expect(() =>
      assertRetryWindowFits({ cronSchedule: '* * * * *', timezone: 'UTC', maxRetry: 0, retryDelayMs: 3_600_000 }, FROM),
    ).not.toThrow();
  });

  it('rejects retries that reach the next run', () => {
    const run = () => assertRetryWindowFits({ ...base, maxRetry: 5, retryDelayMs: 60_000 }, FROM);

    expect(run).toThrow(ValidationError);
    expect(run).toThrow('Retries would overlap the next scheduled run');
  });

  it('reports the numbers in the error details', () => {
    try {
      assertRetryWindowFits({ ...base, maxRetry: 10, retryDelayMs: 60_000 }, FROM);
      expect.unreachable();
    } catch (err) {
      expect((err as ValidationError).details).toMatchObject({ retryWindowMs: 600_000, shortestIntervalMs: 300_000 });
    }
  });
});
