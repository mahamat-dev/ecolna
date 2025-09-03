import { useState } from 'react';

export function DetentionEnrollDrawer({ open, onClose, onSubmit }:{ open:boolean; onClose:()=>void; onSubmit:(payload:{ actionId:string; studentProfileId:string })=>void }){
  const [actionId, setActionId] = useState('');
  const [studentProfileId, setStudentProfileId] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/30 grid place-items-end">
      <div className="bg-white w-full max-w-md h-full p-4 space-y-3">
        <h3 className="text-lg font-semibold">Inscrire un élève (détention)</h3>
        <input className="border rounded w-full px-3 py-2" placeholder="actionId (DETENTION)" value={actionId} onChange={e=>setActionId(e.target.value)} />
        <input className="border rounded w-full px-3 py-2" placeholder="student profileId" value={studentProfileId} onChange={e=>setStudentProfileId(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose}>Fermer</button>
          <button className="px-3 py-1 border rounded bg-slate-50" onClick={()=>{ onSubmit({ actionId, studentProfileId }); onClose(); }}>Inscrire</button>
        </div>
      </div>
    </div>
  );
}

