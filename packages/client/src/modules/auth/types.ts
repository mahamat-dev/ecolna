export interface Me {
  user: { id: string; roles: string[] };
  profile: { id: string; code?: string; firstName?: string; lastName?: string };
}

export interface AuthUser {
  id: string;
  email?: string;
  loginId?: string;
  roles: string[];
}

export interface UserProfile {
  id: string;
  code?: string;
  firstName?: string;
  lastName?: string;
}

export interface MeResponse {
  user: AuthUser;
  profile: UserProfile | null;
}