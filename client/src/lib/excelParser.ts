/**
 * Risk Register Excel Parser — Flexible Schema (v3)
 *
 * ── Design Principles ────────────────────────────────────────────────────────
 * 1. NO hardcoded column indices. Every field is located by scanning the header
 *    row for its exact name (case-insensitive, trimmed). This means the parser
 *    survives any number of new columns being inserted anywhere in the sheet.
 *
 * 2. ANY sheet name is accepted. The parser scans all workbook sheets and uses
 *    the sheet with the strongest risk-register header match.
 *
 * 3. Two dynamic blocks grow over time and are auto-detected by content pattern:
 *    a. Residual block  — headers containing "Residual" → skipped (not progress)
 *    b. Progress block  — headers that are Excel date serials OR text matching a
 *       month/week pattern → these become the period (month/week) columns.
 *
 * 4. Flexible period labels: works with weekly labels ("Mar - W4", "W1"),
 *    monthly text labels ("Jan-2026", "Feb 2026"), or Excel date serial headers
 *    (stored as JS Date objects by xlsx with cellDates:true).
 *
 * ── Per-Risk Progress Formula ────────────────────────────────────────────────
 * Each risk title row carries the aggregated progress directly in the period
 * columns (the Excel helper columns BJ–BP pre-compute the weighted sum).
 * The parser reads progress from the TITLE ROW of each risk, not action sub-rows.
 *
 * ── Column Anchor Names (searched by header text, not index) ─────────────────
 *   Risk Title      → "Risk Title"
 *   Owner           → "Owner"
 *   Likelihood      → "I-Likelihood"  (fallback: "Likelihood")
 *   Impact          → "I-Impact"      (fallback: "Impact")
 *   Risk Score      → "I-Score"       (fallback: "Risk Score", "Score")
 *   Risk Rating     → "Rating"        (fallback: "Risk Rating")
 *   Action Text     → "Action"
 *   Action Weight   → "Action Weight"
 *   Identification  → "Identification Date" / opening date
 *   Closing Date    → "Closing Date"
 *   Progress Status → "Progress Status"
 *   Target          → "Target"        (per-action target, 0.0–1.0)
 */

import * as XLSX from 'xlsx';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WeekData {
  label: string;
  colIndex: number;  // 0-based column index in the data sheet
}

export interface RiskRow {
  id: string;
  title: string;
  mitigation: string;
  owner: string;
  score: number;
  rating: string;
  identificationDate: string;  // risk identification / opening date
  closingDate: string;
  progressStatus: string;
  weekProgress: Record<string, number>;  // key=period label, value=0.0–1.0
  currentPct: number;   // 0–100 integer
  beforePct: number;
  developmentPct: number;
  aboveTarget: boolean;
  belowTarget: boolean;
  likelihood: number;   // 1–5
  impact: number;       // 1–5
  residualScore: number;  // latest residual score (0 if not available)
  tScore: number;         // target risk score
  category: string;       // risk category (e.g. "Supplier Management")
  subCategory: string;    // sub-category (e.g. "Process")
  riskType: string;       // risk type (e.g. "Division Level")
  kriName: string;        // monitoring indicator / KRI name
  kriMeasure: string;     // KRI measure description
  kriUnit: string;        // KRI unit (%, #, etc.)
  kriTarget: number;      // KRI target value
  kriActual: number;      // KRI actual value
  isOverdue: boolean;     // true if closing date is past and not completed
}

export interface DashboardData {
  period: string;
  weeks: WeekData[];
  selectedWeek: string;
  prevWeekLabel: string;
  kpis: {
    totalRisks: number;
    totalMitigation: number;
    aboveTarget: number;
    belowTarget: number;
    avgRiskScore: number;
    avgRiskRating: string;
  };
  zoneCounts: {
    veryHigh: number;
    high: number;
    moderate: number;
    low: number;
    veryLow: number;
  };
  progressCounts: {
    completed: number;
    inProgress: number;
    notStarted: number;
  };
  riskSummary: { name: string; value: number; color: string }[];
  riskRegister: RiskRow[];
  selectedRisk: RiskRow | null;
  filterOptions?: {
    identificationDates: string[];
    ratings: string[];
    owners: string[];
    progressStatuses: string[];
    closingDates: string[];
    categories: string[];
    riskTypes: string[];
  };
  mitigationTargetsByWeek?: Record<string, { aboveTarget: number; belowTarget: number }>;
  residualData: {
    zoneCounts: { veryHigh: number; high: number; moderate: number; low: number; veryLow: number };
    avgResidualScore: number;
    avgInherentScore: number;
  };
  overdueActions: {
    count: number;
    items: { riskTitle: string; closingDate: string; progressStatus: string; currentPct: number; owner: string }[];
  };
  kriData: {
    items: { riskTitle: string; kriName: string; kriMeasure: string; kriUnit: string; kriTarget: number; kriActual: number; status: 'on-track' | 'at-risk' | 'breached' }[];
  };
  taxonomyData: {
    categories: { name: string; count: number; subCategories: { name: string; count: number }[] }[];
    riskTypes: { name: string; count: number }[];
  };
  velocityData: {
    items: { title: string; inherent: number; residual: number; target: number; gap: number; rating: string }[];
    avgInherent: number;
    avgResidual: number;
    avgTarget: number;
  };
}

// ── Utility helpers ──────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 20) return '#C0392B';
  if (score >= 15) return '#E67E22';
  if (score >= 9)  return '#F39C12';
  if (score >= 5)  return '#27AE60';
  return '#2ECC71';
}

export function getRatingColor(rating: string): string {
  const r = (rating || '').toLowerCase();
  if (r.includes('very high')) return '#C0392B';
  if (r.includes('high'))      return '#E67E22';
  if (r.includes('moderate'))  return '#F39C12';
  if (r.includes('low'))       return '#27AE60';
  return '#2ECC71';
}

function safeNum(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v);
  if (s.startsWith('#')) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function safeStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}


function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function normalizeDateObjectForDisplay(date: Date): Date {
  const d = new Date(date.getTime());
  // Excel dates coming through XLSX can occasionally arrive a few seconds before
  // midnight because of serial-date precision/timezone conversion. Round those
  // values forward so 31/12/2025 does not display as Tue Dec 30 ... 23:59.
  if (d.getHours() === 23 && d.getMinutes() >= 55) d.setMinutes(d.getMinutes() + 10);
  return d;
}

function formatDateForDisplay(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';

  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = normalizeDateObjectForDisplay(v);
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  if (typeof v === 'number' && v > 36526 && v < 50000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  }

  const text = safeStr(v);
  if (!text) return '';

  const quarter = normalizeQuarterValue(text);
  if (/^Q[1-4]\s+\d{4}$/i.test(quarter)) return quarter;

  const dmy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = dmy[3].length === 2 ? Number(`20${dmy[3]}`) : Number(dmy[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
      return `${pad2(day)}/${pad2(month)}/${year}`;
    }
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    const d = normalizeDateObjectForDisplay(new Date(parsed));
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  return text;
}

function normalizeQuarterValue(v: unknown): string {
  const text = safeStr(v);
  if (!text) return '';

  // Supports source values such as: 2025 Q1, 2025-Q1, 2025/Q1, Q1 2025, Q1-2025.
  const match =
    text.match(/(?:^|\b)(\d{4})\s*[\-\/\s]*[Qq]([1-4])(?:\b|$)/) ||
    text.match(/(?:^|\b)[Qq]([1-4])\s*[\-\/\s]*(\d{4})(?:\b|$)/);

  if (!match) return text;

  const first = match[1];
  const second = match[2];
  const year = first.length === 4 ? Number(first) : Number(second);
  const quarter = first.length === 4 ? Number(second) : Number(first);

  return `Q${quarter} ${year}`;
}

function quarterOptionSortKey(value: string): number {
  const text = normalizeQuarterValue(value);
  const match = text.match(/^Q([1-4])\s+(\d{4})$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[2]) * 4 + Number(match[1]);
}

function uniqueTextValues(values: unknown[], normalizer: (value: unknown) => string = safeStr): string[] {
  return Array.from(new Set(values.map(normalizer).map(v => v.trim()).filter(Boolean)));
}

function sortQuarterValues(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const ak = quarterOptionSortKey(a);
    const bk = quarterOptionSortKey(b);
    if (ak !== bk) return ak - bk;
    return a.localeCompare(b);
  });
}

function pct(v: number): number {
  if (v > 1) return Math.round(v);
  return Math.round(v * 100);
}

function deriveRating(score: number): string {
  if (score >= 20) return 'Very High';
  if (score >= 15) return 'High';
  if (score >= 9)  return 'Moderate';
  if (score >= 5)  return 'Low';
  return 'Very Low';
}

function deriveProgressStatus(pctVal: number): string {
  if (pctVal >= 100) return 'Completed (100%)';
  if (pctVal > 0)    return 'In Progress (1-99%)';
  return 'Not Started (0%)';
}

function isNumericCell(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '' &&
    !String(v).startsWith('#') && !isNaN(Number(v));
}

function markerToBool(v: unknown, label: string): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v > 0;
  const s = safeStr(v).toLowerCase();
  if (!s) return null;
  if (['yes', 'y', 'true', '1', 'x', '✓', '✔'].includes(s)) return true;
  if (['no', 'n', 'false', '0', '-', '—'].includes(s)) return false;
  return s.includes(label.toLowerCase()) ? true : null;
}

function computeZoneCountsFromRisks(risks: RiskRow[]): DashboardData['zoneCounts'] {
  return risks.reduce<DashboardData['zoneCounts']>((acc, risk) => {
    const rating = (safeStr(risk.rating) || deriveRating(risk.score)).toLowerCase().trim();
    if (rating.includes('very high') || risk.score >= 20) acc.veryHigh += 1;
    else if (rating.includes('very low') || risk.score < 5) acc.veryLow += 1;
    else if (rating.includes('high') || risk.score >= 15) acc.high += 1;
    else if (rating.includes('moderate') || risk.score >= 9) acc.moderate += 1;
    else acc.low += 1;
    return acc;
  }, { veryHigh: 0, high: 0, moderate: 0, low: 0, veryLow: 0 });
}

function buildRiskSummary(aboveTarget: number, belowTarget: number): DashboardData['riskSummary'] {
  return [
    { name: 'Above Target', value: aboveTarget, color: '#27AE60' },
    { name: 'Below Target', value: belowTarget, color: '#C0392B' },
  ].filter(d => d.value > 0);
}

// ── Column map builder ───────────────────────────────────────────────────────

/**
 * Scan the header row and return a map of { normalizedName → colIndex }.
 * Normalisation: lowercase, collapse whitespace, strip leading/trailing spaces.
 */
function normalizeHeaderName(value: unknown): string {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/[()\[\]{}]/g, ' ')
    .replace(/[\\/_–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function compactHeaderName(value: unknown): string {
  return normalizeHeaderName(value).replace(/[^a-z0-9]/g, '');
}

function buildColMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i];
    if (v === null || v === undefined) continue;
    // Skip datetime objects — those are period columns, not named anchors
    if (v instanceof Date) continue;
    const normal = normalizeHeaderName(v);
    const compact = compactHeaderName(v);
    if (normal && !map.has(normal)) map.set(normal, i);
    if (compact && !map.has(compact)) map.set(compact, i);
  }
  return map;
}

/**
 * Look up a column index by trying a list of candidate names (first match wins).
 * Matching is tolerant of spaces, line breaks, hyphens, and small header wording changes.
 * Returns -1 if none found.
 */
function findCol(colMap: Map<string, number>, ...candidates: string[]): number {
  for (const name of candidates) {
    const key = normalizeHeaderName(name);
    if (colMap.has(key)) return colMap.get(key)!;
  }

  for (const name of candidates) {
    const compact = compactHeaderName(name);
    if (compact && colMap.has(compact)) return colMap.get(compact)!;
  }

  // Fuzzy include match for descriptive headers such as
  // "Monitoring Indicators (KRIs) (Metrics Description)".
  const fuzzyBlock = new Set(['id', 'no', '#', 'unit', 'date', 'owner', 'score', 'target', 'actual', 'action']);
  for (const name of candidates) {
    const key = normalizeHeaderName(name);
    const compact = compactHeaderName(name);
    if (!key || key.length < 5 || fuzzyBlock.has(key)) continue;
    for (const [header, idx] of Array.from(colMap.entries())) {
      if (header.includes(key) || (compact && header.includes(compact))) return idx;
    }
  }

  return -1;
}

interface SheetMatch {
  sheetName: string;
  rows: unknown[][];
  headerRowIdx: number;
  score: number;
}

function scoreHeaderRow(headerRow: unknown[]): number {
  const colMap = buildColMap(headerRow);
  let score = 0;
  if (findCol(colMap, 'risk title', 'risk name', 'risk', 'risk item') >= 0) score += 6;
  if (findCol(colMap, '#', 'no', 'risk no', 'risk id', 'id', 'serial') >= 0) score += 1;
  if (findCol(colMap, 'owner', 'risk owner', 'responsible owner') >= 0) score += 2;
  if (findCol(colMap, 'i-likelihood', 'inherent likelihood', 'likelihood') >= 0) score += 2;
  if (findCol(colMap, 'i-impact', 'inherent impact', 'impact') >= 0) score += 2;
  if (findCol(colMap, 'i-score', 'inherent score', 'risk score', 'score') >= 0) score += 2;
  if (findCol(colMap, 'rating', 'risk rating', 'inherent rating') >= 0) score += 1;
  if (findCol(colMap, 'action', 'mitigation action', 'mitigation') >= 0) score += 2;
  if (detectPeriodColumns(headerRow).length > 0) score += 3;
  return score;
}

function locateRiskSheet(wb: XLSX.WorkBook): SheetMatch {
  let best: SheetMatch | null = null;

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][];
    if (rows.length < 2) continue;

    for (let r = 0; r < Math.min(30, rows.length); r++) {
      const row = rows[r] as unknown[];
      const nonEmpty = row.filter(v => safeStr(v)).length;
      if (nonEmpty < 3) continue;
      const score = scoreHeaderRow(row);
      if (!best || score > best.score) {
        best = { sheetName, rows, headerRowIdx: r, score };
      }
    }
  }

  if (best && best.score >= 6) return best;

  // Last fallback: first non-empty sheet, first row. This keeps upload tolerant,
  // but the dashboard will still show empty values if no risk columns exist.
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][];
    if (rows.length >= 2) return { sheetName, rows, headerRowIdx: 0, score: 0 };
  }

  throw new Error('UPLOAD_VALIDATION: Workbook contains no readable sheets.');
}

// ── Period column detection ──────────────────────────────────────────────────

/**
 * Month/week text pattern — matches labels like:
 *   "Jan-2026", "Jan 2026", "January 2026", "Feb-26",
 *   "Mar - W4 (24/3)", "APRIL- W1", "W1", "W2", "Week 3",
 *   "01/2026", "2026-01"
 *
 * Deliberately EXCLUDES strings that contain "residual", "likelihood",
 * "impact", "score", "weight", "action", "status", "target", "comment",
 * "control", "description", "indicator", "measure", "unit" — these are
 * named columns that happen to contain month words.
 */
const PERIOD_TEXT_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|(\bw\d{1,2}\b)|(\bweek\s*\d{1,2}\b)/i;

const PERIOD_EXCLUDE_RE = /residual|likelihood|impact|score|weight|action|status|target|comment|control|description|indicator|measure|unit|kri|sector|category|department|business|owner|rating|date|closing|div|dept/i;

/**
 * Convert an Excel date serial (number) or JS Date to a "Mon-YYYY" label.
 * xlsx with cellDates:false returns date serials as numbers.
 * xlsx with cellDates:true returns them as JS Date objects.
 */
function excelDateToLabel(v: unknown): string | null {
  // JS Date (cellDates:true)
  if (v instanceof Date && !isNaN(v.getTime())) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[v.getMonth()]}-${v.getFullYear()}`;
  }
  // Number — could be an Excel date serial (cellDates:false)
  // Excel date serials for year 2000+ are > 36526; typical risk register years 2024-2030
  if (typeof v === 'number' && v > 36526 && v < 50000) {
    // Convert Excel serial to JS Date (Excel epoch = Jan 0 1900)
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2035) {
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return `${months[d.getMonth()]}-${d.getFullYear()}`;
    }
  }
  return null;
}

/**
 * Detect all period (month/week) columns from the header row.
 * Returns WeekData[] sorted by column index (chronological order in sheet).
 *
 * Detection rules (in priority):
 *   1. Header is a JS Date object → convert to "Mon-YYYY" label
 *   2. Header is a number in Excel date serial range → convert to "Mon-YYYY" label
 *   3. Header is a string matching PERIOD_TEXT_RE and NOT matching PERIOD_EXCLUDE_RE
 */
function detectPeriodColumns(headerRow: unknown[]): WeekData[] {
  const periods: WeekData[] = [];
  const seenLabels = new Set<string>();

  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i];
    if (v === null || v === undefined) continue;

    let label: string | null = null;

    // Rule 1 & 2: date value
    label = excelDateToLabel(v);

    // Rule 3: text string
    if (label === null && typeof v === 'string') {
      const s = v.trim();
      if (s.length > 0 && s.length < 40 &&
          PERIOD_TEXT_RE.test(s) &&
          !PERIOD_EXCLUDE_RE.test(s)) {
        label = s;
      }
    }

    if (label && !seenLabels.has(label)) {
      seenLabels.add(label);
      periods.push({ label, colIndex: i });
    }
  }

  return periods;
}

// ── Main parser ──────────────────────────────────────────────────────────────

export function parseExcel(buffer: ArrayBuffer): DashboardData {
  // cellDates:true so Excel date serials become JS Date objects
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  // Accept ANY workbook and ANY sheet name — choose the sheet/header row that
  // looks most like a risk register rather than relying on a fixed sheet name.
  const located = locateRiskSheet(wb);
  const rows = located.rows;
  const headerRowIdx = located.headerRowIdx;

  if (rows.length < 2) throw new Error('UPLOAD_VALIDATION: The selected sheet appears to be empty.');

  const headerRow = rows[headerRowIdx] as unknown[];
  const dataStartRow = headerRowIdx + 1;

  // ── Build column map (named anchors) ─────────────────────────────────────
  const colMap = buildColMap(headerRow);

  // Locate every anchor field by name. Each field has practical aliases so
  // users can rename columns without breaking the upload.
  const COL_ID           = findCol(colMap, '#', 'no', 'risk no', 'risk id', 'id', 'serial', 'index');
  const COL_RISK_TITLE   = findCol(colMap, 'risk title', 'risk name', 'risk item', 'risk');
  // Prefer the source Risk Owner column for dashboard ownership fields.
  // Some workbooks also have a generic Owner / Action Owner column; those should
  // not override Risk Owner in the Residual Risk Analysis owner group column.
  const COL_OWNER        = findCol(colMap, 'risk owner', 'owner group', 'responsible owner', 'owner', 'helper owner');
  const COL_LIKELIHOOD   = findCol(colMap, 'i-likelihood', 'inherent likelihood', 'likelihood');
  const COL_IMPACT       = findCol(colMap, 'i-impact', 'inherent impact', 'impact');
  const COL_SCORE        = findCol(colMap, 'i-score', 'inherent score', 'risk score', 'score');
  const COL_RATING       = findCol(colMap, 'rating', 'risk rating', 'inherent rating');
  const COL_ACTION       = findCol(colMap, 'action', 'mitigation action', 'mitigation', 'action description');
  const COL_ACTION_WEIGHT = findCol(colMap, 'action weight', 'weight', 'weighting');
  const COL_IDENTIFICATION_DATE = (() => {
    const direct = findCol(
      colMap,
      'identification date',
      'identification',
      'identified date',
      'identified quarter',
      'identification quarter',
      'risk identification',
      'risk identification date',
      'risk identification quarter',
      'opening date',
      'open date',
      'date identified',
      'date raised'
    );
    if (direct >= 0) return direct;

    // Last-resort fuzzy scan. Some workbooks contain hidden line breaks or
    // unexpected wording around the Identification Date column; this keeps the
    // dashboard filters populated from the real source column instead of showing
    // only "All Identification Dates".
    for (let i = 0; i < headerRow.length; i++) {
      const h = normalizeHeaderName(headerRow[i]);
      const compact = compactHeaderName(headerRow[i]);
      if (
        (h.includes('identification') || compact.includes('identification') || h.includes('identified') || compact.includes('identified')) &&
        (h.includes('date') || h.includes('quarter') || compact.includes('date') || compact.includes('quarter'))
      ) {
        return i;
      }
    }
    return -1;
  })();
  const COL_CLOSING_DATE = findCol(colMap, 'closing date', 'target close', 'target close date', 'due date');
  const COL_PROGRESS_STATUS = findCol(colMap, 'progress status', 'status', 'action status');
  const COL_T_SCORE          = findCol(colMap, 't-score', 'target score', 'target risk score', 'tscore');
  const COL_CATEGORY         = findCol(colMap, 'category', 'risk category');
  const COL_SUB_CATEGORY     = findCol(colMap, 'sub - category', 'sub-category', 'sub category', 'subcategory');
  const COL_RISK_TYPE        = findCol(colMap, 'risk type', 'type');
  const COL_ABOVE_TARGET     = findCol(colMap, 'above target');
  const COL_BELOW_TARGET     = findCol(colMap, 'below target');
  const COL_KRI_NAME         = findCol(colMap, 'monitoring indicators', 'monitoring indicator', 'key risk indicator', 'kri');
  const COL_KRI_MEASURE      = findCol(colMap, 'measure', 'kri measure', 'metric measure');
  const COL_KRI_UNIT         = findCol(colMap, 'unit', 'kri unit');
  // KRI target and actual: there may be several target columns. Prefer the
  // explicit KRI target names, then fall back to the first Target/Actual columns
  // after the KRI-name block.
  let COL_KRI_TARGET = findCol(colMap, 'target kri', 'kri target', 'target key risk indicator');
  let COL_KRI_ACTUAL = findCol(colMap, 'actual', 'kri actual', 'actual kri');

  const missingRequiredColumns: string[] = [];
  if (COL_RISK_TITLE < 0) missingRequiredColumns.push('Risk Title');
  if (missingRequiredColumns.length > 0) {
    throw new Error(`UPLOAD_VALIDATION: Missing required columns: ${missingRequiredColumns.join(', ')}.`);
  }

  for (let i = 0; i < headerRow.length; i++) {
    const h = normalizeHeaderName(headerRow[i]);
    if ((h === 'target' || h === 'target kri' || h === 'kri target') &&
        i > (COL_KRI_NAME > 0 ? COL_KRI_NAME : 0) && COL_KRI_TARGET === -1) COL_KRI_TARGET = i;
    if ((h === 'actual' || h === 'actual kri' || h === 'kri actual') &&
        i > (COL_KRI_NAME > 0 ? COL_KRI_NAME : 0) && COL_KRI_ACTUAL === -1) COL_KRI_ACTUAL = i;
  }

  // ── Detect period (month/week) columns ───────────────────────────────────
  const weeks = detectPeriodColumns(headerRow);

  // ── Count totals ─────────────────────────────────────────────────────────
  // Total Risks = risk title rows. Prefer the detected ID/# column if present,
  // otherwise count unique non-empty risk titles.
  const riskTitleSetForCount = new Set<string>();
  let totalRisks = 0;
  rows.slice(dataStartRow).forEach(rawRow => {
    const row = rawRow as unknown[];
    const title = COL_RISK_TITLE >= 0 ? safeStr(row[COL_RISK_TITLE]) : '';
    if (!title) return;
    const idValue = COL_ID >= 0 ? row[COL_ID] : row[0];
    if (COL_ID >= 0 || isNumericCell(idValue)) {
      if (isNumericCell(idValue) && Number(idValue) > 0) totalRisks += 1;
      else if (COL_ID < 0) riskTitleSetForCount.add(title);
    } else {
      riskTitleSetForCount.add(title);
    }
  });
  if (totalRisks === 0) totalRisks = riskTitleSetForCount.size;

  // Total Mitigation = rows where Action Weight column has a valid decimal
  const totalMitigation = COL_ACTION_WEIGHT >= 0
    ? rows.slice(dataStartRow).filter(row => {
        const v = (row as unknown[])[COL_ACTION_WEIGHT];
        return v !== null && v !== undefined && !isNaN(Number(v)) && Number(v) > 0;
      }).length
    : 0;

  // ── Detect latest residual score column ─────────────────────────────────
  // The residual block grows: "Residual Score Dec-2025", "Residual Score Jan-2026", …
  // We want the LAST (most recent) residual score column.
  let COL_RESIDUAL_SCORE = -1;
  for (let i = headerRow.length - 1; i >= 0; i--) {
    const h = safeStr(headerRow[i]).toLowerCase();
    if (h.includes('residual') && h.includes('score')) {
      COL_RESIDUAL_SCORE = i;
      break;
    }
  }

  // ── Build per-risk data ───────────────────────────────────────────────────
  const weekProgressMap: Record<string, Record<string, number>> = {};
  const mitigationMap: Record<string, string[]> = {};
  const ownerMap: Record<string, string> = {};
  const scoreMap: Record<string, number> = {};
  const ratingMap: Record<string, string> = {};
  const identificationDateMap: Record<string, string> = {};
  const closingDateMap: Record<string, string> = {};
  const progressStatusMap: Record<string, string> = {};
  const aboveTargetMap: Record<string, boolean | null> = {};
  const belowTargetMap: Record<string, boolean | null> = {};
  const likelihoodMap: Record<string, number> = {};
  const impactMap: Record<string, number> = {};
  const residualScoreMap: Record<string, number> = {};
  const tScoreMap: Record<string, number> = {};
  const categoryMap: Record<string, string> = {};
  const subCategoryMap: Record<string, string> = {};
  const riskTypeMap: Record<string, string> = {};
  const kriNameMap: Record<string, string> = {};
  const kriMeasureMap: Record<string, string> = {};
  const kriUnitMap: Record<string, string> = {};
  const kriTargetMap: Record<string, number> = {};
  const kriActualMap: Record<string, number> = {};

  const sourceIdentificationValues = new Set<string>();
  const sourceRatingValues = new Set<string>();
  const sourceOwnerValues = new Set<string>();
  const sourceProgressStatusValues = new Set<string>();
  const sourceClosingDateValues = new Set<string>();
  const sourceCategoryValues = new Set<string>();
  const sourceRiskTypeValues = new Set<string>();

  let currentRisk = '';

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];

    // Identify risk rows. If an ID/# column exists, use it. If not, any
    // non-empty risk-title row is accepted so files without serial numbers work.
    const titleVal = COL_RISK_TITLE >= 0 ? safeStr(row[COL_RISK_TITLE]) : '';
    const idValue = COL_ID >= 0 ? row[COL_ID] : row[0];
    const isRiskTitleRow = titleVal !== '' && (
      COL_ID < 0 ||
      (isNumericCell(idValue) && Number(idValue) > 0) ||
      safeStr(idValue) !== ''
    );

    if (isRiskTitleRow) {
      currentRisk = titleVal;
      weekProgressMap[currentRisk] = {};

      // Read progress from the title row's period columns
      for (const w of weeks) {
        const val = row[w.colIndex];
        weekProgressMap[currentRisk][w.label] =
          (val !== null && val !== undefined && !String(val).startsWith('#'))
            ? safeNum(val)
            : 0;
      }

      // Store metadata
      const ownerValue = COL_OWNER >= 0 ? safeStr(row[COL_OWNER]) : '';
      const ratingValue = COL_RATING >= 0 ? (safeStr(row[COL_RATING]) || deriveRating(safeNum(row[COL_SCORE]))) : deriveRating(safeNum(row[COL_SCORE]));
      const identificationValue = COL_IDENTIFICATION_DATE >= 0 ? normalizeQuarterValue(row[COL_IDENTIFICATION_DATE]) : '';
      const closingValue = COL_CLOSING_DATE >= 0 ? formatDateForDisplay(row[COL_CLOSING_DATE]) : '';
      const progressStatusValue = COL_PROGRESS_STATUS >= 0 ? safeStr(row[COL_PROGRESS_STATUS]) : '';
      const categoryValue = COL_CATEGORY >= 0 ? safeStr(row[COL_CATEGORY]) : '';
      const riskTypeValue = COL_RISK_TYPE >= 0 ? safeStr(row[COL_RISK_TYPE]) : '';

      ownerMap[currentRisk]        = ownerValue;
      scoreMap[currentRisk]        = COL_SCORE >= 0          ? safeNum(row[COL_SCORE])        : 0;
      ratingMap[currentRisk]       = ratingValue;
      identificationDateMap[currentRisk] = identificationValue;
      closingDateMap[currentRisk]  = closingValue;
      progressStatusMap[currentRisk] = progressStatusValue;
      aboveTargetMap[currentRisk]  = COL_ABOVE_TARGET >= 0   ? markerToBool(row[COL_ABOVE_TARGET], 'above target') : null;
      belowTargetMap[currentRisk]  = COL_BELOW_TARGET >= 0   ? markerToBool(row[COL_BELOW_TARGET], 'below target') : null;
      likelihoodMap[currentRisk]   = COL_LIKELIHOOD >= 0     ? safeNum(row[COL_LIKELIHOOD])   : 0;
      impactMap[currentRisk]       = COL_IMPACT >= 0         ? safeNum(row[COL_IMPACT])       : 0;
      residualScoreMap[currentRisk]= COL_RESIDUAL_SCORE >= 0 ? safeNum(row[COL_RESIDUAL_SCORE]) : 0;
      tScoreMap[currentRisk]       = COL_T_SCORE >= 0        ? safeNum(row[COL_T_SCORE])       : 0;
      categoryMap[currentRisk]     = categoryValue;
      subCategoryMap[currentRisk]  = COL_SUB_CATEGORY >= 0   ? safeStr(row[COL_SUB_CATEGORY])  : '';
      riskTypeMap[currentRisk]     = riskTypeValue;
      kriNameMap[currentRisk]      = COL_KRI_NAME >= 0       ? safeStr(row[COL_KRI_NAME])      : '';

      if (identificationValue) sourceIdentificationValues.add(identificationValue);
      if (ratingValue) sourceRatingValues.add(ratingValue);
      if (ownerValue) sourceOwnerValues.add(ownerValue);
      if (progressStatusValue) sourceProgressStatusValues.add(progressStatusValue);
      if (closingValue) sourceClosingDateValues.add(closingValue);
      if (categoryValue) sourceCategoryValues.add(categoryValue);
      if (riskTypeValue) sourceRiskTypeValues.add(riskTypeValue);
      kriMeasureMap[currentRisk]   = COL_KRI_MEASURE >= 0    ? safeStr(row[COL_KRI_MEASURE])   : '';
      kriUnitMap[currentRisk]      = COL_KRI_UNIT >= 0       ? safeStr(row[COL_KRI_UNIT])      : '';
      kriTargetMap[currentRisk]    = COL_KRI_TARGET >= 0     ? safeNum(row[COL_KRI_TARGET])    : 0;
      kriActualMap[currentRisk]    = COL_KRI_ACTUAL >= 0     ? safeNum(row[COL_KRI_ACTUAL])    : 0;
    }

    if (!currentRisk) continue;

    // Collect action text from either title rows or action sub-rows.
    if (COL_ACTION >= 0) {
      const action = safeStr(row[COL_ACTION]);
      if (action) {
        if (!mitigationMap[currentRisk]) mitigationMap[currentRisk] = [];
        if (!mitigationMap[currentRisk].includes(action)) mitigationMap[currentRisk].push(action);
      }
    }
  }

  // ── Determine selected (current) and previous period ─────────────────────
  const selectedWeek  = weeks.length > 0 ? weeks[weeks.length - 1].label : 'Current';
  const selectedWeekIdx = weeks.findIndex(w => w.label === selectedWeek);
  const prevWeekLabel = selectedWeekIdx > 0
    ? weeks[selectedWeekIdx - 1].label
    : (weeks.length > 1 ? weeks[weeks.length - 2].label : selectedWeek);

  // ── Build risk register ───────────────────────────────────────────────────
  const riskRegister: RiskRow[] = Object.keys(weekProgressMap).map((title, idx) => {
    const score  = scoreMap[title]  ?? 0;
    const rating = ratingMap[title] ?? deriveRating(score);
    const owner  = ownerMap[title]  ?? '';
    const weekProgress = weekProgressMap[title] || {};

    const curVal  = weekProgress[selectedWeek]  ?? 0;
    const prevVal = weekProgress[prevWeekLabel] ?? curVal;

    const currentPct     = pct(curVal);
    const beforePct      = pct(prevVal);
    const developmentPct = Math.round((curVal - prevVal) * 100);
    const sheetAboveFlag = aboveTargetMap[title];
    const sheetBelowFlag = belowTargetMap[title];
    const aboveFlag      = sheetAboveFlag !== null && sheetAboveFlag !== undefined ? sheetAboveFlag : currentPct >= 100;
    const belowFlag      = sheetBelowFlag !== null && sheetBelowFlag !== undefined ? sheetBelowFlag : (currentPct < 100 && !aboveFlag);

    // Progress status: prefer reading from the sheet if column exists,
    // otherwise derive from currentPct
    const progressStatus = progressStatusMap[title] || deriveProgressStatus(currentPct);

    return {
      id: `risk-${idx}`,
      title,
      owner,
      score,
      rating,
      identificationDate: identificationDateMap[title] ?? '',
      closingDate: closingDateMap[title] ?? '',
      progressStatus,
      mitigation: (mitigationMap[title] || []).join('\n'),
      weekProgress,
      currentPct,
      beforePct,
      developmentPct,
      aboveTarget: aboveFlag,
      belowTarget: belowFlag,
      likelihood: likelihoodMap[title] ?? 0,
      impact: impactMap[title] ?? 0,
      residualScore: residualScoreMap[title] ?? 0,
      tScore: tScoreMap[title] ?? 0,
      category: categoryMap[title] ?? '',
      subCategory: subCategoryMap[title] ?? '',
      riskType: riskTypeMap[title] ?? '',
      kriName: kriNameMap[title] ?? '',
      kriMeasure: kriMeasureMap[title] ?? '',
      kriUnit: kriUnitMap[title] ?? '',
      kriTarget: kriTargetMap[title] ?? 0,
      kriActual: kriActualMap[title] ?? 0,
      isOverdue: false, // computed below after riskRegister is built
    };
  });

  // ── Aggregate KPIs ────────────────────────────────────────────────────────
  const finalTotalRisks  = riskRegister.length || totalRisks;
  const finalZoneCounts  = computeZoneCountsFromRisks(riskRegister);
  const scoreValues      = riskRegister.map(r => r.score).filter(s => s > 0);
  const avgRiskScore     = scoreValues.length > 0
    ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10) / 10
    : 0;
  const avgRiskRating    = deriveRating(avgRiskScore);
  const finalAboveTarget = riskRegister.filter(r => r.aboveTarget).length;
  const finalBelowTarget = riskRegister.filter(r => r.belowTarget).length;
  const riskSummary      = buildRiskSummary(finalAboveTarget, finalBelowTarget);
  const progressCounts   = {
    completed:  riskRegister.filter(r => r.currentPct >= 100).length,
    inProgress: riskRegister.filter(r => r.currentPct > 0 && r.currentPct < 100).length,
    notStarted: riskRegister.filter(r => r.currentPct === 0).length,
  };

  const selectedRisk = riskRegister.find(r => r.rating === 'Very High') || riskRegister[0] || null;

  // ── Residual aggregates ───────────────────────────────────────────────────
  const residualScores = riskRegister.map(r => r.residualScore).filter(s => s > 0);
  const avgResidualScore = residualScores.length > 0
    ? Math.round((residualScores.reduce((a, b) => a + b, 0) / residualScores.length) * 10) / 10
    : 0;
  const residualZoneCounts = {
    veryHigh: riskRegister.filter(r => r.residualScore >= 20).length,
    high:     riskRegister.filter(r => r.residualScore >= 15 && r.residualScore < 20).length,
    moderate: riskRegister.filter(r => r.residualScore >= 9  && r.residualScore < 15).length,
    low:      riskRegister.filter(r => r.residualScore >= 5  && r.residualScore < 9).length,
    veryLow:  riskRegister.filter(r => r.residualScore > 0   && r.residualScore < 5).length,
  };

  // ── Overdue detection ────────────────────────────────────────────────────
  // A quarter label like "Q1 2026" is overdue if it is before the current quarter.
  // A real date string is overdue if it is before today.
  // We also mark isOverdue on each RiskRow.
  const currentDate = new Date();
  function isClosingDateOverdue(cd: string, pct: number): boolean {
    if (pct >= 100) return false; // completed
    if (!cd) return false;
    const qMatch = cd.match(/Q(\d)\s*(\d{4})/);
    if (qMatch) {
      const q = parseInt(qMatch[1]);
      const y = parseInt(qMatch[2]);
      const qEndMonth = q * 3; // Q1→3, Q2→6, Q3→9, Q4→12
      const qEndDate = new Date(y, qEndMonth, 1); // first day after quarter ends
      return qEndDate <= currentDate;
    }
    // Try parsing as a real date in dashboard display format dd/mm/yyyy
    const displayDate = formatDateForDisplay(cd);
    const dmy = displayDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 23, 59, 59);
      return d < currentDate;
    }
    const d = new Date(cd);
    if (!isNaN(d.getTime())) return d < currentDate;
    return false;
  }

  // Mark isOverdue on each risk
  riskRegister.forEach(r => {
    r.isOverdue = isClosingDateOverdue(r.closingDate, r.currentPct);
  });

  const overdueItems = riskRegister
    .filter(r => r.isOverdue)
    .map(r => ({
      riskTitle: r.title,
      closingDate: r.closingDate,
      progressStatus: r.progressStatus,
      currentPct: r.currentPct,
      owner: r.owner,
    }));

  // ── KRI aggregation ───────────────────────────────────────────────────────
  function kriStatus(target: number, actual: number, unit: string): 'on-track' | 'at-risk' | 'breached' {
    if (target === 0) return 'on-track';
    // For % units (0-1 range), compare directly; for count units compare as numbers
    const ratio = actual / target;
    if (ratio <= 1.0) return 'on-track';
    if (ratio <= 1.3) return 'at-risk';
    return 'breached';
  }

  const kriItems = riskRegister
    .filter(r => r.kriName)
    .map(r => ({
      riskTitle: r.title,
      kriName: r.kriName,
      kriMeasure: r.kriMeasure,
      kriUnit: r.kriUnit,
      kriTarget: r.kriTarget,
      kriActual: r.kriActual,
      status: kriStatus(r.kriTarget, r.kriActual, r.kriUnit),
    }));

  // ── Taxonomy aggregation ─────────────────────────────────────────────────
  const catMap = new Map<string, Map<string, number>>();
  riskRegister.forEach(r => {
    const cat = r.category || 'Uncategorised';
    const sub = r.subCategory || 'Other';
    if (!catMap.has(cat)) catMap.set(cat, new Map());
    const subMap = catMap.get(cat)!;
    subMap.set(sub, (subMap.get(sub) ?? 0) + 1);
  });
  const categories = Array.from(catMap.entries())
    .map(([name, subMap]) => ({
      name,
      count: Array.from(subMap.values()).reduce((a, b) => a + b, 0),
      subCategories: Array.from(subMap.entries()).map(([sn, sc]) => ({ name: sn, count: sc })),
    }))
    .sort((a, b) => b.count - a.count);

  const riskTypeCount = new Map<string, number>();
  riskRegister.forEach(r => {
    const t = r.riskType || 'Unknown';
    riskTypeCount.set(t, (riskTypeCount.get(t) ?? 0) + 1);
  });
  const riskTypes = Array.from(riskTypeCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // ── Velocity (Inherent → Residual → Target) ───────────────────────────────
  const velocityItems = riskRegister
    .filter(r => r.score > 0)
    .map(r => ({
      title: r.title,
      inherent: r.score,
      residual: r.residualScore,
      target: r.tScore,
      gap: r.residualScore - r.tScore,  // positive = still above target
      rating: r.rating,
    }))
    .sort((a, b) => b.inherent - a.inherent);

  const velScores = velocityItems.filter(v => v.inherent > 0);
  const avgVelInherent = velScores.length > 0 ? Math.round(velScores.reduce((a, b) => a + b.inherent, 0) / velScores.length * 10) / 10 : 0;
  const avgVelResidual = velScores.length > 0 ? Math.round(velScores.reduce((a, b) => a + b.residual, 0) / velScores.length * 10) / 10 : 0;
  const avgVelTarget   = velScores.length > 0 ? Math.round(velScores.filter(v => v.target > 0).reduce((a, b) => a + b.target, 0) / (velScores.filter(v => v.target > 0).length || 1) * 10) / 10 : 0;

  return {
    period: selectedWeek,
    weeks,
    selectedWeek,
    prevWeekLabel,
    kpis: {
      totalRisks: finalTotalRisks,
      totalMitigation,
      aboveTarget: finalAboveTarget,
      belowTarget: finalBelowTarget,
      avgRiskScore,
      avgRiskRating,
    },
    zoneCounts: finalZoneCounts,
    progressCounts,
    riskSummary,
    riskRegister,
    selectedRisk,
    filterOptions: {
      identificationDates: sortQuarterValues(Array.from(sourceIdentificationValues)),
      ratings: Array.from(sourceRatingValues),
      owners: Array.from(sourceOwnerValues).sort(),
      progressStatuses: Array.from(sourceProgressStatusValues).sort(),
      closingDates: Array.from(sourceClosingDateValues).sort(),
      categories: Array.from(sourceCategoryValues).sort(),
      riskTypes: Array.from(sourceRiskTypeValues).sort(),
    },
    residualData: {
      zoneCounts: residualZoneCounts,
      avgResidualScore,
      avgInherentScore: avgRiskScore,
    },
    overdueActions: {
      count: overdueItems.length,
      items: overdueItems,
    },
    kriData: {
      items: kriItems,
    },
    taxonomyData: {
      categories,
      riskTypes,
    },
    velocityData: {
      items: velocityItems,
      avgInherent: avgVelInherent,
      avgResidual: avgVelResidual,
      avgTarget: avgVelTarget,
    },
  };
}

// ── Week switcher ─────────────────────────────────────────────────────────────

export function switchWeek(data: DashboardData, newWeek: string): DashboardData {
  const weekIdx  = data.weeks.findIndex(w => w.label === newWeek);
  const prevIdx  = weekIdx > 0 ? weekIdx - 1 : -1;
  const prevWeek = prevIdx >= 0 ? data.weeks[prevIdx].label : newWeek;

  const riskRegister = data.riskRegister.map(risk => {
    const curVal  = risk.weekProgress[newWeek]  ?? risk.currentPct / 100;
    const prevVal = risk.weekProgress[prevWeek] ?? curVal;

    const currentPct     = pct(curVal);
    const beforePct      = pct(prevVal);
    const developmentPct = Math.round((curVal - prevVal) * 100);
    const aboveTarget    = currentPct >= 100;
    const belowTarget    = currentPct < 100 && curVal < prevVal;

    return {
      ...risk,
      currentPct,
      beforePct,
      developmentPct,
      aboveTarget,
      belowTarget,
      progressStatus: deriveProgressStatus(currentPct),
    };
  });

  const completed   = riskRegister.filter(r => r.currentPct >= 100).length;
  const inProgress  = riskRegister.filter(r => r.currentPct > 0 && r.currentPct < 100).length;
  const notStarted  = riskRegister.filter(r => r.currentPct === 0).length;

  const totalRisks  = Number(data.kpis.totalRisks) || 0;
  const aboveCount  = Math.min(totalRisks, riskRegister.filter(r => r.aboveTarget).length);
  const belowCount  = Math.max(totalRisks - aboveCount, 0);
  const riskSummary = buildRiskSummary(aboveCount, belowCount);

  const selectedRisk = riskRegister.find(r => r.rating === 'Very High') || riskRegister[0] || null;

  return {
    ...data,
    period: newWeek,
    selectedWeek: newWeek,
    prevWeekLabel: prevWeek,
    kpis: {
      ...data.kpis,
      totalRisks,
      aboveTarget: aboveCount,
      belowTarget: belowCount,
    },
    zoneCounts: data.zoneCounts,
    progressCounts: { completed, inProgress, notStarted },
    riskSummary,
    riskRegister,
    selectedRisk,
  };
}
