import { useCreateInvoice } from '../hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function InvoiceCreatePage(){
  const [studentId, setStudentId] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [lines, setLines] = useState<{ description: string; amountCents: string }[]>([{ description: '', amountCents: '0' }]);
  const create = useCreateInvoice();
  const nav = useNavigate();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nouvelle facture</h1>
      <div className="grid md:grid-cols-3 gap-2">
        <input className="border rounded px-2 py-1" placeholder="student profileId" value={studentId} onChange={e=>setStudentId(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="Devise (3 lettres)" value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Lignes</h3>
          <button className="text-sm underline" onClick={()=> setLines(l=> [...l, { description: '', amountCents: '0' }])}>Ajouter</button>
        </div>
        {lines.map((ln, idx)=> (
          <div key={idx} className="grid md:grid-cols-3 gap-2 items-end">
            <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Description" value={ln.description} onChange={e=> setLines(l=> l.map((x,i)=> i===idx ? { ...x, description: e.target.value } : x))} />
            <input type="number" className="border rounded px-2 py-1" placeholder="Montant (cents)" value={ln.amountCents} onChange={e=> setLines(l=> l.map((x,i)=> i===idx ? { ...x, amountCents: e.target.value } : x))} />
          </div>
        ))}
      </div>
      <div>
        <button className="border rounded px-3 py-1" onClick={async ()=>{
          const payload = { studentProfileId: studentId, currency, lines: lines.filter(l=> l.description && Number(l.amountCents)>0).map(l=> ({ description: l.description, amountCents: Number(l.amountCents) })) };
          const res = await create.mutateAsync(payload as any);
          nav(`/finance/invoices/${(res as any).id}`);
        }}>Créer</button>
      </div>
    </div>
  );
}

