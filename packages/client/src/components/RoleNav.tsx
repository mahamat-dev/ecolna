import { Link } from 'react-router-dom';
import { useMe } from '@/modules/auth/hooks';

export function RoleNav(){
  const { data } = useMe();
  const roles = new Set(data?.user.roles || []);
  return (
    <nav className="space-y-1">
      {roles.has('TEACHER') || roles.has('ADMIN') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Enseignant</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/teacher">Espace Enseignant</Link>
        </>
      ):null}
      {roles.has('STUDENT') || roles.has('ADMIN') || roles.has('TEACHER') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Élève</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/student">Accueil élève</Link>
        </>
      ):null}
      {/* Finance */}
      {(roles.has('ADMIN') || roles.has('STAFF')) && (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Finance</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/fees/schedules">Barèmes</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/fees/assign">Affectations</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/invoices">Factures</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/payments">Paiements</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/advances/admin">Avances (admin)</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/payroll">Paie</Link>
        </>
      )}
      {(roles.has('STUDENT') || roles.has('GUARDIAN')) && (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Finance</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/me/invoices">Mes factures</Link>
        </>
      )}
      {(roles.has('STAFF') || roles.has('TEACHER')) && (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Finance</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/advances">Avances</Link>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/finance/me/payslips">Mes fiches de paie</Link>
        </>
      )}
      {roles.has('GUARDIAN') || roles.has('ADMIN') || roles.has('STAFF') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Parent</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/guardian">Espace Parent</Link>
        </>
      ):null}
      {roles.has('STAFF') || roles.has('ADMIN') ? (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Personnel</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/staff">Espace Personnel</Link>
        </>
      ):null}
    </nav>
  );
}
      {(roles.has('ADMIN') || roles.has('STAFF') || roles.has('TEACHER')) && (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Discipline</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/discipline/incidents">Incidents</Link>
          {(roles.has('ADMIN') || roles.has('STAFF')) && (
            <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/discipline/categories">Catégories</Link>
          )}
          {(roles.has('ADMIN') || roles.has('STAFF')) && (
            <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/discipline/detention">Séances de retenue</Link>
          )}
        </>
      )}
      {(roles.has('STUDENT') || roles.has('GUARDIAN')) && (
        <>
          <div className="px-2 text-xs uppercase opacity-60">Discipline</div>
          <Link className="block px-3 py-2 rounded hover:bg-gray-50" to="/discipline/me">Mon dossier</Link>
        </>
      )}
