import { useInvoices, useCreateInvoiceFromAssignments } from '../hooks';
import { Link } from 'react-router-dom';
import { API_URL } from '@/lib/env';
import { useState } from 'react';

export default function InvoicesListPage(){
  const { data, isLoading, isError, refetch } = useInvoices();
  const gen = useCreateInvoiceFromAssignments();
  const [studentId, setStudentId] = useState('');
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Factures</h1>
        <div className="flex items-center gap-2">
          <a href={`${API_URL}/finance/invoices.csv`} target="_blank" rel="noreferrer" className="border rounded px-3 py-1">Export CSV</a>
          <Link to="/finance/invoices/new" className="border rounded px-3 py-1">Nouvelle facture</Link>
        </div>
      </div>
      <div className="grid md:grid-cols-4 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="student profileId (générer depuis affectations)" value={studentId} onChange={e=>setStudentId(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={async ()=>{ if (!studentId) return; await gen.mutateAsync({ studentProfileId: studentId }); await refetch(); setStudentId(''); }}>Générer depuis affectations</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Date</th><th className="border px-3 py-2 text-left">Élève</th><th className="border px-3 py-2 text-left">Montant</th><th className="border px-3 py-2 text-left">Statut</th><th className="border px-3 py-2"></th></tr></thead>
          <tbody>
            {items.map((inv:any)=> (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : ''}</td>
                <td className="border px-3 py-2">{inv.studentName || inv.studentProfileId.slice(0,8)}</td>
                <td className="border px-3 py-2">{(inv.totalCents/100).toFixed(2)} {inv.currency}</td>
                <td className="border px-3 py-2">{inv.status}</td>
                <td className="border px-3 py-2 text-right"><Link className="underline" to={`/finance/invoices/${inv.id}`}>Ouvrir</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
