import { API_URL } from './env';
import { getLocale } from './i18n';

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json', 
      'Accept-Language': getLocale(), 
      ...(init?.headers||{}) 
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(()=>({ error:{ message: res.statusText }}));
    throw new Error(err?.error?.message || res.statusText);
  }
  return res.json();
}