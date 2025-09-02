import { http } from '@/lib/http';

// Minimal shared types used by student/guardian pages
export type AttendanceSummaryRow = {
  date: string;
  classSectionId: string;
  sectionName: string;
  status: string;
};

export type StudentAvailableQuiz = {
  id: string;
  openAt?: string | null;
  closeAt?: string | null;
  attemptsRemaining?: number;
  timeLimitSec?: number | null;
};

/** Content (Module 7) */
export const ContentAPI = {
  listNotes: (params: { limit?: number; cursor?: string | null; locale?: string } = {}) => {
    const qs = new URLSearchParams({
      limit: String(params.limit ?? 20),
      audience: 'any',
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.locale ? { locale: params.locale } : {})
    });
    return http<{ items: { id: string; title: string; publishedAt?: string|null; pinUntil?: string|null }[]; nextCursor?: string|null }>(`/content/notes?${qs}`);
  },
  getNote: (id: string, locale?: string) => http(`/content/notes/${id}${locale ? `?locale=${locale}`:''}`),
  markRead: (id: string) => http(`/content/notes/${id}/read`, { method: 'POST', body: JSON.stringify({}) }),
};

/** Attendance (Module 5) */
export const AttendanceAPI = {
  sectionForDate: (sectionId: string, dateISO: string) => http(`/attendance/sections/${sectionId}?date=${encodeURIComponent(dateISO)}`),
  markSection: (sectionId: string, payload: { date: string; marks: { studentProfileId: string; status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null; note?: string|null }[] }) =>
    http(`/attendance/sections/${sectionId}/mark`, { method: 'POST', body: JSON.stringify(payload) }),
  mySummary: (from: string, to: string) => http(`/attendance/me?from=${from}&to=${to}`), // student
  studentSummary: (profileId: string, from: string, to: string) => http(`/attendance/students/${profileId}?from=${from}&to=${to}`), // guardian/staff
};

/** Academics (Module 2) */
export const AcademicsAPI = {
  myTimetable: (dateISO: string) => http(`/academics/timetable/me?date=${encodeURIComponent(dateISO)}`),
  mySectionsTaught: () => http(`/teaching/assignments/me`), // teacher
  mySections: () => http(`/enrollment/me/sections`),        // student
  sectionRoster: (sectionId: string) => http(`/enrollment/sections/${sectionId}/students`),
};

// Teaching (Module 3)
export type TeachingAssignment = {
  id: string;
  teacherProfileId: string;
  classSectionId: string;
  subjectId: string | null;
  academicYearId: string;
  termId: string | null;
  isLead: boolean;
  isHomeroom: boolean;
};

export const TeachingAPI = {
  myAssignments: () => http<TeachingAssignment[]>(`/teaching/teacher/my/assignments`),
};

/** Assessments (Module 8) */
export const AssessAPI = {
  available: () => http(`/assessments/quizzes/available`),
  start: (quizId: string) => http(`/assessments/attempts/start`, { method: 'POST', body: JSON.stringify({ quizId }) }),
  save: (attemptId: string, answers: { questionId: string; selectedOptionIds: string[] }[]) =>
    http(`/assessments/attempts/${attemptId}/answers`, { method: 'POST', body: JSON.stringify({ answers }) }),
  submit: (attemptId: string) => http(`/assessments/attempts/${attemptId}/submit`, { method: 'POST', body: JSON.stringify({}) }),
  attempt: (attemptId: string) => http(`/assessments/attempts/${attemptId}`),
  teacherSubmissions: (quizId: string) => http(`/assessments/teacher/quizzes/${quizId}/submissions`),
};