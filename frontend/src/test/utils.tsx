import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { createQueryClient, Providers } from '../app/Providers';
import { session } from '../auth/session';

export function signIn() {
  session.set({ token: 'test-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
}

/** Renders routes in memory with the real providers; query retries are off so errors show at once. */
export function renderRoutes(routes: RouteObject[], initialPath: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchInterval: false } });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, router, client };
}

export function renderPage(element: ReactElement, path = '/') {
  return renderRoutes([{ path: '*', element }], path);
}

type Handler = (request: { url: URL; method: string; body: unknown; headers: Headers }) => Response | Promise<Response>;

export const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Stubs fetch with handlers keyed by "METHOD /path" (path without the /api prefix and query).
 * Unmatched requests fail the test loudly.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: Array<{ method: string; path: string; url: URL; body: unknown; headers: Headers }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/api/, '');
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, url, body, headers });
    const handler = handlers[`${method} ${path}`];
    if (!handler) throw new Error(`Unexpected request: ${method} ${path}`);
    return handler({ url, method, body, headers });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
