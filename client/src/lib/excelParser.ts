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
  const s = String(v);
  return /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|APRIL|W\d)/i.test(s)
    && s.length < 30
    && !s.toLowerCase().includes('weight')
    && !s.toLowerCase().includes('action');
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
  weeks: WeekData[]
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

  for (let i = 2; i < approved.length; i++) {
    const row = approved[i] as unknown[];
    const titleVal = safeStr(row[4]);

    if (titleVal) {
      currentRisk = titleVal;
      // Initialize week progress map for this risk
      weekProgressMap[currentRisk] = {};
      for (const w of weeks) {
        weekProgressMap[currentRisk][w.label] = 0;
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

    // Get action weight (col S = idx 18)
    const weightRaw = row[18];
    if (weightRaw === null || weightRaw === undefined || String(weightRaw).startsWith('#')) continue;
    const weight = safeNum(weightRaw);
    if (weight <= 0) continue;

    // Add weighted contribution for each week
    for (const w of weeks) {
      const val = row[w.colIndex];
      if (val !== null && val !== undefined && !String(val).startsWith('#')) {
        const numVal = safeNum(val);
        weekProgressMap[currentRisk][w.label] =
          (weekProgressMap[currentRisk][w.label] || 0) + weight * numVal;
      }
    }

    // Collect action text (col R = idx 17)
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

  // ── Output sheet ─────────────────────────────────────────────────────────
  const outputSheet = wb.Sheets['Output'];
  if (!outputSheet) throw new Error('Sheet "Output" not found in workbook.');
  const out = XLSX.utils.sheet_to_json<unknown[]>(outputSheet, { header: 1, defval: null }) as unknown[][];

  // Row 1 (idx 0): KPI values (avgRiskScore and avgRiskRating only — counts computed below)
  const kpiRow = out[0] || [];
  // AboveTarget = COUNTIF(H31:H82,">0") — col H (idx 7), rows 31-82 (idx 30-81)
  const aboveTarget = out.slice(30, 82).filter(row => safeNum((row as unknown[])[7]) > 0).length;
  // BelowTarget = COUNTIF(I31:I82,">0") — col I (idx 8), rows 31-82 (idx 30-81)
  const belowTarget = out.slice(30, 82).filter(row => safeNum((row as unknown[])[8]) > 0).length;
  // Avg Risk Score = AVERAGE(Output!C31:C123) — average of numeric values in col C rows 31-123
  const avgScoreValues = out.slice(30, 123)
    .map(row => (row as unknown[])[2])
    .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
    .map(v => Number(v));
  const avgRiskScore = avgScoreValues.length > 0
    ? Math.round((avgScoreValues.reduce((a, b) => a + b, 0) / avgScoreValues.length) * 10) / 10
    : 0;
  const avgRiskRating   = safeStr(kpiRow[5]) || deriveRating(avgRiskScore);

  // Output zone counts can be stale if the Excel summary was not refreshed.
  // Keep them only as a fallback; the dashboard uses the risk register as the source of truth.
  const outputZoneCounts = {
    veryHigh: safeNum(out[6]?.[3]),
    high:     safeNum(out[7]?.[3]),
    moderate: safeNum(out[8]?.[3]),
    low:      safeNum(out[9]?.[3]),
    veryLow:  safeNum(out[10]?.[3]),
  };

  // Progress counts: rows 21-23 (idx 20-22), col B (idx 1)
  const progressCounts = {
    completed:  safeNum(out[20]?.[1]),
    inProgress: safeNum(out[21]?.[1]),
    notStarted: safeNum(out[22]?.[1]),
  };

  // ── Approved TNOC Risk sheet ──────────────────────────────────────────────
  const approvedSheet = wb.Sheets['Approved TNOC Risk'];
  if (!approvedSheet) throw new Error('Sheet "Approved TNOC Risk" not found in workbook.');
  const approved = XLSX.utils.sheet_to_json<unknown[]>(approvedSheet, { header: 1, defval: null }) as unknown[][];
  // Total Risks = COUNT('Approved TNOC Risk'!A:A) — count numeric values in col A (idx 0)
  const totalRisks = approved.filter(row => isNumericCell((row as unknown[])[0])).length;
  // Total Mitigation = COUNT('Approved TNOC Risk'!Q:Q) — count numeric values in col Q (idx 16)
  const totalMitigation = approved.filter(row => isNumericCell((row as unknown[])[16])).length;

  // Detect week columns from row 2 (idx 1) — cols X(23) onwards
  const headerRow2 = approved[1] || [];
  const weeks: WeekData[] = [];
  for (let i = 23; i < Math.min((headerRow2 as unknown[]).length, 35); i++) {
    const v = (headerRow2 as unknown[])[i];
    if (isWeekLabel(v)) {
      weeks.push({ label: safeStr(v), colIndex: i });
    }
  }

  // Selected week = AW1 (col 48, row 1)
  const aw1 = safeStr((approved[0] as unknown[])?.[48]);
  const selectedWeek = aw1 || (weeks.length > 0 ? weeks[weeks.length - 1].label : 'Current');

  // Previous week = BB1 (col 53, row 1)
  const bb1 = safeStr((approved[0] as unknown[])?.[53]);

  // ── Build per-risk per-week progress using weighted sum ───────────────────
  const { weekProgressMap, mitigationMap, ownerMap, scoreMap, ratingMap, closingDateMap, likelihoodMap, impactMap } =
    buildWeekProgressMap(approved, weeks);

  // ── Build risk register from Output rows 31+ (for ordering and metadata) ──
  const selectedWeekIdx = weeks.findIndex(w => w.label === selectedWeek);
  const prevWeekLabel   = bb1 || (selectedWeekIdx > 0 ? weeks[selectedWeekIdx - 1].label : selectedWeek);

  const riskRegister: RiskRow[] = [];

  for (let i = 30; i < out.length; i++) {
    const row = out[i] || [];
    const title = safeStr(row[0]);
    if (!title) continue;

    // Get metadata — prefer from Approved TNOC Risk (more complete), fall back to Output
    const score  = scoreMap[title]  ?? safeNum(row[2]);
    const rating = ratingMap[title] ?? safeStr(row[3]) ?? deriveRating(score);
    const owner  = ownerMap[title]  ?? safeStr(row[1]);
    const quarter = closingDateMap[title] ?? safeStr(row[4]);

    // Get per-week progress from weighted sum map
    const weekProgress = weekProgressMap[title] || {};

    // Current week value
    const curVal  = weekProgress[selectedWeek]  ?? safeNum(row[6]);
    const prevVal = weekProgress[prevWeekLabel] ?? safeNum(row[9]) ?? curVal;

    const currentPct     = pct(curVal);
    const beforePct      = pct(prevVal);
    const developmentPct = Math.round((curVal - prevVal) * 100);
    // Read AboveTarget and BelowTarget directly from Output sheet col H (idx 7) and I (idx 8)
    // matching Excel COUNTIF(H31:H82,">0") and COUNTIF(I31:I82,">0")
    const aboveFlag      = safeNum(row[7]) > 0;
    const belowFlag      = safeNum(row[8]) > 0;

    riskRegister.push({
      id: `risk-${i}`,
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
  }

  // Use the final risk register as one source of truth for dashboard totals.
  // This keeps the Total Risks KPI equal to Risk Categories donut total.
  const registerTotalRisks = riskRegister.length || totalRisks;
  const computedZoneCounts = computeZoneCountsFromRisks(riskRegister);
  const computedZoneTotal = Object.values(computedZoneCounts).reduce((sum, value) => sum + value, 0);
  const outputZoneTotal = Object.values(outputZoneCounts).reduce((sum, value) => sum + value, 0);
  const finalZoneCounts = computedZoneTotal > 0 ? computedZoneCounts : outputZoneCounts;
  const finalTotalRisks = computedZoneTotal > 0 ? computedZoneTotal : (outputZoneTotal || registerTotalRisks);

  // Above/Below Target are risk KPIs, so their denominator must be Total Risks.
  // This keeps: Above Target + Below Target = Total Risks.
  // Above Target comes from the Excel Output sheet col H flags; Below Target is the remaining risks.
  const finalAboveTarget = Math.min(finalTotalRisks, Math.max(aboveTarget, 0));
  const finalBelowTarget = Math.max(finalTotalRisks - finalAboveTarget, 0);
  const riskSummary = buildRiskSummary(finalAboveTarget, finalBelowTarget);

  const selectedRisk = riskRegister.find(r => r.rating === 'Very High') || riskRegister[0] || null;

  return {
    period: selectedWeek,
    weeks,
    selectedWeek,
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
