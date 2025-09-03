import { useCreatePayment, usePayments } from '../hooks';
import { API_URL } from '@/lib/env';
import { useState } from 'react';

export default function PaymentsPage(){
  const { data, isLoading, isError, refetch } = usePayments();
  const create = useCreatePayment();
  const [invoiceId, setInvoiceId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH'|'BANK'|'MOBILE'>('CASH');
  const [reference, setReference] = useState('');
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Paiements</h1>
        <a href={`${API_URL}/finance/payments.csv`} target="_blank" rel="noreferrer" className="border rounded px-3 py-1">Export CSV</a>
      </div>
      <div className="grid md:grid-cols-5 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="invoiceId (optionnel)" value={invoiceId} onChange={e=>setInvoiceId(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="student profileId (si sans facture)" value={studentId} onChange={e=>setStudentId(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Montant (cents)" value={amount} onChange={e=>setAmount(e.target.value)} />
        <select className="border rounded px-2 py-1" value={method} onChange={e=>setMethod(e.target.value as any)}>
          <option value="CASH">CASH</option>
          <option value="BANK">BANK</option>
          <option value="MOBILE">MOBILE</option>
        </select>
        <button className="border rounded px-3 py-1" onClick={async ()=>{ await create.mutateAsync({ invoiceId: invoiceId || undefined, studentProfileId: studentId || undefined, amountCents: Number(amount||'0'), method, reference }); await refetch(); setInvoiceId(''); setStudentId(''); setAmount(''); setReference(''); }}>Enregistrer</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Date</th><th className="border px-3 py-2 text-left">Élève</th><th className="border px-3 py-2 text-left">Facture</th><th className="border px-3 py-2 text-left">Montant</th><th className="border px-3 py-2 text-left">Méthode</th><th className="border px-3 py-2 text-left">Réf</th></tr></thead>
          <tbody>
            {items.map((p:any)=> (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{p.receivedAt ? new Date(p.receivedAt).toLocaleString() : ''}</td>
                <td className="border px-3 py-2">{p.studentName || p.studentProfileId?.slice?.(0,8)}</td>
                <td className="border px-3 py-2">{p.invoiceId?.slice?.(0,8)}</td>
                <td className="border px-3 py-2">{(p.amountCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{p.method}</td>
                <td className="border px-3 py-2">{p.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
