import { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { Z_AUTH_MODAL } from '../constants/zIndex';
import { useTelegramScreen } from './shared/telegram/useTelegramScreen';
import DrilldownHeader from './shared/DrilldownHeader';
import EdgeSwipeBack from './shared/EdgeSwipeBack';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScrollLock';

function AuthModal() {
  const { showAuthModal, setShowAuthModal, startRegistration } = useStore();
  const [isExiting, setIsExiting] = useState(false);
  const closeTimeoutRef = useRef(null);

  const closeImmediately = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExiting(false);
    setShowAuthModal(false);
  }, [setShowAuthModal]);

  const handleClose = useCallback(() => {
    if (!showAuthModal || isExiting) return;

    hapticFeedback('light');
    setIsExiting(true);

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }

    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsExiting(false);
      setShowAuthModal(false);
    }, 340);
  }, [isExiting, setShowAuthModal, showAuthModal]);

  const handleRegister = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('medium');
    startRegistration();
  }, [isExiting, startRegistration]);

  useTelegramScreen({
    id: 'auth-prompt-screen',
    title: '',
    priority: Z_AUTH_MODAL,
    back: {
      visible: showAuthModal,
      onClick: handleClose,
    },
    main: { visible: false },
    secondary: { visible: false },
  });

  useEffect(() => {
    if (!showAuthModal) return undefined;

    setIsExiting(false);
    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [showAuthModal]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  if (!showAuthModal) return null;

  return (
    <>
      <style>{screenStyles}</style>
      <EdgeSwipeBack onBack={closeImmediately} disabled={isExiting} zIndex={Z_AUTH_MODAL}>
        <div
          style={{
            ...styles.screen,
            animation: isExiting
              ? 'authPromptSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
              : 'authPromptSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
            pointerEvents: isExiting ? 'none' : 'auto',
          }}
        >
          <DrilldownHeader
            title=""
            onBack={handleClose}
            showTitle={false}
            showDivider={false}
            background="#000000"
          />

          <div style={styles.scrollContent}>
            <div style={styles.content}>
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
        </div>
      </EdgeSwipeBack>
    </>
  );
}

const styles = {
  screen: {
    position: 'fixed',
    inset: 0,
    zIndex: Z_AUTH_MODAL,
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 24px calc(28px + var(--screen-bottom-offset))',
  },
  content: {
    minHeight: 'calc(var(--tg-app-viewport-stable-height, 100vh) - var(--screen-top-offset) - var(--drilldown-header-height) - var(--screen-bottom-offset))',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 12,
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
    maxWidth: 360,
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

const screenStyles = `
  @keyframes authPromptSlideIn {
    from { transform: translate3d(100%, 0, 0); }
    to { transform: translate3d(0, 0, 0); }
  }
  @keyframes authPromptSlideOut {
    from { transform: translate3d(0, 0, 0); }
    to { transform: translate3d(100%, 0, 0); }
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
