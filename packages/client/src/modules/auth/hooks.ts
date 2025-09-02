import { useQuery } from '@tanstack/react-query';
import { AuthAPI } from './api';

export function useMe() {
  return useQuery({ 
    queryKey: ['me'], 
    queryFn: AuthAPI.me, 
    staleTime: 60_000 
  });
}