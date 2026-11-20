import { DiscordDeliveryError, type DiscordDelivery, type DiscordPort } from '../../domain/discord.js';
import type { DiscordPayload } from '../../domain/task.js';

export interface DiscordWebhookClientOptions {
  timeoutMs: number;
  fetch?: typeof fetch;
}

/** Wait used when a 429 carries no usable `retry_after`. */
const DEFAULT_RETRY_AFTER_MS = 1000;

/** Calls Discord's "Execute Webhook" endpoint and classifies every failure. */
export class DiscordWebhookClient implements DiscordPort {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: DiscordWebhookClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async send(webhookUrl: string, payload: DiscordPayload): Promise<DiscordDelivery> {
    // `wait=true` makes Discord confirm the message was created instead of answering 204 blindly.
    const url = new URL(webhookUrl);
    url.searchParams.set('wait', 'true');

    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);

    let response: Response;
    try {
      response = await this.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'insignia-scheduler/0.1' },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
    } catch (err) {
      throw new DiscordDeliveryError(describeNetworkError(err, this.options.timeoutMs), 'network', null, elapsed());
    }

    const durationMs = elapsed();
    if (response.ok) {
      await response.body?.cancel();
      return { httpStatus: response.status, durationMs };
    }

    const body = await readJson(response);
    const status = response.status;

    if (status === 429) {
      const retryAfterMs = parseRetryAfterMs(body, response.headers);
      throw new DiscordDeliveryError(
        `Rate limited by Discord (HTTP 429), retry after ${retryAfterMs} ms`,
        'rate_limited',
        status,
        durationMs,
        retryAfterMs,
      );
    }

    const reason = typeof body?.message === 'string' ? `: ${body.message}` : '';
    if (status >= 500) {
      throw new DiscordDeliveryError(`Discord server error (HTTP ${status}${reason})`, 'server_error', status, durationMs);
    }
    throw new DiscordDeliveryError(`Discord rejected the request (HTTP ${status}${reason})`, 'client_error', status, durationMs);
  }
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Discord sends `retry_after` in seconds (may be fractional) in the body, and `Retry-After` as a header. */
function parseRetryAfterMs(body: Record<string, unknown> | null, headers: Headers): number {
  const fromBody = Number(body?.retry_after);
  const fromHeader = Number(headers.get('retry-after'));
  const seconds = Number.isFinite(fromBody) && fromBody > 0 ? fromBody : fromHeader;
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1000) : DEFAULT_RETRY_AFTER_MS;
}

/** Never includes the URL, which holds the webhook token. */
function describeNetworkError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `Discord did not respond within ${timeoutMs} ms`;
  }
  const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
  return `Could not reach Discord${cause?.code ? ` (${cause.code})` : ''}`;
}
