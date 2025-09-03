import { Router } from 'express';
import { db } from '../../db/client';
import { and, eq, asc, desc, gte, isNull, lte, or, sql, lt, inArray } from 'drizzle-orm';
import {
  educationStage,
  gradeLevel,
  academicYear,
  term,
  subject,
  classSection,
  classSectionSubject,
  // Timetable + related
  timetablePeriod,
  timetableSlot,
  timetableException,
  // Cross-module tables
  teachingAssignment,
  enrollment,
  guardianStudent,
} from '../../db/schema';
import { validate } from '../../middlewares/validate';
import { requireAdmin, requireAuth, requireStaffOrAdmin } from '../../middlewares/rbac';
import {
  CreateStageDto, UpdateStageDto,
  CreateGradeLevelDto, UpdateGradeLevelDto,
  CreateAcademicYearDto, UpdateAcademicYearDto,
  CreateTermDto, UpdateTermDto,
  CreateSubjectDto, UpdateSubjectDto,
  CreateClassSectionDto, UpdateClassSectionDto,
  SetSectionSubjectsDto,
  // Timetable DTOs
  CreatePeriodDto, CreateSlotDto, UpdSlotDto, AddExceptionDto, TimetableQuery,
} from './dto';
import { writeAudit, actorFromReq } from '../../utils/audit';

const router = Router();

// Education Stages
router.post(
   '/education-stages',
   requireAdmin,
   validate(CreateStageDto),
   async (req, res) => {
      const [row] = await db
         .insert(educationStage)
         .values(req.body)
         .onConflictDoNothing()
         .returning();
      if (!row)
         return res
            .status(409)
            .json({ error: { message: 'Education stage already exists' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_STAGE_CREATE',
         entityType: 'education_stage',
         entityId: row.id,
         summary: `Created education stage ${row.name}`,
         meta: { payload: req.body, created: row },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.status(201).json(row);
   }
);
router.get('/education-stages', requireAdmin, async (_req, res) => {
   const rows = await db
      .select()
      .from(educationStage)
      .orderBy(asc(educationStage.orderIndex));
   res.json(rows);
});
router.patch(
   '/education-stages/:id',
   requireAdmin,
   validate(UpdateStageDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const [before] = await db
         .select()
         .from(educationStage)
         .where(eq(educationStage.id, id));
      const [row] = await db
         .update(educationStage)
         .set(req.body)
         .where(eq(educationStage.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_STAGE_UPDATE',
         entityType: 'education_stage',
         entityId: id,
         summary: `Updated education stage ${id}`,
         meta: { before, after: row, changes: req.body },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Grade Levels
router.post(
   '/grade-levels',
   requireAdmin,
   validate(CreateGradeLevelDto),
   async (req, res) => {
      const [row] = await db
         .insert(gradeLevel)
         .values(req.body)
         .onConflictDoNothing()
         .returning();
      if (!row)
         return res
            .status(409)
            .json({
               error: { message: 'Grade level already exists for this stage' },
            });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_GRADE_CREATE',
         entityType: 'grade_level',
         entityId: row.id,
         summary: `Created grade level ${row.name} for stage ${row.stageId}`,
         meta: { payload: req.body, created: row },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.status(201).json(row);
   }
);
router.get('/grade-levels', requireAdmin, async (req, res) => {
   const { stageId } = req.query as any;
   const rows = await db
      .select()
      .from(gradeLevel)
      .where(
         stageId ? eq(gradeLevel.stageId, String(stageId)) : (undefined as any)
      )
      .orderBy(asc(gradeLevel.orderIndex));
   res.json(rows);
});
router.patch(
   '/grade-levels/:id',
   requireAdmin,
   validate(UpdateGradeLevelDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const [before] = await db
         .select()
         .from(gradeLevel)
         .where(eq(gradeLevel.id, id));
      const [row] = await db
         .update(gradeLevel)
         .set(req.body)
         .where(eq(gradeLevel.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_GRADE_UPDATE',
         entityType: 'grade_level',
         entityId: id,
         summary: `Updated grade level ${id}`,
         meta: { before, after: row, changes: req.body },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Academic Years
const toDateOnly = (d: unknown): string => {
   if (!d) return d as any;
   if (typeof d === 'string') {
      // assume already YYYY-MM-DD or ISO, normalize
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const iso = new Date(d).toISOString();
      return iso.slice(0, 10);
   }
   if (d instanceof Date) return d.toISOString().slice(0, 10);
   return d as any;
};
router.post(
   '/academic-years',
   requireAdmin,
   validate(CreateAcademicYearDto),
   async (req, res) => {
      const payload = {
         ...req.body,
         startsOn: toDateOnly(req.body.startsOn),
         endsOn: toDateOnly(req.body.endsOn),
      };
      const [row] = await db
         .insert(academicYear)
         .values(payload)
         .onConflictDoNothing()
         .returning();
      if (!row)
         return res
            .status(409)
            .json({ error: { message: 'Academic year already exists' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_YEAR_CREATE',
         entityType: 'academic_year',
         entityId: row.id,
         summary: `Created academic year ${row.code}`,
         meta: { payload, created: row },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.status(201).json(row);
   }
);
router.get('/academic-years', requireAdmin, async (_req, res) => {
   const rows = await db
      .select()
      .from(academicYear)
      .orderBy(asc(academicYear.startsOn));
   res.json(rows);
});
router.patch(
   '/academic-years/:id',
   requireAdmin,
   validate(UpdateAcademicYearDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const payload: any = { ...req.body };
      if (payload.startsOn) payload.startsOn = toDateOnly(payload.startsOn);
      if (payload.endsOn) payload.endsOn = toDateOnly(payload.endsOn);
      const [before] = await db
         .select()
         .from(academicYear)
         .where(eq(academicYear.id, id));
      const [row] = await db
         .update(academicYear)
         .set(payload)
         .where(eq(academicYear.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_YEAR_UPDATE',
         entityType: 'academic_year',
         entityId: id,
         summary: `Updated academic year ${id}`,
         meta: { before, after: row, changes: payload },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Terms
router.post(
   '/terms',
   requireAdmin,
   validate(CreateTermDto),
   async (req, res) => {
      const payload = {
         ...req.body,
         startsOn: toDateOnly(req.body.startsOn),
         endsOn: toDateOnly(req.body.endsOn),
      };
      const [row] = await db
         .insert(term)
         .values(payload)
         .onConflictDoNothing()
         .returning();
      if (!row)
         return res
            .status(409)
            .json({
               error: { message: 'Term already exists for this academic year' },
            });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_TERM_CREATE',
         entityType: 'term',
         entityId: row.id,
         summary: `Created term ${row.name} for year ${row.academicYearId}`,
         meta: { payload, created: row },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.status(201).json(row);
   }
);
router.get('/terms', requireAdmin, async (req, res) => {
   const { academicYearId } = req.query as any;
   const rows = await db
      .select()
      .from(term)
      .where(
         academicYearId
            ? eq(term.academicYearId, String(academicYearId))
            : (undefined as any)
      )
      .orderBy(asc(term.orderIndex));
   res.json(rows);
});
router.patch(
   '/terms/:id',
   requireAdmin,
   validate(UpdateTermDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const payload: any = { ...req.body };
      if (payload.startsOn) payload.startsOn = toDateOnly(payload.startsOn);
      if (payload.endsOn) payload.endsOn = toDateOnly(payload.endsOn);
      const [before] = await db.select().from(term).where(eq(term.id, id));
      const [row] = await db
         .update(term)
         .set(payload)
         .where(eq(term.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_TERM_UPDATE',
         entityType: 'term',
         entityId: id,
         summary: `Updated term ${id}`,
         meta: { before, after: row, changes: payload },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Subjects
router.post('/subjects', requireAdmin, validate(CreateSubjectDto), async (req, res) => {
   const [row] = await db
      .insert(subject)
      .values(req.body)
      .onConflictDoNothing()
      .returning();
   if (!row)
      return res
         .status(409)
         .json({ error: { message: 'Subject already exists' } });
   // Audit
   const actor = actorFromReq(req);
   await writeAudit(db, {
      action: 'ACADEMICS_SUBJECT_CREATE',
      entityType: 'subject',
      entityId: row.id,
      summary: `Created subject ${row.code}`,
      meta: { payload: req.body, created: row },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
   });
   res.status(201).json(row);
});
router.get('/subjects', requireAdmin, async (req, res) => {
  const { stageId } = req.query as any;
  const rows = await db
    .select()
    .from(subject)
    .where(stageId ? eq(subject.stageId, String(stageId)) : undefined as any)
    .orderBy(asc(subject.code));
  res.json(rows);
});
router.patch(
   '/subjects/:id',
   requireAdmin,
   validate(UpdateSubjectDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const [before] = await db
         .select()
         .from(subject)
         .where(eq(subject.id, id));
      const [row] = await db
         .update(subject)
         .set(req.body)
         .where(eq(subject.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_SUBJECT_UPDATE',
         entityType: 'subject',
         entityId: id,
         summary: `Updated subject ${id}`,
         meta: { before, after: row, changes: req.body },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Class Sections
router.post(
   '/class-sections',
   requireAdmin,
   validate(CreateClassSectionDto),
   async (req, res) => {
      const [row] = await db
         .insert(classSection)
         .values(req.body)
         .onConflictDoNothing()
         .returning();
      if (!row)
         return res
            .status(409)
            .json({
               error: {
                  message: 'Class section already exists for year and level',
               },
            });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_SECTION_CREATE',
         entityType: 'class_section',
         entityId: row.id,
         summary: `Created class section ${row.name} (year ${row.academicYearId}, level ${row.gradeLevelId})`,
         meta: { payload: req.body, created: row },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.status(201).json(row);
   }
);
router.get('/class-sections', requireAdmin, async (req, res) => {
   const { academicYearId, gradeLevelId } = req.query as any;
   const where =
      academicYearId && gradeLevelId
         ? and(
              eq(classSection.academicYearId, String(academicYearId)),
              eq(classSection.gradeLevelId, String(gradeLevelId))
           )
         : academicYearId
           ? eq(classSection.academicYearId, String(academicYearId))
           : gradeLevelId
             ? eq(classSection.gradeLevelId, String(gradeLevelId))
             : (undefined as any);
   const rows = await db
      .select()
      .from(classSection)
      .where(where)
      .orderBy(asc(classSection.name));
   res.json(rows);
});
router.patch(
   '/class-sections/:id',
   requireAdmin,
   validate(UpdateClassSectionDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const [before] = await db
         .select()
         .from(classSection)
         .where(eq(classSection.id, id));
      const [row] = await db
         .update(classSection)
         .set(req.body)
         .where(eq(classSection.id, id))
         .returning();
      if (!row)
         return res.status(404).json({ error: { message: 'Not Found' } });
      // Audit
      const actor = actorFromReq(req);
      await writeAudit(db, {
         action: 'ACADEMICS_SECTION_UPDATE',
         entityType: 'class_section',
         entityId: id,
         summary: `Updated class section ${id}`,
         meta: { before, after: row, changes: req.body },
         actorUserId: actor.userId ?? null,
         actorRoles: actor.roles ?? null,
         ip: actor.ip ?? null,
         at: new Date(),
      });
      res.json(row);
   }
);

// Section Subjects
router.post(
   '/class-sections/:id/subjects',
   requireAdmin,
   validate(SetSectionSubjectsDto),
   async (req, res) => {
      const id = req.params.id;
      if (!id)
         return res.status(400).json({ error: { message: 'id required' } });
      const sectionId = id;
      const actor = actorFromReq(req);
      await db.transaction(async (tx) => {
         await tx
            .delete(classSectionSubject)
            .where(eq(classSectionSubject.classSectionId, sectionId));
         const ids = req.body.subjectIds as string[];
         if (ids.length) {
            await tx.insert(classSectionSubject).values(
               ids.map((sid) => ({
                  classSectionId: sectionId,
                  subjectId: sid,
               }))
            );
         }
         // Audit inside tx
         await writeAudit(tx, {
            action: 'ACADEMICS_SECTION_SET_SUBJECTS',
            entityType: 'class_section',
            entityId: sectionId,
            summary: `Set ${ids.length} subjects for class section ${sectionId}`,
            meta: { subjectIds: ids },
            actorUserId: actor.userId ?? null,
            actorRoles: actor.roles ?? null,
            ip: actor.ip ?? null,
            at: new Date(),
         });
      });
      res.json({ ok: true });
   }
);

router.get('/class-sections/:id/subjects', requireAdmin, async (req, res) => {
  const id = req.params.id; if(!id) return res.status(400).json({ error: { message: 'id required' } });
  const sectionId = id;
  const rows = await db.select().from(classSectionSubject).where(eq(classSectionSubject.classSectionId, sectionId));
  res.json(rows);
});

// Timetable service helper
async function timetableForSectionOnDate(sectionId: string, dateISO: string) {
  const dayStart = new Date(`${dateISO}T00:00:00`);
  const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // JS getDay: 0=Sun..6=Sat -> convert to 1=Mon..7=Sun
  const jsDow = dayStart.getDay();
  const dow = jsDow === 0 ? 7 : jsDow; // 1..7

  // Section-level cancellation?
  const [ex] = await db
    .select()
    .from(timetableException)
    .where(
      and(
        eq(timetableException.classSectionId, sectionId),
        gte(timetableException.date, dayStart),
        lt(timetableException.date, nextDay),
        eq(timetableException.canceled, true)
      )
    );
  if (ex) return { items: [] as { sectionId: string; sectionName: string; subjectName?: string | null; startsAt: string; endsAt: string }[] };

  const rows = await db
    .select({
      sectionId: classSection.id,
      sectionName: classSection.name,
      subjectName: subject.name,
      pStart: timetablePeriod.startsAt,
      pEnd: timetablePeriod.endsAt,
    })
    .from(timetableSlot)
    .innerJoin(timetablePeriod, eq(timetableSlot.periodId, timetablePeriod.id))
    .innerJoin(classSection, eq(timetableSlot.classSectionId, classSection.id))
    .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
    .where(
      and(
        eq(timetableSlot.classSectionId, sectionId),
        eq(timetableSlot.dayOfWeek, dow),
        lte(timetableSlot.validFrom, nextDay),
        or(isNull(timetableSlot.validTo), gte(timetableSlot.validTo, dayStart))
      )
    )
    .orderBy(asc(timetablePeriod.startsAt));

  const items = rows.map(r => ({
    sectionId: r.sectionId,
    sectionName: r.sectionName,
    subjectName: r.subjectName,
    startsAt: `${dateISO}T${String(r.pStart).slice(0,8)}`,
    endsAt: `${dateISO}T${String(r.pEnd).slice(0,8)}`,
  }));
  return { items };
}

// Timetable: periods
router.post('/timetable/periods', requireAdmin, validate(CreatePeriodDto), async (req, res) => {
  const actor = actorFromReq(req);
  const [row] = await db.insert(timetablePeriod).values({
    label: req.body.label,
    startsAt: req.body.startsAt,
    endsAt: req.body.endsAt,
  }).returning();
  await writeAudit(db, {
    action: 'TIMETABLE_PERIOD_CREATE',
    entityType: 'timetable_period',
    entityId: row.id,
    summary: `Created period ${row.label}`,
    meta: { created: row },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.status(201).json(row);
});
router.get('/timetable/periods', requireAuth, async (_req, res) => {
  const rows = await db.select().from(timetablePeriod).orderBy(asc(timetablePeriod.startsAt));
  res.json(rows);
});

// Timetable: slots
router.post('/timetable/slots', requireStaffOrAdmin, validate(CreateSlotDto), async (req, res) => {
  const actor = actorFromReq(req);
  const [row] = await db.insert(timetableSlot).values({
    classSectionId: req.body.classSectionId,
    subjectId: req.body.subjectId,
    teacherProfileId: req.body.teacherProfileId,
    dayOfWeek: req.body.dayOfWeek,
    periodId: req.body.periodId,
    room: req.body.room,
    validFrom: req.body.validFrom ?? new Date(),
    validTo: req.body.validTo ?? null,
  }).returning();
  await writeAudit(db, {
    action: 'TIMETABLE_SLOT_CREATE',
    entityType: 'timetable_slot',
    entityId: row.id,
    summary: `Created slot for section ${row.classSectionId} day ${row.dayOfWeek}`,
    meta: { created: row },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.status(201).json(row);
});
router.patch('/timetable/slots/:id', requireStaffOrAdmin, validate(UpdSlotDto), async (req, res) => {
  const id = req.params.id; if (!id) return res.status(400).json({ error: { message: 'id required' } });
  const actor = actorFromReq(req);
  const [before] = await db.select().from(timetableSlot).where(eq(timetableSlot.id, id));
  const [row] = await db.update(timetableSlot).set(req.body).where(eq(timetableSlot.id, id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Not Found' } });
  await writeAudit(db, {
    action: 'TIMETABLE_SLOT_UPDATE',
    entityType: 'timetable_slot',
    entityId: id,
    summary: `Updated slot ${id}`,
    meta: { before, after: row, changes: req.body },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json(row);
});
router.delete('/timetable/slots/:id', requireStaffOrAdmin, async (req, res) => {
  const id = req.params.id; if (!id) return res.status(400).json({ error: { message: 'id required' } });
  const actor = actorFromReq(req);
  const [before] = await db.select().from(timetableSlot).where(eq(timetableSlot.id, id));
  await db.delete(timetableSlot).where(eq(timetableSlot.id, id));
  await writeAudit(db, {
    action: 'TIMETABLE_SLOT_DELETE',
    entityType: 'timetable_slot',
    entityId: id,
    summary: `Deleted slot ${id}`,
    meta: { before },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.json({ ok: true });
});

// Timetable: exceptions
router.post('/timetable/exceptions', requireStaffOrAdmin, validate(AddExceptionDto), async (req, res) => {
  const actor = actorFromReq(req);
  const d = new Date(req.body.date);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const [row] = await db.insert(timetableException).values({
    classSectionId: req.body.classSectionId,
    date: dayStart,
    canceled: req.body.canceled ?? true,
    note: req.body.note,
  }).returning();
  await writeAudit(db, {
    action: 'TIMETABLE_EXCEPTION_ADD',
    entityType: 'timetable_exception',
    entityId: row.id,
    summary: `Added exception for section ${row.classSectionId} on ${dayStart.toISOString().slice(0,10)}`,
    meta: { created: row },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });
  res.status(201).json(row);
});

// Timetable: section/day (for admin/staff)
router.get('/timetable/section/:id/day', requireStaffOrAdmin, async (req, res) => {
  const sectionId = req.params.id; if (!sectionId) return res.status(400).json({ error: { message: 'section id required' } });
  const date = String((req.query as any).date || new Date().toISOString().slice(0,10));
  const out = await timetableForSectionOnDate(sectionId, date);
  res.json(out);
});

// Timetable endpoint for authenticated users
// REPLACED: placeholder implementation
router.get('/timetable/me', requireAuth, async (req, res) => {
  try {
    const dateISO = String((req.query as any)?.date || new Date().toISOString().slice(0,10));
    const dayStart = new Date(`${dateISO}T00:00:00`);
    const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const jsDow = dayStart.getDay();
    const dow = jsDow === 0 ? 7 : jsDow; // 1..7

    const profileId = (req.session as any)?.profileId as string | undefined;
    const roles: string[] = ((req.session as any)?.user?.roles || []) as string[];
    if (!profileId) return res.status(400).json({ error: { message: 'No profile in session' } });

    const items: { sectionId: string; sectionName: string; subjectName?: string | null; startsAt: string; endsAt: string }[] = [];

    const collectFromRows = (rows: { sectionId: string; sectionName: string; subjectName: string | null; pStart: any; pEnd: any }[]) => {
      for (const r of rows) {
        items.push({
          sectionId: r.sectionId,
          sectionName: r.sectionName,
          subjectName: r.subjectName,
          startsAt: `${dateISO}T${String(r.pStart).slice(0,8)}`,
          endsAt: `${dateISO}T${String(r.pEnd).slice(0,8)}`,
        });
      }
    };

    if (roles.includes('TEACHER')) {
      // Teacher: query directly by teacherProfileId
      const tRows = await db
        .select({
          sectionId: classSection.id,
          sectionName: classSection.name,
          subjectName: subject.name,
          pStart: timetablePeriod.startsAt,
          pEnd: timetablePeriod.endsAt,
          sectionForEx: classSection.id,
        })
        .from(timetableSlot)
        .innerJoin(timetablePeriod, eq(timetableSlot.periodId, timetablePeriod.id))
        .innerJoin(classSection, eq(timetableSlot.classSectionId, classSection.id))
        .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
        .where(
          and(
            eq(timetableSlot.teacherProfileId, profileId),
            eq(timetableSlot.dayOfWeek, dow),
            lte(timetableSlot.validFrom, nextDay),
            or(isNull(timetableSlot.validTo), gte(timetableSlot.validTo, dayStart))
          )
        )
        .orderBy(asc(timetablePeriod.startsAt));

      // Filter out sections canceled via exception
      const secIds = Array.from(new Set(tRows.map(r => r.sectionForEx)));
      let canceled: Record<string, boolean> = {};
      if (secIds.length) {
        const exs = await db
          .select({ sectionId: timetableException.classSectionId })
          .from(timetableException)
          .where(and(inArray(timetableException.classSectionId, secIds), gte(timetableException.date, dayStart), lt(timetableException.date, nextDay), eq(timetableException.canceled, true)));
        canceled = Object.fromEntries(exs.map(e => [e.sectionId, true] as const));
      }
      collectFromRows(tRows.filter(r => !canceled[r.sectionForEx]));
    }

    if (roles.includes('STUDENT')) {
      // Student: find active enrollments
      const enrolls = await db
        .select({ sectionId: enrollment.classSectionId })
        .from(enrollment)
        .where(eq(enrollment.studentProfileId, profileId));
      const sectionIds = Array.from(new Set(enrolls.map(e => e.sectionId)));
      if (sectionIds.length) {
        // Remove canceled sections for the date
        const exs = await db
          .select({ sectionId: timetableException.classSectionId })
          .from(timetableException)
          .where(and(inArray(timetableException.classSectionId, sectionIds), gte(timetableException.date, dayStart), lt(timetableException.date, nextDay), eq(timetableException.canceled, true)));
        const canceled = new Set(exs.map(e => e.sectionId));
        const activeSections = sectionIds.filter(s => !canceled.has(s));
        if (activeSections.length) {
          const sRows = await db
            .select({
              sectionId: classSection.id,
              sectionName: classSection.name,
              subjectName: subject.name,
              pStart: timetablePeriod.startsAt,
              pEnd: timetablePeriod.endsAt,
            })
            .from(timetableSlot)
            .innerJoin(timetablePeriod, eq(timetableSlot.periodId, timetablePeriod.id))
            .innerJoin(classSection, eq(timetableSlot.classSectionId, classSection.id))
            .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
            .where(and(inArray(timetableSlot.classSectionId, activeSections), eq(timetableSlot.dayOfWeek, dow), lte(timetableSlot.validFrom, nextDay), or(isNull(timetableSlot.validTo), gte(timetableSlot.validTo, dayStart))))
            .orderBy(asc(timetablePeriod.startsAt));
          collectFromRows(sRows);
        }
      }
    }

    if (roles.includes('GUARDIAN')) {
      // Guardian: students -> sections
      const wards = await db
        .select({ studentProfileId: guardianStudent.studentProfileId })
        .from(guardianStudent)
        .where(eq(guardianStudent.guardianProfileId, profileId));
      const studentIds = wards.map(w => w.studentProfileId);
      if (studentIds.length) {
        const enrolls = await db
          .select({ sectionId: enrollment.classSectionId })
          .from(enrollment)
          .where(inArray(enrollment.studentProfileId, studentIds));
        const sectionIds = Array.from(new Set(enrolls.map(e => e.sectionId)));
        if (sectionIds.length) {
          const exs = await db
            .select({ sectionId: timetableException.classSectionId })
            .from(timetableException)
            .where(and(inArray(timetableException.classSectionId, sectionIds), gte(timetableException.date, dayStart), lt(timetableException.date, nextDay), eq(timetableException.canceled, true)));
          const canceled = new Set(exs.map(e => e.sectionId));
          const activeSections = sectionIds.filter(s => !canceled.has(s));
          if (activeSections.length) {
            const gRows = await db
              .select({
                sectionId: classSection.id,
                sectionName: classSection.name,
                subjectName: subject.name,
                pStart: timetablePeriod.startsAt,
                pEnd: timetablePeriod.endsAt,
              })
              .from(timetableSlot)
              .innerJoin(timetablePeriod, eq(timetableSlot.periodId, timetablePeriod.id))
              .innerJoin(classSection, eq(timetableSlot.classSectionId, classSection.id))
              .innerJoin(subject, eq(timetableSlot.subjectId, subject.id))
              .where(and(inArray(timetableSlot.classSectionId, activeSections), eq(timetableSlot.dayOfWeek, dow), lte(timetableSlot.validFrom, nextDay), or(isNull(timetableSlot.validTo), gte(timetableSlot.validTo, dayStart))))
              .orderBy(asc(timetablePeriod.startsAt));
            collectFromRows(gRows);
          }
        }
      }
    }

    // De-duplicate by (sectionId, startsAt)
    const seen = new Set<string>();
    const dedup = items.filter(it => {
      const k = `${it.sectionId}-${it.startsAt}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    dedup.sort((a,b) => a.startsAt.localeCompare(b.startsAt));

    res.json({ items: dedup });
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({ error: { message: 'Failed to fetch timetable' } });
  }
});

export default router;