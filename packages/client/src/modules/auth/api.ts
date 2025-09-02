import { get } from '@/lib/api';
import type { Me } from './types';

export const AuthAPI = {
  me: () => get<Me>('/me'),
};