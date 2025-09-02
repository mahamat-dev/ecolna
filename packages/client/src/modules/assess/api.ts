import { get, post, patch } from '@/lib/api';
import type { AvailableQuiz, CreateQuizDto, StartAttemptResponse, SubmissionSummary, UpdateQuizDto, UpsertQuestionDto, AttemptContent, QuestionSummary } from './types';

// Base path for server assessments routes
const base = '/assessments';

// Student-facing APIs
export async function listAvailableQuizzes(): Promise<AvailableQuiz[]> {
  return get(`${base}/quizzes/available`);
}

export async function startAttempt(quizId: string): Promise<StartAttemptResponse> {
  return post(`${base}/attempts/start`, { quizId });
}

export async function submitAnswers(attemptId: string, answers: { questionId: string; selectedOptionIds: string[] }[]) {
  return post(`${base}/attempts/${attemptId}/answers`, { answers });
}

export async function getAttempt(id: string, locale?: string): Promise<AttemptContent> {
  const usp = new URLSearchParams();
  if (locale) usp.set('locale', locale);
  const qs = usp.toString();
  return get(`${base}/attempts/${id}${qs ? `?${qs}` : ''}`);
}

// Teacher/Admin APIs
export async function createQuestion(payload: UpsertQuestionDto) {
  return post(`${base}/questions`, payload);
}

export async function listQuestions(params?: { subjectId?: string; createdByProfileId?: string }): Promise<QuestionSummary[]> {
  const usp = new URLSearchParams();
  if (params?.subjectId) usp.set('subjectId', params.subjectId);
  if (params?.createdByProfileId) usp.set('createdByProfileId', params.createdByProfileId);
  const qs = usp.toString();
  return get(`${base}/questions${qs ? `?${qs}` : ''}`);
}

export async function updateQuestion(id: string, payload: UpsertQuestionDto) {
  return patch(`${base}/questions/${id}`, payload);
}

export async function createQuiz(payload: CreateQuizDto): Promise<{ id: string }> {
  return post(`${base}/quizzes`, payload);
}

export async function updateQuiz(id: string, payload: UpdateQuizDto) {
  return patch(`${base}/quizzes/${id}`, payload);
}

export async function publishQuiz(id: string, publish: boolean) {
  return post(`${base}/quizzes/${id}/publish`, { publish });
}

export async function listSubmissions(quizId: string): Promise<SubmissionSummary[]> {
  return get(`${base}/teacher/quizzes/${quizId}/submissions`);
}

export async function finishAttempt(attemptId: string) {
  return post(`${base}/attempts/${attemptId}/finish`, {});
}

export async function submitAttempt(attemptId: string) {
  return post(`${base}/attempts/${attemptId}/submit`, {});
}