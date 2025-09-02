import ky, { HTTPError } from 'ky';
import { getCurrentLocale } from '@/lib/locale';

export const api = ky.create({
  prefixUrl: '/api',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': getCurrentLocale(),
  },
});

async function normalizeError(err: unknown): Promise<never> {
  if (err instanceof HTTPError) {
    try {
      const data = (await err.response.json()) as { error?: { message?: string } };
      throw new Error(data?.error?.message ?? err.message ?? 'Request failed');
    } catch {
      throw new Error(err.message ?? 'Request failed');
    }
  }
  throw err instanceof Error ? err : new Error('Request failed');
}

export async function get<T>(url: string): Promise<T> {
  try {
    return await api.get(url).json<T>();
  } catch (e) {
    return normalizeError(e);
  }
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  try {
    return await api.post(url, { json: body }).json<T>();
  } catch (e) {
    return normalizeError(e);
  }
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  try {
    return await api.patch(url, { json: body }).json<T>();
  } catch (e) {
    return normalizeError(e);
  }
}

export async function del<T>(url: string): Promise<T> {
  try {
    return await api.delete(url).json<T>();
  } catch (e) {
    return normalizeError(e);
  }
}