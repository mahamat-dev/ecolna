import { useState } from 'react';

export function AttendanceToggle({ present, onChange }:{ present:boolean; onChange:(v:boolean)=>void }){
  const [busy, setBusy] = useState(false);
  return (
    <button disabled={busy} onClick={async()=>{ setBusy(true); try{ await onChange(!present);} finally{ setBusy(false);} }} className={`px-2 py-1 rounded border text-xs ${present ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
      {busy ? '...' : (present ? 'Présent' : 'Absent')}
    </button>
  );
}

