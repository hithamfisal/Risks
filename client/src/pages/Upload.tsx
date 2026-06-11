/**
 * Upload page - entry point for the TNOC Risk Dashboard
 * Design: Saudi Energy themed light/dark landing screen with branded logos
 */

import { useState, useRef, DragEvent } from 'react';
import { Upload, FileSpreadsheet, ArrowRight, AlertCircle, Clock3, Trash2, Sun, Moon } from 'lucide-react';
import { parseExcel, getSampleData, DashboardData } from '@/lib/excelParser';
import { useTheme } from '@/contexts/ThemeContext';

interface PreviousUploadInfo {
  id: string;
  fileName: string;
  savedAt: string;
  riskCount: number;
}

interface UploadPageProps {
  onDataLoaded: (data: DashboardData, fileName: string) => void;
  previousUploads?: PreviousUploadInfo[];
  onLoadPrevious?: (id: string) => void;
  onClearPrevious?: (id: string) => void;
}

const SE_LOGO_URL = '/assets/se-logo.png';
const NASCO_LOGO_URL = '/assets/nasco-logo.png';

export default function UploadPage({ onDataLoaded, previousUploads = [], onLoadPrevious, onClearPrevious }: UploadPageProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
      setError('Please upload an Excel file (.xlsx, .xls, or .xlsm)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const data = parseExcel(buffer);
      onDataLoaded(data, file.name);
    } catch (e) {
      setError('Could not read the file. Please check it is a valid Excel workbook.');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
  }

  function onDragLeave() { setDragging(false); }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function loadSample() {
    onDataLoaded(getSampleData(), 'sample_data.xlsx');
  }

  const pageBg = isDark ? '/assets/dark.png' : '/assets/light.png';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: isDark ? '#061630' : '#F8FBFF' }}
    >
      <div className="unified-dashboard-banner" style={{ background: isDark ? 'rgba(5, 18, 43, 0.88)' : 'rgba(255, 255, 255, 0.88)', borderBottom: isDark ? '1px solid rgba(125,211,252,0.20)' : '1px solid rgba(31,56,100,0.13)', boxShadow: isDark ? '0 14px 44px rgba(0,0,0,.28)' : '0 12px 34px rgba(31,56,100,.10)' }}>
        <div className="unified-logo-card unified-logo-card-main">
          <img src={NASCO_LOGO_URL} alt="NASCO" style={{ maxHeight: 44, maxWidth: '100%', objectFit: 'contain' }} />
        </div>
        <div className="unified-title-block">
          <h1>RISK MANAGEMENT DASHBOARD</h1>
          <p>Telecom Network Operations Center - Upload Portal</p>
        </div>
        <div className="unified-header-logos">
          <div className="unified-logo-card">
            <img src={SE_LOGO_URL} alt="Saudi Energy" style={{ maxHeight: 38, maxWidth: '100%', objectFit: 'contain' }} />
          </div>
        </div>
      </div>

      <div style={{ background: isDark ? 'rgba(5,18,43,0.95)' : 'rgba(255,255,255,0.96)', borderBottom: isDark ? '1px solid rgba(125,211,252,0.18)' : '1px solid rgba(31,56,100,0.10)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '6px 24px', gap: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', background: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.86)', border: isDark ? '1px solid rgba(125,211,252,0.28)' : '1px solid rgba(37,99,235,0.18)', borderRadius: 999, padding: 2, gap: 0, backdropFilter: 'blur(8px)', height: 30 }}>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans, Inter, sans-serif', transition: 'background 180ms ease, color 180ms ease, box-shadow 180ms ease', height: 24, background: !isDark ? 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)' : 'transparent', color: !isDark ? 'white' : 'rgba(125,211,252,0.6)', boxShadow: !isDark ? '0 4px 12px rgba(37,99,235,0.30)' : 'none' }}
            onClick={() => { if (isDark) toggleTheme?.(); }}>
            <Sun size={11} />Light
          </button>
          <button
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans, Inter, sans-serif', transition: 'background 180ms ease, color 180ms ease, box-shadow 180ms ease', height: 24, background: isDark ? 'linear-gradient(135deg, #06b6d4 0%, #2563eb 100%)' : 'transparent', color: isDark ? 'white' : 'rgba(37,99,235,0.5)', boxShadow: isDark ? '0 4px 12px rgba(37,99,235,0.30)' : 'none' }}
            onClick={() => { if (!isDark) toggleTheme?.(); }}>
            <Moon size={11} />Dark
          </button>
        </div>
      </div>

      {/* Main */}
      <main
        className="flex-1 flex items-center justify-center py-6 px-4"
        style={{
          backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.42), rgba(2,6,23,.12))' : 'linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.28))'}, url(${pageBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="dash-card p-5" style={{ background: isDark ? 'rgba(6, 20, 48, 0.82)' : 'rgba(255,255,255,0.88)', border: isDark ? '1px solid rgba(125,211,252,0.22)' : '1px solid rgba(31,56,100,0.10)', boxShadow: isDark ? '0 26px 80px rgba(0,0,0,.34)' : '0 26px 80px rgba(31,56,100,.14)', backdropFilter: 'blur(18px)' }}>
            <div className="text-center mb-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                   style={{ background: isDark ? 'rgba(14,165,233,.16)' : '#EBF4FF' }}>
                <FileSpreadsheet size={24} style={{ color: isDark ? '#38BDF8' : '#1F3864' }} />
              </div>
              <h2 className="text-xl font-bold" style={{ color: isDark ? '#F8FAFC' : '#1F2937', fontFamily: 'DM Sans, sans-serif' }}>
                Upload Your Risk Register
              </h2>
              <p className="text-sm mt-1" style={{ color: isDark ? '#CBD5E1' : '#6B7280' }}>
                Upload an Excel file (.xlsx / .xls / .xlsm) to generate your dashboard automatically.
              </p>
            </div>


            {/* Previous uploads */}
            {previousUploads.length > 0 && (
              <div
                className="mb-6"
                style={{
                  border: isDark ? '1px solid rgba(56,189,248,.26)' : '1px solid rgba(31,56,100,.13)',
                  background: isDark ? 'linear-gradient(135deg, rgba(14,165,233,.12), rgba(15,23,42,.52))' : 'linear-gradient(135deg, rgba(235,244,255,.86), rgba(255,255,255,.76))',
                  borderRadius: 18,
                  padding: 14,
                  boxShadow: isDark ? '0 16px 42px rgba(0,0,0,.18)' : '0 14px 34px rgba(31,56,100,.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: isDark ? 'rgba(56,189,248,.16)' : '#E6F2FF', color: isDark ? '#7DD3FC' : '#1F3864', flex: '0 0 auto' }}>
                    <Clock3 size={21} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, color: isDark ? '#EAF6FF' : '#1F3864', fontWeight: 900, fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>Continue from previous uploaded files</p>
                    <p style={{ margin: '3px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontSize: 11, fontWeight: 700 }}>
                      Recent files are saved only in this browser.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {previousUploads.map(upload => {
                    const savedDate = new Date(upload.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                    return (
                      <div key={upload.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: isDark ? '1px solid rgba(125,211,252,.16)' : '1px solid rgba(31,56,100,.10)', borderRadius: 13, padding: '9px 10px', background: isDark ? 'rgba(15,23,42,.34)' : 'rgba(255,255,255,.62)' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, color: isDark ? '#EAF6FF' : '#1F3864', fontWeight: 900, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 390 }} title={upload.fileName}>
                            {upload.fileName}
                          </p>
                          <p style={{ margin: '3px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontSize: 10.5, fontWeight: 700 }}>
                            {upload.riskCount} risks - saved {savedDate}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={() => onLoadPrevious?.(upload.id)}
                            style={{ height: 32, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #073266, #0078FF)', color: 'white', padding: '0 13px', fontWeight: 900, fontSize: 11.5, cursor: 'pointer', boxShadow: '0 12px 28px rgba(0,120,255,.18)' }}
                          >
                            Continue
                          </button>
                          <button
                            type="button"
                            title="Forget saved upload"
                            onClick={() => onClearPrevious?.(upload.id)}
                            style={{ width: 32, height: 32, borderRadius: '50%', border: isDark ? '1px solid rgba(255,255,255,.16)' : '1px solid rgba(31,56,100,.14)', background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.8)', color: isDark ? '#FCA5A5' : '#B42318', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`drop-zone flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${dragging ? 'drag-over' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
              style={{ background: dragging ? (isDark ? 'rgba(56,189,248,.16)' : '#EBF4FF') : (isDark ? 'rgba(15,23,42,.48)' : 'rgba(255,255,255,.62)'), borderColor: dragging ? '#38BDF8' : (isDark ? 'rgba(125,211,252,.35)' : '#CBD5E0') }}
            >
              <Upload size={20} className="mb-1" style={{ color: dragging ? '#38BDF8' : (isDark ? '#93C5FD' : '#a0aec0') }} />
              <p className="font-semibold text-sm" style={{ color: isDark ? '#E2E8F0' : '#374151', fontFamily: 'DM Sans, sans-serif', margin: 0 }}>
                {dragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
              </p>
              <p className="text-xs" style={{ color: isDark ? '#94A3B8' : '#9CA3AF', marginTop: 2 }}>or click to browse - .xlsx - .xls - .xlsm</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.xlsm"
                className="hidden"
                onChange={onInputChange}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="mt-4 text-center">
                <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm mt-2" style={{ color: isDark ? '#CBD5E1' : '#6B7280' }}>Parsing your file...</p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(148,163,184,.22)' : '#E5E7EB' }} />
              <span className="text-xs" style={{ color: isDark ? '#94A3B8' : '#9CA3AF' }}>or</span>
              <div className="flex-1 h-px" style={{ background: isDark ? 'rgba(148,163,184,.22)' : '#E5E7EB' }} />
            </div>

            {/* Sample data button */}
            <button
              onClick={loadSample}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 font-semibold text-sm transition-all"
              style={{ borderColor: isDark ? '#38BDF8' : '#1F3864', color: isDark ? '#E0F2FE' : '#1F3864', background: isDark ? 'rgba(14,165,233,.10)' : 'rgba(235,244,255,.50)', fontFamily: 'DM Sans, sans-serif' }}
            >
              View Sample Dashboard
              <ArrowRight size={16} />
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}
