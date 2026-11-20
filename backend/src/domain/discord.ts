import type { DiscordPayload } from './task.js';

export interface DiscordDelivery {
  httpStatus: number;
  durationMs: number;
}

/**
 * - `rate_limited`: HTTP 429; retry after `retryAfterMs`.
 * - `server_error`: HTTP 5xx; Discord may recover.
 * - `network`: no response (DNS, timeout, reset).
 * - `client_error`: other 4xx (bad payload, deleted webhook); retrying cannot help.
 */
export type DeliveryFailureKind = 'rate_limited' | 'server_error' | 'network' | 'client_error';

export class DiscordDeliveryError extends Error {
  override readonly name = 'DiscordDeliveryError';

  constructor(
    message: string,
    readonly kind: DeliveryFailureKind,
    readonly httpStatus: number | null,
    readonly durationMs: number | null,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }

  get retryable(): boolean {
    return this.kind !== 'client_error';
  }
}

export interface DiscordPort {
  /** Resolves on a 2xx response; otherwise rejects with `DiscordDeliveryError`. */
  send(webhookUrl: string, payload: DiscordPayload): Promise<DiscordDelivery>;
}
