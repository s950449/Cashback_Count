import type { ReactNode } from 'react';
import type { Card } from '../../types';

interface Props {
  cards: Card[];
  onEdit: (card: Card) => void;
  onDelete: (id: number) => void;
  renderDetails?: (card: Card) => ReactNode;
}

export default function CardList({ cards, onEdit, onDelete, renderDetails }: Props) {
  if (cards.length === 0) {
    return <p style={{ color: '#888' }}>尚未設定任何卡片。</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {cards.map((card) => (
        <div key={card.id} style={cardStyle}>
          <div style={cardHeaderStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {card.bank_name} - {card.card_name}
              </div>
              <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '4px' }}>
                {card.cashback_type === 'fixed'
                  ? `固定 ${((card.fixed_rate ?? 0) * 100).toFixed(1)}%`
                  : `分級回饋 (${card.tiers.length} 個區間)`}
                {' | '}
                {card.calc_method === 'per_transaction' ? '逐筆計算' : '合併計算'}
                {' | '}
                {card.rounding_rule === 'floor' ? '無條件捨去' : '四捨五入'}
                {card.monthly_cap != null && ` | 上限 $${card.monthly_cap}`}
                {card.billing_day != null && ` | 結帳日: ${card.billing_day}號`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => onEdit(card)} style={btnEdit}>
                編輯
              </button>
              <button onClick={() => onDelete(card.id)} style={btnDelete}>
                刪除
              </button>
            </div>
          </div>
          {renderDetails?.(card)}
        </div>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '1rem',
  background: '#fff',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  width: '100%',
};

const btnEdit: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
};

const btnDelete: React.CSSProperties = {
  background: '#e94560',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
};
