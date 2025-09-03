import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DisciplineAPI, type UUID } from './api';

export function useIncidents(params?: { status?: string; studentProfileId?: UUID; myReported?: 'true'|'false'; limit?: number; cursor?: string }) {
  return useQuery({ queryKey: ['disc','list', params], queryFn: () => DisciplineAPI.listIncidents(params || {}) });
}

export function useIncident(id?: UUID) {
  return useQuery({ queryKey: ['disc','one', id], queryFn: () => DisciplineAPI.getIncident(id!), enabled: !!id });
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: DisciplineAPI.createIncident,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','list'] }),
  });
}

export function useUpdateIncident(id: UUID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => DisciplineAPI.updateIncident(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disc','one', id] });
      qc.invalidateQueries({ queryKey: ['disc','list'] });
    },
  });
}

export function useAddAction(incidentId: UUID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { profileId: UUID; type: 'WARNING'|'DETENTION'|'SUSPENSION_IN_SCHOOL'|'SUSPENSION_OUT_OF_SCHOOL'|'PARENT_MEETING'|'COMMUNITY_SERVICE'; points?: number; dueAt?: string; comment?: string }) => DisciplineAPI.addAction(incidentId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','one', incidentId] }),
  });
}

export function usePublishIncident(id: UUID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visibility: 'PRIVATE'|'STUDENT'|'GUARDIAN') => DisciplineAPI.publishIncident(id, visibility),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','one', id] }),
  });
}

export function useDetentions() {
  return useQuery({ queryKey: ['disc','detentions'], queryFn: DisciplineAPI.listDetentions });
}
export function useCreateDetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: DisciplineAPI.createDetention,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','detentions'] }),
  });
}
export function useEnrollDetention(sessionId: UUID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { sessionId: UUID; actionId: UUID; studentProfileId: UUID }) => DisciplineAPI.enrollDetention(sessionId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','detentions'] }),
  });
}
export function useMarkAttendance(sessionId: UUID, studentProfileId: UUID) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (present: boolean) => DisciplineAPI.markDetentionAttendance(sessionId, studentProfileId, present),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['disc','detentions'] }),
  });
}

export function useMyRecord() {
  return useQuery({ queryKey: ['disc','my-record'], queryFn: DisciplineAPI.myRecord });
}
export function useGuardianChildRecord(studentProfileId?: UUID) {
  return useQuery({ queryKey: ['disc','child-record', studentProfileId], queryFn: () => DisciplineAPI.guardianChildRecord(studentProfileId!), enabled: !!studentProfileId });
}

