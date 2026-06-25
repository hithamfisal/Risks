import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileClock,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  ToggleLeft,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { changePassword } from '@/lib/auth';
import {
  createRiskUser,
  getRiskAuditLogs,
  getRiskSettings,
  listRiskUsers,
  resetRiskUserPassword,
  saveRiskSettings,
  toggleRiskUserActive,
  updateRiskUser,
  type RiskAppUser,
  type RiskAuditLog,
  type RiskUserRole,
} from '@/lib/riskApi';

const roles: RiskUserRole[] = ['system_admin', 'risk_admin', 'viewer'];

const inputStyle = (isDark: boolean) => ({
  width: '100%',
  height: 40,
  borderRadius: 10,
  border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.14)',
  background: isDark ? 'rgba(15,23,42,.58)' : 'rgba(255,255,255,.94)',
  color: isDark ? '#F8FAFC' : '#172033',
  padding: '0 12px',
  fontWeight: 750,
  outline: 'none',
});

const buttonStyle = {
  height: 38,
  borderRadius: 999,
  border: 'none',
  background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)',
  color: 'white',
  fontWeight: 900,
  fontSize: 12,
  padding: '0 14px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 7,
  cursor: 'pointer',
} as const;

function roleLabel(role?: string) {
  if (role === 'system_admin') return 'System Admin';
  if (role === 'risk_admin') return 'Risk Admin';
  return 'Viewer';
}

function downloadText(fileName: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set<string>()));
  const escape = (value: unknown) => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [columns.join(','), ...rows.map(row => columns.map(column => escape(row[column])).join(','))].join('\n');
}

export default function SystemManagementPage() {
  const { user, tenant, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isSystemAdmin = user?.role === 'system_admin';
  const [users, setUsers] = useState<RiskAppUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<RiskAuditLog[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ username: '', display_name: '', password: '', role_name: 'viewer' as RiskUserRole });
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [resetDialog, setResetDialog] = useState<{ user: RiskAppUser; password: string; confirm: string } | null>(null);
  const [settingForm, setSettingForm] = useState({
    default_dashboard_view: 'overview',
    dashboard_save_status: 'enabled',
    data_retention_days: '365',
  });

  const cover = tenant?.cover_image_url || (isDark ? '/assets/dark.png' : '/assets/light.png');
  const cardStyle = useMemo(() => ({
    borderRadius: 24,
    padding: 20,
    background: isDark ? 'rgba(6,20,48,.88)' : 'rgba(255,255,255,.92)',
    border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.12)',
    boxShadow: isDark ? '0 24px 70px rgba(0,0,0,.3)' : '0 24px 70px rgba(31,56,100,.12)',
    backdropFilter: 'blur(18px)',
  }), [isDark]);

  async function loadManagementData() {
    setLoading(true);
    setError('');
    try {
      const [nextSettings, nextAudit, nextUsers] = await Promise.all([
        getRiskSettings(),
        isSystemAdmin ? getRiskAuditLogs(100) : Promise.resolve([]),
        isSystemAdmin ? listRiskUsers() : Promise.resolve([]),
      ]);
      setSettings(nextSettings);
      setAuditLogs(nextAudit);
      setUsers(nextUsers);
      setSettingForm({
        default_dashboard_view: String(nextSettings.default_dashboard_view || 'overview'),
        dashboard_save_status: String(nextSettings.dashboard_save_status || 'enabled'),
        data_retention_days: String(nextSettings.data_retention_days || '365'),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load management data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadManagementData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSystemAdmin]);

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatus('');
    if (passwordForm.next !== passwordForm.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      await changePassword(passwordForm.current, passwordForm.next);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setStatus('Password changed successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    }
  }

  async function submitSettings(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const next = await saveRiskSettings(settingForm);
      setSettings(next);
      setStatus('System settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save system settings.');
    }
  }

  async function submitNewUser(event: FormEvent) {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      const created = await createRiskUser(newUser);
      setUsers(prev => [...prev, created]);
      setNewUser({ username: '', display_name: '', password: '', role_name: 'viewer' });
      setStatus(`User ${created.username} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create user.');
    }
  }

  async function saveUser(userRow: RiskAppUser) {
    setError('');
    setStatus('');
    try {
      const updated = await updateRiskUser(String(userRow.id), {
        display_name: userRow.display_name || userRow.name || userRow.username,
        role_name: userRow.role_name || userRow.role,
        is_active: Boolean(userRow.is_active),
      });
      setUsers(prev => prev.map(row => String(row.id) === String(updated.id) ? updated : row));
      setStatus(`User ${updated.username} updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update user.');
    }
  }

  function openResetPassword(userRow: RiskAppUser) {
    setResetDialog({ user: userRow, password: '', confirm: '' });
    setError('');
    setStatus('');
  }

  async function submitResetPassword(event: FormEvent) {
    event.preventDefault();
    if (!resetDialog) return;
    if (resetDialog.password.length < 8) {
      setError('Reset password must be at least 8 characters.');
      return;
    }
    if (resetDialog.password !== resetDialog.confirm) {
      setError('Reset password confirmation does not match.');
      return;
    }
    setError('');
    setStatus('');
    try {
      await resetRiskUserPassword(String(resetDialog.user.id), resetDialog.password);
      setStatus(`Password reset for ${resetDialog.user.username}.`);
      setResetDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    }
  }

  async function toggleUser(userRow: RiskAppUser) {
    setError('');
    setStatus('');
    try {
      const updated = await toggleRiskUserActive(String(userRow.id));
      setUsers(prev => prev.map(row => String(row.id) === String(updated.id) ? updated : row));
      setStatus(`${updated.username} is now ${updated.is_active ? 'active' : 'inactive'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to toggle user status.');
    }
  }

  function exportSettings() {
    downloadText('risk-settings.json', JSON.stringify(settings, null, 2));
  }

  function exportUsers() {
    const rows = users.map(row => ({ ...row, role: row.role_name || row.role }));
    downloadText('risk-users.csv', toCsv(rows as Array<Record<string, unknown>>), 'text/csv');
  }

  function exportAudit() {
    downloadText('risk-audit-logs.csv', toCsv(auditLogs as Array<Record<string, unknown>>), 'text/csv');
  }

  function updateUserDraft(id: string | number, patch: Partial<RiskAppUser>) {
    setUsers(prev => prev.map(row => String(row.id) === String(id) ? { ...row, ...patch } : row));
  }

  return (
    <div
      dir="ltr"
      style={{
        minHeight: '100vh',
        color: isDark ? '#F8FAFC' : '#172033',
        backgroundColor: isDark ? '#061630' : '#F8FBFF',
        backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.78), rgba(2,6,23,.42))' : 'linear-gradient(90deg, rgba(255,255,255,.84), rgba(255,255,255,.62))'}, url(${cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      <header style={{ minHeight: 68, background: '#0b1120', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 14, padding: '10px 22px', boxShadow: '0 12px 38px rgba(0,0,0,.28)', flexWrap: 'wrap' }}>
        <Link href="/admin" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', color: 'white', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', textDecoration: 'none' }} title="Back to admin portal">
          <ArrowLeft size={18} />
        </Link>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center', color: 'white' }}>
          <Settings size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ color: 'white', fontWeight: 950, fontSize: 19, lineHeight: 1.1 }}>System Management</div>
          <div style={{ color: 'rgba(255,255,255,.58)', fontWeight: 800, fontSize: 12 }}>Users, settings, exports, password, and audit trail</div>
        </div>
        <Link href="/customer" style={{ height: 38, borderRadius: 999, padding: '0 14px', color: 'white', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900 }}>
          <Eye size={16} /> Customer Portal
        </Link>
        <button onClick={logout} style={{ height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.08)', color: 'white', fontWeight: 900, fontSize: 12, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '28px 16px 56px', display: 'grid', gap: 18 }}>
        {(status || error) && (
          <div style={{ borderRadius: 16, padding: '12px 14px', border: error ? '1px solid rgba(239,68,68,.34)' : '1px solid rgba(34,197,94,.34)', background: error ? 'rgba(239,68,68,.13)' : 'rgba(34,197,94,.13)', color: error ? (isDark ? '#fecaca' : '#991b1b') : (isDark ? '#bbf7d0' : '#166534'), display: 'flex', alignItems: 'center', gap: 9, fontWeight: 850 }}>
            {error ? <Lock size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || status}</span>
          </div>
        )}

        <section style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950 }}>Management Console</h1>
              <p style={{ margin: '7px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontWeight: 750 }}>Current user: {user?.username} · {roleLabel(user?.role)}</p>
            </div>
            <button onClick={loadManagementData} disabled={loading} style={{ ...buttonStyle, background: loading ? 'rgba(148,163,184,.5)' : buttonStyle.background }}>
              <RefreshCw size={15} /> {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Metric label="Users" value={isSystemAdmin ? String(users.length) : 'System Admin only'} icon={<Users size={18} />} isDark={isDark} />
            <Metric label="Audit Logs" value={isSystemAdmin ? String(auditLogs.length) : 'System Admin only'} icon={<FileClock size={18} />} isDark={isDark} />
            <Metric label="Settings" value={`${Object.keys(settings).length} saved keys`} icon={<Settings size={18} />} isDark={isDark} />
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 18, alignItems: 'start' }}>
          <section style={{ ...cardStyle }}>
            <SectionTitle icon={<KeyRound size={18} />} title="Change Password" />
            <form onSubmit={submitPassword} style={{ display: 'grid', gap: 12 }}>
              <input type="password" placeholder="Current password" value={passwordForm.current} onChange={event => setPasswordForm(prev => ({ ...prev, current: event.target.value }))} style={inputStyle(isDark)} required />
              <input type="password" placeholder="New password" value={passwordForm.next} onChange={event => setPasswordForm(prev => ({ ...prev, next: event.target.value }))} style={inputStyle(isDark)} required minLength={8} />
              <input type="password" placeholder="Confirm new password" value={passwordForm.confirm} onChange={event => setPasswordForm(prev => ({ ...prev, confirm: event.target.value }))} style={inputStyle(isDark)} required minLength={8} />
              <button type="submit" style={buttonStyle}><Save size={15} /> Change Password</button>
            </form>
          </section>

          <section style={{ ...cardStyle }}>
            <SectionTitle icon={<Settings size={18} />} title="System Settings" />
            <form onSubmit={submitSettings} style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 900 }}>
                Default Dashboard View
                <select value={settingForm.default_dashboard_view} onChange={event => setSettingForm(prev => ({ ...prev, default_dashboard_view: event.target.value }))} style={inputStyle(isDark)}>
                  <option value="overview">Overview</option>
                  <option value="register">Risk Register</option>
                  <option value="charts">Charts</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 900 }}>
                Dashboard Save Status
                <select value={settingForm.dashboard_save_status} onChange={event => setSettingForm(prev => ({ ...prev, dashboard_save_status: event.target.value }))} style={inputStyle(isDark)}>
                  <option value="enabled">Enabled</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6, fontSize: 12, fontWeight: 900 }}>
                Data Retention Days
                <input value={settingForm.data_retention_days} onChange={event => setSettingForm(prev => ({ ...prev, data_retention_days: event.target.value }))} style={inputStyle(isDark)} inputMode="numeric" />
              </label>
              <button type="submit" style={buttonStyle}><Save size={15} /> Save Settings</button>
            </form>
          </section>

          <section style={{ ...cardStyle }}>
            <SectionTitle icon={<Download size={18} />} title="Backup & Export" />
            <div style={{ display: 'grid', gap: 10 }}>
              <button type="button" onClick={exportSettings} style={buttonStyle}><Download size={15} /> Export Settings JSON</button>
              <button type="button" onClick={exportUsers} disabled={!isSystemAdmin} style={{ ...buttonStyle, opacity: isSystemAdmin ? 1 : .55 }}><Download size={15} /> Export Users CSV</button>
              <button type="button" onClick={exportAudit} disabled={!isSystemAdmin} style={{ ...buttonStyle, opacity: isSystemAdmin ? 1 : .55 }}><Download size={15} /> Export Audit CSV</button>
            </div>
          </section>
        </div>

        {isSystemAdmin && (
          <section style={{ ...cardStyle }}>
            <SectionTitle icon={<Users size={18} />} title="User Management" />
            <form onSubmit={submitNewUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto', gap: 10, alignItems: 'end', marginBottom: 16 }}>
              <input placeholder="Username" value={newUser.username} onChange={event => setNewUser(prev => ({ ...prev, username: event.target.value }))} style={inputStyle(isDark)} required />
              <input placeholder="Display name" value={newUser.display_name} onChange={event => setNewUser(prev => ({ ...prev, display_name: event.target.value }))} style={inputStyle(isDark)} required />
              <input type="password" placeholder="Password" value={newUser.password} onChange={event => setNewUser(prev => ({ ...prev, password: event.target.value }))} style={inputStyle(isDark)} minLength={8} required />
              <select value={newUser.role_name} onChange={event => setNewUser(prev => ({ ...prev, role_name: event.target.value as RiskUserRole }))} style={inputStyle(isDark)}>
                {roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
              </select>
              <button type="submit" style={buttonStyle}><Plus size={15} /> Create</button>
            </form>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', minWidth: 860 }}>
                <thead>
                  <tr style={{ color: isDark ? '#A8C3DD' : '#64748B', fontSize: 12, textAlign: 'left' }}>
                    <th>User</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(row => (
                    <tr key={String(row.id)} style={{ background: isDark ? 'rgba(15,23,42,.55)' : '#F8FAFC' }}>
                      <td style={{ padding: 10, borderRadius: '12px 0 0 12px', fontWeight: 900 }}>{row.username}</td>
                      <td style={{ padding: 10 }}>
                        <input value={row.display_name || row.name || ''} onChange={event => updateUserDraft(row.id, { display_name: event.target.value })} style={inputStyle(isDark)} />
                      </td>
                      <td style={{ padding: 10 }}>
                        <select value={row.role_name || row.role} onChange={event => updateUserDraft(row.id, { role_name: event.target.value as RiskUserRole, role: event.target.value as RiskUserRole })} style={inputStyle(isDark)}>
                          {roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: 10, fontWeight: 900, color: row.is_active ? '#16a34a' : '#dc2626' }}>{row.is_active ? 'Active' : 'Inactive'}</td>
                      <td style={{ padding: 10, fontSize: 12 }}>{row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Never'}</td>
                      <td style={{ padding: 10, borderRadius: '0 12px 12px 0' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => saveUser(row)} style={buttonStyle}><Save size={14} /> Save</button>
                          <button type="button" onClick={() => openResetPassword(row)} style={{ ...buttonStyle, background: '#334155' }}><KeyRound size={14} /> Reset</button>
                          <button type="button" onClick={() => toggleUser(row)} style={{ ...buttonStyle, background: row.is_active ? '#b91c1c' : '#15803d' }}><ToggleLeft size={14} /> {row.is_active ? 'Deactivate' : 'Activate'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {isSystemAdmin && (
          <section style={{ ...cardStyle }}>
            <SectionTitle icon={<FileClock size={18} />} title="Audit Logs" />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px', minWidth: 760 }}>
                <thead>
                  <tr style={{ color: isDark ? '#A8C3DD' : '#64748B', fontSize: 12, textAlign: 'left' }}>
                    <th>Time</th>
                    <th>Action</th>
                    <th>User</th>
                    <th>IP</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((row, index) => (
                    <tr key={`${row.id || index}`} style={{ background: isDark ? 'rgba(15,23,42,.55)' : '#F8FAFC' }}>
                      <td style={{ padding: 10, borderRadius: '12px 0 0 12px', fontSize: 12 }}>{row.created_at ? new Date(row.created_at).toLocaleString() : '-'}</td>
                      <td style={{ padding: 10, fontWeight: 900 }}>{row.action || '-'}</td>
                      <td style={{ padding: 10 }}>{row.username || row.user_id || '-'}</td>
                      <td style={{ padding: 10 }}>{row.ip_address || '-'}</td>
                      <td style={{ padding: 10, borderRadius: '0 12px 12px 0', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeof row.details === 'string' ? row.details : JSON.stringify(row.details || {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {resetDialog && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(2,6,23,.62)', display: 'grid', placeItems: 'center', padding: 18 }}>
            <form onSubmit={submitResetPassword} style={{ width: 'min(100%, 440px)', borderRadius: 20, padding: 20, background: isDark ? '#061430' : '#FFFFFF', border: isDark ? '1px solid rgba(125,211,252,.24)' : '1px solid rgba(31,56,100,.14)', boxShadow: '0 28px 80px rgba(0,0,0,.32)', display: 'grid', gap: 12 }}>
              <SectionTitle icon={<KeyRound size={18} />} title={`Reset ${resetDialog.user.username}`} />
              <input
                type="password"
                placeholder="New password"
                value={resetDialog.password}
                onChange={event => setResetDialog(prev => prev ? { ...prev, password: event.target.value } : prev)}
                style={inputStyle(isDark)}
                minLength={8}
                autoComplete="new-password"
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={resetDialog.confirm}
                onChange={event => setResetDialog(prev => prev ? { ...prev, confirm: event.target.value } : prev)}
                style={inputStyle(isDark)}
                minLength={8}
                autoComplete="new-password"
                required
              />
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setResetDialog(null)} style={{ ...buttonStyle, background: isDark ? '#334155' : '#64748B' }}>Cancel</button>
                <button type="submit" style={buttonStyle}><Save size={15} /> Save Password</button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <h2 style={{ margin: '0 0 14px', fontSize: 18, fontWeight: 950, display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      {title}
    </h2>
  );
}

function Metric({ icon, label, value, isDark }: { icon: ReactNode; label: string; value: string; isDark: boolean }) {
  return (
    <div style={{ borderRadius: 18, padding: 14, background: isDark ? 'rgba(15,23,42,.55)' : '#F8FAFC', border: isDark ? '1px solid rgba(125,211,252,.14)' : '1px solid rgba(31,56,100,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDark ? '#7DD3FC' : '#075985', fontWeight: 950, fontSize: 12 }}>{icon}{label}</div>
      <div style={{ marginTop: 8, fontWeight: 950, fontSize: 18 }}>{value}</div>
    </div>
  );
}
