import { useCreateFeeSchedule, useFeeSchedules } from '../hooks';
import { useState } from 'react';

export default function FeeSchedulesPage(){
  const { data, isLoading, isError, refetch } = useFeeSchedules();
  const create = useCreateFeeSchedule();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('0');
  const [desc, setDesc] = useState('');
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Barèmes de frais</h1>
      <form className="grid md:grid-cols-5 gap-2 items-end" onSubmit={async (e)=>{ e.preventDefault(); await create.mutateAsync({ code, name, amountCents: Number(amount||'0'), description: desc||undefined }); setCode(''); setName(''); setAmount('0'); setDesc(''); await refetch(); }}>
        <input className="border rounded px-2 py-1" placeholder="Code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
        <input className="border rounded px-2 py-1" placeholder="Nom" value={name} onChange={e=>setName(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Montant (cents)" value={amount} onChange={e=>setAmount(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} />
        <button className="border rounded px-3 py-1">Créer</button>
      </form>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Code</th><th className="border px-3 py-2 text-left">Nom</th><th className="border px-3 py-2 text-left">Montant</th><th className="border px-3 py-2 text-left">Créé</th></tr></thead>
          <tbody>
            {items.map((it:any)=> (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{it.code}</td>
                <td className="border px-3 py-2">{it.name}</td>
                <td className="border px-3 py-2">{(it.amountCents/100).toFixed(2)} {it.currency}</td>
                <td className="border px-3 py-2">{it.createdAt ? new Date(it.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

