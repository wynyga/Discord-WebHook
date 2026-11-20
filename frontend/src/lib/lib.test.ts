import { describe, expect, it } from 'vitest';
import { CUSTOM_PRESET, cronForPreset, describeCron, isFiveFieldCron, presetFor } from './cron';
import { formatDuration, formatRelative } from './format';
import { applyStoredScheme, nextStoredScheme, readStoredScheme } from './theme';

describe('nextStoredScheme (two-state theme toggle)', () => {
  it('stores the opposite of the system when following the system', () => {
    expect(nextStoredScheme(null, 'light')).toBe('dark');
    expect(nextStoredScheme(null, 'dark')).toBe('light');
  });

  it('goes back to following the system when undoing an override', () => {
    expect(nextStoredScheme('dark', 'light')).toBeNull();
    expect(nextStoredScheme('light', 'dark')).toBeNull();
  });

  it('flips what is shown when the system later matched the override', () => {
    // Stored dark, then the OS turned dark too: the page shows dark, so the user wants light.
    expect(nextStoredScheme('dark', 'dark')).toBe('light');
  });
});

describe('theme storage', () => {
  it('writes the override to storage and the color-scheme meta', () => {
    document.head.innerHTML = '<meta name="color-scheme" content="light dark">';

    applyStoredScheme('dark');
    expect(readStoredScheme()).toBe('dark');
    expect(document.querySelector('meta')?.getAttribute('content')).toBe('dark');

    applyStoredScheme(null);
    expect(readStoredScheme()).toBeNull();
    expect(document.querySelector('meta')?.getAttribute('content')).toBe('light dark');
  });

  it('ignores unknown stored values', () => {
    localStorage.setItem('color-scheme', 'purple');
    expect(readStoredScheme()).toBeNull();
  });
});

describe('cron helpers', () => {
  it('describes valid 5-field expressions', () => {
    expect(describeCron('0 9 * * 1-5')).toBe('At 09:00, Monday through Friday');
    expect(describeCron('*/5 * * * *')).toBe('Every 5 minutes');
  });

  it('rejects seconds, wrong field counts and garbage', () => {
    expect(describeCron('0 */5 * * * *')).toBeNull();
    expect(describeCron('* * * *')).toBeNull();
    expect(describeCron('every day')).toBeNull();
    expect(isFiveFieldCron('  1 2 3 4 5  ')).toBe(true);
  });

  it('maps presets both ways', () => {
    expect(presetFor('0 * * * *')).toBe('hourly');
    expect(presetFor('15 3 * * *')).toBe(CUSTOM_PRESET);
    expect(cronForPreset('weekdays')).toBe('0 9 * * 1-5');
    expect(cronForPreset(CUSTOM_PRESET)).toBeUndefined();
  });
});

describe('format helpers', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');

  it('formats relative times', () => {
    expect(formatRelative('2026-11-20T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelative('2026-11-20T11:59:55Z', now)).toBe('now');
    expect(formatRelative('2026-11-20T14:00:00Z', now)).toBe('in 2 hours');
  });

  it('formats durations', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(312)).toBe('312 ms');
    expect(formatDuration(1530)).toBe('1.53 s');
    expect(formatDuration(12_400)).toBe('12.4 s');
  });
});
