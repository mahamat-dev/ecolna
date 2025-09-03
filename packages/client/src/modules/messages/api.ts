import { http } from '@/lib/http';
import type { MessageListItem, Paged } from './types';

export const MessagesAPI = {
  inbox: (cursor?: string, limit = 20) => {
    const usp = new URLSearchParams();
    if (cursor) usp.set('cursor', cursor);
    usp.set('limit', String(limit));
    return http<Paged<MessageListItem>>(`/messages/inbox?${usp.toString()}`);
  },
  sent: (cursor?: string, limit = 20) => {
    const usp = new URLSearchParams();
    if (cursor) usp.set('cursor', cursor);
    usp.set('limit', String(limit));
    return http<Paged<any>>(`/messages/sent?${usp.toString()}`);
  },
  get: (id: string) => http(`/messages/${id}`),
  markRead: (id: string) => http(`/messages/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),
  send: (payload: { recipients: string[]; subject?: string; body: string }) => http(`/messages/send`, { method: 'POST', body: JSON.stringify(payload) }),
};

