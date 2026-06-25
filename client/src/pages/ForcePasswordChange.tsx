import { FormEvent, useState } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, LogOut, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { changePassword } from '@/lib/auth';

const inputStyle = (isDark: boolean) => ({
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: isDark ? '1px solid rgba(125,211,252,.24)' : '1px solid rgba(31,56,100,.14)',
  background: isDark ? 'rgba(15,23,42,.62)' : 'rgba(255,255,255,.94)',
  color: isDark ? '#F8FAFC' : '#172033',
  padding: '0 14px',
  fontWeight: 800,
  outline: 'none',
});

export default function ForcePasswordChangePage() {
  const { theme } = useTheme();
  const { user, refresh, logout } = useAuth();
  const [, setLocation] = useLocation();
  const isDark = theme === 'dark';
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (form.next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      await refresh();
      setLocation(user?.role === 'viewer' ? '/customer' : '/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="ltr" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: isDark ? '#061630' : '#F8FBFF', color: isDark ? '#F8FAFC' : '#172033' }}>
      <form onSubmit={submit} style={{ width: 'min(100%, 460px)', display: 'grid', gap: 14, borderRadius: 24, padding: 24, background: isDark ? 'rgba(6,20,48,.94)' : '#FFFFFF', border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.12)', boxShadow: isDark ? '0 28px 80px rgba(0,0,0,.36)' : '0 28px 80px rgba(31,56,100,.14)' }}>
        <div style={{ width: 58, height: 58, borderRadius: 18, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)' }}>
          <KeyRound color="white" size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>Change Password</h1>
          <p style={{ margin: '8px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontWeight: 700, lineHeight: 1.6 }}>
            Your account requires a new password before continuing.
          </p>
        </div>
        <input type="password" placeholder="Current password" value={form.current} onChange={event => setForm(prev => ({ ...prev, current: event.target.value }))} style={inputStyle(isDark)} autoComplete="current-password" required />
        <input type="password" placeholder="New password" value={form.next} onChange={event => setForm(prev => ({ ...prev, next: event.target.value }))} style={inputStyle(isDark)} autoComplete="new-password" minLength={8} required />
        <input type="password" placeholder="Confirm new password" value={form.confirm} onChange={event => setForm(prev => ({ ...prev, confirm: event.target.value }))} style={inputStyle(isDark)} autoComplete="new-password" minLength={8} required />
        {error && <div style={{ borderRadius: 14, padding: 12, background: isDark ? 'rgba(127,29,29,.35)' : '#FEE2E2', color: isDark ? '#FECACA' : '#991B1B', fontWeight: 850 }}>{error}</div>}
        <button type="submit" disabled={saving} style={{ height: 46, borderRadius: 999, border: 'none', background: saving ? 'rgba(148,163,184,.55)' : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', color: 'white', fontWeight: 950, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
          <Save size={17} /> {saving ? 'Saving...' : 'Save Password'}
        </button>
        <button type="button" onClick={logout} style={{ height: 42, borderRadius: 999, border: 'none', background: isDark ? '#334155' : '#E2E8F0', color: isDark ? '#F8FAFC' : '#172033', fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </form>
    </div>
  );
}
