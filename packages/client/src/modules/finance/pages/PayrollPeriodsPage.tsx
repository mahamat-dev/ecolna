import { useCreatePayrollPeriod, usePayrollPeriods } from '../hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function PayrollPeriodsPage(){
  const { data, isLoading, isError, refetch } = usePayrollPeriods();
  const create = useCreatePayrollPeriod();
  const [code, setCode] = useState('');
  const [start, setStart] = useState(()=> new Date().toISOString().slice(0,10));
  const [end, setEnd] = useState(()=> new Date().toISOString().slice(0,10));
  const [pay, setPay] = useState(()=> new Date().toISOString().slice(0,10));
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Périodes de paie</h1>
      <form className="grid md:grid-cols-5 gap-2 items-end" onSubmit={async (e)=>{ e.preventDefault(); await create.mutateAsync({ code, startDate: start, endDate: end, payDate: pay }); setCode(''); await refetch(); }}>
        <input className="border rounded px-2 py-1" placeholder="Code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
        <input type="date" className="border rounded px-2 py-1" value={start} onChange={e=>setStart(e.target.value)} />
        <input type="date" className="border rounded px-2 py-1" value={end} onChange={e=>setEnd(e.target.value)} />
        <input type="date" className="border rounded px-2 py-1" value={pay} onChange={e=>setPay(e.target.value)} />
        <button className="border rounded px-3 py-1">Créer</button>
      </form>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Code</th><th className="border px-3 py-2 text-left">Période</th><th className="border px-3 py-2 text-left">Paie</th><th className="border px-3 py-2 text-left"></th></tr></thead>
          <tbody>
            {items.map((p:any)=> (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{p.code}</td>
                <td className="border px-3 py-2">{new Date(p.startDate).toLocaleDateString()}–{new Date(p.endDate).toLocaleDateString()}</td>
                <td className="border px-3 py-2">{new Date(p.payDate).toLocaleDateString()}</td>
                <td className="border px-3 py-2 text-right"><Link className="underline" to={`/finance/payroll/${p.id}`}>Gérer</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

