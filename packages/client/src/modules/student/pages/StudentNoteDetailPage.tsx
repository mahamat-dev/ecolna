import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ContentAPI } from '@/modules/shared/api';
import { getCurrentLocale } from '@/lib/locale';
import { Button } from '@/components/ui/button';
import type { NoteDetail } from '@/modules/content/types';

export default function StudentNoteDetailPage(){
  const { id } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['student','note',id], queryFn: () => ContentAPI.getNote(id!, getCurrentLocale()) });
  const mark = useMutation({ mutationFn: () => ContentAPI.markRead(id!) });
  if (isLoading) return <p>Chargement…</p>;
  if (!data) return <p>Introuvable.</p>;
  const note = data as NoteDetail;
  return (
    <article className="space-y-3">
      <header className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{note.translation?.title}</h2>
        <span className="text-xs opacity-70 ml-auto">{note.publishedAt && new Date(note.publishedAt).toLocaleString()}</span>
      </header>
      {note.translation?.bodyMd && <pre className="border rounded-xl p-3 whitespace-pre-wrap">{note.translation.bodyMd}</pre>}
      {note.attachments?.length ? (
        <ul className="space-y-2">
          {note.attachments.map((a)=> (
            <li key={a.fileId}><a className="text-blue-600 hover:underline" href={a.url} target="_blank" rel="noreferrer">{a.filename} ({Math.round((a.sizeBytes||0)/1024)} KB)</a></li>
          ))}
        </ul>
      ) : null}
      <Button size="sm" onClick={()=>mark.mutate()} disabled={mark.isPending}>Marquer comme lu</Button>
    </article>
  );
}