import { useEffect, useState } from 'react';
import { DisciplineAPI } from '../api';

export default function CategoriesPage(){
  const [items, setItems] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [defaultPoints, setPts] = useState<number>(0);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  async function load(){
    const res = await DisciplineAPI.listCategories();
    setItems(res.items || []);
  }
  useEffect(() => { void load(); }, []);

  async function onCreate(){
    setLoading(true);
    try {
      await DisciplineAPI.createCategory({ code, defaultPoints, translations: [{ locale: 'fr', name, description: desc || undefined }] });
      setCode(''); setPts(0); setName(''); setDesc('');
      await load();
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Catégories d’incident</h1>
      <div className="grid md:grid-cols-4 gap-2 items-end">
        <input className="border rounded px-2 py-1" placeholder="Code (ex: BULLYING)" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
        <input type="number" className="border rounded px-2 py-1" placeholder="Points par défaut" value={defaultPoints} onChange={e=>setPts(parseInt(e.target.value||'0'))} />
        <input className="border rounded px-2 py-1" placeholder="Nom (fr)" value={name} onChange={e=>setName(e.target.value)} />
        <button className="border rounded px-3 py-1" onClick={onCreate} disabled={loading || !code || !name}>Créer</button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border px-3 py-2 text-left">Code</th>
              <th className="border px-3 py-2 text-left">Points défaut</th>
              <th className="border px-3 py-2 text-left">Créé le</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c:any)=> (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{c.code}</td>
                <td className="border px-3 py-2">{c.defaultPoints}</td>
                <td className="border px-3 py-2">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

