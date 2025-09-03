export function PublishVisibility({ value, onChange }:{ value:'PRIVATE'|'STUDENT'|'GUARDIAN'; onChange:(v:any)=>void; }){
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">Visibilité:</span>
      <select className="border rounded px-2 py-1" value={value} onChange={e=>onChange(e.target.value)}>
        <option value="PRIVATE">Privé</option>
        <option value="STUDENT">Étudiant</option>
        <option value="GUARDIAN">Parent</option>
      </select>
    </div>
  );
}

