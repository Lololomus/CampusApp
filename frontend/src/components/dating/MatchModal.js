import React, { useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';
import { useStore } from '../../store';
import confetti from 'canvas-confetti';


function MatchModal() {
  const { showMatchModal, setShowMatchModal, matchedUser } = useStore();

  useEffect(() => {
    if (showMatchModal) {
      // Запускаем конфетти
      const duration = 3000;
      const end = Date.now() + duration;

      const interval = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }

        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#8774e1', '#f093fb', '#f5576c', '#64c8ff'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#8774e1', '#f093fb', '#f5576c', '#64c8ff'],
        });
      }, 150);

      // Haptic
      if (window.Telegram?.WebApp?.HapticFeedback) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      return () => clearInterval(interval);
    }
  }, [showMatchModal]);

  if (!showMatchModal || !matchedUser) return null;

  const handleClose = () => {
    setShowMatchModal(false, null);
  };

  const handleMessage = () => {
    // TODO: Открыть чат с пользователем
    alert('Функция чата в разработке');
    handleClose();
  };

  return (
    <>
      <style>{keyframes}</style>
      <div style={styles.overlay} onClick={handleClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Кнопка закрыть */}
          <button onClick={handleClose} style={styles.closeButton}>
            <X size={24} />
          </button>

          {/* Emoji */}
          <div style={styles.emoji}>🎉</div>

          {/* Заголовок */}
          <h2 style={styles.title}>Это мэтч!</h2>
          <p style={styles.subtitle}>
            Вы с <strong>{matchedUser.name}</strong> лайкнули друг друга
          </p>

          {/* Аватар */}
          <div style={styles.avatarContainer}>
            {matchedUser.avatar ? (
              <img src={matchedUser.avatar} alt={matchedUser.name} style={styles.avatar} />
            ) : (
              <div style={styles.avatarPlaceholder}>
                {matchedUser.name?.charAt(0) || '?'}
              </div>
            )}
          </div>

          {/* Кнопка написать */}
          <button onClick={handleMessage} style={styles.messageButton}>
            <MessageCircle size={20} />
            Написать сообщение
          </button>
        </div>
      </div>
    </>
  );
}


const keyframes = `
  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(100px) scale(0.9);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
`;


const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  },
  modal: {
    backgroundColor: '#1a1a1a',
    borderRadius: '24px',
    padding: '32px 24px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
    position: 'relative',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    animation: 'modalSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  closeButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#252525',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  emoji: {
    fontSize: '64px',
    marginBottom: '16px',
    animation: 'pulse 1s ease-in-out infinite',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#aaa',
    marginBottom: '24px',
  },
  avatarContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #8774e1',
  },
  avatarPlaceholder: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: '#8774e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#fff',
    border: '4px solid #8774e1',
  },
  messageButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 16px rgba(135, 116, 225, 0.4)',
  },
};


export default MatchModal;