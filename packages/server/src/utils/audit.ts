import { db } from '../db/client';
import { auditLog, type NewAuditLog } from '../db/schema/audit';
import type { PgTransaction } from 'drizzle-orm/pg-core';

type AuditParams = {
  actorProfileId?: string;
  action: NewAuditLog['action'];
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, any>;
};

/**
 * Log an audit event
 * @param tx - Database transaction (optional, will use main db if not provided)
 * @param params - Audit parameters
 */
export async function logAuditEvent(
  tx: PgTransaction<any, any, any> | typeof db,
  params: AuditParams
): Promise<void> {
  try {
    await tx.insert(auditLog).values({
      actorProfileId: params.actorProfileId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      description: params.description || null,
      metadata: params.metadata || null,
    });
  } catch (error) {
    // Log audit failures but don't break the main operation
    console.error('Failed to log audit event:', error);
  }
}

/**
 * Get actor profile ID from request session
 * This is a placeholder - you'll need to implement based on your auth system
 */
export function getActorFromRequest(req: any): string | undefined {
  // TODO: Extract from session/auth context
  // For now, return undefined - you can implement this based on your auth system
  return req.session?.user?.profileId || req.user?.profileId;
}