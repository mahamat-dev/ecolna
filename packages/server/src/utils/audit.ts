// Re-export from the admin-utils service for backward compatibility
export { writeAudit, actorFromReq, auditTx, type WriteAuditArgs } from '../modules/admin-utils/audit.service';

// Legacy exports for backward compatibility
import { db } from '../db/client';
import { auditLog, type NewAuditLog } from '../db/schema/audit';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { Request } from 'express';

type LegacyAuditParams = {
  actorProfileId?: string;
  action: NewAuditLog['action'];
  entityType: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, any>;
};

export type WriteAuditParams = {
  at?: Date;
  actorUserId?: string | null;
  actorRoles?: string[] | null;
  ip?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  meta?: Record<string, any> | null;
};

export type AuditWriter = (tx: PgTransaction<any, any, any> | typeof db, params: WriteAuditParams) => Promise<void>;

/**
 * Legacy API kept for back-compat, mapped into new fields
 */
export async function logAuditEvent(
  tx: PgTransaction<any, any, any> | typeof db,
  params: LegacyAuditParams
): Promise<void> {
  try {
    await tx.insert(auditLog).values({
      actorProfileId: params.actorProfileId || null,
      // Store legacy action as text
      action: String(params.action),
      entityType: params.entityType,
      entityId: (params.entityId as any) || null,
      description: params.description || null,
      metadata: params.metadata || null,
      // Populate new summary/meta when possible
      summary: params.description || null,
      meta: params.metadata || null,
    });
  } catch (error) {
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