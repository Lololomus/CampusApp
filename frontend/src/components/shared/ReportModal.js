// ===== 📄 ФАЙЛ: frontend/src/components/shared/ReportModal.js =====
import React, { useState, useEffect } from 'react';
import { Send, Check } from 'lucide-react';
import { createReport } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from './Toast';
import theme from '../../theme';
import SwipeableModal from './SwipeableModal';

const REPORT_REASONS = [
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'abuse', label: 'Оскорбления', icon: '🤬' },
  { value: 'inappropriate', label: 'Неприемл. контент', icon: '⚠️' },
  { value: 'scam', label: 'Мошенничество', icon: '🎣' },
  { value: 'nsfw', label: 'NSFW', icon: '🔞' },
  { value: 'harassment', label: 'Травля', icon: '😡' },
  { value: 'misinformation', label: 'Ложная инф-а', icon: '🤥' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

const TARGET_LABELS = {
  post: 'пост',
  comment: 'комментарий',
  request: 'запрос',
  market_item: 'товар',
  dating_profile: 'профиль',
};

function ReportModal({ isOpen, onClose, targetType, targetId }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Сброс формы при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedReason(null);
      setDescription('');
    }
  }, [isOpen]);

  const handleClose = () => {
    hapticFeedback('light');
    onClose(); // Анимацию закрытия теперь делает SwipeableModal
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    hapticFeedback('medium');

    try {
      await createReport(targetType, targetId, selectedReason, description.trim() || null);
      toast.success('Жалоба отправлена');
      hapticFeedback('success');
      onClose(); // Закрываемся
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось отправить жалобу');
      hapticFeedback('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guard clause внутри компонента больше не нужен,
  // так как SwipeableModal сам решает, когда рендерить DOM (через Animate Presence логику)
  
  return (
    <SwipeableModal 
      isOpen={isOpen} 
      onClose={handleClose}
      // title не передаем, так как у нас кастомный хедер с иконкой
    >
        {/* === HEADER === */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIcon}>⚠️</div>
            <div>
              <h3 style={styles.title}>Пожаловаться</h3>
              <span style={styles.subtitle}>на {TARGET_LABELS[targetType] || 'контент'}</span>
            </div>
          </div>
        </div>

        {/* === GRID ПРИЧИН === */}
        <div style={styles.reasonsGrid}>
          {REPORT_REASONS.map((reason) => {
            const isSelected = selectedReason === reason.value;
            return (
              <button
                key={reason.value}
                style={{
                  ...styles.reasonChip,
                  borderColor: isSelected ? theme.colors.warning : theme.colors.border,
                  background: isSelected ? `${theme.colors.warning}18` : theme.colors.bgSecondary,
                  // Scale анимация теперь на CSS transition, а не inline styles
                  transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                }}
                onClick={() => { hapticFeedback('light'); setSelectedReason(reason.value); }}
              >
                <div style={styles.reasonContent}>
                  <span style={styles.reasonEmoji}>{reason.icon}</span>
                  <span style={{
                    fontSize: theme.fontSize.sm,
                    color: isSelected ? theme.colors.warning : theme.colors.text,
                    fontWeight: isSelected ? theme.fontWeight.semibold : theme.fontWeight.medium,
                  }}>
                    {reason.label}
                  </span>
                </div>
                {isSelected && (
                  <Check 
                    size={16} 
                    color={theme.colors.warning} 
                    style={{ flexShrink: 0 }} 
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* === TEXTAREA === */}
        <div style={styles.descBlock}>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Опишите подробнее (необязательно)..."
            rows={3}
            // ВАЖНО: Останавливаем всплытие событий, чтобы скролл текста не закрывал модалку
            onTouchStart={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          />
          {description.length > 0 && (
            <span style={styles.charCount}>{description.length}/500</span>
          )}
        </div>

        {/* === SUBMIT BUTTON === */}
        <button
          style={{
            ...styles.submitBtn,
            opacity: !selectedReason || isSubmitting ? 0.4 : 1,
            pointerEvents: !selectedReason || isSubmitting ? 'none' : 'auto',
          }}
          onClick={handleSubmit}
          disabled={!selectedReason || isSubmitting}
        >
          <Send size={16} />
          <span>{isSubmitting ? 'Отправка...' : 'Отправить жалобу'}</span>
        </button>
    </SwipeableModal>
  );
}

// Стили значительно упростились - убрали всё, что касается оверлея и шторки
const styles = {
  header: {
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'space-between', 
    marginBottom: theme.spacing.lg,
  },
  headerLeft: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: theme.spacing.md 
  },
  headerIcon: {
    fontSize: 24, 
    width: 40, 
    height: 40, 
    borderRadius: theme.radius.md,
    background: `${theme.colors.warning}15`,
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexShrink: 0,
  },
  title: {
    fontSize: theme.fontSize.lg, 
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text, 
    margin: 0, 
    lineHeight: 1.2,
  },
  subtitle: { 
    fontSize: theme.fontSize.xs, 
    color: theme.colors.textTertiary 
  },
  reasonsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  reasonChip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 14px',
    borderRadius: theme.radius.md,
    border: '1.5px solid',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    WebkitTapHighlightColor: 'transparent',
    minHeight: 48,
  },
  reasonContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reasonEmoji: { 
    fontSize: 16, 
    flexShrink: 0 
  },
  descBlock: { 
    position: 'relative', 
    marginBottom: theme.spacing.lg 
  },
  textarea: {
    width: '100%', 
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, 
    borderRadius: theme.radius.md,
    padding: theme.spacing.md, 
    color: theme.colors.text,
    fontSize: theme.fontSize.base, 
    fontFamily: 'inherit',
    resize: 'none', 
    outline: 'none', 
    boxSizing: 'border-box',
  },
  charCount: {
    position: 'absolute', 
    bottom: 8, 
    right: 12,
    fontSize: theme.fontSize.xs, 
    color: theme.colors.textDisabled,
  },
  submitBtn: {
    width: '100%', 
    padding: '14px', 
    borderRadius: theme.radius.md,
    border: 'none', 
    background: theme.colors.warning, 
    color: '#000',
    fontSize: theme.fontSize.base, 
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer', 
    display: 'flex', 
    alignItems: 'center',
    justifyContent: 'center', 
    gap: theme.spacing.sm,
    transition: 'opacity 0.2s ease',
  },
};

export default ReportModal;