import { useQuery } from '@tanstack/react-query';
import { TeachingAPI, AcademicsAPI, type TeachingAssignment } from '@/modules/shared/api';

type TimetableItem = { sectionId: string; sectionName: string; subjectName?: string | null; startsAt: string; endsAt: string };

export default function TeacherHomePage() {
  const todayISO = new Date().toISOString().slice(0,10);
  const { data: timetable } = useQuery({ queryKey: ['teacher','timetable', todayISO], queryFn: () => AcademicsAPI.myTimetable(todayISO) });
  const { data: assignments, isLoading } = useQuery({ queryKey: ['teacher','assignments'], queryFn: TeachingAPI.myAssignments });

  const classes = (assignments ?? []) as TeachingAssignment[];
  const ttItems = ((timetable as { items?: TimetableItem[] } | undefined)?.items ?? []) as TimetableItem[];

  return (
    <div className="space-y-6">
      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-semibold">Aujourd'hui</h2>
        {!ttItems.length ? (
          <p className="text-sm opacity-70">Aucun cours programmé aujourd'hui.</p>
        ) : (
          <ul className="space-y-2">
            {ttItems.map((c) => (
              <li key={`${c.sectionId}-${c.startsAt}`} className="flex items-center justify-between">
                <span>{c.sectionName} — {c.subjectName}</span>
                <span className="text-xs opacity-70">{new Date(c.startsAt).toLocaleTimeString()}–{new Date(c.endsAt).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border rounded-2xl p-4">
        <h2 className="text-lg font-semibold">Mes classes</h2>
        {isLoading ? (
          <p>Chargement…</p>
        ) : !classes.length ? (
          <p className="text-sm opacity-70">Aucune classe affectée.</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {classes.map((a) => (
              <li key={a.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="font-medium">Section: {a.classSectionId}</div>
                    <div className="text-xs opacity-70">Matière: {a.subjectId || '—'} • Chef: {a.isLead ? 'Oui' : 'Non'} • Salle principale: {a.isHomeroom ? 'Oui' : 'Non'}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}