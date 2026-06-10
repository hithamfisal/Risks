/**
 * Upload page — entry point for the TNOC Risk Dashboard
 * Design: Saudi Energy themed light/dark landing screen with branded logos
 */

import { useState, useRef, DragEvent } from 'react';
import { Upload, FileSpreadsheet, ArrowRight, AlertCircle, Clock3, Trash2, Sun, Moon } from 'lucide-react';
import { parseExcel, getSampleData, DashboardData } from '@/lib/excelParser';
import { useTheme } from '@/contexts/ThemeContext';

interface PreviousUploadInfo {
  fileName: string;
  savedAt: string;
  riskCount: number;
}

interface UploadPageProps {
  onDataLoaded: (data: DashboardData, fileName: string) => void;
  previousUpload?: PreviousUploadInfo | null;
  onLoadPrevious?: () => void;
  onClearPrevious?: () => void;
}

const SE_LOGO_URL = '/assets/se-logo.png';
const NASCO_LOGO_URL = '/assets/nasco-logo.png';

export default function UploadPage({ onDataLoaded, previousUpload, onLoadPrevious, onClearPrevious }: UploadPageProps) {
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
  const previousDate = previousUpload?.savedAt
    ? new Date(previousUpload.savedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';


  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: isDark ? '#061630' : '#F8FBFF' }}
    >
      {/* Banner — same as Dashboard */}
      <div style={{ width: '100%', background: 'linear-gradient(135deg, #020f2e 0%, #041a4a 40%, #0a1f5c 60%, #0d0a1e 100%)', position: 'relative', overflow: 'hidden', minHeight: 140, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 24 }}>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox="0 0 1200 140" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {Array.from({length: 18}).map((_,col) => Array.from({length: 5}).map((_,row) => (<circle key={`d-${col}-${row}`} cx={col*70+35} cy={row*30+15} r="1.2" fill="rgba(30,144,255,0.25)" />)))}
          <line x1="0" y1="35" x2="340" y2="35" stroke="rgba(0,206,209,0.35)" strokeWidth="1" />
          <line x1="0" y1="105" x2="280" y2="105" stroke="rgba(0,206,209,0.2)" strokeWidth="0.8" />
          <line x1="860" y1="35" x2="1200" y2="35" stroke="rgba(192,57,43,0.3)" strokeWidth="1" />
          <line x1="920" y1="105" x2="1200" y2="105" stroke="rgba(192,57,43,0.2)" strokeWidth="0.8" />
          <path d="M-10,90 C60,50 120,130 200,80 C280,30 340,110 420,70" stroke="rgba(0,144,255,0.5)" strokeWidth="2" fill="none" />
          <path d="M-10,110 C80,70 150,140 240,90 C320,45 380,120 460,80" stroke="rgba(0,206,209,0.3)" strokeWidth="1.2" fill="none" />
          <path d="M780,70 C860,110 920,30 1000,80 C1080,130 1140,50 1210,90" stroke="rgba(192,57,43,0.5)" strokeWidth="2" fill="none" />
          <path d="M820,90 C900,130 960,50 1040,100 C1110,140 1160,60 1210,110" stroke="rgba(192,57,43,0.25)" strokeWidth="1.2" fill="none" />
          <circle cx="60" cy="35" r="4" fill="none" stroke="rgba(0,206,209,0.6)" strokeWidth="1.5" />
          <circle cx="60" cy="35" r="1.5" fill="rgba(0,206,209,0.8)" />
          <circle cx="1140" cy="35" r="4" fill="none" stroke="rgba(192,57,43,0.6)" strokeWidth="1.5" />
          <circle cx="1140" cy="35" r="1.5" fill="rgba(192,57,43,0.8)" />
          <rect x="490" y="95" width="8" height="30" rx="2" fill="rgba(0,144,255,0.3)" />
          <rect x="502" y="80" width="8" height="45" rx="2" fill="rgba(0,144,255,0.45)" />
          <rect x="514" y="88" width="8" height="37" rx="2" fill="rgba(0,144,255,0.3)" />
          <circle cx="700" cy="105" r="18" fill="none" stroke="rgba(0,206,209,0.2)" strokeWidth="12" strokeDasharray="28 84" />
          <circle cx="700" cy="105" r="18" fill="none" stroke="rgba(255,165,0,0.3)" strokeWidth="12" strokeDasharray="22 90" strokeDashoffset="-28" />
          <path d="M598,8 L602,8 L608,12 L608,22 C608,26 603,29 600,30 C597,29 592,26 592,22 L592,12 Z" fill="none" stroke="rgba(0,206,209,0.4)" strokeWidth="1.2" />
          <path d="M596,20 L599,23 L605,16" stroke="rgba(0,206,209,0.6)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', left: '22%', top: '50%', transform: 'translate(-50%,-50%)', width: 320, height: 160, background: 'radial-gradient(ellipse, rgba(0,144,255,0.22) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: '22%', top: '50%', transform: 'translate(50%,-50%)', width: 280, height: 140, background: 'radial-gradient(ellipse, rgba(192,57,43,0.18) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <img src={SE_LOGO_URL} alt="Saudi Energy" style={{ height: 52, maxWidth: 90, objectFit: 'contain' }} />
        </div>
        <div style={{ flex: 1, textAlign: 'center', zIndex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#ffffff', fontFamily: 'DM Sans, sans-serif', letterSpacing: '-0.02em', textShadow: '0 2px 12px rgba(0,144,255,0.4)' }}>Risk Management Dashboard</div>
          <div style={{ fontSize: 13, color: 'rgba(0,206,209,0.9)', fontWeight: 600, marginTop: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Telecom Network Operations Center</div>
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
          <img src={NASCO_LOGO_URL} alt="NASCO" style={{ height: 52, maxWidth: 90, objectFit: 'contain' }} />
        </div>
      </div>

      {/* Thin control bar below banner */}
      <div style={{ background: isDark ? 'rgba(5,18,43,0.95)' : 'rgba(255,255,255,0.96)', borderBottom: isDark ? '1px solid rgba(125,211,252,0.18)' : '1px solid rgba(31,56,100,0.10)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '6px 24px', gap: 8 }}>
        {/* Segmented pill theme toggle */}
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
        className="flex-1 flex items-center justify-center py-16 px-4"
        style={{
          backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.42), rgba(2,6,23,.12))' : 'linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.28))'}, url(${pageBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'fixed',
        }}
      >
        <div className="w-full max-w-2xl">
          {/* Card */}
          <div className="dash-card p-8" style={{ background: isDark ? 'rgba(6, 20, 48, 0.82)' : 'rgba(255,255,255,0.88)', border: isDark ? '1px solid rgba(125,211,252,0.22)' : '1px solid rgba(31,56,100,0.10)', boxShadow: isDark ? '0 26px 80px rgba(0,0,0,.34)' : '0 26px 80px rgba(31,56,100,.14)', backdropFilter: 'blur(18px)' }}>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
                   style={{ background: isDark ? 'rgba(14,165,233,.16)' : '#EBF4FF' }}>
                <FileSpreadsheet size={32} style={{ color: isDark ? '#38BDF8' : '#1F3864' }} />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: isDark ? '#F8FAFC' : '#1F2937', fontFamily: 'DM Sans, sans-serif' }}>
                Upload Your Risk Register
              </h2>
              <p className="text-sm mt-2" style={{ color: isDark ? '#CBD5E1' : '#6B7280' }}>
                Upload an Excel file (.xlsx / .xlsm) to generate your dashboard automatically.
              </p>
            </div>


            {/* Previous upload */}
            {previousUpload && (
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: isDark ? 'rgba(56,189,248,.16)' : '#E6F2FF', color: isDark ? '#7DD3FC' : '#1F3864', flex: '0 0 auto' }}>
                      <Clock3 size={21} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, color: isDark ? '#EAF6FF' : '#1F3864', fontWeight: 900, fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>Continue from previous uploaded file</p>
                      <p style={{ margin: '3px 0 0', color: isDark ? '#A8C3DD' : '#64748B', fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 360 }} title={previousUpload.fileName}>
                        {previousUpload.fileName} · {previousUpload.riskCount} risks · saved {previousDate}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={onLoadPrevious}
                      style={{ height: 34, borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, #073266, #0078FF)', color: 'white', padding: '0 14px', fontWeight: 900, fontSize: 12, cursor: 'pointer', boxShadow: '0 12px 28px rgba(0,120,255,.22)' }}
                    >
                      Continue
                    </button>
                    <button
                      type="button"
                      title="Forget saved upload"
                      onClick={onClearPrevious}
                      style={{ width: 34, height: 34, borderRadius: '50%', border: isDark ? '1px solid rgba(255,255,255,.16)' : '1px solid rgba(31,56,100,.14)', background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.8)', color: isDark ? '#FCA5A5' : '#B42318', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Drop zone */}
            <div
              className={`drop-zone flex flex-col items-center justify-center p-10 text-center cursor-pointer transition-all ${dragging ? 'drag-over' : ''}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
              style={{ background: dragging ? (isDark ? 'rgba(56,189,248,.16)' : '#EBF4FF') : (isDark ? 'rgba(15,23,42,.48)' : 'rgba(255,255,255,.62)'), borderColor: dragging ? '#38BDF8' : (isDark ? 'rgba(125,211,252,.35)' : '#CBD5E0') }}
            >
              <Upload size={36} className="mb-3" style={{ color: dragging ? '#38BDF8' : (isDark ? '#93C5FD' : '#a0aec0') }} />
              <p className="font-semibold" style={{ color: isDark ? '#E2E8F0' : '#374151', fontFamily: 'DM Sans, sans-serif' }}>
                {dragging ? 'Drop your file here' : 'Drag & drop your Excel file here'}
              </p>
              <p className="text-sm mt-1" style={{ color: isDark ? '#94A3B8' : '#9CA3AF' }}>or click to browse</p>
              <p className="text-xs mt-3" style={{ color: isDark ? '#64748B' : '#D1D5DB' }}>Supports .xlsx · .xls · .xlsm</p>
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
                <p className="text-sm mt-2" style={{ color: isDark ? '#CBD5E1' : '#6B7280' }}>Parsing your file…</p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
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