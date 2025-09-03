import { z } from 'zod';

export const CreateCategoryDto = z.object({
  code: z.string().min(1).max(32),
  defaultPoints: z.coerce.number().int().min(0).max(1000).default(0),
  translations: z.array(z.object({
    locale: z.enum(['fr','en','ar']),
    name: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
  })).min(1),
});

export const CreateIncidentDto = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().min(5).max(500),
  details: z.string().max(10000).optional(),
  occurredAt: z.coerce.date(),
  location: z.string().max(128).optional(),
  classSectionId: z.string().uuid().optional(),
  participants: z.array(z.object({
    profileId: z.string().uuid(),
    role: z.enum(['PERPETRATOR','VICTIM','WITNESS']),
    note: z.string().max(1000).optional(),
  })).min(1),
  attachments: z.array(z.string().uuid()).default([]),
});

export const UpdateIncidentDto = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().min(5).max(500).optional(),
  details: z.string().max(10000).optional(),
  occurredAt: z.coerce.date().optional(),
  location: z.string().max(128).optional(),
  classSectionId: z.string().uuid().optional(),
  status: z.enum(['OPEN','UNDER_REVIEW','RESOLVED','CANCELLED']).optional(),
  visibility: z.enum(['PRIVATE','STUDENT','GUARDIAN']).optional(),
});

export const AddActionDto = z.object({
  profileId: z.string().uuid(),
  type: z.enum(['WARNING','DETENTION','SUSPENSION_IN_SCHOOL','SUSPENSION_OUT_OF_SCHOOL','PARENT_MEETING','COMMUNITY_SERVICE']),
  points: z.coerce.number().int().min(0).max(1000).default(0),
  dueAt: z.coerce.date().optional(),
  comment: z.string().max(2000).optional(),
});

export const CompleteActionDto = z.object({
  completed: z.boolean().default(true),
  comment: z.string().max(2000).optional(),
});

export const CreateDetentionDto = z.object({
  title: z.string().min(1).max(128),
  dateTime: z.coerce.date(),
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  room: z.string().max(64).optional(),
  capacity: z.coerce.number().int().min(1).max(300).default(30),
});

export const EnrollDetentionDto = z.object({
  sessionId: z.string().uuid(),
  actionId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
});

export const MarkAttendanceDto = z.object({
  present: z.boolean(),
});

export const ListIncidentsQuery = z.object({
  status: z.enum(['OPEN','UNDER_REVIEW','RESOLVED','CANCELLED']).optional(),
  studentProfileId: z.string().uuid().optional(),
  myReported: z.enum(['true','false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const PublishDto = z.object({
  visibility: z.enum(['PRIVATE','STUDENT','GUARDIAN']),
});

