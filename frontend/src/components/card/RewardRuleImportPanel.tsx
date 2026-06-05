import { useState } from 'react';
import type { Card, RewardRule, RewardRuleDraft } from '../../types';

interface Props {
  card: Card;
  drafts: RewardRuleDraft[];
  isImporting: boolean;
  deletingDraftId: number | null;
  onImport: (cardId: number, sourceText: string) => Promise<void>;
  onDelete: (draftId: number) => void;
}

const rewardKindLabels: Record<RewardRule['reward_kind'], string> = {
  base: '基本回饋',
  mission_bonus: '任務加碼',
  campaign_bonus: '活動回饋',
  other_bonus: '其他加碼',
};

const cycleLabels: Record<RewardRule['cycle_type'], string> = {
  billing_cycle: '帳單月',
  calendar_month: '日曆月',
};

const stackingLabels: Record<RewardRule['stacking_mode'], string> = {
  stackable: '可疊加',
  exclusive: '擇優',
};

export default function RewardRuleImportPanel({
  card,
  drafts,
  isImporting,
  deletingDraftId,
  onImport,
  onDelete,
}: Props) {
  const [sourceText, setSourceText] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalized = sourceText.trim();
    if (!normalized) return;
    await onImport(card.id, normalized);
    setSourceText('');
  };

  return (
    <section style={containerStyle} aria-label={`${card.card_name} 規則匯入草稿`}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <label htmlFor={`rule-import-${card.id}`} style={labelStyle}>
          規則匯入草稿
        </label>
        <textarea
          id={`rule-import-${card.id}`}
          value={sourceText}
          onChange={(event) => setSourceText(event.target.value)}
          placeholder="貼上銀行活動文字或網頁內容"
          maxLength={50000}
          rows={4}
          style={textareaStyle}
        />
        <div style={formFooterStyle}>
          <span style={counterStyle}>{sourceText.length.toLocaleString()} / 50,000</span>
          <button type="submit" disabled={isImporting || !sourceText.trim()} style={importButton}>
            {isImporting ? '解析中...' : '解析草稿'}
          </button>
        </div>
      </form>

      {drafts.length > 0 && (
        <div style={draftListStyle}>
          {drafts.map((draft) => (
            <article key={draft.id} style={draftStyle}>
              <div style={{ minWidth: 0 }}>
                <div style={draftTitleStyle}>{draft.parsed_payload.rule_name}</div>
                <div style={metaStyle}>
                  {rewardKindLabels[draft.parsed_payload.reward_kind]} |{' '}
                  {cycleLabels[draft.parsed_payload.cycle_type]} |{' '}
                  {draft.parsed_payload.fixed_rate == null
                    ? '回饋率待確認'
                    : `${(draft.parsed_payload.fixed_rate * 100).toFixed(1)}%`}
                  {draft.parsed_payload.monthly_cap != null &&
                    ` | 上限 $${draft.parsed_payload.monthly_cap.toLocaleString()}`}
                  {' | '}
                  {stackingLabels[draft.parsed_payload.stacking_mode]}
                  {draft.parsed_payload.payment_methods?.length
                    ? ` | ${draft.parsed_payload.payment_methods.join('、')}`
                    : ' | 不限支付工具'}
                  {draft.parsed_payload.merchant_keywords?.length
                    ? ` | 店家：${draft.parsed_payload.merchant_keywords.join('、')}`
                    : ''}
                  {draft.parsed_payload.category_names?.length
                    ? ` | 分類：${draft.parsed_payload.category_names.join('、')}`
                    : ''}
                </div>
                {draft.parsed_payload.warnings.length > 0 && (
                  <ul style={warningListStyle}>
                    {draft.parsed_payload.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}
                <p style={sourceStyle}>{draft.source_text}</p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(draft.id)}
                disabled={deletingDraftId === draft.id}
                style={deleteButton}
              >
                {deletingDraftId === draft.id ? '刪除中...' : '刪除'}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const containerStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  paddingTop: '0.75rem',
  borderTop: '1px solid #eee',
};

const formStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.95rem',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '96px',
  resize: 'vertical',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '0.65rem',
  font: 'inherit',
  lineHeight: 1.5,
  boxSizing: 'border-box',
};

const formFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '0.75rem',
};

const counterStyle: React.CSSProperties = {
  color: '#777',
  fontSize: '0.8rem',
};

const importButton: React.CSSProperties = {
  background: '#0f3460',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '0.85rem',
  fontWeight: 600,
};

const draftListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginTop: '0.75rem',
};

const draftStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.75rem',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  background: '#fcfcfc',
};

const draftTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '0.9rem',
};

const metaStyle: React.CSSProperties = {
  marginTop: '0.25rem',
  color: '#555',
  fontSize: '0.82rem',
  lineHeight: 1.5,
};

const warningListStyle: React.CSSProperties = {
  margin: '0.4rem 0 0',
  paddingLeft: '1.1rem',
  color: '#9a3412',
  fontSize: '0.82rem',
};

const sourceStyle: React.CSSProperties = {
  margin: '0.4rem 0 0',
  color: '#777',
  fontSize: '0.78rem',
  lineHeight: 1.5,
  overflowWrap: 'anywhere',
};

const deleteButton: React.CSSProperties = {
  background: '#e94560',
  color: '#fff',
  border: 'none',
  borderRadius: '4px',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  alignSelf: 'flex-start',
  flexShrink: 0,
};
