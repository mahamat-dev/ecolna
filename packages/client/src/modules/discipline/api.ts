import { http } from '@/lib/http';

export type UUID = string;

export const DisciplineAPI = {
  // Categories
  listCategories: () => http<{ items: any[] }>(`/discipline/categories`),
  createCategory: (body: { code: string; defaultPoints?: number; translations: { locale: 'fr'|'en'|'ar'; name: string; description?: string }[] }) =>
    http(`/discipline/categories`, { method: 'POST', body: JSON.stringify(body) }),

  // Incidents
  listIncidents: (params: { status?: string; studentProfileId?: UUID; myReported?: 'true'|'false'; limit?: number; cursor?: string } = {}) => {
    const usp = new URLSearchParams(params as any);
    return http<{ items: any[]; nextCursor?: string|null }>(`/discipline/incidents?${usp.toString()}`);
  },
  getIncident: (id: UUID) => http<{ incident: any; participants: any[]; actions: any[]; attachments: any[] }>(`/discipline/incidents/${id}`),
  createIncident: (body: { categoryId?: UUID|null; summary: string; details?: string; occurredAt: string; location?: string; classSectionId?: UUID; participants: { profileId: UUID; role: 'PERPETRATOR'|'VICTIM'|'WITNESS'; note?: string }[]; attachments?: UUID[]; }) =>
    http(`/discipline/incidents`, { method: 'POST', body: JSON.stringify(body) }),
  updateIncident: (id: UUID, body: any) => http(`/discipline/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  publishIncident: (id: UUID, visibility: 'PRIVATE'|'STUDENT'|'GUARDIAN') =>
    http(`/discipline/incidents/${id}/publish`, { method: 'POST', body: JSON.stringify({ visibility }) }),
  deleteIncident: (id: UUID) => http(`/discipline/incidents/${id}`, { method: 'DELETE' }),

  // Actions
  addAction: (incidentId: UUID, body: { profileId: UUID; type: 'WARNING'|'DETENTION'|'SUSPENSION_IN_SCHOOL'|'SUSPENSION_OUT_OF_SCHOOL'|'PARENT_MEETING'|'COMMUNITY_SERVICE'; points?: number; dueAt?: string; comment?: string }) =>
    http(`/discipline/incidents/${incidentId}/actions`, { method: 'POST', body: JSON.stringify(body) }),
  completeAction: (actionId: UUID, completed: boolean, comment?: string) =>
    http(`/discipline/actions/${actionId}/complete`, { method: 'POST', body: JSON.stringify({ completed, comment }) }),

  // Detention
  listDetentions: () => http<{ items: any[] }>(`/discipline/detention-sessions`),
  createDetention: (body: { title: string; dateTime: string; durationMinutes: number; room?: string; capacity: number }) =>
    http(`/discipline/detention-sessions`, { method: 'POST', body: JSON.stringify(body) }),
  enrollDetention: (sessionId: UUID, body: { sessionId: UUID; actionId: UUID; studentProfileId: UUID }) =>
    http(`/discipline/detention-sessions/${sessionId}/enroll`, { method: 'POST', body: JSON.stringify(body) }),
  markDetentionAttendance: (sessionId: UUID, studentProfileId: UUID, present: boolean) =>
    http(`/discipline/detention-sessions/${sessionId}/attendance/${studentProfileId}`, { method: 'POST', body: JSON.stringify({ present }) }),

  // Student/Guardian
  myRecord: () => http<{ items: any[]; points: number }>(`/discipline/my-record`),
  guardianChildRecord: (studentProfileId: UUID) => http<{ items: any[]; points: number }>(`/discipline/students/${studentProfileId}/record`),

  // Files (Module 7)
  presign: (filename: string, mime: string, sizeBytes: number, sha256?: string) =>
    http(`/content/files/presign`, { method: 'POST', body: JSON.stringify({ filename, mime, sizeBytes, sha256 }) }),
  commit: (fileId: UUID, sizeBytes: number) => http(`/content/files/${fileId}/commit`, { method: 'POST', body: JSON.stringify({ sizeBytes }) }),
};

