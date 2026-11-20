import cronstrue from 'cronstrue';

export interface SchedulePreset {
  id: string;
  label: string;
  cron: string;
}

export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  { id: 'every-5-minutes', label: 'Every 5 minutes', cron: '*/5 * * * *' },
  { id: 'hourly', label: 'Every hour', cron: '0 * * * *' },
  { id: 'daily', label: 'Every day at 09:00', cron: '0 9 * * *' },
  { id: 'weekdays', label: 'Weekdays at 09:00', cron: '0 9 * * 1-5' },
];

export const CUSTOM_PRESET = 'custom';

export function presetFor(cron: string): string {
  return SCHEDULE_PRESETS.find((p) => p.cron === cron.trim())?.id ?? CUSTOM_PRESET;
}

export function cronForPreset(presetId: string): string | undefined {
  return SCHEDULE_PRESETS.find((p) => p.id === presetId)?.cron;
}

/** Mirrors the API: exactly five fields, no seconds. */
export function isFiveFieldCron(expression: string): boolean {
  return expression.trim().split(/\s+/).length === 5;
}

/** A readable sentence ("At 09:00, Monday through Friday"), or null if the expression is invalid. */
export function describeCron(expression: string): string | null {
  if (!isFiveFieldCron(expression)) return null;
  try {
    return cronstrue.toString(expression, { use24HourTimeFormat: true, throwExceptionOnParseError: true });
  } catch {
    return null;
  }
}
