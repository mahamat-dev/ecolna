# Module 3 — Enrollment (API-only, **Express 5 + Drizzle**)
**Scope:** link **students → class sections (by academic year)** and **guardians ↔ students**.

> All endpoints default to **ADMIN** only (reuse Module 1 sessions + `requireAdmin`).  
> If you want office staff to help, swap to a `requireAdminOrStaff` guard later.

---

## 0) Outcomes

- New tables:
  - `enrollment` — student placed in a **class_section** for a given **academic_year**
  - `guardian_student` — guardians linked to students, with relationship & primary flag
- CRUD + helper endpoints:
  - Enroll/transfer/withdraw students
  - List section rosters; list a student’s enrollments
  - Link/unlink guardians; list a student’s guardians; list a guardian’s students
- Server-side rules:
  - A student has **at most one ACTIVE enrollment per academic year**
  - Transfers update prior enrollment status
  - Optional roll numbers unique within a section

---

## 1) Database Design (Drizzle / Postgres)

### Existing references
- From **Module 1**: `profiles`, `student(profile_id PK)`, `guardian(profile_id PK)`
- From **Module 2**: `academic_year`, `class_section`

### New enums
- `enrollment_status`: `ACTIVE | TRANSFERRED_OUT | WITHDRAWN | GRADUATED`
- (optional) `guardian_link_type`: `MOTHER | FATHER | GUARDIAN | RELATIVE | OTHER`

### Tables

#### `enrollment`
Represents a student’s placement in a class section for an academic year.
| column               | type        | notes |
|----------------------|-------------|------|
| `id`                 | uuid        | **PK** `default gen_random_uuid()` |
| `student_profile_id` | uuid        | **FK → profiles(id)** (student), `ON DELETE CASCADE` |
| `class_section_id`   | uuid        | **FK → class_section(id)**, `ON DELETE RESTRICT` |
| `academic_year_id`   | uuid        | **FK → academic_year(id)**, `ON DELETE RESTRICT` (denormalized for fast constraints) |
| `status`             | enum        | `enrollment_status`, default `ACTIVE` |
| `joined_on`          | date        | default to section/year start if absent |
| `exited_on`          | date        | nullable |
| `exit_reason`        | text        | nullable |
| `roll_no`            | integer     | nullable; unique **per class_section** |
| **uniques**          |             | `(student_profile_id, academic_year_id)` ensures single ACTIVE per year; `(student_profile_id, class_section_id)` prevents duplicates |
| **indexes**          |             | index on `class_section_id`, `student_profile_id` |

> Why store `academic_year_id`? It’s derivable from `class_section`, but denormalizing here makes uniqueness constraints and queries much faster/simpler.

#### `guardian_student`
Link table between guardians and students.
| column                 | type    | notes |
|------------------------|---------|------|
| `guardian_profile_id`  | uuid    | **FK → profiles(id)** (guardian), `ON DELETE CASCADE` |
| `student_profile_id`   | uuid    | **FK → profiles(id)** (student), `ON DELETE CASCADE` |
| `link_type`            | text/enum | e.g., `MOTHER | FATHER | GUARDIAN | RELATIVE | OTHER` |
| `is_primary`           | boolean | default `false` |
| **PK**                 |         | `(guardian_profile_id, student_profile_id)` |

---

### Drizzle schema (drop-in)

```ts
// src/db/schema/enrollment.ts
import { pgTable, uuid, integer, text, boolean, date, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, classSection } from './academics';

export const enrollmentStatus = pgEnum('enrollment_status', [
  'ACTIVE','TRANSFERRED_OUT','WITHDRAWN','GRADUATED'
]);

export const enrollment = pgTable('enrollment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

  studentProfileId: uuid('student_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  classSectionId: uuid('class_section_id').notNull()
    .references(() => classSection.id, { onDelete: 'restrict' }),

  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'restrict' }),

  status: enrollmentStatus('status').notNull().default('ACTIVE'),

  joinedOn: date('joined_on'),
  exitedOn: date('exited_on'),
  exitReason: text('exit_reason'),

  rollNo: integer('roll_no'), // optional classroom roll number
}, (t) => ({
  uqStudentYear: { columns: [t.studentProfileId, t.academicYearId], name: 'uq_enrollment_student_year' },
  uqStudentSection: { columns: [t.studentProfileId, t.classSectionId], name: 'uq_enrollment_student_section' },
  uqRollInSection: { columns: [t.classSectionId, t.rollNo], name: 'uq_roll_in_section' },
}));

export const guardianStudent = pgTable('guardian_student', {
  guardianProfileId: uuid('guardian_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  studentProfileId: uuid('student_profile_id').notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),

  linkType: text('link_type'),     // or define a pgEnum if you want strict values
  isPrimary: boolean('is_primary').notNull().default(false),
}, (t) => ({
  pk: { columns: [t.guardianProfileId, t.studentProfileId] }
}));
Optional extra CHECK constraints (manual SQL migration):

sql
Copier le code
ALTER TABLE enrollment
  ADD CONSTRAINT chk_dates_order CHECK (exited_on IS NULL OR joined_on IS NULL OR joined_on <= exited_on);
2) Core Business Rules
One active enrollment per academic year

Creating a new enrollment for the same (student, academic_year) should:

Transfer from old section: set old status='TRANSFERRED_OUT' and exited_on = new.joined_on (if same year).

Roll numbers (optional) must be unique within a class_section.

Withdraw sets status='WITHDRAWN' and exited_on with a reason.

Graduate (end-of-year flow) sets status='GRADUATED'.

Guardian links:

Multiple guardians per student; multiple students per guardian.

Mark one is_primary=true if desired (not enforced globally by DB; enforce in service if needed).

3) DTOs (Zod)
ts
Copier le code
// src/modules/enrollment/dto.ts
import { z } from 'zod';

export const EnrollDto = z.object({
  studentProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  joinedOn: z.coerce.date().optional(),
  rollNo: z.number().int().min(1).optional(),
});

export const TransferDto = z.object({
  studentProfileId: z.string().uuid(),
  fromClassSectionId: z.string().uuid(),
  toClassSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  effectiveOn: z.coerce.date().optional(),
  newRollNo: z.number().int().min(1).optional(),
});

export const WithdrawDto = z.object({
  studentProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  exitedOn: z.coerce.date(),
  reason: z.string().max(200).optional(),
});

export const GraduateDto = z.object({
  studentProfileId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  graduatedOn: z.coerce.date().optional(),
});

export const SetRollNoDto = z.object({
  classSectionId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  rollNo: z.number().int().min(1),
});

export const LinkGuardianDto = z.object({
  guardianProfileId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  linkType: z.string().max(40).optional(), // e.g., 'MOTHER'
  isPrimary: z.boolean().optional(),
});

export const UnlinkGuardianDto = z.object({
  guardianProfileId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
});

export const ReplaceSectionSubjectsDto = z.object({
  subjectIds: z.array(z.string().uuid()).min(0) // (from Module 2 if needed later)
});
4) Endpoints (spec)
Base path: /api/enrollment/* — requireAdmin by default.

Enrollment lifecycle
POST /enrollments (EnrollDto)
Creates enrollment; if student is already enrolled in the same academic_year, marks the old enrollment TRANSFERRED_OUT and creates the new one.

POST /enrollments/transfer (TransferDto)
Explicit transfer between sections in the same academic year (idempotent with the create logic above).

POST /enrollments/withdraw (WithdrawDto)
Sets status to WITHDRAWN, sets exited_on and optional reason.

POST /enrollments/graduate (GraduateDto)
Sets status to GRADUATED (use at year end).

Queries
GET /class-sections/:id/students
Returns roster (students + basic profile + roll numbers) for the section.

GET /students/:profileId/enrollments?yearId=
List a student’s enrollments (filter by academic year if provided).

GET /class-sections/:id/enrollments
Raw enrollment rows for audits.

Roll numbers
PATCH /enrollments/roll-no (SetRollNoDto)
Upsert or update a student’s roll_no in a section (keeps unique per section).

Guardians ↔ Students
POST /links/guardian-student (LinkGuardianDto)
Create or update (upsert) the link. If isPrimary=true, you may choose to set others to false in service.

DELETE /links/guardian-student (UnlinkGuardianDto)
Remove the link.

GET /students/:profileId/guardians
List guardians for the student.

GET /guardians/:profileId/students
List students for the guardian.

Error shape: { "error": { "message": "string", "details"?: any } }

5) Route outline (Express 5)
ts
Copier le code
// src/modules/enrollment/routes.ts
import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import { enrollment, guardianStudent } from '../../db/schema/enrollment';
import { classSection, academicYear } from '../../db/schema/academics';
import { profiles } from '../../db/schema/identity';
import {
  EnrollDto, TransferDto, WithdrawDto, GraduateDto,
  SetRollNoDto, LinkGuardianDto, UnlinkGuardianDto
} from './dto';
import { and, eq } from 'drizzle-orm';

export const enrollmentRouter = Router();
enrollmentRouter.use(requireAdmin);

/* Create/transfer */
enrollmentRouter.post('/enrollments', validate(EnrollDto), async (req, res) => {
  const { studentProfileId, classSectionId, academicYearId, joinedOn, rollNo } = req.body;
  await db.transaction(async tx => {
    // mark old active enrollment in same year as TRANSFERRED_OUT (if exists)
    await tx.update(enrollment)
      .set({ status: 'TRANSFERRED_OUT', exitedOn: joinedOn ?? null })
      .where(and(
        eq(enrollment.studentProfileId, studentProfileId),
        eq(enrollment.academicYearId, academicYearId),
        eq(enrollment.status, 'ACTIVE')
      ));
    // create new
    await tx.insert(enrollment).values({
      studentProfileId, classSectionId, academicYearId,
      status: 'ACTIVE', joinedOn: joinedOn ?? null, rollNo: rollNo ?? null
    });
  });
  res.status(201).json({ ok: true });
});

enrollmentRouter.post('/enrollments/transfer', validate(TransferDto), async (req, res) => {
  const { studentProfileId, fromClassSectionId, toClassSectionId, academicYearId, effectiveOn, newRollNo } = req.body;
  await db.transaction(async tx => {
    await tx.update(enrollment)
      .set({ status: 'TRANSFERRED_OUT', exitedOn: effectiveOn ?? null })
      .where(and(
        eq(enrollment.studentProfileId, studentProfileId),
        eq(enrollment.academicYearId, academicYearId),
        eq(enrollment.classSectionId, fromClassSectionId),
        eq(enrollment.status, 'ACTIVE')
      ));
    await tx.insert(enrollment).values({
      studentProfileId, classSectionId: toClassSectionId, academicYearId,
      status: 'ACTIVE', joinedOn: effectiveOn ?? null, rollNo: newRollNo ?? null
    });
  });
  res.json({ ok: true });
});

/* Withdraw & graduate */
enrollmentRouter.post('/enrollments/withdraw', validate(WithdrawDto), async (req, res) => {
  const { studentProfileId, classSectionId, academicYearId, exitedOn, reason } = req.body;
  const [row] = await db.update(enrollment)
    .set({ status: 'WITHDRAWN', exitedOn, exitReason: reason ?? null })
    .where(and(
      eq(enrollment.studentProfileId, studentProfileId),
      eq(enrollment.academicYearId, academicYearId),
      eq(enrollment.classSectionId, classSectionId),
      eq(enrollment.status, 'ACTIVE')
    )).returning();
  if (!row) return res.status(404).json({ error: { message: 'Active enrollment not found' } });
  res.json({ ok: true });
});

enrollmentRouter.post('/enrollments/graduate', validate(GraduateDto), async (req, res) => {
  const { studentProfileId, academicYearId, graduatedOn } = req.body;
  const [row] = await db.update(enrollment)
    .set({ status: 'GRADUATED', exitedOn: graduatedOn ?? null })
    .where(and(
      eq(enrollment.studentProfileId, studentProfileId),
      eq(enrollment.academicYearId, academicYearId),
      eq(enrollment.status, 'ACTIVE')
    )).returning();
  if (!row) return res.status(404).json({ error: { message: 'Active enrollment not found' } });
  res.json({ ok: true });
});

/* Queries */
enrollmentRouter.get('/class-sections/:id/students', async (req, res) => {
  const sectionId = req.params.id;
  // minimal roster (join to profiles)
  const rows = await db
    .select({
      studentProfileId: enrollment.studentProfileId,
      rollNo: enrollment.rollNo,
      firstName: profiles.firstName,
      lastName: profiles.lastName
    })
    .from(enrollment)
    .leftJoin(profiles, eq(profiles.id, enrollment.studentProfileId))
    .where(and(eq(enrollment.classSectionId, sectionId), eq(enrollment.status, 'ACTIVE')));
  res.json(rows);
});

enrollmentRouter.get('/students/:profileId/enrollments', async (req, res) => {
  const studentId = req.params.profileId;
  const yearId = req.query.yearId as string | undefined;
  const where = yearId
    ? and(eq(enrollment.studentProfileId, studentId), eq(enrollment.academicYearId, yearId))
    : eq(enrollment.studentProfileId, studentId);
  const rows = await db.select().from(enrollment).where(where);
  res.json(rows);
});

/* Roll numbers */
enrollmentRouter.patch('/enrollments/roll-no', validate(SetRollNoDto), async (req, res) => {
  const { classSectionId, studentProfileId, rollNo } = req.body;
  const [row] = await db.update(enrollment)
    .set({ rollNo })
    .where(and(eq(enrollment.classSectionId, classSectionId),
               eq(enrollment.studentProfileId, studentProfileId)))
    .returning();
  if (!row) return res.status(404).json({ error: { message: 'Enrollment not found' } });
  res.json({ ok: true });
});

/* Guardian links */
enrollmentRouter.post('/links/guardian-student', validate(LinkGuardianDto), async (req, res) => {
  const { guardianProfileId, studentProfileId, linkType, isPrimary } = req.body;
  // Upsert (simple two-step)
  await db.delete(guardianStudent)
    .where(and(eq(guardianStudent.guardianProfileId, guardianProfileId),
               eq(guardianStudent.studentProfileId, studentProfileId)));
  await db.insert(guardianStudent).values({
    guardianProfileId, studentProfileId, linkType: linkType ?? null, isPrimary: !!isPrimary
  });
  res.status(201).json({ ok: true });
});

enrollmentRouter.delete('/links/guardian-student', validate(UnlinkGuardianDto), async (req, res) => {
  const { guardianProfileId, studentProfileId } = req.body;
  const [row] = await db.delete(guardianStudent)
    .where(and(eq(guardianStudent.guardianProfileId, guardianProfileId),
               eq(guardianStudent.studentProfileId, studentProfileId)))
    .returning();
  if (!row) return res.status(404).json({ error: { message: 'Link not found' } });
  res.json({ ok: true });
});

enrollmentRouter.get('/students/:profileId/guardians', async (req, res) => {
  const studentId = req.params.profileId;
  const rows = await db.select().from(guardianStudent)
    .where(eq(guardianStudent.studentProfileId, studentId));
  res.json(rows);
});

enrollmentRouter.get('/guardians/:profileId/students', async (req, res) => {
  const guardianId = req.params.profileId;
  const rows = await db.select().from(guardianStudent)
    .where(eq(guardianStudent.guardianProfileId, guardianId));
  res.json(rows);
});
6) Manual Tests (cURL)
bash
Copier le code
# Enroll a student in a section for a year
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"studentProfileId":"<STU_PID>","classSectionId":"<SEC_ID>","academicYearId":"<YEAR_ID>","joinedOn":"2025-09-01","rollNo":12}' \
  http://localhost:4000/api/enrollment/enrollments

# Transfer student between sections in same year
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"studentProfileId":"<STU_PID>","fromClassSectionId":"<SEC_A>","toClassSectionId":"<SEC_B>","academicYearId":"<YEAR_ID>","effectiveOn":"2026-01-10","newRollNo":5}' \
  http://localhost:4000/api/enrollment/enrollments/transfer

# Withdraw student
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"studentProfileId":"<STU_PID>","classSectionId":"<SEC_ID>","academicYearId":"<YEAR_ID>","exitedOn":"2026-03-03","reason":"moved city"}' \
  http://localhost:4000/api/enrollment/enrollments/withdraw

# Graduate student (year end)
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"studentProfileId":"<STU_PID>","academicYearId":"<YEAR_ID>","graduatedOn":"2026-06-30"}' \
  http://localhost:4000/api/enrollment/enrollments/graduate

# Section roster (active students)
curl -b cookies.txt \
  http://localhost:4000/api/enrollment/class-sections/<SEC_ID>/students

# Student’s enrollments (optionally filter by year)
curl -b cookies.txt \
  "http://localhost:4000/api/enrollment/students/<STU_PID>/enrollments?yearId=<YEAR_ID>"

# Set/Change roll number
curl -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"classSectionId":"<SEC_ID>", "studentProfileId":"<STU_PID>", "rollNo":21}' \
  http://localhost:4000/api/enrollment/enrollments/roll-no

# Link guardian ↔ student
curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"guardianProfileId":"<GUARD_PID>","studentProfileId":"<STU_PID>","linkType":"MOTHER","isPrimary":true}' \
  http://localhost:4000/api/enrollment/links/guardian-student

# Unlink guardian ↔ student
curl -b cookies.txt -X DELETE -H "Content-Type: application/json" \
  -d '{"guardianProfileId":"<GUARD_PID>","studentProfileId":"<STU_PID>"}' \
  http://localhost:4000/api/enrollment/links/guardian-student

# List guardians for a student
curl -b cookies.txt \
  http://localhost:4000/api/enrollment/students/<STU_PID>/guardians

# List students for a guardian
curl -b cookies.txt \
  http://localhost:4000/api/enrollment/guardians/<GUARD_PID>/students
7) Acceptance Criteria
A student can be enrolled in exactly one ACTIVE section per academic year.

Transfers correctly end the previous ACTIVE enrollment (same year) as TRANSFERRED_OUT.

Withdraw and Graduate set status and exit dates correctly.

Roster endpoints list active students per section with roll numbers.

Guardian links can be created/removed and queried both directions.

All endpoints require ADMIN (or extended to STAFF via guard change).

Consistent error JSON and validation; uniqueness constraints hold.

8) Notes & Extensions
Add capacity checks (Module 2 class_section.capacity) to block over-enrollment.

Enforce only one primary guardian per student by updating others to is_primary=false on upsert.

Add audit_log entries for enrollment changes (who did what, when).

When switching to Module 4 (Teaching Assignments) and Module 5 (Attendance), use these links to restrict which students appear for a teacher’s class.