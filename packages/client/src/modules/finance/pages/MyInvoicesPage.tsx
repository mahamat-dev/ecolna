import { useInvoices } from '../hooks';

export default function MyInvoicesPage(){
  const { data, isLoading, isError, refetch } = useInvoices();
  const items = data?.items || [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Mes factures</h1>
      {isLoading && <div>Chargement…</div>}
      {isError && <div className="text-red-600">Erreur <button className="underline" onClick={()=>refetch()}>Réessayer</button></div>}
      <div className="space-y-3">
        {items.map((inv:any)=> (
          <div key={inv.id} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{(inv.totalCents/100).toFixed(2)} {inv.currency}</div>
              <div className="text-xs opacity-70">{inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString() : ''}</div>
            </div>
            <div className="text-sm opacity-70">Statut: {inv.status}</div>
          </div>
        ))}
        {!items.length && <div className="text-sm opacity-60">Aucune facture.</div>}
      </div>
    </div>
  );
}

