import type { PropsWithChildren, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';

export function AuthGuard({ children }: { children: ReactNode }) {
  const { data, isLoading } = useMe();
  if (isLoading) return null;
  if (!data) return <Navigate to="/sign-in" replace />;
  return <>{children}</>;
}

export function RoleGuard({ children, roles }: PropsWithChildren<{ roles: string[] }>) {
  const { data } = useMe();
  if (!data) return null;
  const allowed = data.roles?.some((r) => roles.includes(r));
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}