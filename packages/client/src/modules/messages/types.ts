export type MessageListItem = {
  id: string;
  subject?: string | null;
  snippet?: string | null;
  createdAt: string;
  senderProfileId?: string;
  senderName?: string;
  readAt?: string | null;
};

export type Paged<T> = { items: T[]; nextCursor?: string | null };

