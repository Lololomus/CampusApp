// ===== 📄 ФАЙЛ: frontend/src/components/AuthModal.js =====

import React from 'react';
import { User } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import theme from '../theme';
import { Z_AUTH_MODAL } from '../constants/zIndex';


function AuthModal() {
  const { showAuthModal, setShowAuthModal, startRegistration } = useStore();

  if (!showAuthModal) return null;

  const handleRegister = () => {
    hapticFeedback('medium');
    startRegistration();
  };

  const handleClose = () => {
    hapticFeedback('light');
    setShowAuthModal(false);
  };

  return (
    <div style={styles.overlay} onClick={handleClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        
        <div style={styles.iconWrapper}>
          <User size={40} />
        </div>

        <h3 style={styles.title}>Нужна регистрация</h3>
        
        <p style={styles.message}>
          Чтобы создавать посты, ставить лайки и писать сообщения, 
          нужно представиться. Это займет всего минуту!
        </p>

        <button onClick={handleRegister} style={styles.registerButton}>
          Зарегистрироваться
        </button>

        <button onClick={handleClose} style={styles.cancelButton}>
          Позже
        </button>
      </div>
    </div>
  );
}


const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme.colors.overlayDark,
    zIndex: Z_AUTH_MODAL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxl,
  },
  modal: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: `${theme.spacing.xxxl}px ${theme.spacing.xxl}px`,
    width: '100%',
    maxWidth: 400,
    textAlign: 'center',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.xl,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    backgroundColor: theme.colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    color: theme.colors.primary,
  },
  title: {
    fontSize: theme.fontSize.xxl + 2,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textTertiary,
    lineHeight: 1.6,
    marginBottom: theme.spacing.xxl,
  },
  registerButton: {
    width: '100%',
    padding: `${theme.spacing.lg}px`,
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: '#fff',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    marginBottom: theme.spacing.md,
    transition: `all ${theme.transitions.normal}`,
    boxShadow: `0 8px 24px ${theme.colors.primaryGlow}`,
  },
  cancelButton: {
    width: '100%',
    padding: theme.spacing.md,
    background: 'none',
    border: 'none',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.base,
    cursor: 'pointer',
  },
};


export default AuthModal;