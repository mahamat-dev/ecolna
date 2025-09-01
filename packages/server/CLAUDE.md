# CLAUDE.module-6-admin-utils.md  
**Module 6 — Admin Utilities: Audit Log & Global Search**  
_Server: Express 5 · TypeScript · Drizzle ORM · Postgres · Bun_

> Adds cross-module **Audit Logging** and **Global Search** to support the Admin Dashboard and operations.  
> This file is **complete**: schema, migrations, DTOs, services, routes, RBAC, i18n, pagination, tests, and DoD.

---

## 0) Scope & Outcomes

### What you get
- **Audit log** table + service to record who did what, when, and to which entity.
- **Admin audit API** to filter/paginate logs.
- **Global search API** to find **users, students, teachers, sections** (optionally guardians) with one query.
- **Indices** & optional **Full-Text Search (FTS)** for performance.
- **RBAC**: ADMIN-only for audit; search can be ADMIN or STAFF.
- **i18n** compliant error messages (uses your existing `tReq`/locale middleware if present).

### Dependencies
- Module 1 (users, roles, profiles)
- Module 2 (academics: class_section, grade_level, academic_year)
- Module 3 (enrollment) for student existence checks (optional in search)
- Module 4 (teaching_assignment) for teacher checks (optional in search)

---

## 1) Database Design (Drizzle + Postgres)

### 1.1 Table: `audit_log`
Captures atomic events (create/update/delete/state change/important read).

| column            | type         | notes |
|-------------------|--------------|------|
| `id`              | uuid PK      | `gen_random_uuid()` |
| `at`              | timestamptz  | default `now()` |
| `actor_user_id`   | uuid         | FK → `users(id)`, `ON DELETE SET NULL` |
| `actor_roles`     | text[]       | snapshot of roles at time of action |
| `ip`              | text         | client IP (store as text for portability) |
| `action`          | text         | e.g., `USER_CREATE`, `ENROLL_TRANSFER`, `ATTENDANCE_FINALIZE` |
| `entity_type`     | text         | e.g., `USER`, `PROFILE`, `CLASS_SECTION`, `ENROLLMENT`, `ATTENDANCE_SESSION` |
| `entity_id`       | uuid         | target entity id (nullable for global events) |
| `summary`         | text         | human-readable one-liner |
| `meta`            | jsonb        | optional structured context (before/after, involved ids, etc.) |

**Drizzle schema** — `packages/server/src/db/schema/audit.ts`
```ts
import { pgTable, uuid, timestamp, text, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity';

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorRoles: text('actor_roles').array(),
  ip: text('ip'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  summary: text('summary').notNull(),
  meta: jsonb('meta'),
});
SQL migration — drizzle/XXXXXXXX_create_audit.sql

sql

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_roles text[],
  ip text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text NOT NULL,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_meta_gin ON audit_log USING GIN (meta);
1.2 (Optional) Full-Text Search helpers
Add generated tsvector for better search across summary & meta.

sql

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(summary,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(meta::text,'')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_audit_tsv ON audit_log USING GIN (tsv);
2) DTOs & Validation (Zod)
packages/server/src/modules/admin-utils/dto.ts

ts

import { z } from 'zod';

// Audit list query
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

// Global search query
export const SearchQuery = z.object({
  q: z.string().min(2),
  types: z.string().optional(), // csv: users,students,teachers,sections,guardians
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
3) RBAC & i18n Helpers
RBAC: reuse your requireAdmin/requireStaffOrAdmin middlewares from Module 1.

i18n: optional but recommended; examples use tReq(req, 'errors.notAllowed') if available.

4) Audit Service
packages/server/src/modules/admin-utils/audit.service.ts

ts

import { db } from '../../db/client';
import { auditLog } from '../../db/schema/audit';

export type WriteAuditArgs = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  meta?: Record<string, unknown> | null;
  actor?: { userId?: string | null; roles?: string[]; ip?: string | null };
  at?: Date;
};

export async function writeAudit(evt: WriteAuditArgs) {
  await db.insert(auditLog).values({
    action: evt.action,
    entityType: evt.entityType,
    entityId: evt.entityId ?? null,
    summary: evt.summary,
    meta: evt.meta ?? null,
    at: evt.at ?? new Date(),
    actorUserId: evt.actor?.userId ?? null,
    actorRoles: evt.actor?.roles ?? null,
    ip: evt.actor?.ip ?? null,
  });
}

export function actorFromReq(req: any) {
  const u = req?.session?.user;
  return {
    userId: u?.id ?? null,
    roles: Array.isArray(u?.roles) ? u.roles : [],
    ip: req?.ip ?? null,
  };
}
4.1 Convenience wrappers (optional)
auditTx(tx, args) if you want to log inside an existing transaction.

auditForMutation(req, kind, entity, id, summary, meta) small helper.

5) Routes — Audit API (ADMIN only)
Base path: /api/admin/audit

packages/server/src/modules/admin-utils/audit.routes.ts

ts

import { Router } from 'express';
import { db } from '../../db/client';
import { auditLog } from '../../db/schema/audit';
import { and, desc, eq, gte, lte, ilike, lt, or, sql } from 'drizzle-orm';
import { AuditListQuery } from './dto';
import { requireAdmin } from '../../middlewares/rbac';
import { z } from 'zod';

export const auditRouter = Router();
auditRouter.use(requireAdmin);

// GET /api/admin/audit
auditRouter.get('/', async (req, res) => {
  const q = AuditListQuery.parse(req.query);

  const conds = [];
  if (q.entityType) conds.push(eq(auditLog.entityType, q.entityType));
  if (q.entityId) conds.push(eq(auditLog.entityId, q.entityId));
  if (q.action) conds.push(eq(auditLog.action, q.action));
  if (q.actorUserId) conds.push(eq(auditLog.actorUserId, q.actorUserId));
  if (q.from) conds.push(gte(auditLog.at, q.from as any));
  if (q.to) conds.push(lte(auditLog.at, q.to as any));
  if (q.cursorAt) {
    const cursorDate = new Date(q.cursorAt);
    // stable tie-breaker: (at < cursorAt) OR (at = cursorAt AND id < cursorId)
    if (q.cursorId) {
      conds.push(or(
        lt(auditLog.at, cursorDate as any),
        and(eq(auditLog.at, cursorDate as any), lt(auditLog.id, q.cursorId as any))
      ));
    } else {
      conds.push(lt(auditLog.at, cursorDate as any));
    }
  }

  // Search text (FTS preferred; fallback ILIKE)
  if (q.q) {
    conds.push(or(
      ilike(auditLog.summary, `%${q.q}%`) as any,
      ilike(sql`${auditLog.meta}::text`, `%${q.q}%`) as any
    ));
    // If you have FTS column 'tsv', replace with: conds.push(sql`audit_log.tsv @@ websearch_to_tsquery(${q.q})`);
  }

  const rows = await db.select().from(auditLog)
    .where(conds.length ? (and as any)(...conds) : undefined)
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(q.limit);

  const nextCursor = rows.length
    ? { cursorAt: rows[rows.length - 1].at?.toISOString(), cursorId: rows[rows.length - 1].id }
    : null;

  res.json({ items: rows, nextCursor });
});

// (Optional) GET /api/admin/audit/:id
auditRouter.get('/:id', async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const rows = await db.select().from(auditLog).where(eq(auditLog.id, id));
  if (!rows[0]) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Log not found' } });
  res.json(rows[0]);
});
5.1 Integration points — where to call writeAudit
Call this in Modules 1–5 after successful mutations:

Module 1 (User Management):

USER_CREATE, USER_STATUS_CHANGE, USER_LOCK, USER_UNLOCK, SECRET_RESET

Module 2 (Academics):

STAGE_CREATE, GRADE_LEVEL_UPDATE, CLASS_SECTION_DELETE, etc.

Module 3 (Enrollment):

ENROLL_CREATE, ENROLL_TRANSFER, ENROLL_WITHDRAW, ENROLL_GRADUATE

Module 4 (Teaching):

ASSIGNMENT_CREATE, ASSIGNMENT_UPDATE, HOMEROOM_SET

Module 5 (Attendance):

ATTENDANCE_SESSION_CREATE, ATTENDANCE_BULK_MARK, ATTENDANCE_FINALIZE

Example (Module 3):

ts

await writeAudit({
  action: 'ENROLL_CREATE',
  entityType: 'ENROLLMENT',
  entityId: newEnroll.id,
  summary: `Enrolled student ${studentProfileId} in section ${classSectionId}`,
  meta: { academicYearId, rollNo },
  actor: actorFromReq(req),
});
6) Routes — Global Search API
Base path: /api/admin/search
RBAC: requireAdmin or requireStaffOrAdmin (choose your policy).

Buckets supported:

users — admin accounts + non-admins (email/loginId)

students — profiles whose user has STUDENT role

teachers — profiles whose user has TEACHER role

sections — classes from academics

(optional) guardians — profiles with GUARDIAN role

packages/server/src/modules/admin-utils/search.routes.ts

ts

import { Router } from 'express';
import { db } from '../../db/client';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { classSection } from '../../db/schema/academics';
import { and, eq, ilike, inArray, sql } from 'drizzle-orm';
import { SearchQuery } from './dto';
import { requireAdmin } from '../../middlewares/rbac';

export const searchRouter = Router();
// If you want STAFF too: replace requireAdmin with requireStaffOrAdmin
searchRouter.use(requireAdmin);

searchRouter.get('/', async (req, res) => {
  const { q, types, limit } = SearchQuery.parse(req.query);
  const like = `%${q}%`;
  const buckets = new Set(
    (types?.split(',').map(s=>s.trim().toLowerCase()) ?? ['users','students','teachers','sections'])
      .filter(Boolean)
  );

  const out: Record<string, any[]> = {};

  if (buckets.has('users')) {
    out.users = await db.select({
      id: users.id, email: users.email, loginId: users.loginId, isActive: users.isActive,
    }).from(users)
      .where(
        sql`(${users.email} ILIKE ${like} OR ${users.loginId} ILIKE ${like})`
      ).limit(limit);
  }

  if (buckets.has('students')) {
    const stuIds = await db.select({ userId: userRoles.userId })
      .from(userRoles).where(eq(userRoles.role, 'STUDENT')).limit(10000);
    const ids = stuIds.map(r=>r.userId);
    out.students = ids.length ? await db.select({
      profileId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      userId: profiles.userId,
    }).from(profiles)
      .where(and(
        inArray(profiles.userId, ids),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
      )).limit(limit) : [];
  }

  if (buckets.has('teachers')) {
    const teachIds = await db.select({ userId: userRoles.userId })
      .from(userRoles).where(eq(userRoles.role, 'TEACHER')).limit(10000);
    const ids = teachIds.map(r=>r.userId);
    out.teachers = ids.length ? await db.select({
      profileId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      userId: profiles.userId,
    }).from(profiles)
      .where(and(
        inArray(profiles.userId, ids),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
      )).limit(limit) : [];
  }

  if (buckets.has('sections')) {
    out.sections = await db.select({
      id: classSection.id,
      name: classSection.name,
      gradeLevelId: classSection.gradeLevelId,
      academicYearId: classSection.academicYearId,
    }).from(classSection)
      .where(ilike(classSection.name, like) as any)
      .limit(limit);
  }

  // Optional guardians
  if (buckets.has('guardians')) {
    const guardIds = await db.select({ userId: userRoles.userId })
      .from(userRoles).where(eq(userRoles.role, 'GUARDIAN')).limit(10000);
    const ids = guardIds.map(r=>r.userId);
    out.guardians = ids.length ? await db.select({
      profileId: profiles.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      userId: profiles.userId,
    }).from(profiles)
      .where(and(
        inArray(profiles.userId, ids),
        sql`(${profiles.firstName} || ' ' || ${profiles.lastName}) ILIKE ${like}`
      )).limit(limit) : [];
  }

  res.json(out);
});
7) Wiring (Server App)
Add routers in your main server:

packages/server/src/app.ts (or server.ts)

ts

import { auditRouter } from './modules/admin-utils/audit.routes';
import { searchRouter } from './modules/admin-utils/search.routes';

app.use('/api/admin/audit', auditRouter);
app.use('/api/admin/search', searchRouter);
8) Error Shape & i18n
Standardize errors:

json

{ "error": { "code": "NOT_ALLOWED", "message": "Accès non autorisé.", "details": null } }
Use your localeMiddleware to set req.locale and tReq(req, key) to translate messages.

Return HTTP 4xx/5xx with above JSON.

9) Security & Privacy
RBAC: keep /admin/audit ADMIN-only. /admin/search can be ADMIN or STAFF (read-only).

Data minimization: never put secrets/passwords/tokens in meta. Prefer IDs and non-sensitive fields.

IP logging: optional; comply with your local policy.

Rate limiting (recommended for search): global/search-specific limiter to avoid abuse.

Pagination: always capped (default limit=100 for audit, 50 for search).

10) Performance
Use provided indexes: at DESC, (entity_type, entity_id), action, actor_user_id, meta GIN.

For large audit_log, consider partitioning by month or retention (e.g., keep 365 days).

Enable FTS (tsvector + GIN) for fast q search; fallback ILIKE is fine for MVP/small datasets.

11) Client Consumption (examples)
11.1 Audit Timeline (React Query)
ts

const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['audit', filters],
  queryFn: ({ pageParam }) => get<{items:any[]; nextCursor:any}>(
    `admin/audit?limit=50&${qs(filters)}${pageParam ? `&cursorAt=${pageParam.cursorAt}&cursorId=${pageParam.cursorId}`:''}`
  ),
  getNextPageParam: (last) => last.nextCursor ?? undefined,
});
11.2 Global Search (Command palette)
ts

const res = await get<Record<string, any[]>>(`admin/search?q=${encodeURIComponent(q)}&types=users,students,sections,teachers&limit=10`);
12) Manual Tests (cURL)
bash

# 1) Create a few logs by performing actions in other modules (e.g., enroll a student)

# 2) List last 20 logs
curl -b cookies.txt "http://localhost:4000/api/admin/audit?limit=20"

# 3) Filter by entity
curl -b cookies.txt "http://localhost:4000/api/admin/audit?entityType=ENROLLMENT&limit=10"

# 4) Filter by action within date range, with text search
curl -b cookies.txt "http://localhost:4000/api/admin/audit?action=ATTENDANCE_FINALIZE&from=2025-09-01&to=2025-12-31&q=section"

# 5) Cursor pagination
curl -s -b cookies.txt "http://localhost:4000/api/admin/audit?limit=5" | jq .
# take nextCursor values and pass them:
curl -b cookies.txt "http://localhost:4000/api/admin/audit?limit=5&cursorAt=2025-10-01T08:00:00.000Z&cursorId=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# 6) Global search (all buckets)
curl -b cookies.txt "http://localhost:4000/api/admin/search?q=amina"

# 7) Global search (only sections)
curl -b cookies.txt "http://localhost:4000/api/admin/search?q=Term&types=sections&limit=10"
13) OpenAPI (fragment)
yaml

paths:
  /api/admin/audit:
    get:
      summary: List audit logs
      parameters:
        - in: query; name: entityType; schema: { type: string }
        - in: query; name: entityId; schema: { type: string, format: uuid }
        - in: query; name: action; schema: { type: string }
        - in: query; name: actorUserId; schema: { type: string, format: uuid }
        - in: query; name: from; schema: { type: string, format: date-time }
        - in: query; name: to; schema: { type: string, format: date-time }
        - in: query; name: q; schema: { type: string, minLength: 2 }
        - in: query; name: limit; schema: { type: integer, minimum: 1, maximum: 200, default: 100 }
        - in: query; name: cursorAt; schema: { type: string }
        - in: query; name: cursorId; schema: { type: string, format: uuid }
      responses:
        '200': { description: ok }
  /api/admin/search:
    get:
      summary: Global search (users, students, teachers, sections, guardians)
      parameters:
        - in: query; name: q; required: true; schema: { type: string, minLength: 2 }
        - in: query; name: types; schema: { type: string, description: "csv list" }
        - in: query; name: limit; schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
      responses:
        '200': { description: ok }
14) Retention & Maintenance (recommended)
Retention job (daily): delete logs older than N days (e.g., 365), or archive them.

Archive: INSERT INTO audit_archive SELECT * FROM audit_log WHERE at < now() - interval '365 days'; DELETE ...

Backup: ensure DB backups include audit_log.

15) Definition of Done
 audit_log table created with all indexes; optional FTS configured if needed.

 Service writeAudit() callable from any module; **actorFromReq()` implemented.

 Routers mounted: GET /api/admin/audit (ADMIN), GET /api/admin/search (ADMIN or STAFF).

 RBAC enforced; error shape consistent; i18n messages wired (if enabled).

 Pagination (cursor) works and stable (uses (at,id)).

 Manual tests pass; client timeline and global search show expected results.

 No sensitive data leaked in meta; IP policy decided & documented.

16) Appendix — Example Audit Calls (per module)
User created (Module 1)

ts

await writeAudit({ action:'USER_CREATE', entityType:'USER', entityId:user.id,
  summary:`Created user ${user.id} (${role})`, meta:{ role, email:user.email, loginId:user.loginId },
  actor: actorFromReq(req) });
Section created (Module 2)

ts

await writeAudit({ action:'SECTION_CREATE', entityType:'CLASS_SECTION', entityId:section.id,
  summary:`Created section ${section.name}`, meta:{ gradeLevelId: section.gradeLevelId, yearId: section.academicYearId },
  actor: actorFromReq(req) });
Enroll transfer (Module 3)

ts

await writeAudit({ action:'ENROLL_TRANSFER', entityType:'ENROLLMENT', entityId:newEnroll.id,
  summary:`Transferred ${studentProfileId} to ${toSectionId}`, meta:{ from: fromSectionId, to: toSectionId, yearId },
  actor: actorFromReq(req) });
Assignment create (Module 4)

ts

await writeAudit({ action:'ASSIGNMENT_CREATE', entityType:'TEACHING_ASSIGNMENT', entityId:assign.id,
  summary:`Teacher ${teacherProfileId} -> section ${classSectionId} (${subjectId})`, meta:{ yearId, termId },
  actor: actorFromReq(req) });
Attendance finalize (Module 5)

ts


await writeAudit({ action:'ATTENDANCE_FINALIZE', entityType:'ATTENDANCE_SESSION', entityId:session.id,
  summary:`Finalized attendance for section ${sectionId} on ${takenOn}`, meta:{ subjectId, counts },
  actor: actorFromReq(req) });
✅ Drop this file at packages/server/CLAUDE.module-6-admin-utils.md.
Implement the schema and routes exactly as shown, then wire the writeAudit() calls across Modules 1–5.