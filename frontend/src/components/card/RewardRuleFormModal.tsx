import { useEffect, useState } from 'react';
import { PAYMENT_METHODS } from '../../types';
import type { Card, PaymentMethod, RewardRule, RewardRuleFormData } from '../../types';
import TierEditor from './TierEditor';

interface Props {
  card: Card;
  rule: RewardRule | null;
  onSave: (data: RewardRuleFormData) => void;
  onClose: () => void;
  isSaving?: boolean;
}

function buildEmptyRule(cardId: number): RewardRuleFormData {
  return {
    card_id: cardId,
    rule_name: '',
    reward_kind: 'base',
    cycle_type: 'billing_cycle',
    cashback_type: 'fixed',
    fixed_rate: null,
    monthly_cap: null,
    calc_method: 'per_transaction',
    rounding_rule: 'floor',
    is_active: true,
    start_date: null,
    end_date: null,
    payment_methods: null,
    stacking_mode: 'stackable',
    exclusive_group: null,
    merchant_keywords: null,
    category_names: null,
    tiers: [],
  };
}

function joinList(values: string[] | null): string {
  return values?.join(', ') ?? '';
}

function splitList(value: string): string[] | null {
  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

export default function RewardRuleFormModal({ card, rule, onSave, onClose, isSaving = false }: Props) {
  const [form, setForm] = useState<RewardRuleFormData>(() => buildEmptyRule(card.id));
  const [merchantKeywordsText, setMerchantKeywordsText] = useState('');
  const [categoryNamesText, setCategoryNamesText] = useState('');

  useEffect(() => {
    if (rule) {
      setForm({
        card_id: rule.card_id,
        rule_name: rule.rule_name,
        reward_kind: rule.reward_kind,
        cycle_type: rule.cycle_type,
        cashback_type: rule.cashback_type,
        fixed_rate: rule.fixed_rate,
        monthly_cap: rule.monthly_cap,
        calc_method: rule.calc_method,
        rounding_rule: rule.rounding_rule,
        is_active: rule.is_active,
        start_date: rule.start_date,
        end_date: rule.end_date,
        payment_methods: rule.payment_methods,
        stacking_mode: rule.stacking_mode,
        exclusive_group: rule.exclusive_group,
        merchant_keywords: rule.merchant_keywords,
        category_names: rule.category_names,
        tiers: rule.tiers.map((tier) => ({
          min_amount: tier.min_amount,
          max_amount: tier.max_amount,
          rate: tier.rate,
        })),
      });
      setMerchantKeywordsText(joinList(rule.merchant_keywords));
      setCategoryNamesText(joinList(rule.category_names));
    } else {
      setForm(buildEmptyRule(card.id));
      setMerchantKeywordsText('');
      setCategoryNamesText('');
    }
  }, [card.id, rule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    onSave({
      ...form,
      rule_name: form.rule_name.trim(),
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      fixed_rate: form.cashback_type === 'fixed' ? form.fixed_rate : null,
      payment_methods: form.payment_methods && form.payment_methods.length > 0 ? form.payment_methods : null,
      exclusive_group: form.stacking_mode === 'exclusive' ? form.exclusive_group?.trim() || null : null,
      merchant_keywords: splitList(merchantKeywordsText),
      category_names: splitList(categoryNamesText),
      tiers: form.cashback_type === 'tiered' ? form.tiers : [],
    });
  };

  const togglePaymentMethod = (method: PaymentMethod) => {
    const selected = form.payment_methods ?? [];
    const next = selected.includes(method)
      ? selected.filter((selectedMethod) => selectedMethod !== method)
      : [...selected, method];
    setForm({ ...form, payment_methods: next.length > 0 ? next : null });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <h2 style={{ marginTop: 0 }}>{rule ? '編輯回饋規則' : '新增回饋規則'}</h2>
        <div style={cardNameStyle}>
          {card.bank_name} - {card.card_name}
        </div>
        <form onSubmit={handleSubmit}>
          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>規則名稱</label>
              <input
                value={form.rule_name}
                onChange={(e) => setForm({ ...form, rule_name: e.target.value })}
                style={inputStyle}
                maxLength={120}
                required
              />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>回饋來源</label>
              <select
                value={form.reward_kind}
                onChange={(e) =>
                  setForm({
                    ...form,
                    reward_kind: e.target.value as RewardRuleFormData['reward_kind'],
                  })
                }
                style={inputStyle}
              >
                <option value="base">基本回饋</option>
                <option value="mission_bonus">任務加碼</option>
                <option value="campaign_bonus">活動回饋</option>
                <option value="other_bonus">其他加碼</option>
              </select>
            </div>
          </div>

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>統計週期</label>
              <select
                value={form.cycle_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cycle_type: e.target.value as RewardRuleFormData['cycle_type'],
                  })
                }
                style={inputStyle}
              >
                <option value="billing_cycle">帳單週期</option>
                <option value="calendar_month">日曆月</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>是否啟用</label>
              <label style={toggleStyle}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                啟用此規則
              </label>
            </div>
          </div>

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>疊加方式</label>
              <select
                value={form.stacking_mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    stacking_mode: e.target.value as RewardRuleFormData['stacking_mode'],
                  })
                }
                style={inputStyle}
              >
                <option value="stackable">可與其他規則疊加</option>
                <option value="exclusive">同群組擇優</option>
              </select>
            </div>
            {form.stacking_mode === 'exclusive' && (
              <div style={rowStyle}>
                <label style={labelStyle}>擇優群組</label>
                <input
                  value={form.exclusive_group ?? ''}
                  onChange={(e) => setForm({ ...form, exclusive_group: e.target.value })}
                  style={inputStyle}
                  maxLength={120}
                  placeholder="例如：transport_bonus"
                />
              </div>
            )}
          </div>

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>回饋類型</label>
              <select
                value={form.cashback_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    cashback_type: e.target.value as RewardRuleFormData['cashback_type'],
                  })
                }
                style={inputStyle}
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
                    min={0}
                    step="0.001"
                    value={form.fixed_rate ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        fixed_rate: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    style={inputStyle}
                  />
                  <span style={percentStyle}>
                    {form.fixed_rate ? `${(form.fixed_rate * 100).toFixed(1)}%` : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {form.cashback_type === 'tiered' && (
            <div style={{ marginBottom: '1rem' }}>
              <TierEditor tiers={form.tiers} onChange={(tiers) => setForm({ ...form, tiers })} />
            </div>
          )}

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>計算方式</label>
              <select
                value={form.calc_method}
                onChange={(e) =>
                  setForm({
                    ...form,
                    calc_method: e.target.value as RewardRuleFormData['calc_method'],
                  })
                }
                style={inputStyle}
              >
                <option value="per_transaction">逐筆計算</option>
                <option value="aggregate">週期合併計算</option>
              </select>
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>捨入規則</label>
              <select
                value={form.rounding_rule}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rounding_rule: e.target.value as RewardRuleFormData['rounding_rule'],
                  })
                }
                style={inputStyle}
              >
                <option value="floor">無條件捨去</option>
                <option value="round">四捨五入</option>
              </select>
            </div>
          </div>

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>週期上限</label>
              <input
                type="number"
                min={0}
                value={form.monthly_cap ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    monthly_cap: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="留空表示無上限"
                style={inputStyle}
              />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>活動期間</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="date"
                  value={form.start_date ?? ''}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value || null })}
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={form.end_date ?? ''}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value || null })}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={rowStyle}>
            <label style={labelStyle}>限制支付工具</label>
            <div style={paymentGridStyle}>
              {PAYMENT_METHODS.map((method) => (
                <label key={method} style={checkboxStyle}>
                  <input
                    type="checkbox"
                    checked={(form.payment_methods ?? []).includes(method)}
                    onChange={() => togglePaymentMethod(method)}
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>

          <div style={gridStyle}>
            <div style={rowStyle}>
              <label style={labelStyle}>店家關鍵字</label>
              <input
                value={merchantKeywordsText}
                onChange={(e) => setMerchantKeywordsText(e.target.value)}
                style={inputStyle}
                placeholder="例如：台鐵, 高鐵"
              />
            </div>
            <div style={rowStyle}>
              <label style={labelStyle}>分類條件</label>
              <input
                value={categoryNamesText}
                onChange={(e) => setCategoryNamesText(e.target.value)}
                style={inputStyle}
                placeholder="例如：交通, 旅遊"
              />
            </div>
          </div>

          <div style={actionsStyle}>
            <button type="button" onClick={onClose} style={secondaryButton} disabled={isSaving}>
              取消
            </button>
            <button type="submit" style={{ ...primaryButton, opacity: isSaving ? 0.7 : 1 }} disabled={isSaving}>
              {isSaving ? '儲存中...' : '儲存規則'}
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
  width: '720px',
  maxWidth: 'calc(100vw - 2rem)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const cardNameStyle: React.CSSProperties = {
  marginTop: '-0.5rem',
  marginBottom: '1rem',
  color: '#666',
  fontSize: '0.9rem',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '1rem',
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

const toggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  minHeight: '36px',
  fontSize: '0.9rem',
};

const paymentGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: '0.5rem',
  padding: '0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  background: '#fafafa',
};

const checkboxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.85rem',
};

const percentStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '0.85rem',
  minWidth: '48px',
};

const actionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  justifyContent: 'flex-end',
  marginTop: '1.5rem',
};

const primaryButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontWeight: 600,
};

const secondaryButton: React.CSSProperties = {
  background: '#e0e0e0',
  color: '#333',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 16px',
  cursor: 'pointer',
};
