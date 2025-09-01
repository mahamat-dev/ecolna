import { useState } from 'react';
import { useNotesList } from '../hooks';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function NotesListPage(){
  const [q,setQ] = useState('');
  const [cursor,setCursor] = useState<string | null>(null);
  const { data, isLoading, refetch } = useNotesList({ q, limit: 20, cursor });

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input placeholder="Rechercher" value={q} onChange={e=>setQ(e.target.value)} />
        <Button onClick={()=>{ setCursor(null); refetch(); }}>Rechercher</Button>
        <Link to="/content/notes/new" className="ml-auto"><Button>Nouveau</Button></Link>
      </div>

      {isLoading ? <p>Chargement…</p> : (
        <ul className="space-y-2">
          {items.map(n => (
            <li key={n.id} className="border rounded-xl p-3">
              <Link to={`/content/notes/${n.id}`} className="font-medium hover:underline">{n.title}</Link>
              <div className="text-xs opacity-70">{n.isPublished ? 'Publié' : 'Brouillon'} · {n.publishedAt ? new Date(n.publishedAt).toLocaleString() : ''}</div>
            </li>
          ))}
        </ul>
      )}

      {data?.nextCursor && (
        <Button variant="outline" onClick={()=>setCursor(data.nextCursor!)}>Plus</Button>
      )}
    </div>
  );
}