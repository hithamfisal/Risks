/**
 * Risk Register Excel Parser — Correct Weighted Sum Formula
 *
 * ── How per-risk progress is calculated ─────────────────────────────────────
 * Each risk has multiple action rows in "Approved Risk" sheet.
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
 * ── Approved Risk sheet ────────────────────────────────────────────────
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
  colIndex: number;  // 0-based column index in Approved Risk sheet
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
  uploadValidation?: {
    sheetName: string;
    detectedWeeks: string[];
    riskCount: number;
    mitigationCount: number;
    missingOwners: number;
    missingScores: number;
    warnings: string[];
  };
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
  const missingOwners = riskRegister.filter(r => !r.owner).length;
  const missingScores = riskRegister.filter(r => !r.score).length;
  const validationWarnings = [
    weeks.length === 0 ? 'No reporting week columns were detected.' : '',
    missingOwners > 0 ? `${missingOwners} risk${missingOwners === 1 ? '' : 's'} missing owner.` : '',
    missingScores > 0 ? `${missingScores} risk${missingScores === 1 ? '' : 's'} missing score.` : '',
    riskRegister.length === 0 ? 'No risk title rows were detected.' : '',
  ].filter(Boolean);

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
    uploadValidation: {
      sheetName: 'Approved TNOC Risk',
      detectedWeeks: weeks.map(w => w.label),
      riskCount: finalTotalRisks,
      mitigationCount: totalMitigation,
      missingOwners,
      missingScores,
      warnings: validationWarnings,
    },
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
    uploadValidation: data.uploadValidation,
  };
}

// ── Sample data (from RiskRegisterSample.xlsx) ─────────────────────────────
export function getSampleData(): DashboardData {
  const weeks: WeekData[] = [
    { label: 'Mar - W4 (24/3)', colIndex: 23 },
    { label: 'Mar - W5 (31/3)', colIndex: 24 },
    { label: 'APRIL- W1 (6/4)',  colIndex: 25 },
    { label: 'APRIL- W2 (13/4)', colIndex: 26 },
  ];

  const sampleRisks: RiskRow[] = [
    {
      id: '1', title: 'Data Quality and Reporting Risk',
      owner: 'Maya Stone', score: 12, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Implement monitoring report and review cycle.\n2. Perform field inspection and close corrective actions.',
      weekProgress: { 'Mar - W4 (24/3)': 0.42, 'Mar - W5 (31/3)': 0.45, 'APRIL- W1 (6/4)': 0.51, 'APRIL- W2 (13/4)': 0.50 },
      currentPct: 50, beforePct: 51, developmentPct: -1, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 3,
    },
    {
      id: '2', title: 'Documentation Accuracy Risk',
      owner: 'Nora Adams', score: 9, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Coordinate with supplier and agree delivery schedule.\n2. Automate weekly KPI report and publish to portal.',
      weekProgress: { 'Mar - W4 (24/3)': 0.00, 'Mar - W5 (31/3)': 0.01, 'APRIL- W1 (6/4)': 0.02, 'APRIL- W2 (13/4)': 0.02 },
      currentPct: 2, beforePct: 2, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 3,
    },
    {
      id: '3', title: 'Access Control Compliance Risk',
      owner: 'Hana Blake', score: 20, rating: 'Very High',
      closingDate: 'Q1 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Enforce MFA on all critical systems.\n2. Conduct quarterly access reviews.',
      weekProgress: { 'Mar - W4 (24/3)': 0.30, 'Mar - W5 (31/3)': 0.28, 'APRIL- W1 (6/4)': 0.38, 'APRIL- W2 (13/4)': 0.38 },
      currentPct: 38, beforePct: 38, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 4,
    },
    {
      id: '4', title: 'Incident Response Delay Risk',
      owner: 'Lina Brooks', score: 1, rating: 'Very Low',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Define SLA for incident response.\n2. Automate escalation workflows.',
      weekProgress: { 'Mar - W4 (24/3)': 0.00, 'Mar - W5 (31/3)': 0.00, 'APRIL- W1 (6/4)': 0.00, 'APRIL- W2 (13/4)': 0.02 },
      currentPct: 2, beforePct: 0, developmentPct: 2, aboveTarget: false, belowTarget: true, likelihood: 1, impact: 1,
    },
    {
      id: '5', title: 'Access Control Compliance Risk (Secondary)',
      owner: 'Maya Stone', score: 12, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'Not Started (0%)',
      mitigation: '1. Review user provisioning process.\n2. Implement role-based access control.',
      weekProgress: { 'Mar - W4 (24/3)': 0.00, 'Mar - W5 (31/3)': 0.00, 'APRIL- W1 (6/4)': 0.01, 'APRIL- W2 (13/4)': 0.00 },
      currentPct: 0, beforePct: 1, developmentPct: -1, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 3,
    },
    {
      id: '6', title: 'Inventory Shortage Risk',
      owner: 'Nora Adams', score: 16, rating: 'High',
      closingDate: 'Q2 2026', progressStatus: 'Completed (100%)',
      mitigation: '1. Establish safety stock levels.\n2. Diversify supplier base.',
      weekProgress: { 'Mar - W4 (24/3)': 0.94, 'Mar - W5 (31/3)': 0.94, 'APRIL- W1 (6/4)': 0.93, 'APRIL- W2 (13/4)': 1.00 },
      currentPct: 100, beforePct: 93, developmentPct: 7, aboveTarget: true, belowTarget: false, likelihood: 4, impact: 4,
    },
    {
      id: '7', title: 'Service Desk Workload Risk',
      owner: 'Omar Reed', score: 12, rating: 'Moderate',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Hire additional service desk agents.\n2. Implement self-service portal.',
      weekProgress: { 'Mar - W4 (24/3)': 0.59, 'Mar - W5 (31/3)': 0.57, 'APRIL- W1 (6/4)': 0.54, 'APRIL- W2 (13/4)': 0.64 },
      currentPct: 64, beforePct: 54, developmentPct: 10, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 3,
    },
    {
      id: '8', title: 'Contract Renewal Delay Risk',
      owner: 'Samir Hale', score: 9, rating: 'Moderate',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Set 90-day renewal reminders.\n2. Assign contract manager per vendor.',
      weekProgress: { 'Mar - W4 (24/3)': 0.60, 'Mar - W5 (31/3)': 0.59, 'APRIL- W1 (6/4)': 0.56, 'APRIL- W2 (13/4)': 0.60 },
      currentPct: 60, beforePct: 56, developmentPct: 4, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 3,
    },
    {
      id: '9', title: 'Data Quality and Reporting Risk (Secondary)',
      owner: 'Omar Reed', score: 9, rating: 'Moderate',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Implement data validation rules.\n2. Schedule monthly data audits.',
      weekProgress: { 'Mar - W4 (24/3)': 0.73, 'Mar - W5 (31/3)': 0.78, 'APRIL- W1 (6/4)': 0.75, 'APRIL- W2 (13/4)': 0.72 },
      currentPct: 72, beforePct: 75, developmentPct: -3, aboveTarget: true, belowTarget: false, likelihood: 3, impact: 3,
    },
    {
      id: '10', title: 'Contract Renewal Delay Risk (Secondary)',
      owner: 'Grace Miller', score: 9, rating: 'Moderate',
      closingDate: 'Q3 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Centralise contract repository.\n2. Automate renewal notifications.',
      weekProgress: { 'Mar - W4 (24/3)': 0.78, 'Mar - W5 (31/3)': 0.79, 'APRIL- W1 (6/4)': 0.71, 'APRIL- W2 (13/4)': 0.76 },
      currentPct: 76, beforePct: 71, developmentPct: 5, aboveTarget: true, belowTarget: false, likelihood: 3, impact: 3,
    },
    {
      id: '11', title: 'Backup Power Availability Risk',
      owner: 'Samir Hale', score: 20, rating: 'Very High',
      closingDate: 'Q3 2026', progressStatus: 'Not Started (0%)',
      mitigation: '1. Install UPS at critical sites.\n2. Test generator failover monthly.',
      weekProgress: { 'Mar - W4 (24/3)': 0.01, 'Mar - W5 (31/3)': 0.00, 'APRIL- W1 (6/4)': 0.00, 'APRIL- W2 (13/4)': 0.00 },
      currentPct: 0, beforePct: 0, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 4,
    },
    {
      id: '12', title: 'Contract Renewal Delay Risk (Tertiary)',
      owner: 'Grace Miller', score: 25, rating: 'Very High',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Escalate to procurement leadership.\n2. Engage legal for fast-track renewal.',
      weekProgress: { 'Mar - W4 (24/3)': 1.00, 'Mar - W5 (31/3)': 0.97, 'APRIL- W1 (6/4)': 0.98, 'APRIL- W2 (13/4)': 0.96 },
      currentPct: 96, beforePct: 98, developmentPct: -2, aboveTarget: true, belowTarget: false, likelihood: 5, impact: 5,
    },
    {
      id: '13', title: 'Critical Spare Parts Availability Risk',
      owner: 'Omar Reed', score: 1, rating: 'Very Low',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Maintain minimum spare parts inventory.\n2. Negotiate expedited delivery SLAs.',
      weekProgress: { 'Mar - W4 (24/3)': 0.45, 'Mar - W5 (31/3)': 0.38, 'APRIL- W1 (6/4)': 0.50, 'APRIL- W2 (13/4)': 0.38 },
      currentPct: 38, beforePct: 50, developmentPct: -12, aboveTarget: false, belowTarget: true, likelihood: 1, impact: 1,
    },
    {
      id: '14', title: 'Inventory Shortage Risk (Secondary)',
      owner: 'Grace Miller', score: 25, rating: 'Very High',
      closingDate: 'Q2 2026', progressStatus: 'Completed (100%)',
      mitigation: '1. Implement just-in-time inventory model.\n2. Set up automated reorder triggers.',
      weekProgress: { 'Mar - W4 (24/3)': 1.00, 'Mar - W5 (31/3)': 0.96, 'APRIL- W1 (6/4)': 0.93, 'APRIL- W2 (13/4)': 1.00 },
      currentPct: 100, beforePct: 93, developmentPct: 7, aboveTarget: true, belowTarget: false, likelihood: 5, impact: 5,
    },
    {
      id: '15', title: 'Service Desk Workload Risk (Secondary)',
      owner: 'Nora Adams', score: 9, rating: 'Moderate',
      closingDate: 'Q3 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Redistribute ticket queues by priority.\n2. Introduce chatbot for Tier-1 support.',
      weekProgress: { 'Mar - W4 (24/3)': 0.47, 'Mar - W5 (31/3)': 0.41, 'APRIL- W1 (6/4)': 0.46, 'APRIL- W2 (13/4)': 0.46 },
      currentPct: 46, beforePct: 46, developmentPct: 0, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 3,
    },
    {
      id: '16', title: 'Data Quality and Reporting Risk (Tertiary)',
      owner: 'Rami Cole', score: 4, rating: 'Very Low',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Deploy data lineage tracking tool.\n2. Establish data stewardship roles.',
      weekProgress: { 'Mar - W4 (24/3)': 0.79, 'Mar - W5 (31/3)': 0.79, 'APRIL- W1 (6/4)': 0.72, 'APRIL- W2 (13/4)': 0.71 },
      currentPct: 71, beforePct: 72, developmentPct: -1, aboveTarget: true, belowTarget: false, likelihood: 2, impact: 2,
    },
    {
      id: '17', title: 'Supplier Delivery Delay Risk',
      owner: 'Hana Blake', score: 16, rating: 'High',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Add penalty clauses for late delivery.\n2. Identify backup suppliers.',
      weekProgress: { 'Mar - W4 (24/3)': 0.38, 'Mar - W5 (31/3)': 0.28, 'APRIL- W1 (6/4)': 0.40, 'APRIL- W2 (13/4)': 0.34 },
      currentPct: 34, beforePct: 40, developmentPct: -6, aboveTarget: false, belowTarget: true, likelihood: 4, impact: 4,
    },
    {
      id: '18', title: 'Patch Management Delay Risk',
      owner: 'Maya Stone', score: 6, rating: 'Low',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Automate patch deployment pipeline.\n2. Schedule monthly patching windows.',
      weekProgress: { 'Mar - W4 (24/3)': 0.78, 'Mar - W5 (31/3)': 0.67, 'APRIL- W1 (6/4)': 0.68, 'APRIL- W2 (13/4)': 0.65 },
      currentPct: 65, beforePct: 68, developmentPct: -3, aboveTarget: false, belowTarget: true, likelihood: 3, impact: 2,
    },
    {
      id: '19', title: 'Network Capacity Saturation Risk',
      owner: 'Nora Adams', score: 25, rating: 'Very High',
      closingDate: 'Q4 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Upgrade core network capacity.\n2. Implement traffic shaping policies.',
      weekProgress: { 'Mar - W4 (24/3)': 0.30, 'Mar - W5 (31/3)': 0.17, 'APRIL- W1 (6/4)': 0.29, 'APRIL- W2 (13/4)': 0.19 },
      currentPct: 19, beforePct: 29, developmentPct: -10, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 5,
    },
    {
      id: '20', title: 'Patch Management Delay Risk (Secondary)',
      owner: 'Nora Adams', score: 20, rating: 'Very High',
      closingDate: 'Q2 2026', progressStatus: 'In Progress (1-99%)',
      mitigation: '1. Prioritise critical patches by CVSS score.\n2. Enforce patch compliance reporting.',
      weekProgress: { 'Mar - W4 (24/3)': 0.38, 'Mar - W5 (31/3)': 0.35, 'APRIL- W1 (6/4)': 0.32, 'APRIL- W2 (13/4)': 0.26 },
      currentPct: 26, beforePct: 32, developmentPct: -6, aboveTarget: false, belowTarget: true, likelihood: 5, impact: 4,
    },
  ];

  return {
    period: 'APRIL- W2 (13/4)',
    weeks,
    selectedWeek: 'APRIL- W2 (13/4)',
    prevWeekLabel: 'APRIL- W1 (6/4)',
    kpis: { totalRisks: 20, totalMitigation: 40, aboveTarget: 6, belowTarget: 14, avgRiskScore: 13, avgRiskRating: 'Moderate' },
    zoneCounts: { veryHigh: 6, high: 2, moderate: 8, low: 1, veryLow: 3 },
    progressCounts: { completed: 2, inProgress: 16, notStarted: 2 },
    riskSummary: [
      { name: 'Above Target', value: 6, color: '#27AE60' },
      { name: 'Below Target', value: 14, color: '#C0392B' },
    ],
    riskRegister: sampleRisks,
    selectedRisk: sampleRisks[2],
    uploadValidation: {
      sheetName: 'Sample Data',
      detectedWeeks: weeks.map(w => w.label),
      riskCount: sampleRisks.length,
      mitigationCount: 40,
      missingOwners: 0,
      missingScores: 0,
      warnings: [],
    },
  };
}
