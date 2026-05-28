/**
 * Upload page — entry point for the TNOC Risk Dashboard
 * Design: Saudi Energy themed light/dark landing screen with branded logos
 */

import { useState, useRef, DragEvent } from 'react';
import { Upload, FileSpreadsheet, ArrowRight, AlertCircle, Clock3, Trash2 } from 'lucide-react';
import { parseExcel, getSampleData, DashboardData } from '@/lib/excelParser';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';

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

const HEADER_LEFT_LOGOS = [
  { src: '/assets/map-logo.png', alt: 'TNOC', height: 46 },
  { src: '/assets/se-logo.png', alt: 'Saudi Energy', height: 52 },
];
const NASCO_LOGO = { src: '/assets/nasco-logo.png', alt: 'NASCO', height: 58 };

export default function UploadPage({ onDataLoaded, previousUpload, onLoadPrevious, onClearPrevious }: UploadPageProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();
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
      {/* Header */}
      <header style={{ background: isDark ? '#06162F' : '#FFFFFF', borderBottom: isDark ? '1px solid rgba(125, 211, 252, 0.22)' : '1px solid rgba(31,56,100,0.12)', boxShadow: isDark ? '0 14px 44px rgba(0,0,0,.22)' : '0 12px 34px rgba(31,56,100,.10)', position: 'relative', zIndex: 10 }}>
        <div className="container py-3 flex items-center justify-between gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div className="hidden sm:flex" style={{ alignItems: 'center', gap: 10 }}>
              {HEADER_LEFT_LOGOS.map(logo => (
                <div key={logo.alt} style={{ height: 58, minWidth: 76, padding: '6px 10px', borderRadius: 14, background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 30px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={logo.src} alt={logo.alt} style={{ maxHeight: logo.height, maxWidth: 112, objectFit: 'contain', display: 'block' }} />
                </div>
              ))}
            </div>
            <div>
              <h1 className="font-bold text-xl" style={{ color: isDark ? 'white' : '#1F3864', fontFamily: 'DM Sans, sans-serif' }}>
                TNOC Risk Management Dashboard
              </h1>
              <p className="text-xs mt-0.5" style={{ color: isDark ? '#A7D8FF' : '#38628F' }}>Operations Risk Register — Upload Portal</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ height: 64, width: 82, padding: '6px 10px', borderRadius: 14, background: 'rgba(255,255,255,0.96)', boxShadow: '0 10px 30px rgba(0,0,0,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
              <img src={NASCO_LOGO.src} alt={NASCO_LOGO.alt} style={{ maxHeight: NASCO_LOGO.height, maxWidth: 112, objectFit: 'contain', display: 'block' }} />
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main */}
      <main
        className="flex-1 flex items-center justify-center py-16 px-4"
        style={{
          backgroundImage: `${isDark ? 'linear-gradient(90deg, rgba(2,6,23,.42), rgba(2,6,23,.12))' : 'linear-gradient(90deg, rgba(255,255,255,.55), rgba(255,255,255,.28))'}, url(${pageBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundAttachment: 'scroll',
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

          {/* Info */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'KPI Tiles', desc: 'Auto-calculated from your data' },
              { label: 'Live Charts', desc: 'Doughnut, gauge & bar charts' },
              { label: 'Risk Register', desc: 'Colour-coded score table' },
            ].map(item => (
              <div key={item.label} className="dash-card p-3" style={{ background: isDark ? 'rgba(6, 20, 48, 0.76)' : 'rgba(255,255,255,0.82)', border: isDark ? '1px solid rgba(125,211,252,.18)' : '1px solid rgba(31,56,100,.08)', backdropFilter: 'blur(12px)' }}>
                <p className="font-bold text-xs" style={{ color: isDark ? '#7DD3FC' : '#1F3864', fontFamily: 'DM Sans, sans-serif' }}>{item.label}</p>
                <p className="text-xs mt-0.5" style={{ color: isDark ? '#94A3B8' : '#9CA3AF' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
