/**
 * Home — orchestrates Upload → Dashboard flow with week switching
 */
import { useState } from 'react';
import UploadPage from './Upload';
import DashboardPage from './Dashboard';
import { DashboardData, switchWeek } from '@/lib/excelParser';

export const LAST_UPLOAD_KEY = 'risks-dashboard:last-upload:v1';
const DASHBOARD_STORAGE_PREFIXES = ['risks-dashboard:', 'risk-dashboard:'];

type LastUploadPayload = {
  data: DashboardData;
  fileName: string;
  savedAt: string;
};

async function clearSavedDashboardData() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key === LAST_UPLOAD_KEY || DASHBOARD_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors.
  }

  try {
    for (const key of Object.keys(window.sessionStorage)) {
      if (key === LAST_UPLOAD_KEY || DASHBOARD_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage access errors.
  }

  try {
    const indexedDBWithDatabases = window.indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
    if (indexedDBWithDatabases?.databases) {
      const databases = await indexedDBWithDatabases.databases();
      await Promise.all(
        databases
          .map(db => db.name || '')
          .filter(name => DASHBOARD_STORAGE_PREFIXES.some(prefix => name.startsWith(prefix)) || /risk|risks|dashboard/i.test(name))
          .map(name => new Promise<void>(resolve => {
            const request = window.indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }))
      );
    }
  } catch {
    // Ignore IndexedDB cleanup errors.
  }
}


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

export default function Home({ portal = 'admin' }: { portal?: 'admin' | 'customer' }) {
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

  async function handleClearPreviousUpload() {
    await clearSavedDashboardData();
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
        portal={portal}
      />
    );
  }

  return (
    <UploadPage
      onDataLoaded={handleDataLoaded}
      previousUpload={lastUpload ? { fileName: lastUpload.fileName, savedAt: lastUpload.savedAt, riskCount: lastUpload.data.kpis.totalRisks || lastUpload.data.riskRegister.length } : null}
      onLoadPrevious={handlePreviousUpload}
      onClearPrevious={handleClearPreviousUpload}
      onClearSavedDashboardData={handleClearPreviousUpload}
      portal={portal}
    />
  );
}
