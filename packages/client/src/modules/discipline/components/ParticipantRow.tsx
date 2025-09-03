export type Role = 'PERPETRATOR'|'VICTIM'|'WITNESS';

export function ParticipantRow({ idx, value, onChange, onDelete }:{
  idx:number;
  value:{ profileId:string; role:Role; note?:string };
  onChange:(v:any)=>void; onDelete:()=>void;
}){
  return (
    <div className="flex gap-2 items-center">
      <input className="border rounded px-2 py-1 w-[22ch]" placeholder="profileId"
             value={value.profileId} onChange={e=>onChange({ ...value, profileId: e.target.value })} />
      <select className="border rounded px-2 py-1" value={value.role} onChange={e=>onChange({ ...value, role: e.target.value as Role })}>
        <option value="PERPETRATOR">Auteur</option>
        <option value="VICTIM">Victime</option>
        <option value="WITNESS">Témoin</option>
      </select>
      <input className="border rounded px-2 py-1 flex-1" placeholder="note" value={value.note||''} onChange={e=>onChange({ ...value, note: e.target.value })}/>
      <button type="button" className="text-red-600" onClick={onDelete}>Supprimer</button>
    </div>
  );
}

