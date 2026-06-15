/**
 * Risk Register Excel Parser — Flexible Schema (v3)
 *
 * ── Design Principles ────────────────────────────────────────────────────────
 * 1. NO hardcoded column indices. Every field is located by scanning the header
 *    row for its exact name (case-insensitive, trimmed). This means the parser
 *    survives any number of new columns being inserted anywhere in the sheet.
 *
 * 2. ANY sheet name is accepted. The parser uses the first sheet in the workbook,
 *    regardless of what it is called.
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
  mitigationTargetsByWeek?: Record<string, { aboveTarget: number; belowTarget: number }>;
  residualData: {
    zoneCounts: { veryHigh: number; high: number; moderate: number; low: number; veryLow: number };
    avgResidualScore: number;
    avgInherentScore: number;
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
function buildColMap(headerRow: unknown[]): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const v = headerRow[i];
    if (v === null || v === undefined) continue;
    // Skip datetime objects — those are period columns, not named anchors
    if (v instanceof Date) continue;
    const key = String(v).trim().toLowerCase().replace(/\s+/g, ' ');
    if (key && !map.has(key)) map.set(key, i);
  }
  return map;
}

/**
 * Look up a column index by trying a list of candidate names (first match wins).
 * Returns -1 if none found.
 */
function findCol(colMap: Map<string, number>, ...candidates: string[]): number {
  for (const name of candidates) {
    const key = name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (colMap.has(key)) return colMap.get(key)!;
  }
  return -1;
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

  // Accept ANY sheet name — use the first sheet
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook contains no sheets.');
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null }) as unknown[][];

  if (rows.length < 2) throw new Error('Sheet appears to be empty.');

  // ── Find the header row ──────────────────────────────────────────────────
  // The header row is the first row that contains "Risk Title" (case-insensitive).
  // Typically row 0 (idx 0), but we scan the first 5 rows to be safe.
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const rowStr = rows[r].map(v => safeStr(v).toLowerCase());
    if (rowStr.some(s => s === 'risk title' || s.includes('risk title'))) {
      headerRowIdx = r;
      break;
    }
  }

  const headerRow = rows[headerRowIdx] as unknown[];
  const dataStartRow = headerRowIdx + 1;

  // ── Build column map (named anchors) ─────────────────────────────────────
  const colMap = buildColMap(headerRow);

  // Locate every anchor field by name
  const COL_RISK_TITLE   = findCol(colMap, 'risk title');
  const COL_OWNER        = findCol(colMap, 'owner');
  const COL_LIKELIHOOD   = findCol(colMap, 'i-likelihood', 'likelihood');
  const COL_IMPACT       = findCol(colMap, 'i-impact', 'impact');
  const COL_SCORE        = findCol(colMap, 'i-score', 'risk score', 'score');
  const COL_RATING       = findCol(colMap, 'rating', 'risk rating');
  const COL_ACTION       = findCol(colMap, 'action');
  const COL_ACTION_WEIGHT = findCol(colMap, 'action weight');
  const COL_CLOSING_DATE = findCol(colMap, 'closing date');
  const COL_PROGRESS_STATUS = findCol(colMap, 'progress status');

  // ── Detect period (month/week) columns ───────────────────────────────────
  const weeks = detectPeriodColumns(headerRow);

  // ── Count totals ─────────────────────────────────────────────────────────
  // Total Risks = rows where col A (idx 0) is a positive integer (risk number)
  const totalRisks = rows.slice(dataStartRow).filter(row =>
    isNumericCell((row as unknown[])[0]) && Number((row as unknown[])[0]) > 0
  ).length;

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
  const closingDateMap: Record<string, string> = {};
  const likelihoodMap: Record<string, number> = {};
  const impactMap: Record<string, number> = {};
  const residualScoreMap: Record<string, number> = {};

  let currentRisk = '';

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i] as unknown[];

    // Identify title rows: col A (idx 0) is a positive integer AND Risk Title col is non-empty
    const titleVal = COL_RISK_TITLE >= 0 ? safeStr(row[COL_RISK_TITLE]) : '';
    const isRiskTitleRow = titleVal !== '' && isNumericCell(row[0]) && Number(row[0]) > 0;

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
      ownerMap[currentRisk]        = COL_OWNER >= 0          ? safeStr(row[COL_OWNER])       : '';
      scoreMap[currentRisk]        = COL_SCORE >= 0          ? safeNum(row[COL_SCORE])        : 0;
      ratingMap[currentRisk]       = COL_RATING >= 0         ? (safeStr(row[COL_RATING]) || deriveRating(safeNum(row[COL_SCORE]))) : deriveRating(safeNum(row[COL_SCORE]));
      closingDateMap[currentRisk]  = COL_CLOSING_DATE >= 0   ? safeStr(row[COL_CLOSING_DATE]) : '';
      likelihoodMap[currentRisk]   = COL_LIKELIHOOD >= 0     ? safeNum(row[COL_LIKELIHOOD])   : 0;
      impactMap[currentRisk]       = COL_IMPACT >= 0         ? safeNum(row[COL_IMPACT])       : 0;
      residualScoreMap[currentRisk]= COL_RESIDUAL_SCORE >= 0 ? safeNum(row[COL_RESIDUAL_SCORE]) : 0;
    }

    if (!currentRisk) continue;

    // Collect action text from action sub-rows
    if (COL_ACTION >= 0) {
      const action = safeStr(row[COL_ACTION]);
      // Only collect if this row is NOT a title row (avoid duplicating the title row's action if any)
      if (action && !isRiskTitleRow) {
        if (!mitigationMap[currentRisk]) mitigationMap[currentRisk] = [];
        mitigationMap[currentRisk].push(action);
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
    const aboveFlag      = currentPct >= 100;
    const belowFlag      = currentPct < 100 && curVal <= prevVal;

    // Progress status: prefer reading from the sheet if column exists,
    // otherwise derive from currentPct
    const progressStatus = deriveProgressStatus(currentPct);

    return {
      id: `risk-${idx}`,
      title,
      owner,
      score,
      rating,
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
    residualData: {
      zoneCounts: residualZoneCounts,
      avgResidualScore,
      avgInherentScore: avgRiskScore,
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

// ── Sample data (static fallback for demo / first load) ──────────────────────
export function getSampleData(): DashboardData {
  const weeks: WeekData[] = [
    { label: 'Jan-2026', colIndex: 35 },
    { label: 'Feb-2026', colIndex: 36 },
    { label: 'Mar-2026', colIndex: 37 },
    { label: 'Apr-2026', colIndex: 38 },
  ];

  const sampleRisks: RiskRow[] = [
    {
      id: '1', title: 'Data Quality and Reporting Risk',
      owner: 'Maya Stone', score: 12, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Implement monitoring report and review cycle.\n2. Perform field inspection and close corrective actions.',
      weekProgress: { 'Jan-2026': 0.42, 'Feb-2026': 0.45, 'Mar-2026': 0.51, 'Apr-2026': 0.50 },
      currentPct: 50, beforePct: 51, developmentPct: -1, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 3, residualScore: 6,
    },
    {
      id: '2', title: 'Documentation Accuracy Risk',
      owner: 'Nora Adams', score: 9, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Coordinate with supplier and agree delivery schedule.\n2. Automate weekly KPI report.',
      weekProgress: { 'Jan-2026': 0.00, 'Feb-2026': 0.01, 'Mar-2026': 0.02, 'Apr-2026': 0.02 },
      currentPct: 2, beforePct: 2, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 3, residualScore: 4,
    },
    {
      id: '3', title: 'Access Control Compliance Risk',
      owner: 'Hana Blake', score: 20, rating: 'Very High',
      closingDate: 'Q1 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Enforce MFA on all critical systems.\n2. Conduct quarterly access reviews.',
      weekProgress: { 'Jan-2026': 0.30, 'Feb-2026': 0.28, 'Mar-2026': 0.38, 'Apr-2026': 0.38 },
      currentPct: 38, beforePct: 38, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 4, residualScore: 12,
    },
    {
      id: '4', title: 'Incident Response Delay Risk',
      owner: 'Lina Brooks', score: 1, rating: 'Very Low',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Define SLA for incident response.\n2. Automate escalation workflows.',
      weekProgress: { 'Jan-2026': 0.00, 'Feb-2026': 0.00, 'Mar-2026': 0.00, 'Apr-2026': 0.02 },
      currentPct: 2, beforePct: 0, developmentPct: 2, aboveTarget: false, belowTarget: true, likelihood: 1, impact: 1, residualScore: 1,
    },
    {
      id: '5', title: 'Inventory Shortage Risk',
      owner: 'Nora Adams', score: 16, rating: 'High',
      closingDate: 'Q2 2026', progressStatus: 'Completed (100%)',
      mitigation: '1. Establish safety stock levels.\n2. Diversify supplier base.',
      weekProgress: { 'Jan-2026': 0.94, 'Feb-2026': 0.94, 'Mar-2026': 0.93, 'Apr-2026': 1.00 },
      currentPct: 100, beforePct: 93, developmentPct: 7, aboveTarget: true, belowTarget: false, likelihood: 4, impact: 4, residualScore: 9,
    },
    {
      id: '6', title: 'Service Desk Workload Risk',
      owner: 'Omar Reed', score: 12, rating: 'Moderate',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Hire additional service desk agents.\n2. Implement self-service portal.',
      weekProgress: { 'Jan-2026': 0.59, 'Feb-2026': 0.57, 'Mar-2026': 0.54, 'Apr-2026': 0.64 },
      currentPct: 64, beforePct: 54, developmentPct: 10, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 3, residualScore: 9,
    },
    {
      id: '7', title: 'Contract Renewal Delay Risk',
      owner: 'Samir Hale', score: 9, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Set 90-day renewal reminders.\n2. Assign contract manager per vendor.',
      weekProgress: { 'Jan-2026': 0.60, 'Feb-2026': 0.59, 'Mar-2026': 0.56, 'Apr-2026': 0.60 },
      currentPct: 60, beforePct: 56, developmentPct: 4, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 3, residualScore: 6,
    },
    {
      id: '8', title: 'Backup Power Availability Risk',
      owner: 'Samir Hale', score: 20, rating: 'Very High',
      closingDate: 'Q3 2026', progressStatus: 'Not Started (0%)',
      mitigation: '1. Install UPS at critical sites.\n2. Test generator failover monthly.',
      weekProgress: { 'Jan-2026': 0.01, 'Feb-2026': 0.00, 'Mar-2026': 0.00, 'Apr-2026': 0.00 },
      currentPct: 0, beforePct: 0, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 4, residualScore: 12,
    },
    {
      id: '9', title: 'Supplier Delivery Delay Risk',
      owner: 'Hana Blake', score: 16, rating: 'High',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Add penalty clauses for late delivery.\n2. Identify backup suppliers.',
      weekProgress: { 'Jan-2026': 0.38, 'Feb-2026': 0.28, 'Mar-2026': 0.40, 'Apr-2026': 0.34 },
      currentPct: 34, beforePct: 40, developmentPct: -6, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 4, residualScore: 12,
    },
    {
      id: '10', title: 'Network Capacity Saturation Risk',
      owner: 'Nora Adams', score: 25, rating: 'Very High',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Upgrade core network capacity.\n2. Implement traffic shaping policies.',
      weekProgress: { 'Jan-2026': 0.30, 'Feb-2026': 0.17, 'Mar-2026': 0.29, 'Apr-2026': 0.19 },
      currentPct: 19, beforePct: 29, developmentPct: -10, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 5, residualScore: 16,
    },
  ];

  return {
    period: 'Apr-2026',
    weeks,
    selectedWeek: 'Apr-2026',
    prevWeekLabel: 'Mar-2026',
    kpis: { totalRisks: 10, totalMitigation: 20, aboveTarget: 2, belowTarget: 8, avgRiskScore: 14, avgRiskRating: 'High' },
    zoneCounts: { veryHigh: 3, high: 2, moderate: 3, low: 0, veryLow: 2 },
    progressCounts: { completed: 1, inProgress: 8, notStarted: 1 },
    riskSummary: [
      { name: 'Above Target', value: 2, color: '#27AE60' },
      { name: 'Below Target', value: 8, color: '#C0392B' },
    ],
    riskRegister: sampleRisks,
    selectedRisk: sampleRisks[2],
    residualData: {
      zoneCounts: { veryHigh: 0, high: 2, moderate: 3, low: 3, veryLow: 2 },
      avgResidualScore: 8.7,
      avgInherentScore: 14,
    },
  };
}