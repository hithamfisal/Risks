import { DEFAULT_TENANT_ID, DEFAULT_TENANT_IDENTITY, type TenantIdentity } from '@shared/tenant';
import { API_BASE_URL, parseApiResponse } from '@/lib/apiBase';

export { DEFAULT_TENANT_ID, DEFAULT_TENANT_IDENTITY };
export type { TenantIdentity };

function withAssetBase(value: string) {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith('/uploads') && API_BASE_URL) return `${API_BASE_URL}${value}`;
  return value;
}

export function normalizeTenantIdentity(tenant: TenantIdentity | null | undefined): TenantIdentity | null {
  if (!tenant) return null;
  return {
    ...tenant,
    logo_url: withAssetBase(tenant.logo_url || ''),
    cover_image_url: withAssetBase(tenant.cover_image_url || ''),
  };
}

export async function fetchTenantIdentity(targetTenantId?: string): Promise<TenantIdentity> {
  const endpoint = targetTenantId
    ? `/api/admin/tenant?tenantId=${encodeURIComponent(targetTenantId)}`
    : '/api/customer/tenant';
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await parseApiResponse<{ tenant: TenantIdentity }>(response);
  return normalizeTenantIdentity(body.tenant) || DEFAULT_TENANT_IDENTITY;
}

export async function listTenantIdentities(): Promise<TenantIdentity[]> {
  const response = await fetch(`${API_BASE_URL}/api/super-admin/tenants`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await parseApiResponse<{ tenants: TenantIdentity[] }>(response);
  return body.tenants.map(tenant => normalizeTenantIdentity(tenant) || tenant);
}

export async function patchTenantIdentity(payload: Partial<TenantIdentity> & { tenant_id?: string }): Promise<TenantIdentity> {
  const response = await fetch(`${API_BASE_URL}/api/admin/tenant`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseApiResponse<{ tenant: TenantIdentity }>(response);
  return normalizeTenantIdentity(body.tenant) || DEFAULT_TENANT_IDENTITY;
}

export async function uploadTenantImage(kind: 'logo' | 'cover', file: File, tenantId?: string): Promise<TenantIdentity> {
  const form = new FormData();
  form.append(kind, file);
  if (tenantId) form.append('tenant_id', tenantId);

  const response = await fetch(`${API_BASE_URL}/api/admin/tenant/${kind}`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  const body = await parseApiResponse<{ tenant: TenantIdentity }>(response);
  return normalizeTenantIdentity(body.tenant) || DEFAULT_TENANT_IDENTITY;
}
