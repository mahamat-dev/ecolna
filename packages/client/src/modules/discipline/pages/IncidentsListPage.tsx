import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useIncidents } from '../hooks';
import { IncidentsTable } from '../components/IncidentsTable';

export default function IncidentsListPage(){
  const [status, setStatus] = useState<string>('');
  const [myReported, setMyReported] = useState<boolean>(false);
  const [studentProfileId, setStudentProfileId] = useState<string>('');
  const [cursor, setCursor] = useState<string|undefined>(undefined);
  const { data, isLoading, isError, refetch } = useIncidents({ status: status || undefined, myReported: myReported ? 'true' : undefined as any, studentProfileId: studentProfileId || undefined, limit: 20, cursor });
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Incidents</h1>
        <Link to="/discipline/incidents/new" className="border rounded px-3 py-1">Nouvel incident</Link>
      </div>
      <div className="grid md:grid-cols-4 gap-2 items-end">
        <div>
          <label className="text-sm">Statut</label>
          <select className="border rounded w-full px-2 py-1" value={status} onChange={e=>{ setCursor(undefined); setStatus(e.target.value); }}>
            <option value="">Tous</option>
            <option value="OPEN">Ouvert</option>
            <option value="UNDER_REVIEW">En examen</option>
            <option value="RESOLVED">Résolu</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
        <div>
          <label className="text-sm">Élève (profileId)</label>
          <input className="border rounded w-full px-2 py-1" value={studentProfileId} onChange={e=>{ setCursor(undefined); setStudentProfileId(e.target.value); }} />
        </div>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={myReported} onChange={e=>{ setCursor(undefined); setMyReported(e.target.checked); }} />
          <span className="text-sm">Mes signalements</span>
        </label>
        <button className="border rounded px-3 py-1" onClick={()=>{ setCursor(undefined); refetch(); }}>Appliquer</button>
      </div>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur. <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>}
      <IncidentsTable items={items} />
      <div className="flex justify-center">
        {data?.nextCursor && (
          <button className="border rounded px-3 py-1" onClick={()=> setCursor(data.nextCursor || undefined)}>Charger plus</button>
        )}
      </div>
    </div>
  );
}
