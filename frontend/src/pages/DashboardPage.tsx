import { useState, useEffect, useCallback } from 'react';
import type { CategoryBudget, CategoryBudgetFormData, DashboardSummary } from '../types';
import {
  createCategoryBudget,
  deleteCategoryBudget,
  exportToGoogleSheets,
  fetchCategoryBudgets,
  fetchDashboardSummary,
  updateCategoryBudget,
} from '../api/client';
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
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [budgetForm, setBudgetForm] = useState<CategoryBudgetFormData>({
    category: '',
    monthly_budget: 0,
  });
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

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

  const loadBudgets = useCallback(async () => {
    setBudgetError(null);
    try {
      const data = await fetchCategoryBudgets();
      setBudgets(data);
    } catch (err) {
      setBudgetError(getErrorMessage(err, '載入分類預算失敗'));
    }
  }, []);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

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

  const resetBudgetForm = () => {
    setBudgetForm({ category: '', monthly_budget: 0 });
    setEditingBudgetId(null);
  };

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!budgetForm.category.trim() || budgetForm.monthly_budget <= 0 || savingBudget) return;

    setSavingBudget(true);
    setBudgetError(null);
    try {
      const payload = {
        category: budgetForm.category.trim(),
        monthly_budget: budgetForm.monthly_budget,
      };
      if (editingBudgetId) {
        await updateCategoryBudget(editingBudgetId, payload);
      } else {
        await createCategoryBudget(payload);
      }
      resetBudgetForm();
      await Promise.all([loadBudgets(), load()]);
    } catch (err) {
      setBudgetError(getErrorMessage(err, '儲存分類預算失敗'));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleEditBudget = (budget: CategoryBudget) => {
    setEditingBudgetId(budget.id);
    setBudgetForm({
      category: budget.category,
      monthly_budget: budget.monthly_budget,
    });
  };

  const handleDeleteBudget = async (id: number) => {
    if (!confirm('確定刪除此分類預算？')) return;

    setBudgetError(null);
    try {
      await deleteCategoryBudget(id);
      if (editingBudgetId === id) resetBudgetForm();
      await Promise.all([loadBudgets(), load()]);
    } catch (err) {
      setBudgetError(getErrorMessage(err, '刪除分類預算失敗'));
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
      <section style={budgetSection}>
        <h2 style={sectionTitle}>分類預算</h2>
        {budgetError && <div style={errorStyle}>{budgetError}</div>}
        <form onSubmit={handleBudgetSubmit} style={budgetFormStyle}>
          <input
            value={budgetForm.category}
            onChange={(e) => setBudgetForm({ ...budgetForm, category: e.target.value })}
            placeholder="分類"
            style={inputStyle}
            required
          />
          <input
            type="number"
            min={1}
            value={budgetForm.monthly_budget || ''}
            onChange={(e) =>
              setBudgetForm({
                ...budgetForm,
                monthly_budget: e.target.value ? parseFloat(e.target.value) : 0,
              })
            }
            placeholder="月預算"
            style={inputStyle}
            required
          />
          <button
            type="submit"
            disabled={savingBudget}
            style={{ ...exportButton, opacity: savingBudget ? 0.7 : 1 }}
          >
            {savingBudget ? '儲存中...' : editingBudgetId ? '更新預算' : '新增預算'}
          </button>
          {editingBudgetId && (
            <button type="button" onClick={resetBudgetForm} style={secondaryButton}>
              取消
            </button>
          )}
        </form>
        {budgets.length === 0 ? (
          <p style={{ color: '#888' }}>尚未設定分類預算。</p>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>分類</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>月預算</th>
                <th style={thStyle}>操作</th>
              </tr>
            </thead>
            <tbody>
              {budgets.map((budget) => (
                <tr key={budget.id}>
                  <td style={tdStyle}>{budget.category}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    ${budget.monthly_budget.toLocaleString()}
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" onClick={() => handleEditBudget(budget)} style={smallPrimaryButton}>
                        編輯
                      </button>
                      <button type="button" onClick={() => handleDeleteBudget(budget.id)} style={dangerButton}>
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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

const budgetSection: React.CSSProperties = {
  marginTop: '1.5rem',
};

const sectionTitle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: '1rem',
  fontSize: '1.1rem',
};

const budgetFormStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
  flexWrap: 'wrap',
  marginBottom: '1rem',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '1rem',
};

const secondaryButton: React.CSSProperties = {
  background: '#e0e0e0',
  color: '#333',
  border: 'none',
  borderRadius: '4px',
  padding: '9px 14px',
  cursor: 'pointer',
};

const smallPrimaryButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const dangerButton: React.CSSProperties = {
  background: '#e94560',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#fff',
  borderRadius: '6px',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  background: '#f0f0f0',
  fontWeight: 600,
  fontSize: '0.85rem',
  borderBottom: '1px solid #ddd',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #eee',
  fontSize: '0.9rem',
};
