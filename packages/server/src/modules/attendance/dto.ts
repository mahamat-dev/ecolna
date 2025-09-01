import { z } from 'zod';

export const CreateSessionDto = z.object({
  classSectionId: z.string().uuid(),
  subjectId: z.string().uuid().nullable().optional(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  endsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
  takenByProfileId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const FinalizeSessionDto = z.object({
  isFinalized: z.literal(true),
});

export const BulkMarkDto = z.object({
  records: z.array(
    z.object({
      enrollmentId: z.string().uuid(),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']),
      minutesLate: z.number().int().min(0).max(300).optional(),
      comment: z.string().max(300).optional(),
    })
  ).min(1),
});

export const ListSessionsQueryDto = z.object({
  classSectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});