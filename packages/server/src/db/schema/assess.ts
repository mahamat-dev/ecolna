import { pgTable, uuid, text, timestamp, boolean, integer, numeric, varchar, jsonb, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { classSection, gradeLevel, subject, classSectionSubject } from './academics';

// Enums
export const questionType = pgEnum('question_type', ['MCQ_SINGLE','MCQ_MULTI','TRUE_FALSE']);
export const quizStatus = pgEnum('quiz_status', ['DRAFT','PUBLISHED','CLOSED']);
export const attemptStatus = pgEnum('attempt_status', ['CREATED','IN_PROGRESS','SUBMITTED','GRADED']);
export const quizAudienceScope = pgEnum('quiz_audience_scope', ['ALL','GRADE_LEVEL','CLASS_SECTION','SUBJECT']);

// Question bank
export const question = pgTable('question', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  type: questionType('type').notNull(),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'set null' }),
  createdByProfileId: uuid('created_by_profile_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const questionTranslation = pgTable(
  'question_translation',
  {
    questionId: uuid('question_id').notNull().references(() => question.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 8 }).notNull(),
    stemMd: text('stem_md').notNull(),
    explanationMd: text('explanation_md'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.questionId, t.locale], name: 'pk_question_translation' }),
  })
);

export const questionOption = pgTable('question_option', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  questionId: uuid('question_id').notNull().references(() => question.id, { onDelete: 'cascade' }),
  isCorrect: boolean('is_correct').notNull().default(false),
  weight: numeric('weight', { precision: 6, scale: 3 }).default('1'),
  orderIndex: integer('order_index').notNull().default(0),
});

export const questionOptionTranslation = pgTable(
  'question_option_translation',
  {
    optionId: uuid('option_id').notNull().references(() => questionOption.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 8 }).notNull(),
    text: text('text').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.optionId, t.locale], name: 'pk_question_option_translation' }),
  })
);

// Quiz
export const quiz = pgTable('quiz', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  createdByProfileId: uuid('created_by_profile_id').notNull().references(() => profiles.id, { onDelete: 'restrict' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'set null' }),
  status: quizStatus('status').notNull().default('DRAFT'),
  timeLimitSec: integer('time_limit_sec'),
  maxAttempts: integer('max_attempts').notNull().default(1),
  shuffleQuestions: boolean('shuffle_questions').notNull().default(true),
  shuffleOptions: boolean('shuffle_options').notNull().default(true),
  openAt: timestamp('open_at', { withTimezone: true }),
  closeAt: timestamp('close_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

export const quizTranslation = pgTable(
  'quiz_translation',
  {
    quizId: uuid('quiz_id').notNull().references(() => quiz.id, { onDelete: 'cascade' }),
    locale: varchar('locale', { length: 8 }).notNull(),
    title: text('title').notNull(),
    descriptionMd: text('description_md'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.quizId, t.locale], name: 'pk_quiz_translation' }),
  })
);

export const quizQuestion = pgTable(
  'quiz_question',
  {
    quizId: uuid('quiz_id').notNull().references(() => quiz.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').notNull().references(() => question.id, { onDelete: 'restrict' }),
    points: numeric('points', { precision: 6, scale: 2 }).notNull().default('1'),
    orderIndex: integer('order_index').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.quizId, t.questionId], name: 'pk_quiz_question' }),
  })
);

export const quizAudience = pgTable('quiz_audience', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid('quiz_id').notNull().references(() => quiz.id, { onDelete: 'cascade' }),
  scope: quizAudienceScope('scope').notNull(),
  gradeLevelId: uuid('grade_level_id').references(() => gradeLevel.id, { onDelete: 'set null' }),
  classSectionId: uuid('class_section_id').references(() => classSection.id, { onDelete: 'set null' }),
  subjectId: uuid('subject_id').references(() => subject.id, { onDelete: 'set null' }),
});

// Attempts
export const quizAttempt = pgTable('quiz_attempt', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  quizId: uuid('quiz_id').notNull().references(() => quiz.id, { onDelete: 'cascade' }),
  studentProfileId: uuid('student_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  status: attemptStatus('status').notNull().default('CREATED'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  score: numeric('score', { precision: 8, scale: 2 }),
  maxScore: numeric('max_score', { precision: 8, scale: 2 }),
  timeLimitSec: integer('time_limit_sec'),
  seed: integer('seed'),
  ip: varchar('ip', { length: 64 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const attemptQuestion = pgTable(
  'attempt_question',
  {
    attemptId: uuid('attempt_id').notNull().references(() => quizAttempt.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').notNull().references(() => question.id, { onDelete: 'restrict' }),
    orderIndex: integer('order_index').notNull(),
    optionOrder: jsonb('option_order'),
    points: numeric('points', { precision: 6, scale: 2 }).notNull().default('1'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.attemptId, t.questionId], name: 'pk_attempt_question' }),
  })
);

export const attemptAnswer = pgTable(
  'attempt_answer',
  {
    attemptId: uuid('attempt_id').notNull().references(() => quizAttempt.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id').notNull().references(() => question.id, { onDelete: 'cascade' }),
    selectedOptionIds: jsonb('selected_option_ids').notNull().default(sql`'[]'::jsonb`),
    isCorrect: boolean('is_correct'),
    score: numeric('score', { precision: 6, scale: 2 }),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.attemptId, t.questionId], name: 'pk_attempt_answer' }),
  })
);