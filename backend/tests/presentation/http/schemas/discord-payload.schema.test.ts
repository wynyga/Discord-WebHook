import { describe, expect, it } from 'vitest';
import { discordPayloadSchema, DISCORD_LIMITS } from '../../../../src/presentation/http/schemas/discord-payload.schema.js';
import { taskInput } from '../../../fixtures/task.js';

const parse = (payload: unknown) => discordPayloadSchema.safeParse(payload);

describe('discordPayloadSchema', () => {
  it('accepts the example from the brief', () => {
    expect(parse(taskInput().payload).success).toBe(true);
  });

  it.each([
    ['content only', { content: 'hi' }],
    ['embed only', { embeds: [{ description: 'done' }] }],
    ['full embed', {
      embeds: [{
        title: 't',
        url: 'https://example.com',
        color: 0xffffff,
        timestamp: '2026-01-01T00:00:00.000Z',
        footer: { text: 'f' },
        author: { name: 'a' },
        fields: [{ name: 'n', value: 'v', inline: true }],
        image: { url: 'https://example.com/i.png' },
      }],
    }],
    ['allowed mentions', { content: 'hi', allowed_mentions: { parse: ['users'] } }],
  ])('accepts %s', (_label, payload) => {
    expect(parse(payload).success).toBe(true);
  });

  it.each([
    ['empty object', {}],
    ['blank content', { content: '   ' }],
    ['empty embeds', { embeds: [] }],
    ['embed with only a color', { embeds: [{ color: 1 }] }],
    ['content too long', { content: 'x'.repeat(DISCORD_LIMITS.content + 1) }],
    ['username too long', { content: 'hi', username: 'x'.repeat(DISCORD_LIMITS.username + 1) }],
    ['too many embeds', { embeds: Array.from({ length: 11 }, () => ({ title: 't' })) }],
    ['title too long', { embeds: [{ title: 'x'.repeat(257) }] }],
    ['color out of range', { embeds: [{ title: 't', color: 0x1000000 }] }],
    ['fractional color', { embeds: [{ title: 't', color: 1.5 }] }],
    ['too many fields', { embeds: [{ fields: Array.from({ length: 26 }, () => ({ name: 'n', value: 'v' })) }] }],
    ['unknown key', { content: 'hi', contnet: 'typo' }],
    ['non-object', 'hello'],
  ])('rejects %s', (_label, payload) => {
    expect(parse(payload).success).toBe(false);
  });

  it('enforces the 6000 character total across embeds', () => {
    const embed = { description: 'x'.repeat(4000) };

    expect(parse({ embeds: [embed] }).success).toBe(true);
    expect(parse({ embeds: [embed, embed] }).success).toBe(false);
  });
});
