import type { ApiErrorBody } from './types';

/** Same origin: Vite (dev) and nginx (Docker) forward /api/* to the API. */
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let token: string | null = null;
let onUnauthorized: () => void = () => {};

/** Called by the auth layer: the token goes in every request; 401 ends the session. */
export function configureClient(options: { token: string | null; onUnauthorized: () => void }) {
  token = options.token;
  onUnauthorized = options.onUnauthorized;
}

export async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const query = options.query && new URLSearchParams(options.query).toString();
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${query ? `?${query}` : ''}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the API');
  }

  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body as T;

  const error = (body as ApiErrorBody | null)?.error;
  // An expired/invalid token on a protected call ends the session
  if (response.status === 401 && token) onUnauthorized();
  // No API error body on a 5xx: the proxy answered (API down or restarting)
  const fallbackCode = response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'UNKNOWN_ERROR';
  throw new ApiError(
    response.status,
    error?.code ?? fallbackCode,
    error?.message ?? response.statusText,
    error?.details,
  );
}
