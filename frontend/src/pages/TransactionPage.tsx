import { useState, useEffect, useCallback } from 'react';
import type { Card, Transaction, TransactionFormData } from '../types';
import {
  fetchCards,
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  importTransactionsCsv,
} from '../api/client';
import TransactionForm from '../components/transaction/TransactionForm';
import TransactionList from '../components/transaction/TransactionList';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === 'string') return response.data.detail;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function TransactionPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importInputKey, setImportInputKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsData, txData] = await Promise.all([
        fetchCards(),
        fetchTransactions({ card_id: selectedCard, month }),
      ]);
      setCards(cardsData);
      setTransactions(txData);
    } catch (err) {
      setError(getErrorMessage(err, '載入消費記錄失敗'));
    } finally {
      setLoading(false);
    }
  }, [selectedCard, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (data: TransactionFormData) => {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data);
        setEditingTransaction(null);
        setSuccessMessage('已更新消費記錄');
      } else {
        await createTransaction(data);
        setSuccessMessage('已新增消費記錄');
      }
      await load();
    } catch (err) {
      setError(getErrorMessage(err, editingTransaction ? '更新消費記錄失敗' : '新增消費記錄失敗'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此筆消費記錄？')) return;
    setDeletingId(id);
    setError(null);
    setSuccessMessage(null);
    try {
      await deleteTransaction(id);
      if (editingTransaction?.id === id) setEditingTransaction(null);
      await load();
      setSuccessMessage('已刪除消費記錄');
    } catch (err) {
      setError(getErrorMessage(err, '刪除消費記錄失敗'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleImport = async () => {
    if (!importFile || importing) return;
    setImporting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const csvText = await importFile.text();
      const result = await importTransactionsCsv(csvText);
      setImportFile(null);
      setImportInputKey((key) => key + 1);
      await load();
      setSuccessMessage(`已匯入 ${result.imported_count} 筆消費記錄`);
    } catch (err) {
      setError(getErrorMessage(err, '匯入 CSV 失敗'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <h1>消費記錄</h1>
      {cards.length === 0 ? (
        <p style={{ color: '#888' }}>請先至「卡片設定」新增至少一張卡片。</p>
      ) : (
        <TransactionForm
          cards={cards}
          onSubmit={handleAdd}
          initialTransaction={editingTransaction}
          isSubmitting={submitting}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      {error && <div style={errorStyle}>{error}</div>}
      {successMessage && <div style={successStyle}>{successMessage}</div>}

      <section style={importPanel}>
        <div>
          <h2 style={sectionTitle}>CSV 匯入</h2>
          <p style={helperText}>必要欄位：card_id, amount, transaction_date, note；可選欄位：merchant, category</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            key={importInputKey}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            style={fileInput}
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={!importFile || importing}
            style={{ ...importButton, opacity: !importFile || importing ? 0.65 : 1 }}
          >
            {importing ? '匯入中...' : '匯入 CSV'}
          </button>
        </div>
      </section>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <div>
          <label style={{ fontWeight: 600, marginRight: '0.5rem', fontSize: '0.9rem' }}>
            月份:
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={filterInput}
          />
        </div>
        <div>
          <label style={{ fontWeight: 600, marginRight: '0.5rem', fontSize: '0.9rem' }}>
            卡片:
          </label>
          <select
            value={selectedCard ?? ''}
            onChange={(e) =>
              setSelectedCard(e.target.value ? parseInt(e.target.value) : undefined)
            }
            style={filterInput}
          >
            <option value="">全部卡片</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.bank_name} - {c.card_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>載入中...</p>
      ) : (
        <TransactionList
          transactions={transactions}
          cards={cards}
          onEdit={setEditingTransaction}
          onDelete={handleDelete}
        />
      )}
      {deletingId && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在刪除記錄 #{deletingId}...</p>}
    </div>
  );
}

const filterInput: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
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

const importPanel: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '1rem',
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '1rem',
  marginBottom: '1rem',
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
};

const helperText: React.CSSProperties = {
  margin: '0.25rem 0 0',
  color: '#666',
  fontSize: '0.85rem',
};

const fileInput: React.CSSProperties = {
  maxWidth: '280px',
};

const importButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 14px',
  cursor: 'pointer',
  fontWeight: 600,
};
