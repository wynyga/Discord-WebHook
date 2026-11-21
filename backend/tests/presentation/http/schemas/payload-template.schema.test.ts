import { describe, expect, it } from 'vitest';
import { payloadTemplateSchema } from '../../../../src/presentation/http/schemas/payload-template.schema.js';
import { createTaskSchema } from '../../../../src/presentation/http/schemas/task.schema.js';
import { WEBHOOK_URL } from '../../../fixtures/task.js';

const parse = (payload: unknown) => payloadTemplateSchema.safeParse(payload);

describe('payloadTemplateSchema', () => {
  it('stores the template, not the rendered sample', () => {
    const template = { content: 'Report {{run.date}}', embeds: [{ title: '{{task.name}}', timestamp: '{{run.iso}}' }] };

    expect(payloadTemplateSchema.parse(template)).toEqual(template);
  });

  it('accepts a variable as the embed timestamp', () => {
    expect(parse({ embeds: [{ title: 't', timestamp: '{{run.iso}}' }] }).success).toBe(true);
  });

  it('still rejects a timestamp that is neither ISO nor a variable', () => {
    expect(parse({ embeds: [{ title: 't', timestamp: 'tomorrow' }] }).success).toBe(false);
  });

  it('rejects unknown variables with their path', () => {
    const result = parse({ content: 'ok', embeds: [{ title: 'Hi {{user}}' }] });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ['embeds', 0, 'title'] });
    expect(result.error?.issues[0]?.message).toContain('Unknown variable {{user}}');
  });

  it('rejects a template whose longest rendering exceeds a Discord limit', () => {
    // 1950 characters plus {{task.name}} (up to 100) can exceed the 2000 limit on some runs.
    const result = parse({ content: `${'x'.repeat(1950)}{{task.name}}` });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['content']);
  });

  it('keeps the plain Discord rules (needs content or embeds, no unknown keys)', () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ content: 'hi', contnet: 'typo' }).success).toBe(false);
  });

  it('reports payload paths through the task schema', () => {
    const result = createTaskSchema.safeParse({
      name: 'n',
      cronSchedule: '* * * * *',
      webhookUrl: WEBHOOK_URL,
      payload: { content: '{{oops}}' },
    });

    expect(result.error?.issues[0]?.path).toEqual(['payload', 'content']);
  });
});
