import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ContentAPI } from './api';
import type { CreateNoteInput, NoteDetail } from './types';

export function useNotesList(q: { q?: string; limit?: number; cursor?: string | null; locale?: string; mine?: boolean }) {
  const params = new URLSearchParams();
  params.set('limit', String(q.limit ?? 20));
  params.set('audience', 'any');
  if (q.q) params.set('q', q.q);
  if (q.cursor) params.set('cursor', q.cursor);
  if (q.locale) params.set('locale', q.locale);
  if (q.mine) params.set('mine', 'true');
  return useQuery({
    queryKey: ['notes', params.toString()],
    queryFn: () => ContentAPI.listNotes(params),
    staleTime: 30_000,
  });
}

export function useNoteDetail(id: string, locale?: string) {
  return useQuery<NoteDetail>({
    queryKey: ['note', id, locale],
    queryFn: () => ContentAPI.getNote(id, locale),
    enabled: Boolean(id),
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateNoteInput) => ContentAPI.createNote(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function useUpdateNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateNoteInput>) => ContentAPI.updateNote(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note', id] }); qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function usePublishNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publish: boolean) => ContentAPI.publish(id, publish),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['note', id] }); qc.invalidateQueries({ queryKey: ['notes'] }); },
  });
}

export function useMarkRead(id: string) {
  return useMutation({ mutationFn: () => ContentAPI.markRead(id) });
}