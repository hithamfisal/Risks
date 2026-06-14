/**
 * Home — orchestrates Upload → Dashboard flow with week switching
 */
import { useState } from 'react';
import UploadPage from './Upload';
import DashboardPage from './Dashboard';
import { DashboardData, switchWeek } from '@/lib/excelParser';

const LAST_UPLOAD_KEY = 'tnoc-risk-dashboard:last-upload:v1';

type LastUploadPayload = {
  data: DashboardData;
  fileName: string;
  savedAt: string;
};

function readLastUpload(): LastUploadPayload | null {
  try {
    const raw = window.localStorage.getItem(LAST_UPLOAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastUploadPayload;
    if (!parsed?.data?.riskRegister?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fileName, setFileName] = useState('');
  const [lastUpload, setLastUpload] = useState<LastUploadPayload | null>(() => readLastUpload());

  function saveLastUpload(d: DashboardData, name: string) {
    try {
      const payload: LastUploadPayload = { data: d, fileName: name, savedAt: new Date().toISOString() };
      window.localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify(payload));
      setLastUpload(payload);
    } catch {
      // Local storage can be blocked or full; dashboard should still work normally.
    }
  }

  function handleDataLoaded(d: DashboardData, name: string) {
    saveLastUpload(d, name);
    setData(d);
    setFileName(name);
  }

  function handlePreviousUpload() {
    if (!lastUpload) return;
    setData(lastUpload.data);
    setFileName(lastUpload.fileName);
  }

  function handleClearPreviousUpload() {
    try {
      window.localStorage.removeItem(LAST_UPLOAD_KEY);
    } catch {
      // Ignore storage errors.
    }
    setLastUpload(null);
    setData(null);
    setFileName('');
  }

  function handleWeekChange(week: string) {
    if (!data) return;
    setData(switchWeek(data, week));
  }

  function handleReset() {
    setData(null);
    setFileName('');
  }

  if (data) {
    return (
      <DashboardPage
        data={data}
        fileName={fileName}
        onReset={handleReset}
        onWeekChange={handleWeekChange}
      />
    );
  }

  return (
    <UploadPage
      onDataLoaded={handleDataLoaded}
      previousUpload={lastUpload ? { fileName: lastUpload.fileName, savedAt: lastUpload.savedAt, riskCount: lastUpload.data.kpis.totalRisks || lastUpload.data.riskRegister.length } : null}
      onLoadPrevious={handlePreviousUpload}
      onClearPrevious={handleClearPreviousUpload}
    />
  );
}
