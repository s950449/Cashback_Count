import { useState } from 'react';
import type { Card, TransactionFormData } from '../../types';

interface Props {
  cards: Card[];
  onSubmit: (data: TransactionFormData) => void;
}

export default function TransactionForm({ cards, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<TransactionFormData>({
    card_id: cards[0]?.id ?? 0,
    amount: 0,
    note: '',
    transaction_date: today,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.card_id || form.amount <= 0) return;
    onSubmit(form);
    setForm({ ...form, amount: 0, note: '' });
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <div style={rowStyle}>
        <label style={labelStyle}>卡片</label>
        <select
          style={inputStyle}
          value={form.card_id}
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
      <button type="submit" style={btnStyle}>
        新增消費
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
