import { useState } from 'react';
import { useCreateDetention, useDetentions } from '../hooks';
import { DetentionForm } from '../components/DetentionForm';
import { DetentionEnrollDrawer } from '../components/DetentionEnrollDrawer';
import { AttendanceToggle } from '../components/AttendanceToggle';
import { DisciplineAPI } from '../api';

export default function DetentionSessionsPage(){
  const { data, isLoading, isError, refetch } = useDetentions();
  const create = useCreateDetention();
  const [enrollOpen, setEnrollOpen] = useState<string|null>(null);
  const [expanded, setExpanded] = useState<Record<string, { items: any[] }>>({});
  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Séances de retenue</h1>
      </div>
      <DetentionForm onSubmit={async (payload)=>{ await create.mutateAsync(payload); await refetch(); }} />
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur. <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>}
      <div className="space-y-3">
        {items.map((s:any)=> (
          <div key={s.id} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{s.title}</div>
                <div className="text-xs opacity-70">{new Date(s.dateTime).toLocaleString()} • {s.room || '—'} • Cap {s.capacity}</div>
              </div>
              <button className="border rounded px-2 py-1 text-sm" onClick={()=> setEnrollOpen(s.id)}>Inscrire</button>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="text-sm underline" onClick={async ()=>{
                if (!expanded[s.id]) {
                  const resp = await fetch(`${import.meta.env.VITE_API_URL}/discipline/detention-sessions/${s.id}/enrollments`, { credentials: 'include' });
                  const data = resp.ok ? await resp.json() : { items: [] };
                  setExpanded(prev => ({ ...prev, [s.id]: data }));
                } else {
                  setExpanded(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                }
              }}>{expanded[s.id] ? 'Masquer' : 'Voir les inscriptions'}</button>
            </div>
            {expanded[s.id] && (
              <div className="mt-3">
                <table className="min-w-full border-collapse border">
                  <thead><tr className="bg-gray-50"><th className="border px-2 py-1 text-left">Élève</th><th className="border px-2 py-1 text-left">Présence</th></tr></thead>
                  <tbody>
                    {expanded[s.id].items.map((e:any)=> (
                      <tr key={e.studentProfileId}>
                        <td className="border px-2 py-1">{e.studentName || e.studentProfileId.slice(0,8)}</td>
                        <td className="border px-2 py-1">
                          <AttendanceToggle present={!!e.present} onChange={async (v)=>{
                            await DisciplineAPI.markDetentionAttendance(s.id, e.studentProfileId, v);
                            const resp = await fetch(`${import.meta.env.VITE_API_URL}/discipline/detention-sessions/${s.id}/enrollments`, { credentials: 'include' });
                            const data = resp.ok ? await resp.json() : { items: [] };
                            setExpanded(prev => ({ ...prev, [s.id]: data }));
                          }} />
                        </td>
                      </tr>
                    ))}
                    {!expanded[s.id].items.length && (<tr><td className="border px-2 py-1 text-sm opacity-60" colSpan={2}>Aucune inscription.</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {!items.length && <div className="text-sm opacity-60">Aucune séance.</div>}
      </div>
      {enrollOpen && (
        <DetentionEnrollDrawer open onClose={()=> setEnrollOpen(null)} onSubmit={async ({ actionId, studentProfileId })=>{
          await DisciplineAPI.enrollDetention(enrollOpen, { sessionId: enrollOpen, actionId, studentProfileId });
          await refetch();
        }} />
      )}
    </div>
  );
}
