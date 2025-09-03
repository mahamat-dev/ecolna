import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin, requireAuth } from '../../middlewares/rbac';
import { userRoles, profiles } from '../../db/schema/identity';
import { term, academicYear, classSection, subject, gradeLevel } from '../../db/schema/academics';
import { teachingAssignment } from '../../db/schema/teaching';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { and, eq, isNull, inArray } from 'drizzle-orm';
import { writeAudit, actorFromReq } from '../../utils/audit';

const router = Router();

/* ----- helpers ----- */
async function ensureTeacherProfile(profileId: string) {
  // Check TEACHER role via userRoles
  const [p] = await db.select().from(profiles).where(eq(profiles.id, profileId));
  if (!p || !p.userId) throw Object.assign(new Error('Profile not linked to user'), { status: 400 });
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, p.userId));
  const hasTeacher = roles.some(r => r.role === 'TEACHER');
  if (!hasTeacher) throw Object.assign(new Error('Profile is not a TEACHER'), { status: 400 });
}

async function ensureTermInYear(termId?: string | null, yearId?: string) {
  if (!termId) return;
  const [t] = await db.select().from(term).where(eq(term.id, termId));
  if (!t || t.academicYearId !== yearId) {
    throw Object.assign(new Error('termId must belong to academicYearId'), { status: 400 });
  }
}

// Lightweight identity helper for non-admin teacher self queries
async function viewerFromReq(req: any) {
  const sess = req.session as any;
  const userId: string | undefined = sess?.user?.id;
  if (!userId) throw Object.assign(new Error('Not authenticated'), { status: 401 });
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) throw Object.assign(new Error('Profile not found'), { status: 400 });
  return { userId, profileId: profile.id };
}

// Public (auth) endpoint for teachers to see their assignments
router.get('/assignments/me', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const rows = await db.select({
      id: teachingAssignment.id,
      classSectionId: teachingAssignment.classSectionId,
      subjectId: teachingAssignment.subjectId,
      academicYearId: teachingAssignment.academicYearId,
      termId: teachingAssignment.termId,
      isLead: teachingAssignment.isLead,
      isHomeroom: teachingAssignment.isHomeroom,
    }).from(teachingAssignment).where(eq(teachingAssignment.teacherProfileId, viewer.profileId));

    // Enrich with gradeLevelId using classSection
    const sectionIds = Array.from(new Set(rows.map(r => r.classSectionId)));
    const sections = sectionIds.length ? await db.select({ id: classSection.id, gradeLevelId: classSection.gradeLevelId, name: classSection.name })
      .from(classSection).where(inArray(classSection.id, sectionIds as any)) : [];
    const sectionMap = new Map(sections.map(s => [s.id, s] as const));
    const gradeIds = Array.from(new Set(sections.map(s => s.gradeLevelId).filter(Boolean) as string[]));
    const grades = gradeIds.length ? await db.select({ id: gradeLevel.id, name: gradeLevel.name }).from(gradeLevel).where(inArray(gradeLevel.id, gradeIds as any)) : [];
    const gradeMap = new Map(grades.map(g => [g.id, g.name] as const));
    const subjIds = Array.from(new Set(rows.map(r => r.subjectId).filter(Boolean) as string[]));
    const subjs = subjIds.length ? await db.select({ id: subject.id, name: subject.name }).from(subject).where(inArray(subject.id, subjIds as any)) : [];
    const subjMap = new Map(subjs.map(s => [s.id, s.name] as const));

    res.json(rows.map(r => ({
      ...r,
      gradeLevelId: sectionMap.get(r.classSectionId)?.gradeLevelId ?? null,
      classSectionName: sectionMap.get(r.classSectionId)?.name ?? null,
      gradeLevelName: (sectionMap.get(r.classSectionId)?.gradeLevelId ? gradeMap.get(sectionMap.get(r.classSectionId)!.gradeLevelId!) : null) ?? null,
      subjectName: r.subjectId ? (subjMap.get(r.subjectId) ?? null) : null,
    })));
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message ?? 'Bad request' } });
  }
});

async function enforceLeadUniqueness(sectionId: string, subjectId: string, termId: string | null, makeLead: boolean, assignmentIdToSkip?: string) {
  if (!makeLead) return;
  const conditions = [
    eq(teachingAssignment.classSectionId, sectionId),
    eq(teachingAssignment.subjectId, subjectId),
    termId ? eq(teachingAssignment.termId, termId) : isNull(teachingAssignment.termId),
  ];
  const rows = await db.select().from(teachingAssignment).where((and as any)(...conditions));
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

router.use(requireAdmin);

/* ----- Admin: create assignment ----- */
router.post('/assignments', validate(CreateAssignmentDto), async (req, res) => {
  const { teacherProfileId, classSectionId, subjectId, academicYearId, termId=null, isLead=true, isHomeroom=false, hoursPerWeek, notes } = req.body;

  try {
    await ensureTeacherProfile(teacherProfileId);
    await ensureTermInYear(termId, academicYearId);

    const [created] = await db.transaction(async tx => {
      await enforceLeadUniqueness(classSectionId, subjectId, termId, !!isLead);
      await enforceHomeroomUniqueness(classSectionId, academicYearId, !!isHomeroom);

      const [row] = await tx.insert(teachingAssignment).values({
        teacherProfileId, classSectionId, subjectId, academicYearId,
        termId, isLead: !!isLead, isHomeroom: !!isHomeroom, hoursPerWeek: hoursPerWeek ?? null, notes: notes ?? null
      }).returning();

      if (!row) {
        throw Object.assign(new Error('Failed to create assignment'), { status: 500 });
      }

      // Audit: assignment created
      const actor = actorFromReq(req);
      await writeAudit(tx, {
        action: 'TEACHING_ASSIGNMENT_CREATE',
        entityType: 'teaching_assignment',
        entityId: row.id,
        summary: `Assigned teacher ${teacherProfileId} to section ${classSectionId} subject ${subjectId} (year ${academicYearId}${termId ? ` term ${termId}` : ''}) lead=${!!isLead} homeroom=${!!isHomeroom}`,
        meta: { payload: req.body, created: row },
        actorUserId: actor.userId ?? null,
        actorRoles: actor.roles ?? null,
        ip: actor.ip ?? null,
        at: new Date(),
      });

      return [row];
    });

    res.status(201).json(created);
  } catch (e: any) {
    const status = e.status ?? 400;
    res.status(status).json({ error: { message: e.message } });
  }
});

/* ----- Admin: update ----- */
router.patch('/assignments/:id', validate(UpdateAssignmentDto), async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: { message: 'id is required' } });
  const [existing] = await db.select().from(teachingAssignment).where(eq(teachingAssignment.id, id));
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

  const [updated] = await db.select().from(teachingAssignment).where(eq(teachingAssignment.id, id));

  // Audit: assignment updated
  const actor = actorFromReq(req);
  await writeAudit(db, {
    action: 'TEACHING_ASSIGNMENT_UPDATE',
    entityType: 'teaching_assignment',
    entityId: id,
    summary: `Updated assignment ${id}`,
    meta: { before: existing, after: updated, changes: req.body },
    actorUserId: actor.userId ?? null,
    actorRoles: actor.roles ?? null,
    ip: actor.ip ?? null,
    at: new Date(),
  });

  res.json(updated);
});

/* ----- Admin: delete ----- */
router.delete('/assignments/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: { message: 'id is required' } });
  const [row] = await db.delete(teachingAssignment).where(eq(teachingAssignment.id, id)).returning();
  if (!row) return res.status(404).json({ error: { message: 'Assignment not found' } });
  res.json({ ok: true });
});

/* ----- Admin: list with filters ----- */
router.get('/assignments', async (req, res) => {
  const { teacherProfileId, classSectionId, subjectId, academicYearId, termId } = req.query as Record<string, string | undefined>;
  const where: any[] = [];
  if (teacherProfileId) where.push(eq(teachingAssignment.teacherProfileId, teacherProfileId));
  if (classSectionId) where.push(eq(teachingAssignment.classSectionId, classSectionId));
  if (subjectId) where.push(eq(teachingAssignment.subjectId, subjectId));
  if (academicYearId) where.push(eq(teachingAssignment.academicYearId, academicYearId));
  if (termId) where.push(eq(teachingAssignment.termId, termId));

  const rows = where.length
    ? await db.select().from(teachingAssignment).where((and as any)(...where))
    : await db.select().from(teachingAssignment);

  res.json(rows);
});

/* ----- Homeroom helpers ----- */
router.post('/class-sections/:id/homeroom', async (req, res) => {
  const sectionId = req.params.id;
  if (!sectionId) return res.status(400).json({ error: { message: 'class section id is required' } });
  const { teacherProfileId, academicYearId, subjectId } = req.body as { teacherProfileId: string; academicYearId: string; subjectId?: string };
  try {
    await ensureTeacherProfile(teacherProfileId);
    await enforceHomeroomUniqueness(sectionId, academicYearId, true);
    
    // If no subjectId provided, use the first available subject
    let finalSubjectId = subjectId;
    if (!finalSubjectId) {
      const [firstSubject] = await db.select().from(subject).limit(1);
      if (!firstSubject) {
        return res.status(400).json({ error: { message: 'No subjects available. Please create a subject first.' } });
      }
      finalSubjectId = firstSubject.id;
    }
    
    const [row] = await db.insert(teachingAssignment).values({
      teacherProfileId, classSectionId: sectionId, subjectId: finalSubjectId,
      academicYearId, termId: null, isLead: true, isHomeroom: true
    }).returning();

    if (!row) {
      return res.status(500).json({ error: { message: 'Failed to set homeroom' } });
    }

    // Audit: set homeroom
    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'TEACHING_SET_HOMEROOM',
      entityType: 'teaching_assignment',
      entityId: row.id,
      summary: `Set homeroom for section ${sectionId} (year ${academicYearId}) teacher ${teacherProfileId}`,
      meta: { assignment: row },
      actorUserId: actor.userId ?? null,
      actorRoles: actor.roles ?? null,
      ip: actor.ip ?? null,
      at: new Date(),
    });

    res.status(201).json(row);
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message } });
  }
});

router.get('/class-sections/:id/homeroom', async (req, res) => {
  const sectionId = req.params.id;
  if (!sectionId) return res.status(400).json({ error: { message: 'class section id is required' } });
  const yearId = req.query.yearId as string | undefined;
  const where = [eq(teachingAssignment.classSectionId, sectionId), eq(teachingAssignment.isHomeroom, true)];
  if (yearId) where.push(eq(teachingAssignment.academicYearId, yearId));
  const rows = await db.select().from(teachingAssignment).where((and as any)(...where));
  res.json(rows);
});

// Get all teachers (profiles with TEACHER role)
router.get('/teachers', async (req, res) => {
  const teachers = await db.select({
    id: profiles.id,
    firstName: profiles.firstName,
    lastName: profiles.lastName,
    phone: profiles.phone,
    userId: profiles.userId
  })
  .from(profiles)
  .innerJoin(userRoles, eq(userRoles.userId, profiles.userId))
  .where(eq(userRoles.role, 'TEACHER'));
  
  res.json(teachers);
});

/* ----- Teacher self-view endpoints ----- */
const teacherRouter = Router();
teacherRouter.use(requireAuth);

// Middleware to ensure user has TEACHER role
teacherRouter.use(async (req, res, next) => {
  const user = (req.session as any).user;
  if (!user || !user.roles.includes('TEACHER')) {
    return res.status(403).json({ error: { message: 'Teacher role required' } });
  }
  next();
});

// Get teacher's own assignments
teacherRouter.get('/my/assignments', async (req, res) => {
  try {
    const user = (req.session as any).user;
    // Get teacher's profile ID
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, user.id));
    if (!profile) {
      return res.status(404).json({ error: { message: 'Teacher profile not found' } });
    }
    
    const assignments = await db.select().from(teachingAssignment)
      .where(eq(teachingAssignment.teacherProfileId, profile.id));
    
    res.json(assignments);
  } catch (e: any) {
    res.status(400).json({ error: { message: e.message } });
  }
});

// Mount teacher routes
router.use('/teacher', teacherRouter);

export default router;
