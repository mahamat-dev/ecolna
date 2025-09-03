import { Link } from 'react-router-dom';

export function IncidentsTable({ items }:{ items: Array<any> }){
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th className="border px-3 py-2 text-left">Date</th>
            <th className="border px-3 py-2 text-left">Résumé</th>
            <th className="border px-3 py-2 text-left">Statut</th>
            <th className="border px-3 py-2 text-left">Visibilité</th>
            <th className="border px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((i:any)=> (
            <tr key={i.id} className="hover:bg-gray-50">
              <td className="border px-3 py-2">{i.occurredAt ? new Date(i.occurredAt).toLocaleString() : ''}</td>
              <td className="border px-3 py-2">{i.summary}</td>
              <td className="border px-3 py-2">{i.status}</td>
              <td className="border px-3 py-2">{i.visibility}</td>
              <td className="border px-3 py-2 text-right"><Link className="underline" to={`/discipline/incidents/${i.id}`}>Ouvrir</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

