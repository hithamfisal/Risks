/**
 * Home — orchestrates Upload → Dashboard flow with week switching
 */
import { useState } from 'react';
import UploadPage from './Upload';
import DashboardPage from './Dashboard';
import { DashboardData, switchWeek } from '@/lib/excelParser';
import { saveRiskDashboardState } from '@/lib/riskApi';
import { useAuth } from '@/contexts/AuthContext';

export const LAST_UPLOAD_KEY = 'risks-dashboard:last-upload:v1';
const DASHBOARD_STORAGE_PREFIXES = ['risks-dashboard:', 'risk-dashboard:'];

type LastUploadPayload = {
  data: DashboardData;
  fileName: string;
  savedAt: string;
};

export type DashboardSaveStatus = {
  state: 'saving' | 'saved' | 'error';
  savedAt?: string;
  uploadedBy?: string;
  message?: string;
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
    const raw = window.sessionStorage.getItem(LAST_UPLOAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastUploadPayload;
    if (!parsed?.data?.riskRegister?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Home({ portal = 'admin' }: { portal?: 'admin' | 'customer' }) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [fileName, setFileName] = useState('');
  const [lastUpload, setLastUpload] = useState<LastUploadPayload | null>(() => readLastUpload());
  const [saveStatus, setSaveStatus] = useState<DashboardSaveStatus | null>(null);

  function saveLastUpload(d: DashboardData, name: string) {
    try {
      const payload: LastUploadPayload = { data: d, fileName: name, savedAt: new Date().toISOString() };
      window.sessionStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify(payload));
      setLastUpload(payload);
      setSaveStatus({ state: 'saving', savedAt: payload.savedAt, uploadedBy: user?.username || user?.name || 'Current user' });
      saveRiskDashboardState('last_upload_metadata', {
        fileName: name,
        savedAt: payload.savedAt,
        riskCount: d.kpis.totalRisks || d.riskRegister.length,
        uploadedBy: user?.username || user?.name || 'Current user',
      })
        .then(() => setSaveStatus({ state: 'saved', savedAt: payload.savedAt, uploadedBy: user?.username || user?.name || 'Current user', message: 'Upload metadata saved' }))
        .catch(() => setSaveStatus({ state: 'error', savedAt: payload.savedAt, uploadedBy: user?.username || user?.name || 'Current user', message: 'Saved locally only' }));
    } catch {
      // Local storage can be blocked or full; dashboard should still work normally.
      setSaveStatus({ state: 'error', uploadedBy: user?.username || user?.name || 'Current user', message: 'Unable to save local upload state' });
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
    setSaveStatus({ state: 'saved', savedAt: lastUpload.savedAt, uploadedBy: user?.username || user?.name || 'Current user', message: 'Loaded saved upload' });
  }

  async function handleClearPreviousUpload() {
    await clearSavedDashboardData();
    setLastUpload(null);
    setData(null);
    setFileName('');
    setSaveStatus(null);
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
        saveStatus={saveStatus}
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
