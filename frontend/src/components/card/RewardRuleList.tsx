import type { RewardRule } from '../../types';

interface Props {
  rules: RewardRule[];
  onAdd: () => void;
  onEdit: (rule: RewardRule) => void;
  onDelete: (id: number) => void;
}

const rewardKindLabels: Record<RewardRule['reward_kind'], string> = {
  base: '基本回饋',
  mission_bonus: '任務加碼',
  campaign_bonus: '活動回饋',
  other_bonus: '其他加碼',
};

const cycleLabels: Record<RewardRule['cycle_type'], string> = {
  billing_cycle: '帳單週期',
  calendar_month: '日曆月',
};

const stackingLabels: Record<RewardRule['stacking_mode'], string> = {
  stackable: '可疊加',
  exclusive: '擇優',
};

export default function RewardRuleList({ rules, onAdd, onEdit, onDelete }: Props) {
  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h3 style={titleStyle}>回饋規則</h3>
        <button type="button" onClick={onAdd} style={addButton}>
          + 新增規則
        </button>
      </div>
      {rules.length === 0 ? (
        <p style={emptyStyle}>尚未設定拆分規則，會使用卡片層級回饋設定。</p>
      ) : (
        <div style={listStyle}>
          {rules.map((rule) => (
            <div key={rule.id} style={ruleStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={ruleTitleStyle}>
                  <span>{rule.rule_name}</span>
                  {!rule.is_active && <span style={inactiveBadge}>停用</span>}
                </div>
                <div style={metaStyle}>
                  {rewardKindLabels[rule.reward_kind]} | {cycleLabels[rule.cycle_type]} |{' '}
                  {rule.cashback_type === 'fixed'
                    ? `固定 ${((rule.fixed_rate ?? 0) * 100).toFixed(1)}%`
                    : `分級 ${rule.tiers.length} 區間`}
                  {' | '}
                  {rule.calc_method === 'per_transaction' ? '逐筆' : '合併'}
                  {' | '}
                  {rule.rounding_rule === 'floor' ? '無條件捨去' : '四捨五入'}
                  {' | '}
                  {stackingLabels[rule.stacking_mode]}
                  {rule.stacking_mode === 'exclusive' && rule.exclusive_group
                    ? ` (${rule.exclusive_group})`
                    : ''}
                  {rule.monthly_cap != null && ` | 上限 $${rule.monthly_cap.toLocaleString()}`}
                  {rule.payment_methods?.length
                    ? ` | ${rule.payment_methods.join('、')}`
                    : ' | 不限支付工具'}
                  {rule.merchant_keywords?.length
                    ? ` | 店家：${rule.merchant_keywords.join('、')}`
                    : ''}
                  {rule.category_names?.length
                    ? ` | 分類：${rule.category_names.join('、')}`
                    : ''}
                </div>
                {(rule.start_date || rule.end_date) && (
                  <div style={dateStyle}>
                    {rule.start_date ?? '不限'} 至 {rule.end_date ?? '不限'}
                  </div>
                )}
              </div>
              <div style={actionsStyle}>
                <button type="button" onClick={() => onEdit(rule)} style={editButton}>
                  編輯
                </button>
                <button type="button" onClick={() => onDelete(rule.id)} style={deleteButton}>
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  paddingTop: '0.75rem',
  borderTop: '1px solid #eee',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '0.5rem',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.95rem',
};

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const ruleStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  background: '#fafafa',
};

const ruleTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontWeight: 700,
  fontSize: '0.9rem',
};

const metaStyle: React.CSSProperties = {
  marginTop: '0.25rem',
  color: '#555',
  fontSize: '0.82rem',
  lineHeight: 1.5,
};

const dateStyle: React.CSSProperties = {
  marginTop: '0.2rem',
  color: '#777',
  fontSize: '0.8rem',
};

const emptyStyle: React.CSSProperties = {
  margin: 0,
  color: '#888',
  fontSize: '0.85rem',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'start',
  flexShrink: 0,
};

const inactiveBadge: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: '4px',
  background: '#e5e7eb',
  color: '#555',
  fontSize: '0.75rem',
  fontWeight: 600,
};

const addButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '5px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 600,
};

const editButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const deleteButton: React.CSSProperties = {
  background: '#e94560',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
};
