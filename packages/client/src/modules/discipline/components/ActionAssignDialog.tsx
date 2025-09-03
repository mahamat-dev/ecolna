import { useState } from 'react';

export function ActionAssignDialog({ open, onClose, onSubmit }:{ open:boolean; onClose:()=>void; onSubmit:(payload:any)=>void; }){
  const [profileId, setProfileId] = useState('');
  const [type, setType] = useState('WARNING');
  const [points, setPoints] = useState(0);
  const [dueAt, setDueAt] = useState<string>('');

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-center">
      <div className="bg-white rounded-2xl p-4 w-full max-w-md space-y-3">
        <h3 className="text-lg font-semibold">Assigner une action</h3>
        <input className="border rounded w-full px-3 py-2" placeholder="student profileId" value={profileId} onChange={e=>setProfileId(e.target.value)} />
        <div className="flex gap-2">
          <select className="border rounded px-2 py-1" value={type} onChange={e=>setType(e.target.value)}>
            <option value="WARNING">Avertissement</option>
            <option value="DETENTION">Retenue</option>
            <option value="SUSPENSION_IN_SCHOOL">Exclusion interne</option>
            <option value="SUSPENSION_OUT_OF_SCHOOL">Exclusion externe</option>
            <option value="PARENT_MEETING">Entretien parent</option>
            <option value="COMMUNITY_SERVICE">Service</option>
          </select>
          <input type="number" className="border rounded px-2 py-1 w-[10ch]" value={points} onChange={e=>setPoints(parseInt(e.target.value||'0'))} />
          <input type="datetime-local" className="border rounded px-2 py-1" value={dueAt} onChange={e=>setDueAt(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose}>Annuler</button>
          <button className="px-3 py-1 border rounded bg-slate-50" onClick={()=>{ onSubmit({ profileId, type, points, dueAt: dueAt ? new Date(dueAt).toISOString() : undefined }); onClose(); }}>Assigner</button>
        </div>
      </div>
    </div>
  );
}

