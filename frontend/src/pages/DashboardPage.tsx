import { useState, useEffect, useCallback } from 'react';
import type { DashboardSummary } from '../types';
import { exportToGoogleSheets, fetchDashboardSummary } from '../api/client';
import MonthlySummary from '../components/dashboard/MonthlySummary';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === 'string') return response.data.detail;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function DashboardPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDashboardSummary(month);
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(getErrorMessage(err, '載入儀表板失敗'));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    setExporting(true);
    setExportUrl(null);
    setExportError(null);
    try {
      const result = await exportToGoogleSheets({ month });
      setExportUrl(result.url);
    } catch (err) {
      setExportError(getErrorMessage(err, '匯出 Google Sheets 失敗'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>儀表板</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            style={{ ...exportButton, opacity: exporting ? 0.7 : 1 }}
          >
            {exporting ? '匯出中...' : '匯出 Sheets'}
          </button>
        </div>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
      {exportError && <div style={errorStyle}>{exportError}</div>}
      {exportUrl && (
        <div style={successStyle}>
          已匯出：
          <a href={exportUrl} target="_blank" rel="noreferrer" style={{ color: '#0f5132', fontWeight: 600 }}>
            開啟 Google Sheet
          </a>
        </div>
      )}
      <MonthlySummary summary={summary} loading={loading} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  fontSize: '1rem',
};

const exportButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '9px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};

const errorStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  borderRadius: '4px',
  color: '#9f1239',
  fontSize: '0.9rem',
};

const successStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  background: '#ecfdf5',
  border: '1px solid #bbf7d0',
  borderRadius: '4px',
  color: '#0f5132',
  fontSize: '0.9rem',
};
