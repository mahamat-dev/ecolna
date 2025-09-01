import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api';

export type Me = {
  id: string;
  email?: string;
  loginId?: string;
  roles: string[];
  profile?: { firstName?: string; lastName?: string } | null;
};

type MeResponse = {
  user: { id: string; email?: string; loginId?: string; roles: string[] };
  profile: { firstName?: string; lastName?: string } | null;
};

export function useMe() {
  return useQuery<Me>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await get<MeResponse>('me');
      return { id: res.user.id, email: res.user.email, loginId: res.user.loginId, roles: res.user.roles, profile: res.profile };
    },
  });
}