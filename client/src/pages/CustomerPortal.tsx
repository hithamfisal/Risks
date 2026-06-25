import { Link } from 'wouter';
import { BarChart3, Building2, Headphones, LogOut, Mail, Phone, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

function isAdmin(role?: string) {
  return role === 'system_admin' || role === 'risk_admin';
}

export default function CustomerPortalPage() {
  const { user, tenant, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cover = tenant?.cover_image_url || (isDark ? '/assets/dark.png' : '/assets/light.png');
  const companyName = tenant?.company_name || 'Customer Portal';

  return (
    <div
      dir="rtl"
      style={{
        minHeight: '100vh',
        color: isDark ? '#F8FAFC' : '#172033',
        backgroundColor: isDark ? '#061630' : '#F8FBFF',
        backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.72), rgba(2,6,23,.32))' : 'linear-gradient(90deg, rgba(255,255,255,.80), rgba(255,255,255,.52))'}, url(${cover})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      <header style={{ height: 74, background: 'rgba(11,17,32,.96)', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px', boxShadow: '0 12px 38px rgba(0,0,0,.28)' }}>
        <div style={{ width: 48, height: 48, borderRadius: 16, background: tenant?.logo_url ? 'rgba(255,255,255,.96)' : 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          {tenant?.logo_url ? <img src={tenant.logo_url} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 5 }} /> : <Building2 color="white" size={24} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'white', fontWeight: 950, fontSize: 20, lineHeight: 1.1 }}>{companyName}</div>
          <div style={{ color: 'rgba(255,255,255,.58)', fontWeight: 800, fontSize: 12 }}>Customer Portal · واجهة العميل</div>
        </div>
        {isAdmin(user?.role) && (
          <Link href="/admin" style={{ height: 38, borderRadius: 999, padding: '0 14px', color: 'white', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 900 }}>
            <UserRoundCog size={16} /> بوابة الإدارة
          </Link>
        )}
        <button onClick={logout} style={{ height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.08)', color: 'white', fontWeight: 900, fontSize: 12, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> خروج
        </button>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '46px 18px 60px' }}>
        <section style={{ borderRadius: 34, padding: 32, background: isDark ? 'rgba(6, 20, 48, 0.84)' : 'rgba(255,255,255,0.91)', border: isDark ? '1px solid rgba(125,211,252,.22)' : '1px solid rgba(31,56,100,.12)', boxShadow: isDark ? '0 26px 80px rgba(0,0,0,.34)' : '0 26px 80px rgba(31,56,100,.14)', backdropFilter: 'blur(18px)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'center' }}>
            <div style={{ width: 92, height: 92, borderRadius: 28, background: tenant?.logo_url ? 'rgba(255,255,255,.96)' : `linear-gradient(135deg, ${tenant?.primary_color || '#0078FF'}, ${tenant?.secondary_color || '#00AEEF'})`, display: 'grid', placeItems: 'center', overflow: 'hidden', boxShadow: '0 18px 45px rgba(0,120,255,.26)' }}>
              {tenant?.logo_url ? <img src={tenant.logo_url} alt="Company logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }} /> : <ShieldCheck color="white" size={42} />}
            </div>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 30, borderRadius: 999, padding: '0 12px', background: isDark ? 'rgba(56,189,248,.12)' : '#EBF4FF', color: isDark ? '#7DD3FC' : '#073266', fontSize: 12, fontWeight: 950, marginBottom: 12 }}>
                <Building2 size={15} /> بوابة العميل المستقلة
              </div>
              <h1 style={{ margin: 0, fontSize: 38, fontWeight: 950, letterSpacing: '-.04em' }}>{companyName}</h1>
              <p style={{ margin: '12px 0 0', lineHeight: 1.9, color: isDark ? '#A8C3DD' : '#64748B', maxWidth: 760, fontWeight: 760 }}>
                {tenant?.description || 'واجهة مخصصة للعميل تعرض هوية الشركة ومداخل الخدمات دون إظهار إعدادات الإدارة أو صلاحيات System Admin / Risk Admin.'}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 26, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            <div style={{ borderRadius: 22, padding: 18, background: isDark ? 'rgba(15,23,42,.55)' : '#F8FAFC', border: isDark ? '1px solid rgba(125,211,252,.14)' : '1px solid rgba(31,56,100,.08)' }}>
              <Headphones size={22} color={tenant?.secondary_color || '#0078FF'} />
              <h3 style={{ margin: '10px 0 6px', fontWeight: 950 }}>الدعم والتواصل</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: isDark ? '#CBD5E1' : '#64748B', fontWeight: 750 }}>معلومات التواصل تظهر من هوية Tenant المحفوظة.</p>
            </div>
            <div style={{ borderRadius: 22, padding: 18, background: isDark ? 'rgba(15,23,42,.55)' : '#F8FAFC', border: isDark ? '1px solid rgba(125,211,252,.14)' : '1px solid rgba(31,56,100,.08)' }}>
              <BarChart3 size={22} color={tenant?.secondary_color || '#0078FF'} />
              <h3 style={{ margin: '10px 0 6px', fontWeight: 950 }}>لوحة المؤشرات</h3>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: isDark ? '#CBD5E1' : '#64748B', fontWeight: 750 }}>يمكن فتح لوحة المخاطر من بوابة العميل بدون إظهار إعدادات الإدارة.</p>
            </div>
          </div>

          <div style={{ marginTop: 26, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/customer/dashboard" style={{ height: 44, borderRadius: 999, padding: '0 20px', color: 'white', background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 950 }}>
              <BarChart3 size={17} /> فتح لوحة المخاطر
            </Link>
            {tenant?.whatsapp_number && <a href={`https://wa.me/${tenant.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ height: 44, borderRadius: 999, padding: '0 18px', color: isDark ? '#F8FAFC' : '#073266', background: isDark ? 'rgba(15,23,42,.62)' : '#F1F5F9', border: isDark ? '1px solid rgba(125,211,252,.16)' : '1px solid rgba(31,56,100,.08)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 950 }}><Phone size={16} /> واتساب</a>}
            {tenant?.support_email && <a href={`mailto:${tenant.support_email}`} style={{ height: 44, borderRadius: 999, padding: '0 18px', color: isDark ? '#F8FAFC' : '#073266', background: isDark ? 'rgba(15,23,42,.62)' : '#F1F5F9', border: isDark ? '1px solid rgba(125,211,252,.16)' : '1px solid rgba(31,56,100,.08)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 950 }}><Mail size={16} /> بريد الدعم</a>}
          </div>
        </section>
      </main>
    </div>
  );
}
