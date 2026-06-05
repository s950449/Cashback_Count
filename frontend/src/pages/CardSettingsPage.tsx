import { useState, useEffect, useCallback } from 'react';
import type { Card, CardFormData } from '../types';
import { fetchCards, createCard, updateCard, deleteCard } from '../api/client';
import CardList from '../components/card/CardList';
import CardFormModal from '../components/card/CardFormModal';

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
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCards();
      setCards(data);
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
        <CardList cards={cards} onEdit={handleEdit} onDelete={handleDelete} />
      )}
      {saving && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在儲存卡片...</p>}
      {deletingId && <p style={{ color: '#888', fontSize: '0.9rem' }}>正在刪除卡片 #{deletingId}...</p>}
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
