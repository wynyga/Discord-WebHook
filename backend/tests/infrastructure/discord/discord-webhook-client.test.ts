import { describe, expect, it, vi } from 'vitest';
import { DiscordDeliveryError } from '../../../src/domain/discord.js';
import { DiscordWebhookClient } from '../../../src/infrastructure/discord/discord-webhook-client.js';
import { taskInput, WEBHOOK_URL } from '../../fixtures/task.js';

const payload = taskInput().payload;

function clientWith(respond: () => Promise<Response>) {
  const fetchMock = vi.fn<typeof fetch>(respond);
  return { client: new DiscordWebhookClient({ timeoutMs: 5000, fetch: fetchMock }), fetchMock };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });

async function failure(client: DiscordWebhookClient): Promise<DiscordDeliveryError> {
  const err = await client.send(WEBHOOK_URL, payload).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(DiscordDeliveryError);
  return err as DiscordDeliveryError;
}

describe('DiscordWebhookClient: request', () => {
  it('POSTs the payload as JSON to the webhook with wait=true', async () => {
    const { client, fetchMock } = clientWith(json(200, { id: '1' }));

    await client.send(WEBHOOK_URL, payload);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${WEBHOOK_URL}?wait=true`);
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(new Headers(init?.headers).get('content-type')).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual(payload);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([200, 204])('returns the status and duration on HTTP %i', async (status) => {
    const { client } = clientWith(async () => new Response(status === 204 ? null : '{}', { status }));

    const delivery = await client.send(WEBHOOK_URL, payload);

    expect(delivery.httpStatus).toBe(status);
    expect(delivery.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('DiscordWebhookClient: failures', () => {
  it('reads retry_after (seconds) from a 429 body', async () => {
    const { client } = clientWith(json(429, { message: 'You are being rate limited.', retry_after: 1.5 }));

    const err = await failure(client);

    expect(err).toMatchObject({ kind: 'rate_limited', httpStatus: 429, retryAfterMs: 1500, retryable: true });
  });

  it('falls back to the Retry-After header, then to a default', async () => {
    const header = await failure(clientWith(json(429, {}, { 'Retry-After': '3' })).client);
    const fallback = await failure(clientWith(async () => new Response('busy', { status: 429 })).client);

    expect(header.retryAfterMs).toBe(3000);
    expect(fallback.retryAfterMs).toBe(1000);
  });

  it('treats 5xx as retryable', async () => {
    const err = await failure(clientWith(json(503, { message: 'Service Unavailable' })).client);

    expect(err).toMatchObject({ kind: 'server_error', httpStatus: 503, retryable: true });
    expect(err.message).toBe('Discord server error (HTTP 503: Service Unavailable)');
  });

  it.each([
    [400, 'Cannot send an empty message'],
    [401, 'Invalid Webhook Token'],
    [404, 'Unknown Webhook'],
  ])('treats HTTP %i as not retryable', async (status, message) => {
    const err = await failure(clientWith(json(status, { message, code: 10015 })).client);

    expect(err).toMatchObject({ kind: 'client_error', httpStatus: status, retryable: false });
    expect(err.message).toBe(`Discord rejected the request (HTTP ${status}: ${message})`);
  });

  it('copes with a non-JSON error body', async () => {
    const err = await failure(clientWith(async () => new Response('<html>Bad Gateway</html>', { status: 502 })).client);

    expect(err.message).toBe('Discord server error (HTTP 502)');
  });

  it('reports network errors as retryable without leaking the URL', async () => {
    const { client } = clientWith(async () => {
      throw new TypeError('fetch failed', { cause: { code: 'ECONNRESET' } });
    });

    const err = await failure(client);

    expect(err).toMatchObject({ kind: 'network', httpStatus: null, retryable: true });
    expect(err.message).toBe('Could not reach Discord (ECONNRESET)');
    expect(err.message).not.toContain('webhooks');
  });

  it('reports timeouts', async () => {
    const { client } = clientWith(async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError');
    });

    const err = await failure(client);

    expect(err).toMatchObject({ kind: 'network', retryable: true });
    expect(err.message).toBe('Discord did not respond within 5000 ms');
  });
});
