import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Building2, Gauge, ImagePlus, LogOut, ShieldCheck, Users, Eye, Database, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

type CardProps = {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
};

function PortalCard({ href, icon, title, description, badge }: CardProps) {
  return (
    <Link
      href={href}
      style={{
        minHeight: 170,
        borderRadius: 26,
        padding: 22,
        background: 'rgba(255,255,255,.92)',
        border: '1px solid rgba(31,56,100,.12)',
        boxShadow: '0 18px 50px rgba(31,56,100,.12)',
        textDecoration: 'none',
        color: '#0f172a',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 18, background: 'linear-gradient(135deg, #0078FF, #00AEEF)', color: 'white', display: 'grid', placeItems: 'center', boxShadow: '0 14px 32px rgba(0,120,255,.28)' }}>
          {icon}
        </div>
        {badge && <span style={{ borderRadius: 999, padding: '6px 10px', background: '#EBF4FF', color: '#073266', fontSize: 11, fontWeight: 950 }}>{badge}</span>}
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 950 }}>{title}</h2>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.7, color: '#64748B', fontWeight: 750 }}>{description}</p>
      </div>
    </Link>
  );
}

export default function AdminPortalPage() {
  const { user, tenant, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const companyName = tenant?.company_name || 'Risks Dashboard';
  const cover = tenant?.cover_image_url || (isDark ? '/assets/dark.png' : '/assets/light.png');

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
      <header style={{ height: 74, background: '#0b1120', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', boxShadow: '0 12px 38px rgba(0,0,0,.28)' }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: tenant?.logo_url ? 'rgba(255,255,255,.96)' : 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {tenant?.logo_url ? <img src={tenant.logo_url} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5 }} /> : <ShieldCheck color="white" size={24} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 950, fontSize: 20, lineHeight: 1.1 }}>{companyName}</div>
          <div style={{ color: 'rgba(255,255,255,.58)', fontWeight: 800, fontSize: 12 }}>Admin Portal · System management and settings</div>
        </div>
        <Link href="/customer" style={{ height: 38, borderRadius: 999, padding: '0 14px', color: 'white', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900 }}>
          <Eye size={16} /> Preview Customer Portal
        </Link>
        <button onClick={logout} style={{ height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.08)', color: 'white', fontWeight: 900, fontSize: 12, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '38px 18px 56px' }}>
        <section style={{ borderRadius: 32, padding: 28, background: isDark ? 'rgba(6, 20, 48, 0.86)' : 'rgba(255,255,255,0.92)', border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.12)', boxShadow: isDark ? '0 26px 80px rgba(0,0,0,.34)' : '0 26px 80px rgba(31,56,100,.14)', backdropFilter: 'blur(18px)', marginBottom: 22 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, borderRadius: 999, padding: '0 12px', background: isDark ? 'rgba(56,189,248,.12)' : '#EBF4FF', color: isDark ? '#7DD3FC' : '#073266', fontSize: 12, fontWeight: 950, marginBottom: 12 }}>
            <Database size={15} /> Namecheap MySQL + Secure Auth
          </div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 950, letterSpacing: '-.04em' }}>Admin Portal</h1>
          <p style={{ margin: '10px 0 0', color: isDark ? '#A8C3DD' : '#64748B', lineHeight: 1.8, maxWidth: 820, fontWeight: 750 }}>
            This portal is available to System Admin and Risk Admin users. Open the risk dashboard, manage company identity, and keep administrative settings separate from the customer experience.
          </p>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ borderRadius: 999, padding: '8px 12px', background: isDark ? 'rgba(15,23,42,.65)' : '#F1F5F9', color: isDark ? '#CBD5E1' : '#334155', fontSize: 12, fontWeight: 900 }}>User: {user?.username || user?.email}</span>
            <span style={{ borderRadius: 999, padding: '8px 12px', background: isDark ? 'rgba(15,23,42,.65)' : '#F1F5F9', color: isDark ? '#CBD5E1' : '#334155', fontSize: 12, fontWeight: 900 }}>Role: {user?.role}</span>
            <span style={{ borderRadius: 999, padding: '8px 12px', background: isDark ? 'rgba(15,23,42,.65)' : '#F1F5F9', color: isDark ? '#CBD5E1' : '#334155', fontSize: 12, fontWeight: 900 }}>Database: Namecheap MySQL</span>
          </div>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          <PortalCard href="/admin/dashboard" icon={<Gauge size={24} />} title="Risk Dashboard" description="Upload risk files and analyze KPIs, charts, and tables from the admin portal." badge="Dashboard" />
          <PortalCard href="/admin/company-identity" icon={<ImagePlus size={24} />} title="Company Identity" description="Update company name, logo, cover image, colors, and contact details for each tenant." badge="Identity" />
          <PortalCard href="/admin/management" icon={<Settings size={24} />} title="System Management" description="Manage users, change passwords, review audit logs, export backups, and configure system settings." badge="Management" />
          <PortalCard href="/customer" icon={<Building2 size={24} />} title="Customer Portal" description="Open the separate customer-facing portal to review what non-admin users see." badge="Customer" />
          {user?.role === 'system_admin' && (
            <PortalCard href="/admin/company-identity" icon={<Users size={24} />} title="Tenant Management" description="System Admin users can select any tenant from the identity page and update its details, logo, and cover image." badge="System Admin" />
          )}
        </section>
      </main>
    </div>
  );
}
