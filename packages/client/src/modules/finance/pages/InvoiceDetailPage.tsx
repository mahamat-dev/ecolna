import { useParams } from 'react-router-dom';
import { useInvoice, useCreatePayment, useVoidInvoice } from '../hooks';
import { useState } from 'react';

export default function InvoiceDetailPage(){
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useInvoice(id);
  const pay = useCreatePayment();
  const voidInv = useVoidInvoice();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'CASH'|'BANK'|'MOBILE'>('CASH');
  const [reference, setReference] = useState('');
  if (isLoading) return <div>Chargement…</div>;
  if (isError) return <div className="text-red-600">Erreur</div>;
  const inv = (data as any).invoice;
  const lines = (data as any).lines || [];
  const payments = (data as any).payments || [];
  const paidCents = (data as any).paidCents || 0;
  const remaining = Math.max(0, (inv.totalCents || 0) - paidCents);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Facture</h1>
        <div className="flex gap-2">
          {inv.status !== 'VOID' && <button className="border rounded px-3 py-1" onClick={async ()=>{ await voidInv.mutateAsync({ id: id! }); await refetch(); }}>Annuler</button>}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Élève</div>
          <div>{inv.studentName || inv.studentProfileId}</div>
          <div className="text-sm text-gray-500">Montant</div>
          <div>{(inv.totalCents/100).toFixed(2)} {inv.currency} — Payé {(paidCents/100).toFixed(2)} — Reste {(remaining/100).toFixed(2)}</div>
          <div className="text-sm text-gray-500">Statut</div>
          <div>{inv.status}</div>
          <div className="text-sm text-gray-500">Lignes</div>
          <ul className="list-disc pl-5 text-sm">
            {lines.map((l:any)=> (<li key={l.id}>{l.description} — {(l.amountCents/100).toFixed(2)}</li>))}
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="font-medium">Paiements</h3>
          <ul className="divide-y text-sm">
            {payments.map((p:any)=> (
              <li key={p.id} className="py-1 flex items-center justify-between"><span>{new Date(p.receivedAt).toLocaleString()} — {(p.amountCents/100).toFixed(2)} {p.method}</span><span className="opacity-70">{p.reference}</span></li>
            ))}
            {!payments.length && <li className="py-1 text-xs opacity-60">Aucun paiement</li>}
          </ul>
          {inv.status !== 'VOID' && remaining > 0 && (
            <div className="grid md:grid-cols-4 gap-2 items-end">
              <input type="number" className="border rounded px-2 py-1" placeholder="Montant (cents)" value={amount} onChange={e=>setAmount(e.target.value)} />
              <select className="border rounded px-2 py-1" value={method} onChange={e=>setMethod(e.target.value as any)}>
                <option value="CASH">CASH</option>
                <option value="BANK">BANK</option>
                <option value="MOBILE">MOBILE</option>
              </select>
              <input className="border rounded px-2 py-1" placeholder="Référence" value={reference} onChange={e=>setReference(e.target.value)} />
              <button className="border rounded px-3 py-1" onClick={async ()=>{ await pay.mutateAsync({ invoiceId: id!, amountCents: Number(amount||'0'), method, reference }); await refetch(); setAmount(''); setReference(''); }}>Ajouter paiement</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
