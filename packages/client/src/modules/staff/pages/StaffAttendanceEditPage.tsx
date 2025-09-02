import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AttendanceAPI } from '@/modules/shared/api';

type AttendanceRow = {
  studentProfileId: string;
  studentName?: string;
  status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null;
  note?: string;
};

type AttendanceResponse = {
  rows: AttendanceRow[];
};

export default function StaffAttendanceEditPage(){
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const q = useQuery({ 
    queryKey: ['staff','att',sectionId,date], 
    queryFn: ()=>AttendanceAPI.sectionForDate(sectionId, date) as Promise<AttendanceResponse>, 
    enabled: !!sectionId && !!date 
  });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (payload: { date: string; marks: { studentProfileId: string; status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null; note?: string|null }[] })=>AttendanceAPI.markSection(sectionId, payload),
    onSuccess: ()=> qc.invalidateQueries({ queryKey: ['staff','att',sectionId,date] })
  });

  const rows = new Map<string,{ studentProfileId: string; status: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null; note?: string }>();
  (q.data?.rows||[]).forEach((r: AttendanceRow)=>rows.set(r.studentProfileId, r));

  function setStatus(id:string, s: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'|null){ rows.set(id, { studentProfileId:id, status: s }); }
  function submit(){ save.mutate({ date, marks: Array.from(rows.values()) }); }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Présences — Édition</h2>
      <div className="flex gap-2">
        <input className="border rounded px-2 py-1" placeholder="sectionId" value={sectionId} onChange={e=>setSectionId(e.target.value)} />
        <input className="border rounded px-2 py-1" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <button className="border rounded px-3" onClick={()=>submit()}>Enregistrer</button>
      </div>
      {q.isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr><th className="p-2 text-left">Élève</th><th className="p-2">Présent</th><th className="p-2">Absent</th><th className="p-2">Retard</th><th className="p-2">Justifié</th></tr></thead>
          <tbody>
            {(q.data?.rows||[]).map((r: AttendanceRow)=>(
              <tr key={r.studentProfileId} className="border-t">
                <td className="p-2">{r.studentName || r.studentProfileId.slice(0,8)}</td>
                {(['PRESENT','ABSENT','LATE','EXCUSED'] as const).map(s=>(
                  <td key={s} className="p-2 text-center">
                    <input type="radio" name={`r-${r.studentProfileId}`} defaultChecked={r.status===s} onChange={()=>setStatus(r.studentProfileId, s)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}