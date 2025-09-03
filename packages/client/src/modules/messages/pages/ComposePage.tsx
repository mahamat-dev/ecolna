import { useState, useEffect } from 'react';
import { MessagesAPI } from '../api';
import { Button } from '@/components/ui/button';
import { get } from '@/lib/api';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

export default function ComposePage() {
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const userData = await get<User[]>('admin/users');
        setUsers(userData);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const onSend = async () => {
    setErr(null); setOk(null); setSending(true);
    try {
      await MessagesAPI.send({ recipients: selectedRecipients, subject, body });
      setOk('Message sent.');
      setSelectedRecipients([]); setSubject(''); setBody('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Compose Message</h1>
      {err && <div className="text-red-600">{err}</div>}
      {ok && <div className="text-green-700">{ok}</div>}
      <div className="space-y-2">
        <label className="block text-sm text-gray-600">Recipients ({selectedRecipients.length} selected)</label>
        {loadingUsers ? (
          <div className="text-gray-500">Loading users...</div>
        ) : (
          <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1">
            {users.map(user => (
              <label key={user.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedRecipients.includes(user.id)}
                  onChange={() => toggleRecipient(user.id)}
                  className="rounded"
                />
                <span className="flex-1">
                  {user.firstName} {user.lastName} ({user.email})
                  {user.roles && user.roles.length > 0 && (
                    <span className="text-xs text-gray-500 ml-2">{user.roles.join(', ')}</span>
                  )}
                </span>
              </label>
            ))}
          </div>
         )}
       </div>
       <div className="space-y-2">
        <label className="block text-sm text-gray-600">Subject</label>
        <input className="w-full border rounded p-2" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject" />
      </div>
      <div className="space-y-2">
        <label className="block text-sm text-gray-600">Body</label>
        <textarea className="w-full border rounded p-2" rows={8} value={body} onChange={e=>setBody(e.target.value)} placeholder="Write your message…" />
      </div>
      <Button onClick={onSend} disabled={sending || !body.trim() || selectedRecipients.length === 0}>Send</Button>
    </div>
  );
}

