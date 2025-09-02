import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/http';

type GuardianChild = {
  profileId: string;
  firstName: string;
  lastName: string;
  code?: string | null;
};

export default function GuardianHomePage(){
  const { data, isLoading } = useQuery({ queryKey: ['guardian','children'], queryFn: () => http<{ children: GuardianChild[] }>(`/guardians/me/students`) });
  const kids = (data?.children ?? []) as GuardianChild[];
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Mes enfants</h2>
      {isLoading ? <p>Chargement…</p> : (
        <ul className="grid gap-3 md:grid-cols-3">
          {kids.map((k) => (
            <li key={k.profileId} className="border rounded-2xl p-3">
              <div className="font-medium">{k.lastName} {k.firstName}</div>
              {k.code && <div className="text-xs opacity-70">{k.code}</div>}
            </li>
          ))}
          {!kids.length && <li className="text-sm opacity-70">Aucun enfant associé.</li>}
        </ul>
      )}
    </div>
  );
}