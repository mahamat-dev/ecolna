import { useParams } from 'react-router-dom';
import { API_URL } from '@/lib/env';
import { useAddPayrollItem, usePayrollItems, useSetPayrollItemStatus } from '../hooks';
import { useState } from 'react';

export default function PayrollPeriodDetailPage(){
  const { periodId } = useParams();
  const { data, isLoading, isError, refetch } = usePayrollItems(periodId!);
  const add = useAddPayrollItem(periodId!);
  const setStatus = useSetPayrollItemStatus();
  const [staffId, setStaffId] = useState('');
  const [gross, setGross] = useState('0');
  const [allow, setAllow] = useState('0');
  const [ded, setDed] = useState('0');
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Période de paie</h1>
        <a href={`${API_URL}/finance/payroll/periods/${periodId}/items.csv`} target="_blank" rel="noreferrer" className="border rounded px-3 py-1">Export CSV</a>
      </div>
      <div className="grid md:grid-cols-5 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="staff profileId" value={staffId} onChange={e=>setStaffId(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Brut (cents)" value={gross} onChange={e=>setGross(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Primes (cents)" value={allow} onChange={e=>setAllow(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Retenues (cents)" value={ded} onChange={e=>setDed(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={async ()=>{ await add.mutateAsync({ staffProfileId: staffId, grossCents: Number(gross||'0'), allowancesCents: Number(allow||'0'), deductionsCents: Number(ded||'0') }); await refetch(); setStaffId(''); setGross('0'); setAllow('0'); setDed('0'); }}>Ajouter</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Employé</th><th className="border px-3 py-2 text-left">Brut</th><th className="border px-3 py-2 text-left">Primes</th><th className="border px-3 py-2 text-left">Retenues</th><th className="border px-3 py-2 text-left">Net</th><th className="border px-3 py-2 text-left">Statut</th><th className="border px-3 py-2 text-left">Actions</th></tr></thead>
          <tbody>
            {items.map((it:any)=> (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{it.staffName || it.staffProfileId.slice(0,8)}</td>
                <td className="border px-3 py-2">{(it.grossCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.allowancesCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.deductionsCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.netCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{it.status}</td>
                <td className="border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {it.status !== 'APPROVED' && <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ await setStatus.mutateAsync({ id: it.id, status: 'APPROVED' }); await refetch(); }}>Approuver</button>}
                    {it.status !== 'PAID' && <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ await setStatus.mutateAsync({ id: it.id, status: 'PAID' }); await refetch(); }}>Payer</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
