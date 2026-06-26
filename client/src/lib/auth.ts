import type { AuthSession, AuthUser } from '@shared/auth';
import type { TenantIdentity } from '@shared/tenant';
import { API_BASE_URL, parseApiResponse } from '@/lib/apiBase';
import { normalizeTenantIdentity } from '@/lib/tenantIdentity';

export async function login(username: string, password: string): Promise<AuthSession & { tenant: TenantIdentity | null }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const session = await parseApiResponse<AuthSession & { tenant?: TenantIdentity | null }>(response);
  return { ...session, tenant: normalizeTenantIdentity(session.tenant) };
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  await parseApiResponse<{ ok: boolean }>(response);
}

export async function fetchCurrentSession(): Promise<AuthSession & { tenant: TenantIdentity | null }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const session = await parseApiResponse<AuthSession & { tenant?: TenantIdentity | null }>(response);
  return { ...session, tenant: normalizeTenantIdentity(session.tenant) };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthSession & { tenant?: TenantIdentity | null } | void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const session = await parseApiResponse<{ ok: boolean } & Partial<AuthSession> & { tenant?: TenantIdentity | null }>(response);
  if (session.user) return { user: session.user, tenant: normalizeTenantIdentity(session.tenant ?? null) };
}

export type { AuthUser };
