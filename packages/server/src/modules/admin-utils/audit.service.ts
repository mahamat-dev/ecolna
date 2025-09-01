import { db } from '../../db/client';
import { auditLog } from '../../db/schema/audit';
import { and, desc, eq, ilike, sql, gte, lte, lt, or } from 'drizzle-orm';
import type { AuditListQuery } from './dto';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { Request } from 'express';

export type WriteAuditArgs = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown> | null;
  actorUserId?: string | null;
  actorRoles?: string[] | null;
  ip?: string | null;
  at?: Date;
};

/**
 * Write audit log entry - can be used with db or transaction
 */
export async function writeAudit(
  dbOrTx: typeof db | PgTransaction<any, any, any>,
  args: WriteAuditArgs
): Promise<void> {
  try {
    await dbOrTx.insert(auditLog).values({
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId ?? null,
      summary: args.summary,
      meta: args.meta ?? null,
      at: args.at ?? new Date(),
      actorUserId: args.actorUserId ?? null,
      actorRoles: args.actorRoles ?? null,
      ip: args.ip ?? null,
    });
  } catch (error) {
    console.error('Failed to write audit event:', error);
    // Don't throw - audit failures shouldn't break business operations
  }
}

/**
 * Extract actor information from Express request
 */
export function actorFromReq(req: Request): { userId?: string | null; roles?: string[] | null; ip?: string | null } {
  const sess: any = req.session as any;
  const user = sess?.user as any;
  const userId: string | null = user?.id ?? null;
  const roles: string[] | null = Array.isArray(user?.roles) ? user.roles : null;
  const ip = (
    (req.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim()) ||
    req.socket?.remoteAddress ||
    (req as any).ip ||
    null
  );
  return { userId, roles, ip };
}

/**
 * Transaction-aware audit writer
 */
export async function auditTx(
  tx: PgTransaction<any, any, any>,
  args: WriteAuditArgs
): Promise<void> {
  return writeAudit(tx, args);
}

/**
 * List audit logs with advanced filtering and cursor pagination
 */
export async function listAudit(query: AuditListQuery) {
  const conds = [];
  
  // Basic filters
  if (query.entityType) conds.push(eq(auditLog.entityType, query.entityType));
  if (query.entityId) conds.push(eq(auditLog.entityId, query.entityId));
  if (query.action) conds.push(eq(auditLog.action, query.action));
  if (query.actorUserId) conds.push(eq(auditLog.actorUserId, query.actorUserId));
  
  // Date range filters
  if (query.from) conds.push(gte(auditLog.at, query.from as any));
  if (query.to) conds.push(lte(auditLog.at, query.to as any));
  
  // Cursor pagination
  if (query.cursorAt) {
    const cursorDate = new Date(query.cursorAt);
    if (query.cursorId) {
      conds.push(or(
        lt(auditLog.at, cursorDate as any),
        and(eq(auditLog.at, cursorDate as any), lt(auditLog.id, query.cursorId as any))
      ));
    } else {
      conds.push(lt(auditLog.at, cursorDate as any));
    }
  }
  
  // Text search (fallback to ILIKE for now)
  if (query.q) {
    // Use ILIKE search for compatibility
    conds.push(or(
      ilike(auditLog.summary, `%${query.q}%`) as any,
      ilike(sql`${auditLog.meta}::text`, `%${query.q}%`) as any
    ));
  }

  const rows = await db
    .select({
      id: auditLog.id,
      at: auditLog.at,
      actorUserId: auditLog.actorUserId,
      action: auditLog.action,
      summary: auditLog.summary,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      meta: auditLog.meta,
      actorRoles: auditLog.actorRoles,
      ip: auditLog.ip,
    })
    .from(auditLog)
    .where(conds.length ? (and as any)(...conds) : undefined)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(query.limit);

  // Format response to match client expectations
  const items = rows.map(row => ({
    id: row.id,
    at: row.at?.toISOString() ?? new Date().toISOString(),
    actorUserId: row.actorUserId,
    actorRoles: row.actorRoles,
    ip: row.ip,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary ?? '',
    meta: row.meta,
  }));

  // Calculate next cursor
  const nextCursor = rows.length === query.limit && rows.length > 0
    ? { 
        cursorAt: rows[rows.length - 1]?.at?.toISOString() ?? new Date().toISOString(), 
        cursorId: rows[rows.length - 1]?.id ?? '' 
      }
    : null;

  return { items, nextCursor };
}