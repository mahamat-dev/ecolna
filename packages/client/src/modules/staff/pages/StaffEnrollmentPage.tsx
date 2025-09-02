import { useState } from 'react';
import { http } from '@/lib/http';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type Student = {
  profileId: string;
  firstName: string;
  lastName: string;
  code: string;
};

type Section = {
  id: string;
  name: string;
};

type SearchResponse = {
  items: Student[];
};

type SectionsResponse = {
  sections: Section[];
};

export default function StaffEnrollmentPage(){
  const [q, setQ] = useState('');
  const search = useQuery({ queryKey: ['staff','enroll','search',q], queryFn: () => http<SearchResponse>(`/enrollment/search?query=${encodeURIComponent(q)}`), enabled: q.length>=2 });
  const [selected, setSelected] = useState<Student|null>(null);
  const sec = useQuery({ queryKey: ['staff','enroll','sections', selected?.profileId], queryFn: () => http<SectionsResponse>(`/enrollment/students/${selected?.profileId}/sections`), enabled: !!selected });

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: { add: string[]; remove: string[] }) => http(`/enrollment/students/${selected?.profileId}/sections`, { method:'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['staff','enroll','sections', selected?.profileId] })
  });

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Inscription / Affectations</h2>
      <input className="border rounded px-3 py-2 w-full" placeholder="Rechercher un élève…" value={q} onChange={e=>setQ(e.target.value)} />
      <div className="grid gap-3 md:grid-cols-2">
        <section className="border rounded-2xl p-3">
          <h3 className="font-semibold mb-2">Résultats</h3>
          <ul className="space-y-2">
            {(search.data?.items || []).map((s: Student)=>(
              <li key={s.profileId} className="flex items-center justify-between">
                <button className="text-blue-600 hover:underline" onClick={()=>setSelected(s)}>{s.lastName} {s.firstName} — {s.code}</button>
              </li>
            ))}
          </ul>
        </section>
        <section className="border rounded-2xl p-3">
          <h3 className="font-semibold mb-2">Sections de {selected ? `${selected.lastName} ${selected.firstName}` : '—'}</h3>
          {!selected ? <p className="opacity-70 text-sm">Sélectionnez un élève.</p> : (
            <>
              <ul className="space-y-1">
                {(sec.data?.sections || []).map((r: Section)=>(
                  <li key={r.id} className="flex items-center justify-between">
                    <span>{r.name}</span>
                    <button className="text-red-600" onClick={()=>save.mutate({ add:[], remove:[r.id] })}>Retirer</button>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <input className="border rounded px-2 py-1" placeholder="Ajouter sectionId" onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>)=>{ if(e.key==='Enter'){ save.mutate({ add:[e.currentTarget.value], remove:[] }); e.currentTarget.value=''; }}} />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}