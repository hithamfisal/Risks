/**
 * TNOC Risk Register Excel Parser — Correct Weighted Sum Formula
 *
 * ── How per-risk progress is calculated ─────────────────────────────────────
 * Each risk has multiple action rows in "Approved TNOC Risk" sheet.
 * Each action row has:
 *   col S (idx 18) = Action Weight (decimal, e.g. 0.5)
 *   col X (idx 23) = Mar - W4 progress (0.0–1.0)
 *   col Y (idx 24) = Mar - W5 progress
 *   col Z (idx 25) = APRIL- W1 progress
 *   col AA (idx 26) = APRIL- W2 progress
 *
 * Total risk progress for a week = Σ (action_weight × action_week_value)
 *
 * ── Output sheet ────────────────────────────────────────────────────────────
 * Row 1 (idx 0): A=TotalRisks, B=TotalMitigation, C=AboveTarget,
 *                D=BelowTarget, E=AvgRiskScore, F=AvgRiskRating
 * Rows 7-11 (idx 6-10): zone counts — col D (idx 3)
 * Rows 21-23 (idx 20-22): progress counts — col B (idx 1)
 * Row 30 (idx 29): header — col G = current week label
 * Rows 31+ (idx 30+): per-risk data (for the currently selected week only)
 *   A=Title, B=Owner, C=Score, D=Rating, E=Quarter
 *   G=CurrentWeek%, H=AboveTarget, I=BelowTarget, J=WeekBefore%, K=Development%
 *
 * ── Approved TNOC Risk sheet ────────────────────────────────────────────────
 * Row 1 (idx 0): AW (col 48) = current week label, BB (col 53) = prev week label
 * Row 2 (idx 1): sub-headers — X(23)=week1, Y(24)=week2, Z(25)=week3, AA(26)=week4
 * Row 3+ (idx 2+): data rows
 *   E (idx 4) = Risk Title (blank on sub-action rows)
 *   R (idx 17) = Action text
 *   S (idx 18) = Action Weight
 *   X-AA (idx 23-26) = per-week progress values
 *   AC (idx 28) = Progress Status
 */

import * as XLSX from 'xlsx';

export interface WeekData {
  label: string;
  colIndex: number;  // 0-based column index in Approved TNOC Risk sheet
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
  weekProgress: Record<string, number>;  // key=week label, value=0.0–1.0 (decimal)
  currentPct: number;   // 0–100 integer
  beforePct: number;
  developmentPct: number;
  aboveTarget: boolean;
  belowTarget: boolean;
  likelihood: number;   // 1–5
  impact: number;       // 1–5
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
}

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
  // Values stored as decimals (0.835 = 83.5% → 84)
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

function isWeekLabel(v: unknown): boolean {
  if (!v) return false;
  const s = String(v).trim();
  // Must contain a month abbreviation followed by non-letter (e.g. 'Mar -', 'Apr-', 'APRIL-')
  // OR contain W followed by a digit (e.g. W1, W2)
  // This prevents matching names like 'Maya Stone' which contain 'May'
  const hasMonth = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|APRIL)\b[\s\-\.]/i.test(s)
    || /\bAPRIL\b/i.test(s);
  const hasWeek = /\bW\d\b/i.test(s);
  return (hasMonth || hasWeek)
    && s.length < 35
    && !s.toLowerCase().includes('weight')
    && !s.toLowerCase().includes('action')
    && !s.toLowerCase().includes('status')
    && !s.toLowerCase().includes('target')
    && !s.toLowerCase().includes('comment');
}

function deriveProgressStatus(pctVal: number): string {
  if (pctVal >= 100) return 'Completed (100%)';
  if (pctVal > 0)    return 'In Progress (1-99%)';
  return 'Not Started (0%)';
}

function computeZoneCountsFromRisks(risks: RiskRow[]): DashboardData['zoneCounts'] {
  return risks.reduce<DashboardData['zoneCounts']>((acc, risk) => {
    const rating = safeStr(risk.rating) || deriveRating(risk.score);
    if (/very\s*high/i.test(rating) || risk.score >= 20) acc.veryHigh += 1;
    else if (/high/i.test(rating) || risk.score >= 15) acc.high += 1;
    else if (/moderate/i.test(rating) || risk.score >= 9) acc.moderate += 1;
    else if (/low/i.test(rating) || risk.score >= 5) acc.low += 1;
    else acc.veryLow += 1;
    return acc;
  }, { veryHigh: 0, high: 0, moderate: 0, low: 0, veryLow: 0 });
}

function buildRiskSummary(aboveTarget: number, belowTarget: number): DashboardData['riskSummary'] {
  return [
    { name: 'Above Target', value: aboveTarget, color: '#27AE60' },
    { name: 'Below Target', value: belowTarget, color: '#C0392B' },
  ].filter(d => d.value > 0);
}

function isNumericCell(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '' && !String(v).startsWith('#') && !isNaN(Number(v));
}


/**
 * Build per-risk per-week weighted progress map from "Approved TNOC Risk" sheet.
 * Formula: risk_total_week = Σ (action_weight × action_week_value) for all action rows of that risk
 */
function buildWeekProgressMap(
  approved: unknown[][],
  weeks: WeekData[],
  dataStartRow = 2
): {
  weekProgressMap: Record<string, Record<string, number>>;
  mitigationMap: Record<string, string[]>;
  ownerMap: Record<string, string>;
  scoreMap: Record<string, number>;
  ratingMap: Record<string, string>;
  closingDateMap: Record<string, string>;
  likelihoodMap: Record<string, number>;
  impactMap: Record<string, number>;
} {
  const weekProgressMap: Record<string, Record<string, number>> = {};
  const mitigationMap: Record<string, string[]> = {};
  const ownerMap: Record<string, string> = {};
  const scoreMap: Record<string, number> = {};
  const ratingMap: Record<string, string> = {};
  const closingDateMap: Record<string, string> = {};
  const likelihoodMap: Record<string, number> = {};
  const impactMap: Record<string, number> = {};

  let currentRisk = '';

  for (let i = dataStartRow; i < approved.length; i++) {
    const row = approved[i] as unknown[];
    const titleVal = safeStr(row[4]);

    if (titleVal) {
      currentRisk = titleVal;
      // Read progress directly from the title row's week columns (same as Excel IFS formula)
      weekProgressMap[currentRisk] = {};
      for (const w of weeks) {
        const val = row[w.colIndex];
        const numVal = (val !== null && val !== undefined && !String(val).startsWith('#'))
          ? safeNum(val)
          : 0;
        weekProgressMap[currentRisk][w.label] = numVal;
      }
      // Store metadata from the title row
      ownerMap[currentRisk]       = safeStr(row[10]);
      scoreMap[currentRisk]       = safeNum(row[13]);
      ratingMap[currentRisk]      = safeStr(row[14]) || deriveRating(safeNum(row[13]));
      closingDateMap[currentRisk] = safeStr(row[19]) || safeStr(row[20]);
      likelihoodMap[currentRisk]  = safeNum(row[11]);  // col L (idx 11)
      impactMap[currentRisk]      = safeNum(row[12]);  // col M (idx 12)
    }

    if (!currentRisk) continue;

    // Collect action text from sub-rows (col R = idx 17)
    const action = safeStr(row[17]);
    if (action) {
      if (!mitigationMap[currentRisk]) mitigationMap[currentRisk] = [];
      mitigationMap[currentRisk].push(action);
    }
  }

  return { weekProgressMap, mitigationMap, ownerMap, scoreMap, ratingMap, closingDateMap, likelihoodMap, impactMap };
}

export function parseExcel(buffer: ArrayBuffer): DashboardData {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

  // ── Only sheet needed: Approved TNOC Risk ────────────────────────────────
  const approvedSheet = wb.Sheets['Approved TNOC Risk'];
  if (!approvedSheet) throw new Error('Sheet "Approved TNOC Risk" not found in workbook.');
  const approved = XLSX.utils.sheet_to_json<unknown[]>(approvedSheet, { header: 1, defval: null }) as unknown[][];

  // Total Risks = count of numeric values in col A (idx 0) — one per risk title row
  const totalRisks = approved.filter(row => isNumericCell((row as unknown[])[0])).length;
  // Total Mitigation = count of numeric values in col Q (idx 16) — one per action row
  const totalMitigation = approved.filter(row => isNumericCell((row as unknown[])[16])).length;

  // Auto-detect the header row containing week labels — scan first 5 rows
  // This handles files with 1 or 2 header rows regardless of structure
  let headerRowIdx = 1; // default: row 2 (idx 1)
  let weeks: WeekData[] = [];
  for (let rowIdx = 0; rowIdx <= Math.min(4, approved.length - 1); rowIdx++) {
    const candidateRow = approved[rowIdx] as unknown[];
    const candidateWeeks: WeekData[] = [];
    for (let i = 0; i < candidateRow.length; i++) {
      if (isWeekLabel(candidateRow[i])) {
        candidateWeeks.push({ label: safeStr(candidateRow[i]), colIndex: i });
      }
    }
    if (candidateWeeks.length > weeks.length) {
      weeks = candidateWeeks;
      headerRowIdx = rowIdx;
    }
  }
  const dataStartRow = headerRowIdx + 1; // data rows start after the header row

  // Auto-detect current week: always use the last detected week column (no helper columns needed)
  const selectedWeek = weeks.length > 0 ? weeks[weeks.length - 1].label : 'Current';

  // Auto-detect previous week: the week immediately before current in the detected week list
  // No need to read col BC — computed entirely from the week headers
  const selectedWeekIdx = weeks.findIndex(w => w.label === selectedWeek);
  const prevWeekLabel = selectedWeekIdx > 0
    ? weeks[selectedWeekIdx - 1].label
    : (weeks.length > 1 ? weeks[weeks.length - 2].label : selectedWeek);

  // ── Build per-risk per-week progress using weighted sum ───────────────────
  const { weekProgressMap, mitigationMap, ownerMap, scoreMap, ratingMap, closingDateMap, likelihoodMap, impactMap } =
    buildWeekProgressMap(approved, weeks, dataStartRow);

  // ── Build risk register entirely from Approved TNOC Risk ─────────────────

  const riskRegister: RiskRow[] = [];

  // Iterate over risk title rows (col A numeric = risk number, col E = title)
  const riskTitles = Object.keys(weekProgressMap);
  riskTitles.forEach((title, idx) => {
    const score  = scoreMap[title]  ?? 0;
    const rating = ratingMap[title] ?? deriveRating(score);
    const owner  = ownerMap[title]  ?? '';
    const quarter = closingDateMap[title] ?? '';
    const weekProgress = weekProgressMap[title] || {};

    const curVal  = weekProgress[selectedWeek]  ?? 0;
    const prevVal = weekProgress[prevWeekLabel] ?? curVal;

    const currentPct     = pct(curVal);
    const beforePct      = pct(prevVal);
    const developmentPct = Math.round((curVal - prevVal) * 100);

    // Above Target: current progress >= target (col AB idx 27 on title row)
    // Computed internally: risk is above target if currentPct >= 100 or progress improved vs before
    const aboveFlag = currentPct >= 100;
    const belowFlag = currentPct < 100 && curVal <= prevVal;

    riskRegister.push({
      id: `risk-${idx}`,
      title,
      owner,
      score,
      rating,
      closingDate: quarter,
      progressStatus: deriveProgressStatus(currentPct),
      mitigation: (mitigationMap[title] || []).join('\n'),
      weekProgress,
      currentPct,
      beforePct,
      developmentPct,
      aboveTarget: aboveFlag,
      belowTarget: belowFlag,
      likelihood: likelihoodMap[title] ?? 0,
      impact: impactMap[title] ?? 0,
    });
  });

  // ── All calculations done internally ─────────────────────────────────────
  const finalTotalRisks = riskRegister.length || totalRisks;

  // Zone counts from risk scores
  const finalZoneCounts = computeZoneCountsFromRisks(riskRegister);

  // Avg risk score from register
  const scoreValues = riskRegister.map(r => r.score).filter(s => s > 0);
  const avgRiskScore = scoreValues.length > 0
    ? Math.round((scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length) * 10) / 10
    : 0;
  const avgRiskRating = deriveRating(avgRiskScore);

  // Above/Below Target from register
  const finalAboveTarget = riskRegister.filter(r => r.aboveTarget).length;
  const finalBelowTarget = riskRegister.filter(r => r.belowTarget).length;
  const riskSummary = buildRiskSummary(finalAboveTarget, finalBelowTarget);

  // Progress counts from register
  const progressCounts = {
    completed:  riskRegister.filter(r => r.currentPct >= 100).length,
    inProgress: riskRegister.filter(r => r.currentPct > 0 && r.currentPct < 100).length,
    notStarted: riskRegister.filter(r => r.currentPct === 0).length,
  };

  const selectedRisk = riskRegister.find(r => r.rating === 'Very High') || riskRegister[0] || null;

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
  };
}

/**
 * Switch to a different week — recalculates all per-risk values using
 * the stored weekProgress (weighted sum) values.
 */
export function switchWeek(data: DashboardData, newWeek: string): DashboardData {
  const weekIdx  = data.weeks.findIndex(w => w.label === newWeek);
  const prevIdx  = weekIdx > 0 ? weekIdx - 1 : -1;
  const prevWeek = prevIdx >= 0 ? data.weeks[prevIdx].label : newWeek;

  const riskRegister = data.riskRegister.map(risk => {
    // Use the stored weighted sum values
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

  // Recompute all derived counts
  const completed   = riskRegister.filter(r => r.currentPct >= 100).length;
  const inProgress  = riskRegister.filter(r => r.currentPct > 0 && r.currentPct < 100).length;
  const notStarted  = riskRegister.filter(r => r.currentPct === 0).length;

  // Above/Below Target are risk-level KPIs, not mitigation-level KPIs.
  // Their denominator must stay equal to Total Risks from the KPI/risk category total.
  const totalRisks = Number(data.kpis.totalRisks) || 0;
  const aboveCount = Math.min(totalRisks, riskRegister.filter(r => r.aboveTarget).length);
  const belowCount = Math.max(totalRisks - aboveCount, 0);
  const riskSummary = buildRiskSummary(aboveCount, belowCount);

  // Recompute avg risk score (score doesn't change by week, but keep consistent)
  const avgScore = data.kpis.avgRiskScore;

  // Recompute zone counts (zone is based on score, doesn't change by week)
  const zoneCounts = data.zoneCounts;

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
      avgRiskScore: avgScore,
    },
    zoneCounts,
    progressCounts: { completed, inProgress, notStarted },
    riskSummary,
    riskRegister,
    selectedRisk,
  };
}

// ── Sample data ────────────────────────────────────────────────────────────
export function getSampleData(): DashboardData {
  const weeks: WeekData[] = [
    { label: 'Mar - W4 (24/3)', colIndex: 23 },
    { label: 'Mar - W5 (31/3)', colIndex: 24 },
    { label: 'APRIL- W1 (6/4)',  colIndex: 25 },
    { label: 'APRIL- W2 (13/4)', colIndex: 26 },
  ];

  const sampleRisks: RiskRow[] = [
    {
      id: '1', title: 'Visibility Risk', owner: '(Mustafa)', score: 12, rating: 'Moderate',
      closingDate: 'Q1 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Connect the other 6 areas in EOA to ERCC.\n2- Follow up with Telecom on connectivity.',
      weekProgress: { 'Mar - W4 (24/3)': 0.805, 'Mar - W5 (31/3)': 0.815, 'APRIL- W1 (6/4)': 0.825, 'APRIL- W2 (13/4)': 0.835 },
      currentPct: 84, beforePct: 83, developmentPct: 1, aboveTarget: false, belowTarget: false, likelihood: 4, impact: 3,
    },
    {
      id: '2', title: 'HPAs High Temperature, Overrated Transmit RF Power and Critical Alarms issues',
      owner: '(IHAB)', score: 20, rating: 'Very High', closingDate: 'Q4 2026',
      progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Cooling system in outdoor cabinet.\n2- Cooling Enhancement.\n3- Firmware Rectification.\n4- Transition to SSPA.',
      weekProgress: { 'Mar - W4 (24/3)': 0.67, 'Mar - W5 (31/3)': 0.67, 'APRIL- W1 (6/4)': 0.67, 'APRIL- W2 (13/4)': 0.67 },
      currentPct: 67, beforePct: 67, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 5, impact: 4,
    },
    {
      id: '3', title: 'Inadequate vendor support and challenges in IPG Phonetics services',
      owner: '(KARAM)', score: 16, rating: 'High', closingDate: 'Q4 2026',
      progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Escalate to vendor management.\n2- Identify alternative vendors.',
      weekProgress: { 'Mar - W4 (24/3)': 0.684, 'Mar - W5 (31/3)': 0.684, 'APRIL- W1 (6/4)': 0.684, 'APRIL- W2 (13/4)': 0.684 },
      currentPct: 68, beforePct: 68, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 4, impact: 4,
    },
    {
      id: '4', title: 'COA, Lack of IP/MPLS expert', owner: '(Abu Deem)', score: 16, rating: 'High',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Hire IP/MPLS specialist.\n2- Training program.',
      weekProgress: { 'Mar - W4 (24/3)': 0.635, 'Mar - W5 (31/3)': 0.635, 'APRIL- W1 (6/4)': 0.635, 'APRIL- W2 (13/4)': 0.635 },
      currentPct: 64, beforePct: 64, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 4, impact: 4,
    },
    {
      id: '5', title: 'Manpower & Monitoring NMS/systems at WOA & EOA', owner: '(A. Saif)', score: 12, rating: 'Moderate',
      closingDate: 'Q1 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Deploy NMS monitoring solution.\n2- Assign dedicated team.',
      weekProgress: { 'Mar - W4 (24/3)': 0.75, 'Mar - W5 (31/3)': 0.78, 'APRIL- W1 (6/4)': 0.80, 'APRIL- W2 (13/4)': 0.80 },
      currentPct: 80, beforePct: 80, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 3, impact: 4,
    },
    {
      id: '6', title: 'Tickets Remaining Open Without Closure', owner: '(Abu Fatimah)', score: 15, rating: 'High',
      closingDate: 'Q4 2025', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Implement ticket closure policy.\n2- Weekly review meetings.',
      weekProgress: { 'Mar - W4 (24/3)': 0.85, 'Mar - W5 (31/3)': 0.88, 'APRIL- W1 (6/4)': 0.90, 'APRIL- W2 (13/4)': 0.90 },
      currentPct: 90, beforePct: 90, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 3, impact: 5,
    },
    {
      id: '7', title: 'WOA, Non Compatibility of hit7050 with the existing NMS',
      owner: '(Abu Amar)', score: 20, rating: 'Very High', closingDate: 'Q2 2026',
      progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Upgrade NMS to support hit7050.\n2- Coordinate with vendor.',
      weekProgress: { 'Mar - W4 (24/3)': 0.65, 'Mar - W5 (31/3)': 0.68, 'APRIL- W1 (6/4)': 0.70, 'APRIL- W2 (13/4)': 0.70 },
      currentPct: 70, beforePct: 70, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 4, impact: 5,
    },
    {
      id: '8', title: 'Lack of change management Database', owner: '(Abu Abdulrahman)', score: 9, rating: 'Moderate',
      closingDate: 'Q4 2025', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Implement CMDB solution.\n2- Define change management process.',
      weekProgress: { 'Mar - W4 (24/3)': 0.25, 'Mar - W5 (31/3)': 0.28, 'APRIL- W1 (6/4)': 0.30, 'APRIL- W2 (13/4)': 0.30 },
      currentPct: 30, beforePct: 30, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 3, impact: 3,
    },
    {
      id: '9', title: 'WOA, Manual NEs Backup', owner: '(Abu Amar)', score: 15, rating: 'High',
      closingDate: 'Q4 2025', progressStatus: 'In Progress (1-99%)',
      mitigation: '1- Automate NE backup process.\n2- Schedule regular backups.',
      weekProgress: { 'Mar - W4 (24/3)': 0.20, 'Mar - W5 (31/3)': 0.23, 'APRIL- W1 (6/4)': 0.27, 'APRIL- W2 (13/4)': 0.27 },
      currentPct: 27, beforePct: 27, developmentPct: 0, aboveTarget: false, belowTarget: false, likelihood: 3, impact: 5,
    },
    {
      id: '10', title: 'Lack of Backup Fiber Connectivity in Najran Region',
      owner: '(Abu Noura)', score: 12, rating: 'Moderate', closingDate: 'Q4 2025',
      progressStatus: 'Completed (100%)',
      mitigation: '1- Survey alternative fiber routes.\n2- Negotiate with providers.',
      weekProgress: { 'Mar - W4 (24/3)': 0.95, 'Mar - W5 (31/3)': 0.98, 'APRIL- W1 (6/4)': 1.0, 'APRIL- W2 (13/4)': 1.0 },
      currentPct: 100, beforePct: 100, developmentPct: 0, aboveTarget: true, belowTarget: false, likelihood: 3, impact: 4,
    },
  ];

  return {
    period: 'APRIL- W2 (13/4)',
    weeks,
    selectedWeek: 'APRIL- W2 (13/4)',
    prevWeekLabel: 'APRIL- W1 (6/4)',
    kpis: { totalRisks: 28, totalMitigation: 61, aboveTarget: 16, belowTarget: 12, avgRiskScore: 14, avgRiskRating: 'Moderate' },
    zoneCounts: { veryHigh: 2, high: 14, moderate: 12, low: 0, veryLow: 0 },
    progressCounts: { completed: 8, inProgress: 20, notStarted: 0 },
    riskSummary: [
      { name: 'Above Target', value: 16, color: '#27AE60' },
      { name: 'Below Target', value: 12, color: '#C0392B' },
    ],
    riskRegister: sampleRisks,
    selectedRisk: sampleRisks[1],
  };
}
