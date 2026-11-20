import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionStore, session } from '../auth/session';
import { json, mockApi, signIn } from '../test/utils';
import { ApiError, apiRequest } from './client';

describe('apiRequest', () => {
  beforeEach(() => session.clear());

  it('prefixes /api, sends the bearer token and JSON body', async () => {
    signIn();
    const { calls } = mockApi({ 'POST /tasks': () => json(201, { data: { id: '1' } }) });

    const result = await apiRequest('/tasks', { method: 'POST', body: { name: 'x' } });

    expect(result).toEqual({ data: { id: '1' } });
    expect(calls[0]?.url.pathname).toBe('/api/tasks');
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer test-token');
    expect(calls[0]?.headers.get('content-type')).toBe('application/json');
    expect(calls[0]?.body).toEqual({ name: 'x' });
  });

  it('builds the query string and skips empty values', async () => {
    signIn();
    const { calls } = mockApi({ 'GET /logs': () => json(200, { data: [] }) });

    await apiRequest('/logs', { query: { status: 'failed', taskId: undefined, page: 2, q: '' } });

    expect(calls[0]?.url.search).toBe('?status=failed&page=2');
  });

  it('does not send a token when auth is off', async () => {
    signIn();
    const { calls } = mockApi({ 'POST /auth/login': () => json(200, {}) });

    await apiRequest('/auth/login', { method: 'POST', body: {}, auth: false });

    expect(calls[0]?.headers.has('authorization')).toBe(false);
  });

  it('returns undefined for 204', async () => {
    signIn();
    mockApi({ 'DELETE /tasks/1': () => new Response(null, { status: 204 }) });

    await expect(apiRequest('/tasks/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('turns the API error shape into ApiError with field issues', async () => {
    signIn();
    mockApi({
      'POST /tasks': () =>
        json(400, {
          error: {
            code: 'VALIDATION',
            message: 'Request validation failed',
            details: [{ path: 'cronSchedule', message: 'Bad cron' }, { nope: true }],
          },
        }),
    });

    const err = await apiRequest('/tasks', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION', message: 'Request validation failed' });
    expect((err as ApiError).fieldIssues).toEqual([{ path: 'cronSchedule', message: 'Bad cron' }]);
  });

  it('signs out on 401', async () => {
    signIn();
    mockApi({ 'GET /tasks': () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Token expired' } }) });

    await expect(apiRequest('/tasks')).rejects.toThrow('Token expired');
    expect(session.get()).toBeNull();
  });

  it('reports network failures without leaking internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('/tasks')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('copes with a non-JSON error body', async () => {
    signIn();
    mockApi({ 'GET /tasks': () => new Response('<html>Bad gateway</html>', { status: 502 }) });

    await expect(apiRequest('/tasks')).rejects.toMatchObject({ status: 502, message: 'Request failed (HTTP 502)' });
  });
});

describe('createSessionStore', () => {
  function memoryStorage() {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
      data,
    };
  }

  it('persists, restores and clears the session', () => {
    const storage = memoryStorage();
    const store = createSessionStore(storage);
    const value = { token: 't', expiresAt: '2999-01-01T00:00:00Z' };

    store.set(value);

    expect(createSessionStore(storage).get()).toEqual(value);
    store.clear();
    expect(storage.data.size).toBe(0);
  });

  it('treats an expired token as signed out', () => {
    const store = createSessionStore(memoryStorage());
    store.set({ token: 't', expiresAt: '2026-01-01T00:00:00Z' });

    expect(store.get(Date.parse('2026-01-01T00:00:01Z'))).toBeNull();
  });

  it('notifies subscribers', () => {
    const store = createSessionStore(memoryStorage());
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ token: 't', expiresAt: '2999-01-01T00:00:00Z' });
    store.clear();

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('works without storage and ignores corrupt data', () => {
    expect(createSessionStore(null).get()).toBeNull();
    const broken = memoryStorage();
    broken.setItem('insignia.session', '{not json');
    expect(createSessionStore(broken).get()).toBeNull();

    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {},
    };
    const store = createSessionStore(throwing);
    store.set({ token: 't', expiresAt: '2999-01-01T00:00:00Z' });
    expect(store.get()?.token).toBe('t');
  });
});
