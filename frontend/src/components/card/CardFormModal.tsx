import { useState, useEffect } from 'react';
import type { Card, CardFormData } from '../../types';
import TierEditor from './TierEditor';

interface Props {
  card: Card | null;
  onSave: (data: CardFormData) => void;
  onClose: () => void;
}

const emptyForm: CardFormData = {
  card_name: '',
  bank_name: '',
  billing_day: null,
  cashback_type: 'fixed',
  fixed_rate: null,
  monthly_cap: null,
  calc_method: 'per_transaction',
  rounding_rule: 'floor',
  tiers: [],
};

export default function CardFormModal({ card, onSave, onClose }: Props) {
  const [form, setForm] = useState<CardFormData>(emptyForm);

  useEffect(() => {
    if (card) {
      setForm({
        card_name: card.card_name,
        bank_name: card.bank_name,
        billing_day: card.billing_day,
        cashback_type: card.cashback_type,
        fixed_rate: card.fixed_rate,
        monthly_cap: card.monthly_cap,
        calc_method: card.calc_method,
        rounding_rule: card.rounding_rule,
        tiers: card.tiers.map((t) => ({
          min_amount: t.min_amount,
          max_amount: t.max_amount,
          rate: t.rate,
        })),
      });
    } else {
      setForm(emptyForm);
    }
  }, [card]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>{card ? '編輯卡片' : '新增卡片'}</h2>
        <form onSubmit={handleSubmit}>
          <div style={rowStyle}>
            <label style={labelStyle}>銀行名稱</label>
            <input
              style={inputStyle}
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              required
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>卡片名稱</label>
            <input
              style={inputStyle}
              value={form.card_name}
              onChange={(e) => setForm({ ...form, card_name: e.target.value })}
              required
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>結帳日 (1-28)</label>
            <input
              type="number"
              min={1}
              max={28}
              style={inputStyle}
              value={form.billing_day ?? ''}
              onChange={(e) =>
                setForm({ ...form, billing_day: e.target.value ? parseInt(e.target.value) : null })
              }
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>回饋類型</label>
            <select
              style={inputStyle}
              value={form.cashback_type}
              onChange={(e) =>
                setForm({ ...form, cashback_type: e.target.value as 'fixed' | 'tiered' })
              }
            >
              <option value="fixed">固定回饋率</option>
              <option value="tiered">分級回饋</option>
            </select>
          </div>
          {form.cashback_type === 'fixed' && (
            <div style={rowStyle}>
              <label style={labelStyle}>固定回饋率</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  step="0.001"
                  style={inputStyle}
                  value={form.fixed_rate ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, fixed_rate: e.target.value ? parseFloat(e.target.value) : null })
                  }
                />
                <span style={{ fontSize: '0.85rem', color: '#666' }}>
                  {form.fixed_rate ? `(${(form.fixed_rate * 100).toFixed(1)}%)` : ''}
                </span>
              </div>
            </div>
          )}
          {form.cashback_type === 'tiered' && (
            <div style={{ marginBottom: '1rem' }}>
              <TierEditor tiers={form.tiers} onChange={(tiers) => setForm({ ...form, tiers })} />
            </div>
          )}
          <div style={rowStyle}>
            <label style={labelStyle}>每月回饋上限</label>
            <input
              type="number"
              style={inputStyle}
              placeholder="留空表示無上限"
              value={form.monthly_cap ?? ''}
              onChange={(e) =>
                setForm({ ...form, monthly_cap: e.target.value ? parseFloat(e.target.value) : null })
              }
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>計算方式</label>
            <select
              style={inputStyle}
              value={form.calc_method}
              onChange={(e) =>
                setForm({ ...form, calc_method: e.target.value as 'per_transaction' | 'aggregate' })
              }
            >
              <option value="per_transaction">逐筆計算</option>
              <option value="aggregate">當期合併計算</option>
            </select>
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>捨入規則</label>
            <select
              style={inputStyle}
              value={form.rounding_rule}
              onChange={(e) =>
                setForm({ ...form, rounding_rule: e.target.value as 'floor' | 'round' })
              }
            >
              <option value="floor">無條件捨去</option>
              <option value="round">四捨五入</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} style={btnSecondary}>
              取消
            </button>
            <button type="submit" style={btnPrimary}>
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '8px',
  padding: '2rem',
  width: '600px',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const rowStyle: React.CSSProperties = {
  marginBottom: '1rem',
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

const btnPrimary: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 20px',
  cursor: 'pointer',
  fontWeight: 600,
};

const btnSecondary: React.CSSProperties = {
  background: '#e0e0e0',
  color: '#333',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 20px',
  cursor: 'pointer',
};
