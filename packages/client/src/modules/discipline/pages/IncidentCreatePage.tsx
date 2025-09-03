import { useNavigate } from 'react-router-dom';
import { IncidentForm } from '../components/IncidentForm';
import { useCreateIncident } from '../hooks';

export default function IncidentCreatePage(){
  const nav = useNavigate();
  const create = useCreateIncident();
  async function onSubmit(payload:any){
    const res = await create.mutateAsync(payload);
    if ((res as any)?.id) nav(`/discipline/incidents/${(res as any).id}`);
    else nav('/discipline/incidents');
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nouvel incident</h1>
      <IncidentForm onSubmit={onSubmit} loading={create.isPending} />
      {create.isError && <div className="text-red-600">Erreur: {(create.error as any)?.message}</div>}
    </div>
  );
}

