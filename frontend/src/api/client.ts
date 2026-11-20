import { session } from '../auth/session';
import type { FieldIssue } from './types';

export const API_BASE = '/api';

/** An error answered by the API, in its `{ error: { code, message, details } }` shape. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }

  /** Field-level problems from a 400, if the API sent them. */
  get fieldIssues(): FieldIssue[] {
    return Array.isArray(this.details)
      ? this.details.filter((d): d is FieldIssue => typeof d?.path === 'string' && typeof d?.message === 'string')
      : [];
  }
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Login is the only call made without a token. */
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  const headers = new Headers({ Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (auth) {
    const current = session.get();
    if (current) headers.set('Authorization', `Bearer ${current.token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${toQueryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const json: unknown = await response.json().catch(() => null);
  if (response.ok) return json as T;

  // An expired or revoked token signs the user out; the router then shows the login page.
  if (response.status === 401 && auth) session.clear();
  throw toApiError(response.status, json);
}

function toApiError(status: number, json: unknown): ApiError {
  const error = (json as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
  const code = typeof error?.code === 'string' ? error.code : 'UNKNOWN';
  const message = typeof error?.message === 'string' ? error.message : `Request failed (HTTP ${status})`;
  return new ApiError(status, code, message, error?.details);
}

function toQueryString(query?: Query): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}
