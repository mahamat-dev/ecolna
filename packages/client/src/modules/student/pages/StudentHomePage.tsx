import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ContentAPI, AcademicsAPI } from '@/modules/shared/api';
import { getCurrentLocale } from '@/lib/locale';

type TimetableItem = { sectionId: string; sectionName: string; subjectName?: string | null; startsAt: string; endsAt: string };
	export default function StudentHomePage(){
  const { data: notes } = useQuery({ queryKey: ['student','notes'], queryFn: () => ContentAPI.listNotes({ limit: 5, locale: getCurrentLocale() }) });
  const today = new Date().toISOString().slice(0,10);
  const { data: tt } = useQuery({ queryKey: ['student','timetable', today], queryFn: () => AcademicsAPI.myTimetable(today) });
  const items = ((tt as { items?: TimetableItem[] } | undefined)?.items ?? []) as TimetableItem[];
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className="border rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Annonces récentes</h3>
        <ul className="space-y-2">
          {(notes?.items || []).map(n => (
            <li key={n.id} className="flex items-center justify-between">
              <Link className="text-blue-600 hover:underline" to={`/student/notes/${n.id}`}>{n.title}</Link>
              <span className="text-xs opacity-70">{n.publishedAt && new Date(n.publishedAt).toLocaleDateString()}</span>
            </li>
          ))}
          {!notes?.items?.length && <li className="text-sm opacity-70">Aucune annonce.</li>}
        </ul>
      </section>
      <section className="border rounded-2xl p-4">
        <h3 className="font-semibold mb-2">Cours aujourd’hui</h3>
        <ul className="space-y-2">
          {items.map((c)=> (
            <li key={`${c.sectionId}-${c.startsAt}`} className="flex items-center justify-between">
              <span>{c.sectionName} — {c.subjectName}</span>
              <span className="text-xs opacity-70">{new Date(c.startsAt).toLocaleTimeString()}–{new Date(c.endsAt).toLocaleTimeString()}</span>
            </li>
          ))}
          {!items.length && <li className="text-sm opacity-70">Pas de cours programmés.</li>}
        </ul>
      </section>
    </div>
  );
}