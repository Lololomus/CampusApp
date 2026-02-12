// ===== 📄 ФАЙЛ: frontend/src/components/shared/ReportModal.js =====

import React, { useState, useEffect } from 'react';
import { X, Send, Check } from 'lucide-react';
import { createReport } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from './Toast';
import theme from '../../theme';
import { Z_CONFIRMATION_DIALOG, getOverlayZIndex } from '../../constants/zIndex';

const REPORT_REASONS = [
  { value: 'spam', label: 'Спам', icon: '📨' },
  { value: 'abuse', label: 'Оскорбления', icon: '🤬' },
  { value: 'inappropriate', label: 'Неприемлемый контент', icon: '⚠️' },
  { value: 'scam', label: 'Мошенничество', icon: '🎣' },
  { value: 'nsfw', label: 'NSFW', icon: '🔞' },
  { value: 'harassment', label: 'Травля', icon: '😡' },
  { value: 'misinformation', label: 'Ложная информация', icon: '🤥' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

const TARGET_LABELS = {
  post: 'пост',
  comment: 'комментарий',
  request: 'запрос',
  market_item: 'товар',
  dating_profile: 'профиль',
};

/**
 * Универсальная модалка жалобы на контент (bottom-sheet).
 *
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} targetType - 'post' | 'comment' | 'request' | 'market_item' | 'dating_profile'
 * @param {number} targetId
 */
function ReportModal({ isOpen, onClose, targetType, targetId }) {
  const [selectedReason, setSelectedReason] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
      setSelectedReason(null);
      setDescription('');
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    hapticFeedback('light');
    setIsVisible(false);
    setTimeout(() => {
      document.body.style.overflow = '';
      onClose();
    }, 250);
  };

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    setIsSubmitting(true);
    hapticFeedback('medium');

    try {
      await createReport(targetType, targetId, selectedReason, description.trim() || null);
      toast.success('Жалоба отправлена');
      hapticFeedback('success');
      setIsVisible(false);
      setTimeout(() => { document.body.style.overflow = ''; onClose(); }, 250);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Не удалось отправить жалобу');
      hapticFeedback('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        style={{ ...styles.overlay, opacity: isVisible ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Bottom Sheet */}
      <div style={{
        ...styles.sheet,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
      }}>
        <div style={styles.handle} />

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.headerIcon}>⚠️</div>
            <div>
              <h3 style={styles.title}>Пожаловаться</h3>
              <span style={styles.subtitle}>на {TARGET_LABELS[targetType] || 'контент'}</span>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Reasons */}
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
                }}
                onClick={() => { hapticFeedback('light'); setSelectedReason(reason.value); }}
              >
                <span style={styles.reasonEmoji}>{reason.icon}</span>
                <span style={{
                  fontSize: theme.fontSize.sm,
                  color: isSelected ? theme.colors.warning : theme.colors.textSecondary,
                  fontWeight: isSelected ? theme.fontWeight.semibold : theme.fontWeight.normal,
                }}>
                  {reason.label}
                </span>
                {isSelected && <Check size={14} color={theme.colors.warning} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>

        {/* Description */}
        <div style={styles.descBlock}>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            placeholder="Опишите подробнее (необязательно)..."
            rows={3}
          />
          {description.length > 0 && (
            <span style={styles.charCount}>{description.length}/500</span>
          )}
        </div>

        {/* Submit */}
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
      </div>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: getOverlayZIndex(Z_CONFIRMATION_DIALOG),
    transition: 'opacity 0.25s ease',
  },
  sheet: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: theme.colors.bg,
    borderRadius: `${theme.radius.xl}px ${theme.radius.xl}px 0 0`,
    padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
    paddingBottom: `calc(${theme.spacing.xl}px + env(safe-area-inset-bottom))`,
    zIndex: Z_CONFIRMATION_DIALOG,
    maxHeight: '80vh',
    overflowY: 'auto',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.4)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: theme.colors.border, margin: '0 auto 16px',
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: theme.spacing.lg,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: theme.spacing.md },
  headerIcon: {
    fontSize: 24, width: 40, height: 40, borderRadius: theme.radius.md,
    background: `${theme.colors.warning}15`,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  title: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold,
    color: theme.colors.text, margin: 0, lineHeight: 1.2,
  },
  subtitle: { fontSize: theme.fontSize.xs, color: theme.colors.textTertiary },
  closeBtn: {
    width: 36, height: 36, borderRadius: theme.radius.full,
    background: theme.colors.bgSecondary, border: 'none',
    color: theme.colors.textSecondary,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  reasonsGrid: {
    display: 'flex', flexWrap: 'wrap',
    gap: theme.spacing.sm, marginBottom: theme.spacing.lg,
  },
  reasonChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', borderRadius: theme.radius.md,
    border: '1px solid', cursor: 'pointer',
    transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent',
  },
  reasonEmoji: { fontSize: 14, flexShrink: 0 },
  descBlock: { position: 'relative', marginBottom: theme.spacing.lg },
  textarea: {
    width: '100%', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md,
    padding: theme.spacing.md, color: theme.colors.text,
    fontSize: theme.fontSize.base, fontFamily: 'inherit',
    resize: 'none', outline: 'none', boxSizing: 'border-box',
  },
  charCount: {
    position: 'absolute', bottom: 8, right: 12,
    fontSize: theme.fontSize.xs, color: theme.colors.textDisabled,
  },
  submitBtn: {
    width: '100%', padding: '14px', borderRadius: theme.radius.md,
    border: 'none', background: theme.colors.warning, color: '#000',
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: theme.spacing.sm,
    transition: 'opacity 0.2s ease',
  },
};

export default ReportModal;