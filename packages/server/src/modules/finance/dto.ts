import { z } from 'zod';

export const CreateFeeScheduleDto = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1),
  description: z.string().max(4000).optional(),
  amountCents: z.coerce.number().int().min(0),
  currency: z.string().length(3).default('XAF'),
  academicYearId: z.string().uuid().optional().nullable(),
  gradeLevelId: z.string().uuid().optional().nullable(),
});

export const AssignStudentFeeDto = z.object({
  studentProfileId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  amountCents: z.coerce.number().int().min(0).optional(),
  discountCents: z.coerce.number().int().min(0).default(0),
  dueDate: z.coerce.date().optional(),
});

export const CreateInvoiceDto = z.object({
  studentProfileId: z.string().uuid(),
  currency: z.string().length(3).default('XAF'),
  dueDate: z.coerce.date().optional(),
  lines: z.array(z.object({ description: z.string().min(1), amountCents: z.coerce.number().int().min(0), scheduleId: z.string().uuid().optional() })).min(1),
});

export const VoidInvoiceDto = z.object({ reason: z.string().max(4000).optional() });

export const CreatePaymentDto = z.object({
  invoiceId: z.string().uuid().optional(),
  studentProfileId: z.string().uuid().optional(),
  amountCents: z.coerce.number().int().min(1),
  method: z.enum(['CASH','BANK','MOBILE']).default('CASH'),
  reference: z.string().max(64).optional(),
  receivedAt: z.coerce.date().optional(),
});

export const RequestAdvanceDto = z.object({ amountCents: z.coerce.number().int().min(1), reason: z.string().max(4000).optional() });
export const ApproveAdvanceDto = z.object({ approve: z.boolean(), comment: z.string().max(4000).optional() });
export const PayAdvanceDto = z.object({ pay: z.boolean().default(true) });
export const RepayAdvanceDto = z.object({ amountCents: z.coerce.number().int().min(1) });

export const CreatePayrollPeriodDto = z.object({
  code: z.string().min(1).max(32),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  payDate: z.coerce.date(),
});

export const AddPayrollItemDto = z.object({
  staffProfileId: z.string().uuid(),
  grossCents: z.coerce.number().int().min(0),
  allowancesCents: z.coerce.number().int().min(0).default(0),
  deductionsCents: z.coerce.number().int().min(0).default(0),
});

