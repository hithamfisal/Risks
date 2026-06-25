import type { AuthSession, AuthUser } from '@shared/auth';
import type { TenantIdentity } from '@shared/tenant';
import { normalizeTenantIdentity } from '@/lib/tenantIdentity';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body?.error || body?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function login(username: string, password: string): Promise<AuthSession & { tenant: TenantIdentity | null }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const session = await parseResponse<AuthSession & { tenant: TenantIdentity | null }>(response);
  return { ...session, tenant: normalizeTenantIdentity(session.tenant) };
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function fetchCurrentSession(): Promise<AuthSession & { tenant: TenantIdentity | null }> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const session = await parseResponse<AuthSession & { tenant: TenantIdentity | null }>(response);
  return { ...session, tenant: normalizeTenantIdentity(session.tenant) };
}

export type { AuthUser };
