// ===== 📄 ФАЙЛ: frontend/src/components/shared/ModerationMenu.js =====

/**
 * Хук и компоненты модерации для встраивания в карточки контента.
 *
 * Использование:
 *   import { useModerationActions, ModerationModals } from '../shared/ModerationMenu';
 *
 *   const { moderationMenuItems, moderationModals } = useModerationActions({
 *     targetType: 'post',
 *     targetId: post.id,
 *     targetUserId: post.author_id,
 *     isPinned: post.is_important,
 *     onDeleted: () => onPostDeleted(post.id),
 *     onPinToggled: (pinned) => { ... },
 *   });
 *
 *   // Добавить moderationMenuItems к существующему массиву items DropdownMenu
 *   const menuItems = [...existingItems, ...moderationMenuItems];
 *
 *   // Рендерить модалки рядом с DropdownMenu
 *   {moderationModals}
 */

import React, { useState, useCallback } from 'react';
import { useStore } from '../../store';
import {
  moderateDeletePost,
  moderateDeleteComment,
  moderateDeleteRequest,
  moderateDeleteMarketItem,
  togglePinPost,
  shadowBanUser,
} from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from './Toast';
import ConfirmationDialog from './ConfirmationDialog';
import theme from '../../theme';

// Action types для DropdownMenu (цвета акцентов)
const MOD_ACTIONS = {
  MOD_DELETE: 'delete',
  MOD_PIN: 'edit',
  MOD_BAN: 'report',
};

/**
 * Хук: возвращает menuItems для DropdownMenu + модалки.
 */
export function useModerationActions({
  targetType,        // 'post' | 'comment' | 'request' | 'market_item'
  targetId,
  targetUserId,      // author_id для бана
  isPinned = false,  // только для постов
  onDeleted,         // callback после удаления
  onPinToggled,      // callback после pin/unpin
}) {
  const { moderationRole } = useStore();
  const canModerate = moderationRole?.can_moderate === true;

  // Состояние модалок
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBanSheet, setShowBanSheet] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [banForm, setBanForm] = useState({
    ban_posts: true,
    ban_comments: true,
    duration_days: 7,
    reason: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // ===== HANDLERS =====

  const handleModDelete = useCallback(async () => {
    if (!deleteReason.trim() || deleteReason.trim().length < 3) {
      toast.error('Укажите причину удаления (мин. 3 символа)');
      return;
    }

    setIsProcessing(true);
    hapticFeedback('heavy');

    try {
      const deleteFn = {
        post: moderateDeletePost,
        comment: moderateDeleteComment,
        request: moderateDeleteRequest,
        market_item: moderateDeleteMarketItem,
      }[targetType];

      if (!deleteFn) throw new Error('Unknown target type');

      await deleteFn(targetId, deleteReason.trim());
      toast.success('Контент удалён');
      setShowDeleteConfirm(false);
      setDeleteReason('');
      if (onDeleted) onDeleted();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка удаления');
    } finally {
      setIsProcessing(false);
    }
  }, [targetType, targetId, deleteReason, onDeleted]);

  const handlePin = useCallback(async () => {
    hapticFeedback('medium');
    try {
      const result = await togglePinPost(targetId);
      toast.success(result.pinned ? 'Пост закреплён' : 'Пост откреплён');
      if (onPinToggled) onPinToggled(result.pinned);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка');
    }
  }, [targetId, onPinToggled]);

  const handleBan = useCallback(async () => {
    if (!banForm.reason.trim() || banForm.reason.trim().length < 3) {
      toast.error('Укажите причину бана (мин. 3 символа)');
      return;
    }

    setIsProcessing(true);
    hapticFeedback('heavy');

    try {
      await shadowBanUser({
        user_id: targetUserId,
        ban_posts: banForm.ban_posts,
        ban_comments: banForm.ban_comments,
        duration_days: banForm.duration_days || null,
        reason: banForm.reason.trim(),
      });

      const durationText = banForm.duration_days
        ? `на ${banForm.duration_days} дн.`
        : 'навсегда';
      toast.success(`Пользователь забанен ${durationText}`);
      setShowBanSheet(false);
      setBanForm({ ban_posts: true, ban_comments: true, duration_days: 7, reason: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка бана');
    } finally {
      setIsProcessing(false);
    }
  }, [targetUserId, banForm]);

  // ===== MENU ITEMS =====

  const moderationMenuItems = [];

  if (canModerate) {
    // Разделитель
    moderationMenuItems.push({ divider: true });

    // Удалить (модерация)
    moderationMenuItems.push({
      label: 'Удалить (мод)',
      icon: '🛡️',
      onClick: () => { setShowDeleteConfirm(true); },
      actionType: MOD_ACTIONS.MOD_DELETE,
    });

    // Закрепить/открепить (только для постов)
    if (targetType === 'post') {
      moderationMenuItems.push({
        label: isPinned ? 'Открепить' : 'Закрепить',
        icon: isPinned ? '📌' : '📍',
        onClick: handlePin,
        actionType: MOD_ACTIONS.MOD_PIN,
      });
    }

    // Забанить автора
    if (targetUserId) {
      moderationMenuItems.push({
        label: 'Забанить автора',
        icon: '🚫',
        onClick: () => { setShowBanSheet(true); },
        actionType: MOD_ACTIONS.MOD_BAN,
      });
    }
  }

  // ===== MODALS JSX =====

  const moderationModals = (
    <>
      {/* Delete Confirmation */}
      <DeleteReasonDialog
        isOpen={showDeleteConfirm}
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        onConfirm={handleModDelete}
        onCancel={() => { setShowDeleteConfirm(false); setDeleteReason(''); }}
        isProcessing={isProcessing}
        targetType={targetType}
      />

      {/* Ban Sheet */}
      <BanSheet
        isOpen={showBanSheet}
        form={banForm}
        onChange={setBanForm}
        onConfirm={handleBan}
        onCancel={() => { setShowBanSheet(false); }}
        isProcessing={isProcessing}
      />
    </>
  );

  return { moderationMenuItems, moderationModals };
}


// ========================================
// Подкомпоненты модалок
// ========================================

/** Диалог удаления с причиной */
function DeleteReasonDialog({
  isOpen, reason, onReasonChange, onConfirm, onCancel, isProcessing, targetType,
}) {
  if (!isOpen) return null;

  const labels = {
    post: 'пост', comment: 'комментарий',
    request: 'запрос', market_item: 'товар',
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      <div style={deleteStyles.overlay} onClick={onCancel} />
      <div style={deleteStyles.dialog}>
        <h3 style={deleteStyles.title}>
          Удалить {labels[targetType] || 'контент'}?
        </h3>
        <p style={deleteStyles.message}>
          Укажите причину. Автор увидит её и сможет обжаловать.
        </p>

        <textarea
          style={deleteStyles.textarea}
          value={reason}
          onChange={(e) => onReasonChange(e.target.value.slice(0, 500))}
          placeholder="Причина удаления..."
          rows={3}
          autoFocus
        />

        <div style={deleteStyles.buttons}>
          <button onClick={onCancel} style={deleteStyles.cancelBtn}>
            Отмена
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing || reason.trim().length < 3}
            style={{
              ...deleteStyles.confirmBtn,
              opacity: isProcessing || reason.trim().length < 3 ? 0.4 : 1,
            }}
          >
            {isProcessing ? 'Удаление...' : 'Удалить'}
          </button>
        </div>
      </div>
    </>
  );
}

const deleteStyles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    zIndex: 5099, animation: 'fadeIn 0.2s ease',
  },
  dialog: {
    position: 'fixed', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    background: theme.colors.bg,
    borderRadius: theme.radius.xl, padding: theme.spacing.xl,
    maxWidth: 340, width: 'calc(100% - 32px)',
    zIndex: 5100,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  title: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold,
    color: theme.colors.text, margin: 0, marginBottom: theme.spacing.sm,
  },
  message: {
    fontSize: theme.fontSize.sm, color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md, lineHeight: 1.5, margin: 0,
    marginBottom: theme.spacing.md,
  },
  textarea: {
    width: '100%', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md,
    padding: theme.spacing.md, color: theme.colors.text,
    fontSize: theme.fontSize.base, fontFamily: 'inherit',
    resize: 'none', outline: 'none', boxSizing: 'border-box',
    marginBottom: theme.spacing.md,
  },
  buttons: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm,
  },
  cancelBtn: {
    padding: theme.spacing.md, background: theme.colors.bgSecondary,
    border: 'none', borderRadius: theme.radius.md, color: theme.colors.text,
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: theme.spacing.md, background: theme.colors.error,
    border: 'none', borderRadius: theme.radius.md, color: '#fff',
    fontSize: theme.fontSize.sm, fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer', transition: 'opacity 0.2s ease',
  },
};


/** Шторка бана (bottom-sheet) */
function BanSheet({ isOpen, form, onChange, onConfirm, onCancel, isProcessing }) {
  const [isVisible, setIsVisible] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => { document.body.style.overflow = ''; onCancel(); }, 250);
  };

  const durations = [
    { value: 1, label: '1 день' },
    { value: 7, label: '7 дней' },
    { value: 30, label: '30 дней' },
    { value: null, label: 'Навсегда' },
  ];

  return (
    <>
      <div
        style={{ ...banStyles.overlay, opacity: isVisible ? 1 : 0 }}
        onClick={handleClose}
      />

      <div style={{
        ...banStyles.sheet,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
      }}>
        <div style={banStyles.handle} />

        <div style={banStyles.header}>
          <span style={{ fontSize: 24 }}>🚫</span>
          <h3 style={banStyles.title}>Теневой бан</h3>
        </div>
        <p style={banStyles.desc}>
          Забаненный пользователь видит свой контент, но другие — нет.
        </p>

        {/* Scope toggles */}
        <div style={banStyles.toggleRow}>
          <ToggleChip
            label="Посты"
            active={form.ban_posts}
            onClick={() => onChange({ ...form, ban_posts: !form.ban_posts })}
          />
          <ToggleChip
            label="Комментарии"
            active={form.ban_comments}
            onClick={() => onChange({ ...form, ban_comments: !form.ban_comments })}
          />
        </div>

        {/* Duration */}
        <label style={banStyles.label}>Срок</label>
        <div style={banStyles.durationRow}>
          {durations.map((d) => (
            <button
              key={String(d.value)}
              style={{
                ...banStyles.durationBtn,
                borderColor: form.duration_days === d.value
                  ? theme.colors.error : theme.colors.border,
                background: form.duration_days === d.value
                  ? `${theme.colors.error}18` : 'transparent',
                color: form.duration_days === d.value
                  ? theme.colors.error : theme.colors.textSecondary,
                fontWeight: form.duration_days === d.value
                  ? theme.fontWeight.semibold : theme.fontWeight.normal,
              }}
              onClick={() => onChange({ ...form, duration_days: d.value })}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Reason */}
        <label style={banStyles.label}>Причина</label>
        <textarea
          style={banStyles.textarea}
          value={form.reason}
          onChange={(e) => onChange({ ...form, reason: e.target.value.slice(0, 500) })}
          placeholder="Причина бана..."
          rows={2}
        />

        {/* Actions */}
        <div style={banStyles.actions}>
          <button style={banStyles.cancelBtn} onClick={handleClose}>
            Отмена
          </button>
          <button
            style={{
              ...banStyles.confirmBtn,
              opacity: isProcessing || form.reason.trim().length < 3
                || (!form.ban_posts && !form.ban_comments) ? 0.4 : 1,
            }}
            disabled={isProcessing || form.reason.trim().length < 3
              || (!form.ban_posts && !form.ban_comments)}
            onClick={onConfirm}
          >
            {isProcessing ? 'Применение...' : 'Забанить'}
          </button>
        </div>
      </div>
    </>
  );
}

/** Toggle chip */
function ToggleChip({ label, active, onClick }) {
  return (
    <button
      style={{
        padding: '8px 16px',
        borderRadius: theme.radius.md,
        border: `1px solid ${active ? theme.colors.error : theme.colors.border}`,
        background: active ? `${theme.colors.error}18` : 'transparent',
        color: active ? theme.colors.error : theme.colors.textSecondary,
        fontWeight: active ? theme.fontWeight.semibold : theme.fontWeight.normal,
        fontSize: theme.fontSize.sm,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

const banStyles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    zIndex: 5099, transition: 'opacity 0.25s ease',
  },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    background: theme.colors.bg,
    borderRadius: `${theme.radius.xl}px ${theme.radius.xl}px 0 0`,
    padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
    paddingBottom: `calc(${theme.spacing.xl}px + env(safe-area-inset-bottom))`,
    zIndex: 5100, maxHeight: '85vh', overflowY: 'auto',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    boxShadow: '0 -8px 40px rgba(0, 0, 0, 0.4)',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: theme.colors.border, margin: '0 auto 16px',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.lg, fontWeight: theme.fontWeight.bold,
    color: theme.colors.text, margin: 0,
  },
  desc: {
    fontSize: theme.fontSize.sm, color: theme.colors.textTertiary,
    margin: 0, marginBottom: theme.spacing.lg, lineHeight: 1.4,
  },
  toggleRow: {
    display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.xs, fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: '0.5px', display: 'block', marginBottom: theme.spacing.sm,
  },
  durationRow: {
    display: 'flex', gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg, flexWrap: 'wrap',
  },
  durationBtn: {
    padding: '8px 14px', borderRadius: theme.radius.md,
    border: '1px solid', cursor: 'pointer', fontSize: theme.fontSize.sm,
    transition: 'all 0.15s ease', WebkitTapHighlightColor: 'transparent',
  },
  textarea: {
    width: '100%', background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md,
    padding: theme.spacing.md, color: theme.colors.text,
    fontSize: theme.fontSize.base, fontFamily: 'inherit',
    resize: 'none', outline: 'none', boxSizing: 'border-box',
    marginBottom: theme.spacing.lg,
  },
  actions: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.sm,
  },
  cancelBtn: {
    padding: '14px', background: theme.colors.bgSecondary,
    border: 'none', borderRadius: theme.radius.md, color: theme.colors.text,
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
  },
  confirmBtn: {
    padding: '14px', background: theme.colors.error,
    border: 'none', borderRadius: theme.radius.md, color: '#fff',
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer', transition: 'opacity 0.2s ease',
  },
};

export default { useModerationActions };