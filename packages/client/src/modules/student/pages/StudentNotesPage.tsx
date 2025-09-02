import { useQuery } from '@tanstack/react-query';
import { ContentAPI } from '@/modules/shared/api';
import { Link } from 'react-router-dom';
import { getCurrentLocale } from '@/lib/locale';
import type { NoteListItem } from '@/modules/content/types';

export default function StudentNotesPage(){
  const { data, isLoading } = useQuery({ queryKey: ['student','notes', getCurrentLocale()], queryFn: ()=> ContentAPI.listNotes({ limit: 20, locale: getCurrentLocale() }) });
  if (isLoading) return <p>Chargement…</p>;
  const items = data?.items as NoteListItem[] | undefined;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Annonces récentes</h2>
      {!items?.length ? <p>Aucune note.</p> : (
        <ul className="divide-y border rounded-xl">
          {items.map((n)=> (
            <li key={n.id} className="p-3 hover:bg-muted/40">
              <Link to={`/student/notes/${n.id}`} className="block">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {n.publishedAt && <span className="text-xs opacity-70 ml-auto">{new Date(n.publishedAt).toLocaleDateString()}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}