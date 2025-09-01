# CLAUDE.module-8-assessments-mcq.md
**Module 8 — Assessments (MCQ / Quizzes & Exams)**  
_Server: Express **5**, TypeScript, Drizzle ORM, Postgres, Bun • i18n-ready (fr default, ar, en)_

Create/manage a **question bank** (MCQ single/multiple, True/False), build **quizzes/exams** mapped to **subjects & class sections**, schedule **windows** with **time limits**, let **students** attempt within their audience, and **auto-grade** submissions. Includes multilingual stems/options, shuffling, attempts limit, and results for teachers/admin.

> This file is complete: schema, DTOs, services, routes, RBAC, scoring, i18n notes, OpenAPI, tests, and DoD.  
> It relies on prior modules: **M1** (users/profiles/roles), **M2** (grade_level, class_section, subject), **M3** (enrollment), **M4** (teaching_assignment), **M6** (audit_log).

---

## 0) Scope

### Roles
- **ADMIN/STAFF**: manage everything.
- **TEACHER**: manage questions/quizzes for **their subjects/sections** (per Module 4).
- **STUDENT**: see available quizzes in audience & window; attempt and view results of own attempts.
- **GUARDIAN**: (optional future) view results of linked students.

### Features (MVP)
- Question bank with multilingual **stem/explanation**, **options** (text only).
- Question types: **MCQ_SINGLE**, **MCQ_MULTI**, **TRUE_FALSE**.
- Quizzes with **open/close window**, **time limit**, **shuffle** questions/options, **maxAttempts**.
- Audience targeting: **GRADE_LEVEL**, **CLASS_SECTION**, **SUBJECT**, **ALL**.
- Attempts: server-side **order sealing** (per attempt), **auto-grading**, score out of max.
- Teacher dashboards: list attempts, export CSV (server stub).

---

## 1) DB Schema (Drizzle + SQL)

### 1.1 Enums
```ts
// src/db/schema/assess.enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const questionType = pgEnum("question_type", ["MCQ_SINGLE","MCQ_MULTI","TRUE_FALSE"]);
export const quizStatus = pgEnum("quiz_status", ["DRAFT","PUBLISHED","CLOSED"]);
export const attemptStatus = pgEnum("attempt_status", ["CREATED","IN_PROGRESS","SUBMITTED","GRADED"]);
export const quizAudienceScope = pgEnum("quiz_audience_scope", ["ALL","GRADE_LEVEL","CLASS_SECTION","SUBJECT"]);
1.2 Tables
ts
Copier le code
// src/db/schema/assess.ts
import {
  pgTable, uuid, text, timestamp, boolean, integer, numeric, varchar, jsonb
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./identity";
import { classSection, gradeLevel, subject } from "./academics";
import { questionType, quizStatus, attemptStatus, quizAudienceScope } from "./assess.enums";

/** Question bank */
export const question = pgTable("question", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: questionType("type").notNull(),
  subjectId: uuid("subject_id").references(() => subject.id, { onDelete: "set null" }), // optional
  createdByProfileId: uuid("created_by_profile_id").notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const questionTranslation = pgTable("question_translation", {
  questionId: uuid("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 8 }).notNull(), // fr | en | ar
  stemMd: text("stem_md").notNull(),            // problem statement
  explanationMd: text("explanation_md"),       // shown after submit
}, (t) => ({ pk: { primaryKey: [t.questionId, t.locale] } }));

export const questionOption = pgTable("question_option", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  questionId: uuid("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
  // correctness stored here; weight for partial credit on MCQ_MULTI
  isCorrect: boolean("is_correct").notNull().default(false),
  weight: numeric("weight", { precision: 6, scale: 3 }).default("1"), // used for MCQ_MULTI partial scoring
  orderIndex: integer("order_index").notNull().default(0),
});

export const questionOptionTranslation = pgTable("question_option_translation", {
  optionId: uuid("option_id").notNull().references(() => questionOption.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 8 }).notNull(),
  text: text("text").notNull(),
}, (t) => ({ pk: { primaryKey: [t.optionId, t.locale] } }));

/** Quiz */
export const quiz = pgTable("quiz", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdByProfileId: uuid("created_by_profile_id").notNull()
    .references(() => profiles.id, { onDelete: "restrict" }),
  subjectId: uuid("subject_id").references(() => subject.id, { onDelete: "set null" }),
  status: quizStatus("status").notNull().default("DRAFT"),
  timeLimitSec: integer("time_limit_sec"), // optional (null = no limit)
  maxAttempts: integer("max_attempts").notNull().default(1),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(true),
  shuffleOptions: boolean("shuffle_options").notNull().default(true),
  openAt: timestamp("open_at", { withTimezone: true }),  // null = not open yet unless PUBLISHED?
  closeAt: timestamp("close_at", { withTimezone: true }), // null = no close
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const quizTranslation = pgTable("quiz_translation", {
  quizId: uuid("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
  locale: varchar("locale", { length: 8 }).notNull(),
  title: text("title").notNull(),
  descriptionMd: text("description_md"),
}, (t) => ({ pk: { primaryKey: [t.quizId, t.locale] } }));

export const quizQuestion = pgTable("quiz_question", {
  quizId: uuid("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => question.id, { onDelete: "restrict" }),
  points: numeric("points", { precision: 6, scale: 2 }).notNull().default("1"),
  orderIndex: integer("order_index").notNull().default(0),
}, (t) => ({ pk: { primaryKey: [t.quizId, t.questionId] } }));

export const quizAudience = pgTable("quiz_audience", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
  scope: quizAudienceScope("scope").notNull(),
  gradeLevelId: uuid("grade_level_id").references(() => gradeLevel.id, { onDelete: "set null" }),
  classSectionId: uuid("class_section_id").references(() => classSection.id, { onDelete: "set null" }),
  subjectId: uuid("subject_id").references(() => subject.id, { onDelete: "set null" }),
});

/** Attempts */
export const quizAttempt = pgTable("quiz_attempt", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid("quiz_id").notNull().references(() => quiz.id, { onDelete: "cascade" }),
  studentProfileId: uuid("student_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: attemptStatus("status").notNull().default("CREATED"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  score: numeric("score", { precision: 8, scale: 2 }),
  maxScore: numeric("max_score", { precision: 8, scale: 2 }),
  timeLimitSec: integer("time_limit_sec"), // snapshot from quiz at start
  seed: integer("seed"), // RNG seed used to fix order for this attempt
  ip: varchar("ip", { length: 64 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** The sealed order of questions/options for an attempt */
export const attemptQuestion = pgTable("attempt_question", {
  attemptId: uuid("attempt_id").notNull().references(() => quizAttempt.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => question.id, { onDelete: "restrict" }),
  orderIndex: integer("order_index").notNull(),
  optionOrder: jsonb("option_order"), // array of option UUIDs in presented order
  points: numeric("points", { precision: 6, scale: 2 }).notNull().default("1"),
}, (t) => ({ pk: { primaryKey: [t.attemptId, t.questionId] } }));

export const attemptAnswer = pgTable("attempt_answer", {
  attemptId: uuid("attempt_id").notNull().references(() => quizAttempt.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull().references(() => question.id, { onDelete: "cascade" }),
  selectedOptionIds: jsonb("selected_option_ids").notNull().default(sql`'[]'::jsonb`), // array of UUIDs
  isCorrect: boolean("is_correct"),
  score: numeric("score", { precision: 6, scale: 2 }),
  answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({ pk: { primaryKey: [t.attemptId, t.questionId] } }));
1.3 Index suggestions (SQL)
sql
Copier le code
CREATE INDEX IF NOT EXISTS idx_question_subject ON question(subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_status_window ON quiz(status, open_at, close_at);
CREATE INDEX IF NOT EXISTS idx_quiz_audience_quiz ON quiz_audience(quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempt_student ON quiz_attempt(student_profile_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_attempt_status ON quiz_attempt(status);
2) DTOs (Zod)
ts
Copier le code
// src/modules/assessments/dto.ts
import { z } from "zod";

export const Locale = z.enum(["fr","en","ar"]);
export const QuestionType = z.enum(["MCQ_SINGLE","MCQ_MULTI","TRUE_FALSE"]);

export const UpsertQuestionDto = z.object({
  type: QuestionType,
  subjectId: z.string().uuid().nullable().optional(),
  translations: z.array(z.object({
    locale: Locale, stemMd: z.string().min(1), explanationMd: z.string().optional().nullable(),
  })).min(1),
  options: z.array(z.object({
    // ID optional for update
    id: z.string().uuid().optional(),
    isCorrect: z.boolean().default(false),
    weight: z.number().min(0).max(1).default(1),
    orderIndex: z.number().int().min(0).default(0),
    translations: z.array(z.object({ locale: Locale, text: z.string().min(1) })).min(1),
  })).min(2)
    .refine((arr) => arr.some(o => o.isCorrect), "At least one correct option required"),
});

export const CreateQuizDto = z.object({
  subjectId: z.string().uuid().nullable().optional(),
  translations: z.array(z.object({ locale: Locale, title: z.string().min(1), descriptionMd: z.string().optional().nullable() })).min(1),
  timeLimitSec: z.number().int().positive().optional().nullable(),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  openAt: z.coerce.date().optional().nullable(),
  closeAt: z.coerce.date().optional().nullable(),
  audience: z.array(z.object({
    scope: z.enum(["ALL","GRADE_LEVEL","CLASS_SECTION","SUBJECT"]),
    gradeLevelId: z.string().uuid().optional(),
    classSectionId: z.string().uuid().optional(),
    subjectId: z.string().uuid().optional(),
  })).min(1),
  questions: z.array(z.object({
    questionId: z.string().uuid(),
    points: z.number().min(0).default(1),
    orderIndex: z.number().int().min(0).default(0),
  })).min(1),
});

export const UpdateQuizDto = CreateQuizDto.partial();

export const PublishDto = z.object({ publish: z.boolean() });

export const ListAvailableQuery = z.object({
  now: z.coerce.date().optional(), // testing override
  locale: Locale.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(), // ISO by openAt desc
});

export const StartAttemptDto = z.object({
  quizId: z.string().uuid(),
});

export const SubmitAnswersDto = z.object({
  answers: z.array(z.object({
    questionId: z.string().uuid(),
    selectedOptionIds: z.array(z.string().uuid()).min(0),
  })).min(1)
});

export const FinishAttemptDto = z.object({}); // placeholder
3) Permissions
Question & Quiz CRUD: ADMIN/STAFF; TEACHER only if quiz.subjectId / question.subjectId belongs to a subject they teach or quiz audience includes sections they teach (Module 4 teaching_assignment).

Publish/Unpublish: same as above; only DRAFT ↔ PUBLISHED (server sets CLOSED when manually closed or after closeAt? For MVP we keep status controlled via endpoint).

Student availability: visible if:

status=PUBLISHED, and now within [openAt, closeAt] if set, and

student’s enrollments match any quiz_audience (ALL or matching grade_level / class_section / subject), and

attempts used < maxAttempts.

4) Services (core logic)
4.1 Audience check
ts
Copier le code
// src/modules/assessments/audience.ts
import { db } from "../../db/client";
import { quizAudience, quiz } from "../../db/schema/assess";
import { enrollment } from "../../db/schema/enrollment";
import { classSectionSubject } from "../../db/schema/academics";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";

export async function studentMatchesQuiz(studentProfileId: string, quizId: string) {
  const aud = await db.select().from(quizAudience).where(eq(quizAudience.quizId, quizId));
  if (!aud.length) return false;

  if (aud.some(a => a.scope === "ALL")) return true;

  const enrs = await db.select({
    sectionId: enrollment.classSectionId,
    gradeLevelId: enrollment.gradeLevelId
  }).from(enrollment).where(eq(enrollment.studentProfileId, studentProfileId));

  const sectionIds = new Set(enrs.map(e => e.sectionId));
  const gradeIds = new Set(enrs.map(e => e.gradeLevelId));

  // SUBJECT audience matches if student's sections include that subject
  const subjAud = aud.filter(a => a.scope === "SUBJECT" && a.subjectId);
  if (subjAud.length && sectionIds.size) {
    const links = await db.select().from(classSectionSubject)
      .where(inArray(classSectionSubject.classSectionId, [...sectionIds] as any));
    if (links.some(l => subjAud.some(a => a.subjectId === l.subjectId))) return true;
  }

  if (aud.some(a => a.scope === "GRADE_LEVEL" && a.gradeLevelId && gradeIds.has(a.gradeLevelId))) return true;
  if (aud.some(a => a.scope === "CLASS_SECTION" && a.classSectionId && sectionIds.has(a.classSectionId))) return true;

  return false;
}
4.2 Availability & attempts left
ts
Copier le code
// src/modules/assessments/availability.ts
import { db } from "../../db/client";
import { quiz, quizAttempt } from "../../db/schema/assess";
import { and, eq, gt, gte, isNull, lt, lte, sql } from "drizzle-orm";

export async function isQuizOpen(quizRow: typeof quiz.$inferSelect, now = new Date()) {
  if (quizRow.status !== "PUBLISHED") return false;
  if (quizRow.openAt && now < quizRow.openAt) return false;
  if (quizRow.closeAt && now > quizRow.closeAt) return false;
  return true;
}

export async function attemptsRemaining(quizId: string, studentProfileId: string, maxAttempts: number) {
  const rows = await db.select().from(quizAttempt)
    .where(and(eq(quizAttempt.quizId, quizId), eq(quizAttempt.studentProfileId, studentProfileId)));
  const used = rows.filter(r => r.status === "SUBMITTED" || r.status === "GRADED").length;
  return Math.max(0, maxAttempts - used);
}
4.3 Start attempt (seal order)
ts
Copier le code
// src/modules/assessments/start-attempt.ts
import { db } from "../../db/client";
import { quiz, quizQuestion, quizAttempt, attemptQuestion, questionOption } from "../../db/schema/assess";
import { eq } from "drizzle-orm";

function mulberry32(seed: number) {
  return function() { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
}
function shuffle<T>(arr: T[], rnd: () => number) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export async function startAttempt(quizId: string, studentProfileId: string, meta: { ip?: string, ua?: string }) {
  const [q] = await db.select().from(quiz).where(eq(quiz.id, quizId));
  if (!q) throw new Error("QUIZ_NOT_FOUND");

  const seed = Math.floor(Math.random() * 2**31);
  const rnd = mulberry32(seed);

  let qrows = await db.select().from(quizQuestion).where(eq(quizQuestion.quizId, quizId));
  qrows = q.shuffleQuestions ? shuffle(qrows, rnd) : qrows.sort((a,b)=>a.orderIndex-b.orderIndex);

  const [att] = await db.insert(quizAttempt).values({
    quizId, studentProfileId, status: "IN_PROGRESS", startedAt: new Date(),
    timeLimitSec: q.timeLimitSec ?? null, seed, ip: meta.ip ?? null, userAgent: meta.ua ?? null
  }).returning();

  for (const [i, qq] of qrows.entries()) {
    const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, qq.questionId));
    const ordered = (q.shuffleOptions ? shuffle(opts, rnd) : opts.sort((a,b)=>a.orderIndex-b.orderIndex)).map(o => o.id);
    await db.insert(attemptQuestion).values({
      attemptId: att.id, questionId: qq.questionId, orderIndex: i, optionOrder: ordered as any, points: qq.points as any
    });
  }

  return att;
}
4.4 Grade attempt
ts
Copier le code
// src/modules/assessments/grade.ts
import { db } from "../../db/client";
import { attemptAnswer, attemptQuestion, question, questionOption, quizAttempt } from "../../db/schema/assess";
import { and, eq, inArray } from "drizzle-orm";

export async function gradeAttempt(attemptId: string) {
  const aq = await db.select().from(attemptQuestion).where(eq(attemptQuestion.attemptId, attemptId));
  let total = 0, max = 0;

  for (const row of aq) {
    max += Number(row.points);
    const [ans] = await db.select().from(attemptAnswer)
      .where(and(eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId)));
    const [q] = await db.select().from(question).where(eq(question.id, row.questionId));
    const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, row.questionId));

    let score = 0, correct = false;
    const correctIds = new Set(opts.filter(o => o.isCorrect).map(o => o.id));
    const sel = new Set((ans?.selectedOptionIds as any[] ?? []) as string[]);

    if (q.type === "TRUE_FALSE" || q.type === "MCQ_SINGLE") {
      correct = sel.size === 1 && correctIds.has([...sel][0]);
      score = correct ? Number(row.points) : 0;
    } else if (q.type === "MCQ_MULTI") {
      // partial: sum of weights for correctly selected that are correct, but zero if any incorrect selected
      const wrongSelected = [...sel].some(id => !correctIds.has(id));
      if (!wrongSelected) {
        const weights = opts.filter(o => o.isCorrect && sel.has(o.id)).reduce((sum, o) => sum + Number(o.weight ?? 1), 0);
        const maxWeights = opts.filter(o => o.isCorrect).reduce((sum, o) => sum + Number(o.weight ?? 1), 0) || 1;
        score = Number(row.points) * (weights / maxWeights);
        correct = weights === maxWeights;
      } else {
        score = 0; correct = false;
      }
    }

    if (ans) {
      await db.update(attemptAnswer).set({ isCorrect: correct, score }).where(and(
        eq(attemptAnswer.attemptId, attemptId), eq(attemptAnswer.questionId, row.questionId)
      ));
    } else {
      // unanswered
      await db.insert(attemptAnswer).values({
        attemptId, questionId: row.questionId, selectedOptionIds: JSON.stringify([]) as any, isCorrect: false, score: 0,
      });
    }

    total += score;
  }

  await db.update(quizAttempt).set({
    status: "GRADED", submittedAt: new Date(), score: total, maxScore: max
  }).where(eq(quizAttempt.id, attemptId));

  return { score: total, maxScore: max };
}
5) Routes
5.1 Questions (teachers/admin)
ts
Copier le code
// src/modules/assessments/questions.routes.ts
import { Router } from "express";
import { db } from "../../db/client";
import {
  question, questionTranslation, questionOption, questionOptionTranslation
} from "../../db/schema/assess";
import { UpsertQuestionDto } from "./dto";
import { requireAuth } from "../../middlewares/rbac";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

export const questionsRouter = Router();
questionsRouter.use(requireAuth);

// Create
questionsRouter.post("/", async (req, res, next) => {
  try {
    const dto = UpsertQuestionDto.parse(req.body);
    const profileId = (req.session as any).profileId;

    const [q] = await db.insert(question).values({
      type: dto.type, subjectId: dto.subjectId ?? null, createdByProfileId: profileId
    }).returning();

    await db.insert(questionTranslation).values(dto.translations.map(t => ({
      questionId: q.id, locale: t.locale, stemMd: t.stemMd, explanationMd: t.explanationMd ?? null
    })));

    for (const opt of dto.options) {
      const [o] = await db.insert(questionOption).values({
        questionId: q.id, isCorrect: opt.isCorrect, weight: opt.weight as any, orderIndex: opt.orderIndex
      }).returning();
      await db.insert(questionOptionTranslation).values(opt.translations.map(tr => ({
        optionId: o.id, locale: tr.locale, text: tr.text
      })));
    }

    await writeAudit({ action: "QUESTION_CREATE", entityType: "QUESTION", entityId: q.id, actor: actorFromReq(req) });
    res.status(201).json(q);
  } catch (e) { next(e); }
});

// Update
questionsRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = UpsertQuestionDto.partial().parse(req.body);

    if (dto.type || dto.subjectId !== undefined) {
      await db.update(question).set({
        type: dto.type as any, subjectId: dto.subjectId ?? null, updatedAt: new Date()
      }).where(eq(question.id, id));
    }
    if (dto.translations) {
      for (const t of dto.translations) {
        await db.insert(questionTranslation).values({ questionId: id, locale: t.locale, stemMd: t.stemMd, explanationMd: t.explanationMd ?? null })
          .onConflictDoUpdate({ target: [questionTranslation.questionId, questionTranslation.locale],
            set: { stemMd: t.stemMd, explanationMd: t.explanationMd ?? null } });
      }
    }
    if (dto.options) {
      // simple approach: delete & reinsert all options for this question
      const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, id));
      if (opts.length) {
        const optIds = opts.map(o => o.id);
        await db.delete(questionOptionTranslation).where(inArray(questionOptionTranslation.optionId, optIds));
        await db.delete(questionOption).where(eq(questionOption.questionId, id));
      }
      for (const opt of dto.options) {
        const [o] = await db.insert(questionOption).values({
          questionId: id, isCorrect: opt.isCorrect ?? false, weight: opt.weight as any ?? 1, orderIndex: opt.orderIndex ?? 0
        }).returning();
        await db.insert(questionOptionTranslation).values(opt.translations.map(tr => ({
          optionId: o.id, locale: tr.locale, text: tr.text
        })));
      }
    }

    await writeAudit({ action: "QUESTION_UPDATE", entityType: "QUESTION", entityId: id, actor: actorFromReq(req) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// List (by subject or creator)
questionsRouter.get("/", async (req, res, next) => {
  try {
    const subjectId = req.query.subjectId as string | undefined;
    const creatorId = req.query.createdByProfileId as string | undefined;
    const rows = await db.query.question.findMany({
      where: (subjectId || creatorId) ? (fields, ops) => ops.and(
        subjectId ? ops.eq(fields.subjectId, subjectId) : undefined as any,
        creatorId ? ops.eq(fields.createdByProfileId, creatorId) : undefined as any
      ) : undefined
    });
    res.json(rows);
  } catch (e) { next(e); }
});
5.2 Quizzes
ts
Copier le code
// src/modules/assessments/quizzes.routes.ts
import { Router } from "express";
import { db } from "../../db/client";
import {
  quiz, quizTranslation, quizAudience, quizQuestion
} from "../../db/schema/assess";
import { CreateQuizDto, UpdateQuizDto, PublishDto, ListAvailableQuery } from "./dto";
import { requireAuth } from "../../middlewares/rbac";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { isQuizOpen, attemptsRemaining } from "./availability";
import { studentMatchesQuiz } from "./audience";

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

// Create
quizzesRouter.post("/", async (req, res, next) => {
  try {
    const dto = CreateQuizDto.parse(req.body);
    const profileId = (req.session as any).profileId;

    const [q] = await db.insert(quiz).values({
      createdByProfileId: profileId,
      subjectId: dto.subjectId ?? null,
      timeLimitSec: dto.timeLimitSec ?? null,
      maxAttempts: dto.maxAttempts,
      shuffleQuestions: dto.shuffleQuestions,
      shuffleOptions: dto.shuffleOptions,
      openAt: dto.openAt ?? null,
      closeAt: dto.closeAt ?? null,
    }).returning();

    await db.insert(quizTranslation).values(dto.translations.map(t => ({
      quizId: q.id, locale: t.locale, title: t.title, descriptionMd: t.descriptionMd ?? null
    })));

    await db.insert(quizAudience).values(dto.audience.map(a => ({
      quizId: q.id, scope: a.scope as any, gradeLevelId: a.gradeLevelId ?? null,
      classSectionId: a.classSectionId ?? null, subjectId: a.subjectId ?? null
    })));

    await db.insert(quizQuestion).values(dto.questions.map(x => ({
      quizId: q.id, questionId: x.questionId, points: x.points as any, orderIndex: x.orderIndex
    })));

    await writeAudit({ action: "QUIZ_CREATE", entityType: "QUIZ", entityId: q.id, actor: actorFromReq(req) });
    res.status(201).json(q);
  } catch (e) { next(e); }
});

// Update
quizzesRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = UpdateQuizDto.parse(req.body);

    if (dto.subjectId !== undefined || dto.timeLimitSec !== undefined || dto.maxAttempts !== undefined ||
        dto.shuffleQuestions !== undefined || dto.shuffleOptions !== undefined ||
        dto.openAt !== undefined || dto.closeAt !== undefined) {
      await db.update(quiz).set({
        subjectId: dto.subjectId ?? null,
        timeLimitSec: dto.timeLimitSec ?? null,
        maxAttempts: dto.maxAttempts ?? undefined,
        shuffleQuestions: dto.shuffleQuestions ?? undefined,
        shuffleOptions: dto.shuffleOptions ?? undefined,
        openAt: dto.openAt ?? null,
        closeAt: dto.closeAt ?? null,
        updatedAt: new Date()
      }).where(eq(quiz.id, id));
    }

    if (dto.translations) {
      for (const t of dto.translations) {
        await db.insert(quizTranslation).values({ quizId: id, locale: t.locale, title: t.title, descriptionMd: t.descriptionMd ?? null })
          .onConflictDoUpdate({ target: [quizTranslation.quizId, quizTranslation.locale],
            set: { title: t.title, descriptionMd: t.descriptionMd ?? null }});
      }
    }

    if (dto.audience) {
      await db.delete(quizAudience).where(eq(quizAudience.quizId, id));
      await db.insert(quizAudience).values(dto.audience.map(a => ({
        quizId: id, scope: a.scope as any, gradeLevelId: a.gradeLevelId ?? null,
        classSectionId: a.classSectionId ?? null, subjectId: a.subjectId ?? null
      })));
    }

    if (dto.questions) {
      await db.delete(quizQuestion).where(eq(quizQuestion.quizId, id));
      await db.insert(quizQuestion).values(dto.questions.map(x => ({
        quizId: id, questionId: x.questionId, points: x.points as any, orderIndex: x.orderIndex
      })));
    }

    await writeAudit({ action: "QUIZ_UPDATE", entityType: "QUIZ", entityId: id, actor: actorFromReq(req) });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Publish/Unpublish
quizzesRouter.post("/:id/publish", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { publish } = PublishDto.parse(req.body);
    const [row] = await db.update(quiz).set({
      status: publish ? "PUBLISHED" : "DRAFT", updatedAt: new Date()
    }).where(eq(quiz.id, id)).returning();

    await writeAudit({ action: publish ? "QUIZ_PUBLISH" : "QUIZ_UNPUBLISH", entityType: "QUIZ", entityId: id, actor: actorFromReq(req) });
    res.json(row);
  } catch (e) { next(e); }
});

// Student: list available
quizzesRouter.get("/available", async (req, res, next) => {
  try {
    const q = ListAvailableQuery.parse(req.query);
    const now = q.now ?? new Date();
    const profileId = (req.session as any).profileId;

    const rows = await db.select().from(quiz)
      .where(eq(quiz.status, "PUBLISHED"))
      .orderBy(desc(quiz.openAt))
      .limit(q.limit); // simple page by openAt desc
    const items = [];
    for (const row of rows) {
      if (!(await isQuizOpen(row, now))) continue;
      const ok = await studentMatchesQuiz(profileId, row.id);
      if (!ok) continue;
      const remain = await attemptsRemaining(row.id, profileId, row.maxAttempts);
      if (remain <= 0) continue;
      items.push({ id: row.id, openAt: row.openAt, closeAt: row.closeAt, timeLimitSec: row.timeLimitSec, maxAttempts: row.maxAttempts, attemptsRemaining: remain });
      if (items.length >= q.limit) break;
    }
    res.json({ items, nextCursor: null });
  } catch (e) { next(e); }
});
5.3 Attempts
ts
Copier le code
// src/modules/assessments/attempts.routes.ts
import { Router } from "express";
import { StartAttemptDto, SubmitAnswersDto, FinishAttemptDto } from "./dto";
import { db } from "../../db/client";
import { quiz, quizAttempt, attemptQuestion, attemptAnswer, question, questionOption, questionTranslation, questionOptionTranslation } from "../../db/schema/assess";
import { isQuizOpen, attemptsRemaining } from "./availability";
import { studentMatchesQuiz } from "./audience";
import { startAttempt } from "./start-attempt";
import { gradeAttempt } from "./grade";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../middlewares/rbac";
import { writeAudit, actorFromReq } from "../admin-utils/audit.service";

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

// Start
attemptsRouter.post("/start", async (req, res, next) => {
  try {
    const { quizId } = StartAttemptDto.parse(req.body);
    const profileId = (req.session as any).profileId;
    const [q] = await db.select().from(quiz).where(eq(quiz.id, quizId));
    if (!q) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Quiz not found" } });

    if (!(await isQuizOpen(q))) return res.status(403).json({ error: { code: "QUIZ_CLOSED", message: "Quiz not open" } });
    if (!(await studentMatchesQuiz(profileId, quizId))) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Not in audience" } });
    if ((await attemptsRemaining(quizId, profileId, q.maxAttempts)) <= 0) return res.status(403).json({ error: { code: "NO_ATTEMPTS", message: "No attempts left" } });

    const ip = req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || undefined;
    const ua = req.headers["user-agent"] as string | undefined;
    const att = await startAttempt(quizId, profileId, { ip, ua });

    // build payload: ordered questions with option text (without correctness)
    const aq = await db.select().from(attemptQuestion).where(eq(attemptQuestion.attemptId, att.id));
    const locale = (req as any).locale || "fr";
    const questions = [];
    for (const row of aq.sort((a,b)=>a.orderIndex-b.orderIndex)) {
      const [tr] = await db.select().from(questionTranslation)
        .where(and(eq(questionTranslation.questionId, row.questionId), eq(questionTranslation.locale, locale)));
      const opts = await db.select().from(questionOption).where(eq(questionOption.questionId, row.questionId));
      const map = new Map<string, string>();
      for (const opt of opts) {
        const [otr] = await db.select().from(questionOptionTranslation)
          .where(and(eq(questionOptionTranslation.optionId, opt.id), eq(questionOptionTranslation.locale, locale)));
        map.set(opt.id, otr?.text ?? "(…)");
      }
      questions.push({
        questionId: row.questionId,
        stemMd: tr?.stemMd ?? "(no translation)",
        optionOrder: (row.optionOrder as any[] ?? []).map(id => ({ id, text: map.get(id as string) ?? "(…)" })),
        points: row.points
      });
    }

    await writeAudit({ action: "QUIZ_ATTEMPT_START", entityType: "QUIZ_ATTEMPT", entityId: att.id, actor: actorFromReq(req) });
    res.status(201).json({ attemptId: att.id, quizId: att.quizId, timeLimitSec: att.timeLimitSec, questions });
  } catch (e) { next(e); }
});

// Save answers (can be called multiple times)
attemptsRouter.post("/:id/answers", async (req, res, next) => {
  try {
    const attemptId = z.string().uuid().parse(req.params.id);
    const dto = SubmitAnswersDto.parse(req.body);
    const profileId = (req.session as any).profileId;

    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== profileId) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attempt not found" } });
    if (att.status !== "IN_PROGRESS") return res.status(400).json({ error: { code: "STATE", message: "Attempt not in progress" } });

    for (const a of dto.answers) {
      await db.insert(attemptAnswer).values({
        attemptId, questionId: a.questionId, selectedOptionIds: JSON.stringify(a.selectedOptionIds) as any
      }).onConflictDoUpdate({
        target: [attemptAnswer.attemptId, attemptAnswer.questionId],
        set: { selectedOptionIds: JSON.stringify(a.selectedOptionIds) as any, answeredAt: new Date() }
      });
    }

    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Submit/finish (auto-grade)
attemptsRouter.post("/:id/submit", async (req, res, next) => {
  try {
    const attemptId = z.string().uuid().parse(req.params.id);
    const profileId = (req.session as any).profileId;

    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att || att.studentProfileId !== profileId) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attempt not found" } });
    if (att.status !== "IN_PROGRESS") return res.status(400).json({ error: { code: "STATE", message: "Attempt not in progress" } });

    // enforce time limit if set
    if (att.timeLimitSec && att.startedAt) {
      const elapsed = (Date.now() - new Date(att.startedAt).getTime()) / 1000;
      if (elapsed > att.timeLimitSec + 30) { /* allow small grace */ }
    }

    const graded = await gradeAttempt(attemptId);
    await writeAudit({ action: "QUIZ_ATTEMPT_SUBMIT", entityType: "QUIZ_ATTEMPT", entityId: attemptId, meta: graded, actor: actorFromReq(req) });
    res.json(graded);
  } catch (e) { next(e); }
});

// Attempt details (student or teacher/admin)
attemptsRouter.get("/:id", async (req, res, next) => {
  try {
    const attemptId = z.string().uuid().parse(req.params.id);
    const profileId = (req.session as any).profileId;
    const roles: string[] = (req.session as any).user?.roles ?? [];

    const [att] = await db.select().from(quizAttempt).where(eq(quizAttempt.id, attemptId));
    if (!att) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attempt not found" } });
    const canView = roles.includes("ADMIN") || roles.includes("STAFF") || att.studentProfileId === profileId;
    if (!canView) return res.status(403).json({ error: { code: "NOT_ALLOWED", message: "Access denied" } });

    const answers = await db.select().from(attemptAnswer).where(eq(attemptAnswer.attemptId, attemptId));
    res.json({ attempt: att, answers });
  } catch (e) { next(e); }
});
5.4 Teacher: submissions overview
ts
Copier le code
// src/modules/assessments/teacher.routes.ts
import { Router } from "express";
import { db } from "../../db/client";
import { quizAttempt, profiles } from "../../db/schema/assess";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../middlewares/rbac";

export const teacherRouter = Router();
teacherRouter.use(requireAuth);

teacherRouter.get("/quizzes/:id/submissions", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(quizAttempt).where(eq(quizAttempt.quizId, id));
    // (Optionally join profiles to show student names)
    res.json(rows);
  } catch (e) { next(e); }
});
6) Wiring
ts
Copier le code
// src/app.ts (excerpt)
import { questionsRouter } from "./modules/assessments/questions.routes";
import { quizzesRouter } from "./modules/assessments/quizzes.routes";
import { attemptsRouter } from "./modules/assessments/attempts.routes";
import { teacherRouter } from "./modules/assessments/teacher.routes";

app.use("/api/assessments/questions", questionsRouter);
app.use("/api/assessments/quizzes", quizzesRouter);
app.use("/api/assessments/attempts", attemptsRouter);
app.use("/api/assessments/teacher", teacherRouter);
7) Security & i18n
Use requireAuth everywhere. Keep RBAC strict: only teachers/admin/staff can modify questions/quizzes.

Locale resolution from request; fall back to fr.

Never send correctness flags or option isCorrect to students; only send ordered options with text.

Seal per-attempt question/option order on the server.

8) OpenAPI (fragment)
yaml
Copier le code
paths:
  /api/assessments/questions:
    get: { summary: List questions }
    post: { summary: Create question }
  /api/assessments/questions/{id}:
    patch: { summary: Update question }
  /api/assessments/quizzes:
    post: { summary: Create quiz }
  /api/assessments/quizzes/{id}:
    patch: { summary: Update quiz }
  /api/assessments/quizzes/{id}/publish:
    post: { summary: Publish or unpublish a quiz }
  /api/assessments/quizzes/available:
    get: { summary: List quizzes available to current student }
  /api/assessments/attempts/start:
    post: { summary: Start an attempt }
  /api/assessments/attempts/{id}/answers:
    post: { summary: Save answers (partial or full) }
  /api/assessments/attempts/{id}/submit:
    post: { summary: Submit and auto-grade attempt }
  /api/assessments/attempts/{id}:
    get: { summary: Get attempt details (student or staff) }
  /api/assessments/teacher/quizzes/{id}/submissions:
    get: { summary: List submissions for a quiz }
9) Manual Tests (cURL)
bash
Copier le code
# 0) Login (save cookies.txt) as TEACHER/ADMIN

# 1) Create questions
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{
    "type":"MCQ_SINGLE",
    "translations":[{"locale":"fr","stemMd":"La capitale du Tchad ?","explanationMd":"N\'Djamena est la plus grande ville."}],
    "options":[
      {"isCorrect":true,"orderIndex":0,"translations":[{"locale":"fr","text":"N\'Djamena"}]},
      {"isCorrect":false,"orderIndex":1,"translations":[{"locale":"fr","text":"Moundou"}]}
    ]
  }' http://localhost:4000/api/assessments/questions

# 2) Create quiz (audience: one class section)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{
    "translations":[{"locale":"fr","title":"Géographie — Test 1","descriptionMd":"10 minutes"}],
    "timeLimitSec":600,
    "maxAttempts":1,
    "shuffleQuestions":true,
    "shuffleOptions":true,
    "openAt":"2025-09-01T08:00:00Z",
    "closeAt":"2025-09-01T23:00:00Z",
    "audience":[{"scope":"CLASS_SECTION","classSectionId":"<SECTION_ID>"}],
    "questions":[{"questionId":"<Q1_ID>","points":1,"orderIndex":0}]
  }' http://localhost:4000/api/assessments/quizzes

# 3) Publish
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"publish":true}' \
  http://localhost:4000/api/assessments/quizzes/<QUIZ_ID>/publish

# 4) Student lists available
curl -b cookies.txt "http://localhost:4000/api/assessments/quizzes/available"

# 5) Student starts attempt
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"quizId":"<QUIZ_ID>"}' \
  http://localhost:4000/api/assessments/attempts/start

# -> returns { attemptId, questions:[{questionId, stemMd, optionOrder:[{id,text}], points}] }

# 6) Student answers + submit
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"answers":[{"questionId":"<Q1_ID>","selectedOptionIds":["<OPTION_ID_CORRECT>"]}]}' \
  http://localhost:4000/api/assessments/attempts/<ATTEMPT_ID>/answers

curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{}' \
  http://localhost:4000/api/assessments/attempts/<ATTEMPT_ID>/submit

# 7) Teacher views submissions
curl -b cookies.txt "http://localhost:4000/api/assessments/teacher/quizzes/<QUIZ_ID>/submissions"
10) Definition of Done
 Schema created with enums/tables/indexes.

 Question CRUD with multilingual stems/options; correctness only server-side.

 Quiz CRUD with translations, audience, schedule, points; publish/unpublish.

 Student availability honors status + window + audience + attempts.

 Start seals per-attempt question & option order; timeLimit snapshot.

 Save answers endpoint idempotent; finish grades automatically.

 Results stored (score, maxScore); attempts visible to teacher/admin and the student.

 Audit events emitted: QUESTION_CREATE/UPDATE, QUIZ_CREATE/UPDATE/PUBLISH/UNPUBLISH, QUIZ_ATTEMPT_START/SUBMIT.

 No secrets in payloads; i18n respected (fr default; ar/en available).

11) Future Enhancements
Short-answer/essay items (manual grading + rubric).

Per-section randomization pools and per-student question sampling.

PIN / access code; IP allowlist; re-entry rules.

CSV export of attempts; analytics per question (discrimination, difficulty).

Post-submission feedback policy (show answers after closeAt).

Item banks per subject with sharing between teachers.