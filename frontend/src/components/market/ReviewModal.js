// ===== FILE: ReviewModal.js =====
import React, { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { createMarketReview } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import SwipeableModal from '../shared/SwipeableModal';

const C = {
  bg: '#050505',
  surface: '#1C1C1E',
  elevated: '#2C2C2E',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  muted: '#8E8E93',
  lime: '#D4FF00',
};

const ReviewModal = ({ sellerId, sellerName, itemId, dealId, itemTitle, onClose, onSuccess }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  // Внутренний isOpen — SwipeableModal управляет exit-анимацией
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!rating) {
      hapticFeedback('error');
      toast.error('Выбери оценку');
      return;
    }
    setLoading(true);
    try {
      await createMarketReview({
        deal_id: dealId,
        item_id: itemId,
        rating,
        text: text.trim() || undefined,
      });
      hapticFeedback('success');
      toast.success('Отзыв оставлен!');
      onSuccess?.();
      handleClose();
    } catch (err) {
      hapticFeedback('error');
      if (err.response?.status === 409) toast.error('Отзыв уже оставлен');
      else toast.error('Ошибка отправки');
    } finally {
      setLoading(false);
    }
  };

  const displayStars = hovered || rating;

  const footer = (
    <div style={{ display: 'flex', gap: 12 }}>
      <button
        onClick={handleClose}
        style={{
          flex: 1, padding: '14px', borderRadius: 14,
          background: C.elevated,
          border: 'none', cursor: 'pointer',
          fontSize: 15, fontWeight: 700, color: C.muted,
        }}
      >
        Пропустить
      </button>
      <button
        onClick={handleSubmit}
        disabled={!rating || loading}
        style={{
          flex: 2, padding: '14px', borderRadius: 14,
          background: rating ? C.lime : C.elevated,
          border: 'none', cursor: rating ? 'pointer' : 'default',
          fontSize: 15, fontWeight: 700,
          color: rating ? '#000' : C.muted,
          opacity: loading ? 0.7 : 1,
          transition: 'all 0.2s ease',
        }}
      >
        {loading ? 'Отправка...' : `Отправить ${rating ? '⭐'.repeat(rating) : ''}`}
      </button>
    </div>
  );

  return (
    <SwipeableModal isOpen={isOpen} onClose={handleClose} footer={footer} zIndex={2100}>
      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 16px' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Оцени продавца</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>«{itemTitle}»</div>
        </div>
        <button
          onClick={handleClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.muted,
            minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Имя продавца */}
      <div style={{ textAlign: 'center', paddingBottom: 12 }}>
        <div style={{ fontSize: 15, color: C.muted }}>
          Как прошло с <span style={{ fontWeight: 700, color: C.text }}>{sellerName}</span>?
        </div>
      </div>

      {/* Звёзды */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 0 20px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            onClick={() => { hapticFeedback('selection'); setRating(i); }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 40, padding: 4, lineHeight: 1,
              opacity: displayStars >= i ? 1 : 0.3,
              transform: displayStars >= i ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.15s ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ⭐
          </button>
        ))}
      </div>

      {/* Текст (опциональный) */}
      <div style={{ paddingBottom: 8 }}>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Комментарий (необязательно)..."
          maxLength={300}
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.elevated,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '12px 14px',
            fontSize: 15, color: C.text,
            resize: 'none', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <div style={{ textAlign: 'right', fontSize: 12, color: C.muted, marginTop: 4 }}>
          {text.length}/300
        </div>
      </div>
    </SwipeableModal>
  );
};

export default ReviewModal;
