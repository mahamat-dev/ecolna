import { useAssignFee, useFeeSchedules } from '../hooks';
import { useState } from 'react';

export default function AssignFeePage(){
  const { data } = useFeeSchedules();
  const assign = useAssignFee();
  const [studentId, setStudentId] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [amount, setAmount] = useState('');
  const [discount, setDiscount] = useState('0');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Affecter un barème</h1>
      <div className="grid md:grid-cols-5 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="student profileId" value={studentId} onChange={e=>setStudentId(e.target.value)} />
        <select className="border rounded px-2 py-1" value={scheduleId} onChange={e=>setScheduleId(e.target.value)}>
          <option value="">Barème…</option>
          {(data?.items||[]).map((s:any)=> (<option key={s.id} value={s.id}>{s.code} — {(s.amountCents/100).toFixed(2)} {s.currency}</option>))}
        </select>
        <input type="number" className="border rounded px-2 py-1" placeholder="Montant personnalisé (cents)" value={amount} onChange={e=>setAmount(e.target.value)} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Remise (cents)" value={discount} onChange={e=>setDiscount(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={async ()=>{ await assign.mutateAsync({ studentProfileId: studentId, scheduleId, amountCents: amount ? Number(amount) : undefined, discountCents: Number(discount||'0') }); alert('Affecté'); }}>Affecter</button>
      </div>
    </div>
  );
}

