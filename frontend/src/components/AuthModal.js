import React from 'react';
import { User } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';

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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(4px)',
    zIndex: 150,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  modal: {
    backgroundColor: '#1e1e1e',
    borderRadius: '24px',
    padding: '32px 24px',
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
    border: '1px solid #333',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)'
  },
  iconWrapper: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'rgba(135, 116, 225, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
    color: '#8774e1'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '12px'
  },
  message: {
    fontSize: '15px',
    color: '#999',
    lineHeight: '1.6',
    marginBottom: '24px'
  },
  registerButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'all 0.2s',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)'
  },
  cancelButton: {
    width: '100%',
    padding: '12px',
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '14px',
    cursor: 'pointer'
  }
};

export default AuthModal;