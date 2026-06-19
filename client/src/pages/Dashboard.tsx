import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import {
  Upload, Printer, TrendingUp, TrendingDown, Minus, Filter, X, BarChart2,
  ChevronDown, ChevronRight, Home, ImageDown, FileSpreadsheet, Search,
  RotateCcw, Download, Eye, EyeOff, Moon, Sun,
  AlertTriangle, Activity, Layers, Target,
} from 'lucide-react';
import { DashboardData, getScoreColor, getRatingColor, type RiskRow } from '@/lib/excelParser';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

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
    <div style={{ minHeight: 286, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 10 }}>
      <svg viewBox="0 0 300 205" width="100%" height="238" aria-label="Average risk score gauge" style={{ display: 'block', overflow: 'visible' }}>
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
      <div style={{ width: '100%', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '5px 10px', padding: '2px 6px 0', marginTop: 0 }}>
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

function parseQuarterPeriod(value: string): { year: number; quarter: number; index: number; endMs: number } | null {
  if (!value) return null;
  const text = String(value).trim();
  // Supports: 2025 Q1, 2025-Q1, 2025/Q1, Q1 2025, Q1-2025, q2/2026
  const match =
    text.match(/(?:^|\b)(\d{4})\s*[\-\/\s]*[Qq]([1-4])(?:\b|$)/) ||
    text.match(/(?:^|\b)[Qq]([1-4])\s*[\-\/\s]*(\d{4})(?:\b|$)/);
  if (!match) return null;
  const first = match[1];
  const second = match[2];
  const year = first.length === 4 ? Number(first) : Number(second);
  const quarter = first.length === 4 ? Number(second) : Number(first);
  const quarterEnd: [number, number][] = [
    [2, 31],   // Q1 → March 31
    [5, 30],   // Q2 → June 30
    [8, 30],   // Q3 → September 30
    [11, 31],  // Q4 → December 31
  ];
  const [month, day] = quarterEnd[quarter - 1];
  return { year, quarter, index: year * 4 + quarter, endMs: new Date(year, month, day).getTime() };
}

function canonicalQuarterLabel(value: string): string {
  const period = parseQuarterPeriod(value);
  return period ? `Q${period.quarter} ${period.year}` : String(value || '').trim();
}

function sortQuarterLabels(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const qa = parseQuarterPeriod(a);
    const qb = parseQuarterPeriod(b);
    if (qa && qb) return qa.index - qb.index;
    if (qa) return -1;
    if (qb) return 1;
    return a.localeCompare(b);
  });
}

function latestSelectedQuarterLabel(selected: string[], orderedOptions: string[]): string {
  const selectedSet = new Set(selected.map(canonicalQuarterLabel));
  const ordered = orderedOptions.filter(label => selectedSet.has(canonicalQuarterLabel(label)));
  return ordered[ordered.length - 1] || selected[selected.length - 1] || orderedOptions[orderedOptions.length - 1] || '';
}

function quarterEndProgressMonthLabel(periodLabel: string, orderedWeeks: { label: string }[]): string {
  const period = parseQuarterPeriod(periodLabel);
  if (!period) return orderedWeeks[orderedWeeks.length - 1]?.label || '';
  const quarterStartMonth = (period.quarter - 1) * 3;
  const quarterEndMonth = quarterStartMonth + 2;
  const candidates = orderedWeeks.filter(w => {
    const ms = getDateValue(w.label);
    if (ms === null) return false;
    const d = new Date(ms);
    return d.getFullYear() === period.year && d.getMonth() >= quarterStartMonth && d.getMonth() <= quarterEndMonth;
  });
  if (candidates.length) return candidates[candidates.length - 1].label;
  const before = orderedWeeks.filter(w => {
    const ms = getDateValue(w.label);
    return ms !== null && ms <= period.endMs;
  });
  return before[before.length - 1]?.label || orderedWeeks[orderedWeeks.length - 1]?.label || '';
}

function quarterTrendMonthLabels(periodLabels: string[], orderedWeeks: { label: string }[]): string[] {
  if (!periodLabels.length) return orderedWeeks.map(w => w.label);
  const periods = periodLabels.map(label => parseQuarterPeriod(label)).filter((p): p is NonNullable<ReturnType<typeof parseQuarterPeriod>> => Boolean(p));
  if (!periods.length) return orderedWeeks.map(w => w.label);
  return orderedWeeks
    .filter(w => {
      const ms = getDateValue(w.label);
      if (ms === null) return false;
      const d = new Date(ms);
      const q = Math.floor(d.getMonth() / 3) + 1;
      return periods.some(p => p.year === d.getFullYear() && p.quarter === q);
    })
    .map(w => w.label);
}

function getDateValue(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();

  if (typeof value === 'number' && value > 36526 && value < 50000) {
    const d = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }

  const text = String(value).trim();
  if (!text || text.startsWith('#')) return null;

  // 1. Quarter strings: 2025 Q1, Q1 2025, 2025-Q2, q3/2026, etc.
  //    Q1 → Mar 31 | Q2 → Jun 30 | Q3 → Sep 30 | Q4 → Dec 31
  const quarterPeriod = parseQuarterPeriod(text);
  if (quarterPeriod) return quarterPeriod.endMs;

  // 2. dd/mm/yyyy or dd-mm-yyyy. This MUST run before Date.parse because
  // browsers may read 01/05/2026 as Jan 5 instead of 1 May.
  const dmyMatch = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const year = y.length === 2 ? Number(`20${y}`) : Number(y);
    const day = Number(d);
    const month = Number(m) - 1;
    const parsedDate = new Date(year, month, day);
    if (!Number.isNaN(parsedDate.getTime()) && parsedDate.getFullYear() === year && parsedDate.getMonth() === month && parsedDate.getDate() === day) {
      return parsedDate.getTime();
    }
  }

  // 3. ISO yyyy-mm-dd / yyyy/mm/dd.
  const isoMatch = text.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const parsedDate = new Date(year, month, day);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();
  }

  // 4. Month-name formats: "Jan 2026", "January 2026", "2026 Jan", "Mar-2026"
  const monthNames: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
    january: 0, february: 1, march: 2, april: 3, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  };
  const monthYearMatch = text.match(/([A-Za-z]+)[\s,\-]+(\d{4})|(\d{4})[\s,\-]+([A-Za-z]+)/);
  if (monthYearMatch) {
    const monthStr = (monthYearMatch[1] || monthYearMatch[4] || '').toLowerCase();
    const yearStr  = monthYearMatch[2] || monthYearMatch[3];
    const month = monthNames[monthStr];
    if (month !== undefined && yearStr) {
      const yr = Number(yearStr);
      const lastDay = new Date(yr, month + 1, 0).getDate();
      return new Date(yr, month, lastDay).getTime();
    }
  }

  // 5. Last-resort browser parse for long date strings.
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalise(text: string) {
  return (text || '').toLowerCase().trim();
}

const PAGE_SIZE = 10;

function riskIsOverdue(risk: RiskRow): boolean {
  const scoped = risk as RiskRow & { __monthScoped?: boolean };
  if (scoped.__monthScoped) return Boolean(risk.isOverdue);
  if ((risk.currentPct || 0) >= 100) return false;
  const due = getDateValue(risk.closingDate || '');
  return due !== null && due < Date.now();
}



function progressStatusFromPct(value: number): string {
  if (value >= 100) return 'Completed (100%)';
  if (value > 0) return 'In Progress (1-99%)';
  return 'Not Started (0%)';
}

function summarizeMonthLabels(labels: string[], totalCount: number): string {
  if (!labels.length || labels.length === totalCount) return 'All Months';
  if (labels.length === 1) return labels[0];
  return `${labels.length} Months`;
}

function latestSelectedMonthLabel(monthLabels: string[], orderedWeeks: { label: string }[]): string {
  const selected = new Set(monthLabels);
  const ordered = orderedWeeks.map(w => w.label).filter(label => selected.has(label));
  return ordered[ordered.length - 1] || monthLabels[monthLabels.length - 1] || orderedWeeks[orderedWeeks.length - 1]?.label || '';
}

function riskIsIdentifiedByMonth(risk: RiskRow, snapshotLabel: string, firstReportMonthLabel?: string, requireIdentificationDate = false): boolean {
  // Identification Date is quarter-based in the source file (example: "2025 Q1").
  // The selected Identification Date filter also uses quarter labels, so the
  // snapshot cutoff must parse quarters first. If the label is a month, it falls
  // back to that month's quarter.
  const identifiedText = (risk.identificationDate || '').trim();
  if (!identifiedText) return !requireIdentificationDate;

  const identifiedQuarter = parseQuarterPeriod(identifiedText);
  const snapshotQuarter = parseQuarterPeriod(snapshotLabel);
  const snapshotMs = getDateValue(snapshotLabel);
  const firstReportMs = firstReportMonthLabel ? getDateValue(firstReportMonthLabel) : null;

  let snapshotQuarterIndex: number | null = null;
  if (snapshotQuarter) {
    snapshotQuarterIndex = snapshotQuarter.index;
  } else if (snapshotMs !== null) {
    const snapshotDate = new Date(snapshotMs);
    snapshotQuarterIndex = snapshotDate.getFullYear() * 4 + (Math.floor(snapshotDate.getMonth() / 3) + 1);
  }

  let firstQuarterIndex: number | null = null;
  if (firstReportMs !== null) {
    const firstDate = new Date(firstReportMs);
    firstQuarterIndex = firstDate.getFullYear() * 4 + (Math.floor(firstDate.getMonth() / 3) + 1);
  }

  if (identifiedQuarter) {
    if (snapshotQuarterIndex === null) return true;
    return identifiedQuarter.index <= snapshotQuarterIndex &&
      (firstQuarterIndex === null || identifiedQuarter.index >= firstQuarterIndex);
  }

  // Normal date fallback for files that use day/month/year or month/year.
  const cutoff = snapshotQuarter?.endMs ?? snapshotMs;
  const identified = getDateValue(identifiedText);
  if (cutoff === null) return true;
  if (identified === null) return false;
  return identified <= cutoff && (firstReportMs === null || identified >= firstReportMs);
}

function monthScopedRisk(risk: RiskRow, monthLabels: string[], orderedWeeks: { label: string }[]): RiskRow {
  const labels = monthLabels.length ? monthLabels : orderedWeeks.map(w => w.label);
  const snapshotLabel = latestSelectedMonthLabel(labels, orderedWeeks);
  const snapshotVal = snapshotLabel ? (risk.weekProgress[snapshotLabel] ?? 0) : (risk.currentPct || 0) / 100;
  const snapshotMs = getDateValue(snapshotLabel) ?? Date.now();
  const currentPct = Math.round(snapshotVal > 1 ? snapshotVal : snapshotVal * 100);
  const snapshotIndex = orderedWeeks.findIndex(w => w.label === snapshotLabel);
  const prevLabel = snapshotIndex > 0 ? orderedWeeks[snapshotIndex - 1]?.label : snapshotLabel;
  const prevVal = prevLabel ? (risk.weekProgress[prevLabel] ?? snapshotVal) : snapshotVal;
  const beforePct = Math.round(prevVal > 1 ? prevVal : prevVal * 100);
  return {
    ...risk,
    currentPct,
    beforePct,
    developmentPct: currentPct - beforePct,
    progressStatus: progressStatusFromPct(currentPct),
    aboveTarget: currentPct >= 100,
    belowTarget: currentPct < 100,
    isOverdue: currentPct < 100 && (() => {
      const due = getDateValue(risk.closingDate || '');
      return due !== null && due < snapshotMs;
    })(),
    __monthScoped: true,
    __snapshotMs: snapshotMs,
  } as RiskRow;
}

function riskSeverityRank(risk: RiskRow): number {
  const rating = (risk.rating || '').toLowerCase();
  if (rating.includes('very high') || risk.score >= 20) return 5;
  if (rating.includes('high') || risk.score >= 15) return 4;
  if (rating.includes('moderate') || risk.score >= 9) return 3;
  if (rating.includes('low') || risk.score >= 5) return 2;
  return 1;
}

function riskRatingLabelFromScore(score: number): string {
  if (score >= 20) return 'Very High';
  if (score >= 15) return 'High';
  if (score >= 9) return 'Moderate';
  if (score >= 5) return 'Low';
  return 'Very Low';
}

function getOverdueDays(risk: RiskRow): number {
  if (!riskIsOverdue(risk)) return 0;
  const due = getDateValue(risk.closingDate || '');
  const asOf = (risk as RiskRow & { __snapshotMs?: number }).__snapshotMs ?? Date.now();
  if (due === null) return 0;
  return Math.max(1, Math.floor((asOf - due) / 86400000));
}

function getOverdueBucket(risk: RiskRow): string {
  const days = getOverdueDays(risk);
  if (!days) return 'On Track';
  if (days > 90) return 'Overdue >90 Days';
  if (days > 60) return 'Overdue 61–90 Days';
  if (days > 30) return 'Overdue 31–60 Days';
  return 'Overdue 1–30 Days';
}

function sortDateLabels(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const da = getDateValue(a);
    const db = getDateValue(b);
    if (da !== null && db !== null) return da - db;
    if (da !== null) return -1;
    if (db !== null) return 1;
    return a.localeCompare(b);
  });
}

function PaginationControls({ page, totalItems, pageSize = PAGE_SIZE, onPageChange, palette, label = 'records' }: { page: number; totalItems: number; pageSize?: number; onPageChange: (page: number) => void; palette: ThemePalette; label?: string }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', padding: '10px 12px', marginTop: 10, border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.cardSoft }}>
      <span style={{ color: palette.muted, fontSize: 11, fontWeight: 850 }}>
        Showing {start}-{end} of {totalItems} {label} · 10 per page · no internal scroll
      </span>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} style={pagerButtonStyle(palette, false, safePage <= 1)}>Prev</button>
        {pages.map(n => (
          <button key={n} type="button" onClick={() => onPageChange(n)} style={pagerButtonStyle(palette, n === safePage)}>{n}</button>
        ))}
        <button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} style={pagerButtonStyle(palette, false, safePage >= totalPages)}>Next</button>
      </div>
    </div>
  );
}

function pagerButtonStyle(palette: ThemePalette, active = false, disabled = false): CSSProperties {
  return {
    minWidth: 30,
    height: 28,
    borderRadius: 999,
    border: active ? `1px solid ${SE.blue}` : `1px solid ${palette.border}`,
    background: active ? 'linear-gradient(135deg, #0078FF 0%, #00AEEF 100%)' : palette.cardSolid,
    color: active ? '#fff' : palette.text,
    opacity: disabled ? 0.45 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 10,
    fontWeight: 900,
    padding: '0 10px',
    fontFamily: 'DM Sans, Inter, sans-serif',
  };
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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  actions?: ReactNode;
  bodyRef?: RefObject<HTMLDivElement | null>;
  compact?: boolean;
}

function SectionCard({ id, title, palette, defaultOpen = false, open: controlledOpen, onOpenChange, children, actions, bodyRef, compact = false }: SectionCardProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const toggleOpen = () => {
    const nextOpen = !open;
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <section id={id} className="dashboard-section" style={{ background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 18, overflow: 'hidden', boxShadow: palette.shadow, backdropFilter: 'blur(18px)' }}>
      <div style={{ background: palette.sectionHeader, padding: compact ? '7px 12px' : '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="no-print" onClick={toggleOpen} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: compact ? 12 : 13, cursor: 'pointer', padding: 0 }}>
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


function optionList(values: string[]): string[] {
  return values.filter(value => value && value !== 'All');
}

function matchesMultiFilter(value: string, selected: string[]): boolean {
  if (!selected.length) return true;
  return selected.includes(value);
}

function isMultiFilterActive(selected: string[], options: string[]): boolean {
  const cleanOptions = optionList(options);
  if (!selected.length) return false;
  if (cleanOptions.length && selected.length >= cleanOptions.length && cleanOptions.every(option => selected.includes(option))) return false;
  return true;
}

function MultiSelectFilter({
  label,
  allLabel,
  options,
  selected,
  onChange,
  palette,
  minWidth = 150,
}: {
  label: string;
  allLabel: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  palette: ThemePalette;
  minWidth?: number;
}) {
  const cleanOptions = optionList(options);
  const filterIdRef = useRef(`filter-${label}-${Math.random().toString(36).slice(2)}`);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const allSelected = cleanOptions.length > 0 && selected.length >= cleanOptions.length && cleanOptions.every(option => selected.includes(option));
  const active = selected.length > 0 && !allSelected;
  const summary = !active
    ? allLabel
    : selected.length === 1
      ? selected[0]
      : `${selected.length} ${label}`;

  useEffect(() => {
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onFilterOpened = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== filterIdRef.current) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    window.addEventListener('dashboard-filter-opened', onFilterOpened as EventListener);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('dashboard-filter-opened', onFilterOpened as EventListener);
    };
  }, []);

  const toggleOpen = () => {
    setOpen(prev => {
      const next = !prev;
      if (next) window.dispatchEvent(new CustomEvent('dashboard-filter-opened', { detail: filterIdRef.current }));
      return next;
    });
  };

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  };

  return (
    <div ref={rootRef} className="no-print filter-dropdown-root" style={{ position: 'relative', flexShrink: 0, zIndex: open ? 14000 : 9000 }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        style={{ listStyle: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth, maxWidth: 220, height: 34, borderRadius: 999, border: `1px solid ${active ? SE.blue : palette.border}`, background: active ? 'rgba(0,120,255,.14)' : palette.cardSolid, color: active ? SE.blue : palette.text, padding: '0 12px', fontSize: 11, fontWeight: 900, fontFamily: 'DM Sans, Inter, sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }} />
      </button>
      {open && (
        <div className="filter-dropdown-menu" style={{ position: 'absolute', left: 0, top: 39, zIndex: 15000, width: 250, maxHeight: 330, overflowY: 'auto', padding: 10, borderRadius: 14, background: palette.cardSolid, border: `1px solid ${palette.border}`, boxShadow: palette.shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 8 }}>
            <button type="button" onClick={() => { onChange(cleanOptions); setOpen(false); }} style={{ flex: 1, border: `1px solid ${SE.blue}`, background: 'rgba(0,120,255,.13)', color: SE.blue, borderRadius: 999, height: 27, fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Select All</button>
            <button type="button" onClick={() => { onChange([]); setOpen(false); }} style={{ flex: 1, border: `1px solid ${palette.border}`, background: palette.cardSoft, color: palette.text, borderRadius: 999, height: 27, fontSize: 10, fontWeight: 850, cursor: 'pointer' }}>Clear</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${!active ? SE.blue : palette.border}`, background: !active ? 'rgba(0,120,255,.12)' : palette.cardSoft, color: !active ? SE.blue : palette.text, borderRadius: 10, padding: '7px 8px', fontSize: 11, fontWeight: 900, cursor: 'pointer', marginBottom: 6 }}>
            <input type="checkbox" checked={!active} onChange={() => { onChange(cleanOptions); setOpen(false); }} style={{ accentColor: SE.blue }} />
            <span>{allLabel}</span>
          </label>
          <div style={{ display: 'grid', gap: 5 }}>
            {cleanOptions.map(option => {
              const checked = selected.includes(option) || allSelected;
              return (
                <label key={option} style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${checked && active ? SE.blue : palette.border}`, background: checked && active ? 'rgba(0,120,255,.13)' : palette.cardSoft, color: checked && active ? SE.blue : palette.text, borderRadius: 10, padding: '7px 8px', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(option)} style={{ accentColor: SE.blue }} />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value, isText, color, selectedWeek, index, icon, sub, isPercent = false }: { label: string; value: number | string; isText?: boolean; color: string; selectedWeek: string; index: number; icon?: ReactNode; sub?: string; isPercent?: boolean }) {
  const numeric = Number(value);
  const ringPct = isText ? 78 : isPercent ? Math.max(20, Math.min(94, Number.isFinite(numeric) ? numeric : 55)) : Math.max(20, Math.min(94, Number.isFinite(numeric) ? numeric : 55));
  const displayValue = isText ? value : <><AnimatedNumber animationKey={`${selectedWeek}-${index}`} value={numeric} />{isPercent ? '%' : ''}</>;
  return (
    <div className="kpi-tile" style={{ position: 'relative', display: 'grid', placeItems: 'center', minHeight: 188, padding: '3px 0' }}>
      <div
        className="kpi-orb"
        style={{
          '--kpi-color': color,
          '--kpi-ring': `${ringPct}%`,
          width: 'clamp(142px, 10.6vw, 168px)',
          height: 'clamp(142px, 10.6vw, 168px)',
          borderRadius: '50%',
          position: 'relative',
          display: 'grid',
          placeItems: 'center',
          background: `conic-gradient(from 210deg, ${color} 0 var(--kpi-ring), rgba(255,255,255,.22) var(--kpi-ring) 100%)`,
          boxShadow: `0 18px 40px rgba(0,0,0,.24), 0 0 24px ${color}30, inset 0 0 0 1px rgba(255,255,255,.24)`,
          border: '1px solid rgba(255,255,255,.28)',
        } as CSSProperties}
      >
        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', background: `linear-gradient(145deg, ${color}, ${SE.navy2})`, boxShadow: 'inset 0 4px 18px rgba(255,255,255,.18), inset 0 -18px 28px rgba(0,0,0,.26)' }} />
        <div style={{ position: 'absolute', inset: 20, borderRadius: '50%', background: 'radial-gradient(circle at 35% 20%, rgba(255,255,255,.28), rgba(255,255,255,.08) 38%, rgba(0,0,0,.18) 100%)', border: '1px solid rgba(255,255,255,.18)' }} />
        {icon && (
          <div className="kpi-icon" style={{ position: 'absolute', top: 16, width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.28)', color: '#fff', boxShadow: '0 7px 16px rgba(0,0,0,.18)' }}>
            {icon}
          </div>
        )}
        <div style={{ position: 'relative', width: '76%', height: '76%', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '42px 9px 10px' }}>
          <div className="kpi-value" style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: isText ? 18 : 32, lineHeight: .96, color: isText ? '#FFE08A' : 'white', letterSpacing: '-0.045em', maxWidth: 108, overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(value)}>
            {displayValue}
          </div>
          <div className="kpi-label" style={{ color: 'rgba(255,255,255,.96)', fontSize: 8.6, fontWeight: 950, marginTop: 7, textTransform: 'uppercase', letterSpacing: '.035em', lineHeight: 1.08, maxWidth: 116 }}>{label}</div>
          {sub && <div className="kpi-sub" style={{ color: 'rgba(255,255,255,.74)', fontSize: 7.5, fontWeight: 850, marginTop: 5, lineHeight: 1.1, maxWidth: 112, whiteSpace: 'normal', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function RiskHeatmap({ risks, filterOwner, palette }: { risks: RiskRow[]; filterOwner: string[]; palette: ThemePalette }) {
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
      {filterOwner.length > 0 && <div style={{ color: SE.gold, fontWeight: 900, fontSize: 10, textAlign: 'center', marginBottom: 6 }}>Highlighting owner: {filterOwner.length === 1 ? filterOwner[0] : `${filterOwner.length} owners`}</div>}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', textAlign: 'center', color: palette.muted, fontSize: 9, letterSpacing: 1, fontWeight: 900 }}>LIKELIHOOD</div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map(l => (
            <div key={l} style={{ display: 'grid', gridTemplateColumns: '14px repeat(5, minmax(0, 1fr))', gap: 3, marginBottom: 3, alignItems: 'stretch' }}>
              <div style={{ color: palette.muted, fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{l}</div>
              {[1, 2, 3, 4, 5].map(im => {
                const items = cellMap[`${l}-${im}`] || [];
                const highlight = filterOwner.length === 0 ? items : items.filter(r => filterOwner.includes(r.owner));
                const dimmed = filterOwner.length > 0 && items.length > 0 && highlight.length === 0;
                return (
                  <div key={im} title={items.map(r => r.title).join('\n')} style={{ minHeight: 44, borderRadius: 8, background: cellColor(l, im), opacity: items.length ? (dimmed ? 0.28 : 0.96) : 0.18, border: highlight.length && filterOwner.length > 0 ? `2px solid ${SE.gold}` : `1px solid rgba(255,255,255,.42)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 950, boxShadow: highlight.length && filterOwner.length > 0 ? `0 0 0 3px rgba(201,168,76,.22)` : 'none' }}>
                    {items.length > 0 && <><span style={{ fontSize: 15 }}>{filterOwner.length > 0 && highlight.length ? `${highlight.length}/${items.length}` : items.length}</span><span style={{ fontSize: 7, opacity: .86 }}>risks</span></>}
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
  const { kpis, zoneCounts, progressCounts, riskSummary, riskRegister, selectedRisk, period, weeks, selectedWeek, prevWeekLabel, residualData, overdueActions, kriData, taxonomyData, velocityData, filterOptions } = data;

  // Normalize target KPI math at the display layer as a safety guard.
  // Total Risks is the risk-category total from Excel Output, not Total Mitigation.
  // Above Target + Below Target must equal Total Risks, including saved previous uploads.
  const normalizedKpis = useMemo(() => {
    const categoryTotal = Object.values(zoneCounts || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
    const totalRisks = Number(kpis.totalRisks) || categoryTotal || 0;
    const aboveTarget = Math.min(Math.max(Number(kpis.aboveTarget) || 0, 0), totalRisks);
    const belowTarget = Math.max(totalRisks - aboveTarget, 0);
    return { ...kpis, totalRisks, aboveTarget, belowTarget };
  }, [kpis, zoneCounts]);

  const [activeRisk, setActiveRisk] = useState(selectedRisk);
  const [activeMainTab, setActiveMainTab] = useState<'overview' | 'register' | 'analytics' | 'mitigation' | 'residual'>('overview');
  const [showTrend, setShowTrend] = useState(false);
  const [filterRating, setFilterRating] = useState<string[]>([]);
  const [filterOwner, setFilterOwner] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterClosingDate, setFilterClosingDate] = useState<string[]>([]);
  const [filterTarget, setFilterTarget] = useState<string[]>([]);
  const [filterTrackStatus, setFilterTrackStatus] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string[]>([]);
  const [filterRiskType, setFilterRiskType] = useState<string[]>([]);
  const [selectedIdentificationPeriods, setSelectedIdentificationPeriods] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [matrixFilter, setMatrixFilter] = useState<{ likelihood: number; impact: number } | null>(null);
  const [registerPage, setRegisterPage] = useState(1);
  const [residualPage, setResidualPage] = useState(1);
  const [velocityPage, setVelocityPage] = useState(1);
  const [riskLogPage, setRiskLogPage] = useState(1);
  const [overduePage, setOverduePage] = useState(1);
  const [kriPage, setKriPage] = useState(1);
  const [residualFilterRating, setResidualFilterRating] = useState('All');
  const [residualFilterStatus, setResidualFilterStatus] = useState('All');

  // Transitioned to Outputs toggle bar state
  const OUTPUT_PANELS = [
    { id: 'op-target-vs-actual',  label: 'Target vs Actual' },
    { id: 'op-category-donut',    label: 'Risk Category' },
    { id: 'op-gauge',             label: 'Risk Score' },
    { id: 'op-heatmap',           label: 'Risk Matrix' },
    { id: 'op-weekly-movement',   label: 'Weekly Movement' },
    { id: 'op-overdue-bar',       label: 'Overdue Bar' },
    { id: 'op-progress-status',   label: 'Progress Status' },
    { id: 'op-owner-chart',       label: 'By Owner' },
    { id: 'op-mitigation-detail', label: 'Mitigation Detail' },
  ] as const;
  type OutputPanelId = typeof OUTPUT_PANELS[number]['id'];
  const [outputsVisible, setOutputsVisible] = useState<Record<OutputPanelId, boolean>>(
    Object.fromEntries(OUTPUT_PANELS.map(p => [p.id, true])) as Record<OutputPanelId, boolean>
  );
  const toggleOutput = (id: OutputPanelId) => setOutputsVisible(prev => ({ ...prev, [id]: !prev[id] }));
  const allOutputsOn = OUTPUT_PANELS.every(p => outputsVisible[p.id]);
  const toggleAllOutputs = () => {
    const next = !allOutputsOn;
    setOutputsVisible(Object.fromEntries(OUTPUT_PANELS.map(p => [p.id, next])) as Record<OutputPanelId, boolean>);
  };
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    'kpi-section': true,
    'summary-section': true,
    'charts-section': true,
    'pipeline-section': true,
    'risk-register-section': true,
    'risk-log-section': true,
    'residual-analysis-section': true,
    'overdue-section': true,
    'kri-section': true,
    'velocity-section': true,
    'taxonomy-section': true,
    'bottom-register-section': true,
    'sparkline-section': true,
    'risks-actions-section': true,
    'dept-risk-level-section': true,
    'dept-performance-section': true,
  });

  const dashboardRef = useRef<HTMLDivElement>(null);
  const kpiRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<HTMLDivElement>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const residualRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  const overdueRef = useRef<HTMLDivElement>(null);
  const kriRef = useRef<HTMLDivElement>(null);
  const velocityRef = useRef<HTMLDivElement>(null);
  const taxonomyRef = useRef<HTMLDivElement>(null);

  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const palette = useMemo(() => makePalette(isDark), [isDark]);
  const themeBg = isDark ? '/assets/dark.png' : '/assets/light.png';
  const bgForExport = isDark ? '#061630' : '#F8FBFF';

  useEffect(() => setActiveRisk(data.selectedRisk), [data.selectedRisk, data.selectedWeek]);

  const allMonthLabels = useMemo(() => weeks.map(w => w.label), [weeks]);
  const firstReportMonth = allMonthLabels[0] || '';
  const hasIdentificationDates = useMemo(() => riskRegister.some(r => Boolean((r.identificationDate || '').trim())), [riskRegister]);
  const identificationPeriodOptions = useMemo(() => {
    const sourceValues = filterOptions?.identificationDates?.length
      ? filterOptions.identificationDates
      : riskRegister.map(r => r.identificationDate || '');
    const values = sourceValues
      .map(value => canonicalQuarterLabel(value || ''))
      .map(value => value.trim())
      .filter(Boolean);

    // Identification Date options come from the actual source column values.
    // For your file this should show Q1 2025, Q2 2025, Q3 2025, etc.
    return sortQuarterLabels(Array.from(new Set(values)));
  }, [riskRegister, filterOptions?.identificationDates]);
  const safeSelectedIdentificationPeriods = useMemo(() => {
    const validSet = new Set(identificationPeriodOptions.map(canonicalQuarterLabel));
    return selectedIdentificationPeriods
      .map(canonicalQuarterLabel)
      .filter(label => validSet.has(label));
  }, [selectedIdentificationPeriods, identificationPeriodOptions]);
  const identificationFilterActive = useMemo(() => isMultiFilterActive(safeSelectedIdentificationPeriods, identificationPeriodOptions), [safeSelectedIdentificationPeriods, identificationPeriodOptions]);
  const effectiveIdentificationPeriods = identificationFilterActive ? safeSelectedIdentificationPeriods : identificationPeriodOptions;
  const selectedIdentificationSnapshotPeriod = useMemo(() => latestSelectedQuarterLabel(effectiveIdentificationPeriods, identificationPeriodOptions), [effectiveIdentificationPeriods, identificationPeriodOptions]);
  const selectedSnapshotMonth = useMemo(() => {
    if (identificationFilterActive && selectedIdentificationSnapshotPeriod) {
      return quarterEndProgressMonthLabel(selectedIdentificationSnapshotPeriod, weeks);
    }
    return selectedWeek && allMonthLabels.includes(selectedWeek) ? selectedWeek : (allMonthLabels[allMonthLabels.length - 1] || '');
  }, [identificationFilterActive, selectedIdentificationSnapshotPeriod, weeks, selectedWeek, allMonthLabels]);
  const selectedMonthSummary = useMemo(() => {
    if (!identificationFilterActive) return 'All Identification Dates';
    if (safeSelectedIdentificationPeriods.length === 1) return safeSelectedIdentificationPeriods[0];
    return `${safeSelectedIdentificationPeriods.length} Identification Periods`;
  }, [identificationFilterActive, safeSelectedIdentificationPeriods]);
  const snapshotRiskRegister = useMemo(() => {
    if (!identificationFilterActive || !selectedIdentificationSnapshotPeriod) return riskRegister;
    return riskRegister.filter(r => riskIsIdentifiedByMonth(r, selectedIdentificationSnapshotPeriod, firstReportMonth, hasIdentificationDates));
  }, [riskRegister, identificationFilterActive, selectedIdentificationSnapshotPeriod, firstReportMonth, hasIdentificationDates]);
  const monthScopedRiskRegister = useMemo(() => snapshotRiskRegister.map(r => monthScopedRisk(r, selectedSnapshotMonth ? [selectedSnapshotMonth] : [], weeks)), [snapshotRiskRegister, selectedSnapshotMonth, weeks]);

  useEffect(() => {
    if (!identificationPeriodOptions.length) return;
    setSelectedIdentificationPeriods(prev => prev.map(canonicalQuarterLabel).filter(label => identificationPeriodOptions.includes(label)));
  }, [identificationPeriodOptions]);

  const uniqueRatings = useMemo(() => {
    const ratings = filterOptions?.ratings?.length
      ? filterOptions.ratings
      : Array.from(new Set(riskRegister.map(r => r.rating).filter((value): value is string => Boolean(value))));
    const order = ['Very High', 'High', 'Moderate', 'Low', 'Very Low'];
    return Array.from(new Set(ratings)).sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
  }, [riskRegister, filterOptions?.ratings]);

  const uniqueOwners = useMemo(() => (filterOptions?.owners?.length ? filterOptions.owners : Array.from(new Set(riskRegister.map(r => r.owner).filter(Boolean)))).sort(), [riskRegister, filterOptions?.owners]);
  const uniqueStatuses = useMemo(() => (filterOptions?.progressStatuses?.length ? filterOptions.progressStatuses : Array.from(new Set(riskRegister.map(r => r.progressStatus).filter(Boolean)))).sort(), [riskRegister, filterOptions?.progressStatuses]);
  const uniqueClosingDates = useMemo(() => sortDateLabels(filterOptions?.closingDates?.length ? filterOptions.closingDates : Array.from(new Set(riskRegister.map(r => r.closingDate).filter(Boolean)))), [riskRegister, filterOptions?.closingDates]);
  const uniqueCategories = useMemo(() => (filterOptions?.categories?.length ? filterOptions.categories : Array.from(new Set(riskRegister.map(r => r.category || 'Uncategorised')))).sort(), [riskRegister, filterOptions?.categories]);
  const uniqueRiskTypes = useMemo(() => (filterOptions?.riskTypes?.length ? filterOptions.riskTypes : Array.from(new Set(riskRegister.map(r => r.riskType || 'Unknown')))).sort(), [riskRegister, filterOptions?.riskTypes]);
  const targetOptions = ['Above Target', 'Below Target'];
  const trackOptions = ['Overdue', 'In Track'];

  const applyDashboardFilters = useCallback((r: RiskRow) => {
    const q = normalise(searchTerm);
    const category = r.category || 'Uncategorised';
    const riskType = r.riskType || 'Unknown';
    const overdue = riskIsOverdue(r);
    if (!matchesMultiFilter(r.rating || '', filterRating)) return false;
    if (!matchesMultiFilter(r.owner || '', filterOwner)) return false;
    if (!matchesMultiFilter(r.progressStatus || '', filterStatus)) return false;
    if (!matchesMultiFilter(r.closingDate || '', filterClosingDate)) return false;
    if (filterTarget.length) {
      const targetStatus = r.aboveTarget ? 'Above Target' : 'Below Target';
      if (!matchesMultiFilter(targetStatus, filterTarget)) return false;
    }
    if (filterTrackStatus.length) {
      const trackStatus = overdue ? 'Overdue' : 'In Track';
      if (!matchesMultiFilter(trackStatus, filterTrackStatus)) return false;
    }
    if (!matchesMultiFilter(category, filterCategory)) return false;
    if (!matchesMultiFilter(riskType, filterRiskType)) return false;
    if (matrixFilter && (Math.round(r.likelihood || 0) !== matrixFilter.likelihood || Math.round(r.impact || 0) !== matrixFilter.impact)) return false;
    if (q && !normalise(`${r.title} ${r.mitigation} ${r.owner} ${r.rating} ${r.identificationDate || ''} ${r.closingDate} ${category} ${riskType} ${r.progressStatus}`).includes(q)) return false;
    return true;
  }, [filterRating, filterOwner, filterStatus, filterClosingDate, filterTarget, filterTrackStatus, filterCategory, filterRiskType, matrixFilter, searchTerm]);

  const filteredRisks = useMemo(() => monthScopedRiskRegister.filter(applyDashboardFilters), [monthScopedRiskRegister, applyDashboardFilters]);

  const filteredZoneCounts = useMemo(() => ({
    veryHigh: filteredRisks.filter(r => r.score >= 20 || /very high/i.test(r.rating)).length,
    high: filteredRisks.filter(r => (r.score >= 15 && r.score < 20) || (/high/i.test(r.rating) && !/very high/i.test(r.rating))).length,
    moderate: filteredRisks.filter(r => (r.score >= 9 && r.score < 15) || /moderate/i.test(r.rating)).length,
    low: filteredRisks.filter(r => (r.score >= 5 && r.score < 9) || (/low/i.test(r.rating) && !/very low/i.test(r.rating))).length,
    veryLow: filteredRisks.filter(r => (r.score > 0 && r.score < 5) || /very low/i.test(r.rating)).length,
  }), [filteredRisks]);

  const filteredMitigationActions = useMemo(() => {
    const count = filteredRisks.reduce((sum, r) => sum + (r.mitigation ? r.mitigation.split(/\n+/).filter(Boolean).length : 0), 0);
    return count || (filteredRisks.length === snapshotRiskRegister.length ? (Number(kpis.totalMitigation) || filteredRisks.length) : filteredRisks.length);
  }, [filteredRisks, snapshotRiskRegister.length, kpis.totalMitigation]);

  const filteredOverallHealth = filteredRisks.length ? Math.round((filteredRisks.filter(r => r.aboveTarget).length / filteredRisks.length) * 100) : 0;

  const hasFilters = identificationFilterActive || isMultiFilterActive(filterRating, uniqueRatings) || isMultiFilterActive(filterOwner, uniqueOwners) || isMultiFilterActive(filterStatus, uniqueStatuses) || isMultiFilterActive(filterClosingDate, uniqueClosingDates) || isMultiFilterActive(filterTarget, targetOptions) || isMultiFilterActive(filterTrackStatus, trackOptions) || isMultiFilterActive(filterCategory, uniqueCategories) || isMultiFilterActive(filterRiskType, uniqueRiskTypes) || matrixFilter !== null || searchTerm.trim().length > 0;

  useEffect(() => {
    setRegisterPage(1);
    setResidualPage(1);
    setVelocityPage(1);
    setRiskLogPage(1);
    setOverduePage(1);
    setKriPage(1);
  }, [filterRating, filterOwner, filterStatus, filterClosingDate, filterTarget, filterTrackStatus, filterCategory, filterRiskType, matrixFilter, searchTerm, selectedWeek, safeSelectedIdentificationPeriods]);

  useEffect(() => {
    if (!filteredRisks.length) {
      setActiveRisk(null);
      return;
    }
    if (!activeRisk || !filteredRisks.some(r => r.id === activeRisk.id)) {
      setActiveRisk(filteredRisks[0]);
    }
  }, [filteredRisks, activeRisk]);

  const registerTotalPages = Math.max(1, Math.ceil(filteredRisks.length / PAGE_SIZE));
  const safeRegisterPage = Math.min(registerPage, registerTotalPages);
  const registerStartIndex = (safeRegisterPage - 1) * PAGE_SIZE;
  const pagedRegisterRisks = filteredRisks.slice(registerStartIndex, registerStartIndex + PAGE_SIZE);

  const changesSummary = useMemo(() => {
    const improved = filteredRisks.filter(r => r.developmentPct > 0).length;
    const declined = filteredRisks.filter(r => r.developmentPct < 0).length;
    const noChange = filteredRisks.filter(r => r.developmentPct === 0).length;
    return { improved, declined, noChange, total: filteredRisks.length };
  }, [filteredRisks]);

  const professionalSummary = useMemo(() => {
    const overdue = filteredRisks.filter(r => riskIsOverdue(r)).length;
    const completed = filteredRisks.filter(r => r.currentPct >= 100 || r.progressStatus === 'Completed (100%)').length;
    const highRisks = filteredRisks.filter(r => r.score >= 15 || /high/i.test(r.rating));
    const ownerCounts = highRisks.reduce<Record<string, number>>((acc, r) => {
      const owner = r.owner || 'Unassigned';
      acc[owner] = (acc[owner] || 0) + 1;
      return acc;
    }, {});
    const topOwnerEntry = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];
    const topOwner = topOwnerEntry?.[0] ?? 'None';
    const topOwnerCount = topOwnerEntry?.[1] ?? 0;
    const completedPct = filteredRisks.length ? Math.round((completed / filteredRisks.length) * 100) : 0;
    return { overdue, completed, completedPct, highRiskOwner: topOwner, highRiskOwnerCount: topOwnerCount, highRiskTotal: highRisks.length };
  }, [filteredRisks]);


  const filteredAvgRiskScore = useMemo(() => {
    const scored = filteredRisks.filter(r => r.score > 0);
    return scored.length ? Math.round((scored.reduce((sum, r) => sum + r.score, 0) / scored.length) * 10) / 10 : 0;
  }, [filteredRisks]);

  const overallRiskRating = useMemo(() => {
    if (filteredZoneCounts.veryHigh > 0 || filteredAvgRiskScore >= 20) return 'Very High';
    if (filteredZoneCounts.high > 0 || filteredAvgRiskScore >= 15) return 'High';
    if (filteredZoneCounts.moderate > 0 || filteredAvgRiskScore >= 9) return 'Moderate';
    if (filteredRisks.length === 0) return 'No Data';
    return 'Low';
  }, [filteredZoneCounts, filteredAvgRiskScore, filteredRisks.length]);

  const overallRiskColor = overallRiskRating === 'Very High' ? SE.red : overallRiskRating === 'High' ? SE.orange : overallRiskRating === 'Moderate' ? SE.gold : overallRiskRating === 'No Data' ? palette.muted : SE.green;

  const overdueAging = useMemo(() => filteredRisks.reduce((acc, risk) => {
    const bucket = getOverdueBucket(risk);
    if (bucket === 'Overdue >90 Days') acc.gt90 += 1;
    else if (bucket === 'Overdue 61–90 Days') acc.d61to90 += 1;
    else if (bucket === 'Overdue 31–60 Days') acc.d31to60 += 1;
    else if (bucket === 'Overdue 1–30 Days') acc.d1to30 += 1;
    return acc;
  }, { gt90: 0, d61to90: 0, d31to60: 0, d1to30: 0 }), [filteredRisks]);

  const riskRatingDistributionData = useMemo(() => [
    { name: 'Very High', value: filteredZoneCounts.veryHigh, color: ZONE_COLORS['Very High'] },
    { name: 'High', value: filteredZoneCounts.high, color: ZONE_COLORS.High },
    { name: 'Moderate', value: filteredZoneCounts.moderate, color: ZONE_COLORS.Moderate },
    { name: 'Low', value: filteredZoneCounts.low, color: ZONE_COLORS.Low },
    { name: 'Very Low', value: filteredZoneCounts.veryLow, color: ZONE_COLORS['Very Low'] },
  ].filter(item => item.value > 0), [filteredZoneCounts]);

  const overdueAgingChartData = useMemo(() => [
    { bucket: '1–30 Days', count: overdueAging.d1to30, color: SE.gold },
    { bucket: '31–60 Days', count: overdueAging.d31to60, color: SE.orange },
    { bucket: '61–90 Days', count: overdueAging.d61to90, color: '#ef4444' },
    { bucket: '>90 Days', count: overdueAging.gt90, color: SE.red },
  ], [overdueAging]);

  const actionStatusData = useMemo(() => [
    { name: 'Completed', value: filteredRisks.filter(r => r.currentPct >= 100 || r.progressStatus === 'Completed (100%)').length, color: SE.green },
    { name: 'In Progress', value: filteredRisks.filter(r => r.currentPct > 0 && r.currentPct < 100).length, color: SE.gold },
    { name: 'Not Started', value: filteredRisks.filter(r => r.currentPct <= 0).length, color: SE.red },
  ].filter(item => item.value > 0), [filteredRisks]);

  const topCriticalRisks = useMemo(() => [...filteredRisks]
    .sort((a, b) => {
      const severityDiff = riskSeverityRank(b) - riskSeverityRank(a);
      if (severityDiff !== 0) return severityDiff;
      const residualDiff = (b.residualScore || b.score) - (a.residualScore || a.score);
      if (residualDiff !== 0) return residualDiff;
      return getOverdueDays(b) - getOverdueDays(a);
    })
    .slice(0, 10), [filteredRisks]);

  const activeTrendWeeks = useMemo(() => {
    const labels = identificationFilterActive ? quarterTrendMonthLabels(safeSelectedIdentificationPeriods, weeks) : weeks.map(w => w.label);
    const selected = weeks.filter(w => labels.includes(w.label));
    return selected.length ? selected : weeks;
  }, [weeks, identificationFilterActive, safeSelectedIdentificationPeriods]);

  const weeklyMovementData = useMemo(() => activeTrendWeeks.map((w, index) => {
    const monthRisks = riskRegister
      .filter(r => riskIsIdentifiedByMonth(r, w.label, firstReportMonth, hasIdentificationDates))
      .map(r => monthScopedRisk(r, [w.label], weeks))
      .filter(applyDashboardFilters);
    const values = monthRisks.map(r => Math.round((r.weekProgress[w.label] ?? 0) * 100));
    const overallProgress = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    const completed = values.filter(value => value >= 100).length;
    const previousLabel = index > 0 ? activeTrendWeeks[index - 1].label : w.label;
    const previousValues = monthRisks.map(r => Math.round((r.weekProgress[previousLabel] ?? 0) * 100));
    const improved = values.filter((value, i) => value > (previousValues[i] ?? value)).length;
    const declined = values.filter((value, i) => value < (previousValues[i] ?? value)).length;
    const monthlyThreat = monthRisks.length;
    const critical = monthRisks.filter(r => r.score >= 20 || /very high/i.test(r.rating)).length;
    const high = monthRisks.filter(r => (r.score >= 15 && r.score < 20) || (/high/i.test(r.rating) && !/very high/i.test(r.rating))).length;
    return { week: w.label, overallProgress, avgProgress: overallProgress, completed, improved, declined, monthlyThreat, critical, high };
  }), [riskRegister, weeks, activeTrendWeeks, applyDashboardFilters]);

  // Multi-week Target vs Actual trend
  // Target = average of all risks' target (100%) weighted by how many are expected complete per week.
  // Since no per-week target column exists in the Excel, we use a linear ramp:
  // target for week N = round( (N / totalWeeks) * 100 ) — i.e. equal progress expected each week.
  const weeklyTargetVsActualData = useMemo(() => {
    const total = activeTrendWeeks.length || 1;
    return activeTrendWeeks.map((w, index) => {
      const monthRisks = riskRegister
        .filter(r => riskIsIdentifiedByMonth(r, w.label, firstReportMonth, hasIdentificationDates))
        .map(r => monthScopedRisk(r, [w.label], weeks))
        .filter(applyDashboardFilters);
      const values = monthRisks.map(r => Math.round((r.weekProgress[w.label] ?? 0) * 100));
      const avgActual = values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : 0;
      const avgTarget = Math.round(((index + 1) / total) * 100);
      const dev = avgActual - avgTarget;
      return { week: w.label, avgActual, avgTarget, dev };
    });
  }, [riskRegister, weeks, activeTrendWeeks, applyDashboardFilters]);

  const ownerHighRiskData = useMemo(() => {
    const map: Record<string, { count: number; totalPct: number; highCount: number }> = {};
    filteredRisks.forEach(r => {
      const owner = r.owner || 'Unassigned';
      if (!map[owner]) map[owner] = { count: 0, totalPct: 0, highCount: 0 };
      map[owner].count += 1;
      map[owner].totalPct += r.currentPct;
      if (r.score >= 15 || /high/i.test(r.rating)) map[owner].highCount += 1;
    });
    return Object.entries(map)
      .map(([owner, d]) => ({
        owner: owner.length > 22 ? `${owner.slice(0, 22)}…` : owner,
        fullOwner: owner,
        count: d.count,
        avgPct: Math.round(d.totalPct / d.count),
        highCount: d.highCount,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRisks]);

  const funnelData = useMemo(() => {
    const total = filteredRisks.length;
    const inProgress = filteredRisks.filter(r => r.currentPct > 0 && r.currentPct < 100).length;
    const ge50 = filteredRisks.filter(r => r.currentPct >= 50 && r.currentPct < 100).length;
    const ge80 = filteredRisks.filter(r => r.currentPct >= 80 && r.currentPct < 100).length;
    const completed = filteredRisks.filter(r => r.currentPct >= 100).length;
    return [
      { label: 'Pipeline Total',   count: total,      pct: 100 },
      { label: 'In Progress',      count: inProgress, pct: total ? Math.round((inProgress / total) * 100) : 0 },
      { label: 'Progress ≥ 50%',   count: ge50,       pct: total ? Math.round((ge50 / total) * 100) : 0 },
      { label: 'Progress ≥ 80%',   count: ge80,       pct: total ? Math.round((ge80 / total) * 100) : 0 },
      { label: 'Completed',        count: completed,  pct: total ? Math.round((completed / total) * 100) : 0 },
    ];
  }, [filteredRisks]);

  const selectedChartData = activeRisk ? [
    { name: 'Current', value: activeRisk.currentPct, color: SE.green },
    { name: 'Before', value: activeRisk.beforePct, color: SE.gold },
    { name: 'Development', value: Math.abs(activeRisk.developmentPct), color: activeRisk.developmentPct >= 0 ? SE.blue : SE.red },
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
    setFilterRating([]);
    setFilterOwner([]);
    setFilterStatus([]);
    setFilterClosingDate([]);
    setFilterTarget([]);
    setFilterTrackStatus([]);
    setFilterCategory([]);
    setFilterRiskType([]);
    setSearchTerm('');
    setMatrixFilter(null);
    setSelectedIdentificationPeriods([]);
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
      'Identification Date': r.identificationDate,
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
    XLSX.writeFile(wb, `Risk_Register_${selectedWeek || period}.xlsx`);
  }, [filteredRisks, selectedWeek, period]);

  const residualFilteredRisks = useMemo(() => {
    return [...filteredRisks]
      .filter(r => r.residualScore > 0)
      .filter(r => residualFilterRating === 'All' || r.rating === residualFilterRating)
      .filter(r => residualFilterStatus === 'All' || r.progressStatus === residualFilterStatus)
      .sort((a, b) => b.residualScore - a.residualScore);
  }, [filteredRisks, residualFilterRating, residualFilterStatus]);

  const residualTotalPages = Math.max(1, Math.ceil(residualFilteredRisks.length / PAGE_SIZE));
  const safeResidualPage = Math.min(residualPage, residualTotalPages);
  const residualStartIndex = (safeResidualPage - 1) * PAGE_SIZE;
  const pagedResidualRisks = residualFilteredRisks.slice(residualStartIndex, residualStartIndex + PAGE_SIZE);

  const topResidualRisks = useMemo(() =>
    [...residualFilteredRisks]
      .sort((a, b) => b.residualScore - a.residualScore)
      .slice(0, 5),
  [residualFilteredRisks]);

  // ── Step 9: Sparkline progression per risk ────────────────────────────────
  const sparklineRisks = useMemo(() => {
    return [...filteredRisks]
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map(r => ({
        id: r.id,
        title: r.title.length > 30 ? r.title.slice(0, 30) + '…' : r.title,
        rating: r.rating,
        score: r.score,
        currentPct: r.currentPct,
        sparkData: weeks.map(w => ({ w: w.label, v: Math.round((r.weekProgress[w.label] ?? 0) * 100) })),
      }));
  }, [filteredRisks, weeks]);

  // 7. Inherent vs Residual vs Target per Department
  const inherentResidualByDeptData = useMemo(() => {
    const map: Record<string, { inherentSum: number; residualSum: number; targetSum: number; count: number }> = {};
    filteredRisks.forEach(r => {
      const dept = r.owner || 'Unknown';
      if (!map[dept]) map[dept] = { inherentSum: 0, residualSum: 0, targetSum: 0, count: 0 };
      map[dept].inherentSum += r.score || 0;
      map[dept].residualSum += r.residualScore || r.score || 0;
      map[dept].targetSum += r.tScore || 0;
      map[dept].count += 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].inherentSum / b[1].count - a[1].inherentSum / a[1].count)
      .map(([dept, v]) => ({
        dept,
        inherent: parseFloat((v.inherentSum / v.count).toFixed(1)),
        residual: parseFloat((v.residualSum / v.count).toFixed(1)),
        target: parseFloat((v.targetSum / v.count).toFixed(1)),
      }));
  }, [filteredRisks]);

  // 9. Actual vs Target per Department
  const actualVsTargetByDeptData = useMemo(() => {
    const map: Record<string, { actualSum: number; count: number }> = {};
    filteredRisks.forEach(r => {
      const dept = r.owner || 'Unknown';
      if (!map[dept]) map[dept] = { actualSum: 0, count: 0 };
      map[dept].actualSum += r.currentPct;
      map[dept].count += 1;
    });
    const targetPct = 100; // target is 100% completion
    return Object.entries(map)
      .sort((a, b) => b[1].actualSum / b[1].count - a[1].actualSum / a[1].count)
      .map(([dept, v]) => ({
        dept,
        actual: Math.round(v.actualSum / v.count),
        target: targetPct,
      }));
  }, [filteredRisks]);

  const velocityItems = useMemo(() => [...filteredRisks]
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(r => ({
      title: r.title,
      inherent: r.score,
      residual: r.residualScore ?? 0,
      target: r.tScore ?? 0,
      gap: (r.residualScore ?? 0) - (r.tScore ?? 0),
      rating: r.rating,
    })), [filteredRisks]);

  const velocityTotalPages = Math.max(1, Math.ceil(velocityItems.length / PAGE_SIZE));
  const safeVelocityPage = Math.min(velocityPage, velocityTotalPages);
  const velocityStartIndex = (safeVelocityPage - 1) * PAGE_SIZE;
  const pagedVelocityItems = velocityItems.slice(velocityStartIndex, velocityStartIndex + PAGE_SIZE);

  const velocitySummary = useMemo(() => {
    const scoreRows = velocityItems.filter(v => v.inherent > 0);
    const avgInherent = scoreRows.length ? Math.round(scoreRows.reduce((sum, v) => sum + v.inherent, 0) / scoreRows.length * 10) / 10 : 0;
    const avgResidual = scoreRows.length ? Math.round(scoreRows.reduce((sum, v) => sum + v.residual, 0) / scoreRows.length * 10) / 10 : 0;
    const targets = scoreRows.filter(v => v.target > 0);
    const avgTarget = targets.length ? Math.round(targets.reduce((sum, v) => sum + v.target, 0) / targets.length * 10) / 10 : 0;
    return { avgInherent, avgResidual, avgTarget };
  }, [velocityItems]);

  // ── Tabbed Risk Log state (Step 5) ────────────────────────────────────────
  const [riskLogTab, setRiskLogTab] = useState<'all' | 'high' | 'overdue' | 'search'>('all');
  const [riskLogSearch, setRiskLogSearch] = useState('');
  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [riskNotes, setRiskNotes] = useState<Record<string, string>>({});
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  const riskLogFiltered = useMemo(() => {
    const q = normalise(riskLogSearch);
    return filteredRisks.filter(r => {
      if (riskLogTab === 'high') return r.score >= 15 || /high/i.test(r.rating);
      if (riskLogTab === 'overdue') return riskIsOverdue(r);
      if (riskLogTab === 'search') return q ? normalise(`${r.title} ${r.mitigation} ${r.owner}`).includes(q) : true;
      return true;
    });
  }, [filteredRisks, riskLogTab, riskLogSearch]);

  useEffect(() => {
    setRiskLogPage(1);
  }, [riskLogTab, riskLogSearch, filteredRisks]);

  const riskLogTotalPages = Math.max(1, Math.ceil(riskLogFiltered.length / PAGE_SIZE));
  const safeRiskLogPage = Math.min(riskLogPage, riskLogTotalPages);
  const riskLogStartIndex = (safeRiskLogPage - 1) * PAGE_SIZE;
  const pagedRiskLogRisks = riskLogFiltered.slice(riskLogStartIndex, riskLogStartIndex + PAGE_SIZE);

  const overdueFilteredItems = useMemo(() => filteredRisks
    .filter(riskIsOverdue)
    .map(r => ({
      riskTitle: r.title,
      owner: r.owner || '–',
      closingDate: r.closingDate || '–',
      progressStatus: r.progressStatus || '–',
      currentPct: r.currentPct || 0,
    })), [filteredRisks]);
  const overdueTotalPages = Math.max(1, Math.ceil(overdueFilteredItems.length / PAGE_SIZE));
  const safeOverduePage = Math.min(overduePage, overdueTotalPages);
  const overdueStartIndex = (safeOverduePage - 1) * PAGE_SIZE;
  const pagedOverdueItems = overdueFilteredItems.slice(overdueStartIndex, overdueStartIndex + PAGE_SIZE);

  const kriFilteredItems = useMemo(() => {
    const allItems = kriData?.items ?? [];
    if (!hasFilters) return allItems;
    const allowedTitles = new Set(filteredRisks.map(r => normalise(r.title)));
    return allItems.filter(item => allowedTitles.has(normalise(item.riskTitle || '')));
  }, [kriData, filteredRisks, hasFilters]);
  const kriTotalPages = Math.max(1, Math.ceil(kriFilteredItems.length / PAGE_SIZE));
  const safeKriPage = Math.min(kriPage, kriTotalPages);
  const kriStartIndex = (safeKriPage - 1) * PAGE_SIZE;
  const pagedKriItems = kriFilteredItems.slice(kriStartIndex, kriStartIndex + PAGE_SIZE);

  // ── Bottom 4-tab register state (Step 8) ─────────────────────────────────
  const [bottomTab, setBottomTab] = useState<'all' | 'high' | 'overdue' | 'search'>('all');
  const [bottomSearch, setBottomSearch] = useState('');

  const visibleSectionIds = useMemo(() => {
    return ['kpi-section', 'charts-section', 'pipeline-section', 'risk-register-section', 'risk-log-section', 'residual-analysis-section', 'overdue-section', 'kri-section', 'velocity-section', 'taxonomy-section'];
  }, []);

  const allSectionsExpanded = visibleSectionIds.every(id => sectionOpen[id]);

  const setSingleSectionOpen = useCallback((id: string, open: boolean) => {
    setSectionOpen(prev => ({ ...prev, [id]: open }));
  }, []);

  const toggleAllSections = useCallback(() => {
    setSectionOpen(prev => {
      const visibleIds = ['kpi-section', 'charts-section', 'pipeline-section', 'risk-register-section', 'risk-log-section', 'residual-analysis-section', 'overdue-section', 'kri-section', 'velocity-section', 'taxonomy-section'];
      const shouldExpand = !visibleIds.every(id => prev[id]);
      return visibleIds.reduce((acc, id) => ({ ...acc, [id]: shouldExpand }), prev);
    });
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
          .kpi-row { grid-template-columns: repeat(7, 1fr) !important; gap: 4px !important; }
          .kpi-tile { min-height: 118px !important; }
          .kpi-orb { width: 112px !important; height: 112px !important; }
          .kpi-value { font-size: 20px !important; }
          .kpi-label { font-size: 6.2px !important; }
          .chart-row { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .professional-chart-grid { grid-template-columns: 1fr 1fr 1fr !important; gap: 6px !important; }
          .professional-chart-wide { grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          .summary-row { grid-template-columns: 2fr 3fr !important; gap: 6px !important; }
          #risk-table-wrapper { max-height: none !important; overflow: visible !important; }
          .risk-table th, .risk-table td { font-size: 8px !important; padding: 3px 5px !important; }
          .selected-risk-section { page-break-before: always; }
          .recharts-wrapper, .recharts-surface { overflow: visible !important; }
        }
        @media (max-width: 1320px) { .kpi-row { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } .professional-chart-grid, .professional-chart-wide { grid-template-columns: 1fr !important; } }
        @media (max-width: 980px) { .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } }
        @media (max-width: 760px) { .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } .kpi-tile { min-height: 162px !important; } .kpi-orb { width: 138px !important; height: 138px !important; } }
      `}</style>

      {showTrend && weeks?.length > 1 && <TrendModal data={data} weeks={weeks} palette={palette} onClose={() => setShowTrend(false)} />}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* PROPOSAL-STYLE SHELL: dark top bar + left sidebar + scrollable content            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div ref={dashboardRef} className="dashboard-shell" style={{ minHeight: '100vh', backgroundColor: palette.page, fontFamily: 'Inter, sans-serif', color: palette.text, display: 'flex', flexDirection: 'column' }}>

        {/* ───────────────────────────────────────────────────────────────────────────────────────────────────── */}
        {/* TOP HEADER BAR — matches proposal: dark navy, logo left, title centre, controls right */}
        {/* ───────────────────────────────────────────────────────────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: '#0b1120',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          height: 52,
          display: 'flex', alignItems: 'center',
          padding: '0 20px 0 0',
          gap: 0,
          boxShadow: '0 2px 16px rgba(0,0,0,0.45)',
          flexShrink: 0,
        }}>
          {/* SVG logo block — only icon shown */}
          <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, #0078FF, #00AEEF)', display: 'grid', placeItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
          </div>

          {/* Title + executive risk posture badge */}
          <div style={{ flex: 1, padding: '0 20px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ENTERPRISE RISK MANAGEMENT DASHBOARD</div>
              <div style={{ fontSize: 10, fontWeight: 750, color: 'rgba(255,255,255,.56)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Snapshot: {identificationFilterActive ? `${selectedIdentificationSnapshotPeriod} → ${selectedSnapshotMonth}` : selectedSnapshotMonth || selectedWeek || period} · Trend: {selectedMonthSummary}</div>
            </div>
            <span title="Overall risk rating from filtered dataset" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, borderRadius: 999, padding: '0 10px', background: `${overallRiskColor}22`, border: `1px solid ${overallRiskColor}`, color: overallRiskColor, fontSize: 10, fontWeight: 950, fontFamily: 'DM Sans, Inter, sans-serif', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <AlertTriangle size={12} /> Overall Risk Rating: {overallRiskRating}
            </span>
          </div>


          {/* Theme toggle */}
          <div style={{ display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: 2, gap: 0, flexShrink: 0, height: 30, marginRight: 12 }}>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans, Inter, sans-serif', height: 24, background: !isDark ? 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)' : 'transparent', color: !isDark ? 'white' : 'rgba(255,255,255,0.4)' }} onClick={() => { if (isDark) toggleTheme?.(); }}><Sun size={11} />Light</button>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans, Inter, sans-serif', height: 24, background: isDark ? 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)' : 'transparent', color: isDark ? 'white' : 'rgba(255,255,255,0.4)' }} onClick={() => { if (!isDark) toggleTheme?.(); }}><Moon size={11} />Dark</button>
          </div>

          {/* Action buttons */}
          <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', color: 'white', fontWeight: 800, fontSize: 10, cursor: 'pointer', padding: '0 14px', fontFamily: 'DM Sans, Inter, sans-serif', marginRight: 6 }}><Printer size={12} />PDF</button>
          <button onClick={() => exportElementAsPNG(dashboardRef, 'Risk_Full_Dashboard.png', bgForExport)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)', color: 'white', fontWeight: 800, fontSize: 10, cursor: 'pointer', padding: '0 14px', fontFamily: 'DM Sans, Inter, sans-serif', marginRight: 6 }}><ImageDown size={12} />PNG</button>
          <button onClick={onReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 30, borderRadius: 999, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.75)', fontWeight: 800, fontSize: 10, cursor: 'pointer', padding: '0 14px', fontFamily: 'DM Sans, Inter, sans-serif', marginRight: 6 }}><Upload size={12} />New File</button>

          {/* User avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'grid', placeItems: 'center', color: 'white', fontSize: 12, fontWeight: 900, fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}>U</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap' }}>User Name</span>
          </div>
        </header>

        {/* ───────────────────────────────────────────────────────────────────────────────────────────────────── */}
        {/* BODY ROW: left sidebar + scrollable main content                                  */}
        {/* ───────────────────────────────────────────────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* LEFT SIDEBAR — icon-only, 52px, dark navy, sticky */}
          {false && <nav style={{
            width: 52, flexShrink: 0,
            background: '#0b1120',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            paddingTop: 8, paddingBottom: 8, gap: 4,
            position: 'sticky', top: 52, height: 'calc(100vh - 52px)',
            overflowY: 'auto',
          }}>
            {([
              { id: 'kpi-section',              icon: <Home size={18} />,          label: 'KPI' },
              { id: 'charts-section',           icon: <BarChart2 size={18} />,     label: 'Charts' },
              { id: 'pipeline-section',         icon: <TrendingUp size={18} />,    label: 'Pipeline' },
              { id: 'risk-register-section',    icon: <Filter size={18} />,        label: 'Register' },
              { id: 'risk-log-section',         icon: <Layers size={18} />,        label: 'Risk Log' },
              { id: 'residual-analysis-section',icon: <Activity size={18} />,      label: 'Residual' },
              { id: 'overdue-section',          icon: <AlertTriangle size={18} />, label: 'Overdue' },
              { id: 'kri-section',              icon: <Target size={18} />,        label: 'KRI' },
              { id: 'velocity-section',         icon: <TrendingDown size={18} />,  label: 'Velocity' },
              { id: 'taxonomy-section',         icon: <Layers size={18} />,        label: 'Taxonomy' },
              { id: 'sparkline-section',        icon: <TrendingUp size={18} />,    label: 'Progression' },
            ] as { id: string; icon: React.ReactNode; label: string }[]).map(item => (
              <button
                key={item.id}
                title={item.label}
                onClick={() => scrollToSection(item.id)}
                style={{
                  width: 38, height: 38, borderRadius: 10,
                  display: 'grid', placeItems: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  transition: 'background 150ms ease, color 150ms ease',
                  flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.18)'; (e.currentTarget as HTMLButtonElement).style.color = '#60a5fa'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)'; }}
              >
                {item.icon}
              </button>
            ))}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Bottom actions */}
            <button title="Expand / Collapse All" onClick={toggleAllSections} style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>
              {allSectionsExpanded ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
            <button title="Upload New File" onClick={onReset} style={{ width: 38, height: 38, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer' }}>
              <Upload size={17} />
            </button>
          </nav>}

          {/* MAIN SCROLLABLE CONTENT */}
          <div className="dashboard-theme-stage" style={{ flex: 1, minWidth: 0, overflowY: 'auto', backgroundImage: `${isDark ? 'linear-gradient(180deg, rgba(2,6,23,.70), rgba(2,6,23,.78))' : 'linear-gradient(180deg, rgba(248,251,255,.78), rgba(248,251,255,.90))'}, url(${themeBg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }}>
          <main style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 30, display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', padding: '10px 0 12px', backdropFilter: 'blur(16px)', background: isDark ? 'linear-gradient(180deg, rgba(2,6,23,.82), rgba(2,6,23,.46))' : 'linear-gradient(180deg, rgba(248,251,255,.90), rgba(248,251,255,.58))', borderBottom: `1px solid ${palette.border}`, marginBottom: 2 }}>
            {([
              { id: 'overview', label: 'Overview', count: filteredRisks.length },
              { id: 'register', label: 'Risk Register', count: filteredRisks.length },
              { id: 'analytics', label: 'Analytics' },
              { id: 'mitigation', label: 'Mitigation & Actions', count: professionalSummary.overdue },
              { id: 'residual', label: 'Residual & KRIs', count: kriData?.items?.length ?? 0 },
            ] as const).map(tab => {
              const active = activeMainTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveMainTab(tab.id)} style={{
                  height: 38, borderRadius: 999, padding: '0 16px', border: active ? `1px solid ${SE.blue}` : `1px solid ${palette.border}`,
                  background: active ? 'linear-gradient(135deg, #0078FF 0%, #00AEEF 100%)' : palette.cardSolid,
                  color: active ? '#fff' : palette.text, fontSize: 12, fontWeight: 900, cursor: 'pointer', whiteSpace: 'nowrap',
                  boxShadow: active ? '0 10px 26px rgba(0,120,255,.25)' : 'none', fontFamily: 'DM Sans, Inter, sans-serif',
                }}>
                  {tab.label}
                  {'count' in tab && <span style={{ marginLeft: 8, background: active ? 'rgba(255,255,255,.22)' : palette.cardSoft, borderRadius: 999, padding: '1px 7px', fontSize: 10 }}>{tab.count}</span>}
                </button>
              );
            })}
          </div>

          <div className="no-print global-filter-bar" style={{ position: 'relative', zIndex: 6000, isolation: 'isolate', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', overflow: 'visible', padding: 10, borderRadius: 16, background: palette.card, border: `1px solid ${palette.border}`, boxShadow: palette.shadow, backdropFilter: 'blur(14px)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.text, fontSize: 11, fontWeight: 950, marginRight: 2 }}><Filter size={13} />Global Filters</span>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: palette.muted, pointerEvents: 'none' }} />
              <input
                placeholder="Search risks, owners, categories…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ background: palette.cardSolid, border: `1px solid ${searchTerm ? SE.blue : palette.border}`, borderRadius: 999, padding: '0 12px 0 31px', color: palette.text, fontSize: 11, fontWeight: 850, fontFamily: 'DM Sans, Inter, sans-serif', outline: 'none', width: 220, height: 34 }}
              />
            </div>
            <MultiSelectFilter label="Ratings" allLabel="All Ratings" options={uniqueRatings} selected={filterRating} onChange={setFilterRating} palette={palette} minWidth={126} />
            <MultiSelectFilter label="Owners" allLabel="All Owners" options={uniqueOwners} selected={filterOwner} onChange={setFilterOwner} palette={palette} minWidth={130} />
            <MultiSelectFilter label="Statuses" allLabel="All Progress Statuses" options={uniqueStatuses} selected={filterStatus} onChange={setFilterStatus} palette={palette} minWidth={170} />
            <MultiSelectFilter label="Identification Dates" allLabel="All Identification Dates" options={identificationPeriodOptions} selected={safeSelectedIdentificationPeriods} onChange={setSelectedIdentificationPeriods} palette={palette} minWidth={180} />
            <MultiSelectFilter label="Closing Dates" allLabel="All Closing Dates" options={uniqueClosingDates} selected={filterClosingDate} onChange={setFilterClosingDate} palette={palette} minWidth={155} />
            <MultiSelectFilter label="Target Status" allLabel="All Target Status" options={targetOptions} selected={filterTarget} onChange={setFilterTarget} palette={palette} minWidth={150} />
            <MultiSelectFilter label="Track Status" allLabel="Overdue + In Track" options={trackOptions} selected={filterTrackStatus} onChange={setFilterTrackStatus} palette={palette} minWidth={160} />
            <MultiSelectFilter label="Categories" allLabel="All Risk Categories" options={uniqueCategories} selected={filterCategory} onChange={setFilterCategory} palette={palette} minWidth={165} />
            <MultiSelectFilter label="Risk Types" allLabel="All Risk Types" options={uniqueRiskTypes} selected={filterRiskType} onChange={setFilterRiskType} palette={palette} minWidth={145} />
            {matrixFilter && (
              <button type="button" onClick={() => setMatrixFilter(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${SE.blue}`, borderRadius: 999, background: 'rgba(0,120,255,.14)', color: SE.blue, height: 32, padding: '0 10px', fontSize: 11, fontWeight: 900, cursor: 'pointer' }}>
                Matrix L{matrixFilter.likelihood} × I{matrixFilter.impact} <X size={12} />
              </button>
            )}
            {hasFilters && <button onClick={resetFilters} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${palette.border}`, borderRadius: 999, background: palette.cardSolid, color: palette.text, height: 32, padding: '0 10px', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}><RotateCcw size={12} />Clear</button>}
            <span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11, fontWeight: 850, whiteSpace: 'nowrap' }}>ID Snapshot: {identificationFilterActive ? `${selectedIdentificationSnapshotPeriod} → ${selectedSnapshotMonth}` : selectedMonthSummary} · Filtered {filteredRisks.length} of {snapshotRiskRegister.length}</span>
          </div>

          {activeMainTab === 'overview' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>



          <SectionCard id="kpi-section" title="Executive KPI Overview" palette={palette} bodyRef={kpiRef} compact open={sectionOpen['kpi-section']} onOpenChange={open => setSingleSectionOpen('kpi-section', open)} actions={<><SmallActionButton palette={palette} onClick={() => exportElementAsPNG(kpiRef, 'Risk_KPI_Overview.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton></>}>

            {/* ── ROW 1: large circular KPI cards with the rectangular-version icons ── */}
            <div className="kpi-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(122px, 1fr))', gap: 8, alignItems: 'center' }}>
              {[
                { label: 'Total Risks', value: filteredRisks.length, color: SE.blue, icon: <Layers size={19} />, sub: `Snapshot: ${identificationFilterActive ? selectedIdentificationSnapshotPeriod : (selectedSnapshotMonth || period)}` },
                { label: 'Very High / High', value: filteredZoneCounts.veryHigh + filteredZoneCounts.high, color: SE.red, icon: <AlertTriangle size={19} />, sub: `${filteredZoneCounts.veryHigh} VH · ${filteredZoneCounts.high} H` },
                { label: 'Moderate Risks', value: filteredZoneCounts.moderate, color: SE.gold, icon: <Activity size={19} />, sub: 'Requires monitoring' },
                { label: 'Low Risks', value: filteredZoneCounts.low + filteredZoneCounts.veryLow, color: SE.green, icon: <TrendingDown size={19} />, sub: `${filteredZoneCounts.low} Low · ${filteredZoneCounts.veryLow} VL` },
                { label: 'Overdue Actions', value: professionalSummary.overdue, color: '#eab308', icon: <Target size={19} />, sub: `>90:${overdueAging.gt90} · 61-90:${overdueAging.d61to90} · 1-30:${overdueAging.d1to30}` },
                { label: 'Below Target', value: filteredRisks.filter(r => r.belowTarget).length, color: SE.orange, icon: <TrendingDown size={19} />, sub: `${filteredRisks.filter(r => r.aboveTarget).length} above target` },
                { label: 'Mitigation Actions', value: filteredMitigationActions, color: SE.teal, icon: <BarChart2 size={19} />, sub: 'Filtered action count' },
              ].map((card, i) => (
                <KpiTile
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  color={card.color}
                  icon={card.icon}
                  sub={card.sub}
                  isPercent={card.isPercent}
                  selectedWeek={selectedWeek}
                  index={i}
                />
              ))}
            </div>


          </SectionCard>


          <SectionCard id="overview-focus-section" title="Executive Focus — Heatmap + Top 10 Critical Risks" palette={palette} compact open={true} onOpenChange={() => undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, alignItems: 'stretch' }}>
              <div style={{ ...chartBox(palette), minHeight: 420 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  <div>
                    <h3 style={chartTitle(palette)}>Risk Matrix Heatmap</h3>
                    <div style={{ fontSize: 10.5, color: palette.muted, fontWeight: 750 }}>Click any populated cell to filter the dashboard by likelihood × impact.</div>
                  </div>
                  {matrixFilter && <button type="button" onClick={() => setMatrixFilter(null)} style={{ border: `1px solid ${SE.blue}`, background: 'rgba(0,120,255,.13)', color: SE.blue, borderRadius: 999, height: 28, padding: '0 10px', fontSize: 10, fontWeight: 900, cursor: 'pointer' }}>Clear Matrix Filter</button>}
                </div>
                <RiskHeatMap risks={filteredRisks} palette={palette} isDark={isDark} selectedCell={matrixFilter} onCellSelect={cell => setMatrixFilter(prev => prev?.likelihood === cell.likelihood && prev?.impact === cell.impact ? null : { likelihood: cell.likelihood, impact: cell.impact })} />
              </div>

              <div style={{ ...chartBox(palette), minHeight: 420, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                  <h3 style={chartTitle(palette)}>Top 10 Critical Risks</h3>
                  <span style={{ fontSize: 10, fontWeight: 900, color: overallRiskColor, background: `${overallRiskColor}18`, border: `1px solid ${overallRiskColor}`, borderRadius: 999, padding: '3px 9px' }}>{overallRiskRating}</span>
                </div>
                <div style={{ border: `1px solid ${palette.border}`, borderRadius: 12, overflow: 'hidden', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10.5 }}>
                    <thead>
                      <tr style={{ background: palette.tableHead, color: '#fff' }}>
                        {['Risk', 'Category', 'Rating', 'Residual', 'Owner', 'Overdue'].map((h, i) => <th key={h} style={{ padding: '7px 8px', textAlign: i === 3 ? 'center' : 'left', fontWeight: 950, fontSize: 9.5, whiteSpace: 'nowrap' }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {topCriticalRisks.length === 0 ? (
                        <tr><td colSpan={6} style={{ padding: 18, color: palette.muted, textAlign: 'center' }}>No matching risks</td></tr>
                      ) : topCriticalRisks.map((r, i) => {
                        const overdueBucket = getOverdueBucket(r);
                        const ratingColor = getRatingColor(r.rating || riskRatingLabelFromScore(r.score));
                        return (
                          <tr key={r.id || i} onClick={() => setActiveRisk(r)} style={{ background: i % 2 === 0 ? palette.tableStripe : 'transparent', borderBottom: `1px solid ${palette.border}`, cursor: 'pointer' }}>
                            <td style={{ padding: '7px 8px', color: palette.text, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</td>
                            <td style={{ padding: '7px 8px', color: palette.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.category || '–'}</td>
                            <td style={{ padding: '7px 8px' }}><span style={{ color: ratingColor, background: `${ratingColor}1f`, border: `1px solid ${ratingColor}`, borderRadius: 999, padding: '2px 7px', fontSize: 9, fontWeight: 900, whiteSpace: 'nowrap' }}>{r.rating || riskRatingLabelFromScore(r.score)}</span></td>
                            <td style={{ padding: '7px 8px', color: getScoreColor(r.residualScore || r.score), textAlign: 'center', fontWeight: 950 }}>{r.residualScore || r.score}</td>
                            <td style={{ padding: '7px 8px', color: SE.cyan, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.owner || '–'}</td>
                            <td style={{ padding: '7px 8px', color: overdueBucket === 'On Track' ? SE.green : SE.red, fontWeight: 850, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{overdueBucket}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
                  {[
                    ['1–30', overdueAging.d1to30, SE.gold],
                    ['31–60', overdueAging.d31to60, SE.orange],
                    ['61–90', overdueAging.d61to90, '#ef4444'],
                    ['>90', overdueAging.gt90, SE.red],
                  ].map(([label, value, color]) => <div key={String(label)} style={{ textAlign: 'center', border: `1px solid ${color}`, background: `${color}15`, borderRadius: 10, padding: '7px 5px' }}><div style={{ color: String(color), fontWeight: 950, fontSize: 16 }}>{value}</div><div style={{ color: palette.muted, fontWeight: 800, fontSize: 9 }}>{label} days</div></div>)}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ═══ Step 4: Compact KPI Strip + Horizontal Pipeline Funnel ═══ */}
          {/* ═══════════════════════════════════════════════════════════════════════ */}
          </div>}

          {activeMainTab === 'analytics' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SectionCard id="charts-section" title="Analytics — Clean Relationship Layout" palette={palette} bodyRef={chartsRef} open={sectionOpen['charts-section']} onOpenChange={open => setSingleSectionOpen('charts-section', open)} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(chartsRef, 'Risk_Analytics_Charts.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', borderRadius: 12, background: palette.cardSoft, border: `1px solid ${palette.border}` }}>
              <div style={{ fontSize: 11, color: palette.muted, fontWeight: 800 }}>Duplicated charts were removed. This tab now follows one decision flow: posture → exposure → movement → mitigation performance.</div>
              <span style={{ fontSize: 10, color: SE.blue, fontWeight: 900 }}>Overview remains KPI-only</span>
            </div>

            <h2 style={analyticsGroupTitle(palette)}>1. Risk Posture Relationship</h2>
            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Risk Rating Distribution</h3>
                <ResponsiveContainer width="100%" height={286}>
                  <PieChart>
                    <Pie data={riskRatingDistributionData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={72} outerRadius={106} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>
                      {riskRatingDistributionData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  {riskRatingDistributionData.map(item => <span key={item.name} style={legendItem(palette)}><span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />{item.name} ({item.value})</span>)}
                </div>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Average Risk Score Gauge</h3>
                <ProgressGauge score={filteredAvgRiskScore || kpis.avgRiskScore} palette={palette} />
                <div style={{ marginTop: 4, borderTop: `1px solid ${palette.border}`, paddingTop: 10, fontSize: 10.5, color: palette.muted, lineHeight: 1.55 }}>
                  <strong style={{ color: palette.text }}>Purpose:</strong> one posture score to support executive escalation before drilling into owners, departments, and mitigations.
                </div>
              </div>
            </div>

            <h2 style={analyticsGroupTitle(palette)}>2. Exposure & Ownership Relationship</h2>
            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 12, marginBottom: 20 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Owner Risk Load</h3>
                <ResponsiveContainer width="100%" height={Math.max(230, ownerHighRiskData.length * 30)}>
                  <BarChart data={ownerHighRiskData.slice(0, 10)} layout="vertical" margin={{ top: 4, right: 42, left: 4, bottom: 4 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.chartGrid} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: palette.muted }} allowDecimals={false} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis type="category" dataKey="owner" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} width={106} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="count" name="Risk Count" fill={SE.blue} radius={[0, 5, 5, 0]} animationDuration={650}
                      label={{ position: 'right', fontSize: 9, fontWeight: 700, fill: SE.blue, formatter: (v: number) => v }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Department Risk Index — Inherent vs Residual vs Target</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={inherentResidualByDeptData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }} barCategoryGap="20%" barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="dept" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: palette.muted }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="inherent" name="Avg Inherent" fill={SE.red} radius={[3, 3, 0, 0]} animationDuration={650} />
                    <Bar dataKey="residual" name="Avg Residual" fill={SE.orange} radius={[3, 3, 0, 0]} animationDuration={650} />
                    <Bar dataKey="target" name="Avg Target" fill={SE.green} radius={[3, 3, 0, 0]} animationDuration={650} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 7, background: SE.red, borderRadius: 2 }} />Avg Inherent</span>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 7, background: SE.orange, borderRadius: 2 }} />Avg Residual</span>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 7, background: SE.green, borderRadius: 2 }} />Avg Target</span>
                </div>
              </div>
            </div>

            <h2 style={analyticsGroupTitle(palette)}>3. Movement & Progression Relationship</h2>
            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: sparklineRisks.length > 0 && weeks.length > 1 ? '1.2fr 1fr' : '1fr', gap: 12, marginBottom: 20 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Monthly Threat &amp; Progress Trends</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={weeklyMovementData} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: palette.muted }} allowDecimals={false} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Line type="monotone" dataKey="critical" name="Very High" stroke={SE.red} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={650} />
                    <Line type="monotone" dataKey="high" name="High" stroke={SE.orange} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={650} />
                    <Line type="monotone" dataKey="overallProgress" name="Avg Progress %" stroke={SE.green} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} animationDuration={650} />
                  </LineChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 3, background: SE.red, borderRadius: 2 }} />Very High</span>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 3, background: SE.orange, borderRadius: 2 }} />High</span>
                  <span style={legendItem(palette)}><span style={{ width: 10, height: 3, background: SE.green, borderRadius: 2 }} />Avg Progress %</span>
                </div>
              </div>

              {sparklineRisks.length > 0 && weeks.length > 1 && (
                <div style={chartBox(palette)}>
                  <h3 style={chartTitle(palette)}>Risk Change Progression</h3>
                  <div style={{ border: `1px solid ${palette.border}`, borderRadius: 12, overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr style={{ background: palette.tableHead, color: 'white' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Risk Title</th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: 10 }}>Score</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sparklineRisks.map((r, i) => {
                          const maxV = Math.max(100, ...r.sparkData.map(d => d.v));
                          const sparkW = 150;
                          const sparkH = 30;
                          const pts = r.sparkData.map((d, j) => {
                            const x = sparkW * (j / Math.max(1, r.sparkData.length - 1));
                            const y = sparkH - (d.v / maxV) * (sparkH - 4) - 2;
                            return `${x},${y}`;
                          }).join(' ');
                          const lastV = r.sparkData[r.sparkData.length - 1]?.v ?? 0;
                          const firstV = r.sparkData[0]?.v ?? 0;
                          const trend = lastV > firstV ? SE.green : lastV < firstV ? SE.red : palette.muted;
                          return (
                            <tr key={r.id} style={{ background: i % 2 === 0 ? palette.tableStripe : palette.cardSolid }}>
                              <td style={{ padding: '8px 12px', color: palette.text, fontWeight: 700, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</td>
                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, color: getScoreColor(r.score) }}>{r.score}</td>
                              <td style={{ padding: '8px 10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <svg width={sparkW} height={sparkH} viewBox={`0 0 ${sparkW} ${sparkH}`} style={{ overflow: 'visible' }}>
                                    <polyline points={pts} fill="none" stroke={trend} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                                    {r.sparkData.map((d, j) => {
                                      const x = sparkW * (j / Math.max(1, r.sparkData.length - 1));
                                      const y = sparkH - (d.v / maxV) * (sparkH - 4) - 2;
                                      return <circle key={j} cx={x} cy={y} r={2.4} fill={trend} />;
                                    })}
                                  </svg>
                                  <span style={{ fontSize: 10, fontWeight: 900, color: trend, minWidth: 28 }}>{lastV > firstV ? '↑' : lastV < firstV ? '↓' : '→'} {Math.abs(lastV - firstV)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <h2 style={analyticsGroupTitle(palette)}>4. Mitigation Performance Relationship</h2>
            <div className="professional-chart-wide" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <div style={chartBox(palette)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  <h3 style={chartTitle(palette)}>Mitigation Plans Progress — Target vs Actual</h3>
                  {weeklyTargetVsActualData.length > 0 && (() => {
                    const last = weeklyTargetVsActualData[weeklyTargetVsActualData.length - 1];
                    const isBelow = last.dev < 0;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: isBelow ? 'rgba(192,57,43,.13)' : 'rgba(39,174,96,.13)', border: `1px solid ${isBelow ? SE.red : SE.green}`, borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
                        <span style={{ fontSize: 16, fontFamily: 'DM Sans, sans-serif', fontWeight: 950, color: isBelow ? SE.red : SE.green }}>{last.avgActual}%</span>
                        <span style={{ fontSize: 10, color: palette.muted, fontWeight: 700 }}>Actual /</span>
                        <span style={{ fontSize: 16, fontFamily: 'DM Sans, sans-serif', fontWeight: 950, color: SE.blue }}>{last.avgTarget}%</span>
                        <span style={{ fontSize: 10, color: palette.muted, fontWeight: 700 }}>Target</span>
                        <span style={{ fontSize: 11, fontWeight: 900, color: isBelow ? SE.red : SE.green }}>{isBelow ? '▼' : '▲'} Dev {Math.abs(last.dev)}%</span>
                      </div>
                    );
                  })()}
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyTargetVsActualData} margin={{ top: 18, right: 16, left: 0, bottom: 4 }} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="week" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: palette.muted }} axisLine={{ stroke: palette.border }} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="avgTarget" name="Avg Target %" fill={SE.blue} radius={[4, 4, 0, 0]} animationDuration={650}
                      label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: SE.blue, formatter: (v: number) => `${v}%` }}
                    />
                    <Bar dataKey="avgActual" name="Avg Actual %" fill={SE.red} radius={[4, 4, 0, 0]} animationDuration={650}
                      label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: SE.red, formatter: (v: number) => `${v}%` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  <span style={legendItem(palette)}><span style={{ width: 12, height: 7, background: SE.blue, borderRadius: 2 }} />Avg Target %</span>
                  <span style={legendItem(palette)}><span style={{ width: 12, height: 7, background: SE.red, borderRadius: 2 }} />Avg Actual %</span>
                </div>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Actual vs Target — per Department</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={actualVsTargetByDeptData} margin={{ top: 18, right: 20, left: 0, bottom: 4 }} barCategoryGap="25%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="dept" tick={{ fontSize: 9, fill: palette.text, fontWeight: 700 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: palette.muted }} axisLine={{ stroke: palette.border }} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="target" name="Avg Target %" fill={SE.blue} radius={[4, 4, 0, 0]} animationDuration={650}
                      label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: SE.blue, formatter: (v: number) => `${v}%` }}
                    />
                    <Bar dataKey="actual" name="Avg Actual %" fill={SE.orange} radius={[4, 4, 0, 0]} animationDuration={650}
                      label={{ position: 'top', fontSize: 9, fontWeight: 700, fill: SE.orange, formatter: (v: number) => `${v}%` }}
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  <span style={legendItem(palette)}><span style={{ width: 12, height: 7, background: SE.blue, borderRadius: 2 }} />Avg Target %</span>
                  <span style={legendItem(palette)}><span style={{ width: 12, height: 7, background: SE.orange, borderRadius: 2 }} />Avg Actual %</span>
                </div>
              </div>
            </div>

          </SectionCard>
          </div>}

          {activeMainTab === 'mitigation' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SectionCard id="pipeline-section" title="Mitigation Pipeline Overview" palette={palette} compact open={sectionOpen['pipeline-section'] ?? true} onOpenChange={open => setSingleSectionOpen('pipeline-section', open)}>
            {/* Compact KPI strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
              {funnelData.map((stage, i) => {
                const stageColors = [SE.blue, SE.teal, SE.gold, SE.orange, SE.green];
                const c = stageColors[i] || SE.blue;
                return (
                  <div key={stage.label} style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ color: c, fontFamily: 'DM Sans, sans-serif', fontSize: 26, fontWeight: 950, lineHeight: 1 }}>{stage.count}</div>
                    <div style={{ color: palette.text, fontSize: 10, fontWeight: 900, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{stage.label}</div>
                    <div style={{ color: palette.muted, fontSize: 10, marginTop: 2 }}>{stage.pct}% of total</div>
                  </div>
                );
              })}
            </div>

            {/* Horizontal pipeline bar */}
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, borderRadius: 12, overflow: 'hidden', height: 52, marginBottom: 8 }}>
              {funnelData.map((stage, i) => {
                const stageColors = [SE.blue, SE.teal, SE.gold, SE.orange, SE.green];
                const c = stageColors[i] || SE.blue;
                const widthPct = funnelData[0].count > 0 ? Math.max(4, (stage.count / funnelData[0].count) * 100) : 20;
                return (
                  <div
                    key={stage.label}
                    title={`${stage.label}: ${stage.count} (${stage.pct}%)`}
                    style={{
                      flex: `0 0 ${widthPct}%`,
                      background: c,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 11,
                      fontWeight: 900,
                      borderRight: i < funnelData.length - 1 ? '2px solid rgba(255,255,255,0.3)' : 'none',
                      transition: 'flex 0.4s ease',
                      minWidth: 0,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ fontSize: 16, fontFamily: 'DM Sans, sans-serif', fontWeight: 950 }}>{stage.count}</span>
                    <span style={{ fontSize: 9, opacity: 0.88 }}>{stage.pct}%</span>
                  </div>
                );
              })}
            </div>
            <div style={legendStyle}>
              {funnelData.map((stage, i) => {
                const stageColors = [SE.blue, SE.teal, SE.gold, SE.orange, SE.green];
                return <span key={stage.label} style={legendItem(palette)}><span style={{ width: 9, height: 9, borderRadius: 3, background: stageColors[i] }} />{stage.label}</span>;
              })}
            </div>
          </SectionCard>

          <SectionCard id="action-performance-section" title="Action Performance — Status + Overdue Aging" palette={palette} compact open={true} onOpenChange={() => undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr', gap: 12 }}>
              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Action Status</h3>
                <ResponsiveContainer width="100%" height={246}>
                  <PieChart>
                    <Pie data={actionStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3}>
                      {actionStatusData.map(item => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={legendStyle}>
                  {actionStatusData.map(item => <span key={item.name} style={legendItem(palette)}><span style={{ width: 10, height: 10, borderRadius: 3, background: item.color }} />{item.name} ({item.value})</span>)}
                </div>
              </div>

              <div style={chartBox(palette)}>
                <h3 style={chartTitle(palette)}>Overdue Categories</h3>
                <ResponsiveContainer width="100%" height={246}>
                  <BarChart data={overdueAgingChartData} margin={{ top: 18, right: 22, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: palette.text, fontWeight: 800 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: palette.muted }} axisLine={{ stroke: palette.border }} tickLine={false} />
                    <Tooltip content={<ChartTooltip palette={palette} />} />
                    <Bar dataKey="count" name="Overdue Actions" radius={[5, 5, 0, 0]} animationDuration={650} label={{ position: 'top', fontSize: 10, fontWeight: 900, fill: palette.text, formatter: (v: number) => v }}>
                      {overdueAgingChartData.map(item => <Cell key={item.bucket} fill={item.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </SectionCard>
          </div>}

          {activeMainTab === 'register' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SectionCard id="risk-register-section" title={`Risk Register — ${selectedWeek || period}`} palette={palette} bodyRef={registerRef} open={sectionOpen['risk-register-section']} onOpenChange={open => setSingleSectionOpen('risk-register-section', open)} actions={<><SmallActionButton palette={palette} onClick={exportRisksToExcel}><FileSpreadsheet size={12} />Excel</SmallActionButton><SmallActionButton palette={palette} onClick={() => exportElementAsPNG(registerRef, 'Risk_Register.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>{weeks?.length > 1 && <SmallActionButton palette={palette} onClick={() => setShowTrend(true)}><BarChart2 size={12} />Trend</SmallActionButton>}</>}>
            <div className="no-print" style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.text, fontSize: 11, fontWeight: 900 }}><Filter size={13} />Register uses the global filters above</span>
              <span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11, fontWeight: 800 }}>Showing page {safeRegisterPage} · {filteredRisks.length} of {snapshotRiskRegister.length}</span>
            </div>

            <div style={{ background: isDark ? 'rgba(14,39,79,.72)' : '#EBF8FF', border: `1px solid ${palette.border}`, borderRadius: 14, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 900, color: palette.text }}>Changes vs Previous Week</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: SE.green, fontWeight: 900 }}><span style={pillCircle(SE.green)}>{changesSummary.improved}</span>Improved</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: SE.red, fontWeight: 900 }}><span style={pillCircle(SE.red)}>{changesSummary.declined}</span>Declined</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: palette.muted, fontWeight: 900 }}><span style={pillCircle('#95A5A6')}>{changesSummary.noChange}</span>No Change</span>
            </div>

            <div id="risk-table-wrapper" style={{ overflow: 'hidden', borderRadius: 14, border: `1px solid ${palette.border}`, marginBottom: 0 }}>
              <table className="risk-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                  <tr style={{ background: palette.tableHead, color: 'white' }}>
                    {['Risk Title', 'Mitigation', 'Risk Owner', 'Score', 'Rating', 'Closing Date', 'Trend', 'Current %', 'Before %', 'Change'].map(h => <th key={h} style={{ padding: '9px 9px', textAlign: h.includes('%') || h === 'Score' || h === 'Trend' || h === 'Change' ? 'center' : 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: 10, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,.10)' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRisks.length === 0 ? <tr><td colSpan={10} style={{ padding: 28, textAlign: 'center', color: palette.muted, background: palette.cardSolid }}>No risks match the selected filters.</td></tr> : pagedRegisterRisks.map((row, i) => {
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
            <PaginationControls page={safeRegisterPage} totalItems={filteredRisks.length} onPageChange={setRegisterPage} palette={palette} label="risks" />

            {/* ── Selected Risk Detail (inline, below the table) ─────── */}
            {activeRisk && (
              <div style={{ borderTop: `1px solid ${palette.border}`, paddingTop: 14 }}>
                {/* Sub-header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <ScoreBadge score={activeRisk.score} />
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: 13, color: palette.text }}>{activeRisk.title}</span>
                  <span style={{ color: getRatingColor(activeRisk.rating), fontWeight: 900, fontSize: 11, marginLeft: 4 }}>{activeRisk.rating}</span>
                  <span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11 }}>{activeRisk.owner}</span>
                  <SmallActionButton palette={palette} onClick={() => exportElementAsPNG(selectedRef, 'Risk_Selected_Detail.png', bgForExport)}>
                    <ImageDown size={12} />PNG
                  </SmallActionButton>
                </div>
                <div ref={selectedRef} className="selected-risk-section" style={{ display: 'grid', gridTemplateColumns: 'minmax(430px, 0.95fr) minmax(0, 1.35fr)', gap: 14, alignItems: 'start' }}>
                  <div style={chartBox(palette)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}><ScoreBadge score={activeRisk.score} /><span style={{ color: getRatingColor(activeRisk.rating), fontWeight: 950, fontSize: 12 }}>{activeRisk.rating}</span><span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11 }}>{activeRisk.owner}</span></div>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={selectedChartData} margin={{ top: 24, right: 18, left: 4, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={palette.chartGrid} />
                        <XAxis dataKey="name" interval={0} tick={{ fontSize: 10, fill: palette.text, fontWeight: 800 }} axisLine={{ stroke: palette.border }} tickLine={false} />
                        <YAxis width={42} tick={{ fontSize: 10, fill: palette.muted }} domain={[0, 100]} unit="%" axisLine={{ stroke: palette.border }} tickLine={false} />
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
                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                      <div style={miniMetric(palette)}><span>Owner</span><strong>{activeRisk.owner || '–'}</strong></div>
                      <div style={miniMetric(palette)}><span>Closing Date</span><strong>{activeRisk.closingDate || '–'}</strong></div>
                      <div style={miniMetric(palette)}><span>Status</span><strong>{activeRisk.progressStatus || '–'}</strong></div>
                    </div>
                    {weeks?.length > 1 && <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: palette.cardSolid, border: `1px solid ${palette.border}` }}>
                      <div style={{ fontSize: 10, color: palette.muted, marginBottom: 6, fontWeight: 900 }}>Progress trend across all weeks</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 8, overflow: 'visible' }}>{weeks.map((w, i) => {
                        const val = Math.round((activeRisk.weekProgress[w.label] ?? 0) * 100);
                        const prev = i > 0 ? Math.round((activeRisk.weekProgress[weeks[i - 1].label] ?? 0) * 100) : val;
                        const color = val > prev ? SE.green : val < prev ? SE.red : palette.muted;
                        const isSelected = w.label === selectedWeek;
                        const isPrev = w.label === prevWeekLabel;
                        return <div key={w.label} style={{ minWidth: 0, textAlign: 'center', padding: '7px 8px', borderRadius: 10, background: isSelected ? 'rgba(0,120,255,.16)' : isPrev ? 'rgba(243,156,18,.12)' : 'transparent', border: isSelected ? `1px solid ${SE.blue}` : isPrev ? `1px solid ${SE.gold}` : `1px solid ${palette.border}` }}><div style={{ fontSize: 14, fontWeight: 950, color }}>{val}%</div><div style={{ fontSize: 8.5, color: palette.muted, marginTop: 2, whiteSpace: 'nowrap' }}>{w.label}</div>{isSelected && <div style={{ fontSize: 7.5, color: SE.blue, fontWeight: 900, marginTop: 1 }}>CURRENT</div>}{isPrev && !isSelected && <div style={{ fontSize: 7.5, color: SE.gold, fontWeight: 900, marginTop: 1 }}>PREVIOUS</div>}</div>;
                      })}</div>
                    </div>}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* ═══ Steps 5 & 6: Tabbed Risk Log with Expandable Rows + Add Note ═══ */}
          <SectionCard id="risk-log-section" title="Risk Log" palette={palette} compact open={sectionOpen['risk-log-section'] ?? true} onOpenChange={open => setSingleSectionOpen('risk-log-section', open)}>
            {/* Tab bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {(['all', 'high', 'overdue', 'search'] as const).map(tab => {
                const labels: Record<string, string> = { all: 'All Risks', high: 'High Priority', overdue: 'Overdue Actions', search: 'Search Result' };
                const counts: Record<string, number> = {
                  all: filteredRisks.length,
                  high: filteredRisks.filter(r => r.score >= 15 || /high/i.test(r.rating)).length,
                  overdue: filteredRisks.filter(r => riskIsOverdue(r)).length,
                  search: riskLogFiltered.length,
                };
                const isActive = riskLogTab === tab;
                return (
                  <button key={tab} type="button" onClick={() => setRiskLogTab(tab)}
                    style={{
                      height: 30, borderRadius: 999, padding: '0 14px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                      border: isActive ? 'none' : `1px solid ${palette.border}`,
                      background: isActive ? SE.blue : palette.cardSolid,
                      color: isActive ? 'white' : palette.text,
                      transition: 'all 150ms ease',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {labels[tab]}
                    <span style={{ background: isActive ? 'rgba(255,255,255,0.25)' : palette.cardSoft, borderRadius: 999, padding: '1px 7px', fontSize: 9, fontWeight: 900 }}>{counts[tab]}</span>
                  </button>
                );
              })}
              {/* Search input shown always */}
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
                <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: palette.muted, pointerEvents: 'none' }} />
                <input
                  value={riskLogSearch}
                  onChange={e => { setRiskLogSearch(e.target.value); if (e.target.value) setRiskLogTab('search'); }}
                  placeholder="Search risks…"
                  style={{ ...inputStyle, paddingLeft: 30, width: 200 }}
                />
              </div>
            </div>

            {/* Risk log table */}
            <div style={{ border: `1px solid ${palette.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: palette.tableHead, color: 'white' }}>
                    <th style={{ width: 32, padding: '8px 10px' }} />
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>ID</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Risk Title</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Severity</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Category</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Owner</th>
                    <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 900, fontSize: 10 }}>Next Action</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: 10 }}>Progress</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 900, fontSize: 10 }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {riskLogFiltered.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: palette.muted, background: palette.cardSolid }}>No risks found.</td></tr>
                  ) : pagedRiskLogRisks.map((r, i) => {
                    const isExpanded = expandedRiskId === r.id;
                    const ratingColor = getRatingColor(r.rating);
                    return (
                      <React.Fragment key={r.id}>
                        <tr style={{ background: i % 2 === 0 ? palette.tableStripe : palette.cardSolid, cursor: 'pointer' }}
                          onClick={() => setExpandedRiskId(isExpanded ? null : r.id)}>
                          <td style={{ padding: '8px 10px', textAlign: 'center', color: palette.muted }}>
                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </td>
                          <td style={{ padding: '8px 10px', color: palette.muted, fontSize: 10, whiteSpace: 'nowrap' }}>{r.id}</td>
                          <td style={{ padding: '8px 10px', color: palette.text, fontWeight: 700, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: `${ratingColor}22`, color: ratingColor, border: `1px solid ${ratingColor}55`, borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 900, whiteSpace: 'nowrap' }}>{r.rating}</span>
                          </td>
                          <td style={{ padding: '8px 10px', color: palette.muted, fontSize: 10 }}>{r.category || '–'}</td>
                          <td style={{ padding: '8px 10px', color: palette.text, fontSize: 10 }}>{r.owner || '–'}</td>
                          <td style={{ padding: '8px 10px', color: palette.muted, fontSize: 10, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.mitigation}>{r.mitigation || '–'}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                              <div style={{ width: 60, height: 6, background: palette.cardSoft, borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${r.currentPct}%`, height: '100%', background: r.currentPct >= 100 ? SE.green : r.currentPct >= 50 ? SE.gold : SE.red, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 900, color: r.currentPct >= 100 ? SE.green : r.currentPct >= 50 ? SE.gold : SE.red }}>{r.currentPct}%</span>
                            </div>
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            {riskNotes[r.id] ? (
                              <span style={{ fontSize: 9, color: SE.teal, fontWeight: 700, background: `${SE.teal}18`, borderRadius: 999, padding: '2px 7px' }}>Note</span>
                            ) : (
                              <span style={{ fontSize: 9, color: palette.muted }}>+</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${r.id}-detail`} style={{ background: isDark ? 'rgba(0,120,255,0.06)' : 'rgba(37,99,235,0.04)' }}>
                            <td colSpan={9} style={{ padding: '12px 18px 14px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                {/* Left: details */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 900, color: palette.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Risk Details</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    {[
                                      { label: 'Score', value: r.score },
                                      { label: 'Likelihood', value: r.likelihood },
                                      { label: 'Impact', value: r.impact },
                                      { label: 'Closing Date', value: r.closingDate || '–' },
                                      { label: 'Status', value: r.progressStatus || '–' },
                                      { label: 'Sub-Category', value: r.subCategory || '–' },
                                    ].map(m => (
                                      <div key={m.label} style={{ background: palette.cardSolid, borderRadius: 8, padding: '6px 10px' }}>
                                        <div style={{ fontSize: 9, color: palette.muted, fontWeight: 700 }}>{m.label}</div>
                                        <div style={{ fontSize: 12, color: palette.text, fontWeight: 900, marginTop: 2 }}>{m.value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* Middle: mitigation */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 900, color: palette.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Mitigation Plan</div>
                                  <div style={{ background: palette.cardSolid, borderRadius: 8, padding: '8px 10px', fontSize: 11, color: palette.text, lineHeight: 1.6, maxHeight: 120, overflowY: 'auto' }}>{r.mitigation || 'No mitigation details.'}</div>
                                </div>
                                {/* Right: Add Note */}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 900, color: palette.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Add Note</div>
                                  {riskNotes[r.id] && (
                                    <div style={{ background: `${SE.teal}14`, border: `1px solid ${SE.teal}44`, borderRadius: 8, padding: '6px 10px', fontSize: 11, color: palette.text, marginBottom: 6, lineHeight: 1.5 }}>{riskNotes[r.id]}</div>
                                  )}
                                  <textarea
                                    value={noteInput[r.id] || ''}
                                    onChange={e => setNoteInput(prev => ({ ...prev, [r.id]: e.target.value }))}
                                    placeholder="Type a note…"
                                    rows={3}
                                    style={{ width: '100%', background: palette.cardSolid, border: `1px solid ${palette.border}`, borderRadius: 8, padding: '7px 10px', color: palette.text, fontSize: 11, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                                  />
                                  <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); if (noteInput[r.id]?.trim()) { setRiskNotes(prev => ({ ...prev, [r.id]: noteInput[r.id] })); setNoteInput(prev => ({ ...prev, [r.id]: '' })); } }}
                                    style={{ marginTop: 6, height: 28, borderRadius: 999, background: SE.teal, border: 'none', color: 'white', fontSize: 10, fontWeight: 900, padding: '0 14px', cursor: 'pointer' }}
                                  >Save Note</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationControls page={safeRiskLogPage} totalItems={riskLogFiltered.length} onPageChange={setRiskLogPage} palette={palette} label="risk log records" />
          </SectionCard>
          </div>}

          {activeMainTab === 'residual' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          <SectionCard
            id="residual-analysis-section"
            title={`Residual Risk Analysis — ${selectedWeek || period}`}
            palette={palette}
            bodyRef={residualRef}
            open={sectionOpen['residual-analysis-section']}
            onOpenChange={open => setSingleSectionOpen('residual-analysis-section', open)}
            actions={
              <SmallActionButton palette={palette} onClick={() => exportElementAsPNG(residualRef, 'Residual_Risk_Analysis.png', bgForExport)}>
                <ImageDown size={12} />PNG
              </SmallActionButton>
            }
          >
            {/* ── Filter bar ─────────────────────────────────────────── */}
            <div className="no-print" style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: palette.text, fontSize: 11, fontWeight: 900 }}><Filter size={13} />Filters</span>
              {/* Rating filter pills */}
              {['All', 'Very High', 'High', 'Moderate', 'Low'].map(r => (
                <button
                  key={r}
                  onClick={() => setResidualFilterRating(r)}
                  style={{
                    height: 28, padding: '0 12px', borderRadius: 999, fontSize: 10, fontWeight: 900, cursor: 'pointer',
                    border: residualFilterRating === r ? 'none' : `1px solid ${palette.border}`,
                    background: residualFilterRating === r
                      ? (r === 'All' ? SE.gold : ZONE_COLORS[r] || SE.blue)
                      : palette.cardSolid,
                    color: residualFilterRating === r ? 'white' : palette.text,
                    transition: 'all 150ms ease',
                  }}
                >{r}</button>
              ))}
              <div style={{ width: 1, height: 20, background: palette.border }} />
              {/* Status filter */}
              <select
                value={residualFilterStatus}
                onChange={e => setResidualFilterStatus(e.target.value)}
                style={selectStyle}
              >
                {uniqueStatuses.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
              </select>
              {(residualFilterRating !== 'All' || residualFilterStatus !== 'All') && (
                <button
                  onClick={() => { setResidualFilterRating('All'); setResidualFilterStatus('All'); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${palette.border}`, borderRadius: 999, background: palette.cardSolid, color: palette.text, height: 28, padding: '0 10px', fontSize: 11, fontWeight: 850, cursor: 'pointer' }}
                ><RotateCcw size={12} />Clear</button>
              )}
              <span style={{ marginLeft: 'auto', color: palette.muted, fontSize: 11, fontWeight: 800 }}>Showing page {safeResidualPage} · {residualFilteredRisks.length} of {filteredRisks.filter(r => r.residualScore > 0).length}</span>
            </div>

            {/* ── Risk table ─────────────────────────────────────────── */}
            <div style={{ overflow: 'hidden', borderRadius: 14, border: `1px solid ${palette.border}`, marginBottom: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                  <tr style={{ background: palette.tableHead, color: 'white' }}>
                    {['#', 'RISK', 'OWNER GROUP', 'INHERENT', 'RESIDUAL', 'RATING', 'STATUS', 'PROGRESS', 'TARGET'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: i === 0 ? 'center' : i >= 3 && i <= 4 ? 'center' : 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 900, fontSize: 10, whiteSpace: 'nowrap', letterSpacing: '0.06em', borderRight: `1px solid rgba(255,255,255,.10)` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedResidualRisks.map((risk, idx) => {
                    const rowNo = residualStartIndex + idx + 1;
                    const isEven = idx % 2 === 0;
                    const ratingColor = getRatingColor(risk.rating);
                    const statusDot = risk.progressStatus.includes('Completed') ? SE.green : risk.progressStatus.includes('Not Started') ? palette.muted : SE.blue;
                    return (
                      <tr
                        key={risk.id}
                        onClick={() => setActiveRisk(risk)}
                        style={{ background: isEven ? palette.tableStripe : palette.cardSolid, cursor: 'pointer', transition: 'background 120ms' }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = palette.tableHover}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = isEven ? palette.tableStripe : palette.cardSolid}
                      >
                        {/* # */}
                        <td style={{ ...tableTd(palette.muted, palette), textAlign: 'center', width: 32, fontWeight: 900 }}>{rowNo}</td>
                        {/* Risk title + subtitle */}
                        <td style={{ ...tableTd(palette.text, palette), maxWidth: 280, minWidth: 160 }}>
                          <div style={{ fontWeight: 900, fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 270 }} title={risk.title}>{risk.title}</div>
                          {risk.mitigation && (
                            <div style={{ color: palette.muted, fontSize: 9.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 270, marginTop: 1 }}
                              title={risk.mitigation.split('\n')[0]}>
                              {risk.mitigation.split('\n')[0]}
                            </div>
                          )}
                        </td>
                        {/* Owner Group */}
                        <td style={{ ...tableTd(SE.cyan, palette), whiteSpace: 'nowrap', fontWeight: 800 }}>{risk.owner || '–'}</td>
                        {/* Inherent score */}
                        <td style={{ ...tableTd(palette.text, palette), textAlign: 'center', fontWeight: 800 }}>{risk.score}</td>
                        {/* Residual score — bold + zone colour */}
                        <td style={{ ...tableTd(palette.text, palette), textAlign: 'center' }}>
                          <span style={{ fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: 15, color: getScoreColor(risk.residualScore) }}>{risk.residualScore}</span>
                        </td>
                        {/* Rating badge */}
                        <td style={{ ...tableTd(palette.text, palette), textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, background: `${ratingColor}22`, border: `1px solid ${ratingColor}`, color: ratingColor, fontWeight: 900, fontSize: 10, whiteSpace: 'nowrap' }}>{risk.rating}</span>
                        </td>
                        {/* Status */}
                        <td style={{ ...tableTd(palette.text, palette), whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, flexShrink: 0 }} />
                            <span style={{ color: palette.text, fontWeight: 700 }}>
                              {risk.progressStatus.includes('Completed') ? 'Completed' : risk.progressStatus.includes('Not Started') ? 'Not Started' : 'In Progress'}
                            </span>
                          </span>
                        </td>
                        {/* Progress bar + % */}
                        <td style={{ ...tableTd(palette.text, palette), minWidth: 120 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 6, background: palette.cardSoft, borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
                              <div style={{ width: `${risk.currentPct}%`, height: '100%', background: risk.currentPct >= 100 ? SE.green : SE.teal, borderRadius: 999, transition: 'width 0.4s ease' }} />
                            </div>
                            <span style={{ fontWeight: 900, fontSize: 10, color: risk.currentPct >= 100 ? SE.green : palette.text, minWidth: 28, textAlign: 'right' }}>{risk.currentPct}%</span>
                          </div>
                        </td>
                        {/* Target (closing date) */}
                        <td style={{ ...tableTd(palette.muted, palette), whiteSpace: 'nowrap', fontWeight: 700 }}>{risk.closingDate || '–'}</td>
                      </tr>
                    );
                  })}
                  {residualFilteredRisks.length === 0 && (
                    <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: palette.muted, fontWeight: 800 }}>No residual risk data available for the selected filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls page={safeResidualPage} totalItems={residualFilteredRisks.length} onPageChange={setResidualPage} palette={palette} label="residual risks" />

            {/* ── Top Risks by Residual Score chart ─────────────────── */}
            {topResidualRisks.length > 0 && (
              <div style={{ ...chartBox(palette) }}>
                <h3 style={{ ...chartTitle(palette), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Top Risks by Residual Score</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topResidualRisks.map((risk, idx) => {
                    const barPct = Math.min(100, (risk.residualScore / 25) * 100);
                    const scoreColor = getScoreColor(risk.residualScore);
                    return (
                      <div key={risk.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Rank number */}
                        <span style={{ width: 18, flexShrink: 0, color: palette.muted, fontWeight: 900, fontSize: 13, textAlign: 'right' }}>{idx + 1}</span>
                        {/* Title + bar */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 900, fontSize: 12, color: palette.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={risk.title}>{risk.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, background: palette.cardSoft, borderRadius: 999, overflow: 'hidden' }}>
                              <div style={{ width: `${barPct}%`, height: '100%', background: SE.teal, borderRadius: 999, transition: 'width 0.5s ease' }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 800, color: palette.muted, minWidth: 28, textAlign: 'right' }}>{risk.currentPct}%</span>
                          </div>
                        </div>
                        {/* Residual score badge */}
                        <span style={{ width: 34, height: 34, borderRadius: 8, background: scoreColor, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, sans-serif', fontWeight: 950, fontSize: 14, flexShrink: 0 }}>{risk.residualScore}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SectionCard>
          </div>}

          {activeMainTab === 'mitigation' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Section 6: Overdue Action Alert Center ─────────────────────────── */}
          <SectionCard id="overdue-section" title="Overdue Action Alert Center" palette={palette} bodyRef={overdueRef} open={sectionOpen['overdue-section']} onOpenChange={open => setSingleSectionOpen('overdue-section', open)} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(overdueRef, 'Overdue_Actions.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div ref={overdueRef}>
              {/* Alert banner */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: overdueFilteredItems.length > 0 ? 'rgba(192,57,43,.12)' : 'rgba(39,174,96,.10)', border: `1px solid ${overdueFilteredItems.length > 0 ? SE.red : SE.green}`, borderRadius: 12, padding: '10px 16px', marginBottom: 12 }}>
                <AlertTriangle size={18} color={overdueFilteredItems.length > 0 ? SE.red : SE.green} />
                <span style={{ fontWeight: 900, fontSize: 13, color: overdueFilteredItems.length > 0 ? SE.red : SE.green }}>
                  {overdueFilteredItems.length > 0 ? `${overdueFilteredItems.length} overdue action${overdueFilteredItems.length > 1 ? 's' : ''} require immediate attention` : 'All actions are on schedule'}
                </span>
              </div>
              {overdueFilteredItems.length > 0 ? (
                <div style={{ overflow: 'hidden', border: `1px solid ${palette.border}`, borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: palette.tableHead }}>
                        {['#', 'Risk Title', 'Owner', 'Closing Date', 'Status', 'Progress'].map(h => (
                          <th key={h} style={{ padding: '8px 10px', color: '#fff', fontWeight: 900, textAlign: 'left', whiteSpace: 'nowrap', fontSize: 10 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedOverdueItems.map((item, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? palette.tableStripe : 'transparent', borderBottom: `1px solid ${palette.border}` }}>
                          <td style={{ padding: '8px 10px', color: SE.red, fontWeight: 900 }}>{overdueStartIndex + i + 1}</td>
                          <td style={{ padding: '8px 10px', color: palette.text, fontWeight: 800 }}>{item.riskTitle}</td>
                          <td style={{ padding: '8px 10px', color: SE.cyan }}>{item.owner}</td>
                          <td style={{ padding: '8px 10px', color: SE.orange, fontWeight: 800 }}>{item.closingDate}</td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={{ background: item.progressStatus?.toLowerCase().includes('not') ? 'rgba(192,57,43,.15)' : 'rgba(230,126,34,.15)', color: item.progressStatus?.toLowerCase().includes('not') ? SE.red : SE.orange, border: `1px solid ${item.progressStatus?.toLowerCase().includes('not') ? SE.red : SE.orange}`, borderRadius: 6, padding: '2px 8px', fontWeight: 800, fontSize: 10 }}>{item.progressStatus}</span>
                          </td>
                          <td style={{ padding: '8px 10px', minWidth: 120 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ flex: 1, height: 6, background: palette.border, borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${item.currentPct}%`, height: '100%', background: item.currentPct >= 80 ? SE.green : item.currentPct >= 50 ? SE.gold : SE.red, borderRadius: 3, transition: 'width 0.6s ease' }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 800, color: palette.muted, minWidth: 28 }}>{item.currentPct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '30px 0', color: SE.green, fontWeight: 800, fontSize: 13 }}>No overdue actions found</div>
              )}
              <PaginationControls page={safeOverduePage} totalItems={overdueFilteredItems.length} onPageChange={setOverduePage} palette={palette} label="overdue actions" />
            </div>
          </SectionCard>
          </div>}

          {activeMainTab === 'residual' && <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Section 7: KRI Tracking Panel ────────────────────────────────────── */}
          <SectionCard id="kri-section" title="Key Risk Indicator (KRI) Tracking" palette={palette} bodyRef={kriRef} open={sectionOpen['kri-section']} onOpenChange={open => setSingleSectionOpen('kri-section', open)} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(kriRef, 'KRI_Tracking.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div ref={kriRef}>
              {/* KPI summary row */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                {(['on-track', 'at-risk', 'breached'] as const).map(s => {
                  const count = kriFilteredItems.filter(k => k.status === s).length;
                  const color = s === 'on-track' ? SE.green : s === 'at-risk' ? SE.gold : SE.red;
                  const label = s === 'on-track' ? 'On Track' : s === 'at-risk' ? 'At Risk' : 'Breached';
                  return (
                    <div key={s} style={{ flex: '1 1 100px', background: palette.cardSoft, border: `1px solid ${color}`, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 26, fontWeight: 950, color, fontFamily: 'DM Sans, sans-serif' }}>{count}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: palette.muted }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              {/* KRI traffic-light cards — 10 per page */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: 10 }}>
                {pagedKriItems.map((item, i) => {
                  const color = item.status === 'on-track' ? SE.green : item.status === 'at-risk' ? SE.gold : SE.red;
                  const label = item.status === 'on-track' ? 'Above Target' : item.status === 'at-risk' ? 'Moderate' : 'Below Target';
                  const ratio = item.kriTarget ? Math.min(140, Math.max(0, (Number(item.kriActual) / Math.max(Number(item.kriTarget), 0.0001)) * 100)) : 0;
                  return (
                    <div key={`${item.riskTitle}-${item.kriName}-${i}`} style={{ background: palette.cardSoft, border: `1px solid ${color}`, borderRadius: 14, padding: 12, minHeight: 166, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: color, fontWeight: 950 }}>{item.status === 'on-track' ? '✓' : item.status === 'at-risk' ? '!' : '✕'}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 950, color, border: `1px solid ${color}`, borderRadius: 999, padding: '2px 7px', background: `${color}18`, whiteSpace: 'nowrap' }}>{label}</span>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 950, color: palette.text, lineHeight: 1.25, minHeight: 28, overflow: 'hidden' }} title={item.kriName}>{item.kriName || 'KRI'}</div>
                      <div style={{ fontSize: 9.5, color: palette.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.riskTitle}>{item.riskTitle}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
                        <div style={{ background: palette.cardSolid, borderRadius: 10, padding: '6px 8px', border: `1px solid ${palette.border}` }}><div style={{ fontSize: 8.5, color: palette.muted, fontWeight: 800 }}>Target</div><div style={{ fontSize: 15, color: SE.blue, fontWeight: 950 }}>{item.kriTarget}</div></div>
                        <div style={{ background: palette.cardSolid, borderRadius: 10, padding: '6px 8px', border: `1px solid ${palette.border}` }}><div style={{ fontSize: 8.5, color: palette.muted, fontWeight: 800 }}>Actual</div><div style={{ fontSize: 15, color, fontWeight: 950 }}>{item.kriActual}</div></div>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: palette.border, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, ratio)}%`, height: '100%', background: color, borderRadius: 999 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {pagedKriItems.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: palette.muted, border: `1px dashed ${palette.border}`, borderRadius: 12 }}>No KRI records match the selected filters.</div>}
              <PaginationControls page={safeKriPage} totalItems={kriFilteredItems.length} onPageChange={setKriPage} palette={palette} label="KRI records" />
            </div>
          </SectionCard>

          {/* ── Section 9: Inherent → Residual → Target Velocity ─────────────────── */}
          <SectionCard id="velocity-section" title="Risk Score Velocity — Inherent vs Residual vs Target" palette={palette} bodyRef={velocityRef} open={sectionOpen['velocity-section']} onOpenChange={open => setSingleSectionOpen('velocity-section', open)} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(velocityRef, 'Risk_Velocity.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div ref={velocityRef}>
              <RiskVelocityChart data={{
                items: pagedVelocityItems,
                avgInherent: velocitySummary.avgInherent,
                avgResidual: velocitySummary.avgResidual,
                avgTarget: velocitySummary.avgTarget,
              }} palette={palette} />
              <PaginationControls page={safeVelocityPage} totalItems={velocityItems.length} onPageChange={setVelocityPage} palette={palette} label="velocity risks" />
            </div>
          </SectionCard>

          {/* ── Section 10: Risk Taxonomy ────────────────────────────────────────── */}
          <SectionCard id="taxonomy-section" title="Risk Taxonomy — Category Breakdown" palette={palette} bodyRef={taxonomyRef} open={sectionOpen['taxonomy-section']} onOpenChange={open => setSingleSectionOpen('taxonomy-section', open)} actions={<SmallActionButton palette={palette} onClick={() => exportElementAsPNG(taxonomyRef, 'Risk_Taxonomy.png', bgForExport)}><ImageDown size={12} />PNG</SmallActionButton>}>
            <div ref={taxonomyRef}>
              <RiskTaxonomyChart data={(() => {
                const catMap = new Map<string, Map<string, number>>();
                filteredRisks.forEach(r => {
                  const cat = (r as any).category || 'Uncategorised';
                  const sub = (r as any).subCategory || 'Other';
                  if (!catMap.has(cat)) catMap.set(cat, new Map());
                  const sm = catMap.get(cat)!;
                  sm.set(sub, (sm.get(sub) ?? 0) + 1);
                });
                const categories = Array.from(catMap.entries())
                  .map(([name, sm]) => ({ name, count: Array.from(sm.values()).reduce((a,b)=>a+b,0), subCategories: Array.from(sm.entries()).map(([sn,sc])=>({name:sn,count:sc})) }))
                  .sort((a,b)=>b.count-a.count);
                const rtMap = new Map<string, number>();
                filteredRisks.forEach(r => { const t=(r as any).riskType||'Unknown'; rtMap.set(t,(rtMap.get(t)??0)+1); });
                const riskTypes = Array.from(rtMap.entries()).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count);
                return { categories, riskTypes };
              })()} palette={palette} />
            </div>
          </SectionCard>
          </div>}

          <footer style={{ textAlign: 'center', fontSize: 10, color: palette.muted, padding: '3px 0 10px' }}>Risk Management Dashboard · {period} · Click any risk row to update selected risk detail</footer>
        </main>
          </div>{/* end dashboard-theme-stage */}
        </div>{/* end body row */}
      </div>{/* end dashboard-shell */}
    </>
  );
}

// ─── Mitigation Pipeline Funnel Chart ───────────────────────────────────────
interface FunnelStage { label: string; count: number; pct: number; }

function MitigationFunnelChart({ data, palette }: { data: FunnelStage[]; palette: ThemePalette }) {
  const STAGE_COLORS = ['#00AEEF', '#12D6B1', '#4FC3F7', '#C9A84C', '#27AE60'];
  const svgW = 380;
  const svgH = 310;
  const maxW = 300;
  const minW = 80;
  const barH = 42;
  const gap = 8;
  const leftPad = 10;
  const total = data[0]?.count || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: 'block', maxHeight: 330 }} aria-label="Mitigation Pipeline Funnel">
        <defs>
          {STAGE_COLORS.map((color, i) => (
            <linearGradient key={i} id={`fg2-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.65" />
            </linearGradient>
          ))}
          <filter id="funnel-shadow" x="-5%" y="-5%" width="115%" height="130%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.25)" />
          </filter>
        </defs>

        {data.map((stage, i) => {
          const barW = Math.max(minW, Math.round((stage.count / total) * maxW));
          const cx = leftPad + maxW / 2;
          const x = cx - barW / 2;
          const y = i * (barH + gap) + 4;
          const color = STAGE_COLORS[i];
          const labelX = leftPad + maxW + 14;

          return (
            <g key={stage.label}>
              {/* Trapezoid connector */}
              {i < data.length - 1 && (() => {
                const nW = Math.max(minW, Math.round((data[i + 1].count / total) * maxW));
                const nX = cx - nW / 2;
                const cY = y + barH;
                return <polygon points={`${x},${cY} ${x + barW},${cY} ${nX + nW},${cY + gap} ${nX},${cY + gap}`} fill={color} opacity={0.15} />;
              })()}

              {/* Bar */}
              <rect x={x} y={y} width={barW} height={barH} rx={7} ry={7}
                fill={`url(#fg2-${i})`} stroke={color} strokeWidth={1.5} strokeOpacity={0.7}
                filter="url(#funnel-shadow)" />

              {/* Label inside */}
              <text x={cx} y={y + barH / 2 - 6} textAnchor="middle" dominantBaseline="central"
                fontSize="11" fontWeight="900" fontFamily="DM Sans, sans-serif" fill="#fff">
                {stage.label}
              </text>
              <text x={cx} y={y + barH / 2 + 9} textAnchor="middle" dominantBaseline="central"
                fontSize="10" fontWeight="700" fontFamily="DM Sans, sans-serif" fill="rgba(255,255,255,0.82)">
                {stage.count} risks
              </text>

              {/* Right-side count + % */}
              <text x={labelX} y={y + barH / 2 - 6} fontSize="15" fontWeight="950"
                fontFamily="DM Sans, sans-serif" fill={color} dominantBaseline="central">
                {stage.count}
              </text>
              <text x={labelX} y={y + barH / 2 + 10} fontSize="9" fontWeight="700"
                fontFamily="DM Sans, sans-serif" fill={palette.muted} dominantBaseline="central">
                {stage.pct}%
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 10px', justifyContent: 'center', marginTop: 4 }}>
        {data.map((stage, i) => (
          <span key={stage.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: palette.muted, fontWeight: 800 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: STAGE_COLORS[i], display: 'inline-block' }} />
            {stage.label}
          </span>
        ))}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function chartBox(palette: ThemePalette): CSSProperties {
  return { background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 16, padding: 12, minHeight: 0 };
}


function analyticsGroupTitle(palette: ThemePalette): CSSProperties {
  return {
    fontSize: 17,
    fontWeight: 950,
    color: palette.text,
    fontFamily: 'DM Sans, Inter, sans-serif',
    margin: '4px 0 10px',
    letterSpacing: '-0.01em',
  };
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

// ─── 5×5 Risk Heat Map ───────────────────────────────────────────────────────

interface HeatMapCell {
  likelihood: number;
  impact: number;
  risks: { title: string; score: number; rating: string }[];
}

function cellColor(likelihood: number, impact: number): string {
  const score = likelihood * impact;
  if (score >= 20) return '#C0392B';   // Very High
  if (score >= 15) return '#E67E22';   // High
  if (score >= 9)  return '#F39C12';   // Moderate
  if (score >= 5)  return '#27AE60';   // Low
  return '#2ECC71';                     // Very Low
}

function RiskHeatMap({ risks, palette, isDark, selectedCell, onCellSelect }: { risks: RiskRow[]; palette: ThemePalette; isDark: boolean; selectedCell?: { likelihood: number; impact: number } | null; onCellSelect?: (cell: HeatMapCell) => void }) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatMapCell } | null>(null);

  // Build 5×5 grid
  const grid: HeatMapCell[][] = Array.from({ length: 5 }, (_, li) =>
    Array.from({ length: 5 }, (_, ii) => ({
      likelihood: li + 1,
      impact: ii + 1,
      risks: [],
    }))
  );

  risks.forEach(r => {
    const li = Math.min(Math.max(Math.round(r.likelihood) - 1, 0), 4);
    const ii = Math.min(Math.max(Math.round(r.impact) - 1, 0), 4);
    grid[li][ii].risks.push({ title: r.title, score: r.score, rating: r.rating });
  });

  const LABELS = ['1 — Rare', '2 — Unlikely', '3 — Possible', '4 — Likely', '5 — Almost Certain'];
  const IMPACT_LABELS = ['1 — Negligible', '2 — Minor', '3 — Moderate', '4 — Major', '5 — Catastrophic'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        {[['#C0392B', 'Very High (20–25)'], ['#E67E22', 'High (15–19)'], ['#F39C12', 'Moderate (9–14)'], ['#27AE60', 'Low (5–8)'], ['#2ECC71', 'Very Low (1–4)']].map(([c, l]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: palette.muted, fontWeight: 800 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0 }}>
        {/* Y-axis label */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: palette.muted, writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: 1 }}>LIKELIHOOD →</span>
        </div>

        <div style={{ flex: 1 }}>
          {/* Grid — rows = likelihood (5 down to 1), cols = impact (1 to 5) */}
          {[4, 3, 2, 1, 0].map(li => (
            <div key={li} style={{ display: 'flex', alignItems: 'stretch', marginBottom: 2 }}>
              {/* Row label */}
              <div style={{ width: 110, flexShrink: 0, display: 'flex', alignItems: 'center', paddingRight: 6 }}>
                <span style={{ fontSize: 9, color: palette.muted, fontWeight: 700, textAlign: 'right', width: '100%' }}>{LABELS[li]}</span>
              </div>
              {/* Cells */}
              {[0, 1, 2, 3, 4].map(ii => {
                const cell = grid[li][ii];
                const key = `${li}-${ii}`;
                const bg = cellColor(li + 1, ii + 1);
                const count = cell.risks.length;
                const isSelected = selectedCell?.likelihood === cell.likelihood && selectedCell?.impact === cell.impact;
                return (
                  <div
                    key={ii}
                    style={{
                      flex: 1, minHeight: 52, margin: '0 2px', borderRadius: 8,
                      background: count > 0 ? bg : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                      border: isSelected ? `3px solid ${SE.blue}` : `2px solid ${count > 0 ? bg : palette.border}`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: count > 0 ? 'pointer' : 'default',
                      opacity: count > 0 ? 1 : 0.35,
                      transition: 'transform 0.15s, opacity 0.15s',
                      transform: hoveredCell === key ? 'scale(1.06)' : 'scale(1)',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      if (count > 0) {
                        setHoveredCell(key);
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setTooltip({ x: rect.left, y: rect.bottom + 6, cell });
                      }
                    }}
                    onMouseLeave={() => { setHoveredCell(null); setTooltip(null); }}
                    onClick={() => { if (count > 0) onCellSelect?.(cell); }}
                  >
                    {count > 0 && (
                      <>
                        <span style={{ fontSize: 18, fontWeight: 950, color: '#fff', fontFamily: 'DM Sans, sans-serif', lineHeight: 1 }}>{count}</span>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>risk{count > 1 ? 's' : ''}</span>
                      </>
                    )}
                    {count === 0 && (
                      <span style={{ fontSize: 11, color: palette.border }}>—</span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* X-axis labels */}
          <div style={{ display: 'flex', marginLeft: 116 }}>
            {IMPACT_LABELS.map((l, i) => (
              <div key={i} style={{ flex: 1, margin: '0 2px', textAlign: 'center' }}>
                <span style={{ fontSize: 8.5, color: palette.muted, fontWeight: 700 }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: palette.muted, letterSpacing: 1 }}>IMPACT →</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y, zIndex: 9999,
          background: palette.card, border: `1px solid ${palette.border}`, borderRadius: 10,
          padding: '10px 14px', fontSize: 11, boxShadow: '0 8px 28px rgba(0,0,0,.22)',
          maxWidth: 280, pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 900, color: palette.text, marginBottom: 6 }}>
            Likelihood {tooltip.cell.likelihood} × Impact {tooltip.cell.impact} = Score {tooltip.cell.likelihood * tooltip.cell.impact}
          </div>
          {tooltip.cell.risks.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ZONE_COLORS[r.rating as keyof typeof ZONE_COLORS] || '#888', flexShrink: 0 }} />
              <span style={{ color: palette.muted, fontSize: 10 }}>{r.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Score matrix reference */}
      <div style={{ marginTop: 8, padding: '8px 12px', background: palette.cardSoft, borderRadius: 10, border: `1px solid ${palette.border}` }}>
        <span style={{ fontSize: 10, fontWeight: 900, color: palette.text }}>Score Matrix Reference: </span>
        <span style={{ fontSize: 10, color: palette.muted }}>Score = Likelihood × Impact. Hover to inspect risks; click a populated cell to filter the dashboard.</span>
      </div>
    </div>
  );
}

// ─── Risk Score Velocity Chart ───────────────────────────────────────────────

function RiskVelocityChart({ data, palette }: { data: { items: { title: string; inherent: number; residual: number; target: number; gap: number; rating: string }[]; avgInherent: number; avgResidual: number; avgTarget: number }; palette: ThemePalette }) {
  const maxScore = Math.max(...data.items.map(d => d.inherent), 25);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Avg summary row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Avg Inherent', value: data.avgInherent, color: SE.red },
          { label: 'Avg Residual', value: data.avgResidual, color: SE.gold },
          { label: 'Avg Target', value: data.avgTarget, color: SE.green },
          { label: 'Avg Gap (Residual − Target)', value: Math.round((data.avgResidual - data.avgTarget) * 10) / 10, color: data.avgResidual > data.avgTarget ? SE.orange : SE.green },
        ].map(m => (
          <div key={m.label} style={{ flex: '1 1 120px', background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 22, fontWeight: 950, color: m.color, fontFamily: 'DM Sans, sans-serif' }}>{m.value}</span>
            <span style={{ fontSize: 9.5, fontWeight: 800, color: palette.muted, textAlign: 'center' }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Per-risk velocity bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.items.map((item, i) => {
          const inhW = (item.inherent / maxScore) * 100;
          const resW = (item.residual / maxScore) * 100;
          const tgtW = (item.target / maxScore) * 100;
          const gapColor = item.gap > 0 ? SE.orange : SE.green;
          return (
            <div key={i} style={{ background: palette.cardSoft, border: `1px solid ${palette.border}`, borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: palette.text, maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: palette.muted }}>Gap:</span>
                  <span style={{ fontSize: 11, fontWeight: 900, color: gapColor }}>{item.gap > 0 ? '+' : ''}{item.gap}</span>
                  <span style={{ background: `${ZONE_COLORS[item.rating as keyof typeof ZONE_COLORS] || '#888'}22`, color: ZONE_COLORS[item.rating as keyof typeof ZONE_COLORS] || '#888', border: `1px solid ${ZONE_COLORS[item.rating as keyof typeof ZONE_COLORS] || '#888'}`, borderRadius: 5, padding: '1px 7px', fontSize: 9.5, fontWeight: 800 }}>{item.rating}</span>
                </div>
              </div>
              {/* Three stacked bars */}
              {[
                { label: 'Inherent', value: item.inherent, width: inhW, color: SE.red },
                { label: 'Residual', value: item.residual, width: resW, color: SE.gold },
                { label: 'Target', value: item.target, width: tgtW, color: SE.green },
              ].map(bar => (
                <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, color: palette.muted, width: 52, textAlign: 'right', fontWeight: 700 }}>{bar.label}</span>
                  <div style={{ flex: 1, height: 8, background: palette.border, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${bar.width}%`, height: '100%', background: bar.color, borderRadius: 4, transition: 'width 0.7s ease' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, color: bar.color, minWidth: 20, textAlign: 'right' }}>{bar.value}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[['Inherent Score', SE.red], ['Residual Score', SE.gold], ['Target Score', SE.green]].map(([l, c]) => (
          <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: palette.muted, fontWeight: 800 }}>
            <span style={{ width: 28, height: 8, borderRadius: 4, background: c, display: 'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Risk Taxonomy Chart ─────────────────────────────────────────────────────

const TAXONOMY_COLORS = [
  '#0078FF', '#00AEEF', '#12D6B1', '#C9A84C', '#E67E22', '#C0392B', '#8E44AD', '#27AE60', '#2980B9', '#F39C12',
];

function RiskTaxonomyChart({ data, palette }: { data: { categories: { name: string; count: number; subCategories: { name: string; count: number }[] }[]; riskTypes: { name: string; count: number }[] }; palette: ThemePalette }) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const total = data.categories.reduce((a, b) => a + b.count, 0) || 1;
  const maxCategory = Math.max(1, ...data.categories.map(c => c.count));
  const activeCat = activeCategory ? data.categories.find(c => c.name === activeCategory) : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 14 }}>
      <div style={chartBox(palette)}>
        <h3 style={chartTitle(palette)}>Risks by Category</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.categories.map((cat, i) => {
            const color = TAXONOMY_COLORS[i % TAXONOMY_COLORS.length];
            const pct = Math.round((cat.count / total) * 100);
            return (
              <button key={cat.name} type="button" onClick={() => setActiveCategory(prev => prev === cat.name ? null : cat.name)} style={{ border: activeCategory === cat.name ? `1px solid ${color}` : `1px solid ${palette.border}`, background: activeCategory === cat.name ? `${color}14` : palette.cardSoft, borderRadius: 11, padding: '8px 10px', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 44px 44px', gap: 8, alignItems: 'center' }}>
                  <div style={{ color: palette.text, fontWeight: 900, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cat.name}>{cat.name}</div>
                  <div style={{ height: 10, background: palette.border, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(4, (cat.count / maxCategory) * 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
                  </div>
                  <div style={{ color, fontWeight: 950, fontSize: 13, textAlign: 'right' }}>{cat.count}</div>
                  <div style={{ color: palette.muted, fontWeight: 850, fontSize: 10, textAlign: 'right' }}>{pct}%</div>
                </div>
              </button>
            );
          })}
        </div>
        {activeCat && (
          <div style={{ marginTop: 12, padding: 12, background: palette.cardAlt, border: `1px solid ${palette.border}`, borderRadius: 12 }}>
            <div style={{ fontWeight: 950, color: palette.text, fontSize: 11, marginBottom: 8 }}>{activeCat.name} — Sub-category drill-down</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
              {activeCat.subCategories.map((sub, i) => (
                <div key={`${sub.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: palette.cardSolid, border: `1px solid ${palette.border}`, borderRadius: 9, padding: '6px 8px' }}>
                  <span style={{ flex: 1, color: palette.muted, fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub.name}</span>
                  <span style={{ color: SE.cyan, fontWeight: 950, fontSize: 11 }}>{sub.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={chartBox(palette)}>
        <h3 style={chartTitle(palette)}>Risk Type Distribution</h3>
        <ResponsiveContainer width="100%" height={Math.max(240, data.riskTypes.length * 32)}>
          <BarChart data={data.riskTypes} layout="vertical" margin={{ top: 6, right: 42, left: 6, bottom: 4 }} barSize={17}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={palette.chartGrid} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: palette.text, fontWeight: 800 }} axisLine={false} tickLine={false} width={112} />
            <Tooltip content={<ChartTooltip palette={palette} />} />
            <Bar dataKey="count" name="Risks" radius={[0, 6, 6, 0]} animationDuration={700} label={{ position: 'right', fontSize: 10, fontWeight: 900, fill: SE.blue, formatter: (v: number) => v }}>
              {data.riskTypes.map((_, i) => <Cell key={i} fill={TAXONOMY_COLORS[i % TAXONOMY_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
