// ===== 📄 ФАЙЛ: frontend/src/components/AuthModal.js =====

import React from 'react';
import { Sparkles, UserPlus } from 'lucide-react';
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
    <>
      <style>{modalAnimationStyles}</style>
      <div style={styles.overlay} onClick={handleClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div style={styles.iconRow}>
            <div style={styles.iconWrap}>
              <UserPlus size={22} />
            </div>
            <div style={styles.badge}>
              <Sparkles size={14} />
              2 шага
            </div>
          </div>

          <h3 style={styles.title}>Зарегистрируйтесь, чтобы действовать</h3>
          <p style={styles.message}>
            Просматривайте ленту и маркет без ограничений. Для лайков, комментариев,
            знакомств и профиля нужна регистрация.
          </p>

          <button type="button" onClick={handleRegister} style={styles.registerButton}>
            Начать регистрацию
          </button>
          <button type="button" onClick={handleClose} style={styles.cancelButton}>
            Продолжить просмотр
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
    background: theme.colors.overlayDark,
    zIndex: Z_AUTH_MODAL,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    opacity: 1,
    willChange: 'opacity',
    animation: 'authOverlayIn 0.2s ease-out',
  },
  modal: {
    width: '100%',
    maxWidth: 420,
    background: `linear-gradient(180deg, ${theme.colors.cardHover} 0%, ${theme.colors.card} 100%)`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadows.xl,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`,
    transform: 'translate3d(0, 0, 0)',
    willChange: 'transform, opacity',
    animation: 'authModalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    background: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.full,
    padding: `6px ${theme.spacing.sm}px`,
    background: theme.colors.bgSecondary,
  },
  title: {
    margin: 0,
    color: theme.colors.text,
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 1.2,
  },
  message: {
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xxl,
    color: theme.colors.textSecondary,
    lineHeight: 1.55,
    fontSize: theme.fontSize.md,
  },
  registerButton: {
    width: '100%',
    height: 50,
    border: 'none',
    borderRadius: theme.radius.md,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    color: '#fff',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    boxShadow: `0 10px 24px ${theme.colors.primaryGlow}`,
    transition: `transform ${theme.transitions.normal}, opacity ${theme.transitions.normal}`,
    transform: 'translate3d(0, 0, 0)',
    willChange: 'transform',
  },
  cancelButton: {
    width: '100%',
    height: 44,
    marginTop: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.base,
    cursor: 'pointer',
    transition: `opacity ${theme.transitions.normal}`,
  },
};

const modalAnimationStyles = `
  @keyframes authOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes authModalIn {
    from {
      opacity: 0;
      transform: translate3d(0, 18px, 0) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
    }
  }
`;

export default AuthModal;
