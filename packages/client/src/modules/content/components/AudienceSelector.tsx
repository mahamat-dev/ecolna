import { useState } from 'react';
import type { AudienceInput, Role } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ROLES: Role[] = ['ADMIN','STAFF','TEACHER','STUDENT','GUARDIAN'];

export function AudienceSelector({ value, onChange }: { value: AudienceInput[]; onChange: (v: AudienceInput[]) => void }) {
  const [scope, setScope] = useState<AudienceInput['scope']>('ALL');
  const [payload, setPayload] = useState<Partial<AudienceInput>>({});

  function add() {
    const item: AudienceInput = { scope, ...payload } as AudienceInput;
    onChange([...(value||[]), item]);
    setPayload({});
  }

  function remove(i: number) {
    const next = [...value];
    next.splice(i,1); 
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select className="border rounded px-2 py-2" value={scope} onChange={e=>setScope(e.target.value as AudienceInput['scope'])}>
          {['ALL','ROLE','STAGE','GRADE_LEVEL','CLASS_SECTION','SUBJECT','STUDENT','GUARDIAN'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {scope==='ROLE' && (
          <select className="border rounded px-2 py-2" value={payload.role || ''} onChange={e=>setPayload(p=>({ ...p, role: e.target.value as Role }))}>
            <option value="">role…</option>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {scope==='GRADE_LEVEL' && <Input placeholder="gradeLevelId" value={payload.gradeLevelId||''} onChange={e=>setPayload(p=>({ ...p, gradeLevelId: e.target.value }))} />}
        {scope==='CLASS_SECTION' && <Input placeholder="classSectionId" value={payload.classSectionId||''} onChange={e=>setPayload(p=>({ ...p, classSectionId: e.target.value }))} />}
        {scope==='SUBJECT' && <Input placeholder="subjectId" value={payload.subjectId||''} onChange={e=>setPayload(p=>({ ...p, subjectId: e.target.value }))} />}
        {scope==='STUDENT' && <Input placeholder="studentProfileId" value={payload.studentProfileId||''} onChange={e=>setPayload(p=>({ ...p, studentProfileId: e.target.value }))} />}
        {scope==='GUARDIAN' && <Input placeholder="guardianProfileId" value={payload.guardianProfileId||''} onChange={e=>setPayload(p=>({ ...p, guardianProfileId: e.target.value }))} />}
      </div>
      <Button type="button" onClick={add} className="mt-1">Ajouter</Button>
      <ul className="text-sm space-y-1">
        {value.map((a,i)=>(
          <li key={i} className="flex items-center justify-between border rounded p-2">
            <span>{a.scope}{a.role?`:${a.role}`:''}{a.gradeLevelId?`#${a.gradeLevelId}`:''}{a.classSectionId?`#${a.classSectionId}`:''}{a.subjectId?`#${a.subjectId}`:''}{a.studentProfileId?`#${a.studentProfileId}`:''}{a.guardianProfileId?`#${a.guardianProfileId}`:''}</span>
            <Button type="button" variant="ghost" size="sm" onClick={()=>remove(i)}>✕</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}