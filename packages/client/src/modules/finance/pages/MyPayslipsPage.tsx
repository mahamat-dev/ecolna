import { useMyPayslips } from '../hooks';

export default function MyPayslipsPage(){
  const { data, isLoading, isError, refetch } = useMyPayslips();
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mes fiches de paie</h1>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border">
          <thead><tr className="bg-gray-50"><th className="border px-3 py-2 text-left">Brut</th><th className="border px-3 py-2 text-left">Primes</th><th className="border px-3 py-2 text-left">Retenues</th><th className="border px-3 py-2 text-left">Net</th><th className="border px-3 py-2 text-left">Statut</th></tr></thead>
          <tbody>
            {items.map((it:any)=> (
              <tr key={it.id} className="hover:bg-gray-50">
                <td className="border px-3 py-2">{(it.grossCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.allowancesCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.deductionsCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{(it.netCents/100).toFixed(2)}</td>
                <td className="border px-3 py-2">{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

