import { useState } from 'react';

export function DetentionForm({ onSubmit }:{ onSubmit:(payload:any)=>void }){
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState(()=> new Date().toISOString().slice(0,16));
  const [durationMinutes, setDur] = useState(60);
  const [room, setRoom] = useState('');
  const [capacity, setCap] = useState(20);
  return (
    <form className="grid md:grid-cols-5 gap-2 items-end" onSubmit={(e)=>{ e.preventDefault(); onSubmit({
      title, dateTime: new Date(dateTime).toISOString(), durationMinutes, room: room||undefined, capacity
    })}}>
      <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Titre" value={title} onChange={e=>setTitle(e.target.value)} />
      <input type="datetime-local" className="border rounded px-2 py-1" value={dateTime} onChange={e=>setDateTime(e.target.value)} />
      <input type="number" className="border rounded px-2 py-1" value={durationMinutes} onChange={e=>setDur(parseInt(e.target.value||'60'))} />
      <input className="border rounded px-2 py-1" placeholder="Salle" value={room} onChange={e=>setRoom(e.target.value)} />
      <input type="number" className="border rounded px-2 py-1" value={capacity} onChange={e=>setCap(parseInt(e.target.value||'20'))} />
      <button className="border rounded px-3 py-1">Créer</button>
    </form>
  );
}

