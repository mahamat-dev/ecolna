import { API_URL } from '@/lib/env';
import type { CreateNoteInput, NoteDetail, NoteListItem, PresignResponse } from './types';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText }}));
    throw new Error(err?.error?.message || res.statusText);
  }
  return res.json();
}

export const ContentAPI = {
  // Files
  presign: (body: { filename: string; mime: string; sizeBytes: number; sha256?: string }): Promise<PresignResponse> =>
    http('/content/files/presign', { method: 'POST', body: JSON.stringify(body) }),
  commit: (body: { fileId: string; sizeBytes: number; sha256?: string }) =>
    http('/content/files/commit', { method: 'POST', body: JSON.stringify(body) }),
  // Notes
  createNote: (body: CreateNoteInput) => http('/content/notes', { method: 'POST', body: JSON.stringify(body) }),
  updateNote: (id: string, body: Partial<CreateNoteInput>) => http(`/content/notes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publish: (id: string, publish: boolean) => http(`/content/notes/${id}/publish`, { method: 'POST', body: JSON.stringify({ publish }) }),
  listNotes: (params: URLSearchParams) => http<{ items: NoteListItem[]; nextCursor?: string | null }>(`/content/notes?${params.toString()}`),
  getNote: (id: string, locale?: string) => http<NoteDetail>(`/content/notes/${id}${locale ? `?locale=${locale}`: ''}`),
  markRead: (id: string) => http(`/content/notes/${id}/read`, { method: 'POST' }),
};