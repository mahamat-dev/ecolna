import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FinanceAPI, type UUID } from './api';

export function useFeeSchedules(){ return useQuery({ queryKey: ['fin','fees','schedules'], queryFn: FinanceAPI.listFeeSchedules }); }
export function useCreateFeeSchedule(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.createFeeSchedule, onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','fees','schedules'] }) }); }
export function useAssignFee(){ return useMutation({ mutationFn: FinanceAPI.assignFee }); }
export function useStudentFees(profileId?: UUID){ return useQuery({ queryKey: ['fin','fees','student',profileId], queryFn: ()=> FinanceAPI.listStudentFees(profileId!), enabled: !!profileId }); }

export function useInvoices(studentProfileId?: UUID){ return useQuery({ queryKey: ['fin','invoices', studentProfileId], queryFn: ()=> FinanceAPI.listInvoices(studentProfileId) }); }
export function useInvoice(id?: UUID){ return useQuery({ queryKey: ['fin','invoice',id], queryFn: ()=> FinanceAPI.getInvoice(id!), enabled: !!id }); }
export function useCreateInvoice(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.createInvoice, onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','invoices'] }) }); }
export function useVoidInvoice(){ const qc=useQueryClient(); return useMutation({ mutationFn: (vars:{id:UUID; reason?:string})=> FinanceAPI.voidInvoice(vars.id, vars.reason), onSuccess: (_,vars)=>{ qc.invalidateQueries({ queryKey:['fin','invoice',vars.id] }); qc.invalidateQueries({ queryKey:['fin','invoices'] }); } }); }
export function useCreateInvoiceFromAssignments(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.createInvoiceFromAssignments, onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','invoices'] }) }); }

export function usePayments(studentProfileId?: UUID){ return useQuery({ queryKey: ['fin','payments', studentProfileId], queryFn: ()=> FinanceAPI.listPayments(studentProfileId) }); }
export function useCreatePayment(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.createPayment, onSuccess: ()=> { qc.invalidateQueries({ queryKey:['fin','payments'] }); qc.invalidateQueries({ queryKey:['fin','invoices'] }); } }); }

export function useAdvances(){ return useQuery({ queryKey: ['fin','advances'], queryFn: FinanceAPI.listAdvances }); }
export function useRequestAdvance(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.requestAdvance, onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','advances'] }) }); }
export function useApproveAdvance(){ const qc=useQueryClient(); return useMutation({ mutationFn: (vars:{id:UUID; approve:boolean; comment?:string})=> FinanceAPI.approveAdvance(vars.id, vars.approve, vars.comment), onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','advances'] }) }); }
export function usePayAdvance(){ const qc=useQueryClient(); return useMutation({ mutationFn: (id:UUID)=> FinanceAPI.payAdvance(id), onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','advances'] }) }); }
export function useRepayAdvance(){ const qc=useQueryClient(); return useMutation({ mutationFn: (vars:{id:UUID; amountCents:number})=> FinanceAPI.repayAdvance(vars.id, vars.amountCents), onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','advances'] }) }); }

export function usePayrollPeriods(){ return useQuery({ queryKey: ['fin','payroll','periods'], queryFn: FinanceAPI.listPayrollPeriods }); }
export function useCreatePayrollPeriod(){ const qc=useQueryClient(); return useMutation({ mutationFn: FinanceAPI.createPayrollPeriod, onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','payroll','periods'] }) }); }
export function usePayrollItems(periodId?: UUID){ return useQuery({ queryKey: ['fin','payroll','items', periodId], queryFn: ()=> FinanceAPI.listPayrollItems(periodId!), enabled: !!periodId }); }
export function useAddPayrollItem(periodId: UUID){ const qc=useQueryClient(); return useMutation({ mutationFn: (body:{ staffProfileId: UUID; grossCents: number; allowancesCents?: number; deductionsCents?: number })=> FinanceAPI.addPayrollItem(periodId, body), onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','payroll','items', periodId] }) }); }
export function useSetPayrollItemStatus(){ const qc=useQueryClient(); return useMutation({ mutationFn: (vars:{id:UUID; status:'DRAFT'|'APPROVED'|'PAID'})=> FinanceAPI.setPayrollItemStatus(vars.id, vars.status), onSuccess: ()=> qc.invalidateQueries({ queryKey:['fin','payroll'] }) }); }
export function useMyPayslips(){ return useQuery({ queryKey: ['fin','payroll','my'], queryFn: FinanceAPI.myPayslips }); }
