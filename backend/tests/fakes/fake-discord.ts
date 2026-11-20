import { vi } from 'vitest';
import { DiscordDeliveryError, type DiscordDelivery, type DiscordPort } from '../../src/domain/discord.js';
import type { DiscordPayload } from '../../src/domain/task.js';

export function fakeDiscord() {
  return {
    send: vi
      .fn<(url: string, payload: DiscordPayload) => Promise<DiscordDelivery>>()
      .mockResolvedValue({ httpStatus: 200, durationMs: 42 }),
  } satisfies DiscordPort;
}

export type FakeDiscord = ReturnType<typeof fakeDiscord>;

export const discordErrors = {
  serverError: () => new DiscordDeliveryError('Discord server error (HTTP 502)', 'server_error', 502, 30),
  network: () => new DiscordDeliveryError('Could not reach Discord (ECONNRESET)', 'network', null, 5),
  rateLimited: (retryAfterMs = 2500) =>
    new DiscordDeliveryError('Rate limited by Discord (HTTP 429)', 'rate_limited', 429, 12, retryAfterMs),
  unknownWebhook: () =>
    new DiscordDeliveryError('Discord rejected the request (HTTP 404: Unknown Webhook)', 'client_error', 404, 20),
};
