import { useEffect, useMemo, useState } from 'react';
import { useMe } from '@/modules/auth/hooks';
import { AcademicsAPI } from '@/modules/shared/api';

type Role = 'PERPETRATOR'|'VICTIM'|'WITNESS';

export function ParticipantPicker({
  value,
  onChange,
  onSectionChange,
}:{
  value: { profileId: string; role: Role; note?: string }[];
  onChange: (v: { profileId: string; role: Role; note?: string }[]) => void;
  onSectionChange?: (sectionId: string|undefined) => void;
}){
  const me = useMe();
  const roles: string[] = me.data?.user?.roles || [];
  const isTeacherOnly = roles.includes('TEACHER') && !roles.includes('ADMIN') && !roles.includes('STAFF');

  const [sections, setSections] = useState<any[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [roster, setRoster] = useState<any[]>([]);

  const [q, setQ] = useState('');
  const [search, setSearch] = useState<any[]>([]);

  // Teacher: load my sections and roster
  useEffect(() => { (async () => {
    if (isTeacherOnly) {
      const res = await AcademicsAPI.mySectionsTaught();
      setSections(res.items || res || []);
    }
  })(); }, [isTeacherOnly]);

  useEffect(() => { (async () => {
    if (isTeacherOnly && selectedSection) {
      const r = await AcademicsAPI.sectionRoster(selectedSection);
      setRoster(r.items || r || []);
      onSectionChange?.(selectedSection);
    }
  })(); }, [isTeacherOnly, selectedSection]);

  // Admin/Staff: search students
  useEffect(() => { (async () => {
    if (!isTeacherOnly && q.trim().length >= 2) {
      const params = new URLSearchParams({ q, types: 'students', limit: '10' });
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/search?${params}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setSearch(data.students || []);
      }
    } else setSearch([]);
  })(); }, [q, isTeacherOnly]);

  const add = (profileId: string, role: Role = 'PERPETRATOR') => {
    if (value.some(v => v.profileId === profileId && v.role === role)) return;
    onChange([...value, { profileId, role }]);
  };
  const update = (idx: number, patch: Partial<{ profileId: string; role: Role; note?: string }>) => {
    onChange(value.map((v, i) => i === idx ? { ...v, ...patch } : v));
  };
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {isTeacherOnly ? (
        <div className="grid md:grid-cols-2 gap-2 items-end">
          <div>
            <label className="text-sm">Section</label>
            <select className="border rounded w-full px-2 py-1" value={selectedSection} onChange={e=> setSelectedSection(e.target.value)}>
              <option value="">Sélectionner…</option>
              {sections.map((s:any)=> (<option key={s.classSectionId} value={s.classSectionId}>{s.classSectionName || s.classSectionId}</option>))}
            </select>
          </div>
          <div>
            <label className="text-sm">Ajouter</label>
            <select className="border rounded w-full px-2 py-1" onChange={e=> { if (e.target.value) { add(e.target.value as string); e.target.value=''; } }}>
              <option value="">Élève…</option>
              {roster.map((r:any)=> (<option key={r.profileId} value={r.profileId}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || r.profileId}</option>))}
            </select>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-2 items-end">
          <div>
            <label className="text-sm">Chercher élève</label>
            <input className="border rounded w-full px-2 py-1" placeholder="Nom/prénom" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div>
            <label className="text-sm">Résultats</label>
            <select className="border rounded w-full px-2 py-1" onChange={e=> { if (e.target.value) { add(e.target.value as string); e.target.value=''; } }}>
              <option value="">Sélectionner…</option>
              {search.map((p:any)=> (<option key={p.profileId} value={p.profileId}>{[p.firstName, p.lastName].filter(Boolean).join(' ') || p.profileId}</option>))}
            </select>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {value.map((p, idx) => (
          <li key={`${p.profileId}-${idx}`} className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded bg-gray-100">{p.profileId.slice(0,8)}</span>
            <select className="border rounded px-2 py-1" value={p.role} onChange={e=> update(idx, { role: e.target.value as Role })}>
              <option value="PERPETRATOR">Auteur</option>
              <option value="VICTIM">Victime</option>
              <option value="WITNESS">Témoin</option>
            </select>
            <input className="border rounded px-2 py-1 flex-1" placeholder="note" value={p.note || ''} onChange={e=> update(idx, { note: e.target.value })} />
            <button type="button" className="text-red-600" onClick={()=> remove(idx)}>Supprimer</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

