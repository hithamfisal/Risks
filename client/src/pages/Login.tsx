import { FormEvent, useState } from 'react';
import { useLocation } from 'wouter';
import { LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

const inputStyle = (isDark: boolean) => ({
  width: '100%',
  height: 46,
  borderRadius: 14,
  border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.16)',
  background: isDark ? 'rgba(15,23,42,.64)' : 'rgba(255,255,255,.94)',
  color: isDark ? '#F8FAFC' : '#172033',
  padding: '0 14px',
  fontWeight: 800,
  outline: 'none',
});

export default function LoginPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { login, loading, error } = useAuth();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@12345');
  const [localError, setLocalError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError('');
    try {
      await login(username, password);
      setLocation('/');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    }
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen"
      style={{
        display: 'grid',
        placeItems: 'center',
        padding: 22,
        color: isDark ? '#F8FAFC' : '#172033',
        backgroundColor: isDark ? '#061630' : '#F8FBFF',
        backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.78), rgba(2,6,23,.46))' : 'linear-gradient(90deg, rgba(255,255,255,.82), rgba(255,255,255,.58))'}, url(${isDark ? '/assets/dark.png' : '/assets/light.png'})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 'min(100%, 460px)',
          borderRadius: 28,
          padding: 28,
          background: isDark ? 'rgba(6, 20, 48, 0.9)' : 'rgba(255,255,255,0.92)',
          border: isDark ? '1px solid rgba(125,211,252,0.22)' : '1px solid rgba(31,56,100,0.12)',
          boxShadow: isDark ? '0 28px 90px rgba(0,0,0,.38)' : '0 28px 90px rgba(31,56,100,.18)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ width: 58, height: 58, borderRadius: 18, margin: '0 auto 16px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #0078FF, #00AEEF)', color: 'white', boxShadow: '0 16px 38px rgba(0,120,255,.28)' }}>
          <LockKeyhole size={28} />
        </div>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, height: 28, borderRadius: 999, padding: '0 12px', background: isDark ? 'rgba(56,189,248,.12)' : '#EBF4FF', color: isDark ? '#7DD3FC' : '#073266', fontSize: 12, fontWeight: 950, marginBottom: 10 }}>
            <ShieldCheck size={15} /> مصادقة آمنة + Namecheap MySQL
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950, letterSpacing: '-.03em' }}>تسجيل الدخول</h1>
          <p style={{ margin: '8px 0 0', color: isDark ? '#A8C3DD' : '#64748B', lineHeight: 1.7, fontSize: 13 }}>
            يتم توجيه المستخدم تلقائياً إلى Admin Portal أو Customer Portal حسب الدور المحفوظ في Namecheap MySQL.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>اسم المستخدم</span>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle(isDark)} autoComplete="username" required />
          </label>
          <label style={{ display: 'grid', gap: 7 }}>
            <span style={{ fontSize: 12, fontWeight: 900 }}>كلمة المرور</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle(isDark)} autoComplete="current-password" required />
          </label>

          {(localError || error) && (
            <div style={{ borderRadius: 14, padding: '10px 12px', background: 'rgba(239,68,68,.13)', border: '1px solid rgba(239,68,68,.28)', color: isDark ? '#fecaca' : '#991b1b', fontWeight: 850, fontSize: 13 }}>
              {localError || error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{ height: 46, borderRadius: 999, border: 'none', background: loading ? 'rgba(148,163,184,.5)' : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', color: 'white', fontWeight: 950, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: loading ? 'not-allowed' : 'pointer' }}>
            <LogIn size={18} /> {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </div>

        <div style={{ marginTop: 18, display: 'grid', gap: 8, fontSize: 12, color: isDark ? '#A8C3DD' : '#64748B', lineHeight: 1.7 }}>
          <div><b>System Admin:</b> admin / Admin@12345</div>
          <div><b>Risk Admin:</b> riskadmin / RiskAdmin@12345</div>
          <div><b>Viewer / Customer:</b> viewer / Viewer@12345</div>
        </div>
      </form>
    </div>
  );
}
