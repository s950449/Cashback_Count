import { useEffect, useState } from 'react';
import type { Card, Transaction, TransactionFormData } from '../../types';

interface Props {
  cards: Card[];
  onSubmit: (data: TransactionFormData) => void;
  initialTransaction?: Transaction | null;
  isSubmitting?: boolean;
  onCancel?: () => void;
}

function getInitialForm(cards: Card[], transaction?: Transaction | null): TransactionFormData {
  if (transaction) {
    return {
      card_id: transaction.card_id,
      amount: transaction.amount,
      note: transaction.note ?? '',
      transaction_date: transaction.transaction_date,
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  return {
    card_id: cards[0]?.id ?? 0,
    amount: 0,
    note: '',
    transaction_date: today,
  };
}

export default function TransactionForm({
  cards,
  onSubmit,
  initialTransaction = null,
  isSubmitting = false,
  onCancel,
}: Props) {
  const [form, setForm] = useState<TransactionFormData>({
    ...getInitialForm(cards, initialTransaction),
  });
  const isEditing = initialTransaction != null;
  const selectedCardId = cards.some((card) => card.id === form.card_id)
    ? form.card_id
    : cards[0]?.id ?? 0;

  useEffect(() => {
    setForm(getInitialForm(cards, initialTransaction));
  }, [cards, initialTransaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || form.amount <= 0 || isSubmitting) return;
    onSubmit({ ...form, card_id: selectedCardId });
    if (!isEditing) {
      setForm({ ...form, card_id: selectedCardId, amount: 0, note: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      {isEditing && (
        <div style={editBanner}>
          <span>編輯消費記錄 #{initialTransaction.id}</span>
          <button type="button" onClick={onCancel} style={linkButton}>
            取消
          </button>
        </div>
      )}
      <div style={rowStyle}>
        <label style={labelStyle}>卡片</label>
        <select
          style={inputStyle}
          value={selectedCardId}
          onChange={(e) => setForm({ ...form, card_id: parseInt(e.target.value) })}
          required
        >
          <option value={0} disabled>
            選擇卡片
          </option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.bank_name} - {c.card_name}
            </option>
          ))}
        </select>
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>消費金額</label>
        <input
          type="number"
          min={1}
          style={inputStyle}
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
          required
        />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>消費日期</label>
        <input
          type="date"
          style={inputStyle}
          value={form.transaction_date}
          onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
          required
        />
      </div>
      <div style={rowStyle}>
        <label style={labelStyle}>備註</label>
        <input
          style={inputStyle}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="選填"
        />
      </div>
      <button type="submit" style={{ ...btnStyle, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
        {isSubmitting ? '儲存中...' : isEditing ? '儲存修改' : '新增消費'}
      </button>
    </form>
  );
}

const formStyle: React.CSSProperties = {
  background: '#fff',
  padding: '1.25rem',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  marginBottom: '1.5rem',
};

const rowStyle: React.CSSProperties = {
  marginBottom: '0.75rem',
};

const editBanner: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem',
  marginBottom: '1rem',
  background: '#eef6ff',
  border: '1px solid #b8d9f5',
  borderRadius: '4px',
  fontSize: '0.9rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '0.25rem',
  fontSize: '0.9rem',
};

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '100%',
  boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '10px 24px',
  cursor: 'pointer',
  fontWeight: 600,
  width: '100%',
};

const linkButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#0f3460',
  cursor: 'pointer',
  fontWeight: 600,
};
