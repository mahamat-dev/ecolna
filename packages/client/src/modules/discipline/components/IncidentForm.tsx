import { useEffect, useState } from 'react';
import { ParticipantRow } from './ParticipantRow';
import { ParticipantPicker } from './ParticipantPicker';
import { FileUploaderM7 } from './FileUploaderM7';
import { DisciplineAPI } from '../api';

export function IncidentForm({ onSubmit, loading }:{ onSubmit:(payload:any)=>void; loading?:boolean; }){
  const [summary, setSummary] = useState('');
  const [occurredAt, setOccurredAt] = useState(()=> new Date().toISOString().slice(0,16));
  const [details, setDetails] = useState('');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<{ profileId:string; role:'PERPETRATOR'|'VICTIM'|'WITNESS'; note?:string }[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [classSectionId, setClassSectionId] = useState<string|undefined>(undefined);

  useEffect(() => { (async () => {
    try {
      const res = await DisciplineAPI.listCategories();
      setCategories(res.items || []);
    } catch {}
  })(); }, []);

  return (
    <form className="space-y-3" onSubmit={(e)=>{ e.preventDefault(); onSubmit({
      categoryId: categoryId || null,
      summary, details, occurredAt: new Date(occurredAt).toISOString(), location,
      classSectionId,
      participants, attachments
    }) }}>
      <div>
        <label className="text-sm">Catégorie</label>
        <select className="border rounded w-full px-3 py-2" value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
          <option value="">—</option>
          {categories.map((c:any)=> (<option key={c.id} value={c.id}>{c.code}</option>))}
        </select>
      </div>
      <div>
        <label className="text-sm">Résumé</label>
        <input className="border rounded w-full px-3 py-2" required value={summary} onChange={e=>setSummary(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-sm">Date/Heure</label>
          <input type="datetime-local" className="border rounded w-full px-3 py-2" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Lieu</label>
          <input className="border rounded w-full px-3 py-2" value={location} onChange={e=>setLocation(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-sm">Détails</label>
        <textarea className="border rounded w-full px-3 py-2 min-h-[120px]" value={details} onChange={e=>setDetails(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Participants</label>
        <ParticipantPicker value={participants} onChange={setParticipants} onSectionChange={setClassSectionId} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Pièces jointes</label>
        <FileUploaderM7 onUploaded={(fid)=>setAttachments(a=>[...a, fid])} />
        <ul className="text-xs opacity-70">{attachments.map(a=><li key={a}>{a}</li>)}</ul>
      </div>
      <div className="pt-2">
        <button type="submit" disabled={loading} className="border rounded px-4 py-2">{loading ? 'Envoi...' : 'Créer l’incident'}</button>
      </div>
    </form>
  );
}
