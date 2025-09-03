import { useState } from 'react';
import { useGuardianChildRecord } from '../hooks';

export default function GuardianChildRecordPage(){
  const [studentId, setStudentId] = useState('');
  const { data, isLoading, isError, refetch } = useGuardianChildRecord(studentId || undefined);
  const items = data?.items || [];
  const points = data?.points || 0;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Dossier de l’enfant</h1>
      <div className="flex items-center gap-2">
        <input value={studentId} onChange={e=>setStudentId(e.target.value)} placeholder="student profileId" className="border rounded px-2 py-1" />
        <button className="border rounded px-3 py-1" onClick={()=>refetch()} disabled={!studentId}>Charger</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur.</div>}
      {studentId && (
        <>
          <div className="text-sm">Points cumulés: <span className="font-medium">{points}</span></div>
          <div className="space-y-3">
            {items.map((i:any)=> (
              <div key={i.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{i.summary}</div>
                  <div className="text-xs opacity-70">{i.occurredAt ? new Date(i.occurredAt).toLocaleString() : ''}</div>
                </div>
                <div className="text-sm opacity-80 mt-1">{i.details || '—'}</div>
              </div>
            ))}
            {!items.length && <div className="text-sm opacity-60">Aucun incident publié aux parents pour cet élève.</div>}
          </div>
        </>
      )}
    </div>
  );
}

