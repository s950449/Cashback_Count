import { useState, useEffect, useCallback } from 'react';
import type { Card, CardFormData } from '../types';
import { fetchCards, createCard, updateCard, deleteCard } from '../api/client';
import CardList from '../components/card/CardList';
import CardFormModal from '../components/card/CardFormModal';

export default function CardSettingsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  const load = useCallback(async () => {
    const data = await fetchCards();
    setCards(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (data: CardFormData) => {
    if (editingCard) {
      await updateCard(editingCard.id, data);
    } else {
      await createCard(data);
    }
    setShowModal(false);
    setEditingCard(null);
    load();
  };

  const handleEdit = (card: Card) => {
    setEditingCard(card);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('確定刪除此卡片？相關消費記錄也會一併刪除。')) return;
    await deleteCard(id);
    load();
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
      <CardList cards={cards} onEdit={handleEdit} onDelete={handleDelete} />
      {showModal && (
        <CardFormModal
          card={editingCard}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingCard(null);
          }}
        />
      )}
    </div>
  );
}
