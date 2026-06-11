import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { parseExcel, switchWeek } from './excelParser';

function makeWorkbookBuffer(rows: unknown[][], sheetName = 'Approved TNOC Risk') {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function row(values: Record<number, unknown>) {
  const cells: unknown[] = [];
  Object.entries(values).forEach(([index, value]) => {
    cells[Number(index)] = value;
  });
  return cells;
}

describe('excelParser', () => {
  it('detects weeks and builds dashboard data from Approved TNOC Risk rows', () => {
    const buffer = makeWorkbookBuffer([
      [],
      row({ 23: 'Mar - W4 (24/3)', 24: 'APRIL- W1 (6/4)' }),
      row({
        0: 1,
        4: 'Network Capacity Risk',
        10: 'Operations',
        11: 5,
        12: 5,
        13: 25,
        14: 'Very High',
        19: 'Q2 2026',
        23: 0.5,
        24: 1,
      }),
      row({ 16: 1, 17: 'Upgrade core network capacity' }),
      row({
        0: 2,
        4: 'Reporting Accuracy Risk',
        10: 'Planning',
        11: 3,
        12: 3,
        13: 9,
        14: 'Moderate',
        19: 'Q4 2026',
        23: 0.25,
        24: 0.2,
      }),
      row({ 16: 2, 17: 'Automate weekly validation report' }),
    ]);

    const data = parseExcel(buffer);

    expect(data.weeks.map(week => week.label)).toEqual(['Mar - W4 (24/3)', 'APRIL- W1 (6/4)']);
    expect(data.selectedWeek).toBe('APRIL- W1 (6/4)');
    expect(data.prevWeekLabel).toBe('Mar - W4 (24/3)');
    expect(data.kpis.totalRisks).toBe(2);
    expect(data.kpis.totalMitigation).toBe(2);
    expect(data.kpis.aboveTarget).toBe(1);
    expect(data.kpis.belowTarget).toBe(1);
    expect(data.zoneCounts.veryHigh).toBe(1);
    expect(data.zoneCounts.moderate).toBe(1);
    expect(data.progressCounts.completed).toBe(1);
    expect(data.progressCounts.inProgress).toBe(1);
    expect(data.riskRegister[0]).toMatchObject({
      title: 'Network Capacity Risk',
      owner: 'Operations',
      currentPct: 100,
      beforePct: 50,
      developmentPct: 50,
      aboveTarget: true,
      belowTarget: false,
      likelihood: 5,
      impact: 5,
    });
    expect(data.riskRegister[0].mitigation).toContain('Upgrade core network capacity');
  });

  it('switches week values and recomputes progress counts', () => {
    const data = parseExcel(makeWorkbookBuffer([
      [],
      row({ 23: 'Mar - W4 (24/3)', 24: 'APRIL- W1 (6/4)' }),
      row({ 0: 1, 4: 'Network Capacity Risk', 10: 'Operations', 11: 5, 12: 5, 13: 25, 14: 'Very High', 23: 0.5, 24: 1 }),
      row({ 16: 1, 17: 'Upgrade core network capacity' }),
      row({ 0: 2, 4: 'Reporting Accuracy Risk', 10: 'Planning', 11: 3, 12: 3, 13: 9, 14: 'Moderate', 23: 0, 24: 0.2 }),
      row({ 16: 2, 17: 'Automate weekly validation report' }),
    ]));

    const switched = switchWeek(data, 'Mar - W4 (24/3)');

    expect(switched.selectedWeek).toBe('Mar - W4 (24/3)');
    expect(switched.riskRegister[0].currentPct).toBe(50);
    expect(switched.progressCounts.completed).toBe(0);
    expect(switched.progressCounts.inProgress).toBe(1);
    expect(switched.progressCounts.notStarted).toBe(1);
  });

  it('throws a clear error when the required sheet is missing', () => {
    const buffer = makeWorkbookBuffer([[]], 'Other Sheet');

    expect(() => parseExcel(buffer)).toThrow('Sheet "Approved TNOC Risk" not found in workbook.');
  });
});
