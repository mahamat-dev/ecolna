import { z } from 'zod';

export const CreateStageDto = z.object({
  code: z.string().min(2).max(32).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(80),
  orderIndex: z.number().int().min(0).default(0),
  isActive: z.boolean().optional(),
});
export const UpdateStageDto = z.object({
  code: z.string().min(2).max(32).transform((s) => s.toUpperCase()).optional(),
  name: z.string().min(1).max(80).optional(),
  orderIndex: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const CreateGradeLevelDto = z.object({
  stageId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(80),
  orderIndex: z.number().int().min(0).default(0),
});
export const UpdateGradeLevelDto = z.object({
  stageId: z.string().uuid().optional(),
  code: z.string().min(1).max(32).optional(),
  name: z.string().min(1).max(80).optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const YearBase = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  isActive: z.boolean().optional(),
});
export const CreateAcademicYearDto = YearBase.refine((d) => d.startsOn < d.endsOn, {
  message: 'startsOn must be before endsOn',
  path: ['endsOn'],
});
export const UpdateAcademicYearDto = z.object({
  code: z.string().regex(/^\d{4}-\d{4}$/).optional(),
  startsOn: z.coerce.date().optional(),
  endsOn: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
}).refine((d) => (d.startsOn && d.endsOn ? d.startsOn < d.endsOn : true), {
  message: 'startsOn must be before endsOn',
  path: ['endsOn'],
});

const TermBase = z.object({
  academicYearId: z.string().uuid(),
  name: z.string().min(1).max(64),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
  orderIndex: z.number().int().min(0).default(0),
});
export const CreateTermDto = TermBase.refine((d) => d.startsOn < d.endsOn, {
  message: 'startsOn must be before endsOn',
  path: ['endsOn'],
});
export const UpdateTermDto = z.object({
  academicYearId: z.string().uuid().optional(),
  name: z.string().min(1).max(64).optional(),
  startsOn: z.coerce.date().optional(),
  endsOn: z.coerce.date().optional(),
  orderIndex: z.number().int().min(0).optional(),
}).refine((d) => (d.startsOn && d.endsOn ? d.startsOn < d.endsOn : true), {
  message: 'startsOn must be before endsOn',
  path: ['endsOn'],
});

export const CreateSubjectDto = z.object({
  code: z.string().min(2).max(32).transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(80),
  stageId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});
export const UpdateSubjectDto = z.object({
  code: z.string().min(2).max(32).transform((s) => s.toUpperCase()).optional(),
  name: z.string().min(1).max(80).optional(),
  stageId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const CreateClassSectionDto = z.object({
  academicYearId: z.string().uuid(),
  gradeLevelId: z.string().uuid(),
  name: z.string().min(1).max(64),
  capacity: z.number().int().min(1).optional(),
  room: z.string().max(64).optional(),
  isActive: z.boolean().optional(),
});
export const UpdateClassSectionDto = z.object({
  academicYearId: z.string().uuid().optional(),
  gradeLevelId: z.string().uuid().optional(),
  name: z.string().min(1).max(64).optional(),
  capacity: z.number().int().min(1).optional(),
  room: z.string().max(64).optional(),
  isActive: z.boolean().optional(),
});

export const SetSectionSubjectsDto = z.object({
  subjectIds: z.array(z.string().uuid()).min(0),
});

// Timetable DTOs (Module 9)

export const CreatePeriodDto = z.object({
  label: z.string().min(1).max(64),
  startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

export const CreateSlotDto = z.object({
  classSectionId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherProfileId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  periodId: z.string().uuid(),
  room: z.string().max(64).optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().nullable().optional(),
});

export const UpdSlotDto = CreateSlotDto.partial();

export const AddExceptionDto = z.object({
  classSectionId: z.string().uuid(),
  date: z.coerce.date(),
  canceled: z.boolean().default(true),
  note: z.string().max(1000).optional(),
});

export const TimetableQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});