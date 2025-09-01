import { pgTable, uuid, text, timestamp, jsonb, pgEnum, text as pgText, uuid as pgUuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles, users } from './identity';

export const auditAction = pgEnum('audit_action', [
  'CREATE', 'UPDATE', 'DELETE', 'ENROLL', 'TRANSFER', 'WITHDRAW', 'GRADUATE', 'LINK_GUARDIAN', 'UNLINK_GUARDIAN'
]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  // New canonical columns per CLAUDE spec
  at: timestamp('at', { withTimezone: true }).defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorRoles: pgText('actor_roles').array(),
  ip: text('ip'),
  // Keep action as free text for broader actions; map enum-based writers as needed
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  summary: text('summary'),
  meta: jsonb('meta'),

  // Back-compat columns (kept nullable). Existing code uses these; new service will prefer new fields
  actorProfileId: uuid('actor_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  description: text('description'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).default(sql`now()`),

  // Optional FTS column (generated always) - migration will add
  // tsv: tsVector('tsv'), // not declared here due to drizzle typings; use raw SQL migration
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;