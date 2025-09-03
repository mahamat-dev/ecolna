import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MessagesAPI } from '../api';

export default function MessageDetailPage() {
  const { id } = useParams();
  const [msg, setMsg] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await MessagesAPI.get(id);
        setMsg(data);
        await MessagesAPI.markRead(id);
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      }
    })();
  }, [id]);

  if (error) return <div className="text-red-600">{error}</div>;
  if (!msg) return <div>Loading…</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">From: {msg.senderProfileId?.slice(0,8)} — {new Date(msg.createdAt).toLocaleString()}</div>
      <h1 className="text-xl font-semibold">{msg.subject || '(no subject)'}</h1>
      <pre className="whitespace-pre-wrap text-sm">{msg.body}</pre>
    </div>
  );
}

