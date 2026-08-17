import type { ApiProblem, PageResult } from '../types';

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  requestId?: string;
  constructor(status: number, problem: ApiProblem) {
    super(problem.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = problem.code;
    this.fields = problem.fields;
    this.requestId = problem.requestId;
  }
}

const csrfToken = () => document.cookie.split('; ').find(row => row.startsWith('skyland_csrf='))?.split('=').slice(1).join('=') || '';
const inflight = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, init: RequestInit & { timeout?: number; dedupe?: boolean } = {}): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const key = `${method}:${path}`;
  if (method === 'GET' && init.dedupe !== false && inflight.has(key)) return inflight.get(key) as Promise<T>;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), init.timeout || 15_000);
    const bodyIsForm = init.body instanceof FormData;
    try {
      const response = await fetch(`/api${path}`, {
        ...init,
        credentials: 'same-origin',
        signal: init.signal || controller.signal,
        headers: {
          ...(bodyIsForm ? {} : { 'Content-Type': 'application/json' }),
          ...(method !== 'GET' && csrfToken() ? { 'X-CSRF-Token': csrfToken() } : {}),
          ...(init.headers || {}),
        },
      });
      const text = response.status === 204 ? '' : await response.text();
      let data: unknown = null;
      if (text) {
        try { data = JSON.parse(text); } catch { data = { error: { code: 'INVALID_RESPONSE', message: text } }; }
      }
      if (!response.ok) {
        const raw = (data as { error?: ApiProblem | string } | null)?.error;
        const problem: ApiProblem = typeof raw === 'string'
          ? { code: `HTTP_${response.status}`, message: raw }
          : raw || { code: `HTTP_${response.status}`, message: response.status >= 500 ? 'The Skyland service is temporarily unavailable.' : 'The request could not be completed.' };
        if (response.status === 401 && path !== '/auth/me' && path !== '/auth/login') window.dispatchEvent(new CustomEvent('skyland:session-expired'));
        throw new ApiError(response.status, problem);
      }
      return data as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(408, { code: 'REQUEST_TIMEOUT', message: 'The request took too long. Check your connection and try again.' });
      if (error instanceof TypeError) throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'Unable to reach Skyland. Check your internet connection and try again.' });
      throw error;
    } finally {
      window.clearTimeout(timeout);
      inflight.delete(key);
    }
  })();
  if (method === 'GET' && init.dedupe !== false) inflight.set(key, request);
  return request;
}

export function pageResult<T>(data: PageResult<T> | T[]): PageResult<T> {
  return Array.isArray(data) ? { items: data, meta: { page: 1, limit: data.length || 1, total: data.length, pages: 1 } } : data;
}

export const jsonBody = (value: unknown): RequestInit => ({ body: JSON.stringify(value) });
