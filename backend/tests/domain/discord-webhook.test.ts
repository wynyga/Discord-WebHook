import { describe, expect, it } from 'vitest';
import { isDiscordWebhookUrl, maskWebhookUrl } from '../../src/domain/discord-webhook.js';

const ID = '123456789012345678';
const TOKEN = 'abcDEF_ghi-JKL0123456789wxyz';

describe('isDiscordWebhookUrl', () => {
  it.each([
    `https://discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://discordapp.com/api/webhooks/${ID}/${TOKEN}`,
    `https://ptb.discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://canary.discord.com/api/webhooks/${ID}/${TOKEN}`,
    `https://discord.com/api/v10/webhooks/${ID}/${TOKEN}`,
  ])('accepts %s', (url) => {
    expect(isDiscordWebhookUrl(url)).toBe(true);
  });

  it.each([
    ['plain http', `http://discord.com/api/webhooks/${ID}/${TOKEN}`],
    ['other host', `https://evil.example/api/webhooks/${ID}/${TOKEN}`],
    ['lookalike host', `https://discord.com.evil.example/api/webhooks/${ID}/${TOKEN}`],
    ['internal address', `https://169.254.169.254/api/webhooks/${ID}/${TOKEN}`],
    ['custom port', `https://discord.com:8443/api/webhooks/${ID}/${TOKEN}`],
    ['credentials', `https://user:pass@discord.com/api/webhooks/${ID}/${TOKEN}`],
    ['query string', `https://discord.com/api/webhooks/${ID}/${TOKEN}?wait=true`],
    ['missing token', `https://discord.com/api/webhooks/${ID}`],
    ['non-numeric id', `https://discord.com/api/webhooks/abc/${TOKEN}`],
    ['not a url', 'discord webhook'],
  ])('rejects %s', (_label, url) => {
    expect(isDiscordWebhookUrl(url)).toBe(false);
  });
});

describe('maskWebhookUrl', () => {
  it('keeps the id and the last 4 token characters', () => {
    expect(maskWebhookUrl(`https://discord.com/api/webhooks/${ID}/${TOKEN}`)).toBe(
      `https://discord.com/api/webhooks/${ID}/****wxyz`,
    );
  });

  it('never echoes values it cannot parse', () => {
    expect(maskWebhookUrl('not a url with secret')).toBe('[invalid webhook url]');
    expect(maskWebhookUrl('https://discord.com/other/secret')).toBe('[invalid webhook url]');
  });
});
