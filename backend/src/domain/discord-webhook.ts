/** Hosts Discord serves webhooks from; anything else is rejected, which also limits SSRF. */
export const DISCORD_WEBHOOK_HOSTS: ReadonlySet<string> = new Set([
  'discord.com',
  'discordapp.com',
  'ptb.discord.com',
  'canary.discord.com',
]);

const WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([\w-]{1,100})\/?$/;

export function isDiscordWebhookUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    DISCORD_WEBHOOK_HOSTS.has(url.hostname) &&
    WEBHOOK_PATH.test(url.pathname)
  );
}

/** Keeps the webhook id, hides all but the last 4 characters of the token. */
export function maskWebhookUrl(value: string): string {
  try {
    const url = new URL(value);
    const match = WEBHOOK_PATH.exec(url.pathname);
    if (!match) return '[invalid webhook url]';
    const [, id, token = ''] = match;
    return `${url.origin}/api/webhooks/${id}/****${token.slice(-4)}`;
  } catch {
    return '[invalid webhook url]';
  }
}
