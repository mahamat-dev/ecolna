import { useQuery } from '@tanstack/react-query';
import { AttendanceAPI, type AttendanceSummaryRow } from '@/modules/shared/api';
import { useEffect, useMemo, useState } from 'react';
import { http } from '@/lib/http';

type GuardianChild = { profileId: string; firstName: string; lastName: string };

export default function GuardianAttendancePage(){
  const { data } = useQuery({ queryKey: ['guardian','children'], queryFn: () => http<{ children: GuardianChild[] }>(`/guardians/me/students`) });
  const kids = useMemo(()=> (data?.children ?? []) as GuardianChild[], [data?.children]);
  const [kid, setKid] = useState<string | null>(null);
  useEffect(()=>{ if (kids[0]?.profileId) setKid(kids[0].profileId); }, [kids]);

  function range(days=30){ const end=new Date(); const start=new Date(); start.setDate(end.getDate()-days); const fmt=(d:Date)=>d.toISOString().slice(0,10); return { from: fmt(start), to: fmt(end)} }
  const { from, to } = range(30);

  const q = useQuery({
    queryKey: ['guardian','attendance',kid,from,to],
    queryFn: () => AttendanceAPI.studentSummary(kid!, from, to),
    enabled: !!kid
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Présences</h2>
        <select className="ml-auto border rounded px-2 py-1" value={kid||''} onChange={e=>setKid(e.target.value)}>
          {kids.map((k)=> <option key={k.profileId} value={k.profileId}>{k.lastName} {k.firstName}</option>)}
        </select>
      </div>
      {q.isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Classe</th><th className="p-2">Statut</th></tr></thead>
          <tbody>
            {((q.data as AttendanceSummaryRow[])||[]).map((r)=> (
              <tr key={r.date+'-'+r.classSectionId} className="border-t">
                <td className="p-2">{r.date}</td>
                <td className="p-2">{r.sectionName}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}