import { useAdvances, useApproveAdvance, usePayAdvance, useRepayAdvance } from '../hooks';
import { useState } from 'react';

export default function AdvancesAdminPage(){
  const { data, isLoading, isError, refetch } = useAdvances();
  const approve = useApproveAdvance();
  const pay = usePayAdvance();
  const repay = useRepayAdvance();
  const [repayAmt, setRepayAmt] = useState<Record<string,string>>({});
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Gestion des avances</h1>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Demandeur</th><th className="border px-3 py-2 text-left">Montant</th><th className="border px-3 py-2 text-left">Statut</th><th className="border px-3 py-2 text-left">Actions</th></tr></thead>
          <tbody>
            {items.map((a:any)=> (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{a.requesterProfileId.slice(0,8)}</td>
                <td className="border px-3 py-2">{(a.amountCents/100).toFixed(2)} — Remboursé {(a.repaidCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{a.status}</td>
                <td className="border px-3 py-2">
                  <div className="flex items-center gap-2">
                    {a.status === 'REQUESTED' && (
                      <>
                        <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ await approve.mutateAsync({ id: a.id, approve: true }); await refetch(); }}>Approuver</button>
                        <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ await approve.mutateAsync({ id: a.id, approve: false }); await refetch(); }}>Rejeter</button>
                      </>
                    )}
                    {a.status === 'APPROVED' && <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ await pay.mutateAsync(a.id); await refetch(); }}>Payer</button>}
                    {(a.status === 'PAID' || a.status === 'SETTLED') && (
                      <div className="flex items-center gap-1">
                        <input type="number" className="border rounded px-2 py-1 w-32" placeholder="Montant (cents)" value={repayAmt[a.id] || ''} onChange={e=> setRepayAmt(prev=> ({ ...prev, [a.id]: e.target.value }))} />
                        <button className="border rounded px-2 py-1 text-sm" onClick={async ()=>{ const amt = Number(repayAmt[a.id]||'0'); if (amt>0) { await repay.mutateAsync({ id: a.id, amountCents: amt }); await refetch(); } }}>Rembourser</button>
                      </div>
                    )}
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

