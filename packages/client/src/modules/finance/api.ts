import { http } from '@/lib/http';

export type UUID = string;

export const FinanceAPI = {
  // Fees
  listFeeSchedules: () => http<{ items: any[] }>(`/finance/fees/schedules`),
  createFeeSchedule: (body: { code: string; name: string; description?: string; amountCents: number; currency?: string; academicYearId?: UUID|null; gradeLevelId?: UUID|null }) =>
    http(`/finance/fees/schedules`, { method: 'POST', body: JSON.stringify(body) }),
  assignFee: (body: { studentProfileId: UUID; scheduleId: UUID; amountCents?: number; discountCents?: number; dueDate?: string }) =>
    http(`/finance/fees/assignments`, { method: 'POST', body: JSON.stringify(body) }),
  listStudentFees: (profileId: UUID) => http<{ items: any[] }>(`/finance/fees/student/${profileId}`),

  // Invoices
  listInvoices: (studentProfileId?: UUID) => http<{ items: any[] }>(`/finance/invoices${studentProfileId ? `?studentProfileId=${studentProfileId}` : ''}`),
  createInvoice: (body: { studentProfileId: UUID; currency?: string; dueDate?: string; lines: { description: string; amountCents: number; scheduleId?: UUID }[] }) =>
    http(`/finance/invoices`, { method: 'POST', body: JSON.stringify(body) }),
  getInvoice: (id: UUID) => http<{ invoice: any; lines: any[]; payments: any[]; paidCents: number }>(`/finance/invoices/${id}`),
  voidInvoice: (id: UUID, reason?: string) => http(`/finance/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  createInvoiceFromAssignments: (body: { studentProfileId: UUID; feeIds?: UUID[] }) =>
    http(`/finance/invoices/from-assignments`, { method: 'POST', body: JSON.stringify(body) }),

  // Payments
  listPayments: (studentProfileId?: UUID) => http<{ items: any[] }>(`/finance/payments${studentProfileId ? `?studentProfileId=${studentProfileId}` : ''}`),
  createPayment: (body: { invoiceId?: UUID; studentProfileId?: UUID; amountCents: number; method?: 'CASH'|'BANK'|'MOBILE'; reference?: string; receivedAt?: string }) =>
    http(`/finance/payments`, { method: 'POST', body: JSON.stringify(body) }),

  // Advances
  listAdvances: () => http<{ items: any[] }>(`/finance/advances`),
  requestAdvance: (body: { amountCents: number; reason?: string }) => http(`/finance/advances`, { method: 'POST', body: JSON.stringify(body) }),
  approveAdvance: (id: UUID, approve: boolean, comment?: string) => http(`/finance/advances/${id}/approve`, { method: 'POST', body: JSON.stringify({ approve, comment }) }),
  payAdvance: (id: UUID) => http(`/finance/advances/${id}/pay`, { method: 'POST', body: JSON.stringify({ pay: true }) }),
  repayAdvance: (id: UUID, amountCents: number) => http(`/finance/advances/${id}/repay`, { method: 'POST', body: JSON.stringify({ amountCents }) }),

  // Payroll
  listPayrollPeriods: () => http<{ items: any[] }>(`/finance/payroll/periods`),
  createPayrollPeriod: (body: { code: string; startDate: string; endDate: string; payDate: string }) => http(`/finance/payroll/periods`, { method: 'POST', body: JSON.stringify(body) }),
  addPayrollItem: (periodId: UUID, body: { staffProfileId: UUID; grossCents: number; allowancesCents?: number; deductionsCents?: number }) =>
    http(`/finance/payroll/periods/${periodId}/items`, { method: 'POST', body: JSON.stringify(body) }),
  listPayrollItems: (periodId: UUID) => http<{ items: any[] }>(`/finance/payroll/periods/${periodId}/items`),
  setPayrollItemStatus: (id: UUID, status: 'DRAFT'|'APPROVED'|'PAID') => http(`/finance/payroll/items/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
  myPayslips: () => http<{ items: any[] }>(`/finance/payroll/my-payslips`),
};
