import type { TenantRole } from './tenant';

export type UserRole = TenantRole | 'viewer';

export interface AuthUser {
  id: string;
  tenant_id: string;
  username: string;
  email?: string;
  name: string;
  display_name?: string;
  role: UserRole;
  role_name?: UserRole;
  is_active: boolean;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: AuthUser;
}
