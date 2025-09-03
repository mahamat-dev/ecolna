import { useAdvances, useRequestAdvance } from '../hooks';
import { useState } from 'react';

export default function AdvancesRequestPage(){
  const { data, isLoading, isError, refetch } = useAdvances();
  const req = useRequestAdvance();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Avances</h1>
      <div className="grid md:grid-cols-3 gap-2 items-end">
        <input type="number" className="border rounded px-2 py-1" placeholder="Montant (cents)" value={amount} onChange={e=>setAmount(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="Motif" value={reason} onChange={e=>setReason(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={async ()=>{ await req.mutateAsync({ amountCents: Number(amount||'0'), reason: reason||undefined }); await refetch(); setAmount(''); setReason(''); }}>Demander</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Date</th><th className="border px-3 py-2 text-left">Montant</th><th className="border px-3 py-2 text-left">Statut</th><th className="border px-3 py-2 text-left">Remboursé</th></tr></thead>
          <tbody>
            {items.map((a:any)=> (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{new Date(a.requestedAt).toLocaleString()}</td>
                <td className="border px-3 py-2">{(a.amountCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{a.status}</td>
                <td className="border px-3 py-2">{(a.repaidCents/100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

