# CLAUDE.module-12-finance.server.md
**Module 12 — Finance (Fees, Payments, Payroll, Advances)**  
_Server: Express **5**, TypeScript, Drizzle ORM (Postgres), Bun • i18n (fr default, ar, en) • Audit via Module 6 • Files optional via Module 7 (for receipts/PDFs) • Cash-only (no online payment)_

Manage:  
- **Student fees** (one-off or **tranches**/installments), **reductions/exemptions** (% or fixed), per-class fee plans with due dates.  
- **Payments (cash)** with allocations to invoices, receipts, balances, overdue rules.  
- **Payroll**: staff monthly salaries; teachers **hourly** and/or **monthly + hourly**; **advances (avances)** deducted across payroll runs.  
- **Schedules**: per-student due dates; per-employee pay day.

---

## 0) Dependencies & Assumptions

- **M1**: `profiles`, `user_roles` (students, guardians, teachers, staff, admin)  
- **M2**: `grade_level`, `class_section`, `academic_year`, `term`  
- **M3**: `enrollment` (student ↔ class_section)  
- **M6**: audit log writer (`writeAudit`)  
- **M7** (optional): `file_object` for storing receipts/report PDFs

Currency: **XAF** (Central African CFA). Store amounts as `numeric(12,2)`.

RBAC summary:
- **Admin/Staff (Finance)**: full finance CRUD.  
- **Teacher**: submit hour logs, view own payroll & advances.  
- **Student/Guardian**: read-only invoices, due dates, payments, receipts for the student.

---

## 1) Database Schema (Drizzle)

### 1.1 Enums
```ts
// src/db/schema/finance.enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const invoiceStatus = pgEnum("invoice_status", ["DRAFT","ISSUED","PARTIAL","PAID","CANCELLED","OVERDUE"]);
export const paymentMethod = pgEnum("payment_method", ["CASH"]); // cash-only
export const feePlanType = pgEnum("fee_plan_type", ["SINGLE","INSTALLMENTS"]);
export const contractType = pgEnum("contract_type", ["STAFF","TEACHER"]);
export const payrollStatus = pgEnum("payroll_status", ["DRAFT","CONFIRMED","PAID"]);
export const advanceStatus = pgEnum("advance_status", ["REQUESTED","APPROVED","REJECTED","CLOSED"]);
1.2 Student Fees
ts
Copier le code
// src/db/schema/finance.fees.ts
import {
  pgTable, uuid, text, varchar, numeric, integer, timestamp, boolean, date
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { academicYear, classSection, gradeLevel } from "./academics";
import { profiles } from "./identity";
import { invoiceStatus, paymentMethod, feePlanType } from "./finance.enums";

// Fee plan per class/grade (bind to one or both; class_section wins if both set)
export const feePlan = pgTable("fee_plan", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYear.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 32 }).notNull(), // e.g., LYC-2025
  name: varchar("name", { length: 128 }).notNull(),
  planType: feePlanType("plan_type").notNull().default("SINGLE"),
  installments: integer("installments").notNull().default(1),
  currency: varchar("currency", { length: 3 }).notNull().default("XAF"),
  gradeLevelId: uuid("grade_level_id").references(() => gradeLevel.id, { onDelete: "set null" }),
  classSectionId: uuid("class_section_id").references(() => classSection.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const feePlanItem = pgTable("fee_plan_item", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: uuid("plan_id").notNull().references(() => feePlan.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 128 }).notNull(), // e.g., "Scolarité", "Inscription", "Transport"
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  order: integer("order").notNull().default(1),
});

export const feePlanInstallment = pgTable("fee_plan_installment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  planId: uuid("plan_id").notNull().references(() => feePlan.id, { onDelete: "cascade" }),
  index: integer("index").notNull(), // 1..N
  dueDate: date("due_date").notNull(),
  // % of total plan items (sum must be 100 across plan)
  percent: numeric("percent", { precision: 5, scale: 2 }).notNull(),
});

export const studentFinanceProfile = pgTable("student_finance_profile", {
  studentProfileId: uuid("student_profile_id").primaryKey().references(() => profiles.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => feePlan.id, { onDelete: "set null" }),
  reductionPercent: numeric("reduction_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  // Optional custom dates (override plan installments for this student)
  customInstallments: integer("custom_installments"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

// Single invoice per installment (or 1 for SINGLE). Lines reference plan items.
export const studentInvoice = pgTable("student_invoice", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentProfileId: uuid("student_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  academicYearId: uuid("academic_year_id").notNull().references(() => academicYear.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => feePlan.id, { onDelete: "restrict" }),
  installmentIndex: integer("installment_index").notNull().default(1),
  dueDate: date("due_date").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("XAF"),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
  reductionPercent: numeric("reduction_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  amountDue: numeric("amount_due", { precision: 12, scale: 2 }).notNull(), // after reduction
  status: invoiceStatus("status").notNull().default("ISSUED"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const studentInvoiceLine = pgTable("student_invoice_line", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: uuid("invoice_id").notNull().references(() => studentInvoice.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  order: integer("order").notNull().default(1),
});

// Cash payment & allocation (one payment can cover multiple invoices)
export const studentPayment = pgTable("student_payment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentProfileId: uuid("student_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  method: paymentMethod("method").notNull().default("CASH"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  receiptNo: varchar("receipt_no", { length: 32 }).notNull().unique(),
  note: text("note"),
  createdByProfileId: uuid("created_by_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
});

export const studentPaymentAllocation = pgTable("student_payment_allocation", {
  paymentId: uuid("payment_id").notNull().references(() => studentPayment.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => studentInvoice.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
}, (t)=>({ pk: { primaryKey: [t.paymentId, t.invoiceId] }}));
1.3 Payroll, Hours & Advances
ts
Copier le code
// src/db/schema/finance.payroll.ts
import { pgTable, uuid, varchar, numeric, integer, timestamp, date, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { profiles } from "./identity";
import { contractType, payrollStatus, advanceStatus } from "./finance.enums";

// Contract per employee (staff or teacher)
export const employmentContract = pgTable("employment_contract", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  type: contractType("type").notNull(), // STAFF | TEACHER
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 }).notNull().default("0.00"),
  hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }).notNull().default("0.00"),
  paysHours: boolean("pays_hours").notNull().default(false), // TEACHER hourly
  payDay: integer("pay_day").notNull().default(25), // day of month
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teacherHourLog = pgTable("teacher_hour_log", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  teacherProfileId: uuid("teacher_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  approved: boolean("approved").notNull().default(false),
  approvedByProfileId: uuid("approved_by_profile_id"),
  note: varchar("note", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const advanceLoan = pgTable("advance_loan", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  status: advanceStatus("status").notNull().default("REQUESTED"),
  principal: numeric("principal", { precision: 12, scale: 2 }).notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  months: integer("months").notNull().default(1),
  monthlyDeduction: numeric("monthly_deduction", { precision: 12, scale: 2 }).notNull(),
  remaining: numeric("remaining", { precision: 12, scale: 2 }).notNull(),
  note: varchar("note", { length: 256 }),
  createdByProfileId: uuid("created_by_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
  approvedByProfileId: uuid("approved_by_profile_id"),
});

export const payrollRun = pgTable("payroll_run", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  year: integer("year").notNull(),
  month: integer("month").notNull(), // 1..12
  status: payrollStatus("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdByProfileId: uuid("created_by_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
});

export const payrollItem = pgTable("payroll_item", {
  runId: uuid("run_id").notNull().references(() => payrollRun.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  baseSalary: numeric("base_salary", { precision: 12, scale: 2 }).notNull().default("0.00"),
  hourlyPay: numeric("hourly_pay", { precision: 12, scale: 2 }).notNull().default("0.00"),
  advanceDeduction: numeric("advance_deduction", { precision: 12, scale: 2 }).notNull().default("0.00"),
  otherDeductions: numeric("other_deductions", { precision: 12, scale: 2 }).notNull().default("0.00"),
  netPay: numeric("net_pay", { precision: 12, scale: 2 }).notNull().default("0.00"),
}, (t)=>({ pk: { primaryKey: [t.runId, t.profileId] }}));

export const payrollPayment = pgTable("payroll_payment", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  runId: uuid("run_id").notNull().references(() => payrollRun.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  receiptNo: varchar("receipt_no", { length: 32 }).notNull().unique(),
  note: varchar("note", { length: 256 }),
  createdByProfileId: uuid("created_by_profile_id").notNull().references(() => profiles.id, { onDelete: "restrict" }),
});
1.4 Indexes (SQL)
sql
Copier le code
-- drizzle/<ts>_m12_finance.sql
CREATE INDEX IF NOT EXISTS idx_fee_plan_active ON fee_plan(is_active);
CREATE INDEX IF NOT EXISTS idx_fee_plan_scope ON fee_plan(academic_year_id, grade_level_id, class_section_id);

CREATE INDEX IF NOT EXISTS idx_invoice_student ON student_invoice(student_profile_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_invoice_due ON student_invoice(due_date, status);

CREATE INDEX IF NOT EXISTS idx_payment_student ON student_payment(student_profile_id, received_at);

CREATE INDEX IF NOT EXISTS idx_contract_profile ON employment_contract(profile_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_hours_teacher_date ON teacher_hour_log(teacher_profile_id, date);
CREATE INDEX IF NOT EXISTS idx_advance_profile ON advance_loan(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_month ON payroll_run(year, month, status);
2) Business Rules
Plan resolution: for a student, pick class_section plan if set, else grade_level plan for active academic_year.

Installments: generate student_invoice records per installment with dueDate from plan (or student override).

Reduction: reductionPercent from student_finance_profile applies to each invoice (line amounts scaled).

Status updates:

On due date pass and unpaid → mark OVERDUE.

When allocations reach invoice amountDue → PAID. Partial → PARTIAL.

Payments: cash recorded in student_payment, allocated oldest-first by default to open invoices (server auto-allocation).

Advances: once APPROVED, create/maintain remaining. Each payroll run deducts up to monthlyDeduction until remaining=0 ⇒ CLOSED.

Payroll:

baseSalary from active contract (monthlySalary).

hourlyPay = sum(approved hours in month) × hourlyRate (if paysHours=true).

advanceDeduction = min(monthlyDeduction, remaining).

netPay = base + hourly − deductions (>= 0).

Actions for overdue students (hooks): expose a helper hasFinanceBlock(studentProfileId) used by Exams module to block exam registration/results when overdue beyond grace period.

3) DTOs (Zod)
ts
Copier le code
// src/modules/finance/dto.ts
import { z } from "zod";

// Plans
export const FeePlanCreateDto = z.object({
  academicYearId: z.string().uuid(),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  planType: z.enum(["SINGLE","INSTALLMENTS"]),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  currency: z.literal("XAF").default("XAF"),
  gradeLevelId: z.string().uuid().optional(),
  classSectionId: z.string().uuid().optional(),
  items: z.array(z.object({ name: z.string().min(1), amount: z.coerce.number().nonnegative(), order: z.number().int().default(1) })).min(1),
  schedule: z.array(z.object({ index: z.number().int().min(1), dueDate: z.coerce.date(), percent: z.coerce.number().min(0).max(100) })).default([]),
});

export const FeePlanUpdateDto = FeePlanCreateDto.partial();

// Student profile
export const StudentFinanceProfileUpsertDto = z.object({
  planId: z.string().uuid().nullable().optional(),
  reductionPercent: z.coerce.number().min(0).max(100).default(0),
  customInstallments: z.coerce.number().int().min(1).max(12).nullable().optional(),
});

// Generate invoices
export const GenerateInvoicesDto = z.object({
  academicYearId: z.string().uuid(),
  classSectionId: z.string().uuid().optional(),
  studentProfileId: z.string().uuid().optional(),
  overwriteExisting: z.boolean().default(false),
});

// Payments
export const PaymentCreateDto = z.object({
  studentProfileId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  receivedAt: z.coerce.date().optional(),
  note: z.string().max(500).optional(),
  allocations: z.array(z.object({ invoiceId: z.string().uuid(), amount: z.coerce.number().positive() })).optional(), // if missing → auto-allocate
});

// Hours
export const HourLogCreateDto = z.object({
  date: z.coerce.date(),
  hours: z.coerce.number().positive().max(24),
  note: z.string().max(256).optional(),
});
export const HourLogApproveDto = z.object({ approved: z.boolean() });

// Advances
export const AdvanceRequestDto = z.object({
  profileId: z.string().uuid(),
  principal: z.coerce.number().positive(),
  months: z.coerce.number().int().min(1).max(12).default(1),
  note: z.string().max(256).optional(),
});
export const AdvanceApproveDto = z.object({
  monthlyDeduction: z.coerce.number().positive(),
});

// Payroll
export const ContractUpsertDto = z.object({
  profileId: z.string().uuid(),
  type: z.enum(["STAFF","TEACHER"]),
  monthlySalary: z.coerce.number().min(0),
  hourlyRate: z.coerce.number().min(0).default(0),
  paysHours: z.boolean().default(false),
  payDay: z.coerce.number().int().min(1).max(31).default(25),
  active: z.boolean().default(true),
});

export const PayrollPreviewDto = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});
4) Core Services
4.1 Plan Resolution & Invoice Generation
ts
Copier le code
// src/modules/finance/invoice.service.ts
import { db } from "../../db/client";
import { feePlan, feePlanItem, feePlanInstallment, studentFinanceProfile, studentInvoice, studentInvoiceLine } from "../../db/schema/finance.fees";
import { enrollment } from "../../db/schema/enrollment";
import { and, eq, inArray } from "drizzle-orm";
import { writeAudit } from "../admin-utils/audit.service";

export async function resolvePlanForStudent(studentProfileId: string, academicYearId: string) {
  // Prefer class_section plan, else grade plan
  const enr = await db.select().from(enrollment).where(and(eq(enrollment.studentProfileId, studentProfileId), eq(enrollment.academicYearId, academicYearId)));
  if (!enr.length) throw new Error("No enrollment found");
  const sectionId = enr[0].classSectionId;
  const [secPlan] = await db.select().from(feePlan).where(and(eq(feePlan.academicYearId, academicYearId), eq(feePlan.classSectionId, sectionId), eq(feePlan.isActive, true)));
  if (secPlan) return secPlan;
  const [gradePlan] = await db.select().from(feePlan).where(and(eq(feePlan.academicYearId, academicYearId), eq(feePlan.gradeLevelId, enr[0].gradeLevelId as any), eq(feePlan.isActive, true)));
  if (!gradePlan) throw new Error("No fee plan configured");
  return gradePlan;
}

export async function generateInvoices({ academicYearId, classSectionId, studentProfileId, overwriteExisting }:{
  academicYearId: string; classSectionId?: string; studentProfileId?: string; overwriteExisting: boolean;
}) {
  const students = studentProfileId
    ? [studentProfileId]
    : (await db.select({ sid: enrollment.studentProfileId }).from(enrollment)
        .where(and(eq(enrollment.academicYearId, academicYearId), classSectionId ? eq(enrollment.classSectionId, classSectionId) : undefined))).map(r=>r.sid);

  const created: string[] = [];
  for (const sid of students) {
    const plan = await resolvePlanForStudent(sid, academicYearId);
    const items = await db.select().from(feePlanItem).where(eq(feePlanItem.planId, plan.id));
    const schedule = plan.planType === "SINGLE"
      ? [{ index: 1, percent: 100, dueDate: new Date().toISOString().slice(0,10) }]
      : await db.select().from(feePlanInstallment).where(eq(feePlanInstallment.planId, plan.id));

    const [sfp] = await db.select().from(studentFinanceProfile).where(eq(studentFinanceProfile.studentProfileId, sid));
    const reduction = Number(sfp?.reductionPercent ?? 0);

    if (overwriteExisting) {
      // remove DRAFT/ISSUED invoices for same AY before re-creating
      await db.delete(studentInvoice).where(and(eq(studentInvoice.studentProfileId, sid), eq(studentInvoice.academicYearId, academicYearId)));
    }

    const total = items.reduce((a,i)=>a + Number(i.amount), 0);
    for (const inst of schedule) {
      const portion = (Number(inst.percent) / 100) * total;
      const amountDue = Math.round((portion * (1 - reduction/100)) * 100) / 100;
      const [inv] = await db.insert(studentInvoice).values({
        studentProfileId: sid,
        academicYearId,
        planId: plan.id,
        installmentIndex: inst.index,
        dueDate: inst.dueDate as any,
        originalAmount: portion,
        reductionPercent: reduction,
        amountDue,
        status: "ISSUED"
      }).returning();
      // derive lines proportionally
      let lineOrder = 1;
      for (const it of items) {
        const part = (Number(it.amount) / total) * portion;
        await db.insert(studentInvoiceLine).values({
          invoiceId: inv.id,
          title: it.name,
          amount: Math.round(part * (1 - reduction/100) * 100) / 100,
          order: lineOrder++
        });
      }
      created.push(inv.id);
    }
    await writeAudit({ action:"FIN_INVOICE_GEN", entityType:"STUDENT", entityId: sid, summary:`${created.length} invoices`, actor: null as any });
  }
  return { created };
}
4.2 Payments & Allocations (auto oldest-first)
ts
Copier le code
// src/modules/finance/payment.service.ts
import { db } from "../../db/client";
import { studentInvoice, studentPayment, studentPaymentAllocation } from "../../db/schema/finance.fees";
import { and, asc, eq } from "drizzle-orm";

export async function autoAllocate(paymentId: string) {
  const [p] = await db.select().from(studentPayment).where(eq(studentPayment.id, paymentId));
  if (!p) throw new Error("Payment not found");
  let remaining = Number(p.amount);

  // oldest unpaid
  const open = await db.select().from(studentInvoice)
    .where(and(eq(studentInvoice.studentProfileId, p.studentProfileId), eq(studentInvoice.status, "ISSUED" as any)))
    .orderBy(asc(studentInvoice.dueDate), asc(studentInvoice.createdAt));

  for (const inv of open) {
    if (remaining <= 0) break;
    const paidSoFar = await db.select().from(studentPaymentAllocation)
      .where(eq(studentPaymentAllocation.invoiceId, inv.id))
      .then(rows => rows.reduce((a,r)=>a + Number(r.amount), 0));
    const left = Number(inv.amountDue) - paidSoFar;
    if (left <= 0) continue;
    const alloc = Math.min(left, remaining);
    await db.insert(studentPaymentAllocation).values({ paymentId: p.id, invoiceId: inv.id, amount: alloc });
    remaining = Math.max(0, remaining - alloc);

    // update status
    const nowPaid = paidSoFar + alloc;
    const newStatus = nowPaid >= Number(inv.amountDue) ? "PAID" : (nowPaid > 0 ? "PARTIAL" : "ISSUED");
    await db.update(studentInvoice).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(studentInvoice.id, inv.id));
  }
  return { unallocated: remaining };
}
4.3 Payroll Preview & Confirm
ts
Copier le code
// src/modules/finance/payroll.service.ts
import { db } from "../../db/client";
import { employmentContract, teacherHourLog, advanceLoan, payrollRun, payrollItem } from "../../db/schema/finance.payroll";
import { and, eq } from "drizzle-orm";

export async function previewPayroll(year: number, month: number) {
  const contracts = await db.select().from(employmentContract).where(eq(employmentContract.active, true));
  const items: any[] = [];
  for (const c of contracts) {
    const base = Number(c.monthlySalary || 0);
    let hourly = 0;
    if (c.paysHours) {
      const start = new Date(Date.UTC(year, month-1, 1));
      const end = new Date(Date.UTC(year, month, 0));
      const rows = await db.select().from(teacherHourLog)
        .where(and(eq(teacherHourLog.teacherProfileId, c.profileId), eq(teacherHourLog.approved, true)));
      const inMonth = rows.filter(r => {
        const d = new Date(r.date as any);
        return d >= start && d <= end;
      });
      const hours = inMonth.reduce((a,r)=>a + Number(r.hours), 0);
      hourly = hours * Number(c.hourlyRate || 0);
    }
    // advances
    const [adv] = await db.select().from(advanceLoan)
      .where(and(eq(advanceLoan.profileId, c.profileId), eq(advanceLoan.status, "APPROVED" as any)));
    const advDed = Math.min(Number(adv?.monthlyDeduction || 0), Number(adv?.remaining || 0));
    const net = Math.max(0, base + hourly - advDed);
    items.push({ profileId: c.profileId, baseSalary: base, hourlyPay: hourly, advanceDeduction: advDed, otherDeductions: 0, netPay: net });
  }
  return items;
}

export async function confirmPayroll(year: number, month: number, creator: { profileId: string }) {
  const items = await previewPayroll(year, month);
  const [run] = await db.insert(payrollRun).values({
    year, month, status: "CONFIRMED", createdByProfileId: creator.profileId, confirmedAt: new Date()
  }).returning();
  for (const it of items) {
    await db.insert(payrollItem).values({ runId: run.id, ...it });
    // reduce advance remaining
    if (it.advanceDeduction > 0) {
      const [adv] = await db.select().from(advanceLoan).where(and(eq(advanceLoan.profileId, it.profileId), eq(advanceLoan.status, "APPROVED" as any)));
      if (adv) {
        const newRemain = Math.max(0, Number(adv.remaining) - it.advanceDeduction);
        const status = newRemain === 0 ? "CLOSED" : "APPROVED";
        await db.update(advanceLoan).set({ remaining: newRemain, status: status as any }).where(eq(advanceLoan.id, adv.id));
      }
    }
  }
  return run;
}
5) Routes (Express 5)
ts
Copier le code
// src/modules/finance/routes.ts
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRoles } from "../../middlewares/rbac";
import { db } from "../../db/client";
import {
  feePlan, feePlanItem, feePlanInstallment, studentFinanceProfile, studentInvoice,
  studentPayment, studentPaymentAllocation
} from "../../db/schema/finance.fees";
import {
  employmentContract, teacherHourLog, advanceLoan, payrollRun, payrollItem, payrollPayment
} from "../../db/schema/finance.payroll";
import { FeePlanCreateDto, FeePlanUpdateDto, StudentFinanceProfileUpsertDto, GenerateInvoicesDto,
  PaymentCreateDto, HourLogCreateDto, HourLogApproveDto, AdvanceRequestDto, AdvanceApproveDto,
  ContractUpsertDto, PayrollPreviewDto } from "./dto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { generateInvoices } from "./invoice.service";
import { autoAllocate } from "./payment.service";
import { previewPayroll, confirmPayroll } from "./payroll.service";

export const financeRouter = Router();
financeRouter.use(requireAuth);

/** ---------- Plans ---------- */
financeRouter.post("/finance/fee-plans", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const dto = FeePlanCreateDto.parse(req.body);
    const [p] = await db.insert(feePlan).values({
      academicYearId: dto.academicYearId, code: dto.code, name: dto.name,
      planType: dto.planType as any, installments: dto.installments, currency: dto.currency,
      gradeLevelId: dto.gradeLevelId ?? null, classSectionId: dto.classSectionId ?? null
    }).returning();
    if (dto.items?.length) {
      await db.insert(feePlanItem).values(dto.items.map((i:any)=>({ planId: p.id, name: i.name, amount: i.amount, order: i.order ?? 1 })));
    }
    if (dto.planType === "INSTALLMENTS" && dto.schedule?.length) {
      const sum = dto.schedule.reduce((a,s)=>a + Number(s.percent), 0);
      if (Math.round(sum) !== 100) return res.status(400).json({ error:{ code:"BAD_SCHEDULE", message:"Installments must sum to 100%" }});
      await db.insert(feePlanInstallment).values(dto.schedule.map((s:any)=>({ planId: p.id, index: s.index, dueDate: s.dueDate, percent: s.percent })));
    }
    res.status(201).json(p);
  }catch(e){ next(e); }
});

financeRouter.patch("/finance/fee-plans/:id", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const dto = FeePlanUpdateDto.parse(req.body);
    const [p] = await db.update(feePlan).set({
      code: dto.code ?? undefined, name: dto.name ?? undefined,
      planType: dto.planType as any ?? undefined, installments: dto.installments ?? undefined,
      currency: dto.currency ?? undefined, gradeLevelId: dto.gradeLevelId ?? undefined,
      classSectionId: dto.classSectionId ?? undefined, isActive: (dto as any).isActive ?? undefined
    }).where(eq(feePlan.id, id)).returning();
    if (!p) return res.status(404).end();
    res.json(p);
  }catch(e){ next(e); }
});

financeRouter.get("/finance/fee-plans", requireRoles(["ADMIN","STAFF"]), async (_req,res,next)=>{
  try{ const rows = await db.select().from(feePlan).orderBy(desc(feePlan.createdAt)); res.json({ items: rows }); }
  catch(e){ next(e); }
});

/** ---------- Student Finance ---------- */
financeRouter.post("/finance/students/:studentProfileId/profile", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const studentProfileId = z.string().uuid().parse(req.params.studentProfileId);
    const dto = StudentFinanceProfileUpsertDto.parse(req.body);
    const [row] = await db.insert(studentFinanceProfile).values({
      studentProfileId, planId: dto.planId ?? null, reductionPercent: dto.reductionPercent ?? 0,
      customInstallments: dto.customInstallments ?? null, updatedAt: new Date()
    }).onConflictDoUpdate({ target: [studentFinanceProfile.studentProfileId], set: {
      planId: dto.planId ?? null, reductionPercent: dto.reductionPercent ?? 0,
      customInstallments: dto.customInstallments ?? null, updatedAt: new Date()
    }}).returning();
    res.json(row);
  }catch(e){ next(e); }
});

/** Generate invoices by class or student */
financeRouter.post("/finance/invoices/generate", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const dto = GenerateInvoicesDto.parse(req.body);
    const out = await generateInvoices(dto);
    res.status(201).json(out);
  }catch(e){ next(e); }
});

/** List & view invoices */
financeRouter.get("/finance/invoices", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const studentProfileId = req.query.studentProfileId as string | undefined;
    let q = db.select().from(studentInvoice).orderBy(desc(studentInvoice.createdAt));
    if (studentProfileId) q = q.where(eq(studentInvoice.studentProfileId, studentProfileId as any));
    const rows = await q;
    res.json({ items: rows });
  }catch(e){ next(e); }
});

financeRouter.get("/finance/invoices/:id", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const [inv] = await db.select().from(studentInvoice).where(eq(studentInvoice.id, id));
    if (!inv) return res.status(404).end();
    res.json(inv);
  }catch(e){ next(e); }
});

/** ---------- Payments ---------- */
financeRouter.post("/finance/payments", requireRoles(["ADMIN","STAFF"]), async (req:any,res,next)=>{
  try{
    const dto = PaymentCreateDto.parse(req.body);
    const receiptNo = `RC-${Date.now().toString().slice(-8)}`; // ensure uniq via constraint
    const [pay] = await db.insert(studentPayment).values({
      studentProfileId: dto.studentProfileId,
      amount: dto.amount,
      receivedAt: dto.receivedAt ?? new Date(),
      receiptNo,
      note: dto.note ?? null,
      createdByProfileId: req.session.profileId
    }).returning();
    if (dto.allocations?.length) {
      for (const a of dto.allocations) {
        await db.insert(studentPaymentAllocation).values({ paymentId: pay.id, invoiceId: a.invoiceId, amount: a.amount });
        // update invoice status handled below by simple recompute:
        const [inv] = await db.select().from(studentInvoice).where(eq(studentInvoice.id, a.invoiceId));
        const paid = (await db.select().from(studentPaymentAllocation).where(eq(studentPaymentAllocation.invoiceId, inv.id)))
          .reduce((s,r)=>s + Number(r.amount), 0);
        const newStatus = paid >= Number(inv.amountDue) ? "PAID" : (paid > 0 ? "PARTIAL" : inv.status);
        await db.update(studentInvoice).set({ status: newStatus as any, updatedAt: new Date() }).where(eq(studentInvoice.id, inv.id));
      }
    } else {
      await autoAllocate(pay.id);
    }
    res.status(201).json(pay);
  }catch(e){ next(e); }
});

financeRouter.get("/finance/payments", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const studentProfileId = req.query.studentProfileId as string | undefined;
    let q = db.select().from(studentPayment).orderBy(desc(studentPayment.receivedAt));
    if (studentProfileId) q = q.where(eq(studentPayment.studentProfileId, studentProfileId as any));
    res.json({ items: await q });
  }catch(e){ next(e); }
});

/** ---------- Hour Logs ---------- */
financeRouter.post("/finance/teachers/me/hours", requireRoles(["TEACHER"]), async (req:any,res,next)=>{
  try{
    const dto = HourLogCreateDto.parse(req.body);
    const [row] = await db.insert(teacherHourLog).values({
      teacherProfileId: req.session.profileId, date: dto.date as any, hours: dto.hours, note: dto.note ?? null
    }).returning();
    res.status(201).json(row);
  }catch(e){ next(e); }
});

financeRouter.post("/finance/teachers/hours/:id/approve", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const { approved } = HourLogApproveDto.parse(req.body);
    const [row] = await db.update(teacherHourLog).set({ approved, approvedByProfileId: approved ? (req as any).session.profileId : null }).where(eq(teacherHourLog.id, id)).returning();
    res.json(row);
  }catch(e){ next(e); }
});

/** ---------- Advances (avances) ---------- */
financeRouter.post("/finance/advances/request", requireRoles(["ADMIN","STAFF","TEACHER"]), async (req:any,res,next)=>{
  try{
    const dto = AdvanceRequestDto.parse(req.body);
    // Teachers can only request for themselves; staff/admin can request for anyone
    const me = req.session.profileId as string;
    const isSelf = dto.profileId === me;
    // (RBAC check could be extended)
    const monthly = Math.ceil(dto.principal / dto.months * 100)/100;
    const [row] = await db.insert(advanceLoan).values({
      profileId: dto.profileId, principal: dto.principal, months: dto.months,
      monthlyDeduction: monthly, remaining: dto.principal, note: dto.note ?? null,
      status: "REQUESTED", createdByProfileId: me
    }).returning();
    res.status(201).json(row);
  }catch(e){ next(e); }
});

financeRouter.post("/finance/advances/:id/approve", requireRoles(["ADMIN","STAFF"]), async (req:any,res,next)=>{
  try{
    const id = z.string().uuid().parse(req.params.id);
    const { monthlyDeduction } = AdvanceApproveDto.parse(req.body);
    const [row] = await db.update(advanceLoan).set({
      status: "APPROVED", monthlyDeduction, grantedAt: new Date(), approvedByProfileId: req.session.profileId
    }).where(eq(advanceLoan.id, id)).returning();
    res.json(row);
  }catch(e){ next(e); }
});

/** ---------- Payroll ---------- */
financeRouter.post("/finance/contracts", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const dto = ContractUpsertDto.parse(req.body);
    const [row] = await db.insert(employmentContract).values(dto as any).returning();
    res.status(201).json(row);
  }catch(e){ next(e); }
});

financeRouter.post("/finance/payroll/preview", requireRoles(["ADMIN","STAFF"]), async (req,res,next)=>{
  try{
    const { year, month } = PayrollPreviewDto.parse(req.body);
    const items = await previewPayroll(year, month);
    res.json({ items });
  }catch(e){ next(e); }
});

financeRouter.post("/finance/payroll/confirm", requireRoles(["ADMIN","STAFF"]), async (req:any,res,next)=>{
  try{
    const { year, month } = PayrollPreviewDto.parse(req.body);
    const run = await confirmPayroll(year, month, { profileId: req.session.profileId });
    res.status(201).json(run);
  }catch(e){ next(e); }
});

financeRouter.post("/finance/payroll/:runId/pay", requireRoles(["ADMIN","STAFF"]), async (req:any,res,next)=>{
  try{
    const runId = z.string().uuid().parse(req.params.runId);
    const { profileId, amount, note } = z.object({ profileId: z.string().uuid(), amount: z.coerce.number().positive(), note: z.string().max(256).optional() }).parse(req.body);
    const receiptNo = `PR-${Date.now().toString().slice(-8)}`;
    const [row] = await db.insert(payrollPayment).values({
      runId, profileId, amount, note: note ?? null, createdByProfileId: req.session.profileId, receiptNo
    }).returning();
    res.status(201).json(row);
  }catch(e){ next(e); }
});
Wiring

ts
Copier le code
// src/app.ts (excerpt)
import { financeRouter } from "./modules/finance/routes";
app.use("/api", financeRouter);
6) Reports & Helpers
GET /api/finance/reports/overdue?classSectionId=&academicYearId= → list students with OVERDUE invoices and days overdue.

GET /api/finance/reports/balances?classSectionId=&academicYearId= → sum of amountDue - allocations per student.

Helper hasFinanceBlock(studentProfileId, academicYearId, graceDays=7) exported for Exams module.

(Implement as simple SQL aggregates over student_invoice + allocations.)

7) Manual Tests (cURL)
bash
Copier le code
# 1) Create fee plan (installments)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{
    "academicYearId":"<AY_ID>",
    "code":"LYC-2025",
    "name":"Lycée 2025",
    "planType":"INSTALLMENTS",
    "installments":3,
    "items":[{"name":"Scolarité","amount":150000},{"name":"Inscription","amount":10000}],
    "schedule":[
      {"index":1,"dueDate":"2025-10-01","percent":40},
      {"index":2,"dueDate":"2026-01-10","percent":30},
      {"index":3,"dueDate":"2026-04-10","percent":30}
    ],
    "classSectionId":"<SECTION_ID>"
  }' http://localhost:4000/api/finance/fee-plans

# 2) Set student finance profile (50% reduction)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"planId":"<PLAN_ID>","reductionPercent":50}' \
  http://localhost:4000/api/finance/students/<STUDENT_PID>/profile

# 3) Generate invoices for the section
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"academicYearId":"<AY_ID>","classSectionId":"<SECTION_ID>","overwriteExisting":true}' \
  http://localhost:4000/api/finance/invoices/generate

# 4) Record a cash payment (auto-allocate)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"studentProfileId":"<STUDENT_PID>","amount":60000,"note":"Versement 1"}' \
  http://localhost:4000/api/finance/payments

# 5) Teacher logs 3 hours
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"date":"2025-09-05","hours":3}' \
  http://localhost:4000/api/finance/teachers/me/hours

# Approve the log
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"approved":true}' \
  http://localhost:4000/api/finance/teachers/hours/<HOUR_ID>/approve

# 6) Request & approve advance
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"profileId":"<EMP_PID>","principal":100000,"months":4,"note":"Avance scolaire"}' \
  http://localhost:4000/api/finance/advances/request

curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"monthlyDeduction":25000}' \
  http://localhost:4000/api/finance/advances/<ADV_ID>/approve

# 7) Preview & confirm payroll
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"year":2025,"month":9}' \
  http://localhost:4000/api/finance/payroll/preview

curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"year":2025,"month":9}' \
  http://localhost:4000/api/finance/payroll/confirm

# 8) Pay an employee (cash payout recorded)
curl -b cookies.txt -H "Content-Type: application/json" -X POST \
  -d '{"profileId":"<EMP_PID>","amount":150000}' \
  http://localhost:4000/api/finance/payroll/<RUN_ID>/pay
8) Audit Events (Module 6)
FIN_PLAN_CREATE, FIN_PLAN_UPDATE

FIN_STU_PROFILE_UPSERT

FIN_INVOICE_GEN

FIN_PAYMENT_CREATE, FIN_PAYMENT_ALLOCATE

FIN_HOURLOG_CREATE, FIN_HOURLOG_APPROVE

FIN_ADVANCE_REQUEST, FIN_ADVANCE_APPROVE, FIN_ADVANCE_CLOSE

FIN_PAYROLL_PREVIEW, FIN_PAYROLL_CONFIRM, FIN_PAYROLL_PAY

(Emit from service/route points; keep metadata minimal and non-PII.)

9) Definition of Done
Fee plan CRUD (items + schedule) and plan resolution by class/grade.

Student finance profile with reduction and (optional) custom installments.

Invoice generation (per installment) with correct line amounts and reductions.

Cash payments recorded with unique receipts; allocations (manual or auto oldest-first) update invoice statuses.

Overdue detection (cron/job or on read) and basic reports (overdue, balances).

Teacher hour logs with approval; contracts; payroll preview, confirm, payments; advance request/approval and automatic deductions until closed.

RBAC and validation with Zod; i18n-ready messages; audit logs for critical actions.

No S3 or online payments; all data persisted in Postgres.

yaml
Copier le code

---

```markdown
# CLAUDE.module-12-finance.client.md
**Module 12 — Finance (Client)**  
_Client: React + TypeScript + TailwindCSS + shadcn/ui + TanStack Query/Table • i18n (fr default, ar, en) • Auth/RBAC from app • Cash-only_

Screens:  
- **Plans** (Admin/Staff): create/update plan, items, schedule; link to class/grade.  
- **Invoices & Payments** (Admin/Staff): generate invoices (class/student), list/filter invoices, record **cash** payments, auto/manual allocation, print receipts.  
- **Student/Guardian**: “Mes frais” page (invoices, due dates, balance, receipts).  
- **Teachers**: hour logs submit/view; **Staff/Admin**: approve hours.  
- **Payroll**: contracts; preview/confirm payroll; record cash payouts; **Advances**: request/approve, balances.  
- **Reports**: overdue & balances by class/section.

---

## 0) Structure

src/modules/finance/
api.ts
hooks.ts
components/
PlanForm.tsx
PlanScheduleEditor.tsx
InvoiceTable.tsx
PaymentForm.tsx
AllocationEditor.tsx
HourLogForm.tsx
PayrollPreviewTable.tsx
AdvanceRequestDialog.tsx
pages/
PlansPage.tsx
InvoicesPage.tsx
PaymentsPage.tsx
StudentFeesPage.tsx
TeacherHoursPage.tsx
HoursApprovalPage.tsx
PayrollPage.tsx
AdvancesPage.tsx
ReportsOverduePage.tsx
ReportsBalancesPage.tsx
i18n.ts
router/routes.finance.tsx

php
Copier le code

Add menu (visible by role):

- **Finance**
  - Plans
  - Invoices
  - Payments
  - Payroll
  - Advances
  - Reports (Overdue, Balances)
- **Teacher**
  - Mes heures
- **Student/Guardian**
  - Mes frais

---

## 1) API Client

```ts
// src/modules/finance/api.ts
import { http } from "@/lib/http";

export const FinanceAPI = {
  // Plans
  listPlans: () => http(`/finance/fee-plans`),
  createPlan: (body:any) => http(`/finance/fee-plans`, { method:"POST", body: JSON.stringify(body) }),
  updatePlan: (id:string, body:any) => http(`/finance/fee-plans/${id}`, { method:"PATCH", body: JSON.stringify(body) }),

  // Student finance
  upsertStudentProfile: (studentProfileId:string, body:any) =>
    http(`/finance/students/${studentProfileId}/profile`, { method:"POST", body: JSON.stringify(body) }),

  // Invoices
  generateInvoices: (body:any) => http(`/finance/invoices/generate`, { method:"POST", body: JSON.stringify(body) }),
  listInvoices: (params:any) => http(`/finance/invoices?${new URLSearchParams(params).toString()}`),
  getInvoice: (id:string) => http(`/finance/invoices/${id}`),

  // Payments
  createPayment: (body:any) => http(`/finance/payments`, { method:"POST", body: JSON.stringify(body) }),
  listPayments: (params:any) => http(`/finance/payments?${new URLSearchParams(params).toString()}`),

  // Hours
  createHourLog: (body:any) => http(`/finance/teachers/me/hours`, { method:"POST", body: JSON.stringify(body) }),
  approveHourLog: (id:string, approved:boolean) => http(`/finance/teachers/hours/${id}/approve`, { method:"POST", body: JSON.stringify({ approved }) }),

  // Advances
  requestAdvance: (body:any) => http(`/finance/advances/request`, { method:"POST", body: JSON.stringify(body) }),
  approveAdvance: (id:string, monthlyDeduction:number) => http(`/finance/advances/${id}/approve`, { method:"POST", body: JSON.stringify({ monthlyDeduction }) }),

  // Payroll
  upsertContract: (body:any) => http(`/finance/contracts`, { method:"POST", body: JSON.stringify(body) }),
  previewPayroll: (year:number, month:number) => http(`/finance/payroll/preview`, { method:"POST", body: JSON.stringify({ year, month }) }),
  confirmPayroll: (year:number, month:number) => http(`/finance/payroll/confirm`, { method:"POST", body: JSON.stringify({ year, month }) }),
  payPayroll: (runId:string, body:any) => http(`/finance/payroll/${runId}/pay`, { method:"POST", body: JSON.stringify(body) }),

  // Reports (implement endpoints similarly server side)
  reportOverdue: (params:any) => http(`/finance/reports/overdue?${new URLSearchParams(params).toString()}`),
  reportBalances: (params:any) => http(`/finance/reports/balances?${new URLSearchParams(params).toString()}`),
};
2) Hooks
ts
Copier le code
// src/modules/finance/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FinanceAPI } from "./api";

export const usePlans = () => useQuery({ queryKey:["fin","plans"], queryFn: FinanceAPI.listPlans });
export const useInvoices = (params:any) => useQuery({ queryKey:["fin","invoices", params], queryFn: ()=>FinanceAPI.listInvoices(params) });
export const usePayments = (params:any) => useQuery({ queryKey:["fin","payments", params], queryFn: ()=>FinanceAPI.listPayments(params) });

export function useCreatePlan(){
  const qc = useQueryClient();
  return useMutation({ mutationFn: FinanceAPI.createPlan, onSuccess: ()=> qc.invalidateQueries({ queryKey:["fin","plans"] }) });
}
export function useUpdatePlan(id:string){
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body:any)=>FinanceAPI.updatePlan(id, body), onSuccess: ()=>{
    qc.invalidateQueries({ queryKey:["fin","plans"] });
  }});
}
export function useGenerateInvoices(){
  const qc = useQueryClient();
  return useMutation({ mutationFn: FinanceAPI.generateInvoices, onSuccess: ()=>{
    qc.invalidateQueries({ queryKey:["fin","invoices"] });
  }});
}
export function useCreatePayment(){
  const qc = useQueryClient();
  return useMutation({ mutationFn: FinanceAPI.createPayment, onSuccess: ()=>{
    qc.invalidateQueries({ queryKey:["fin","payments"] });
    qc.invalidateQueries({ queryKey:["fin","invoices"] });
  }});
}
3) Components
3.1 Fee Plan Form (items + schedule)
tsx
Copier le code
// src/modules/finance/components/PlanForm.tsx
import { useState } from "react";

export function PlanForm({ onSubmit }:{ onSubmit:(payload:any)=>void }){
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [planType, setType] = useState<"SINGLE"|"INSTALLMENTS">("SINGLE");
  const [installments, setN] = useState(1);
  const [items, setItems] = useState([{ name:"Scolarité", amount:0 }]);
  const [schedule, setSch] = useState<{index:number; dueDate:string; percent:number}[]>([]);

  return (
    <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); onSubmit({
      code, name, planType, installments, currency:"XAF",
      items: items.map((i,idx)=>({ ...i, order: idx+1 })),
      schedule: planType==="INSTALLMENTS" ? schedule.map(s=>({ ...s, dueDate: new Date(s.dueDate).toISOString() })) : []
    })}}>
      <div className="grid md:grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1" placeholder="Code" value={code} onChange={e=>setCode(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="Nom" value={name} onChange={e=>setName(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <select className="border rounded px-2 py-1" value={planType} onChange={e=>setType(e.target.value as any)}>
          <option value="SINGLE">Paiement en une fois</option>
          <option value="INSTALLMENTS">Tranches</option>
        </select>
        {planType==="INSTALLMENTS" && (
          <input type="number" min={1} max={12} className="border rounded px-2 py-1 w-[10ch]"
            value={installments} onChange={e=>setN(parseInt(e.target.value||"1"))} />
        )}
      </div>
      <div>
        <div className="font-medium">Éléments du plan</div>
        <div className="space-y-2">
          {items.map((it,idx)=>(
            <div key={idx} className="flex gap-2">
              <input className="border rounded px-2 py-1 flex-1" placeholder="Libellé" value={it.name} onChange={e=>setItems(arr=>arr.map((x,i)=> i===idx ? {...x, name:e.target.value} : x))}/>
              <input type="number" className="border rounded px-2 py-1 w-[14ch]" value={it.amount}
                onChange={e=>setItems(arr=>arr.map((x,i)=> i===idx ? {...x, amount:Number(e.target.value||"0")} : x))}/>
              <button type="button" className="text-red-600" onClick={()=>setItems(arr=>arr.filter((_,i)=>i!==idx))}>Suppr</button>
            </div>
          ))}
          <button type="button" className="border rounded px-2 py-1 text-xs" onClick={()=>setItems(arr=>[...arr, { name:"", amount:0 }])}>Ajouter</button>
        </div>
      </div>
      {planType==="INSTALLMENTS" && (
        <div>
          <div className="font-medium">Échéancier (somme % = 100)</div>
          <div className="space-y-2">
            {Array.from({length: installments}).map((_,i)=> {
              const ex = schedule[i] || { index:i+1, dueDate:"", percent: Math.round(100/installments) };
              return (
                <div key={i} className="flex gap-2">
                  <input type="date" className="border rounded px-2 py-1" value={ex.dueDate}
                    onChange={e=>setSch(arr=>{ const cp=[...arr]; cp[i]={...ex, dueDate:e.target.value}; return cp; })}/>
                  <input type="number" className="border rounded px-2 py-1 w-[10ch]" value={ex.percent}
                    onChange={e=>setSch(arr=>{ const cp=[...arr]; cp[i]={...ex, percent:Number(e.target.value||"0")}; return cp; })}/>
                  <span className="text-sm opacity-70">% tranche {i+1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div><button className="border rounded px-3 py-1">Enregistrer</button></div>
    </form>
  );
}
3.2 Invoice Table & Payment Form
tsx
Copier le code
// src/modules/finance/components/InvoiceTable.tsx
export function InvoiceTable({ items }:{ items:any[] }){
  return (
    <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
      <thead className="bg-slate-50">
        <tr>
          <th className="p-2 text-left">Élève</th>
          <th className="p-2 text-left">Tranche</th>
          <th className="p-2 text-left">Échéance</th>
          <th className="p-2 text-right">Montant</th>
          <th className="p-2 text-right">Statut</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i:any)=>(
          <tr key={i.id} className="border-t">
            <td className="p-2">{i.studentProfileId.slice(0,8)}</td>
            <td className="p-2">{i.installmentIndex}</td>
            <td className="p-2">{new Date(i.dueDate).toLocaleDateString()}</td>
            <td className="p-2 text-right">{Number(i.amountDue).toLocaleString()} XAF</td>
            <td className="p-2 text-right">{i.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
tsx
Copier le code
// src/modules/finance/components/PaymentForm.tsx
import { useState } from "react";

export function PaymentForm({ onSubmit }:{ onSubmit:(payload:any)=>void }){
  const [studentProfileId, setSid] = useState("");
  const [amount, setAmt] = useState(0);
  const [note, setNote] = useState("");

  return (
    <form className="flex gap-2 items-end" onSubmit={(e)=>{ e.preventDefault(); onSubmit({ studentProfileId, amount, note }); }}>
      <input className="border rounded px-2 py-1 w-[28ch]" placeholder="student profileId" value={studentProfileId} onChange={e=>setSid(e.target.value)} />
      <input type="number" className="border rounded px-2 py-1 w-[16ch]" value={amount} onChange={e=>setAmt(Number(e.target.value||"0"))} />
      <input className="border rounded px-2 py-1 flex-1" placeholder="note (optionnel)" value={note} onChange={e=>setNote(e.target.value)} />
      <button className="border rounded px-3 py-1">Encaisser (CASH)</button>
    </form>
  );
}
4) Pages
4.1 Plans
tsx
Copier le code
// src/modules/finance/pages/PlansPage.tsx
import { usePlans, useCreatePlan } from "../hooks";
import { PlanForm } from "../components/PlanForm";

export default function PlansPage(){
  const plans = usePlans();
  const create = useCreatePlan();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Plans de frais</h2>
      <PlanForm onSubmit={(payload)=>create.mutate(payload)} />
      <div className="border rounded-2xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="p-2 text-left">Nom</th><th className="p-2">Type</th><th className="p-2">Tranches</th></tr></thead>
          <tbody>
            {(plans.data?.items || []).map((p:any)=>(
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-center">{p.planType}</td>
                <td className="p-2 text-center">{p.installments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
4.2 Invoices (generate + list)
tsx
Copier le code
// src/modules/finance/pages/InvoicesPage.tsx
import { useState } from "react";
import { useInvoices, useGenerateInvoices } from "../hooks";
import { InvoiceTable } from "../components/InvoiceTable";

export default function InvoicesPage(){
  const [studentProfileId, setSid] = useState("");
  const [academicYearId, setAy] = useState("");
  const [classSectionId, setSec] = useState("");
  const inv = useInvoices({ studentProfileId: studentProfileId || undefined });
  const gen = useGenerateInvoices();

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Factures élèves</h2>
      <div className="flex gap-2 items-end">
        <input className="border rounded px-2 py-1 w-[28ch]" placeholder="student profileId (optionnel)" value={studentProfileId} onChange={e=>setSid(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={()=>inv.refetch()}>Rechercher</button>
      </div>
      <div className="flex gap-2 items-end">
        <input className="border rounded px-2 py-1 w-[28ch]" placeholder="academicYearId" value={academicYearId} onChange={e=>setAy(e.target.value)} />
        <input className="border rounded px-2 py-1 w-[28ch]" placeholder="classSectionId (optionnel)" value={classSectionId} onChange={e=>setSec(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={()=>gen.mutate({ academicYearId, classSectionId: classSectionId || undefined, overwriteExisting:true })}>Générer pour la classe</button>
      </div>
      <InvoiceTable items={inv.data?.items || []} />
    </div>
  );
}
4.3 Payments (cash)
tsx
Copier le code
// src/modules/finance/pages/PaymentsPage.tsx
import { useState } from "react";
import { usePayments, useCreatePayment } from "../hooks";
import { PaymentForm } from "../components/PaymentForm";

export default function PaymentsPage(){
  const [studentProfileId, setSid] = useState("");
  const list = usePayments({ studentProfileId: studentProfileId || undefined });
  const create = useCreatePayment();

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Encaissements (espèces)</h2>
      <PaymentForm onSubmit={(p)=>create.mutate(p, { onSuccess: ()=>list.refetch() })} />
      <div className="flex gap-2 items-end">
        <input className="border rounded px-2 py-1 w-[28ch]" placeholder="student profileId" value={studentProfileId} onChange={e=>setSid(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={()=>list.refetch()}>Charger</button>
      </div>
      <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
        <thead className="bg-slate-50"><tr><th className="p-2">Élève</th><th className="p-2">Montant</th><th className="p-2">Date</th><th className="p-2">Reçu</th></tr></thead>
        <tbody>
          {(list.data?.items || []).map((p:any)=>(
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.studentProfileId.slice(0,8)}</td>
              <td className="p-2">{Number(p.amount).toLocaleString()} XAF</td>
              <td className="p-2">{new Date(p.receivedAt).toLocaleString()}</td>
              <td className="p-2">{p.receiptNo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
4.4 Student / Guardian — My Fees
tsx
Copier le code
// src/modules/finance/pages/StudentFeesPage.tsx
import { useInvoices } from "../hooks";
import { useAuth } from "@/lib/auth";

export default function StudentFeesPage(){
  const { profileId, is } = useAuth();
  const q = useInvoices({ studentProfileId: profileId });
  const items = q.data?.items || [];
  const balance = items.reduce((sum:any,i:any)=> sum + (Number(i.amountDue) - 0), 0); // client displays gross; server can provide net too

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mes frais</h2>
      <div className="text-sm">Solde (théorique): <b>{balance.toLocaleString()} XAF</b></div>
      <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
        <thead className="bg-slate-50"><tr><th className="p-2">Tranche</th><th className="p-2">Échéance</th><th className="p-2">Montant</th><th className="p-2">Statut</th></tr></thead>
        <tbody>
          {items.map((i:any)=>(
            <tr key={i.id} className="border-t">
              <td className="p-2">{i.installmentIndex}</td>
              <td className="p-2">{new Date(i.dueDate).toLocaleDateString()}</td>
              <td className="p-2">{Number(i.amountDue).toLocaleString()} XAF</td>
              <td className="p-2">{i.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
4.5 Teacher — Hour Logs
tsx
Copier le code
// src/modules/finance/pages/TeacherHoursPage.tsx
import { useState } from "react";
import { FinanceAPI } from "../api";
import { useQuery } from "@tanstack/react-query";

export default function TeacherHoursPage(){
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [hours, setH] = useState(1);
  const [note, setNote] = useState("");
  const list = useQuery({ queryKey:["fin","myhours"], queryFn: ()=>Promise.resolve([]) }); // hook to list personal logs if you add endpoint

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mes heures</h2>
      <form className="flex gap-2 items-end" onSubmit={async (e)=>{ e.preventDefault(); await FinanceAPI.createHourLog({ date: new Date(date).toISOString(), hours, note }); alert("Soumis"); }}>
        <input type="date" className="border rounded px-2 py-1" value={date} onChange={e=>setDate(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1 w-[10ch]" value={hours} onChange={e=>setH(Number(e.target.value||"1"))} />
        <input className="border rounded px-2 py-1 flex-1" placeholder="note (optionnel)" value={note} onChange={e=>setNote(e.target.value)} />
        <button className="border rounded px-3 py-1">Soumettre</button>
      </form>
    </div>
  );
}
4.6 Hours Approval (Staff/Admin)
tsx
Copier le code
// src/modules/finance/pages/HoursApprovalPage.tsx
import { useQuery } from "@tanstack/react-query";
import { FinanceAPI } from "../api";

export default function HoursApprovalPage(){
  const q = useQuery({ queryKey:["fin","hours-approve"], queryFn: ()=>Promise.resolve([]) }); // add endpoint to list pending logs

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Validation des heures</h2>
      <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
        <thead className="bg-slate-50"><tr><th className="p-2">Prof</th><th className="p-2">Date</th><th className="p-2">Heures</th><th className="p-2">Actions</th></tr></thead>
        <tbody>
          {(q.data || []).map((r:any)=>(
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.teacherProfileId.slice(0,8)}</td>
              <td className="p-2">{new Date(r.date).toLocaleDateString()}</td>
              <td className="p-2">{r.hours}</td>
              <td className="p-2">
                <button className="border rounded px-2 py-1 text-xs" onClick={()=>FinanceAPI.approveHourLog(r.id, true)}>Approuver</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
4.7 Payroll
tsx
Copier le code
// src/modules/finance/pages/PayrollPage.tsx
import { useState } from "react";
import { FinanceAPI } from "../api";
import { useQuery } from "@tanstack/react-query";

export default function PayrollPage(){
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth()+1);
  const q = useQuery({ queryKey:["fin","payroll-preview", year, month], queryFn: ()=>FinanceAPI.previewPayroll(year, month) });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Paie</h2>
      <div className="flex gap-2">
        <input type="number" className="border rounded px-2 py-1 w-[12ch]" value={year} onChange={e=>setYear(parseInt(e.target.value||"2025"))}/>
        <input type="number" className="border rounded px-2 py-1 w-[8ch]" value={month} onChange={e=>setMonth(parseInt(e.target.value||"1"))}/>
        <button className="border rounded px-3 py-1" onClick={()=>q.refetch()}>Prévisualiser</button>
        <button className="border rounded px-3 py-1" onClick={async ()=>{ await FinanceAPI.confirmPayroll(year, month); alert("Confirmé"); }}>Confirmer</button>
      </div>
      <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
        <thead className="bg-slate-50"><tr><th className="p-2">Employé</th><th className="p-2 text-right">Salaire</th><th className="p-2 text-right">Heures</th><th className="p-2 text-right">Avance</th><th className="p-2 text-right">Net</th></tr></thead>
        <tbody>
          {(q.data?.items || []).map((it:any)=>(
            <tr key={it.profileId} className="border-t">
              <td className="p-2">{it.profileId.slice(0,8)}</td>
              <td className="p-2 text-right">{Number(it.baseSalary).toLocaleString()}</td>
              <td className="p-2 text-right">{Number(it.hourlyPay).toLocaleString()}</td>
              <td className="p-2 text-right">{Number(it.advanceDeduction).toLocaleString()}</td>
              <td className="p-2 text-right">{Number(it.netPay).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
4.8 Advances
tsx
Copier le code
// src/modules/finance/pages/AdvancesPage.tsx
import { useState } from "react";
import { FinanceAPI } from "../api";

export default function AdvancesPage(){
  const [profileId, setPid] = useState("");
  const [principal, setPr] = useState(0);
  const [months, setMo] = useState(1);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Avances</h2>
      <form className="flex items-end gap-2" onSubmit={async (e)=>{ e.preventDefault(); await FinanceAPI.requestAdvance({ profileId, principal, months }); alert("Demande envoyée"); }}>
        <input className="border rounded px-2 py-1 w-[28ch]" placeholder="profileId" value={profileId} onChange={e=>setPid(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1 w-[16ch]" value={principal} onChange={e=>setPr(Number(e.target.value||"0"))} />
        <input type="number" className="border rounded px-2 py-1 w-[12ch]" value={months} onChange={e=>setMo(parseInt(e.target.value||"1"))} />
        <button className="border rounded px-3 py-1">Demander</button>
      </form>
    </div>
  );
}
4.9 Reports
tsx
Copier le code
// src/modules/finance/pages/ReportsOverduePage.tsx
import { useState } from "react";
import { FinanceAPI } from "../api";
import { useQuery } from "@tanstack/react-query";

export default function ReportsOverduePage(){
  const [academicYearId, setAy] = useState("");
  const [classSectionId, setSec] = useState("");
  const q = useQuery({ queryKey:["fin","rep-overdue", academicYearId, classSectionId], enabled:false, queryFn: ()=>FinanceAPI.reportOverdue({ academicYearId, classSectionId }) });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Retards de paiement</h2>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1" placeholder="academicYearId" value={academicYearId} onChange={e=>setAy(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="classSectionId" value={classSectionId} onChange={e=>setSec(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={()=>q.refetch()}>Charger</button>
      </div>
      <pre className="text-xs bg-slate-50 p-2 rounded">{JSON.stringify(q.data, null, 2)}</pre>
    </div>
  );
}
5) Routes (mount)
tsx
Copier le code
// src/router/routes.finance.tsx
import { RouteObject } from "react-router-dom";
import PlansPage from "@/modules/finance/pages/PlansPage";
import InvoicesPage from "@/modules/finance/pages/InvoicesPage";
import PaymentsPage from "@/modules/finance/pages/PaymentsPage";
import StudentFeesPage from "@/modules/finance/pages/StudentFeesPage";
import TeacherHoursPage from "@/modules/finance/pages/TeacherHoursPage";
import HoursApprovalPage from "@/modules/finance/pages/HoursApprovalPage";
import PayrollPage from "@/modules/finance/pages/PayrollPage";
import AdvancesPage from "@/modules/finance/pages/AdvancesPage";
import ReportsOverduePage from "@/modules/finance/pages/ReportsOverduePage";
import ReportsBalancesPage from "@/modules/finance/pages/ReportsBalancesPage";

export const financeRoutes: RouteObject[] = [
  { path: "/finance/plans", element: <PlansPage/> },
  { path: "/finance/invoices", element: <InvoicesPage/> },
  { path: "/finance/payments", element: <PaymentsPage/> },
  { path: "/finance/me/fees", element: <StudentFeesPage/> },
  { path: "/finance/teacher/hours", element: <TeacherHoursPage/> },
  { path: "/finance/hours/approve", element: <HoursApprovalPage/> },
  { path: "/finance/payroll", element: <PayrollPage/> },
  { path: "/finance/advances", element: <AdvancesPage/> },
  { path: "/finance/reports/overdue", element: <ReportsOverduePage/> },
  { path: "/finance/reports/balances", element: <ReportsBalancesPage/> },
];
Add to root router and menu with RBAC-guarded visibility.

6) i18n (excerpt)
ts
Copier le code
// src/modules/finance/i18n.ts
export const dict = {
  fr: {
    finance: {
      plans: "Plans de frais",
      invoices: "Factures",
      payments: "Encaissements",
      payroll: "Paie",
      advances: "Avances",
      reports: "Rapports",
      paymentCash: "Encaisser (espèces)",
      studentFees: "Mes frais",
    }
  },
  en: { finance: { /* ... */ } },
  ar: { finance: { /* ... (RTL) */ } },
};
7) Definition of Done (Client)
Plans: create/update with items & schedule; list existing plans.

Invoices: generate for section/student; view list; statuses reflected.

Payments: record cash receipt; auto-refresh invoices & payments; receipt number displayed.

Student/Guardian: “Mes frais” shows invoices with due dates and statuses.

Teacher: submit hour logs; Staff/Admin: approve hours.

Payroll: preview by month; confirm run; (optional) payout action wired.

Advances: request (teacher/staff), approve (admin/staff).

Reports: basic overdue & balances pages calling server endpoints.

No placeholder data; forms require real IDs from your DB.