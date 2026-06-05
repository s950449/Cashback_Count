import type { DashboardSummary } from '../../types';
import CashbackProgress from './CashbackProgress';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
}

export default function MonthlySummary({ summary, loading }: Props) {
  if (loading) {
    return <p style={{ color: '#888' }}>載入中...</p>;
  }

  if (!summary) {
    return <p style={{ color: '#888' }}>請選擇月份。</p>;
  }

  return (
    <div>
      {/* Totals */}
      <div style={totalsRow}>
        <div style={totalCard}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>本月總消費</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            ${summary.total_spent.toLocaleString()}
          </div>
        </div>
        <div style={totalCard}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>本月總回饋</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#16813d' }}>
            ${summary.total_cashback.toLocaleString()}
          </div>
        </div>
        <div style={totalCard}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>平均回饋率</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {summary.total_spent > 0
              ? ((summary.total_cashback / summary.total_spent) * 100).toFixed(2)
              : '0.00'}
            %
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>分類消費明細</h3>
      {summary.categories.length === 0 ? (
        <p style={{ color: '#888' }}>本月無分類資料。</p>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>分類</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>消費</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>回饋</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>筆數</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>回饋率</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>預算</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>使用率</th>
            </tr>
          </thead>
          <tbody>
            {summary.categories.map((category) => (
              <tr key={category.category}>
                <td style={tdStyle}>{category.category}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  ${category.total_spent.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', color: '#16813d', fontWeight: 600 }}>
                  ${category.total_cashback.toLocaleString()}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{category.transaction_count}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {(category.cashback_rate * 100).toFixed(2)}%
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {category.monthly_budget != null ? `$${category.monthly_budget.toLocaleString()}` : '-'}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    color:
                      category.budget_usage_pct != null && category.budget_usage_pct >= 100
                        ? '#b91c1c'
                        : '#213547',
                    fontWeight:
                      category.budget_usage_pct != null && category.budget_usage_pct >= 100 ? 600 : 400,
                  }}
                >
                  {category.budget_usage_pct != null ? `${category.budget_usage_pct.toFixed(1)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Per-card breakdown */}
      <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>各卡回饋明細</h3>
      {summary.cards.length === 0 ? (
        <p style={{ color: '#888' }}>本月無消費記錄。</p>
      ) : (
        <div style={{ background: '#fff', padding: '1rem', borderRadius: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          {summary.cards.map((card) => (
            <CashbackProgress
              key={card.card_id}
              label={`${card.bank_name} - ${card.card_name} (消費 $${card.total_spent.toLocaleString()})`}
              current={card.total_cashback}
              cap={card.monthly_cap}
              percentage={card.cap_usage_pct}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const totalsRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1rem',
};

const totalCard: React.CSSProperties = {
  background: '#fff',
  padding: '1rem',
  borderRadius: '6px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  textAlign: 'center',
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
