// ===== 📄 ФАЙЛ: frontend/src/components/shared/ConfirmationDialog.js =====

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import theme from '../../theme';
import { Z_CONFIRMATION_DIALOG } from '../../constants/zIndex';

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
  // Чтобы избежать ошибок SSR (если есть) и гарантировать наличие document
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  const confirmColors = {
    danger: theme.colors.error,
    primary: '#D4FF00',
    success: theme.colors.success,
  };

  const fadeInKeyframes = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }
  `;

  const dialogContent = (
    <>
      <style>{fadeInKeyframes}</style>
      
      {/* Overlay */}
      <div 
        style={styles.overlay}
        onClick={onCancel}
      />
      
      {/* Dialog Box */}
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
              color: confirmType === 'primary' ? '#000' : '#fff',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );

  return createPortal(dialogContent, document.body);
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, 
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)', // Чуть темнее для контраста
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: Z_CONFIRMATION_DIALOG, // Убедись, что это число большое (например, 10000)
    animation: 'fadeIn 0.2s ease-out',
  },
  dialog: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#1e1e1e', // Hardcode или theme.colors.card
    borderRadius: 20,
    padding: 24,
    margin: 0,
    maxWidth: '320px',
    width: 'calc(100% - 48px)',
    textAlign: 'center',
    zIndex: Z_CONFIRMATION_DIALOG + 1,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
    animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 8,
    color: '#fff',
    marginTop: 0,
  },
  message: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 24,
    lineHeight: 1.4,
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  cancelButton: {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmButton: {
    padding: '12px',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default ConfirmationDialog;