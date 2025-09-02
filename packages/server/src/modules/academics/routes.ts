import { Router } from 'express';
import { db } from '../../db/client';
import { and, eq, asc } from 'drizzle-orm';
import {
  educationStage,
  gradeLevel,
  academicYear,
  term,
  subject,
  classSection,
  classSectionSubject,
} from '../../db/schema';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import {
  CreateStageDto, UpdateStageDto,
  CreateGradeLevelDto, UpdateGradeLevelDto,
  CreateAcademicYearDto, UpdateAcademicYearDto,
  CreateTermDto, UpdateTermDto,
  CreateSubjectDto, UpdateSubjectDto,
  CreateClassSectionDto, UpdateClassSectionDto,
  SetSectionSubjectsDto,
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

// Timetable endpoint for authenticated users
router.get('/timetable/me', async (req, res) => {
  try {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ error: { message: 'Not authenticated' } });
    }

    // For now, return empty timetable - this would need proper timetable schema implementation
    // This is a placeholder to prevent 404 errors
    const timetable = {
      items: []
    };
    
    res.json(timetable);
  } catch (error) {
    console.error('Error fetching timetable:', error);
    res.status(500).json({ error: { message: 'Failed to fetch timetable' } });
  }
});

export default router;