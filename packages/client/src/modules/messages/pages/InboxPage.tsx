import { useEffect, useState } from 'react';
import { MessagesAPI } from '../api';
import type { MessageListItem } from '../types';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function InboxPage() {
  const [items, setItems] = useState<MessageListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(next?: string | null) {
    setLoading(true);
    setError(null);
    try {
      const data = await MessagesAPI.inbox(next || undefined);
      if (!next) setItems(data.items);
      else setItems(prev => [...prev, ...data.items]);
      setCursor(data.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(null); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <Link to="/messages/compose" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Compose</Link>
      </div>
      {error && <div className="text-red-600">{error}</div>}
      {loading && !items.length && <div>Loading…</div>}
      <ul className="divide-y">
        {items.map(m => (
          <li key={m.id} className="py-3">
            <Link to={`/messages/${m.id}`} className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-2 ${m.readAt ? 'bg-gray-300' : 'bg-blue-500'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">{m.subject || '(no subject)'} </div>
                  <div className="text-xs text-gray-500">from {m.senderName || m.senderProfileId?.slice(0,8)}</div>
                </div>
                <div className="text-sm text-gray-600 truncate">{m.snippet}</div>
                <div className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString()}</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-center">
        {cursor && <Button onClick={()=> load(cursor)} disabled={loading}>Load more</Button>}
      </div>
    </div>
  );
}

