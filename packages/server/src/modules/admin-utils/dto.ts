import { z } from 'zod';

// Audit list query with cursor pagination and advanced filtering
export const AuditListQuery = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().min(1).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  // Cursor pagination: ISO timestamp or epoch ms string
  cursorAt: z.string().optional(),
  cursorId: z.string().uuid().optional(),
  q: z.string().min(2).optional(), // search summary/meta when FTS is enabled or fallback to ILIKE
});
export type AuditListQuery = z.infer<typeof AuditListQuery>;

// Global search query
export const SearchQuery = z.object({
  q: z.string().min(2),
  types: z.string().optional(), // csv: users,students,teachers,sections,guardians
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuery>;