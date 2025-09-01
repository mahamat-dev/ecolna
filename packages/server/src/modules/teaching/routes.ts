import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin, requireAuth } from '../../middlewares/rbac';
import { userRoles, profiles } from '../../db/schema/identity';
import { term, academicYear, classSection, subject } from '../../db/schema/academics';
import { teachingAssignment } from '../../db/schema/teaching';
import { CreateAssignmentDto, UpdateAssignmentDto } from './dto';
import { and, eq, isNull } from 'drizzle-orm';

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
    res.status(500).json({ error: { message: e.message } });
  }
});

// Mount teacher routes
router.use('/teacher', teacherRouter);

export default router;