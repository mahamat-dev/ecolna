/**
 * Admin Utils Module - Audit Log & Global Search
 * 
 * This module provides administrative utilities for the application:
 * 1. Audit Log System - Track and query system events
 * 2. Global Search - Search across users, students, teachers, and sections
 * 
 * Features:
 * - Cursor-based pagination for audit logs
 * - Full-text search capabilities
 * - RBAC integration (Admin-only access)
 * - Comprehensive error handling
 * - Backward compatibility with legacy audit system
 */

export { auditRouter } from './audit.routes';
export { searchRouter } from './search.routes';
export { writeAudit, actorFromReq, auditTx, listAudit, type WriteAuditArgs } from './audit.service';
export * from './dto';

// Re-export for convenience
export type {
  AuditItem,
  AuditListQuery,
  AuditListResponse,
  SearchBuckets,
  SearchQuery
} from './dto';