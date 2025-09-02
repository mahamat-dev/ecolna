import { Navigate } from 'react-router-dom';
import { useMe } from './hooks';

export function RequireRoles({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  // ADMIN should pass all guards for testing
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  const userRoles = data?.user.roles || [];
  const ok = userRoles.includes('ADMIN') || roles.some(r => userRoles.includes(r));
  return ok ? <>{children}</> : <Navigate to="/" replace />;
}