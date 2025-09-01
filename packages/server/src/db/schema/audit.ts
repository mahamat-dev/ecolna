import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';

export const auditAction = pgEnum('audit_action', [
  'CREATE', 'UPDATE', 'DELETE', 'ENROLL', 'TRANSFER', 'WITHDRAW', 'GRADUATE', 'LINK_GUARDIAN', 'UNLINK_GUARDIAN'
]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // Who performed the action
  actorProfileId: uuid('actor_profile_id')
    .references(() => profiles.id, { onDelete: 'set null' }),
  
  // What action was performed
  action: auditAction('action').notNull(),
  
  // What entity was affected
  entityType: text('entity_type').notNull(), // e.g., 'enrollment', 'guardian_student'
  entityId: uuid('entity_id'), // ID of the affected entity
  
  // Additional context
  description: text('description'), // Human-readable description
  metadata: jsonb('metadata'), // Additional structured data
  
  // When it happened
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;