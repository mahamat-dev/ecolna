import { Router } from 'express';
import { db } from '../../db/client';
import { validate } from '../../middlewares/validate';
import { requireAdmin } from '../../middlewares/rbac';
import { CreateSessionDto, FinalizeSessionDto, BulkMarkDto } from './dto';
import { and, between, desc, eq, gte, lte } from 'drizzle-orm';
import { attendanceRecord, attendanceSession } from '../../db/schema/attendance';
import { enrollment as enrollmentTbl } from '../../db/schema/enrollment';

const router = Router();
router.use(requireAdmin);

function parseDate(s: string) { return new Date(s + 'T00:00:00Z'); }

async function ensureActiveEnrollmentForSection(enrollmentId: string, sectionId: string, date: Date) {
  const [enr] = await db.select().from(enrollmentTbl).where(eq(enrollmentTbl.id, enrollmentId));
  if (!enr) throw Object.assign(new Error('Enrollment not found'), { status: 400 });
  if (enr.classSectionId !== sectionId) throw Object.assign(new Error('Enrollment does not belong to this class section'), { status: 400 });
  if (enr.joinedOn && parseDate(enr.joinedOn) > date) throw Object.assign(new Error('Enrollment not active yet on session date'), { status: 400 });
  if (enr.exitedOn && parseDate(enr.exitedOn) < date) throw Object.assign(new Error('Enrollment inactive on session date'), { status: 400 });
}

router.post('/sessions', validate(CreateSessionDto), async (req, res) => {
  const body = req.body;
  const date = parseDate(body.date);
  try {
    const [row] = await db.insert(attendanceSession).values({
      classSectionId: body.classSectionId,
      subjectId: body.subjectId ?? null,
      academicYearId: body.academicYearId,
      termId: body.termId ?? null,
      date: body.date as any,
      startsAt: body.startsAt as any,
      endsAt: body.endsAt as any,
      takenByProfileId: body.takenByProfileId ?? null,
      notes: body.notes ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (e: any) {
    res.status(e.status ?? 400).json({ error: { message: e.message } });
  }
});

router.patch('/sessions/:id/finalize', validate(FinalizeSessionDto), async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: { message: 'id is required' } });
  const [existing] = await db.select().from(attendanceSession).where(eq(attendanceSession.id, id));
  if (!existing) return res.status(404).json({ error: { message: 'Session not found' } });
  await db.update(attendanceSession).set({ isFinalized: true }).where(eq(attendanceSession.id, id));
  res.json({ ok: true });
});

router.post('/sessions/:id/bulk-mark', validate(BulkMarkDto), async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: { message: 'id is required' } });
  const [session] = await db.select().from(attendanceSession).where(eq(attendanceSession.id, id));
  if (!session) return res.status(404).json({ error: { message: 'Session not found' } });
  if (session.isFinalized) return res.status(400).json({ error: { message: 'Session is finalized' } });
  const date = parseDate(session.date as unknown as string);

  await db.transaction(async (tx) => {
    for (const r of req.body.records) {
      await ensureActiveEnrollmentForSection(r.enrollmentId, session.classSectionId, date);
      await tx
        .insert(attendanceRecord)
        .values({
          sessionId: id,
          enrollmentId: r.enrollmentId,
          status: r.status as any,
          minutesLate: r.minutesLate ?? 0,
          comment: r.comment ?? null,
        })
        .onConflictDoUpdate({
          target: [attendanceRecord.sessionId, attendanceRecord.enrollmentId],
          set: {
            status: r.status as any,
            minutesLate: r.minutesLate ?? 0,
            comment: r.comment ?? null,
          },
        });
    }
  });

  res.json({ ok: true });
});

router.get('/sessions', async (req, res) => {
  const { classSectionId, subjectId, academicYearId, termId, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
  const wh: any[] = [];
  if (classSectionId) wh.push(eq(attendanceSession.classSectionId, classSectionId));
  if (subjectId) wh.push(eq(attendanceSession.subjectId, subjectId));
  if (academicYearId) wh.push(eq(attendanceSession.academicYearId, academicYearId));
  if (termId) wh.push(eq(attendanceSession.termId, termId));
  if (dateFrom && dateTo) wh.push(between(attendanceSession.date, dateFrom as any, dateTo as any));
  else if (dateFrom) wh.push(gte(attendanceSession.date, dateFrom as any));
  else if (dateTo) wh.push(lte(attendanceSession.date, dateTo as any));

  const rows = wh.length
    ? await db.select().from(attendanceSession).where((and as any)(...wh)).orderBy(desc(attendanceSession.date))
    : await db.select().from(attendanceSession).orderBy(desc(attendanceSession.date));
  res.json(rows);
});

router.get('/sessions/:id/records', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: { message: 'id is required' } });
  const rows = await db.select().from(attendanceRecord).where(eq(attendanceRecord.sessionId, id));
  res.json(rows);
});

export default router;