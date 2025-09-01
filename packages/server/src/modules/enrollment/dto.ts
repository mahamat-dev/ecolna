import { z } from 'zod';

export const EnrollDto = z.object({
  studentProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  joinedOn: z.coerce.date().optional(),
  rollNo: z.number().int().min(1).optional(),
});

export const TransferDto = z.object({
  studentProfileId: z.string().uuid(),
  fromClassSectionId: z.string().uuid(),
  toClassSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  effectiveOn: z.coerce.date().optional(),
  newRollNo: z.number().int().min(1).optional(),
});

export const WithdrawDto = z.object({
  studentProfileId: z.string().uuid(),
  classSectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  exitedOn: z.coerce.date(),
  reason: z.string().max(200).optional(),
});

export const GraduateDto = z.object({
  studentProfileId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  graduatedOn: z.coerce.date().optional(),
});

export const SetRollNoDto = z.object({
  classSectionId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  rollNo: z.number().int().min(1),
});

export const LinkGuardianDto = z.object({
  guardianProfileId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
  linkType: z.string().max(40).optional(),
  isPrimary: z.boolean().optional(),
});

export const UnlinkGuardianDto = z.object({
  guardianProfileId: z.string().uuid(),
  studentProfileId: z.string().uuid(),
});