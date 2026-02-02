import type { CashbackTier } from '../../types';

interface Props {
  tiers: Omit<CashbackTier, 'id' | 'card_id'>[];
  onChange: (tiers: Omit<CashbackTier, 'id' | 'card_id'>[]) => void;
}

export default function TierEditor({ tiers, onChange }: Props) {
  const addTier = () => {
    const lastMax = tiers.length > 0 ? (tiers[tiers.length - 1].max_amount ?? 0) : 0;
    onChange([...tiers, { min_amount: lastMax, max_amount: null, rate: 0 }]);
  };

  const removeTier = (idx: number) => {
    onChange(tiers.filter((_, i) => i !== idx));
  };

  const updateTier = (idx: number, field: string, value: string) => {
    const updated = tiers.map((t, i) => {
      if (i !== idx) return t;
      if (field === 'rate') return { ...t, rate: parseFloat(value) || 0 };
      if (field === 'min_amount') return { ...t, min_amount: parseFloat(value) || 0 };
      if (field === 'max_amount') return { ...t, max_amount: value === '' ? null : parseFloat(value) || 0 };
      return t;
    });
    onChange(updated);
  };

  return (
    <div>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
        分級回饋區間
      </label>
      {tiers.map((tier, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <input
            type="number"
            placeholder="起始金額"
            value={tier.min_amount}
            onChange={(e) => updateTier(idx, 'min_amount', e.target.value)}
            style={inputStyle}
          />
          <span>~</span>
          <input
            type="number"
            placeholder="結束金額 (空=無上限)"
            value={tier.max_amount ?? ''}
            onChange={(e) => updateTier(idx, 'max_amount', e.target.value)}
            style={inputStyle}
          />
          <input
            type="number"
            step="0.001"
            placeholder="回饋率"
            value={tier.rate}
            onChange={(e) => updateTier(idx, 'rate', e.target.value)}
            style={{ ...inputStyle, width: '100px' }}
          />
          <span style={{ fontSize: '0.85rem', color: '#666' }}>
            ({(tier.rate * 100).toFixed(1)}%)
          </span>
          <button
            type="button"
            onClick={() => removeTier(idx)}
            style={{ background: '#e94560', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}
          >
            刪除
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addTier}
        style={{ background: '#0f3460', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
      >
        + 新增區間
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #ccc',
  borderRadius: '4px',
  width: '120px',
};
