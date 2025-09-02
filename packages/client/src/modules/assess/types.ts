// Basic types for the Assess module. These mirror server-side DTOs at a high level but are simplified for client use.

export type QuestionType = 'MCQ_SINGLE' | 'MCQ_MULTI' | 'TRUE_FALSE';

export interface Translation {
  locale: string;
  title?: string;
  description?: string;
  prompt?: string;
  text?: string;
}

export interface AvailableQuiz {
  id: string;
  title?: string;
  timeLimitSec?: number | null;
  attemptsRemaining?: number;
  // Other fields from the server may be present but are optional for client list display
  [key: string]: unknown;
}

export interface StartAttemptResponse {
  attemptId: string;
}

export interface SubmitAnswersDto {
  answers: Array<{
    questionId: string;
    selectedOptionIds: string[];
  }>;
}

export interface FinishAttemptResponse {
  status?: 'CREATED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | string;
  score?: number | string | null;
  maxScore?: number | string | null;
}

export interface SubmissionSummary {
  id: string;
  studentProfileId: string;
  status: string;
  score?: number | string | null;
  submittedAt?: string | null;
  [key: string]: unknown;
}

// Question bank
export interface UpsertQuestionDto {
  type: QuestionType;
  subjectId?: string;
  translations: Array<{
    locale: string;
    stemMd: string;
  }>;
  options: Array<{
    orderIndex: number;
    isCorrect?: boolean;
    translations: Array<{
      locale: string;
      text: string;
    }>;
  }>;
}

// Quizzes
export type AudienceScope = 'ALL' | 'GRADE_LEVEL' | 'CLASS_SECTION' | 'SUBJECT';

export interface CreateQuizDto {
  subjectId?: string;
  timeLimitSec?: number | null;
  maxAttempts?: number; // 1..10
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  translations: Array<{
    locale: string;
    title: string;
    description?: string;
  }>;
  audience: Array<{
    scope: AudienceScope;
    scopeId?: string; // presence depends on scope
  }>;
  questions?: Array<{
    questionId: string;
    orderIndex: number;
    points: number | string;
  }>;
}

export type UpdateQuizDto = Partial<CreateQuizDto>;

export interface QuestionSummary {
  id: string;
  type: QuestionType;
  subjectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface AttemptContent {
  attemptId: string;
  status: string;
  timeLimitSec?: number | null;
  startedAt?: string | null;
  questions: Array<{
    questionId: string;
    type: QuestionType | string;
    prompt: string;
    points: number;
    options: Array<{ id: string; text: string }>;
  }>;
  answers: Record<string, string[]>;
}