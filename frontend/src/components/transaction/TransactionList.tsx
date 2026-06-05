import type { Transaction, Card } from '../../types';

interface Props {
  transactions: Transaction[];
  cards: Card[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: number) => void;
}

export default function TransactionList({ transactions, cards, onEdit, onDelete }: Props) {
  const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));

  if (transactions.length === 0) {
    return <p style={{ color: '#888' }}>本月尚無消費記錄。</p>;
  }

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>日期</th>
          <th style={thStyle}>卡片</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>回饋</th>
          <th style={thStyle}>備註</th>
          <th style={thStyle}>操作</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((t) => {
          const card = cardMap[t.card_id];
          return (
            <tr key={t.id}>
              <td style={tdStyle}>{t.transaction_date}</td>
              <td style={tdStyle}>
                {card ? `${card.bank_name} - ${card.card_name}` : `卡片 #${t.card_id}`}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right' }}>
                ${t.amount.toLocaleString()}
              </td>
              <td style={{ ...tdStyle, textAlign: 'right', color: '#16813d', fontWeight: 600 }}>
                ${t.cashback ?? 0}
              </td>
              <td style={tdStyle}>{t.note || '-'}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onEdit(t)}
                    style={{
                      background: '#0f3460',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    編輯
                  </button>
                <button
                  onClick={() => onDelete(t.id)}
                  style={{
                    background: '#e94560',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  刪除
                </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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
