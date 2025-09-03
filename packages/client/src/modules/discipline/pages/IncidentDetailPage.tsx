import { useParams } from 'react-router-dom';
import { useIncident, useAddAction, usePublishIncident } from '../hooks';
import { useState } from 'react';
import { ActionAssignDialog } from '../components/ActionAssignDialog';
import { PublishVisibility } from '../components/PublishVisibility';
import { AttachmentsList } from '../components/AttachmentsList';
import { useEffect } from 'react';
import { AcademicsAPI } from '@/modules/shared/api';
import { DisciplineAPI } from '../api';

export default function IncidentDetailPage(){
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useIncident(id);
  const [openAssign, setOpenAssign] = useState(false);
  const addAction = useAddAction(id!);
  const publish = usePublishIncident(id!);
  const [roster, setRoster] = useState<Record<string, string>>({});

  if (isLoading) return <div>Chargement…</div>;
  if (isError) return <div className="text-red-600">Erreur <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>;
  if (!data) return null;
  const { incident, participants, actions, attachments } = data as any;

  useEffect(() => {
    (async () => {
      try {
        if (incident?.classSectionId) {
          const r = await AcademicsAPI.sectionRoster(incident.classSectionId);
          const map: Record<string,string> = {};
          (r.items || r || []).forEach((s: any) => { const name = [s.firstName, s.lastName].filter(Boolean).join(' ').trim(); if (s.profileId && name) map[s.profileId] = name; });
          setRoster(map);
        }
      } catch {}
    })();
  }, [incident?.classSectionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Incident</h1>
        <PublishVisibility value={incident.visibility} onChange={(v)=> publish.mutate(v)} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm text-gray-500">Date/Heure</div>
          <div>{incident.occurredAt ? new Date(incident.occurredAt).toLocaleString() : ''}</div>
          <div className="text-sm text-gray-500">Lieu</div>
          <div>{incident.location || '—'}</div>
          <div className="text-sm text-gray-500">Résumé</div>
          <div>{incident.summary}</div>
          <div className="text-sm text-gray-500">Détails</div>
          <div className="whitespace-pre-wrap text-sm">{incident.details || '—'}</div>
          <div className="text-sm text-gray-500">Pièces jointes</div>
          <AttachmentsList items={attachments} />
        </div>
        <div className="space-y-4">
          <section>
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Participants</h3>
            </div>
            <ul className="text-sm list-disc pl-5">
              {participants.map((p:any)=> {
                const nm = roster[p.profileId];
                return (<li key={`${p.profileId}-${p.role}`}>{p.role} — {nm ? `${nm} ` : ''}<span className="opacity-60">({p.profileId.slice(0,8)})</span> {p.note ? `(${p.note})` : ''}</li>);
              })}
            </ul>
          </section>
          <section>
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Actions</h3>
              <button className="border rounded px-2 py-1 text-sm" onClick={()=>setOpenAssign(true)}>Assigner</button>
            </div>
            <ul className="text-sm divide-y">
              {actions.map((a:any)=> (
                <li key={a.id} className="py-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.type} {a.points ? `(+${a.points})` : ''}</div>
                    <div className="text-xs opacity-70">Elève: {a.profileId.slice(0,8)} {a.completedAt ? `• Terminé` : ''}</div>
                    {a.comment && <div className="text-xs">{a.comment}</div>}
                  </div>
                  <div>
                    <button className="text-sm underline" onClick={async ()=>{
                      await DisciplineAPI.completeAction(a.id, !a.completedAt, a.comment);
                      await refetch();
                    }}>{a.completedAt ? 'Rouvrir' : 'Terminer'}</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <ActionAssignDialog open={openAssign} onClose={()=>setOpenAssign(false)} onSubmit={async (payload)=>{
        await addAction.mutateAsync(payload);
        await refetch();
      }} />
    </div>
  );
}
