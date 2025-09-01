# Module 2 — School & Academics Base (API-only, **Express 5 + Drizzle**)

Build the foundation for all academic features:
- Define **stages → grade levels → class sections**.
- Define **time**: academic years and terms.
- Define **subjects** and attach them to class sections.

> All endpoints require **ADMIN** (reuse Module 1 sessions + `requireAdmin`).  
> No multi-tenant. Single institution.

---

## 0) Outcomes

- New DB schema:  
  `education_stage`, `grade_level`, `academic_year`, `term`,  
  `subject`, `class_section`, `class_section_subject`.
- CRUD endpoints for each entity + attach/remove subjects to a class section.
- Validation & constraints: uniqueness, ordering, date ranges.

---

## 1) Database Design (Drizzle / Postgres)

### Entities & Relationships

- **education_stage** 1—* grade_level  
- **academic_year** 1—* term  
- **grade_level** + **academic_year** 1—* class_section  
- **class_section** *—* **subject** (via `class_section_subject`)

### Tables

#### `education_stage`
| column        | type   | notes                                 |
|---------------|--------|----------------------------------------|
| `id`          | uuid   | PK, `default gen_random_uuid()`        |
| `code`        | text   | **UNIQUE**, e.g., `PRIMAIRE`, `LYCEE`  |
| `name`        | text   | display name                           |
| `order_index` | int    | for sorting                            |
| `is_active`   | bool   | default `true`                         |

#### `grade_level`
| column        | type | notes                                                      |
|---------------|------|------------------------------------------------------------|
| `id`          | uuid | PK                                                         |
| `stage_id`    | uuid | **FK → education_stage(id) ON DELETE RESTRICT**           |
| `code`        | text | e.g., `CP1`, `SECONDE`, `TERMINALE`                        |
| `name`        | text | display name                                               |
| `order_index` | int  | for sorting within stage                                  |
| **unique**    |      | `(stage_id, code)`                                         |

#### `academic_year`
| column       | type        | notes                                      |
|--------------|-------------|--------------------------------------------|
| `id`         | uuid        | PK                                         |
| `code`       | text        | **UNIQUE**, e.g., `2025-2026`              |
| `starts_on`  | date        |                                            |
| `ends_on`    | date        | must be > `starts_on`                      |
| `is_active`  | bool        | default `true` (you can later enforce 1 active) |

#### `term`
| column             | type | notes                                           |
|--------------------|------|-------------------------------------------------|
| `id`               | uuid | PK                                              |
| `academic_year_id` | uuid | **FK → academic_year(id) ON DELETE CASCADE**   |
| `name`             | text | e.g., `Trimestre 1`, `Semestre 2`               |
| `starts_on`        | date | must be within year range                       |
| `ends_on`          | date | `ends_on > starts_on`                           |
| `order_index`      | int  | for sorting                                     |
| **unique**         |      | `(academic_year_id, name)`                      |

#### `subject`
| column    | type | notes                                           |
|-----------|------|--------------------------------------------------|
| `id`      | uuid | PK                                              |
| `code`    | text | **UNIQUE**, e.g., `MATH`, `ENG`, `PHYS`         |
| `name`    | text | display name                                    |
| `stage_id`| uuid | nullable FK → `education_stage(id)` (optional)  |
| `is_active`| bool| default `true`                                  |

#### `class_section`
Represents a concrete class in a given academic year (e.g., **2nde A (2025–2026)**).

| column             | type | notes                                                                    |
|--------------------|------|--------------------------------------------------------------------------|
| `id`               | uuid | PK                                                                       |
| `academic_year_id` | uuid | FK → academic_year(id)                                                   |
| `grade_level_id`   | uuid | FK → grade_level(id)                                                     |
| `name`             | text | e.g., `A`, `B`, `Science`, `Général`                                     |
| `capacity`         | int  | optional                                                                 |
| `room`             | text | optional                                                                 |
| `is_active`        | bool | default `true`                                                           |
| **unique**         |      | `(academic_year_id, grade_level_id, name)`                               |

#### `class_section_subject` (junction)
| column            | type | notes                                          |
|-------------------|------|-----------------------------------------------|
| `class_section_id`| uuid | FK → class_section(id) ON DELETE CASCADE      |
| `subject_id`      | uuid | FK → subject(id) ON DELETE RESTRICT           |
| **PK**            |      | `(class_section_id, subject_id)`              |

---

### Drizzle schema (drop-in)

```ts
// src/db/schema/academics.ts
import { pgTable, uuid, text, integer, boolean, date } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
/* If enums are needed later, add pgEnum here */

export const educationStage = pgTable('education_stage', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
});

export const gradeLevel = pgTable('grade_level', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  stageId: uuid('stage_id').notNull().references(() => educationStage.id, { onDelete: 'restrict' }),
  code: text('code').notNull(),
  name: text('name').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
}, (t) => ({
  uq: { columns: [t.stageId, t.code], name: 'uq_grade_level_stage_code' }
}));

export const academicYear = pgTable('academic_year', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(), // e.g., 2025-2026
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  /* Later: CHECK (starts_on < ends_on) — in generated SQL or a manual migration */
});

export const term = pgTable('term', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),            // Trimestre 1 / Semestre 2
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
}, (t) => ({
  uq: { columns: [t.academicYearId, t.name], name: 'uq_term_year_name' }
}));

export const subject = pgTable('subject', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  stageId: uuid('stage_id').references(() => educationStage.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
});

export const classSection = pgTable('class_section', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  academicYearId: uuid('academic_year_id').notNull()
    .references(() => academicYear.id, { onDelete: 'cascade' }),
  gradeLevelId: uuid('grade_level_id').notNull()
    .references(() => gradeLevel.id, { onDelete: 'restrict' }),
  name: text('name').notNull(), // e.g., A / B / Science
  capacity: integer('capacity'),
  room: text('room'),
  isActive: boolean('is_active').notNull().default(true),
}, (t) => ({
  uq: { columns: [t.academicYearId, t.gradeLevelId, t.name], name: 'uq_class_section_triple' }
}));

export const classSectionSubject = pgTable('class_section_subject', {
  classSectionId: uuid('class_section_id').notNull()
    .references(() => classSection.id, { onDelete: 'cascade' }),
  subjectId: uuid('subject_id').notNull()
    .references(() => subject.id, { onDelete: 'restrict' }),
}, (t) => ({
  pk: { columns: [t.classSectionId, t.subjectId] }
}));
Optional CHECK constraints (add a manual SQL migration after generation):

sql
Copier le code
ALTER TABLE academic_year
  ADD CONSTRAINT chk_year_dates CHECK (starts_on < ends_on);
ALTER TABLE term
  ADD CONSTRAINT chk_term_dates CHECK (starts_on < ends_on);
-- Ensure term inside year range (cannot be a plain CHECK, enforce in service or trigger)
2) Seed (recommended for Chad structure)
ts
Copier le code
// scripts/seed_academics.ts (outline)
import { db } from '../src/db/client';
import { educationStage, gradeLevel } from '../src/db/schema/academics';
import { eq } from 'drizzle-orm';

const stages = [
  { code: 'PRIMAIRE', name: 'Primaire', orderIndex: 1 },
  { code: 'SECONDAIRE', name: 'Secondaire/Collège', orderIndex: 2 },
  { code: 'LYCEE', name: 'Lycée', orderIndex: 3 },
  { code: 'UNIV', name: 'Université', orderIndex: 4 },
];

const primaire = ['CP1','CP2','CE1','CE2','CM1','CM2'];
const college  = ['6e','5e','4e','3e'];
const lycee    = ['SECONDE','PREMIERE','TERMINALE'];

async function up(){
  // insert stages
  for(const s of stages){
    await db.insert(educationStage).values(s).onConflictDoNothing();
  }
  const [stPrimaire] = await db.select().from(educationStage).where(eq(educationStage.code,'PRIMAIRE'));
  const [stSecond]   = await db.select().from(educationStage).where(eq(educationStage.code,'SECONDAIRE'));
  const [stLycee]    = await db.select().from(educationStage).where(eq(educationStage.code,'LYCEE'));

  // levels
  let oi=1; for(const code of primaire)
    await db.insert(gradeLevel).values({ stageId: stPrimaire.id, code, name: code, orderIndex: oi++ }).onConflictDoNothing();
  oi=1; for(const code of college)
    await db.insert(gradeLevel).values({ stageId: stSecond.id, code, name: code, orderIndex: oi++ }).onConflictDoNothing();
  oi=1; for(const code of lycee)
    await db.insert(gradeLevel).values({ stageId: stLycee.id, code, name: code, orderIndex: oi++ }).onConflictDoNothing();
  console.log('Seeded stages & grade levels.');
}
up().catch(console.error);
3) DTOs (Zod)
ts
Copier le code
// src/modules/academics/dto.ts
import { z } from 'zod';

export const CreateStageDto = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  name: z.string().min(1).max(80),
  orderIndex: z.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});
export const UpdateStageDto = CreateStageDto.partial();

export const CreateGradeLevelDto = z.object({
  stageId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(80),
  orderIndex: z.number().int().min(0).default(0),
});
export const UpdateGradeLevelDto = CreateGradeLevelDto.partial();

export const CreateAcademicYearDto = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  isActive: z.boolean().optional(),
}).refine(d => d.startsOn < d.endsOn, { message: 'startsOn must be before endsOn', path: ['endsOn'] });
export const UpdateAcademicYearDto = CreateAcademicYearDto.partial();

export const CreateTermDto = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().min(1).max(64),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  orderIndex: z.number().int().min(0).default(0),
}).refine(d => d.startsOn < d.endsOn, { message: 'startsOn must be before endsOn', path: ['endsOn'] });
export const UpdateTermDto = CreateTermDto.partial();

export const CreateSubjectDto = z.object({
  code: z.string().min(2).max(32).toUpperCase(),
  name: z.string().min(1).max(80),
  stageId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
export const UpdateSubjectDto = CreateSubjectDto.partial();

export const CreateClassSectionDto = z.object({
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  name: z.string().min(1).max(64),
  capacity: z.number().int().min(1).optional(),
  room: z.string().max(64).optional(),
  isActive: z.boolean().optional(),
});
export const UpdateClassSectionDto = CreateClassSectionDto.partial();

export const SetSectionSubjectsDto = z.object({
  subjectIds: z.array(z.string().uuid()).min(0),
});
4) Endpoints (spec)
Base path: /api/academics/* — all requireAdmin.

Education Stages
POST /education-stages (CreateStageDto)

GET /education-stages (list; optional ?active=bool)

PATCH /education-stages/:id (UpdateStageDto)

DELETE /education-stages/:id (only if no dependent grade levels)

Grade Levels
POST /grade-levels (CreateGradeLevelDto)

GET /grade-levels?stageId= (filter by stage)

PATCH /grade-levels/:id (UpdateGradeLevelDto)

DELETE /grade-levels/:id (restrain if class sections exist)

Academic Years
POST /academic-years (CreateAcademicYearDto)

GET /academic-years

PATCH /academic-years/:id (UpdateAcademicYearDto)

DELETE /academic-years/:id (only if no sections/terms)

(Optional) when setting isActive=true, set others to false.

Terms
POST /terms (CreateTermDto) — validate inside year range

GET /terms?academicYearId=

PATCH /terms/:id (UpdateTermDto)

DELETE /terms/:id

Subjects
POST /subjects (CreateSubjectDto)

GET /subjects?stageId=&active=

PATCH /subjects/:id (UpdateSubjectDto)

DELETE /subjects/:id (only if not attached to sections)

Class Sections
POST /class-sections (CreateClassSectionDto)

GET /class-sections?academicYearId=&gradeLevelId=

PATCH /class-sections/:id (UpdateClassSectionDto)

DELETE /class-sections/:id

Class Section ↔ Subjects
POST /class-sections/:id/subjects (SetSectionSubjectsDto)
Replaces the full set of subjects for the section (idempotent).

GET /class-sections/:id/subjects

DELETE /class-sections/:id/subjects/:subjectId

Error shape: { "error": { "message": "string", "details"?: any } }

5) Routes (Express 5 — outline)
ts
Copier le code
// src/modules/academics/routes.ts
import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import {
  educationStage, gradeLevel, academicYear, term,
  subject, classSection, classSectionSubject
} from '../../db/schema/academics';
import {
  CreateStageDto, UpdateStageDto, CreateGradeLevelDto, UpdateGradeLevelDto,
  CreateAcademicYearDto, UpdateAcademicYearDto, CreateTermDto, UpdateTermDto,
  CreateSubjectDto, UpdateSubjectDto, CreateClassSectionDto, UpdateClassSectionDto,
  SetSectionSubjectsDto
} from './dto';
import { and, eq, inArray } from 'drizzle-orm';

export const academicsRouter = Router();
academicsRouter.use(requireAdmin);

/* ---- Stages ---- */
academicsRouter.post('/education-stages', validate(CreateStageDto), async (req, res) => {
  const [row] = await db.insert(educationStage).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/education-stages', async (req, res) => {
  const active = req.query.active;
  const data = await db.select().from(educationStage)
    .where(active === undefined ? undefined : eq(educationStage.isActive, active === 'true'))
    .orderBy(educationStage.orderIndex);
  res.json(data);
});
academicsRouter.patch('/education-stages/:id', validate(UpdateStageDto), async (req, res) => {
  const [row] = await db.update(educationStage).set(req.body).where(eq(educationStage.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/education-stages/:id', async (req, res) => {
  const [row] = await db.delete(educationStage).where(eq(educationStage.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Grade Levels ---- */
academicsRouter.post('/grade-levels', validate(CreateGradeLevelDto), async (req, res) => {
  const [row] = await db.insert(gradeLevel).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/grade-levels', async (req, res) => {
  const { stageId } = req.query as { stageId?: string };
  const data = await db.select().from(gradeLevel)
    .where(stageId ? eq(gradeLevel.stageId, stageId) : undefined)
    .orderBy(gradeLevel.orderIndex);
  res.json(data);
});
academicsRouter.patch('/grade-levels/:id', validate(UpdateGradeLevelDto), async (req, res) => {
  const [row] = await db.update(gradeLevel).set(req.body).where(eq(gradeLevel.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/grade-levels/:id', async (req, res) => {
  const [row] = await db.delete(gradeLevel).where(eq(gradeLevel.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Academic Years ---- */
academicsRouter.post('/academic-years', validate(CreateAcademicYearDto), async (req, res) => {
  // Optional: if setting isActive=true, set others false
  if (req.body.isActive === true) {
    await db.update(academicYear).set({ isActive: false }).where(eq(academicYear.isActive, true));
  }
  const [row] = await db.insert(academicYear).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/academic-years', async (_req, res) => {
  const data = await db.select().from(academicYear).orderBy(academicYear.startsOn);
  res.json(data);
});
academicsRouter.patch('/academic-years/:id', validate(UpdateAcademicYearDto), async (req, res) => {
  if (req.body.isActive === true) {
    await db.update(academicYear).set({ isActive: false }).where(and(eq(academicYear.isActive, true), eq(academicYear.id, req.params.id) === false as any));
  }
  const [row] = await db.update(academicYear).set(req.body).where(eq(academicYear.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/academic-years/:id', async (req, res) => {
  const [row] = await db.delete(academicYear).where(eq(academicYear.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Terms ---- */
academicsRouter.post('/terms', validate(CreateTermDto), async (req, res) => {
  const [row] = await db.insert(term).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/terms', async (req, res) => {
  const { academicYearId } = req.query as { academicYearId?: string };
  const data = await db.select().from(term)
    .where(academicYearId ? eq(term.academicYearId, academicYearId) : undefined)
    .orderBy(term.orderIndex);
  res.json(data);
});
academicsRouter.patch('/terms/:id', validate(UpdateTermDto), async (req, res) => {
  const [row] = await db.update(term).set(req.body).where(eq(term.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/terms/:id', async (req, res) => {
  const [row] = await db.delete(term).where(eq(term.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Subjects ---- */
academicsRouter.post('/subjects', validate(CreateSubjectDto), async (req, res) => {
  const [row] = await db.insert(subject).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/subjects', async (req, res) => {
  const { stageId, active } = req.query as { stageId?: string; active?: string };
  const where = [
    stageId ? eq(subject.stageId, stageId) : undefined,
    active === undefined ? undefined : eq(subject.isActive, active === 'true')
  ].filter(Boolean) as any;
  const data = await db.select().from(subject).where(where.length ? and(...where) : undefined).orderBy(subject.code);
  res.json(data);
});
academicsRouter.patch('/subjects/:id', validate(UpdateSubjectDto), async (req, res) => {
  const [row] = await db.update(subject).set(req.body).where(eq(subject.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/subjects/:id', async (req, res) => {
  const [row] = await db.delete(subject).where(eq(subject.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Class Sections ---- */
academicsRouter.post('/class-sections', validate(CreateClassSectionDto), async (req, res) => {
  const [row] = await db.insert(classSection).values(req.body).returning();
  res.status(201).json(row);
});
academicsRouter.get('/class-sections', async (req, res) => {
  const { academicYearId, gradeLevelId } = req.query as { academicYearId?: string; gradeLevelId?: string };
  const where = [
    academicYearId ? eq(classSection.academicYearId, academicYearId) : undefined,
    gradeLevelId ? eq(classSection.gradeLevelId, gradeLevelId) : undefined,
  ].filter(Boolean) as any;
  const data = await db.select().from(classSection).where(where.length ? and(...where) : undefined)
    .orderBy(classSection.name);
  res.json(data);
});
academicsRouter.patch('/class-sections/:id', validate(UpdateClassSectionDto), async (req, res) => {
  const [row] = await db.update(classSection).set(req.body).where(eq(classSection.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json(row);
});
academicsRouter.delete('/class-sections/:id', async (req, res) => {
  const [row] = await db.delete(classSection).where(eq(classSection.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});

/* ---- Section Subjects ---- */
academicsRouter.post('/class-sections/:id/subjects', validate(SetSectionSubjectsDto), async (req, res) => {
  const sectionId = req.params.id;
  // Replace full set atomically
  await db.transaction(async tx => {
    await tx.delete(classSectionSubject).where(eq(classSectionSubject.classSectionId, sectionId));
    const ids = req.body.subjectIds;
    if (ids.length) {
      await tx.insert(classSectionSubject).values(ids.map(sid => ({
        classSectionId: sectionId, subjectId: sid
      })));
    }
  });
  res.json({ ok: true });
});
academicsRouter.get('/class-sections/:id/subjects', async (req, res) => {
  const sectionId = req.params.id;
  const rows = await db.select().from(classSectionSubject).where(eq(classSectionSubject.classSectionId, sectionId));
  res.json(rows);
});
academicsRouter.delete('/class-sections/:id/subjects/:subjectId', async (req, res) => {
  const sectionId = req.params.id;
  const subjectId = req.params.subjectId;
  const [row] = await db.delete(classSectionSubject)
    .where(and(eq(classSectionSubject.classSectionId, sectionId), eq(classSectionSubject.subjectId, subjectId)))
    .returning();
  if (!row) return res.status(404).json({ error: { message: 'Not found' } });
  res.json({ ok: true });
});
6) Manual Tests (cURL)
bash
Copier le code
# (Assumes you’re logged in as ADMIN and have cookies.txt from Module 1)

# Stages
curl -b cookies.txt -H "Content-Type: application/json" -d '{"code":"PRIMAIRE","name":"Primaire","orderIndex":1}' \
  http://localhost:4000/api/academics/education-stages

# Grade levels (example)
curl -b cookies.txt -H "Content-Type: application/json" -d '{"stageId":"<STAGE_ID>","code":"CP1","name":"CP1"}' \
  http://localhost:4000/api/academics/grade-levels

# Academic year
curl -b cookies.txt -H "Content-Type: application/json" -d '{"code":"2025-2026","startsOn":"2025-09-01","endsOn":"2026-06-30"}' \
  http://localhost:4000/api/academics/academic-years

# Term
curl -b cookies.txt -H "Content-Type: application/json" -d '{"academicYearId":"<YEAR_ID>","name":"Trimestre 1","startsOn":"2025-09-01","endsOn":"2025-11-30","orderIndex":1}' \
  http://localhost:4000/api/academics/terms

# Subject
curl -b cookies.txt -H "Content-Type: application/json" -d '{"code":"MATH","name":"Mathématiques"}' \
  http://localhost:4000/api/academics/subjects

# Class section
curl -b cookies.txt -H "Content-Type: application/json" -d '{"academicYearId":"<YEAR_ID>","gradeLevelId":"<LEVEL_ID>","name":"A","capacity":45}' \
  http://localhost:4000/api/academics/class-sections

# Attach subjects to section
curl -b cookies.txt -H "Content-Type: application/json" -d '{"subjectIds":["<SUBJECT_ID>","<SUBJECT_ID_2>"]}' \
  http://localhost:4000/api/academics/class-sections/<SECTION_ID>/subjects

# Get section subjects
curl -b cookies.txt http://localhost:4000/api/academics/class-sections/<SECTION_ID>/subjects
7) Acceptance Criteria
Can define stages and grade levels reflecting the Chad system.

Can create an academic year and its terms with valid date ranges.

Can define subjects (optionally tied to a stage).

Can create class sections (unique per year/grade/name) and attach/remove subjects.

All endpoints require ADMIN; return consistent error JSON.

Constraints enforced: uniqueness; date order; optional “single active year” behavior.