import { z } from 'zod';

/**
 * Audit item schema matching client expectations
 */
export const AuditItem = z.object({
  id: z.string().uuid(),
  at: z.string(), // ISO date string
  actorUserId: z.string().uuid().nullable(),
  actorRoles: z.array(z.string()).nullable().optional(),
  ip: z.string().nullable().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid().nullable(),
  summary: z.string(),
  meta: z.any().nullable(),
});
export type AuditItem = z.infer<typeof AuditItem>;

/**
 * Audit list response with cursor pagination
 */
export const AuditListResponse = z.object({
  items: z.array(AuditItem),
  nextCursor: z
    .object({ cursorAt: z.string(), cursorId: z.string().uuid() })
    .nullable(),
});
export type AuditListResponse = z.infer<typeof AuditListResponse>;

/**
 * Audit list query with cursor pagination and advanced filtering
 */
export const AuditListQuery = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().uuid().optional(),
  action: z.string().min(1).optional(),
  actorUserId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // Cursor pagination: ISO timestamp
  cursorAt: z.string().optional(),
  cursorId: z.string().uuid().optional(),
  q: z.string().min(2).optional(), // search summary/meta when FTS is enabled or fallback to ILIKE
});
export type AuditListQuery = z.infer<typeof AuditListQuery>;

/**
 * Search buckets response schema matching client expectations
 */
export const SearchBuckets = z.object({
  users: z.array(z.object({ 
    id: z.string().uuid(), 
    email: z.string().nullable(), 
    loginId: z.string().nullable(), 
    isActive: z.boolean().nullable().optional() 
  })).optional(),
  students: z.array(z.object({ 
    profileId: z.string().uuid(), 
    firstName: z.string(), 
    lastName: z.string(), 
    userId: z.string().uuid() 
  })).optional(),
  teachers: z.array(z.object({ 
    profileId: z.string().uuid(), 
    firstName: z.string(), 
    lastName: z.string(), 
    userId: z.string().uuid() 
  })).optional(),
  sections: z.array(z.object({ 
    id: z.string().uuid(), 
    name: z.string(), 
    gradeLevelId: z.string().uuid(), 
    academicYearId: z.string().uuid() 
  })).optional(),
  guardians: z.array(z.object({ 
    profileId: z.string().uuid(), 
    firstName: z.string(), 
    lastName: z.string(), 
    userId: z.string().uuid() 
  })).optional(),
});
export type SearchBuckets = z.infer<typeof SearchBuckets>;

/**
 * Global search query
 */
export const SearchQuery = z.object({
  q: z.string().min(2),
  types: z.string().optional(), // csv: users,students,teachers,sections,guardians
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuery>;