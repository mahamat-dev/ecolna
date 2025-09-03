import { useMyRecord } from '../hooks';

export default function MyDisciplinePage(){
  const { data, isLoading, isError, refetch } = useMyRecord();
  const items = data?.items || [];
  const points = data?.points || 0;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mon dossier</h1>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur. <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>}
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
        {!items.length && <div className="text-sm opacity-60">Aucun incident publié pour ce compte.</div>}
      </div>
    </div>
  );
}

