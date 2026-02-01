// ===== 📄 ФАЙЛ: frontend/src/components/shared/ConfirmationDialog.js =====

import React from 'react';
import theme from '../../theme';
import { Z_CONFIRMATION_DIALOG, getOverlayZIndex } from '../../constants/zIndex';

function ConfirmationDialog({
  isOpen,
  title = 'Подтвердите действие',
  message = 'Вы уверены?',
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  confirmType = 'danger',
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const confirmColors = {
    danger: theme.colors.error,
    primary: theme.colors.primary,
    success: theme.colors.success,
  };

  const fadeInKeyframes = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
  `;

  return (
    <>
      <style>{fadeInKeyframes}</style>
      
      <div 
        style={styles.overlay}
        onClick={onCancel}
      />
      
      <div style={styles.dialog}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.message}>{message}</p>
        
        <div style={styles.buttons}>
          <button
            onClick={onCancel}
            style={styles.cancelButton}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              ...styles.confirmButton,
              background: confirmColors[confirmType] || confirmColors.danger,
            }}
          >
            {confirmText}
          </button>
        </div>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.2s ease',
  },
  dialog: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: theme.colors.bg,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    margin: 0,
    maxWidth: '320px',
    width: 'calc(100% - 32px)',
    textAlign: 'center',
    zIndex: Z_CONFIRMATION_DIALOG,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
    margin: 0,
  },
  message: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 1.5,
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.sm,
  },
  cancelButton: {
    padding: theme.spacing.md,
    background: theme.colors.bgSecondary,
    border: 'none',
    borderRadius: theme.radius.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  confirmButton: {
    padding: theme.spacing.md,
    border: 'none',
    borderRadius: theme.radius.md,
    color: '#fff',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default ConfirmationDialog;