import { useState, useEffect, useCallback } from 'react';
import type { Card, Transaction, TransactionFormData } from '../types';
import { fetchCards, fetchTransactions, createTransaction, deleteTransaction } from '../api/client';
import TransactionForm from '../components/transaction/TransactionForm';
import TransactionList from '../components/transaction/TransactionList';

export default function TransactionPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedCard, setSelectedCard] = useState<number | undefined>(undefined);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(async () => {
    const [cardsData, txData] = await Promise.all([
      fetchCards(),
      fetchTransactions({ card_id: selectedCard, month }),
    ]);
    setCards(cardsData);
    setTransactions(txData);
  }, [selectedCard, month]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (data: TransactionFormData) => {
    await createTransaction(data);
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此筆消費記錄？')) return;
    await deleteTransaction(id);
    load();
  };

  return (
    <div>
      <h1>消費記錄</h1>
      {cards.length === 0 ? (
        <p style={{ color: '#888' }}>請先至「卡片設定」新增至少一張卡片。</p>
      ) : (
        <TransactionForm cards={cards} onSubmit={handleAdd} />
      )}

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

      <TransactionList transactions={transactions} cards={cards} onDelete={handleDelete} />
    </div>
  );
}

const filterInput: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
};
