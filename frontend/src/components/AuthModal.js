import { Zap, ArrowRight } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { Z_AUTH_MODAL } from '../constants/zIndex';
import SwipeableModal from './shared/SwipeableModal';

function AuthModal() {
  const { showAuthModal, setShowAuthModal, startRegistration } = useStore();

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
      <style>{buttonStyles}</style>
      <SwipeableModal isOpen={showAuthModal} onClose={handleClose} zIndex={Z_AUTH_MODAL}>
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
      </SwipeableModal>
    </>
  );
}

const styles = {
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    paddingTop: 30,
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

const buttonStyles = `
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
