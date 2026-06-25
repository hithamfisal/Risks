import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCurrentSession, login as loginRequest, logout as logoutRequest, type AuthUser } from '@/lib/auth';
import type { TenantIdentity } from '@shared/tenant';

type AuthState = {
  user: AuthUser | null;
  tenant: TenantIdentity | null;
  loading: boolean;
  error: string;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<TenantIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const session = await fetchCurrentSession();
      setUser(session.user);
      setTenant(session.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const session = await loginRequest(username, password);
      setUser(session.user);
      setTenant(session.tenant);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
      setUser(null);
      setTenant(null);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await logoutRequest();
    } catch {
      // Clear local state even if the server cookie was already expired.
    } finally {
      setUser(null);
      setTenant(null);
      setLoading(false);
    }
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    tenant,
    loading,
    error,
    isAuthenticated: Boolean(user),
    login,
    logout,
    refresh,
  }), [user, tenant, loading, error, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
