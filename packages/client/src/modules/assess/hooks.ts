import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createQuestion,
  createQuiz,
  finishAttempt,
  listAvailableQuizzes,
  listQuestions,
  listSubmissions,
  publishQuiz,
  startAttempt,
  submitAnswers,
  submitAttempt,
  updateQuestion,
  updateQuiz,
  getAttempt,
} from './api';

// Query keys
export const qk = {
  available: ['assess', 'available'] as const,
  attempt: (id?: string, locale?: string) => ['assess', 'attempt', id, locale] as const,
  questions: (filters?: { subjectId?: string; createdByProfileId?: string }) => ['assess', 'questions', filters] as const,
  submissions: (quizId: string) => ['assess', 'submissions', quizId] as const,
};

export function useAvailableQuizzes() {
  return useQuery({ queryKey: qk.available, queryFn: listAvailableQuizzes });
}

export function useStartAttempt() {
  return useMutation({ mutationFn: (quizId: string) => startAttempt(quizId) });
}

export function useSubmitAnswers() {
  return useMutation({ mutationFn: (vars: { attemptId: string; answers: { questionId: string; selectedOptionIds: string[] }[] }) => submitAnswers(vars.attemptId, vars.answers) });
}

export function useFinishAttempt() {
  return useMutation({ mutationFn: (attemptId: string) => finishAttempt(attemptId) });
}

export function useSubmitAttempt() {
  return useMutation({ mutationFn: (attemptId: string) => submitAttempt(attemptId) });
}

export function useQuestions(filters?: { subjectId?: string; createdByProfileId?: string }) {
  return useQuery({ queryKey: qk.questions(filters), queryFn: () => listQuestions(filters) });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuestion,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.questions(undefined) }),
  });
}

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; payload: Parameters<typeof updateQuestion>[1] }) => updateQuestion(vars.id, vars.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.questions(undefined) }),
  });
}

export function useCreateQuiz() {
  return useMutation({ mutationFn: createQuiz });
}

export function useUpdateQuiz() {
  return useMutation({ mutationFn: (vars: { id: string; payload: Parameters<typeof updateQuiz>[1] }) => updateQuiz(vars.id, vars.payload) });
}

export function usePublishQuiz() {
  return useMutation({ mutationFn: (vars: { id: string; publish: boolean }) => publishQuiz(vars.id, vars.publish) });
}

export function useSubmissions(quizId: string) {
  return useQuery({ queryKey: qk.submissions(quizId), queryFn: () => listSubmissions(quizId), enabled: !!quizId });
}

export function useAttempt(id?: string, locale?: string) {
  return useQuery({ queryKey: qk.attempt(id, locale), queryFn: () => getAttempt(id!, locale), enabled: !!id });
}