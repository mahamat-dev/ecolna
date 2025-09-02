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