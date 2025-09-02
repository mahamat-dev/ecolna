import express from 'express';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  question, questionTranslation, questionOption, questionOptionTranslation,
  quiz, quizTranslation, quizQuestion, quizAudience,
  quizAttempt, attemptQuestion, attemptAnswer, profiles, userRoles,
} from '../../db/schema';
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { validate } from '../../middlewares/validate';
import { requireAuth, requireStaffOrAdmin } from '../../middlewares/rbac';
import { writeAudit, actorFromReq } from '../admin-utils/audit.service';
import {
  UpsertQuestionDto, CreateQuizDto, UpdateQuizDto, PublishDto, StartAttemptDto, SubmitAnswersDto, ListAvailableQuery,
} from './dto';
import { enrollment } from '../../db/schema';
import { classSection, classSectionSubject } from '../../db/schema';

const router = express.Router();

async function viewerFromReq(req: any) {
  const userId: string | undefined = req.session?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  if (!profile) throw new Error('Profile not found');
  const rolesRows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  const roles = rolesRows.map(r => r.role as string);
  return { userId, profileId: profile.id, roles };
}

function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const ai = a[i]!;
    const aj = a[j]!;
    a[i] = aj;
    a[j] = ai;
  }
  return a;
}

async function isQuizOpen(q: typeof quiz.$inferSelect, now = new Date()) {
  if (q.status !== 'PUBLISHED') return false;
  if (q.openAt && now < q.openAt) return false;
  if (q.closeAt && now > q.closeAt) return false;
  return true;
}

async function attemptsRemaining(quizId: string, studentProfileId: string, maxAttempts: number) {
  const rows = await db.select().from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, quizId), eq(quizAttempt.studentProfileId, studentProfileId)));
  const used = rows.filter(r => r.status === 'SUBMITTED' || r.status === 'GRADED').length;
  return Math.max(0, (maxAttempts ?? 1) - used);
}

async function studentMatchesQuiz(studentProfileId: string, quizId: string) {
  const aud = await db.select().from(quizAudience).where(eq(quizAudience.quizId, quizId));
  if (!aud.length) return false;
  if (aud.some(a => a.scope === 'ALL')) return true;

  const enr = await db.select({
    sectionId: enrollment.classSectionId,
  }).from(enrollment).where(eq(enrollment.studentProfileId, studentProfileId));

  const sectionIds = new Set(enr.map(e => e.sectionId).filter(Boolean) as string[]);
  if (!sectionIds.size) return false;

  // Resolve grade levels via classSection
  const sections = await db.select({ id: classSection.id, gradeLevelId: classSection.gradeLevelId })
    .from(classSection).where(inArray(classSection.id, [...sectionIds] as any));
  const gradeIds = new Set(sections.map(s => s.gradeLevelId).filter(Boolean) as string[]);

  // SUBJECT audience matches if student's sections include that subject
  const subjAud = aud.filter(a => a.scope === 'SUBJECT' && a.subjectId);
  if (subjAud.length) {
    const links = await db.select().from(classSectionSubject)
      .where(inArray(classSectionSubject.classSectionId, [...sectionIds] as any));
    if (links.some(l => subjAud.some(a => a.subjectId === l.subjectId))) return true;
  }

  if (aud.some(a => a.scope === 'GRADE_LEVEL' && a.gradeLevelId && gradeIds.has(a.gradeLevelId))) return true;
  if (aud.some(a => a.scope === 'CLASS_SECTION' && a.classSectionId && sectionIds.has(a.classSectionId))) return true;

  return false;
}

// Question bank
router.post('/questions', requireAuth, requireStaffOrAdmin, validate(UpsertQuestionDto), async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const body = req.body as z.infer<typeof UpsertQuestionDto>;
    const rows = await db.insert(question).values({
      type: body.type as any,
      subjectId: body.subjectId ?? null,
      createdByProfileId: viewer.profileId,
    }).returning();

    const q = rows[0];
    if (!q) return res.status(500).json({ error: 'Failed to create question' });

    if (body.translations?.length) {
      await db.insert(questionTranslation).values(body.translations.map(t => ({ questionId: q.id, ...t })));
    }
    for (const opt of body.options) {
      const orows = await db.insert(questionOption).values({
        questionId: q.id,
        isCorrect: opt.isCorrect,
        weight: String(opt.weight),
        orderIndex: opt.orderIndex,
      }).returning();
      const o = orows[0];
      if (o) {
        await db.insert(questionOptionTranslation).values(opt.translations.map(tr => ({ optionId: o.id, ...tr })));
      }
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_QUESTION_CREATE', entityType: 'QUESTION', entityId: q.id, summary: 'Question created',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ id: q.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// List questions (optional filters: subjectId, createdByProfileId)
router.get('/questions', requireAuth, async (req, res) => {
  try {
    const subjectId = req.query.subjectId as string | undefined;
    const createdByProfileId = req.query.createdByProfileId as string | undefined;

    const filters: any[] = [];
    if (subjectId) filters.push(eq(question.subjectId, subjectId as any));
    if (createdByProfileId) filters.push(eq(question.createdByProfileId, createdByProfileId as any));

    let rows: any[] = [];
    if (filters.length) {
      rows = await db.select().from(question).where(and(...filters as any)).limit(200);
    } else {
      rows = await db.select().from(question).limit(200);
    }

    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Update question (replace translations and options)
router.patch('/questions/:id', requireAuth, requireStaffOrAdmin, validate(UpsertQuestionDto), async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = req.body as z.infer<typeof UpsertQuestionDto>;

    const [existing] = await db.select().from(question).where(eq(question.id, id));
    if (!existing) return res.status(404).json({ error: 'Question not found' });

    await db.transaction(async (tx) => {
      // Update base question fields
      await tx.update(question).set({
        type: body.type as any,
        subjectId: body.subjectId ?? null,
        updatedAt: new Date(),
      }).where(eq(question.id, id));

      // Replace translations
      await tx.delete(questionTranslation).where(eq(questionTranslation.questionId, id));
      if (body.translations?.length) {
        await tx.insert(questionTranslation).values(body.translations.map(t => ({ questionId: id, ...t })));
      }

      // Replace options and their translations
      const existingOpts = await tx.select().from(questionOption).where(eq(questionOption.questionId, id));
      if (existingOpts.length) {
        const optIds = existingOpts.map(o => o.id);
        await tx.delete(questionOptionTranslation).where(inArray(questionOptionTranslation.optionId, optIds));
        await tx.delete(questionOption).where(eq(questionOption.questionId, id));
      }
      for (const opt of body.options) {
        const [o] = await tx.insert(questionOption).values({
          questionId: id,
          isCorrect: opt.isCorrect,
          weight: String(opt.weight),
          orderIndex: opt.orderIndex,
        }).returning();
        if (o) {
          await tx.insert(questionOptionTranslation).values(opt.translations.map(tr => ({ optionId: o.id, ...tr })));
        }
      }
    });

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_QUESTION_UPDATE', entityType: 'QUESTION', entityId: id, summary: 'Question updated',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Create quiz
router.post('/quizzes', requireAuth, requireStaffOrAdmin, validate(CreateQuizDto), async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const body = req.body as z.infer<typeof CreateQuizDto>;
    const rows = await db.insert(quiz).values({
      createdByProfileId: viewer.profileId,
      subjectId: body.subjectId ?? null,
      timeLimitSec: body.timeLimitSec ?? null,
      maxAttempts: body.maxAttempts,
      shuffleQuestions: body.shuffleQuestions,
      shuffleOptions: body.shuffleOptions,
      openAt: body.openAt ?? null,
      closeAt: body.closeAt ?? null,
    }).returning();

    const qz = rows[0];
    if (!qz) return res.status(500).json({ error: 'Failed to create quiz' });

    if (body.translations?.length) {
      await db.insert(quizTranslation).values(body.translations.map(t => ({ quizId: qz.id, ...t })));
    }
    if (body.audience?.length) {
      await db.insert(quizAudience).values(body.audience.map(a => ({ quizId: qz.id, ...a as any })));
    }
    if (body.questions?.length) {
      await db.insert(quizQuestion).values(body.questions.map(qq => ({ quizId: qz.id, ...qq, points: String(qq.points) })));
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_QUIZ_CREATE', entityType: 'QUIZ', entityId: qz.id, summary: 'Quiz created',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ id: qz.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Update quiz
router.patch('/quizzes/:id', requireAuth, requireStaffOrAdmin, validate(UpdateQuizDto), async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = req.body as z.infer<typeof UpdateQuizDto>;
    const [existing] = await db.select().from(quiz).where(eq(quiz.id, id));
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });

    await db.transaction(async (tx) => {
      if (body.translations) {
        await tx.delete(quizTranslation).where(eq(quizTranslation.quizId, id));
        if (body.translations.length) {
          await tx.insert(quizTranslation).values(body.translations.map(t => ({ quizId: id, ...t })));
        }
      }
      if (body.audience) {
        await tx.delete(quizAudience).where(eq(quizAudience.quizId, id));
        if (body.audience.length) {
          await tx.insert(quizAudience).values(body.audience.map(a => ({ quizId: id, ...a as any })));
        }
      }
      if (body.questions) {
        await tx.delete(quizQuestion).where(eq(quizQuestion.quizId, id));
        if (body.questions.length) {
          await tx.insert(quizQuestion).values(body.questions.map(qq => ({ quizId: id, ...qq, points: String(qq.points) })));
        }
      }
      const fields: any = {};
      for (const k of ['subjectId','timeLimitSec','maxAttempts','shuffleQuestions','shuffleOptions','openAt','closeAt'] as const) {
        if (k in body) (fields as any)[k] = (body as any)[k] ?? null;
      }
      if (Object.keys(fields).length) {
        await tx.update(quiz).set({ ...fields, updatedAt: new Date() }).where(eq(quiz.id, id));
      }
    });

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_QUIZ_UPDATE', entityType: 'QUIZ', entityId: id, summary: 'Quiz updated',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Publish or unpublish
router.post('/quizzes/:id/publish', requireAuth, requireStaffOrAdmin, validate(PublishDto), async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { publish } = req.body as z.infer<typeof PublishDto>;
    const [existing] = await db.select().from(quiz).where(eq(quiz.id, id));
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });
    const status = publish ? 'PUBLISHED' : 'DRAFT';
    await db.update(quiz).set({ status: status as any, updatedAt: new Date() }).where(eq(quiz.id, id));

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: publish ? 'ASSESS_QUIZ_PUBLISH' : 'ASSESS_QUIZ_UNPUBLISH',
      entityType: 'QUIZ', entityId: id, summary: publish ? 'Quiz published' : 'Quiz unpublished',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// List available quizzes for students (with audience + window + attempts)
router.get('/quizzes/available', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const parsed = ListAvailableQuery.safeParse(req.query);
    const nowDate = parsed.success && parsed.data.now ? parsed.data.now : (req.query.now ? new Date(String(req.query.now)) : new Date());

    const rows = await db.select().from(quiz)
      .where(eq(quiz.status, 'PUBLISHED' as any))
      .orderBy(desc(quiz.createdAt))
      .limit(100);

    const filtered: Array<{ id: string; openAt: Date | null; closeAt: Date | null } & typeof rows[number]> = [] as any;
    for (const qz of rows) {
      if (!(await isQuizOpen(qz as any, nowDate))) continue;
      const audOk = await studentMatchesQuiz(viewer.profileId, qz.id);
      if (!audOk) continue;
      const rem = await attemptsRemaining(qz.id, viewer.profileId, qz.maxAttempts ?? 1);
      if (rem <= 0) continue;
      filtered.push(qz as any);
      if (filtered.length >= 50) break;
    }

    res.json(filtered.map(q => ({ id: q.id, openAt: q.openAt, closeAt: q.closeAt })));
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Start attempt
router.post('/attempts/start', requireAuth, validate(StartAttemptDto), async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const { quizId } = req.body as z.infer<typeof StartAttemptDto>;
    const [qz] = await db.select().from(quiz).where(eq(quiz.id, quizId));
    if (!qz) return res.status(404).json({ error: 'Quiz not found' });
    if (!(await isQuizOpen(qz as any))) return res.status(400).json({ error: 'Quiz not open' });
    const audOk = await studentMatchesQuiz(viewer.profileId, quizId);
    if (!audOk) return res.status(403).json({ error: 'Not in audience' });

    // Check attempts remaining
    const rem = await attemptsRemaining(quizId, viewer.profileId, qz.maxAttempts ?? 1);
    if (rem <= 0) return res.status(400).json({ error: 'Max attempts reached' });

    const seed = Math.floor(Math.random() * 2 ** 31);
    const rnd = mulberry32(seed);
    const aRows = await db.insert(quizAttempt).values({
      quizId,
      studentProfileId: viewer.profileId,
      status: 'IN_PROGRESS' as any,
      startedAt: new Date(),
      timeLimitSec: qz.timeLimitSec ?? null,
      seed,
      ip: (req as any).ip,
      userAgent: req.get('user-agent') ?? null,
    }).returning();

    const attempt = aRows[0];
    if (!attempt) return res.status(500).json({ error: 'Failed to create attempt' });

    // Build sealed question and option order
    let qs = await db.select().from(quizQuestion).where(eq(quizQuestion.quizId, quizId));
    qs = (qz.shuffleQuestions ? shuffle(qs, rnd) : qs.sort((a, b) => a.orderIndex - b.orderIndex));

    for (let i = 0; i < qs.length; i++) {
      const qq = qs[i];
      if (!qq) continue;
      const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, qq.questionId as string));
      const ordered = (qz.shuffleOptions ? shuffle(opts, rnd) : opts.sort((a, b) => a.orderIndex - b.orderIndex)).map(o => o.id);
      await db.insert(attemptQuestion).values({ attemptId: attempt.id, questionId: qq.questionId as string, orderIndex: i, points: qq.points, optionOrder: ordered as any });
    }

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_ATTEMPT_START', entityType: 'QUIZ_ATTEMPT', entityId: attempt.id, summary: 'Attempt started',
      meta: { quizId }, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ attemptId: attempt.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Submit answers for a running attempt
router.post('/attempts/:id/answers', requireAuth, validate(SubmitAnswersDto), async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const attemptId = z.string().uuid().parse(req.params.id);
    const body = req.body as z.infer<typeof SubmitAnswersDto>;

    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== viewer.profileId || att.status !== 'IN_PROGRESS') return res.status(400).json({ error: 'Invalid attempt' });

    await db.transaction(async (tx) => {
      for (const ans of body.answers) {
        const optRes: any = await tx.execute(sql`SELECT id, is_correct FROM question_option WHERE question_id = ${ans.questionId}`);
        const optRows = optRes?.rows ?? optRes;
        const selectedIds = ans.selectedOptionIds ?? [];
        // Basic immediate correctness flag for MCQ_SINGLE/TRUE_FALSE exact match; MCQ_MULTI graded on finish
        const corrIds = new Set((optRows as any[]).filter((o: any) => o.is_correct).map((o: any) => o.id));
        const selSet = new Set(selectedIds);
        const isCorrect = corrIds.size === selSet.size && [...selSet].every(id => corrIds.has(id));
        await tx
          .insert(attemptAnswer)
          .values({ attemptId, questionId: ans.questionId, selectedOptionIds: selectedIds as any, isCorrect, score: null as any })
          .onConflictDoUpdate({
            target: [attemptAnswer.attemptId, attemptAnswer.questionId],
            set: { selectedOptionIds: selectedIds as any, isCorrect },
          });
      }
    });

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_ATTEMPT_ANSWER', entityType: 'QUIZ_ATTEMPT', entityId: attemptId, summary: 'Attempt answers submitted',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Finish attempt and grade
router.post('/attempts/:id/finish', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const attemptId = z.string().uuid().parse(req.params.id);
    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== viewer.profileId) return res.status(400).json({ error: 'Invalid attempt' });

    // Grade attempt according to question types and weights
    const aqRows = await db.select().from(attemptQuestion).where(eq(attemptQuestion.attemptId, attemptId));
    let totalScore = 0; let maxScore = 0;
    for (const row of aqRows) {
      maxScore += Number(row.points ?? 1);
      const [ans] = await db.select().from(attemptAnswer)
        .where(and(eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId as string)));
      const [q] = await db.select().from(question).where(eq(question.id, row.questionId as string));
      if (!q) continue;
      const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, row.questionId as string));

      let score = 0; let correct = false;
      const correctIds = new Set(opts.filter(o => o.isCorrect).map(o => o.id));
      const sel = new Set((ans?.selectedOptionIds as any[] ?? []) as string[]);

      if (q.type === 'TRUE_FALSE' || q.type === 'MCQ_SINGLE') {
        correct = sel.size === 1 && correctIds.has([...sel][0]!);
        score = correct ? Number(row.points ?? 1) : 0;
      } else if (q.type === 'MCQ_MULTI') {
        const wrongSelected = [...sel].some(id => !correctIds.has(id));
        if (!wrongSelected) {
          const weights = opts.filter(o => o.isCorrect && sel.has(o.id)).reduce((sum, o) => sum + Number(o.weight ?? 1), 0);
          const maxWeights = opts.filter(o => o.isCorrect).reduce((sum, o) => sum + Number(o.weight ?? 1), 0) || 1;
          score = Number(row.points ?? 1) * (weights / maxWeights);
          correct = weights === maxWeights;
        } else {
          score = 0; correct = false;
        }
      }

      if (ans) {
        await db.update(attemptAnswer).set({ isCorrect: correct, score: String(score) }).where(and(
          eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId as string)
        ));
      } else {
        await db.insert(attemptAnswer).values({
          attemptId, questionId: row.questionId as string, selectedOptionIds: JSON.stringify([]) as any, isCorrect: false, score: '0' as any,
        });
      }

      totalScore += score;
    }

    await db.update(quizAttempt).set({ status: 'GRADED' as any, submittedAt: new Date(), score: String(totalScore), maxScore: String(maxScore) }).where(eq(quizAttempt.id, attemptId));

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_ATTEMPT_FINISH', entityType: 'QUIZ_ATTEMPT', entityId: attemptId, summary: 'Attempt submitted',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ score: totalScore, maxScore });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Teacher: list submissions for a quiz
router.get('/teacher/quizzes/:id/submissions', requireAuth, requireStaffOrAdmin, async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(quizAttempt).where(eq(quizAttempt.quizId, id));
    res.json(rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Submit attempt (alias of finish)
router.post('/attempts/:id/submit', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const attemptId = z.string().uuid().parse(req.params.id);
    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== viewer.profileId) return res.status(400).json({ error: 'Invalid attempt' });

    // Grade attempt according to question types and weights
    const aqRows = await db.select().from(attemptQuestion).where(eq(attemptQuestion.attemptId, attemptId));
    let totalScore = 0; let maxScore = 0;
    for (const row of aqRows) {
      maxScore += Number(row.points ?? 1);
      const [ans] = await db.select().from(attemptAnswer)
        .where(and(eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId as string)));
      const [q] = await db.select().from(question).where(eq(question.id, row.questionId as string));
      if (!q) continue;
      const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, row.questionId as string));

      let score = 0; let correct = false;
      const correctIds = new Set(opts.filter(o => o.isCorrect).map(o => o.id));
      const sel = new Set((ans?.selectedOptionIds as any[] ?? []) as string[]);

      if (q.type === 'TRUE_FALSE' || q.type === 'MCQ_SINGLE') {
        correct = sel.size === 1 && correctIds.has([...sel][0]!);
        score = correct ? Number(row.points ?? 1) : 0;
      } else if (q.type === 'MCQ_MULTI') {
        const wrongSelected = [...sel].some(id => !correctIds.has(id));
        if (!wrongSelected) {
          const weights = opts.filter(o => o.isCorrect && sel.has(o.id)).reduce((sum, o) => sum + Number(o.weight ?? 1), 0);
          const maxWeights = opts.filter(o => o.isCorrect).reduce((sum, o) => sum + Number(o.weight ?? 1), 0) || 1;
          score = Number(row.points ?? 1) * (weights / maxWeights);
          correct = weights === maxWeights;
        } else {
          score = 0; correct = false;
        }
      }

      if (ans) {
        await db.update(attemptAnswer).set({ isCorrect: correct, score: String(score) }).where(and(
          eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId as string)
        ));
      } else {
        await db.insert(attemptAnswer).values({
          attemptId, questionId: row.questionId as string, selectedOptionIds: JSON.stringify([]) as any, isCorrect: false, score: '0' as any,
        });
      }

      totalScore += score;
    }

    await db.update(quizAttempt).set({ status: 'GRADED' as any, submittedAt: new Date(), score: String(totalScore), maxScore: String(maxScore) }).where(eq(quizAttempt.id, attemptId));

    const actor = actorFromReq(req);
    await writeAudit(db, {
      action: 'ASSESS_ATTEMPT_FINISH', entityType: 'QUIZ_ATTEMPT', entityId: attemptId, summary: 'Attempt submitted',
      actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip
    });
    res.json({ score: totalScore, maxScore });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

// Get attempt content for player
router.get('/attempts/:id', requireAuth, async (req, res) => {
  try {
    const viewer = await viewerFromReq(req);
    const attemptId = z.string().uuid().parse(req.params.id);
    const locale = (typeof req.query.locale === 'string' ? req.query.locale : undefined) ?? 'fr';

    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== viewer.profileId) return res.status(404).json({ error: 'Attempt not found' });

    const aqRows = await db.select().from(attemptQuestion).where(eq(attemptQuestion.attemptId, attemptId)).orderBy(attemptQuestion.orderIndex);

    // Preload answers map
    const ansRows = await db.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, attemptId));
    const answers: Record<string, string[]> = {};
    for (const a of ansRows) {
      answers[a.questionId as string] = (a.selectedOptionIds as unknown as string[]) ?? [];
    }

    const questions = [] as Array<{
      questionId: string;
      type: string;
      prompt: string;
      points: number;
      options: Array<{ id: string; text: string }>;
    }>;

    for (const row of aqRows) {
      const qId = row.questionId as string;
      const [q] = await db.select().from(question).where(eq(question.id, qId));
      if (!q) continue;
      const [tr] = await db.select().from(questionTranslation).where(and(eq(questionTranslation.questionId, qId), eq(questionTranslation.locale, locale as any)));
      const prompt = (tr?.stemMd as string) ?? '';

      // Resolve option order
      const orderIds = ((row.optionOrder as unknown as string[]) ?? []).filter(Boolean);
      let opts = [] as Array<{ id: string; text: string }>;
      if (orderIds.length) {
        const raw = await db.select().from(questionOption).where(inArray(questionOption.id, orderIds as any));
        // map translations
        const texts = new Map<string, string>();
        for (const o of raw) {
          const [otr] = await db.select().from(questionOptionTranslation).where(and(eq(questionOptionTranslation.optionId, o.id), eq(questionOptionTranslation.locale, locale as any)));
          texts.set(o.id, (otr?.text as string) ?? '');
        }
        // keep order
        opts = orderIds.map(id => ({ id, text: texts.get(id) ?? '' }));
      } else {
        // fallback by DB order if no sealed order stored
        const raw = await db.select().from(questionOption).where(eq(questionOption.questionId, qId));
        opts = await Promise.all(raw.sort((a,b)=> (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(async (o) => {
          const [otr] = await db.select().from(questionOptionTranslation).where(and(eq(questionOptionTranslation.optionId, o.id), eq(questionOptionTranslation.locale, locale as any)));
          return { id: o.id, text: (otr?.text as string) ?? '' };
        }));
      }

      questions.push({
        questionId: qId,
        type: q.type as any,
        prompt,
        points: Number(row.points ?? 1),
        options: opts,
      });
    }

    res.json({
      attemptId: att.id,
      status: att.status,
      timeLimitSec: att.timeLimitSec,
      startedAt: att.startedAt,
      questions,
      answers,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? 'Bad request' });
  }
});

export default router;