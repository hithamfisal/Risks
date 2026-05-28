/**
 * TNOC Risk Management Dashboard
 * Professional enterprise risk analytics dashboard
 * - Theme-aware light/dark Saudi Energy visual system
 * - Compact 100% zoom layout
 * - Collapsible sections
 * - PNG/PDF/Excel exports
 * - Sticky searchable risk register
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  Upload, Printer, TrendingUp, TrendingDown, Minus, Filter, X, BarChart2,
  ChevronDown, ChevronRight, Home, ImageDown, FileSpreadsheet, Search,
  RotateCcw, Download, Eye, EyeOff,
} from 'lucide-react';
import { DashboardData, getScoreColor, getRatingColor, type RiskRow } from '@/lib/excelParser';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

const HEADER_LEFT_LOGOS = [
  { src: '/assets/map-logo.png', alt: 'TNOC', height: 34 },
  { src: '/assets/se-logo.png', alt: 'Saudi Energy', height: 38 },
];
const NASCO_LOGO = { src: '/assets/nasco-logo.png', alt: 'NASCO', height: 44 };

const ZONE_COLORS: Record<string, string> = {
  'Very High': '#C0392B',
  High: '#E67E22',
  Moderate: '#F39C12',
  Low: '#27AE60',
  'Very Low': '#2ECC71',
};

const SE = {
  navy: '#073266',
  navy2: '#051A3C',
  blue: '#0078FF',
  cyan: '#00AEEF',
  teal: '#12D6B1',
  gold: '#C9A84C',
  red: '#C0392B',
  orange: '#E67E22',
  green: '#27AE60',
};

type ThemePalette = ReturnType<typeof makePalette>;

function makePalette(isDark: boolean) {
  return {
    page: isDark ? '#061630' : '#F8FBFF',
    card: isDark ? 'rgba(7, 24, 54, 0.88)' : 'rgba(255, 255, 255, 0.92)',
    cardSolid: isDark ? '#071836' : '#FFFFFF',
    cardSoft: isDark ? 'rgba(15, 35, 72, 0.74)' : '#F4F8FC',
    cardAlt: isDark ? 'rgba(14, 39, 79, 0.72)' : '#FAFCFF',
    text: isDark ? '#F8FAFC' : '#172033',
    muted: isDark ? '#A8C3DD' : '#64748B',
    subtle: isDark ? '#7EA5C9' : '#7892AD',
    border: isDark ? 'rgba(125, 211, 252, 0.20)' : 'rgba(31, 56, 100, 0.13)',
    header: isDark ? 'rgba(5, 18, 43, 0.88)' : 'rgba(255, 255, 255, 0.88)',
    sectionHeader: isDark ? 'linear-gradient(135deg, rgba(7,50,102,.96), rgba(0,120,255,.42))' : 'linear-gradient(135deg, #073266, #0078FF)',
    tableHead: isDark ? '#082044' : '#102B54',
    tableStripe: isDark ? 'rgba(125,211,252,.045)' : '#F7FAFC',
    tableHover: isDark ? 'rgba(0,174,239,.16)' : '#EBF8FF',
    shadow: isDark ? '0 22px 70px rgba(0,0,0,.34)' : '0 18px 55px rgba(31,56,100,.13)',
    chartGrid: isDark ? 'rgba(148,163,184,.18)' : 'rgba(31,56,100,.12)',
    tooltip: isDark ? '#071836' : '#FFFFFF',
    buttonText: '#FFFFFF',
  };
}

function AnimatedNumber({ value, animationKey }: { value: number; animationKey?: string | number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    setDisplay(0);
    let start = 0;
    const step = Math.max(value / 34, 1);
    const timer = window.setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        window.clearInterval(timer);
      } else {
        setDisplay(Math.round(start));
      }
    }, 14);
    return () => window.clearInterval(timer);
  }, [value, animationKey]);

  return <>{display}</>;
}

function ProgressGauge({ score, palette }: { score: number; palette: ThemePalette }) {
  const clamped = Math.max(1, Math.min(25, score || 1));
  const pct = (clamped - 1) / 24;
  const angle = 180 - pct * 180;
  const zone = score >= 20 ? 'Very High' : score >= 15 ? 'High' : score >= 9 ? 'Moderate' : score >= 5 ? 'Low' : 'Very Low';

  function polar(cx: number, cy: number, r: number, deg: number) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function arc(start: number, end: number, inner: number, outer: number) {
    const cx = 150;
    const cy = 145;
    const s = polar(cx, cy, outer, start);
    const e = polar(cx, cy, outer, end);
    const si = polar(cx, cy, inner, start);
    const ei = polar(cx, cy, inner, end);
    return `M ${s.x} ${s.y} A ${outer} ${outer} 0 0 0 ${e.x} ${e.y} L ${ei.x} ${ei.y} A ${inner} ${inner} 0 0 1 ${si.x} ${si.y} Z`;
  }

  const zones = [
    { name: 'Very Low', start: 180, end: 144, color: ZONE_COLORS['Very Low'] },
    { name: 'Low', start: 144, end: 108, color: ZONE_COLORS.Low },
    { name: 'Moderate', start: 108, end: 72, color: ZONE_COLORS.Moderate },
    { name: 'High', start: 72, end: 36, color: ZONE_COLORS.High },
    { name: 'Very High', start: 36, end: 0, color: ZONE_COLORS['Very High'] },
  ];

  const needle = polar(150, 145, 100, angle);

  return (
    <div style={{ minHeight: 232, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 12 }}>
      <svg viewBox="0 0 300 205" width="100%" height="184" aria-label="Average risk score gauge" style={{ display: 'block', overflow: 'visible' }}>
        {zones.map(z => <path key={z.name} d={arc(z.start, z.end, 62, 108)} fill={z.color} opacity={0.96} stroke={palette.cardSolid} strokeWidth={2} />)}
        {[1, 5, 9, 15, 20, 25].map(t => {
          const tickAngle = 180 - ((t - 1) / 24) * 180;
          const a = polar(150, 145, 112, tickAngle);
          const b = polar(150, 145, 120, tickAngle);
          const label = polar(150, 145, 132, tickAngle);
          return (
            <g key={t}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.muted} strokeWidth={1.4} />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="800" fill={palette.muted}>{t}</text>
            </g>
          );
        })}
        <line x1="150" y1="145" x2={needle.x} y2={needle.y} stroke={SE.navy} strokeWidth="5" strokeLinecap="round" />
        <circle cx="150" cy="145" r="13" fill={SE.navy} stroke={palette.cardSolid} strokeWidth="4" />
        <circle cx="150" cy="145" r="52" fill={palette.cardSolid} stroke={palette.border} strokeWidth="2" />
        <text x="150" y="132" textAnchor="middle" fontSize="30" fontWeight="900" fill={ZONE_COLORS[zone]}>{score}</text>
        <text x="150" y="154" textAnchor="middle" fontSize="12" fontWeight="800" fill={palette.text}>{zone}</text>
      </svg>
      <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '6px 12px', padding: '4px 8px 0', marginTop: 2 }}>
        {zones.map(z => (
          <span key={`gauge-legend-${z.name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.muted, fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: z.color, boxShadow: `0 0 0 2px ${palette.cardSolid}` }} />
            {z.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 34, height: 22, padding: '0 8px', borderRadius: 999, background: getScoreColor(score), color: 'white', fontWeight: 900, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>{score}</span>
  );
}

function ChangeIndicator({ dev }: { dev: number }) {
  if (dev > 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: SE.green, fontWeight: 800, fontSize: 11 }}><TrendingUp size={12} />+{dev}%</span>;
  if (dev < 0) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: SE.red, fontWeight: 800, fontSize: 11 }}><TrendingDown size={12} />{dev}%</span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#95A5A6', fontWeight: 700, fontSize: 11 }}><Minus size={12} />–</span>;
}

function Sparkline({ weekProgress, weeks }: { weekProgress: Record<string, number>; weeks: { label: string }[] }) {
  const data = weeks.map(w => ({ v: Math.round((weekProgress[w.label] ?? 0) * 100) }));
  const last = data[data.length - 1]?.v ?? 0;
  const prev = data[data.length - 2]?.v ?? last;
  const color = last > prev ? SE.green : last < prev ? SE.red : '#95A5A6';
  return (
    <div style={{ width: 78, height: 26 }}>
      <ResponsiveContainer width="100%" height={26}>
        <LineChart data={data} margin={{ top: 3, right: 3, left: 3, bottom: 3 }}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, label, palette }: { active?: boolean; payload?: any[]; label?: string; palette: ThemePalette }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: palette.tooltip, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '8px 10px', fontSize: 11, color: palette.text, boxShadow: palette.shadow }}>
      {label && <p style={{ fontWeight: 900, marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={`${p.name}-${i}`} style={{ color: p.color || p.fill || palette.text, margin: 0 }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

function getDateValue(value: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) return parsed;
  const match = value.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? Number(`20${y}`) : Number(y);
  return new Date(year, Number(m) - 1, Number(d)).getTime();
}

function normalise(text: string) {
  return (text || '').toLowerCase().trim();
}

async function exportElementAsPNG(ref: RefObject<HTMLElement | null>, fileName: string, backgroundColor: string) {
  if (!ref.current) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(ref.current, { backgroundColor, scale: 2, useCORS: true });
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

interface SectionCardProps {
  id: string;
  title: string;
  palette: ThemePalette;
  defaultOpen?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  bodyRef?: RefObject<HTMLDivElement | null>;
  compact?: boolean;
}

function SectionCard({ id, title, palette, defaultOpen = true, children, actions, bodyRef, compact = false }: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section id={id} className="dashboard-section" style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: palette.shadow, backdropFilter: 'blur(18px)' }}>
      <div style={{ background: palette.sectionHeader, padding: compact ? '7px 12px' : '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="no-print" onClick={() => setOpen(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: compact ? 12 : 13, cursor: 'pointer', padding: 0 }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          {title}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {actions}
        </div>
      </div>
      {open && <div ref={bodyRef} className="section-export-body" style={{ padding: compact ? 10 : 12 }}>{children}</div>}
    </section>
  );
}

function SmallActionButton({ children, onClick, title, palette, disabled = false }: { children: ReactNode; onClick?: () => void; title?: string; palette: ThemePalette; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, borderRadius: 999, border: '1px solid rgba(255,255,255,.22)', background: disabled ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.16)', color: palette.buttonText, padding: '0 10px', fontSize: 10, fontWeight: 800, fontFamily: 'DM Sans, sans-serif', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}>
      {children}
    </button>
  );
}

function KpiTile({ label, value, isText, color, selectedWeek, index, palette }: { label: string; value: number | string; isText?: boolean; color: string; selectedWeek: string; index: number; palette: ThemePalette }) {
  const numeric = Number(value);
  const ringPct = isText ? 76 : Math.max(18, Math.min(92, Number.isFinite(numeric) ? numeric : 55));
  const displayValue = isText ? value : <AnimatedNumber animationKey={`${selectedWeek}-${index}`} value={numeric} />;
  return (
    <div className="kpi-tile" style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 150 }}>
      <div
        className="kpi-orb"
        style={{
          '--kpi-color': color,
          '--kpi-ring': `${ringPct}%`,
          width: 142,
          height: 142,
          borderRadius: '50%',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          background: `conic-gradient(from 210deg, ${color} 0 var(--kpi-ring), rgba(255,255,255,.20) var(--kpi-ring) 100%)`,
          boxShadow: `0 20px 44px rgba(0,0,0,.20), inset 0 0 0 1px rgba(255,255,255,.22)`,
          border: '1px solid rgba(255,255,255,.24)',
        } as CSSProperties}
      >
        <div style={{ position: 'absolute', inset: 9, borderRadius: '50%', background: `linear-gradient(145deg, ${color}, ${SE.navy2})`, boxShadow: 'inset 0 2px 18px rgba(255,255,255,.16), inset 0 -18px 30px rgba(0,0,0,.22)' }} />
        <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: 'radial-gradient(circle at 35% 22%, rgba(255,255,255,.24), rgba(255,255,255,.06) 38%, rgba(0,0,0,.16) 100%)', border: '1px solid rgba(255,255,255,.16)' }} />
        <div style={{ position: 'relative', width: 112, height: 112, borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12 }}>
          <div className="kpi-value" style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: isText ? 18 : 31, lineHeight: 1, color: isText ? '#FFE08A' : 'white', letterSpacing: '-0.04em', maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(value)}>
            {displayValue}
          </div>
          <div className="kpi-label" style={{ color: 'rgba(255,255,255,.90)', fontSize: 9, fontWeight: 900, marginTop: 8, textTransform: 'uppercase', letterSpacing: '.055em', lineHeight: 1.15 }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function RiskHeatmap({ risks, filterOwner, palette }: { risks: RiskRow[]; filterOwner: string; palette: ThemePalette }) {
  const cellMap = useMemo(() => {
    const map: Record<string, RiskRow[]> = {};
    risks.forEach(r => {
      const l = Math.min(5, Math.max(1, Math.round(r.likelihood || 0)));
      const im = Math.min(5, Math.max(1, Math.round(r.impact || 0)));
      if (!l || !im) return;
      const key = `${l}-${im}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [risks]);

  function cellColor(l: number, im: number) {
    const s = l * im;
    if (s >= 20) return ZONE_COLORS['Very High'];
    if (s >= 15) return ZONE_COLORS.High;
    if (s >= 9) return ZONE_COLORS.Moderate;
    if (s >= 5) return ZONE_COLORS.Low;
    return ZONE_COLORS['Very Low'];
  }

  return (
    <div style={{ padding: 2 }}>
      {filterOwner !== 'All' && <div style={{ color: SE.gold, fontWeight: 900, fontSize: 10, textAlign: 'center', marginBottom: 6 }}>Highlighting owner: {filterOwner}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', color: palette.muted, fontSize: 9, letterSpacing: 1, fontWeight: 900 }}>LIKELIHOOD</div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(l => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: '14px repeat(5, minmax(0, 1fr))', gap: 3, marginBottom: 3, alignItems: 'stretch' }}>
              <div style={{ color: palette.muted, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l}</div>
              {[1, 2, 3, 4, 5].map(im => {
                const items = cellMap[`${l}-${im}`] || [];
                const highlight = filterOwner === 'All' ? items : items.filter(r => r.owner === filterOwner);
                const dimmed = filterOwner !== 'All' && items.length > 0 && highlight.length === 0;
                return (
                  <div key={im} title={items.map(r => r.title).join('\n')} style={{ minHeight: 44, borderRadius: 8, background: cellColor(l, im), opacity: items.length ? (dimmed ? 0.28 : 0.96) : 0.18, border: highlight.length && filterOwner !== 'All' ? `2px solid ${SE.gold}` : `1px solid rgba(255,255,255,.42)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 950, boxShadow: highlight.length && filterOwner !== 'All' ? `0 0 0 3px rgba(201,168,76,.22)` : 'none' }}>
                    {items.length > 0 && <><span style={{ fontSize: 15 }}>{filterOwner !== 'All' && highlight.length ? `${highlight.length}/${items.length}` : items.length}</span><span style={{ fontSize: 7, opacity: .86 }}>risks</span></>}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '14px repeat(5, minmax(0, 1fr))', gap: 3 }}>
            <span />{[1, 2, 3, 4, 5].map(i => <span key={i} style={{ textAlign: 'center', color: palette.muted, fontSize: 9, fontWeight: 900 }}>{i}</span>)}
          </div>
          <div style={{ textAlign: 'center', color: palette.muted, fontSize: 9, letterSpacing: 1, fontWeight: 900, marginTop: 2 }}>IMPACT</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
        {Object.entries(ZONE_COLORS).map(([name, color]) => <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: palette.muted, fontSize: 9, fontWeight: 800 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: color }} />{name}</span>)}
      </div>
    </div>
  );
}

function TrendModal({ data, weeks, onClose, palette }: { data: DashboardData; weeks: { label: string }[]; onClose: () => void; palette: ThemePalette }) {
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.62)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: palette.cardSolid, border: `1px solid ${palette.border}`, borderRadius: 18, boxShadow: '0 30px 90px rgba(0,0,0,.35)', width: '100%', maxWidth: 1160, maxHeight: '86vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: palette.sectionHeader, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: 14 }}>Week-over-Week Trend Comparison — All Risks</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', color: 'white', cursor: 'pointer', borderRadius: 999, width: 32, height: 32, display: 'grid', placeItems: 'center' }}><X size={17} /></button>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: palette.tableHead, color: 'white' }}>
                <th style={modalTh}>Risk Title</th>
                <th style={modalTh}>Rating</th>
                {weeks.map(w => <th key={w.label} style={modalTh}>{w.label}</th>)}
                <th style={modalTh}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {data.riskRegister.map((risk, i) => {
                const weekVals = weeks.map(w => Math.round((risk.weekProgress[w.label] ?? 0) * 100));
                const overallChange = (weekVals[weekVals.length - 1] ?? 0) - (weekVals[0] ?? 0);
                return (
                  <tr key={risk.id} style={{ background: i % 2 === 0 ? palette.tableStripe : palette.cardSolid }}>
                    <td style={{ ...modalTd, color: palette.text, maxWidth: 250 }} title={risk.title}>{risk.title}</td>
                    <td style={{ ...modalTd, textAlign: 'center', color: getRatingColor(risk.rating), fontWeight: 900 }}>{risk.rating}</td>
                    {weekVals.map((val, wi) => {
                      const prev = wi > 0 ? weekVals[wi - 1] : val;
                      const color = val >= 100 ? SE.green : val > prev ? SE.blue : val < prev ? SE.red : palette.muted;
                      return <td key={wi} style={{ ...modalTd, color, textAlign: 'center', fontWeight: 900 }}>{val > 0 ? `${val}%` : '–'}</td>;
                    })}
                    <td style={{ ...modalTd, textAlign: 'center' }}><ChangeIndicator dev={overallChange} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const modalTh: CSSProperties = { padding: '9px 10px', textAlign: 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: 10, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,.10)' };
const modalTd: CSSProperties = { padding: '8px 10px', borderBottom: '1px solid rgba(148,163,184,.14)', borderRight: '1px solid rgba(148,163,184,.10)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

interface Props {
  data: DashboardData;
  fileName: string;
  onReset: () => void;
  onWeekChange: (week: string) => void;
}

export default function DashboardPage({ data, fileName, onReset, onWeekChange }: Props) {
  const { kpis, zoneCounts, progressCounts, riskSummary, riskRegister, selectedRisk, period, weeks, selectedWeek } = data;
  const [activeRisk, setActiveRisk] = useState(selectedRisk);
  const [showTrend, setShowTrend] = useState(false);
  const [filterRating, setFilterRating] = useState('All');
  const [filterOwner, setFilterOwner] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const dashboardRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const palette = useMemo(() => makePalette(isDark), [isDark]);
  const themeBg = isDark ? '/assets/dark.png' : '/assets/light.png';
  const bgForExport = isDark ? '#061630' : '#F8FBFF';

  useEffect(() => setActiveRisk(data.selectedRisk), [data.selectedRisk, data.selectedWeek]);

  const uniqueRatings = useMemo(() => {
    const ratings: string[] = ['All', ...Array.from(new Set(riskRegister.map(r => r.rating).filter((value): value is string => Boolean(value))))];
    const order = ['All', 'Very High', 'High', 'Moderate', 'Low', 'Very Low'];
    return ratings.sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  }, [riskRegister]);

  const uniqueOwners = useMemo(() => ['All', ...Array.from(new Set(riskRegister.map(r => r.owner).filter(Boolean))).sort()], [riskRegister]);
  const uniqueStatuses = ['All', 'Completed (100%)', 'In Progress (1-99%)', 'Not Started (0%)'];

  const filteredRisks = useMemo(() => {
    const q = normalise(searchTerm);
    return riskRegister.filter(r => {
      if (filterRating !== 'All' && r.rating !== filterRating) return false;
      if (filterOwner !== 'All' && r.owner !== filterOwner) return false;
      if (filterStatus !== 'All' && r.progressStatus !== filterStatus) return false;
      if (q && !normalise(`${r.title} ${r.mitigation} ${r.owner} ${r.rating} ${r.closingDate}`).includes(q)) return false;
      return true;
    });
  }, [riskRegister, filterRating, filterOwner, filterStatus, searchTerm]);

  const hasFilters = filterRating !== 'All' || filterOwner !== 'All' || filterStatus !== 'All' || searchTerm.trim().length > 0;

  const changesSummary = useMemo(() => {
    const improved = filteredRisks.filter(r => r.developmentPct > 0).length;
    const declined = filteredRisks.filter(r => r.developmentPct < 0).length;
    const noChange = filteredRisks.filter(r => r.developmentPct === 0).length;
    return { improved, declined, noChange, total: filteredRisks.length };
  }, [filteredRisks]);

  const professionalSummary = useMemo(() => {
    const now = Date.now();
    const overdue = riskRegister.filter(r => (r.currentPct || 0) < 100 && getDateValue(r.closingDate) !== null && Number(getDateValue(r.closingDate)) < now).length;
    const completed = riskRegister.filter(r => r.currentPct >= 100 || r.progressStatus === 'Completed (100%)').length;
    const highRisks = riskRegister.filter(r => r.score >= 15 || /high/i.test(r.rating));
    const ownerCounts = highRisks.reduce<Record<string, number>>((acc, r) => {
      const owner = r.owner || 'Unassigned';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {});
    const topOwnerEntry = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];
    const topOwner = topOwnerEntry?.[0] ?? 'None';
    const topOwnerCount = topOwnerEntry?.[1] ?? 0;
    const completedPct = riskRegister.length ? Math.round((completed / riskRegister.length) * 100) : 0;
    return { overdue, completed, completedPct, highRiskOwner: topOwner, highRiskOwnerCount: topOwnerCount, highRiskTotal: highRisks.length };
  }, [riskRegister]);

  const donutData = useMemo(() => [
    { name: 'Very High', value: zoneCounts.veryHigh, color: ZONE_COLORS['Very High'] },
    { name: 'High', value: zoneCounts.high, color: ZONE_COLORS.High },
    { name: 'Moderate', value: zoneCounts.moderate, color: ZONE_COLORS.Moderate },
    { name: 'Low', value: zoneCounts.low, color: ZONE_COLORS.Low },
    { name: 'Very Low', value: zoneCounts.veryLow, color: ZONE_COLORS['Very Low'] },
  ].filter(d => d.value > 0), [zoneCounts]);

  const categoryTotal = donutData.reduce((sum, d) => sum + d.value, 0);

  const weeklyMovementData = useMemo(() => weeks.map((w, index) => {
    const values = riskRegister.map(r => Math.round((r.weekProgress[w.label] ?? 0) * 100));
    const avgProgress = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const completed = values.filter(value => value >= 100).length;
    const previousValues = index > 0 ? riskRegister.map(r => Math.round((r.weekProgress[weeks[index - 1].label] ?? 0) * 100)) : values;
    const improved = values.filter((value, i) => value > (previousValues[i] ?? value)).length;
    const declined = values.filter((value, i) => value < (previousValues[i] ?? value)).length;
    return { week: w.label, avgProgress, completed, improved, declined };
  }), [riskRegister, weeks]);

  const ownerHighRiskData = useMemo(() => {
    const counts = riskRegister
      .filter(r => r.score >= 15 || /high/i.test(r.rating))
      .reduce<Record<string, number>>((acc, r) => {
        const owner = r.owner || 'Unassigned';
        acc[owner] = (acc[owner] || 0) + 1;
        return acc;
      }, {});
    return Object.entries(counts)
      .map(([owner, count]) => ({ owner: owner.length > 22 ? `${owner.slice(0, 22)}…` : owner, fullOwner: owner, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [riskRegister]);

  const overdueByOwnerData = useMemo(() => {
    const now = Date.now();
    const counts = riskRegister
      .filter(r => (r.currentPct || 0) < 100 && getDateValue(r.closingDate) !== null && Number(getDateValue(r.closingDate)) < now)
      .reduce<Record<string, number>>((acc, r) => {
        const owner = r.owner || 'Unassigned';
        acc[owner] = (acc[owner] || 0) + 1;
        return acc;
      }, {});
    return Object.entries(counts)
      .map(([owner, overdue]) => ({ owner: owner.length > 22 ? `${owner.slice(0, 22)}…` : owner, fullOwner: owner, overdue }))
      .sort((a, b) => b.overdue - a.overdue)
      .slice(0, 10);
  }, [riskRegister]);

  const progressData = useMemo(() => [
    { name: 'Not Started', fullName: 'Not Started (0%)', value: progressCounts.notStarted, color: SE.red },
    { name: 'In Progress', fullName: 'In Progress (1-99%)', value: progressCounts.inProgress, color: SE.gold },
    { name: 'Completed', fullName: 'Completed (100%)', value: progressCounts.completed, color: SE.green },
  ], [progressCounts]);

  const detailData = useMemo(() => riskRegister.map(r => ({
    name: r.title.length > 34 ? `${r.title.slice(0, 34)}…` : r.title,
    fullName: r.title,
    current: r.currentPct,
    before: r.beforePct,
    target: 100,
  })), [riskRegister]);

  const selectedChartData = activeRisk ? [
    { name: 'Current %', value: activeRisk.currentPct, color: SE.green },
    { name: 'Before %', value: activeRisk.beforePct, color: SE.gold },
    { name: 'Development %', value: Math.abs(activeRisk.developmentPct), color: activeRisk.developmentPct >= 0 ? SE.blue : SE.red },
  ] : [];

  const selectStyle: CSSProperties = {
    background: palette.cardSolid,
    border: `1px solid ${palette.border}`,
    borderRadius: 999,
    padding: '7px 32px 7px 10px',
    color: palette.text,
    fontSize: 11,
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(isDark ? '#A8C3DD' : '#64748B')}' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
  };

  const resetFilters = useCallback(() => {
    setFilterRating('All');
    setFilterOwner('All');
    setFilterStatus('All');
    setSearchTerm('');
  }, []);

  const handlePrint = useCallback(() => {
    const tableWrapper = document.getElementById('risk-table-wrapper');
    const prevMax = tableWrapper?.style.maxHeight ?? '';
    if (tableWrapper) tableWrapper.style.maxHeight = 'none';
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        if (tableWrapper) tableWrapper.style.maxHeight = prevMax;
      }, 500);
    }, 100);
  }, []);

  const exportRisksToExcel = useCallback(() => {
    const rows = filteredRisks.map(r => ({
      'Risk Title': r.title,
      Mitigation: r.mitigation,
      'Risk Owner': r.owner,
      Score: r.score,
      Rating: r.rating,
      'Closing Date': r.closingDate,
      'Progress Status': r.progressStatus,
      'Current %': r.currentPct,
      'Before %': r.beforePct,
      'Change %': r.developmentPct,
      Likelihood: r.likelihood,
      Impact: r.impact,
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Risk Register');
    XLSX.writeFile(wb, `TNOC_Risk_Register_${selectedWeek || period}.xlsx`);
  }, [filteredRisks, selectedWeek, period]);

  const scrollToSection = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const inputStyle: CSSProperties = {
    height: 33,
    minWidth: 240,
    borderRadius: 999,
    border: `1px solid ${palette.border}`,
    background: palette.cardSolid,
    color: palette.text,
    padding: '0 12px 0 32px',
    fontSize: 11,
    outline: 'none',
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A3 landscape; margin: 8mm 10mm; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .no-print, .no-print * { display: none !important; }
          header { position: static !important; box-shadow: none !important; }
          .dashboard-shell { background-image: none !important; background: #F8FBFF !important; }
          main { max-width: 100% !important; padding: 6px 8px !important; gap: 6px !important; }
          .dashboard-section { break-inside: avoid; box-shadow: none !important; border-radius: 8px !important; }
          .kpi-row { grid-template-columns: repeat(6, 1fr) !important; gap: 5px !important; }
          .kpi-tile { min-height: 110px !important; }
          .kpi-orb { width: 108px !important; height: 108px !important; }
          .kpi-value { font-size: 20px !important; }
          .kpi-label { font-size: 7px !important; }
          .chart-row { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .professional-chart-grid { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .professional-chart-wide { grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          .summary-row { grid-template-columns: 2fr 3fr !important; gap: 6px !important; }
          #risk-table-wrapper { max-height: none !important; overflow: visible !important; }
          .risk-table th, .risk-table td { font-size: 8px !important; padding: 3px 5px !important; }
          .selected-risk-section { page-break-before: always; }
          .recharts-wrapper, .recharts-surface { overflow: visible !important; }
        }
        @media (max-width: 1180px) { .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } .professional-chart-grid, .professional-chart-wide { grid-template-columns: 1fr !important; } }
        @media (max-width: 760px) { .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .kpi-orb { width: 126px !important; height: 126px !important; } }
      `}</style>

      {showTrend && weeks?.length > 1 && <TrendModal data={data} weeks={weeks} palette={palette} onClose={() => setShowTrend(false)} />}

      <div ref={dashboardRef} className="dashboard-shell" style={{ minHeight: '100vh', backgroundColor: palette.page, fontFamily: 'Inter, sans-serif', color: palette.text }}>
        <header style={{ background: palette.header, borderBottom: `1px solid ${palette.border}`, position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(16px)', boxShadow: isDark ? '0 14px 44px rgba(0,0,0,.28)' : '0 12px 34px rgba(31,56,100,.10)' }}>
          <div style={{ maxWidth: 1460, margin: '0 auto', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 7, flex: '0 0 auto' }}>
                {HEADER_LEFT_LOGOS.map(logo => <div key={logo.alt} style={{ height: 42, width: 72, padding: 5, borderRadius: 12, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.08)' }}><img src={logo.src} alt={logo.alt} style={{ maxHeight: logo.height, maxWidth: '100%', objectFit: 'contain' }} /></div>)}
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ margin: 0, color: palette.text, fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: 19, letterSpacing: '-.02em' }}>TNOC Risk Management Dashboard</h1>
                <div style={{ color: palette.muted, fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>{period}</span><span>·</span><span title={fileName}>{fileName}</span>
                </div>
              </div>
            </div>

            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <div style={{ height: 42, width: 72, padding: 5, borderRadius: 12, background: 'rgba(255,255,255,.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(0,0,0,.08)', marginRight: 4 }}>
                <img src={NASCO_LOGO.src} alt={NASCO_LOGO.alt} style={{ maxHeight: NASCO_LOGO.height, maxWidth: '100%', objectFit: 'contain' }} />
              </div>
              {weeks?.length > 0 && <select value={selectedWeek || ''} onChange={e => onWeekChange(e.target.value)} style={selectStyle}>{weeks.map(w => <option key={w.label} value={w.label}>{w.label}</option>)}</select>}
              {['kpi-section', 'summary-section', 'charts-section', 'risk-register-section'].map(id => <button key={id} type="button" onClick={() => scrollToSection(id)} style={{ border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.text, borderRadius: 999, padding: '7px 10px', fontSize: 10, fontWeight: 850, cursor: 'pointer' }}>{id.includes('kpi') ? 'KPI' : id.includes('summary') ? 'Summary' : id.includes('charts') ? 'Charts' : 'Register'}</button>)}
              <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: SE.navy, border: 'none', borderRadius: 999, padding: '8px 12px', color: 'white', fontWeight: 850, fontSize: 11, cursor: 'pointer' }}><Printer size={13} />PDF</button>
              <button onClick={() => exportElementAsPNG(dashboardRef, 'TNOC_Full_Dashboard.png', bgForExport)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `linear-gradient(135deg, ${SE.blue}, ${SE.teal})`, border: 'none', borderRadius: 999, padding: '8px 12px', color: 'white', fontWeight: 850, fontSize: 11, cursor: 'pointer' }}><ImageDown size={13} />PNG</button>
              <ThemeToggle />
              <button onClick={onReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: SE.red, border: 'none', borderRadius: 999, padding: '8px 12px', color: 'white', fontWeight: 850, fontSize: 11, cursor: 'pointer' }}><Home size={13} />Home</button>
              <button onClick={onReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 999, padding: '8px 12px', color: palette.text, fontWeight: 850, fontSize: 11, cursor: 'pointer' }}><Upload size={13} />New File</button>
            </div>
          </div>
        </header>

        <div className="dashboard-theme-stage" style={{ minHeight: 'calc(100vh - 65px)', backgroundImage: `${isDark ? 'linear-gradient(180deg, rgba(2,6,23,.70), rgba(2,6,23,.78))' : 'linear-gradient(180deg, rgba(248,251,255,.78), rgba(248,251,255,.90))'}, url(${themeBg})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundAttachment: 'fixed' }}>
        <main style={{ maxWidth: 1460, margin: '0 auto', padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SectionCard id="kpi-section" title="Executive KPI Overview" palette={palette} bodyRef={kpiRef} compact actions={<><SmallActionButton palette={palette} onClick={() => exportElementAsPNG(kpiRef, 'TNOC_KPI_Overview.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton></>}>
            <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 9 }}>
              <KpiTile label="Total Risks" value={kpis.totalRisks} color={SE.navy} selectedWeek={selectedWeek} index={0} palette={palette} />
              <KpiTile label="Total Mitigation" value={kpis.totalMitigation} color={SE.blue} selectedWeek={selectedWeek} index={1} palette={palette} />
              <KpiTile label="Above Target" value={kpis.aboveTarget} color={SE.green} selectedWeek={selectedWeek} index={2} palette={palette} />
              <KpiTile label="Below Target" value={kpis.belowTarget} color={SE.red} selectedWeek={selectedWeek} index={3} palette={palette} />
              <KpiTile label="Avg. Risk Score" value={kpis.avgRiskScore} color={SE.orange} selectedWeek={selectedWeek} index={4} palette={palette} />
              <KpiTile label="Avg. Risk Rating" value={kpis.avgRiskRating} isText color={SE.navy2} selectedWeek={selectedWeek} index={5} palette={palette} />
            </div>
          </SectionCard>

          <SectionCard id="summary-section" title="Professional Risk Movement Summary" palette={palette} bodyRef={summaryRef} compact actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(summaryRef, 'TNOC_Risk_Movement_Summary.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 9 }}>
              {[
                { label: 'Improved vs Previous Week', value: changesSummary.improved, sub: `${changesSummary.total} filtered risks`, color: SE.green, icon: <TrendingUp size={16} /> },
                { label: 'Declined vs Previous Week', value: changesSummary.declined, sub: 'Needs management attention', color: SE.red, icon: <TrendingDown size={16} /> },
                { label: 'Overdue Mitigations', value: professionalSummary.overdue, sub: 'Open risks past closing date', color: SE.orange, icon: <EyeOff size={16} /> },
                { label: 'Completed Actions', value: professionalSummary.completed, sub: `${professionalSummary.completedPct}% of risk register`, color: SE.teal, icon: <Eye size={16} /> },
                { label: 'High-Risk Ownership', value: professionalSummary.highRiskOwnerCount, sub: `${professionalSummary.highRiskOwner} · ${professionalSummary.highRiskTotal} high risks`, color: SE.blue, icon: <BarChart2 size={16} /> },
              ].map(card => (
                <div key={card.label} style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 15, padding: '12px 12px', display: 'flex', gap: 10, alignItems: 'center', minHeight: 76 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 13, display: 'grid', placeItems: 'center', background: card.color, color: 'white', flexShrink: 0 }}>{card.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: card.color, fontFamily: 'DM Sans, sans-serif', fontSize: 24, lineHeight: 1, fontWeight: 950 }}>{typeof card.value === 'number' ? <AnimatedNumber value={card.value} animationKey={`${selectedWeek}-${card.label}`} /> : card.value}</div>
                    <div style={{ color: palette.text, fontSize: 10, fontWeight: 900, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{card.label}</div>
                    <div style={{ color: palette.muted, fontSize: 10, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard id="charts-section" title="Professional Risk Analytics Charts" palette={palette} bodyRef={chartsRef} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(chartsRef, 'TNOC_Risk_Analytics_Charts.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div className="professional-chart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>1. Risk Category Donut</h3>
                <div style={{ position: 'relative', height: 210 }}>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={2} dataKey="value" animationDuration={650} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, value }: any) => {
                        if (!value) return null;
                        const r = innerRadius + (outerRadius - innerRadius) * 0.55;
                        const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                        const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                        return <text x={x} y={y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 950, fill: 'white' }}>{value}</text>;
                      }}>
                        {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke={palette.cardSolid} strokeWidth={2} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip palette={palette} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}><div style={{ textAlign: 'center' }}><div style={{ color: SE.red, fontSize: 30, fontFamily: 'DM Sans, sans-serif', fontWeight: 950 }}>{categoryTotal}</div><div style={{ color: palette.muted, fontSize: 10, fontWeight: 800 }}>TOTAL RISKS</div></div></div>
                </div>
                <div style={legendStyle}>{donutData.map(d => <span key={d.name} style={legendItem(palette)}><span style={{ width: 9, height: 9, borderRadius: 999, background: d.color }} />{d.name}</span>)}</div>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>2. Risk Score Gauge</h3>
                <ProgressGauge score={kpis.avgRiskScore} palette={palette} />
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>3. Risk Matrix Heatmap</h3>
                <RiskHeatmap risks={riskRegister} filterOwner={filterOwner} palette={palette} />
              </div>
            </div>

            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 10, marginTop: 10 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>4. Weekly Movement Line Chart</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyMovementData} margin={{ top: 14, right: 26, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: palette.text, fontWeight: 700 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: palette.muted }} domain={[0, 100]} unit="%" axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: palette.muted }} allowDecimals={false} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} formatter={v => <span style={{ color: palette.muted, fontSize: 10 }}>{v}</span>} />
                    <Line yAxisId="left" type="monotone" dataKey="avgProgress" name="Avg Progress %" stroke={SE.blue} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" dataKey="completed" name="Completed Risks" stroke={SE.green} strokeWidth={2.4} dot={{ r: 3 }} />
                    <Line yAxisId="right" type="monotone" dataKey="declined" name="Declined Risks" stroke={SE.red} strokeWidth={2.2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>5. Owner High-Risk Ranking</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={ownerHighRiskData} layout="vertical" margin={{ top: 8, right: 38, left: 4, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.chartGrid} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: palette.muted }} allowDecimals={false} axisLine={{ stroke: palette.border }} tickLine={false} domain={[0, Math.max(2, ...ownerHighRiskData.map(d => d.count)) + 1]} />
                    <YAxis type="category" dataKey="owner" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="count" name="High Risks" fill={SE.red} radius={[0, 8, 8, 0]} animationDuration={650} label={{ position: 'right', fontSize: 11, fontWeight: 900, fill: palette.text }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 10, marginTop: 10 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>6. Overdue Mitigation Bar Chart</h3>
                {overdueByOwnerData.length > 0 ? <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={overdueByOwnerData} layout="vertical" margin={{ top: 8, right: 38, left: 4, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.chartGrid} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: palette.muted }} allowDecimals={false} axisLine={{ stroke: palette.border }} tickLine={false} domain={[0, Math.max(2, ...overdueByOwnerData.map(d => d.overdue)) + 1]} />
                    <YAxis type="category" dataKey="owner" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="overdue" name="Overdue Open Risks" fill={SE.orange} radius={[0, 8, 8, 0]} animationDuration={650} label={{ position: 'right', fontSize: 11, fontWeight: 900, fill: palette.text }} />
                  </BarChart>
                </ResponsiveContainer> : <div style={{ height: 250, display: 'grid', placeItems: 'center', color: SE.green, fontWeight: 900, fontSize: 13, textAlign: 'center' }}>No overdue open mitigations detected</div>}
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Mitigation Progress Detail — {selectedWeek || period}</h3>
                <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                  <ResponsiveContainer width="100%" height={Math.max(240, detailData.length * 22)}>
                    <BarChart data={detailData} layout="vertical" margin={{ top: 4, right: 54, left: 6, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.chartGrid} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: palette.muted }} domain={[0, 100]} unit="%" axisLine={{ stroke: palette.border }} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: palette.text }} width={165} axisLine={false} tickLine={false} />
                      <Tooltip content={<ChartTooltip palette={palette} />} />
                      <Bar dataKey="current" name="Current %" fill={SE.blue} radius={[0, 4, 4, 0]} barSize={6} animationDuration={600} />
                      <Bar dataKey="before" name="Before %" fill={SE.gold} radius={[0, 4, 4, 0]} barSize={6} animationDuration={600} />
                      <Bar dataKey="target" name="Target %" fill={SE.red} radius={[0, 4, 4, 0]} barSize={6} animationDuration={600} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={legendStyle}>{[[SE.blue, 'Current %'], [SE.gold, 'Before %'], [SE.red, 'Target %']].map(([c, l]) => <span key={l} style={legendItem(palette)}><span style={{ width: 12, height: 7, background: c, borderRadius: 2 }} />{l}</span>)}</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="risk-register-section" title={`Risk Register — ${selectedWeek || period}`} palette={palette} bodyRef={registerRef} actions={<><SmallActionButton palette={palette} onClick={exportRisksToExcel}><FileSpreadsheet size={12} />Excel</SmallActionButton><SmallActionButton palette={palette} onClick={() => exportElementAsPNG(registerRef, 'TNOC_Risk_Register.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>{weeks?.length > 1 && <SmallActionButton palette={palette} onClick={() => setShowTrend(true)}><BarChart2 size={12} />Trend</SmallActionButton>}</>}>
            <div className="no-print" style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.text, fontSize: 11, fontWeight: 900 }}><Filter size={13} />Filters</span>
              <div style={{ position: 'relative' }}><Search size={13} style={{ position: 'absolute', left: 12, top: 10, color: palette.muted }} /><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search title, mitigation, owner…" style={inputStyle} /></div>
              <select value={filterRating} onChange={e => setFilterRating(e.target.value)} style={selectStyle}>{uniqueRatings.map(r => <option key={r} value={r}>{r === 'All' ? 'All Ratings' : r}</option>)}</select>
              <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)} style={selectStyle}>{uniqueOwners.map(o => <option key={o} value={o}>{o === 'All' ? 'All Owners' : o}</option>)}</select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>{uniqueStatuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}</select>
              {hasFilters && <button onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${palette.border}`, borderRadius: 999, background: palette.cardSolid, color: palette.text, height: 32, padding: '0 10px', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}><RotateCcw size={12} />Clear</button>}
              <span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11, fontWeight: 800 }}>Showing {filteredRisks.length} of {riskRegister.length}</span>
            </div>

            <div style={{ background: isDark ? 'rgba(14,39,79,.72)' : '#EBF8FF', border: `1px solid ${palette.border}`, borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: palette.text }}>Changes vs Previous Week</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: SE.green, fontWeight: 900 }}><span style={pillCircle(SE.green)}>{changesSummary.improved}</span>Improved</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: SE.red, fontWeight: 900 }}><span style={pillCircle(SE.red)}>{changesSummary.declined}</span>Declined</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: palette.muted, fontWeight: 900 }}><span style={pillCircle('#95A5A6')}>{changesSummary.noChange}</span>No Change</span>
            </div>

            <div id="risk-table-wrapper" style={{ overflow: 'auto', maxHeight: 470, borderRadius: 14, border: `1px solid ${palette.border}` }}>
              <table className="risk-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                  <tr style={{ background: palette.tableHead, color: 'white' }}>
                    {['Risk Title', 'Mitigation', 'Risk Owner', 'Score', 'Rating', 'Closing Date', 'Trend', 'Current %', 'Before %', 'Change'].map(h => <th key={h} style={{ padding: '9px 9px', textAlign: h.includes('%') || h === 'Score' || h === 'Trend' || h === 'Change' ? 'center' : 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: 10, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,.10)' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.length === 0 ? <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: palette.muted, background: palette.cardSolid }}>No risks match the selected filters.</td></tr> : filteredRisks.map((row, i) => {
                    const isActive = activeRisk?.id === row.id;
                    const isHighScore = row.score >= 20;
                    const rowBg = isActive ? 'linear-gradient(135deg, #073266, #0078FF)' : isHighScore ? 'linear-gradient(135deg, rgba(192,57,43,.95), rgba(123,36,28,.95))' : i % 2 === 0 ? palette.tableStripe : palette.cardSolid;
                    const textColor = isActive || isHighScore ? 'white' : palette.text;
                    return (
                      <tr key={row.id} onClick={() => setActiveRisk(row)} style={{ background: rowBg, cursor: 'pointer' }} onMouseEnter={e => { if (!isActive && !isHighScore) e.currentTarget.style.background = palette.tableHover; }} onMouseLeave={e => { if (!isActive && !isHighScore) e.currentTarget.style.background = i % 2 === 0 ? palette.tableStripe : palette.cardSolid; }}>
                        <td style={tableTd(textColor, palette)}><div style={{ maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isHighScore ? 900 : 700 }} title={row.title}>{row.title}</div></td>
                        <td style={tableTd(textColor, palette)}><div style={{ maxWidth: 310, maxHeight: 40, overflow: 'hidden', lineHeight: 1.35, fontSize: 10 }} title={row.mitigation}>{row.mitigation}</div></td>
                        <td style={tableTd(textColor, palette)}>{row.owner || '–'}</td>
                        <td style={{ ...tableTd(textColor, palette), textAlign: 'center' }}><ScoreBadge score={row.score} /></td>
                        <td style={{ ...tableTd(isActive || isHighScore ? 'white' : getRatingColor(row.rating), palette), fontWeight: 900 }}>{row.rating}</td>
                        <td style={tableTd(textColor, palette)}>{row.closingDate || '–'}</td>
                        <td style={{ ...tableTd(textColor, palette), textAlign: 'center' }}>{weeks?.length > 1 ? <Sparkline weekProgress={row.weekProgress} weeks={weeks} /> : <span style={{ color: palette.muted }}>–</span>}</td>
                        <td style={{ ...tableTd(textColor, palette), textAlign: 'center', fontWeight: 900 }}>{row.currentPct > 0 ? `${row.currentPct}%` : '–'}</td>
                        <td style={{ ...tableTd(textColor, palette), textAlign: 'center', fontWeight: 900 }}>{row.beforePct > 0 ? `${row.beforePct}%` : '–'}</td>
                        <td style={{ ...tableTd(textColor, palette), textAlign: 'center' }}><ChangeIndicator dev={row.developmentPct} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {activeRisk && <SectionCard id="selected-risk-section" title={`Selected Risk Detail — ${activeRisk.title}`} palette={palette} bodyRef={selectedRef} defaultOpen={false} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(selectedRef, 'TNOC_Selected_Risk_Detail.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div className="selected-risk-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 14, alignItems: 'start' }}>
              <div style={chartBox(palette)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><ScoreBadge score={activeRisk.score} /><span style={{ color: getRatingColor(activeRisk.rating), fontWeight: 950, fontSize: 12 }}>{activeRisk.rating}</span><span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11 }}>{activeRisk.owner}</span></div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={selectedChartData} margin={{ top: 18, right: 20, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: palette.text }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: palette.muted }} domain={[0, 100]} unit="%" axisLine={{ stroke: palette.border }} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="value" name="Value" radius={[8, 8, 0, 0]} animationDuration={650} label={{ position: 'top', fontSize: 11, fontWeight: 900, fill: palette.text, formatter: (v: number) => v > 0 ? `${v}%` : 'No Change' }}>
                      {selectedChartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 14, color: palette.text }}>
                <h3 style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 950, color: palette.text }}>Mitigation Plan</h3>
                <p style={{ whiteSpace: 'pre-line', fontSize: 12, lineHeight: 1.6, color: palette.muted, marginTop: 8 }}>{activeRisk.mitigation || 'No mitigation details available.'}</p>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div style={miniMetric(palette)}><span>Owner</span><strong>{activeRisk.owner || '–'}</strong></div>
                  <div style={miniMetric(palette)}><span>Closing Date</span><strong>{activeRisk.closingDate || '–'}</strong></div>
                  <div style={miniMetric(palette)}><span>Status</span><strong>{activeRisk.progressStatus || '–'}</strong></div>
                </div>
                {weeks?.length > 1 && <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: palette.cardSolid, border: `1px solid ${palette.border}` }}>
                  <div style={{ fontSize: 10, color: palette.muted, marginBottom: 6, fontWeight: 900 }}>Progress trend across all weeks</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>{weeks.map((w, i) => {
                    const val = Math.round((activeRisk.weekProgress[w.label] ?? 0) * 100);
                    const prev = i > 0 ? Math.round((activeRisk.weekProgress[weeks[i - 1].label] ?? 0) * 100) : val;
                    const color = val > prev ? SE.green : val < prev ? SE.red : palette.muted;
                    const isSelected = w.label === selectedWeek;
                    return <div key={w.label} style={{ minWidth: 72, textAlign: 'center', padding: '6px 7px', borderRadius: 10, background: isSelected ? 'rgba(0,120,255,.16)' : 'transparent', border: isSelected ? `1px solid ${SE.blue}` : `1px solid ${palette.border}` }}><div style={{ fontSize: 13, fontWeight: 950, color }}>{val}%</div><div style={{ fontSize: 8, color: palette.muted, marginTop: 2, whiteSpace: 'nowrap' }}>{w.label}</div></div>;
                  })}</div>
                </div>}
              </div>
            </div>
          </SectionCard>}

          <footer style={{ textAlign: 'center', fontSize: 10, color: palette.muted, padding: '3px 0 10px' }}>TNOC Risk Management Dashboard · {period} · Click any risk row to update selected risk detail</footer>
        </main>
        </div>
      </div>
    </>
  );
}

function chartBox(palette: ThemePalette): CSSProperties {
  return { background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 12, minHeight: 0 };
}

function chartTitle(palette: ThemePalette): CSSProperties {
  return { margin: '0 0 8px', fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: 12, color: palette.text, letterSpacing: '-.01em' };
}

function miniMetric(palette: ThemePalette): CSSProperties {
  return { background: palette.cardSolid, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3, color: palette.muted, fontSize: 10, fontWeight: 800 };
}

function legendItem(palette: ThemePalette): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 9.5, color: palette.muted, fontWeight: 800 };
}

const legendStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '6px 10px', justifyContent: 'center', marginTop: 5 };

function pillCircle(color: string): CSSProperties {
  return { width: 22, height: 22, borderRadius: '50%', background: color, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 950, fontSize: 11 };
}

function tableTd(color: string, palette: ThemePalette): CSSProperties {
  return { padding: '7px 9px', color, borderBottom: `1px solid ${palette.border}`, borderRight: `1px solid ${palette.border}`, whiteSpace: 'nowrap', verticalAlign: 'middle' };
}
