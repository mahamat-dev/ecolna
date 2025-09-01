# Module 4 — Teaching Assignments (API-only, **Express 5 + Drizzle**)

**Goal:** map **teachers ↔ class sections ↔ subjects** (optionally by term) for a given academic year.  
This powers permissions for **attendance**, **marks/exams**, and teacher dashboards.

> **Auth:** Admin-only for managing assignments. Read-only endpoints for **TEACHER** to see their own assignments.

---

## 0) Outcomes

- New tables:
  - `teaching_assignment` — core mapping of teacher ↔ class_section ↔ subject (optionally term).
- Endpoints:
  - Create/update/delete assignments (Admin)
  - List assignments by teacher, section, subject, term (Admin)
  - “My assignments” for teacher (Teacher)
  - Set/get homeroom (class teacher) per section
- Rules:
  - Each record belongs to an **academic_year**
  - Optional **term** constraint
  - Support **lead vs assistant** teacher on a subject
  - At most **one homeroom** teacher per section/year (enforced in service)

---

## 1) Database Design

### References (existing)
- `profiles` (Module 1)
- `user_roles` (role includes `TEACHER`)
- `academic_year`, `term`, `subject`, `class_section` (Module 2)

### New table

#### `teaching_assignment`
Represents that one **teacher** teaches one **subject** to one **class_section** in an **academic_year** (and optionally **term**).

| column              | type        | notes |
|---------------------|-------------|------|
| `id`                | uuid        | **PK**, `default gen_random_uuid()` |
| `teacher_profile_id`| uuid        | **FK → profiles(id)** (teacher), `ON DELETE RESTRICT` |
| `class_section_id`  | uuid        | **FK → class_section(id)**, `ON DELETE CASCADE` |
| `subject_id`        | uuid        | **FK → subject(id)**, `ON DELETE RESTRICT` |
| `academic_year_id`  | uuid        | **FK → academic_year(id)**, `ON DELETE RESTRICT` |
| `term_id`           | uuid        | nullable **FK → term(id)** (when term-specific) |
| `is_lead`           | boolean     | default `true` (false = assistant/co-teacher) |
| `is_homeroom`       | boolean     | default `false` (class teacher) |
| `hours_per_week`    | integer     | optional estimate |
| `notes`             | text        | optional |

**Uniqueness (soft constraints):**
- Allow multiple teachers per `(section,subject,term?)` (co-teaching), but only one `is_lead=true`.
- Allow at most one `is_homeroom=true` per `(section, academic_year)`.

> These are easier in service logic than rigid DB constraints (schools differ). We’ll enforce via transactions.

---

### Drizzle schema (drop-in)

```ts
// src/db/schema/teaching.ts
import { pgTable, uuid, boolean, integer, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, term, subject, classSection } from './academics';

export const teachingAssignment = pgTable('teaching_assignment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  teacherProfileId: uuid('teacher_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),

  classSectionId: uuid('class_section_id').notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),

  subjectId: uuid('subject_id').notNull()
    .references(() => subject.id, { onDelete: 'restrict' }),

  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'restrict' }),

  termId: uuid('term_id').references(() => term.id, { onDelete: 'set null' }),

  isLead: boolean('is_lead').notNull().default(true),
  isHomeroom: boolean('is_homeroom').notNull().default(false),

  hoursPerWeek: integer('hours_per_week'),
  notes: text('notes'),
});
(Optional indices) add a migration with:

sql
Copier le code
CREATE INDEX IF NOT EXISTS idx_ta_teacher ON teaching_assignment(teacher_profile_id);
CREATE INDEX IF NOT EXISTS idx_ta_section ON teaching_assignment(class_section_id);
CREATE INDEX IF NOT EXISTS idx_ta_year ON teaching_assignment(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ta_term ON teaching_assignment(term_id);
2) Business Rules
Teacher role check: teacher_profile_id must belong to a users row that has role = TEACHER. (Service verifies via join profiles.user_id -> user_roles.)

Year alignment: term_id, if provided, must belong to the same academic_year_id. (Service validates.)

Lead teacher uniqueness: For (class_section, subject, term?), at most one record with is_lead=true. (Service enforces by demoting any existing leads to assistant or rejecting.)

Homeroom uniqueness: For (class_section, academic_year), at most one record with is_homeroom=true. (Service clears previous homeroom in a transaction.)

Cascade delete: Removing a class_section deletes its assignments.

3) DTOs (Zod)
ts
Copier le code
// src/modules/teaching/dto.ts
import { z } from 'zod';

export const CreateAssignmentDto = z.object({
  teacherProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable().optional(),
  isLead: z.boolean().optional(),
  isHomeroom: z.boolean().optional(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
  notes: z.string().max(300).optional(),
});

export const UpdateAssignmentDto = z.object({
  isLead: z.boolean().optional(),
  isHomeroom: z.boolean().optional(),
  hoursPerWeek: z.number().int().min(1).max(40).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
  termId: z.string().uuid().nullable().optional(),
});

export const ListQueryDto = z.object({
  teacherProfileId: z.string().uuid().optional(),
  classSectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});
4) Endpoints (spec)
Base path: /api/teaching/*

Admin (manage)
POST /assignments (CreateAssignmentDto) — create a teaching assignment (enforces rules #1–#4).

PATCH /assignments/:id (UpdateAssignmentDto) — update flags/term/hours/notes (re-check rules).

DELETE /assignments/:id — remove an assignment.

GET /assignments (ListQueryDto via query string) — list with filters.

Convenience
POST /class-sections/:id/homeroom — set homeroom teacher (body: { teacherProfileId, academicYearId }) → clears previous.

GET /class-sections/:id/homeroom?yearId= — get homeroom teacher for year.

Teacher self-view
GET /my/assignments — requires TEACHER role; returns only the caller’s assignments.

Error shape: { "error": { "message": "string", "details"?: any } }

5) Routes (Express 5 — outline)
ts
Copier le code
// src/modules/teaching/routes.ts
import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import { users, userRoles, profiles } from '../../db/schema/identity';
import { term, academicYear, classSection, subject } from '../../db/schema/academics';
import { teachingAssignment } from '../../db/schema/teaching';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { and, eq } from 'drizzle-orm';

export const teachingRouter = Router();

/* ----- helpers ----- */
async function ensureTeacherProfile(profileId: string) {
  // profile -> user -> has TEACHER role
  const row = await db.query.profiles.findFirst({
    where: (p, { eq }) => eq(p.id, profileId),
    with: {
      user: {
        with: {
          roles: true
        }
      }
    } as any
  } as any); // adjust if you use relations()
  const hasTeacher = row?.user
    ? (await db.select().from(userRoles).where(and(eq(userRoles.userId, row.userId!), eq(userRoles.role, 'TEACHER')))).length > 0
    : false;
  if (!hasTeacher) throw Object.assign(new Error('Profile is not a TEACHER'), { status: 400 });
}

async function ensureTermInYear(termId?: string | null, yearId?: string) {
  if (!termId) return;
  const [t] = await db.select().from(term).where(eq(term.id, termId));
  if (!t || t.academicYearId !== yearId) {
    throw Object.assign(new Error('termId must belong to academicYearId'), { status: 400 });
  }
}

async function enforceLeadUniqueness(sectionId: string, subjectId: string, termId: string | null, makeLead: boolean, assignmentIdToSkip?: string) {
  if (!makeLead) return;
  const rows = await db.select().from(teachingAssignment).where(and(
    eq(teachingAssignment.classSectionId, sectionId),
    eq(teachingAssignment.subjectId, subjectId),
    termId ? eq(teachingAssignment.termId, termId) : eq(teachingAssignment.termId, null)
  ));
  // Demote others (except the one we’re creating/updating)
  for (const r of rows) {
    if (assignmentIdToSkip && r.id === assignmentIdToSkip) continue;
    if (r.isLead) {
      await db.update(teachingAssignment).set({ isLead: false }).where(eq(teachingAssignment.id, r.id));
    }
  }
}

async function enforceHomeroomUniqueness(sectionId: string, yearId: string, makeHomeroom: boolean, assignmentIdToSkip?: string) {
  if (!makeHomeroom) return;
  const rows = await db.select().from(teachingAssignment).where(and(
    eq(teachingAssignment.classSectionId, sectionId),
    eq(teachingAssignment.academicYearId, yearId)
  ));
  for (const r of rows) {
    if (assignmentIdToSkip && r.id === assignmentIdToSkip) continue;
    if (r.isHomeroom) {
      await db.update(teachingAssignment).set({ isHomeroom: false }).where(eq(teachingAssignment.id, r.id));
    }
  }
}

/* ----- Admin: create assignment ----- */
teachingRouter.post('/assignments', requireAdmin, validate(CreateAssignmentDto), async (req, res) => {
  const { teacherProfileId, classSectionId, subjectId, academicYearId, termId=null, isLead=true, isHomeroom=false, hoursPerWeek, notes } = req.body;

  await ensureTeacherProfile(teacherProfileId);
  await ensureTermInYear(termId, academicYearId);

  const [row] = await db.transaction(async tx => {
    await enforceLeadUniqueness(classSectionId, subjectId, termId, !!isLead);
    await enforceHomeroomUniqueness(classSectionId, academicYearId, !!isHomeroom);

    const [created] = await tx.insert(teachingAssignment).values({
      teacherProfileId, classSectionId, subjectId, academicYearId,
      termId, isLead: !!isLead, isHomeroom: !!isHomeroom, hoursPerWeek: hoursPerWeek ?? null, notes: notes ?? null
    }).returning();

    return [created];
  });

  res.status(201).json(row);
});

/* ----- Admin: update ----- */
teachingRouter.patch('/assignments/:id', requireAdmin, validate(UpdateAssignmentDto), async (req, res) => {
  const [existing] = await db.select().from(teachingAssignment).where(eq(teachingAssignment.id, req.params.id));
  if (!existing) return res.status(404).json({ error: { message: 'Assignment not found' } });

  if (req.body.termId !== undefined) {
    await ensureTermInYear(req.body.termId ?? null, existing.academicYearId);
  }

  await db.transaction(async () => {
    if (req.body.isLead !== undefined) {
      await enforceLeadUniqueness(existing.classSectionId, existing.subjectId, existing.termId ?? null, !!req.body.isLead, existing.id);
    }
    if (req.body.isHomeroom !== undefined) {
      await enforceHomeroomUniqueness(existing.classSectionId, existing.academicYearId, !!req.body.isHomeroom, existing.id);
    }
    await db.update(teachingAssignment).set(req.body).where(eq(teachingAssignment.id, existing.id));
  });

  const [updated] = await db.select().from(teachingAssignment).where(eq(teachingAssignment.id, req.params.id));
  res.json(updated);
});

/* ----- Admin: delete ----- */
teachingRouter.delete('/assignments/:id', requireAdmin, async (req, res) => {
  const [row] = await db.delete(teachingAssignment).where(eq(teachingAssignment.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Assignment not found' } });
  res.json({ ok: true });
});

/* ----- Admin: list with filters ----- */
teachingRouter.get('/assignments', requireAdmin, async (req, res) => {
  const { teacherProfileId, classSectionId, subjectId, academicYearId, termId } = req.query as Record<string, string | undefined>;
  const where = [];
  if (teacherProfileId) where.push(eq(teachingAssignment.teacherProfileId, teacherProfileId));
  if (classSectionId) where.push(eq(teachingAssignment.classSectionId, classSectionId));
  if (subjectId) where.push(eq(teachingAssignment.subjectId, subjectId));
  if (academicYearId) where.push(eq(teachingAssignment.academicYearId, academicYearId));
  if (termId) where.push(eq(teachingAssignment.termId, termId));
  const rows = await db.select().from(teachingAssignment).where((where as any).length ? (and as any)(...where) : undefined);
  res.json(rows);
});

/* ----- Homeroom helpers ----- */
teachingRouter.post('/class-sections/:id/homeroom', requireAdmin, async (req, res) => {
  const sectionId = req.params.id;
  const { teacherProfileId, academicYearId } = req.body as { teacherProfileId: string; academicYearId: string };
  await ensureTeacherProfile(teacherProfileId);
  await enforceHomeroomUniqueness(sectionId, academicYearId, true);
  // prefer to update existing teacher assignment if exists for this section/year; else create a stub without subject
  const [row] = await db.insert(teachingAssignment).values({
    teacherProfileId, classSectionId: sectionId, subjectId: (await db.select().from(subject).limit(1))[0]?.id, // or require subject explicitly
    academicYearId, termId: null, isLead: true, isHomeroom: true
  }).returning();
  res.status(201).json(row);
});

teachingRouter.get('/class-sections/:id/homeroom', requireAdmin, async (req, res) => {
  const sectionId = req.params.id;
  const yearId = req.query.yearId as string | undefined;
  const where = [eq(teachingAssignment.classSectionId, sectionId), eq(teachingAssignment.isHomeroom, true)];
  if (yearId) where.push(eq(teachingAssignment.academicYearId, yearId));
  const rows = await db.select().from(teachingAssignment).where((and as any)(...where));
  res.json(rows);
});
(For teacher self-view, add a small router that requires TEACHER and filters by the caller’s profile.)

6) Manual Tests (cURL)
bash
Copier le code
# Create teaching assignment (Admin)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"teacherProfileId":"<TEACHER_PID>","classSectionId":"<SECTION_ID>","subjectId":"<SUBJECT_ID>","academicYearId":"<YEAR_ID>","termId":null,"isLead":true,"hoursPerWeek":4}' \
  http://localhost:4000/api/teaching/assignments

# Make a co-teacher (assistant)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"teacherProfileId":"<OTHER_TEACHER_PID>","classSectionId":"<SECTION_ID>","subjectId":"<SUBJECT_ID>","academicYearId":"<YEAR_ID>","isLead":false}' \
  http://localhost:4000/api/teaching/assignments

# Promote assistant to lead (demotes previous lead automatically)
curl -b cookies.txt -H "Content-Type: application/json" -X PATCH \
  -d '{"isLead":true}' \
  http://localhost:4000/api/teaching/assignments/<ASSIGNMENT_ID>

# Set homeroom teacher (clears previous)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"teacherProfileId":"<TEACHER_PID>","academicYearId":"<YEAR_ID>"}' \
  http://localhost:4000/api/teaching/class-sections/<SECTION_ID>/homeroom

# List by filters
curl -b cookies.txt "http://localhost:4000/api/teaching/assignments?teacherProfileId=<TEACHER_PID>&academicYearId=<YEAR_ID>"
7) Acceptance Criteria
Admin can assign one or more teachers to a section’s subject, with optional term scoping.

Service verifies the teacher profile actually has the TEACHER role.

Setting is_lead=true on an assignment ensures there is only one lead per (section, subject, term?).

Setting is_homeroom=true ensures only one homeroom per (section, academic_year).

Teachers can fetch only their own assignments via a dedicated endpoint (if enabled).

Data aligns across modules: term (if provided) belongs to the academic_year.

8) Notes & Extensions
Timetabling/Periods are out of scope here; add a separate module if you need day/period schedules.

Consider an audit_log for changes: who assigned whom, when.

If you want stricter DB guarantees, add partial unique indexes:

One lead per section/subject/term:

sql
Copier le code
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_per_slot
ON teaching_assignment(class_section_id, subject_id, COALESCE(term_id, '00000000-0000-0000-0000-000000000000')::uuid)
WHERE is_lead = true;
One homeroom per section/year:

sql
Copier le code
CREATE UNIQUE INDEX IF NOT EXISTS uq_homeroom_per_section_year
ON teaching_assignment(class_section_id, academic_year_id)
WHERE is_homeroom = true;
If your school sets department heads, add department and relate subjects/staff accordingly.



# Module 5 — Attendance (API-only, **Express 5 + Drizzle**)

**Goal:** record attendance for students, either **daily (homeroom)** or **per-subject lesson**.  
**Permissions:**  
- **ADMIN/STAFF** can manage any attendance.  
- **TEACHER** can manage attendance **only** for class sections (and subjects) they’re assigned to in Module 4.

---

## 0) Outcomes

- New tables:
  - `attendance_session` — one taking event (section + date [+ subject/term]) created by a teacher/staff/admin
  - `attendance_record` — one row per student with a status and optional note
- Endpoints:
  - Create/list/finalize sessions
  - Bulk mark statuses for a session
  - Roster with attendance for a day
  - Student & section attendance history and simple aggregates
- Rules:
  - **Uniqueness:** Only **one** session per `(class_section, taken_on, subject?)` within an academic year.
  - Students must be **actively enrolled** (Module 3) in the section/year on the date.
  - When a session is **finalized**, only ADMIN can modify it.

---

## 1) Data Model (Drizzle / Postgres)

### Enums
- `attendance_status`: `PRESENT | ABSENT | LATE | EXCUSED`

### Tables

#### `attendance_session`
A single attendance-taking event for a **class_section** on a specific **date**, optionally tied to a **subject** and **term**.

| column               | type        | notes |
|----------------------|-------------|------|
| `id`                 | uuid        | **PK**, `default gen_random_uuid()` |
| `class_section_id`   | uuid        | **FK → class_section(id)** `ON DELETE CASCADE` |
| `academic_year_id`   | uuid        | **FK → academic_year(id)** `ON DELETE RESTRICT` |
| `term_id`            | uuid        | nullable **FK → term(id)** (`SET NULL`) |
| `subject_id`         | uuid        | nullable **FK → subject(id)** (`RESTRICT`) — null = daily/homeroom |
| `taken_on`           | date        | **NOT NULL** — the calendar day |
| `taken_by_profile_id`| uuid        | **FK → profiles(id)** — who initiated |
| `started_at`         | timestamptz | default `now()` |
| `finalized_at`       | timestamptz | nullable — set when locked |
| `note`               | text        | optional |

**Uniqueness:** `(class_section_id, taken_on, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000'))`

#### `attendance_record`
One row per student for a session.

| column               | type        | notes |
|----------------------|-------------|------|
| `id`                 | uuid        | **PK** |
| `session_id`         | uuid        | **FK → attendance_session(id)** `ON DELETE CASCADE` |
| `student_profile_id` | uuid        | **FK → profiles(id)** (student) `ON DELETE CASCADE` |
| `status`             | enum        | `attendance_status`, default `PRESENT` |
| `note`               | text        | optional |
| `marked_at`          | timestamptz | default `now()` |

**Uniqueness:** `(session_id, student_profile_id)`

---

### Drizzle schema (drop-in)

```ts
// src/db/schema/attendance.ts
import { pgTable, uuid, date, timestamp, text, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, classSection, subject, term } from './academics';

export const attendanceStatus = pgEnum('attendance_status', [
  'PRESENT', 'ABSENT', 'LATE', 'EXCUSED'
]);

export const attendanceSession = pgTable('attendance_session', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  classSectionId: uuid('class_section_id').notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),

  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'restrict' }),

  termId: uuid('term_id').references(() => term.id, { onDelete: 'set null' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'restrict' }),

  takenOn: date('taken_on').notNull(),
  takenByProfileId: uuid('taken_by_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),

  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  note: text('note'),
}, (t) => ({
  uq: { // unique per section+day+subject (null-safe)
    columns: [t.classSectionId, t.takenOn, t.subjectId],
    name: 'uq_session_section_day_subject'
  }
}));

export const attendanceRecord = pgTable('attendance_record', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  sessionId: uuid('session_id').notNull()
    .references(() => attendanceSession.id, { onDelete: 'cascade' }),
  studentProfileId: uuid('student_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  status: attendanceStatus('status').notNull().default('PRESENT'),
  note: text('note'),
  markedAt: timestamp('marked_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uq: { columns: [t.sessionId, t.studentProfileId], name: 'uq_record_session_student' }
}));
Note: Some Postgres engines treat UNIQUE (subject_id) with NULLs as allowing multiple NULLs, which is fine (one per section/day with subject NULL). If you want a stricter “null-safe” uniqueness, keep the unique expression in a manual migration:

sql
Copier le code
CREATE UNIQUE INDEX IF NOT EXISTS uq_session_section_day_subject_expr
  ON attendance_session (class_section_id, taken_on, COALESCE(subject_id, '00000000-0000-0000-0000-000000000000')::uuid);
2) Business Rules
Who can create/mark

ADMIN/STAFF: any section/subject.

TEACHER: must have an active teaching_assignment (Module 4) for the same class_section_id, same academic_year_id, and:

If subject_id is provided → must match an assignment (same subject and term if provided), OR

If subject_id is null → must be homeroom or any assignment for that section/year.

Student eligibility

Only students with an ACTIVE enrollment (Module 3) in this academic_year_id and class_section_id on taken_on can be marked.

Finalization

After finalized_at is set, only ADMIN can modify records or session meta.

Idempotency

Creating a session with the same (section, taken_on, subject?) returns/conflicts with the existing session.

Defaults

Bulk marking can treat missing students as PRESENT if markMode='delta'. Otherwise, send all.

3) DTOs (Zod)
ts
Copier le code
// src/modules/attendance/dto.ts
import { z } from 'zod';

export const CreateSessionDto = z.object({
  classSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable().optional(),
  subjectId: z.string().uuid().nullable().optional(), // null => daily/homeroom
  takenOn: z.coerce.date(),
  note: z.string().max(300).optional(),
});

export const BulkMarkDto = z.object({
  // if true, only the provided student IDs are changed; all others keep existing (or default PRESENT if creating brand new records)
  markMode: z.enum(['replace','delta']).default('replace'),
  items: z.array(z.object({
    studentProfileId: z.string().uuid(),
    status: z.enum(['PRESENT','ABSENT','LATE','EXCUSED']),
    note: z.string().max(200).optional(),
  })).min(1),
});

export const UpdateRecordDto = z.object({
  status: z.enum(['PRESENT','ABSENT','LATE','EXCUSED']).optional(),
  note: z.string().max(200).nullable().optional(),
});

export const ListSessionsQuery = z.object({
  classSectionId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mine: z.enum(['true','false']).optional(), // teacher-only: show only own
});
4) Endpoints (spec)
Base path: /api/attendance/*

Sessions
POST /sessions (CreateSessionDto)
Create (or 409 if conflict). Must pass permission checks.

GET /sessions?classSectionId=&academicYearId=&subjectId=&from=&to=&mine=
List sessions (admins see all; teachers can filter and optionally mine=true).

POST /sessions/:id/finalize
Set finalized_at (lock). Only ADMIN can re-open (not included here).

GET /sessions/:id
Returns session + records.

Records
POST /sessions/:id/records (BulkMarkDto)
Upsert many records in one call. Enforces enrollment eligibility.

PATCH /records/:recordId (UpdateRecordDto)
Update a single record (if not finalized or ADMIN).

Convenience & Reports
GET /sections/:id/roster?date=YYYY-MM-DD&subjectId=
Returns roster (enrolled students) with status for that date, creating a virtual PRESENT if no record yet.

GET /students/:profileId/attendance?from=&to=
Timeline for one student.

GET /sections/:id/summary?from=&to=&subjectId=
Aggregate counts { present, absent, late, excused } by day.

Error shape: { "error": { "message": "string", "details"?: any } }

5) Route Logic (Express 5 — outline)
ts
Copier le code
// src/modules/attendance/routes.ts
import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/rbac';
import { attendanceSession, attendanceRecord } from '../../db/schema/attendance';
import { enrollment } from '../../db/schema/enrollment';
import { teachingAssignment } from '../../db/schema/teaching';
import { classSection } from '../../db/schema/academics';
import { profiles, userRoles, users } from '../../db/schema/identity';
import { and, eq, between, inArray, isNull, or } from 'drizzle-orm';
import {
  CreateSessionDto, BulkMarkDto, UpdateRecordDto
} from './dto';

export const attendanceRouter = Router();
attendanceRouter.use(requireAuth);

// ----- helpers -----
async function canManageSession(reqUser:{id:string; roles:string[]; profileId?:string}, sectionId:string, yearId:string, subjectId?:string|null) {
  if (reqUser.roles.includes('ADMIN') || reqUser.roles.includes('STAFF')) return true;
  if (!reqUser.roles.includes('TEACHER') || !reqUser.profileId) return false;
  const where = [
    eq(teachingAssignment.teacherProfileId, reqUser.profileId),
    eq(teachingAssignment.classSectionId, sectionId),
    eq(teachingAssignment.academicYearId, yearId),
  ];
  if (subjectId) where.push(eq(teachingAssignment.subjectId, subjectId));
  // allow homeroom on daily session (subjectId null)
  if (!subjectId) {
    const rows = await db.select().from(teachingAssignment)
      .where(and(...where));
    return rows.some(r => r.isHomeroom || r.subjectId != null);
  }
  const rows = await db.select().from(teachingAssignment).where(and(...where));
  return rows.length > 0;
}

async function ensureNotFinalized(sessionId:string) {
  const [s] = await db.select().from(attendanceSession).where(eq(attendanceSession.id, sessionId));
  if (!s) throw Object.assign(new Error('Session not found'), { status: 404 });
  if (s.finalizedAt) throw Object.assign(new Error('Session is finalized'), { status: 423 });
  return s;
}

// ----- create session -----
attendanceRouter.post('/sessions', validate(CreateSessionDto), async (req, res, next) => {
  try {
    const u = req.session.user!;
    const { classSectionId, academicYearId, termId=null, subjectId=null, takenOn, note } = req.body;

    if (!(await canManageSession(u as any, classSectionId, academicYearId, subjectId))) {
      return res.status(403).json({ error: { message: 'Not allowed for this section/subject/year' } });
    }

    // try to find existing
    const existing = await db.select().from(attendanceSession)
      .where(and(
        eq(attendanceSession.classSectionId, classSectionId),
        eq(attendanceSession.academicYearId, academicYearId),
        eq(attendanceSession.takenOn, takenOn as any),
        subjectId ? eq(attendanceSession.subjectId, subjectId) : isNull(attendanceSession.subjectId)
      ));
    if (existing[0]) return res.status(200).json(existing[0]);

    const [session] = await db.insert(attendanceSession).values({
      classSectionId, academicYearId, termId, subjectId, takenOn, takenByProfileId: (req.session as any).profileId ?? u.id, note: note ?? null
    }).returning();

    res.status(201).json(session);
  } catch (e) { next(e); }
});

// ----- list sessions -----
attendanceRouter.get('/sessions', async (req, res) => {
  const { classSectionId, academicYearId, subjectId, from, to, mine } = req.query as Record<string,string|undefined>;
  const u = req.session.user!;
  const where = [];
  if (classSectionId) where.push(eq(attendanceSession.classSectionId, classSectionId));
  if (academicYearId) where.push(eq(attendanceSession.academicYearId, academicYearId));
  if (subjectId) where.push(eq(attendanceSession.subjectId, subjectId));
  if (from && to) where.push(between(attendanceSession.takenOn, from as any, to as any));
  if (mine === 'true') where.push(eq(attendanceSession.takenByProfileId, (req.session as any).profileId ?? u.id));
  const rows = await db.select().from(attendanceSession).where((where as any).length ? (and as any)(...where) : undefined);
  res.json(rows);
});

// ----- finalize -----
attendanceRouter.post('/sessions/:id/finalize', async (req, res) => {
  const u = req.session.user!;
  if (!u.roles.includes('ADMIN') && !u.roles.includes('STAFF')) {
    return res.status(403).json({ error: { message: 'Admin/Staff only' } });
  }
  const [row] = await db.update(attendanceSession).set({ finalizedAt: new Date() }).where(eq(attendanceSession.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Session not found' } });
  res.json({ ok: true });
});

// ----- bulk mark -----
attendanceRouter.post('/sessions/:id/records', validate(BulkMarkDto), async (req, res, next) => {
  try {
    const s = await ensureNotFinalized(req.params.id);
    const u = req.session.user!;
    if (!(await canManageSession(u as any, s.classSectionId, s.academicYearId, s.subjectId))) {
      return res.status(403).json({ error: { message: 'Not allowed' } });
    }

    // Eligibility: are they enrolled & active in this section/year on takenOn?
    const studentIds = req.body.items.map(i => i.studentProfileId);
    const eligible = await db.select({ studentProfileId: enrollment.studentProfileId })
      .from(enrollment)
      .where(and(
        eq(enrollment.academicYearId, s.academicYearId),
        eq(enrollment.classSectionId, s.classSectionId),
        inArray(enrollment.studentProfileId, studentIds),
        eq(enrollment.status, 'ACTIVE')
      ));
    const eligibleSet = new Set(eligible.map(e => e.studentProfileId));
    const invalid = studentIds.filter(id => !eligibleSet.has(id));
    if (invalid.length) return res.status(400).json({ error: { message: 'Some students not actively enrolled', details: invalid } });

    // Upsert in a tx
    await db.transaction(async tx => {
      for (const item of req.body.items) {
        const existing = await tx.select().from(attendanceRecord)
          .where(and(eq(attendanceRecord.sessionId, s.id), eq(attendanceRecord.studentProfileId, item.studentProfileId)));
        if (existing[0]) {
          await tx.update(attendanceRecord)
            .set({ status: item.status, note: item.note ?? null, markedAt: new Date() })
            .where(eq(attendanceRecord.id, existing[0].id));
        } else {
          await tx.insert(attendanceRecord).values({
            sessionId: s.id, studentProfileId: item.studentProfileId, status: item.status, note: item.note ?? null
          });
        }
      }
    });

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ----- single record update -----
attendanceRouter.patch('/records/:id', validate(UpdateRecordDto), async (req, res, next) => {
  try {
    // guard finalized
    const [r] = await db.select().from(attendanceRecord).where(eq(attendanceRecord.id, req.params.id));
    if (!r) return res.status(404).json({ error: { message: 'Record not found' } });
    await ensureNotFinalized(r.sessionId);
    await db.update(attendanceRecord).set(req.body).where(eq(attendanceRecord.id, r.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ----- roster with attendance (day view) -----
attendanceRouter.get('/sections/:id/roster', async (req, res) => {
  const sectionId = req.params.id;
  const dateStr = req.query.date as string;
  const subjectId = (req.query.subjectId as string) || null;

  if (!dateStr) return res.status(400).json({ error: { message: 'date is required (YYYY-MM-DD)' } });

  // find or not
  const [s] = await db.select().from(attendanceSession)
    .where(and(
      eq(attendanceSession.classSectionId, sectionId),
      eq(attendanceSession.takenOn, dateStr as any),
      subjectId ? eq(attendanceSession.subjectId, subjectId) : isNull(attendanceSession.subjectId)
    ));

  // active roster (Module 3)
  const roster = await db.select({
    studentProfileId: enrollment.studentProfileId,
  }).from(enrollment).where(and(
    eq(enrollment.classSectionId, sectionId),
    eq(enrollment.status, 'ACTIVE')
  ));

  let records: Record<string, any> = {};
  if (s) {
    const recs = await db.select().from(attendanceRecord).where(eq(attendanceRecord.sessionId, s.id));
    for (const r of recs) records[r.studentProfileId] = r;
  }

  // return per-student + status (default PRESENT if no record)
  res.json(roster.map(r => ({
    studentProfileId: r.studentProfileId,
    status: records[r.studentProfileId]?.status ?? 'PRESENT',
    recordId: records[r.studentProfileId]?.id ?? null
  })));
});

// ----- student timeline -----
attendanceRouter.get('/students/:profileId/attendance', async (req, res) => {
  const pid = req.params.profileId;
  const { from, to } = req.query as Record<string, string | undefined>;
  const rows = await db.select({
    date: attendanceSession.takenOn,
    sectionId: attendanceSession.classSectionId,
    subjectId: attendanceSession.subjectId,
    status: attendanceRecord.status
  })
  .from(attendanceRecord)
  .leftJoin(attendanceSession, eq(attendanceRecord.sessionId, attendanceSession.id))
  .where(and(
    eq(attendanceRecord.studentProfileId, pid),
    from && to ? between(attendanceSession.takenOn, from as any, to as any) : ({} as any)
  ));
  res.json(rows);
});

// ----- section summary -----
attendanceRouter.get('/sections/:id/summary', async (req, res) => {
  // NOTE: implement an aggregate query in your flavor; or compute in JS
  res.json({ todo: 'aggregate present/absent/late/excused per day in range' });
});
6) Manual Tests (cURL)
bash
Copier le code
# Create a DAILY session (homeroom)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"classSectionId":"<SEC_ID>","academicYearId":"<YEAR_ID>","takenOn":"2025-10-03"}' \
  http://localhost:4000/api/attendance/sessions

# Create a SUBJECT session (e.g., Physics period)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"classSectionId":"<SEC_ID>","academicYearId":"<YEAR_ID>","subjectId":"<SUBJECT_ID>","termId":"<TERM_ID>","takenOn":"2025-10-03"}' \
  http://localhost:4000/api/attendance/sessions

# Bulk mark (replace mode)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"markMode":"replace","items":[
        {"studentProfileId":"<STU1>","status":"PRESENT"},
        {"studentProfileId":"<STU2>","status":"ABSENT","note":"sick"},
        {"studentProfileId":"<STU3>","status":"LATE"}
      ]}' \
  http://localhost:4000/api/attendance/sessions/<SESSION_ID>/records

# Update single record
curl -b cookies.txt -H "Content-Type: application/json" -X PATCH \
  -d '{"status":"EXCUSED","note":"medical"}' \
  http://localhost:4000/api/attendance/records/<RECORD_ID>

# Finalize session (Admin/Staff only)
curl -b cookies.txt -X POST http://localhost:4000/api/attendance/sessions/<SESSION_ID>/finalize

# Day roster with statuses (default PRESENT if unset)
curl -b cookies.txt "http://localhost:4000/api/attendance/sections/<SEC_ID>/roster?date=2025-10-03"

# Student timeline (date range)
curl -b cookies.txt "http://localhost:4000/api/attendance/students/<STU_ID>/attendance?from=2025-09-01&to=2025-12-31"
7) Acceptance Criteria
Can create daily or per-subject attendance sessions, enforcing teacher permissions from Module 4.

Can bulk mark and edit attendance for eligible (actively enrolled) students.

Uniqueness: one session per (section, date, subject?) and one record per (session, student).

Finalize locks a session; only ADMIN can change afterward.

Can fetch roster with statuses for a particular date, and a student timeline.

Error responses are consistent; validation and rule checks prevent invalid operations.

8) Notes & Extensions
Add per-session window (e.g., can edit until 23:59 of taken_on).

Add audit_log (who marked what and when).

Add CSV export for day or range.

Add attendance thresholds to flag chronic absence/late.

Optimize reporting using materialized views if needed.