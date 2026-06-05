import { useState, useEffect, useCallback } from 'react';
import type { Card, CardFormData, RewardRule, RewardRuleDraft, RewardRuleFormData } from '../types';
import {
  createCard,
  createRewardRule,
  deleteCard,
  deleteRewardRule,
  deleteRewardRuleDraft,
  fetchCards,
  fetchRewardRuleDrafts,
  fetchRewardRules,
  importRewardRuleDraft,
  updateCard,
  updateRewardRule,
} from '../api/client';
import CardList from '../components/card/CardList';
import CardFormModal from '../components/card/CardFormModal';
import RewardRuleFormModal from '../components/card/RewardRuleFormModal';
import RewardRuleList from '../components/card/RewardRuleList';
import RewardRuleImportPanel from '../components/card/RewardRuleImportPanel';

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    if (typeof response?.data?.detail === 'string') return response.data.detail;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export default function CardSettingsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [rewardRules, setRewardRules] = useState<RewardRule[]>([]);
  const [rewardRuleDrafts, setRewardRuleDrafts] = useState<RewardRuleDraft[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [ruleCard, setRuleCard] = useState<Card | null>(null);
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingRuleId, setDeletingRuleId] = useState<number | null>(null);
  const [importingDraftCardId, setImportingDraftCardId] = useState<number | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cardsData, rulesData, draftsData] = await Promise.all([
        fetchCards(),
        fetchRewardRules(),
        fetchRewardRuleDrafts(),
      ]);
      setCards(cardsData);
      setRewardRules(rulesData);
      setRewardRuleDrafts(draftsData);
    } catch (err) {
      setError(getErrorMessage(err, '載入卡片失敗'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (data: CardFormData) => {
    setSaving(true);
    setError(null);
    try {
      if (editingCard) {
        await updateCard(editingCard.id, data);
      } else {
        await createCard(data);
      }
      setShowModal(false);
      setEditingCard(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, editingCard ? '更新卡片失敗' : '新增卡片失敗'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此卡片？相關消費記錄也會一併刪除。')) return;
    setDeletingId(id);
    setError(null);
    try {
      await deleteCard(id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '刪除卡片失敗'));
    } finally {
      setDeletingId(null);
    }
  };

  const rulesByCardId = rewardRules.reduce<Record<number, RewardRule[]>>((acc, rule) => {
    acc[rule.card_id] = [...(acc[rule.card_id] ?? []), rule];
    return acc;
  }, {});

  const draftsByCardId = rewardRuleDrafts.reduce<Record<number, RewardRuleDraft[]>>((acc, draft) => {
    acc[draft.card_id] = [...(acc[draft.card_id] ?? []), draft];
    return acc;
  }, {});

  const handleAddRule = (card: Card) => {
    setRuleCard(card);
    setEditingRule(null);
  };

  const handleEditRule = (card: Card, rule: RewardRule) => {
    setRuleCard(card);
    setEditingRule(rule);
  };

  const handleSaveRule = async (data: RewardRuleFormData) => {
    setSavingRule(true);
    setError(null);
    try {
      if (editingRule) {
        await updateRewardRule(editingRule.id, data);
      } else {
        await createRewardRule(data);
      }
      setRuleCard(null);
      setEditingRule(null);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, editingRule ? '更新回饋規則失敗' : '新增回饋規則失敗'));
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('確定刪除此回饋規則？既有交易回饋會重新計算。')) return;
    setDeletingRuleId(id);
    setError(null);
    try {
      await deleteRewardRule(id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '刪除回饋規則失敗'));
    } finally {
      setDeletingRuleId(null);
    }
  };

  const handleImportDraft = async (cardId: number, sourceText: string) => {
    setImportingDraftCardId(cardId);
    setError(null);
    try {
      await importRewardRuleDraft(cardId, sourceText);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '解析回饋規則草稿失敗'));
    } finally {
      setImportingDraftCardId(null);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    setDeletingDraftId(id);
    setError(null);
    try {
      await deleteRewardRuleDraft(id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, '刪除回饋規則草稿失敗'));
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>卡片設定</h1>
        <button
          onClick={() => {
            setEditingCard(null);
            setShowModal(true);
          }}
          style={{
            background: '#0f3460',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 20px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + 新增卡片
        </button>
      </div>
      {error && <div style={errorStyle}>{error}</div>}
      {loading ? (
        <p style={{ color: '#888' }}>載入中...</p>
      ) : (
        <CardList
          cards={cards}
          onEdit={handleEdit}
          onDelete={handleDelete}
          renderDetails={(card) => (
            <>
              <RewardRuleList
                rules={rulesByCardId[card.id] ?? []}
                onAdd={() => handleAddRule(card)}
                onEdit={(rule) => handleEditRule(card, rule)}
                onDelete={handleDeleteRule}
              />
              <RewardRuleImportPanel
                card={card}
                drafts={draftsByCardId[card.id] ?? []}
                isImporting={importingDraftCardId === card.id}
                deletingDraftId={deletingDraftId}
                onImport={handleImportDraft}
                onDelete={handleDeleteDraft}
              />
            </>
          )}
        />
      )}
      {saving && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在儲存卡片...</p>}
      {savingRule && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在儲存回饋規則...</p>}
      {deletingId && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在刪除卡片 #{deletingId}...</p>}
      {deletingRuleId && (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>正在刪除回饋規則 #{deletingRuleId}...</p>
      )}
      {deletingDraftId && (
        <p style={{ color: '#888', fontSize: '0.9rem' }}>正在刪除回饋規則草稿 #{deletingDraftId}...</p>
      )}
      {showModal && (
        <CardFormModal
          card={editingCard}
          onSave={handleSave}
          isSaving={saving}
          onClose={() => {
            setShowModal(false);
            setEditingCard(null);
          }}
        />
      )}
      {ruleCard && (
        <RewardRuleFormModal
          card={ruleCard}
          rule={editingRule}
          onSave={handleSaveRule}
          isSaving={savingRule}
          onClose={() => {
            setRuleCard(null);
            setEditingRule(null);
          }}
        />
      )}
    </div>
  );
}

const errorStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  marginBottom: '1rem',
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  borderRadius: '4px',
  color: '#9f1239',
  fontSize: '0.9rem',
};
