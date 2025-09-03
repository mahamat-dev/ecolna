import { pgTable, uuid, text, integer, timestamp, varchar, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { profiles } from './identity';
import { academicYear, gradeLevel } from './academics';

// Fee schedules (tuition or other fees templates)
export const feeSchedule = pgTable('fee_schedule', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 64 }).notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('XAF'),
  academicYearId: uuid('academic_year_id').references(() => academicYear.id, { onDelete: 'set null' }),
  gradeLevelId: uuid('grade_level_id').references(() => gradeLevel.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Assignment of fees to students
export const studentFee = pgTable('student_fee', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  studentProfileId: uuid('student_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  scheduleId: uuid('schedule_id').notNull().references(() => feeSchedule.id, { onDelete: 'restrict' }),
  amountCents: integer('amount_cents').notNull().default(0),
  discountCents: integer('discount_cents').notNull().default(0),
  dueDate: timestamp('due_date', { withTimezone: true }),
  status: varchar('status', { length: 16 }).notNull().default('PENDING'), // PENDING|PARTIAL|PAID|OVERDUE
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Invoices
export const invoice = pgTable('invoice', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  studentProfileId: uuid('student_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  totalCents: integer('total_cents').notNull().default(0),
  currency: varchar('currency', { length: 3 }).notNull().default('XAF'),
  status: varchar('status', { length: 16 }).notNull().default('DRAFT'), // DRAFT|ISSUED|PARTIAL|PAID|VOID
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  createdByProfileId: uuid('created_by_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const invoiceLine = pgTable('invoice_line', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid('invoice_id').notNull().references(() => invoice.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull().default(0),
  scheduleId: uuid('schedule_id').references(() => feeSchedule.id, { onDelete: 'set null' }),
});

// Payments
export const payment = pgTable('payment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid('invoice_id').references(() => invoice.id, { onDelete: 'set null' }),
  studentProfileId: uuid('student_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  amountCents: integer('amount_cents').notNull().default(0),
  method: varchar('method', { length: 32 }).notNull().default('CASH'),
  reference: varchar('reference', { length: 64 }),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  createdByProfileId: uuid('created_by_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
});

// Advances (staff or student advances)
export const advance = pgTable('advance', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  requesterProfileId: uuid('requester_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull().default(0),
  reason: text('reason'),
  status: varchar('status', { length: 16 }).notNull().default('REQUESTED'), // REQUESTED|APPROVED|REJECTED|PAID|SETTLED
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  approvedByProfileId: uuid('approved_by_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  repaidCents: integer('repaid_cents').notNull().default(0),
});

// Payroll periods and items
export const payrollPeriod = pgTable('payroll_period', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 32 }).notNull().unique(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  payDate: timestamp('pay_date', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('OPEN'), // OPEN|PROCESSED|PAID
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payrollItem = pgTable('payroll_item', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  periodId: uuid('period_id').notNull().references(() => payrollPeriod.id, { onDelete: 'cascade' }),
  staffProfileId: uuid('staff_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  grossCents: integer('gross_cents').notNull().default(0),
  allowancesCents: integer('allowances_cents').notNull().default(0),
  deductionsCents: integer('deductions_cents').notNull().default(0),
  netCents: integer('net_cents').notNull().default(0),
  status: varchar('status', { length: 16 }).notNull().default('DRAFT'), // DRAFT|APPROVED|PAID
});

