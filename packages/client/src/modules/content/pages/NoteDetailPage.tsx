import { useParams } from 'react-router-dom';
import { useNoteDetail, useMarkRead, usePublishNote } from '../hooks';
import { Button } from '@/components/ui/button';

export default function NoteDetailPage(){
  const { id } = useParams();
  const { data, isLoading } = useNoteDetail(id!);
  const mark = useMarkRead(id!);
  const pub = usePublishNote(id!);

  if (isLoading) return <p>Chargement…</p>;
  if (!data) return <p>Introuvable</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold flex-1">{data.translation?.title || '(sans titre)'}</h2>
        {data.isPublished
          ? <Button variant="outline" onClick={()=>pub.mutate(false)}>Dépublier</Button>
          : <Button onClick={()=>pub.mutate(true)}>Publier</Button>}
        <Button variant="secondary" onClick={()=>mark.mutate()}>Marquer comme lu</Button>
      </div>

      {data.translation?.bodyMd && (
        <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(data.translation.bodyMd) }} />
      )}

      <section className="space-y-2">
        <h3 className="font-semibold">Pièces jointes</h3>
        <ul className="list-disc pl-5">
          {data.attachments.map(att => (
            <li key={att.fileId}><a className="text-blue-600 hover:underline" href={att.url}>{att.filename}</a></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Minimal MD sanitizer placeholder — replace with a real sanitizer/renderer
function sanitizeMarkdown(md?: string){
  const esc = (s:string)=>s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  return `<pre>${esc(md||'')}</pre>`;
}