import { describe, expect, it } from 'vitest';
import { describeCron } from './cron';
import {
  builderProblem,
  builderToCron,
  changeFrequency,
  cronToBuilder,
  defaultBuilder,
  type ScheduleBuilder,
} from './schedule-builder';

const b = (patch: Partial<ScheduleBuilder>): ScheduleBuilder => ({ ...defaultBuilder(), ...patch });

describe('builderToCron', () => {
  it.each([
    [b({ frequency: 'minutes', everyMinutes: 15 }), '*/15 * * * *'],
    [b({ frequency: 'minutes', everyMinutes: 1 }), '* * * * *'],
    [b({ frequency: 'hourly', minute: 30 }), '30 * * * *'],
    [b({ frequency: 'daily', time: '09:05' }), '5 9 * * *'],
    [b({ frequency: 'weekly', time: '14:30', weekdays: [4, 1] }), '30 14 * * 1,4'],
    [b({ frequency: 'weekly', time: '08:00', weekdays: [5, 1, 2, 3, 4] }), '0 8 * * 1-5'],
    [b({ frequency: 'weekly', time: '08:00', weekdays: [0, 6] }), '0 8 * * 0,6'],
    [b({ frequency: 'monthly', time: '07:15', dayOfMonth: 1 }), '15 7 1 * *'],
    [b({ frequency: 'cron', cron: '  */7 9-17 * * 1-5 ' }), '*/7 9-17 * * 1-5'],
  ])('%j → %s', (builder, cron) => {
    expect(builderToCron(builder)).toBe(cron);
    expect(describeCron(cron)).not.toBeNull();
  });

  it('gives no cron while a time or a day is missing', () => {
    expect(builderToCron(b({ frequency: 'daily', time: '' }))).toBeNull();
    expect(builderToCron(b({ frequency: 'weekly', weekdays: [] }))).toBeNull();
    expect(builderToCron(b({ frequency: 'cron', cron: ' ' }))).toBeNull();
  });
});

describe('builderProblem', () => {
  it('names what is missing', () => {
    expect(builderProblem(b({ frequency: 'daily', time: '' }))).toBe('Pick a time.');
    expect(builderProblem(b({ frequency: 'weekly', weekdays: [] }))).toBe('Pick at least one day.');
    expect(builderProblem(b({ frequency: 'cron', cron: '' }))).toBe('Enter a cron expression.');
    expect(builderProblem(b({ frequency: 'hourly', time: '' }))).toBeUndefined(); // hourly needs no time
  });
});

describe('cronToBuilder', () => {
  it.each([
    '*/15 * * * *',
    '* * * * *',
    '30 * * * *',
    '5 9 * * *',
    '30 14 * * 1,4',
    '0 8 * * 1-5',
    '15 7 1 * *',
  ])('opens %s in the builder and builds it back unchanged', (cron) => {
    const builder = cronToBuilder(cron);

    expect(builder.frequency).not.toBe('cron');
    expect(builderToCron(builder)).toBe(cron);
  });

  it('reads Sunday written as 7', () => {
    expect(cronToBuilder('0 8 * * 7')).toMatchObject({ frequency: 'weekly', weekdays: [0] });
  });

  it.each([
    '*/7 * * * *', // uneven step
    '0 9-17 * * *', // hour range
    '0 9 1 1 *', // a month
    '0 9 1 * 1', // day of month and weekday together
    '0 9 * * 1/2', // weekday step
    'nonsense',
  ])('keeps %s as raw cron', (cron) => {
    expect(cronToBuilder(cron)).toMatchObject({ frequency: 'cron', cron });
  });
});

describe('changeFrequency', () => {
  it('shows the built cron when moving to Advanced', () => {
    const next = changeFrequency(b({ frequency: 'weekly', time: '14:30', weekdays: [1, 4] }), 'cron');

    expect(next).toMatchObject({ frequency: 'cron', cron: '30 14 * * 1,4' });
  });

  it('reads the cron back when moving away from Advanced', () => {
    const next = changeFrequency(b({ frequency: 'cron', cron: '0 8 * * 1-5' }), 'weekly');

    expect(next).toMatchObject({ frequency: 'weekly', time: '08:00', weekdays: [1, 2, 3, 4, 5] });
  });

  it('keeps the time when switching between time-based repeats', () => {
    expect(changeFrequency(b({ frequency: 'daily', time: '06:45' }), 'monthly')).toMatchObject({ frequency: 'monthly', time: '06:45' });
  });
});
