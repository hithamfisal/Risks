import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { Link } from 'wouter';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ImagePlus,
  Mail,
  Palette,
  Phone,
  Save,
  ShieldCheck,
  UploadCloud,
  LogOut,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTenantIdentity, listTenantIdentities, patchTenantIdentity, uploadTenantImage, type TenantIdentity } from '@/lib/tenantIdentity';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_RE = /\.(png|jpe?g|webp)$/i;

type ImageKind = 'logo' | 'cover';

type PendingImages = {
  logo: File | null;
  cover: File | null;
};

type PreviewImages = {
  logo: string;
  cover: string;
};

const inputStyle = (isDark: boolean) => ({
  width: '100%',
  height: 42,
  borderRadius: 12,
  border: isDark ? '1px solid rgba(125,211,252,.24)' : '1px solid rgba(31,56,100,.16)',
  background: isDark ? 'rgba(15,23,42,.54)' : 'rgba(255,255,255,.92)',
  color: isDark ? '#F8FAFC' : '#172033',
  padding: '0 13px',
  fontWeight: 750,
  outline: 'none',
});

export default function CompanyIdentityPage() {
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const isDark = theme === 'dark';
  const isSuperAdmin = user?.role === 'system_admin';
  const [activeTenant, setActiveTenant] = useState(() => user?.tenant_id || 'tenant-demo');
  const [tenantOptions, setTenantOptions] = useState<TenantIdentity[]>([]);
  const [form, setForm] = useState<TenantIdentity | null>(null);
  const [pending, setPending] = useState<PendingImages>({ logo: null, cover: null });
  const [previews, setPreviews] = useState<PreviewImages>({ logo: '', cover: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const pageBg = form?.cover_image_url || (isDark ? '/assets/dark.png' : '/assets/light.png');
  const targetTenantForApi = isSuperAdmin ? activeTenant : undefined;

  const cardStyle = useMemo(() => ({
    background: isDark ? 'rgba(6, 20, 48, 0.86)' : 'rgba(255,255,255,0.9)',
    border: isDark ? '1px solid rgba(125,211,252,0.22)' : '1px solid rgba(31,56,100,0.12)',
    boxShadow: isDark ? '0 26px 80px rgba(0,0,0,.34)' : '0 26px 80px rgba(31,56,100,.14)',
    backdropFilter: 'blur(18px)',
    borderRadius: 24,
  }), [isDark]);

  async function loadIdentity() {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const tenant = await fetchTenantIdentity(targetTenantForApi);
      setForm(tenant);
      setPending({ logo: null, cover: null });
      setPreviews({ logo: tenant.logo_url || '', cover: tenant.cover_image_url || '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل هوية الشركة.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.tenant_id && !isSuperAdmin) setActiveTenant(user.tenant_id);
  }, [user?.tenant_id, isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    listTenantIdentities()
      .then(tenants => {
        setTenantOptions(tenants);
        if (!activeTenant && tenants[0]) setActiveTenant(tenants[0].id);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'تعذر تحميل قائمة الشركات.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!user) return;
    loadIdentity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isSuperAdmin, activeTenant]);

  useEffect(() => {
    return () => {
      if (previews.logo?.startsWith('blob:')) URL.revokeObjectURL(previews.logo);
      if (previews.cover?.startsWith('blob:')) URL.revokeObjectURL(previews.cover);
    };
  }, [previews.logo, previews.cover]);

  function updateField<K extends keyof TenantIdentity>(field: K, value: TenantIdentity[K]) {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
  }

  function validateImage(file: File, kind: ImageKind): string {
    const max = kind === 'logo' ? MAX_LOGO_BYTES : MAX_COVER_BYTES;
    if (!ALLOWED_IMAGE_RE.test(file.name)) return 'صيغة الصورة غير مدعومة. المسموح: png, jpg, jpeg, webp.';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return 'نوع الملف غير مدعوم. اختر صورة فقط.';
    if (file.size > max) return `حجم الملف أكبر من المسموح. الحد الأقصى ${kind === 'logo' ? '2MB' : '5MB'}.`;
    return '';
  }

  function selectImage(kind: ImageKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateImage(file, kind);
    if (validation) {
      setError(validation);
      event.target.value = '';
      return;
    }

    setError('');
    setSuccess('');
    const nextPreview = URL.createObjectURL(file);
    setPreviews(prev => {
      const old = prev[kind];
      if (old?.startsWith('blob:')) URL.revokeObjectURL(old);
      return { ...prev, [kind]: nextPreview };
    });
    setPending(prev => ({ ...prev, [kind]: file }));
  }

  async function saveIdentity() {
    if (!form) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const tenantIdForSuperAdmin = isSuperAdmin ? activeTenant : undefined;
      let next = await patchTenantIdentity({
        tenant_id: tenantIdForSuperAdmin,
        company_name: form.company_name,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        whatsapp_number: form.whatsapp_number,
        support_email: form.support_email,
        description: form.description,
      });

      if (pending.logo) next = await uploadTenantImage('logo', pending.logo, tenantIdForSuperAdmin);
      if (pending.cover) next = await uploadTenantImage('cover', pending.cover, tenantIdForSuperAdmin);

      setForm(next);
      setPending({ logo: null, cover: null });
      setPreviews({ logo: next.logo_url || '', cover: next.cover_image_url || '' });
      setSuccess('تم حفظ هوية الشركة بنجاح، وسيتم عرض الشعار واسم الشركة في الهيدر.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ هوية الشركة.');
    } finally {
      setSaving(false);
    }
  }

  const companyName = form?.company_name || 'Company Identity';

  return (
    <div
      className="min-h-screen"
      dir="rtl"
      style={{
        color: isDark ? '#F8FAFC' : '#172033',
        backgroundColor: isDark ? '#061630' : '#F8FBFF',
        backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.72), rgba(2,6,23,.38))' : 'linear-gradient(90deg, rgba(255,255,255,.78), rgba(255,255,255,.54))'}, url(${pageBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <header style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0b1120', borderBottom: '1px solid rgba(255,255,255,0.08)', height: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', boxShadow: '0 2px 18px rgba(0,0,0,.35)' }}>
        <Link href="/admin" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', color: 'white', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', textDecoration: 'none' }} title="العودة للداشبورد">
          <ArrowLeft size={18} />
        </Link>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center', overflow: 'hidden', flex: '0 0 auto' }}>
          {previews.logo ? <img src={previews.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Building2 size={22} color="white" />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 950, color: 'white', lineHeight: 1.1 }}>{companyName}</div>
          <div style={{ fontSize: 11, fontWeight: 750, color: 'rgba(255,255,255,.58)' }}>صفحة هوية الشركة / Company Identity Settings</div>
        </div>
        <button onClick={saveIdentity} disabled={saving || loading || !form} style={{ height: 38, borderRadius: 999, border: 'none', background: saving ? 'rgba(148,163,184,.5)' : 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', color: 'white', fontWeight: 900, fontSize: 13, padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: saving ? 'not-allowed' : 'pointer' }}>
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ الهوية'}
        </button>
        <button onClick={logout} style={{ height: 38, borderRadius: 999, border: '1px solid rgba(255,255,255,.16)', background: 'rgba(255,255,255,.08)', color: 'white', fontWeight: 900, fontSize: 13, padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <LogOut size={16} /> خروج
        </button>
      </header>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 18px 42px' }}>
        <section style={{ ...cardStyle, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 28, borderRadius: 999, padding: '0 12px', background: isDark ? 'rgba(56,189,248,.12)' : '#EBF4FF', color: isDark ? '#7DD3FC' : '#073266', fontSize: 12, fontWeight: 900, marginBottom: 10 }}>
                <ShieldCheck size={15} /> صلاحيات آمنة حسب Tenant
              </div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 950, letterSpacing: '-.03em', color: isDark ? '#F8FAFC' : '#0f172a' }}>هوية الشركة</h1>
              <p style={{ margin: '8px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontSize: 14, lineHeight: 1.8, maxWidth: 760 }}>
                Tenant Admin يعدّل هوية شركته فقط. Super Admin يستطيع اختيار أي Tenant وتعديل هويته. رفع الشعار والخلفية يتم من الجهاز مع معاينة مباشرة قبل الحفظ.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'grid', gap: 6, minWidth: 210 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: isDark ? '#CBD5E1' : '#334155' }}>المستخدم الحالي</span>
                <input value={`${user?.name || ''} — ${user?.role || ''}`} readOnly style={{ ...inputStyle(isDark), opacity: .82 }} />
              </label>
              <label style={{ display: 'grid', gap: 6, minWidth: 240 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: isDark ? '#CBD5E1' : '#334155' }}>{isSuperAdmin ? 'اختيار الشركة / Tenant' : 'Tenant ID'}</span>
                {isSuperAdmin ? (
                  <select value={activeTenant} onChange={e => setActiveTenant(e.target.value)} style={inputStyle(isDark)}>
                    {tenantOptions.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.company_name} — {tenant.id}</option>)}
                    {!tenantOptions.some(tenant => tenant.id === activeTenant) && <option value={activeTenant}>{activeTenant}</option>}
                  </select>
                ) : (
                  <input value={user?.tenant_id || activeTenant} readOnly style={{ ...inputStyle(isDark), opacity: .65 }} />
                )}
              </label>
            </div>
          </div>
        </section>

        {(error || success) && (
          <div style={{ marginBottom: 18, borderRadius: 16, padding: '12px 14px', border: error ? '1px solid rgba(239,68,68,.36)' : '1px solid rgba(34,197,94,.36)', background: error ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)', color: error ? '#fecaca' : (isDark ? '#bbf7d0' : '#166534'), display: 'flex', alignItems: 'center', gap: 9, fontWeight: 850 }}>
            {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{error || success}</span>
          </div>
        )}

        {loading || !form ? (
          <div style={{ ...cardStyle, padding: 28, textAlign: 'center', fontWeight: 900 }}>جاري تحميل بيانات الهوية...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
            <section style={{ ...cardStyle, padding: 20 }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 950 }}>البيانات الأساسية</h2>
              <div style={{ display: 'grid', gap: 14 }}>
                <label style={{ display: 'grid', gap: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 900 }}>اسم الشركة</span>
                  <input value={form.company_name} onChange={e => updateField('company_name', e.target.value)} style={inputStyle(isDark)} placeholder="اسم الشركة" />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Palette size={14} /> اللون الأساسي</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="color" value={form.primary_color || '#073266'} onChange={e => updateField('primary_color', e.target.value)} style={{ width: 52, height: 42, border: 'none', borderRadius: 12, padding: 0, background: 'transparent' }} />
                      <input value={form.primary_color} onChange={e => updateField('primary_color', e.target.value)} style={inputStyle(isDark)} />
                    </div>
                  </label>
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Palette size={14} /> اللون الثانوي</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="color" value={form.secondary_color || '#0078FF'} onChange={e => updateField('secondary_color', e.target.value)} style={{ width: 52, height: 42, border: 'none', borderRadius: 12, padding: 0, background: 'transparent' }} />
                      <input value={form.secondary_color} onChange={e => updateField('secondary_color', e.target.value)} style={inputStyle(isDark)} />
                    </div>
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> رقم التواصل / واتساب</span>
                    <input value={form.whatsapp_number} onChange={e => updateField('whatsapp_number', e.target.value)} style={inputStyle(isDark)} placeholder="+966..." />
                  </label>
                  <label style={{ display: 'grid', gap: 7 }}>
                    <span style={{ fontSize: 12, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> بريد الدعم</span>
                    <input value={form.support_email} onChange={e => updateField('support_email', e.target.value)} style={inputStyle(isDark)} placeholder="support@company.com" />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 900 }}>وصف الشركة</span>
                  <textarea value={form.description} onChange={e => updateField('description', e.target.value)} rows={5} style={{ ...inputStyle(isDark), height: 'auto', paddingTop: 12, resize: 'vertical', lineHeight: 1.7 }} placeholder="وصف مختصر للشركة" />
                </label>
              </div>
            </section>

            <aside style={{ display: 'grid', gap: 18 }}>
              <ImageUploadCard
                title="الشعار Logo"
                subtitle="PNG / JPG / JPEG / WEBP — حد أقصى 2MB"
                kind="logo"
                preview={previews.logo}
                file={pending.logo}
                inputRef={logoInputRef}
                isDark={isDark}
                onPick={() => logoInputRef.current?.click()}
                onChange={selectImage}
              />
              <ImageUploadCard
                title="صورة الخلفية / الغلاف"
                subtitle="PNG / JPG / JPEG / WEBP — حد أقصى 5MB"
                kind="cover"
                preview={previews.cover}
                file={pending.cover}
                inputRef={coverInputRef}
                isDark={isDark}
                onPick={() => coverInputRef.current?.click()}
                onChange={selectImage}
              />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function ImageUploadCard({
  title,
  subtitle,
  kind,
  preview,
  file,
  inputRef,
  isDark,
  onPick,
  onChange,
}: {
  title: string;
  subtitle: string;
  kind: ImageKind;
  preview: string;
  file: File | null;
  inputRef: RefObject<HTMLInputElement | null>;
  isDark: boolean;
  onPick: () => void;
  onChange: (kind: ImageKind, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const isLogo = kind === 'logo';
  return (
    <section style={{ background: isDark ? 'rgba(6, 20, 48, 0.86)' : 'rgba(255,255,255,0.9)', border: isDark ? '1px solid rgba(125,211,252,0.22)' : '1px solid rgba(31,56,100,0.12)', boxShadow: isDark ? '0 18px 56px rgba(0,0,0,.24)' : '0 16px 42px rgba(31,56,100,.10)', backdropFilter: 'blur(18px)', borderRadius: 24, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center', color: 'white' }}>
          <ImagePlus size={19} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 950 }}>{title}</h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, fontWeight: 750, color: isDark ? '#A8C3DD' : '#64748B' }}>{subtitle}</p>
        </div>
      </div>

      <div style={{ width: '100%', height: isLogo ? 160 : 210, borderRadius: 18, overflow: 'hidden', border: isDark ? '1px dashed rgba(125,211,252,.38)' : '1px dashed rgba(31,56,100,.22)', background: isDark ? 'rgba(15,23,42,.5)' : '#F8FAFC', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
        {preview ? (
          <img src={preview} alt={title} style={{ width: '100%', height: '100%', objectFit: isLogo ? 'contain' : 'cover', padding: isLogo ? 18 : 0 }} />
        ) : (
          <div style={{ textAlign: 'center', color: isDark ? '#A8C3DD' : '#64748B', fontWeight: 850 }}>
            <UploadCloud size={28} style={{ margin: '0 auto 8px' }} />
            لا توجد صورة حالياً
          </div>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={event => onChange(kind, event)} style={{ display: 'none' }} />
      <button type="button" onClick={onPick} style={{ width: '100%', height: 42, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #073266, #0078FF)', color: 'white', fontWeight: 950, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <UploadCloud size={17} /> استعراض / اختيار ملف
      </button>
      {file && <div style={{ marginTop: 9, fontSize: 12, fontWeight: 850, color: isDark ? '#7DD3FC' : '#075985', direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>}
    </section>
  );
}
