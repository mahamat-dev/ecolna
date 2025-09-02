import { z } from 'zod';

export const Locale = z.enum(['fr','en','ar']);
export const QuestionType = z.enum(['MCQ_SINGLE','MCQ_MULTI','TRUE_FALSE']);

export const UpsertQuestionDto = z.object({
  type: QuestionType,
  subjectId: z.string().uuid().nullable().optional(),
  translations: z.array(z.object({
    locale: Locale, stemMd: z.string().min(1), explanationMd: z.string().optional().nullable(),
  })).min(1),
  options: z.array(z.object({
    id: z.string().uuid().optional(),
    isCorrect: z.boolean().default(false),
    weight: z.number().min(0).max(1).default(1),
    orderIndex: z.number().int().min(0).default(0),
    translations: z.array(z.object({ locale: Locale, text: z.string().min(1) })).min(1),
  })).min(2)
    .refine((arr) => arr.some(o => o.isCorrect), 'At least one correct option required'),
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
    scope: z.enum(['ALL','GRADE_LEVEL','CLASS_SECTION','SUBJECT']),
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
  now: z.coerce.date().optional(),
  locale: Locale.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
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

export const FinishAttemptDto = z.object({});