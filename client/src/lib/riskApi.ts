const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || body?.message || `Request failed with status ${response.status}`);
  }
  return body as T;
}

export type RiskUserRole = 'system_admin' | 'risk_admin' | 'viewer';

export type RiskAppUser = {
  id: string;
  username: string;
  display_name?: string;
  name?: string;
  role: RiskUserRole;
  role_name?: RiskUserRole;
  is_active: boolean;
  must_change_password?: boolean;
  failed_attempts?: number;
  locked_until?: string | null;
  last_login_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RiskAuditLog = {
  id?: string | number;
  user_id?: string | number | null;
  username?: string | null;
  action?: string;
  details?: unknown;
  created_at?: string;
  ip_address?: string;
  [key: string]: unknown;
};

export type RiskSystemStatus = {
  version: string;
  database: string;
  generated_at: string;
  users: {
    total: number;
    active: number;
    inactive: number;
    pending_password_changes: number;
    locked: number;
  };
  security: {
    failed_logins_24h: number;
  };
  last_audit?: RiskAuditLog | null;
};

export type RiskBackup = {
  version?: string;
  exported_at?: string;
  settings?: Record<string, unknown>;
  users?: RiskAppUser[];
  audit_logs?: RiskAuditLog[];
  dashboard_state?: Array<{ key?: string; state_key?: string; state?: unknown; state_value?: unknown; updated_at?: string }>;
};

export async function getRiskSettings(): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/app/settings`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ settings: Record<string, unknown> }>(response);
  return body.settings;
}

export async function saveRiskSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE_URL}/api/app/settings`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings }),
  });
  const body = await parseResponse<{ settings: Record<string, unknown> }>(response);
  return body.settings;
}

export async function listRiskUsers(): Promise<RiskAppUser[]> {
  const response = await fetch(`${API_BASE_URL}/api/app/users`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ users: RiskAppUser[] }>(response);
  return body.users;
}

export async function createRiskUser(payload: { username: string; password: string; display_name: string; role_name: RiskUserRole; is_active?: boolean }): Promise<RiskAppUser> {
  const response = await fetch(`${API_BASE_URL}/api/app/users`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<{ user: RiskAppUser }>(response);
  return body.user;
}

export async function updateRiskUser(id: string, payload: Partial<{ display_name: string; role_name: RiskUserRole; is_active: boolean }>): Promise<RiskAppUser> {
  const response = await fetch(`${API_BASE_URL}/api/app/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await parseResponse<{ user: RiskAppUser }>(response);
  return body.user;
}

export async function resetRiskUserPassword(id: string, password: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/app/users/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function toggleRiskUserActive(id: string): Promise<RiskAppUser> {
  const response = await fetch(`${API_BASE_URL}/api/app/users/${encodeURIComponent(id)}/toggle-active`, {
    method: 'POST',
    credentials: 'include',
  });
  const body = await parseResponse<{ user: RiskAppUser }>(response);
  return body.user;
}

export async function getRiskAuditLogs(limit = 100): Promise<RiskAuditLog[]> {
  const response = await fetch(`${API_BASE_URL}/api/app/audit-logs?limit=${limit}`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ audit_logs: RiskAuditLog[] }>(response);
  return body.audit_logs;
}

export async function getRiskSystemStatus(): Promise<RiskSystemStatus> {
  const response = await fetch(`${API_BASE_URL}/api/app/system-status`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ status: RiskSystemStatus }>(response);
  return body.status;
}

export async function getRiskBackup(): Promise<RiskBackup> {
  const response = await fetch(`${API_BASE_URL}/api/app/backup`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ backup: RiskBackup }>(response);
  return body.backup;
}

export async function restoreRiskBackup(backup: RiskBackup): Promise<{ settings: number; dashboard_state: number }> {
  const response = await fetch(`${API_BASE_URL}/api/app/restore`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ backup }),
  });
  const body = await parseResponse<{ ok: boolean; restored: { settings: number; dashboard_state: number } }>(response);
  return body.restored;
}

export async function getRiskDashboardState<T = unknown>(key = 'default'): Promise<T | null> {
  const response = await fetch(`${API_BASE_URL}/api/app/dashboard-state?key=${encodeURIComponent(key)}`, { credentials: 'include', cache: 'no-store' });
  const body = await parseResponse<{ state: T | null }>(response);
  return body.state;
}

export async function saveRiskDashboardState(key: string, state: unknown): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/app/dashboard-state`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, state }),
  });
  await parseResponse<{ ok: boolean }>(response);
}
