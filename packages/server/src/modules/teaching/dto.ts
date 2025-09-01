import { z } from 'zod';

export const CreateAssignmentDto = z.object({
  teacherProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().nullable().optional(),
  isLead: z.boolean().optional(),
  isHomeroom: z.boolean().optional(),
  hoursPerWeek: z.number().int().min(1).max(40).optional(),
  notes: z.string().max(300).optional(),
});

export const UpdateAssignmentDto = z.object({
  isLead: z.boolean().optional(),
  isHomeroom: z.boolean().optional(),
  hoursPerWeek: z.number().int().min(1).max(40).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
  termId: z.string().uuid().nullable().optional(),
});

export const ListQueryDto = z.object({
  teacherProfileId: z.string().uuid().optional(),
  classSectionId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});