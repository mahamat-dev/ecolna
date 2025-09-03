import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client';
import { requireAuth, requireStaffOrAdmin } from '../../middlewares/rbac';
import { writeAudit, actorFromReq } from '../admin-utils/audit.service';
import {
  feeSchedule, studentFee, invoice, invoiceLine, payment, advance, payrollPeriod, payrollItem, profiles
} from '../../db/schema';
import {
  CreateFeeScheduleDto, AssignStudentFeeDto, CreateInvoiceDto, VoidInvoiceDto, CreatePaymentDto,
  RequestAdvanceDto, ApproveAdvanceDto, PayAdvanceDto, RepayAdvanceDto,
  CreatePayrollPeriodDto, AddPayrollItemDto
} from './dto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export const financeRouter = Router();
financeRouter.use(requireAuth);

function viewer(req: any) {
  return { userId: req.session?.user?.id as string, profileId: req.session?.profileId as string };
}

// Fees: schedules
financeRouter.post('/finance/fees/schedules', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const dto = CreateFeeScheduleDto.parse(req.body);
    const [row] = await db.insert(feeSchedule).values({
      code: dto.code, name: dto.name, description: dto.description ?? null, amountCents: dto.amountCents,
      currency: dto.currency, academicYearId: dto.academicYearId ?? null, gradeLevelId: dto.gradeLevelId ?? null,
    }).returning();
    const actor = actorFromReq(req);
    await writeAudit(db, { action: 'FIN_FEE_SCHEDULE_CREATE', entityType: 'fee_schedule', entityId: row.id, summary: dto.code, actorUserId: actor.userId, actorRoles: actor.roles, ip: actor.ip });
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/fees/schedules', requireStaffOrAdmin, async (_req, res, next) => {
  try {
    const rows = await db.select().from(feeSchedule).orderBy(desc(feeSchedule.createdAt));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// Assign fee to student
financeRouter.post('/finance/fees/assignments', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const dto = AssignStudentFeeDto.parse(req.body);
    const [sch] = await db.select().from(feeSchedule).where(eq(feeSchedule.id, dto.scheduleId));
    if (!sch) return res.status(404).json({ error: { message: 'Schedule not found' } });
    const [row] = await db.insert(studentFee).values({
      studentProfileId: dto.studentProfileId, scheduleId: dto.scheduleId,
      amountCents: dto.amountCents ?? sch.amountCents, discountCents: dto.discountCents ?? 0,
      dueDate: dto.dueDate ?? null,
    }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/fees/student/:profileId', async (req, res, next) => {
  try {
    const profileId = z.string().uuid().parse(req.params.profileId);
    const { profileId: myPid } = viewer(req);
    const roles = (req.session?.user?.roles as string[]) || [];
    if (!(roles.includes('ADMIN') || roles.includes('STAFF')) && myPid !== profileId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }
    const rows = await db.select().from(studentFee).where(eq(studentFee.studentProfileId, profileId));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

// Invoices
financeRouter.post('/finance/invoices', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const dto = CreateInvoiceDto.parse(req.body);
    const { profileId } = viewer(req);
    const total = dto.lines.reduce((s, l) => s + (l.amountCents || 0), 0);
    const [inv] = await db.insert(invoice).values({
      studentProfileId: dto.studentProfileId, totalCents: total, currency: dto.currency,
      status: 'ISSUED', issuedAt: new Date(), dueDate: dto.dueDate ?? null, createdByProfileId: profileId,
    }).returning();
    await db.insert(invoiceLine).values(dto.lines.map(l => ({ invoiceId: inv.id, description: l.description, amountCents: l.amountCents, scheduleId: l.scheduleId ?? null })));
    res.status(201).json(inv);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/invoices', async (req, res, next) => {
  try {
    const studentProfileId = req.query.studentProfileId as string | undefined;
    const roles = (req.session?.user?.roles as string[]) || [];
    const { profileId } = viewer(req);
    let rows = [] as any[];
    if (studentProfileId) {
      if (!(roles.includes('ADMIN') || roles.includes('STAFF')) && profileId !== studentProfileId) {
        return res.status(403).json({ error: { message: 'Forbidden' } });
      }
      rows = await db.select().from(invoice).where(eq(invoice.studentProfileId, studentProfileId as any)).orderBy(desc(invoice.createdAt));
    } else if (roles.includes('ADMIN') || roles.includes('STAFF')) {
      rows = await db.select().from(invoice).orderBy(desc(invoice.createdAt));
    } else {
      rows = await db.select().from(invoice).where(eq(invoice.studentProfileId, profileId as any)).orderBy(desc(invoice.createdAt));
    }
    // Enrich with student names
    const pids = Array.from(new Set(rows.map(r => r.studentProfileId).filter(Boolean) as string[]));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    res.json({ items: rows.map(r => ({ ...r, studentName: nameMap.get(r.studentProfileId as string) ?? '' })) });
  } catch (e) { next(e); }
});

financeRouter.get('/finance/invoices/:id', async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const [inv] = await db.select().from(invoice).where(eq(invoice.id, id));
    if (!inv) return res.status(404).json({ error: { message: 'Not found' } });
    const { profileId } = viewer(req);
    const roles = (req.session?.user?.roles as string[]) || [];
    if (!(roles.includes('ADMIN') || roles.includes('STAFF')) && inv.studentProfileId !== profileId) {
      return res.status(403).json({ error: { message: 'Forbidden' } });
    }
    const lines = await db.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, id));
    const pays = await db.select().from(payment).where(eq(payment.invoiceId, id));
    const paid = pays.reduce((s, p) => s + (p.amountCents || 0), 0);
    // Name
    const [nm] = await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(eq(profiles.id, inv.studentProfileId));
    const studentName = nm ? `${nm.firstName ?? ''} ${nm.lastName ?? ''}`.trim() : '';
    res.json({ invoice: { ...inv, studentName }, lines, payments: pays, paidCents: paid });
  } catch (e) { next(e); }
});

financeRouter.post('/finance/invoices/:id/void', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const _dto = VoidInvoiceDto.parse(req.body || {});
    const [row] = await db.update(invoice).set({ status: 'VOID' }).where(eq(invoice.id, id)).returning();
    res.json(row);
  } catch (e) { next(e); }
});

// Payments
financeRouter.post('/finance/payments', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const dto = CreatePaymentDto.parse(req.body);
    const { profileId } = viewer(req);
    const [row] = await db.insert(payment).values({
      invoiceId: dto.invoiceId ?? null, studentProfileId: dto.studentProfileId ?? null, amountCents: dto.amountCents,
      method: dto.method, reference: dto.reference ?? null, receivedAt: dto.receivedAt ?? new Date(), createdByProfileId: profileId,
    }).returning();
    if (dto.invoiceId) {
      const [inv] = await db.select().from(invoice).where(eq(invoice.id, dto.invoiceId));
      const pays = await db.select().from(payment).where(eq(payment.invoiceId, dto.invoiceId));
      const paid = pays.reduce((s, p) => s + (p.amountCents || 0), 0);
      const newStatus = paid >= (inv?.totalCents || 0) ? 'PAID' : 'PARTIAL';
      await db.update(invoice).set({ status: newStatus }).where(eq(invoice.id, dto.invoiceId));
    }
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/payments', async (req, res, next) => {
  try {
    const studentProfileId = req.query.studentProfileId as string | undefined;
    const roles = (req.session?.user?.roles as string[]) || [];
    const { profileId } = viewer(req);
    let rows: any[] = [];
    if (studentProfileId) {
      if (!(roles.includes('ADMIN') || roles.includes('STAFF')) && profileId !== studentProfileId) return res.status(403).json({ error: { message: 'Forbidden' } });
      rows = await db.select().from(payment).where(eq(payment.studentProfileId, studentProfileId as any)).orderBy(desc(payment.receivedAt));
    } else if (roles.includes('ADMIN') || roles.includes('STAFF')) {
      rows = await db.select().from(payment).orderBy(desc(payment.receivedAt));
    } else {
      rows = await db.select().from(payment).where(eq(payment.studentProfileId, profileId as any)).orderBy(desc(payment.receivedAt));
    }
    const pids = Array.from(new Set(rows.map(r => r.studentProfileId).filter(Boolean) as string[]));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName })
      .from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    res.json({ items: rows.map(r => ({ ...r, studentName: r.studentProfileId ? (nameMap.get(r.studentProfileId as string) ?? '') : '' })) });
  } catch (e) { next(e); }
});

// Create invoice from student fee assignments
financeRouter.post('/finance/invoices/from-assignments', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const body = z.object({ studentProfileId: z.string().uuid(), feeIds: z.array(z.string().uuid()).optional() }).parse(req.body);
    const { profileId } = viewer(req);
    let fees = [] as any[];
    if (body.feeIds && body.feeIds.length) {
      fees = await db.select().from(studentFee).where(inArray(studentFee.id, body.feeIds as any));
    } else {
      // default: all pending/overdue for student
      fees = await db.select().from(studentFee).where(eq(studentFee.studentProfileId, body.studentProfileId as any));
      fees = fees.filter(f => (f.status === 'PENDING' || f.status === 'OVERDUE'));
    }
    if (!fees.length) return res.status(400).json({ error: { message: 'No eligible fee assignments' } });
    // gather schedules for descriptions
    const sids = Array.from(new Set(fees.map(f => f.scheduleId)));
    const schs = sids.length ? await db.select().from(feeSchedule).where(inArray(feeSchedule.id, sids as any)) : [];
    const schMap = new Map(schs.map(s => [s.id, s] as const));
    const currency = schs[0]?.currency || 'XAF';
    const lines = fees.map(f => ({ description: `Frais: ${schMap.get(f.scheduleId!)?.code || 'SANS'}`, amountCents: Math.max(0, (f.amountCents || 0) - (f.discountCents || 0)), scheduleId: f.scheduleId }));
    const total = lines.reduce((s, l) => s + (l.amountCents || 0), 0);
    const [inv] = await db.insert(invoice).values({ studentProfileId: body.studentProfileId, totalCents: total, currency, status: 'ISSUED', issuedAt: new Date(), createdByProfileId: profileId }).returning();
    await db.insert(invoiceLine).values(lines.map(l => ({ invoiceId: inv.id, description: l.description, amountCents: l.amountCents, scheduleId: l.scheduleId ?? null })));
    res.status(201).json(inv);
  } catch (e) { next(e); }
});

// CSV exports
financeRouter.get('/finance/invoices.csv', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const studentProfileId = req.query.studentProfileId as string | undefined;
    let rows = [] as any[];
    if (studentProfileId) rows = await db.select().from(invoice).where(eq(invoice.studentProfileId, studentProfileId as any));
    else rows = await db.select().from(invoice);
    const pids = Array.from(new Set(rows.map(r => r.studentProfileId)));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    const header = ['id','student_profile_id','student_name','issued_at','total_cents','currency','status'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = [r.id, r.studentProfileId, nameMap.get(r.studentProfileId as string) ?? '', r.issuedAt ? new Date(r.issuedAt).toISOString() : '', String(r.totalCents||0), r.currency, r.status]
        .map(v => (typeof v === 'string' && v.includes(',') ? '"'+v.replace(/"/g,'""')+'"' : String(v||''))).join(',');
      lines.push(line);
    }
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="invoices.csv"');
    res.send(lines.join('\n'));
  } catch (e) { next(e); }
});

financeRouter.get('/finance/payments.csv', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const studentProfileId = req.query.studentProfileId as string | undefined;
    let rows = [] as any[];
    if (studentProfileId) rows = await db.select().from(payment).where(eq(payment.studentProfileId, studentProfileId as any));
    else rows = await db.select().from(payment);
    const pids = Array.from(new Set(rows.map(r => r.studentProfileId).filter(Boolean) as string[]));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    const header = ['id','student_profile_id','student_name','invoice_id','amount_cents','method','reference','received_at'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = [r.id, r.studentProfileId ?? '', r.studentProfileId ? (nameMap.get(r.studentProfileId as string) ?? '') : '', r.invoiceId ?? '', String(r.amountCents||0), r.method, r.reference ?? '', r.receivedAt ? new Date(r.receivedAt).toISOString() : '']
        .map(v => (typeof v === 'string' && v.includes(',') ? '"'+v.replace(/"/g,'""')+'"' : String(v||''))).join(',');
      lines.push(line);
    }
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="payments.csv"');
    res.send(lines.join('\n'));
  } catch (e) { next(e); }
});

financeRouter.get('/finance/payroll/periods/:id/items.csv', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const periodId = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(payrollItem).where(eq(payrollItem.periodId, periodId));
    const pids = Array.from(new Set(rows.map(r => r.staffProfileId)));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    const header = ['id','staff_profile_id','staff_name','gross_cents','allowances_cents','deductions_cents','net_cents','status'];
    const lines = [header.join(',')];
    for (const r of rows) {
      const line = [r.id, r.staffProfileId, nameMap.get(r.staffProfileId as string) ?? '', String(r.grossCents), String(r.allowancesCents), String(r.deductionsCents), String(r.netCents), r.status]
        .map(v => (typeof v === 'string' && v.includes(',') ? '"'+v.replace(/"/g,'""')+'"' : String(v||''))).join(',');
      lines.push(line);
    }
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll_${periodId}.csv"`);
    res.send(lines.join('\n'));
  } catch (e) { next(e); }
});

// Advances
financeRouter.post('/finance/advances', async (req, res, next) => {
  try {
    const dto = RequestAdvanceDto.parse(req.body);
    const { profileId } = viewer(req);
    const [row] = await db.insert(advance).values({ requesterProfileId: profileId, amountCents: dto.amountCents, reason: dto.reason ?? null }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/advances', async (req, res, next) => {
  try {
    const roles = (req.session?.user?.roles as string[]) || [];
    const { profileId } = viewer(req);
    let rows: any[] = [];
    if (roles.includes('ADMIN') || roles.includes('STAFF')) rows = await db.select().from(advance).orderBy(desc(advance.requestedAt));
    else rows = await db.select().from(advance).where(eq(advance.requesterProfileId, profileId as any)).orderBy(desc(advance.requestedAt));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

financeRouter.post('/finance/advances/:id/approve', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = ApproveAdvanceDto.parse(req.body);
    const { profileId } = viewer(req);
    const [row] = await db.update(advance).set({ status: dto.approve ? 'APPROVED' : 'REJECTED', approvedByProfileId: profileId, approvedAt: new Date() }).where(eq(advance.id, id)).returning();
    res.json(row);
  } catch (e) { next(e); }
});

financeRouter.post('/finance/advances/:id/pay', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const _dto = PayAdvanceDto.parse(req.body || {});
    const [row] = await db.update(advance).set({ status: 'PAID' }).where(eq(advance.id, id)).returning();
    res.json(row);
  } catch (e) { next(e); }
});

financeRouter.post('/finance/advances/:id/repay', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const dto = RepayAdvanceDto.parse(req.body);
    const [cur] = await db.select().from(advance).where(eq(advance.id, id));
    if (!cur) return res.status(404).json({ error: { message: 'Not found' } });
    const repaid = (cur.repaidCents || 0) + dto.amountCents;
    const status = repaid >= (cur.amountCents || 0) ? 'SETTLED' : cur.status;
    const [row] = await db.update(advance).set({ repaidCents: repaid, status }).where(eq(advance.id, id)).returning();
    res.json(row);
  } catch (e) { next(e); }
});

// Payroll
financeRouter.post('/finance/payroll/periods', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const dto = CreatePayrollPeriodDto.parse(req.body);
    const [row] = await db.insert(payrollPeriod).values({ code: dto.code, startDate: dto.startDate, endDate: dto.endDate, payDate: dto.payDate }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/payroll/periods', requireStaffOrAdmin, async (_req, res, next) => {
  try {
    const rows = await db.select().from(payrollPeriod).orderBy(desc(payrollPeriod.createdAt));
    res.json({ items: rows });
  } catch (e) { next(e); }
});

financeRouter.post('/finance/payroll/periods/:id/items', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const periodId = z.string().uuid().parse(req.params.id);
    const dto = AddPayrollItemDto.parse(req.body);
    const net = (dto.grossCents || 0) + (dto.allowancesCents || 0) - (dto.deductionsCents || 0);
    const [row] = await db.insert(payrollItem).values({ periodId, staffProfileId: dto.staffProfileId, grossCents: dto.grossCents, allowancesCents: dto.allowancesCents, deductionsCents: dto.deductionsCents, netCents: net }).returning();
    res.status(201).json(row);
  } catch (e) { next(e); }
});

financeRouter.get('/finance/payroll/periods/:id/items', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const periodId = z.string().uuid().parse(req.params.id);
    const rows = await db.select().from(payrollItem).where(eq(payrollItem.periodId, periodId));
    // Enrich names
    const pids = Array.from(new Set(rows.map(r => r.staffProfileId)));
    const names = pids.length ? await db.select({ id: profiles.id, firstName: profiles.firstName, lastName: profiles.lastName }).from(profiles).where(inArray(profiles.id, pids as any)) : [];
    const nameMap = new Map(names.map(n => [n.id, `${n.firstName ?? ''} ${n.lastName ?? ''}`.trim()] as const));
    res.json({ items: rows.map(r => ({ ...r, staffName: nameMap.get(r.staffProfileId) ?? '' })) });
  } catch (e) { next(e); }
});

financeRouter.post('/finance/payroll/items/:id/status', requireStaffOrAdmin, async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = z.object({ status: z.enum(['DRAFT','APPROVED','PAID']) }).parse(req.body);
    const [row] = await db.update(payrollItem).set({ status: body.status }).where(eq(payrollItem.id, id)).returning();
    res.json(row);
  } catch (e) { next(e); }
});

// Staff: my payslips
financeRouter.get('/finance/payroll/my-payslips', async (req, res, next) => {
  try {
    const roles = (req.session?.user?.roles as string[]) || [];
    const { profileId } = viewer(req);
    if (!(roles.includes('STAFF') || roles.includes('TEACHER') || roles.includes('ADMIN'))) return res.status(403).json({ error: { message: 'Forbidden' } });
    const rows = await db.select().from(payrollItem).where(eq(payrollItem.staffProfileId, profileId as any)).orderBy(desc(payrollItem.periodId));
    res.json({ items: rows });
  } catch (e) { next(e); }
});
