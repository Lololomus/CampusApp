// ===== FILE: ReviewModal.js =====
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { createMarketReview } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { DragHandle } from '../shared/SwipeableModal';
import { useSwipe } from '../../hooks/useSwipe';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

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
  const [isVisible, setIsVisible] = useState(false);
  const sheetRef = useRef(null);

  useEffect(() => {
    lockBodyScroll();
    const t = setTimeout(() => setIsVisible(true), 20);
    return () => {
      clearTimeout(t);
      unlockBodyScroll();
    };
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipe({
    onSwipeDown: handleClose,
    threshold: 80,
  });

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

  const modal = (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 2100,
        display: 'flex', alignItems: 'flex-end',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
      onClick={handleClose}
    >
      <div
        ref={sheetRef}
        style={{
          width: '100%',
          background: C.surface,
          borderRadius: '20px 20px 0 0',
          padding: '0 0 env(safe-area-inset-bottom, 16px)',
          transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
        onClick={e => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <DragHandle />

        {/* Заголовок */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 20px 16px' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>Оцени продавца</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>«{itemTitle}»</div>
          </div>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: C.muted }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Имя продавца */}
        <div style={{ textAlign: 'center', padding: '0 20px 12px' }}>
          <div style={{ fontSize: 15, color: C.muted }}>
            Как прошло с <span style={{ fontWeight: 700, color: C.text }}>{sellerName}</span>?
          </div>
        </div>

        {/* Звёзды */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '8px 20px 20px' }}>
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
        <div style={{ padding: '0 20px 20px' }}>
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

        {/* Кнопки */}
        <div style={{ display: 'flex', gap: 12, padding: '0 20px 16px' }}>
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
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ReviewModal;
