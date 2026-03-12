// ===== FILE: frontend/src/components/AuthModal.js =====

import { useRef } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { useSwipe } from '../hooks/useSwipe';
import { Z_AUTH_MODAL } from '../constants/zIndex';

function AuthModal() {
  const { showAuthModal, setShowAuthModal, startRegistration } = useStore();
  const sheetRef = useRef(null);

  const swipeHandlers = useSwipe({
    elementRef: sheetRef,
    onSwipeDown: () => handleClose(),
    isModal: true,
    threshold: 120,
  });

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
      <style>{sheetStyles}</style>
      <div style={styles.overlay} onClick={handleClose}>
        <div
          ref={sheetRef}
          className="auth-sheet-slide"
          style={styles.sheet}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div style={styles.handleZone} {...swipeHandlers}>
            <div style={styles.handle} />
          </div>

          {/* Icon */}
          <div style={styles.iconBox}>
            <Zap size={40} color="#D4FF00" fill="#D4FF00" />
          </div>

          <h2 style={styles.title}>Врывайся в Campus!</h2>
          <p style={styles.subtitle}>
            Создай профиль за минуту, чтобы лайкать, комментить и знакомиться.
          </p>

          <button type="button" style={styles.ctaButton} className="auth-spring-btn" onClick={handleRegister}>
            Создать профиль <ArrowRight size={20} strokeWidth={3} />
          </button>
          <button type="button" style={styles.dismissButton} className="auth-spring-btn" onClick={handleClose}>
            Пока просто посмотрю
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
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    zIndex: Z_AUTH_MODAL,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    animation: 'authOverlayIn 0.3s ease both',
  },
  sheet: {
    background: '#1C1C1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    padding: '24px 20px',
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
    willChange: 'transform',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  },
  handleZone: {
    width: '100%',
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'grab',
    flexShrink: 0,
    marginBottom: 16,
  },
  handle: {
    width: 64,
    height: 6,
    borderRadius: 999,
    background: 'rgba(255,255,255,0.2)',
    flexShrink: 0,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    background: 'rgba(212,255,0,0.15)',
    border: '1px solid rgba(212,255,0,0.2)',
    boxShadow: '0 0 30px rgba(212,255,0,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    flexShrink: 0,
  },
  title: {
    margin: '0 0 12px',
    fontSize: 26,
    fontWeight: 800,
    color: '#FFFFFF',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    margin: '0 0 32px',
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 1.5,
    maxWidth: 300,
  },
  ctaButton: {
    width: '100%',
    background: '#D4FF00',
    color: '#000',
    border: 'none',
    padding: 18,
    borderRadius: 20,
    fontSize: 17,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: '#666666',
    fontSize: 16,
    fontWeight: 600,
    marginTop: 20,
    padding: '12px 20px',
    cursor: 'pointer',
  },
};

const sheetStyles = `
  @keyframes authOverlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes authSheetSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .auth-sheet-slide {
    animation: authSheetSlideUp 0.4s cubic-bezier(0.32, 0.72, 0, 1) both;
  }
  .auth-spring-btn {
    transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s;
    -webkit-tap-highlight-color: transparent;
  }
  .auth-spring-btn:active {
    transform: scale(0.96);
    opacity: 0.85;
  }
`;

export default AuthModal;
