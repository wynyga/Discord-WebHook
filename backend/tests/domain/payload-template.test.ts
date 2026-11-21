import { describe, expect, it } from 'vitest';
import {
  findUnknownVariables,
  renderTemplate,
  TEMPLATE_VARIABLES,
  templateValues,
  worstCaseValues,
} from '../../src/domain/payload-template.js';
import { TASK_LIMITS } from '../../src/domain/task.js';

const task = { name: 'Daily report', cronSchedule: '0 9 * * 1-5', timezone: 'Asia/Jakarta' };
// 02:00 UTC is 09:00 in Jakarta (UTC+7), on a Friday.
const AT = new Date('2026-11-20T02:00:00.000Z');

describe('templateValues', () => {
  it('formats run values in the task timezone', () => {
    expect(templateValues(task, AT, 1)).toEqual({
      'task.name': 'Daily report',
      'task.schedule': 'At 09:00, Monday through Friday',
      'task.cron': '0 9 * * 1-5',
      'task.timezone': 'Asia/Jakarta',
      'run.date': '20 Nov 2026',
      'run.time': '09:00',
      'run.datetime': '20 Nov 2026, 09:00',
      'run.weekday': 'Friday',
      'run.iso': '2026-11-20T02:00:00.000Z',
      'run.attempt': '1',
    });
  });

  it('can land on another day than UTC', () => {
    const values = templateValues({ ...task, timezone: 'Pacific/Kiritimati' }, new Date('2026-11-20T12:00:00Z'), 1);

    expect(values['run.date']).toBe('21 Nov 2026'); // UTC+14
  });

  it('has a value for every documented variable', () => {
    expect(Object.keys(templateValues(task, AT, 2)).sort()).toEqual(TEMPLATE_VARIABLES.map((v) => v.name).sort());
  });
});

describe('renderTemplate', () => {
  const values = templateValues(task, AT, 3);

  it('fills variables in every nested string and leaves everything else alone', () => {
    const template = {
      content: 'Report for {{run.date}} ({{ run.weekday }})',
      tts: false,
      embeds: [
        {
          title: '{{task.name}}',
          color: 3066993,
          timestamp: '{{run.iso}}',
          fields: [{ name: 'Attempt', value: '{{run.attempt}}', inline: true }],
        },
      ],
    };

    expect(renderTemplate(template, values)).toEqual({
      content: 'Report for 20 Nov 2026 (Friday)',
      tts: false,
      embeds: [
        {
          title: 'Daily report',
          color: 3066993,
          timestamp: '2026-11-20T02:00:00.000Z',
          fields: [{ name: 'Attempt', value: '3', inline: true }],
        },
      ],
    });
  });

  it('cannot break the JSON structure with quotes or braces in values', () => {
    const tricky = { ...values, 'task.name': '"}], "evil": {' };

    expect(renderTemplate({ content: '{{task.name}}' }, tricky)).toEqual({ content: '"}], "evil": {' });
  });

  it('keeps unknown variables as written and does not mutate the template', () => {
    const template = { content: '{{nope}} {{task.name}}' };

    expect(renderTemplate(template, values).content).toBe('{{nope}} Daily report');
    expect(template.content).toBe('{{nope}} {{task.name}}');
  });
});

describe('findUnknownVariables', () => {
  it('reports unknown variables with the path of their string', () => {
    const template = {
      content: 'Hi {{user.name}} and {{task.name}}',
      embeds: [{ fields: [{ name: 'x', value: '{{run.dat}}' }] }],
    };

    expect(findUnknownVariables(template)).toEqual([
      { path: ['content'], name: 'user.name' },
      { path: ['embeds', 0, 'fields', 0, 'value'], name: 'run.dat' },
    ]);
  });

  it('accepts templates that only use known variables', () => {
    expect(findUnknownVariables({ content: '{{task.name}} {{run.iso}}' })).toEqual([]);
  });
});

describe('worstCaseValues', () => {
  it('is at least as long as any real value', () => {
    const worst = worstCaseValues(TASK_LIMITS);
    const longCron = '0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26 1,2,3,4,5,6,7 1,2,3 1,2 1-5';
    const real = templateValues({ name: 'n', cronSchedule: longCron, timezone: 'America/Argentina/ComodRivadavia' }, new Date('2026-09-30T23:59:59Z'), 11);

    for (const key of Object.keys(real) as Array<keyof typeof real>) {
      expect(worst[key].length).toBeGreaterThanOrEqual(real[key].length);
    }
  });
});
