interface Props {
  label: string;
  current: number;
  cap: number | null;
  percentage: number | null;
}

export default function CashbackProgress({ label, current, cap, percentage }: Props) {
  if (cap == null) {
    return (
      <div style={containerStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
          <span style={{ fontSize: '0.85rem', color: '#16813d' }}>
            回饋 ${current}（無上限）
          </span>
        </div>
      </div>
    );
  }

  const pct = Math.min(percentage ?? 0, 100);

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{label}</span>
        <span style={{ fontSize: '0.85rem' }}>
          ${current} / ${cap} ({pct}%)
        </span>
      </div>
      <div style={barBgStyle}>
        <div
          style={{
            ...barFillStyle,
            width: `${pct}%`,
            background: pct >= 100 ? '#e94560' : pct >= 80 ? '#f0a500' : '#16813d',
          }}
        />
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginBottom: '1rem',
};

const barBgStyle: React.CSSProperties = {
  height: '10px',
  background: '#e0e0e0',
  borderRadius: '5px',
  overflow: 'hidden',
};

const barFillStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: '5px',
  transition: 'width 0.3s ease',
};
