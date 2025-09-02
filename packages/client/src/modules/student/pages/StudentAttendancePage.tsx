import { useQuery } from '@tanstack/react-query';
import { AttendanceAPI, type AttendanceSummaryRow } from '@/modules/shared/api';

function range(days=30){
  const end = new Date(); const start = new Date(); start.setDate(end.getDate()-days);
  const fmt = (d:Date)=>d.toISOString().slice(0,10);
  return { from: fmt(start), to: fmt(end) };
}

export default function StudentAttendancePage(){
  const { from, to } = range(30);
  const { data, isLoading } = useQuery({ queryKey: ['student','attendance',from,to], queryFn: () => AttendanceAPI.mySummary(from, to) });
  const rows = (data ?? []) as AttendanceSummaryRow[];
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Présences (30 jours)</h2>
      {isLoading ? <p>Chargement…</p> : (
        <table className="min-w-full text-sm border rounded-2xl overflow-hidden">
          <thead><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Section</th><th className="p-2">Statut</th></tr></thead>
          <tbody>
            {rows.map((r)=> (
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