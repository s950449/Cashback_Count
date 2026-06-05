import { useState, useEffect, useCallback } from 'react';
import type { Card, Transaction, TransactionFormData } from '../types';
import {
  fetchCards,
  fetchTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
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
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, data);
        setEditingTransaction(null);
      } else {
        await createTransaction(data);
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
    try {
      await deleteTransaction(id);
      if (editingTransaction?.id === id) setEditingTransaction(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '刪除消費記錄失敗'));
    } finally {
      setDeletingId(null);
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
