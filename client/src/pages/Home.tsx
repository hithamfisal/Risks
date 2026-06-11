/**
 * Home - orchestrates Upload to Dashboard flow with week switching
 */
import { useState } from 'react';
import UploadPage from './Upload';
import DashboardPage from './Dashboard';
import { DashboardData, switchWeek } from '@/lib/excelParser';

const LAST_UPLOAD_KEY = 'tnoc-risk-dashboard:last-upload:v1';
const LAST_UPLOAD_LIST_KEY = 'tnoc-risk-dashboard:last-uploads:v2';
const MAX_RECENT_UPLOADS = 5;

type LastUploadPayload = {
  id?: string;
  data: DashboardData;
  fileName: string;
  savedAt: string;
};

function readLastUploads(): LastUploadPayload[] {
  try {
    const listRaw = window.localStorage.getItem(LAST_UPLOAD_LIST_KEY);
    if (listRaw) {
      const parsed = JSON.parse(listRaw) as LastUploadPayload[];
      return parsed.filter(item => item?.data?.riskRegister?.length).map(item => ({ ...item, id: item.id || `${item.savedAt}-${item.fileName}` }));
    }

    const raw = window.localStorage.getItem(LAST_UPLOAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LastUploadPayload;
    if (!parsed?.data?.riskRegister?.length) return [];
    return [{ ...parsed, id: `${parsed.savedAt}-${parsed.fileName}` }];
  } catch {
    return [];
  }
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [fileName, setFileName] = useState('');
  const [lastUploads, setLastUploads] = useState<LastUploadPayload[]>(() => readLastUploads());

  function saveLastUpload(d: DashboardData, name: string) {
    try {
      const payload: LastUploadPayload = { id: `${Date.now()}-${name}`, data: d, fileName: name, savedAt: new Date().toISOString() };
      const nextUploads = [payload, ...lastUploads.filter(item => item.fileName !== name)].slice(0, MAX_RECENT_UPLOADS);
      window.localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify(payload));
      window.localStorage.setItem(LAST_UPLOAD_LIST_KEY, JSON.stringify(nextUploads));
      setLastUploads(nextUploads);
    } catch {
      // Local storage can be blocked or full; dashboard should still work normally.
    }
  }

  function handleDataLoaded(d: DashboardData, name: string) {
    saveLastUpload(d, name);
    setData(d);
    setFileName(name);
  }

  function handlePreviousUpload(id: string) {
    const upload = lastUploads.find(item => item.id === id);
    if (!upload) return;
    setData(upload.data);
    setFileName(upload.fileName);
  }

  function handleClearPreviousUpload(id: string) {
    const nextUploads = lastUploads.filter(item => item.id !== id);
    try {
      window.localStorage.setItem(LAST_UPLOAD_LIST_KEY, JSON.stringify(nextUploads));
      if (nextUploads.length === 0) window.localStorage.removeItem(LAST_UPLOAD_KEY);
    } catch {
      // Ignore storage errors.
    }
    setLastUploads(nextUploads);
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
      previousUploads={lastUploads.map(upload => ({ id: upload.id || `${upload.savedAt}-${upload.fileName}`, fileName: upload.fileName, savedAt: upload.savedAt, riskCount: upload.data.kpis.totalRisks || upload.data.riskRegister.length }))}
      onLoadPrevious={handlePreviousUpload}
      onClearPrevious={handleClearPreviousUpload}
    />
  );
}
