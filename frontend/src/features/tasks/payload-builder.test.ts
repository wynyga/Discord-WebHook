import { describe, expect, it } from 'vitest';
import { renderTemplate, templateValues, unknownVariables } from '../../lib/payload-template';
import { colorToHex, emptyEmbed, formToPayload, hexToColor, payloadToForm, textToForm, type PayloadForm } from './payload-builder';

const base: PayloadForm = { content: '', username: '', avatarUrl: '', embed: null };

describe('formToPayload', () => {
  it('leaves out empty optional parts', () => {
    expect(formToPayload({ ...base, content: 'Hi' })).toEqual({ content: 'Hi' });
  });

  it('builds one embed with fields, images, footer and the run time', () => {
    const payload = formToPayload({
      ...base,
      username: ' Bot ',
      embed: {
        ...emptyEmbed(),
        title: '{{task.name}}',
        color: '#2ecc71',
        authorName: 'Ops',
        thumbnailUrl: 'https://img.test/t.png',
        footerText: 'Sent by Scheduler',
        timestamp: true,
        fields: [
          { name: 'Orders', value: '12', inline: true },
          { name: 'Note', value: 'ok', inline: false },
          { name: ' ', value: '', inline: true }, // empty row is dropped
        ],
      },
    });

    expect(payload).toEqual({
      username: 'Bot',
      embeds: [
        {
          author: { name: 'Ops' },
          title: '{{task.name}}',
          color: 3066993,
          fields: [
            { name: 'Orders', value: '12', inline: true },
            { name: 'Note', value: 'ok' },
          ],
          thumbnail: { url: 'https://img.test/t.png' },
          footer: { text: 'Sent by Scheduler' },
          timestamp: '{{run.iso}}',
        },
      ],
    });
  });

  it('converts colors both ways', () => {
    expect(hexToColor('#5865f2')).toBe(5793266);
    expect(colorToHex(3066993)).toBe('#2ecc71');
    expect(colorToHex(255)).toBe('#0000ff');
  });
});

describe('payloadToForm', () => {
  it('round-trips what the form can express', () => {
    const payload = formToPayload({
      content: 'Report {{run.date}}',
      username: 'Bot',
      avatarUrl: 'https://img.test/a.png',
      embed: { ...emptyEmbed(), title: 'T', description: 'D', fields: [{ name: 'a', value: 'b', inline: true }], timestamp: true },
    });

    const result = payloadToForm(payload);

    expect(result.ok).toBe(true);
    expect(result.ok && formToPayload(result.form)).toEqual(payload);
  });

  it.each([
    ['two embeds', { embeds: [{ title: 'a' }, { title: 'b' }] }, 'It has 2 embeds'],
    ['mentions control', { content: 'hi', allowed_mentions: { parse: [] } }, 'allowed_mentions'],
    ['footer icon', { embeds: [{ title: 't', footer: { text: 'f', icon_url: 'https://x' } }] }, 'embed uses options'],
    ['fixed timestamp', { embeds: [{ title: 't', timestamp: '2026-01-01T00:00:00Z' }] }, 'fixed timestamp'],
    ['not an object', [1, 2], 'not a JSON object'],
  ])('keeps %s in the JSON editor and says why', (_label, payload, reason) => {
    const result = payloadToForm(payload);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toContain(reason);
  });

  it('reports invalid JSON text instead of throwing', () => {
    expect(textToForm('{oops')).toEqual({ ok: false, reason: 'The JSON is not valid yet.' });
  });
});

describe('template helpers (mirror of the backend)', () => {
  // 02:00 UTC is 09:00 in Jakarta, on a Friday.
  const values = templateValues({ name: 'Daily', cronSchedule: '0 9 * * 1-5', timezone: 'Asia/Jakarta' }, new Date('2026-11-20T02:00:00Z'), 2);

  it('formats values in the task timezone like the backend', () => {
    expect(values).toMatchObject({ 'run.date': '20 Nov 2026', 'run.time': '09:00', 'run.weekday': 'Friday', 'run.attempt': '2' });
  });

  it('renders nested strings and keeps unknown variables', () => {
    expect(renderTemplate({ content: '{{task.name}} {{ run.date }} {{nope}}', embeds: [{ title: '{{run.time}}' }] }, values)).toEqual({
      content: 'Daily 20 Nov 2026 {{nope}}',
      embeds: [{ title: '09:00' }],
    });
  });

  it('describes the schedule in words and keeps the raw cron in task.cron', () => {
    expect(values).toMatchObject({ 'task.schedule': 'At 09:00, Monday through Friday', 'task.cron': '0 9 * * 1-5' });
    expect(templateValues({ name: 'n', cronSchedule: '*/5 * * * *', timezone: 'UTC' }, new Date())['task.schedule']).toBe('Every 5 minutes');
  });

  it('lists unknown variables', () => {
    expect(unknownVariables({ content: '{{task.name}} {{who}}', embeds: [{ title: '{{when}}' }] })).toEqual(['who', 'when']);
  });

  it('falls back to UTC for a timezone that is still being typed', () => {
    expect(templateValues({ name: 'n', cronSchedule: '', timezone: 'Asia/Jak' }, new Date('2026-11-20T02:00:00Z'))['run.time']).toBe('02:00');
  });
});
