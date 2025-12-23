import React, { useState } from 'react';
import { X, Send, Check } from 'lucide-react';
import { useStore } from '../../store';
import { respondToRequest } from '../../api';  // ← ИЗМЕНЕНО

function ResponseModal({ profile }) {
  const { setShowResponseModal, removeCurrentProfile } = useStore();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const maxLength = 500;
  const remaining = maxLength - text.length;

  const handleClose = () => {
    setShowResponseModal(false);
  };

  const handleSend = async () => {
    if (!text.trim() || !profile?.active_request) return;  // ← ИЗМЕНЕНО

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    setIsSending(true);

    try {
      // Отправляем отклик на request
      await respondToRequest(profile.active_request.id, text);  // ← ИЗМЕНЕНО

      // Показываем галочку
      setSent(true);

      // Через 1 секунду закрываем и убираем карточку
      setTimeout(() => {
        setShowResponseModal(false);
        removeCurrentProfile();
      }, 1000);
    } catch (error) {
      console.error('Ошибка отправки отклика:', error);
      alert('Не удалось отправить отклик');
      setIsSending(false);
    }
  };

  if (!profile) return null;

  return (
    <>
      {/* Overlay */}
      <div style={styles.overlay} onClick={handleClose} />

      {/* Modal */}
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Откликнуться на запрос</h2>
          <button style={styles.closeButton} onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        {/* Info */}
        <div style={styles.info}>
          <p style={styles.infoText}>
            <strong>{profile.name}</strong> {profile.active_request?.title}  {/* ← ИЗМЕНЕНО */}
          </p>
        </div>

        {/* Textarea */}
        <div style={styles.textareaContainer}>
          <textarea
            style={styles.textarea}
            placeholder="Ваше сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, maxLength))}
            disabled={isSending || sent}
            rows={6}
          />
          <div style={styles.counter}>
            <span style={{ color: remaining < 50 ? '#ff6b6b' : 'var(--tg-theme-hint-color, #888)' }}>
              {remaining} символов осталось
            </span>
          </div>
        </div>

        {/* Button */}
        {sent ? (
          <div style={styles.sentContainer}>
            <Check size={48} color="#26de81" strokeWidth={3} />
            <p style={styles.sentText}>Отклик отправлен!</p>
          </div>
        ) : (
          <button
            style={{
              ...styles.sendButton,
              opacity: !text.trim() || isSending ? 0.5 : 1,
              cursor: !text.trim() || isSending ? 'not-allowed' : 'pointer',
            }}
            onClick={handleSend}
            disabled={!text.trim() || isSending}
          >
            {isSending ? (
              <div style={styles.spinner} />
            ) : (
              <>
                <Send size={20} />
                <span>Отправить отклик</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(100%);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes checkScale {
          0% { transform: scale(0) rotate(-45deg); }
          50% { transform: scale(1.2) rotate(0deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 1500,
    animation: 'fadeIn 0.3s ease-out',
  },
  modal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '80vh',
    background: 'var(--tg-theme-bg-color, #1a1a1a)',
    borderRadius: '24px 24px 0 0',
    padding: '24px',
    zIndex: 1501,
    animation: 'slideUp 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
    color: 'var(--tg-theme-text-color, #fff)',
  },
  closeButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.05)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #fff)',
  },
  info: {
    padding: '12px 16px',
    background: 'rgba(135, 116, 225, 0.1)',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  infoText: {
    fontSize: '14px',
    color: 'var(--tg-theme-text-color, #fff)',
    margin: 0,
  },
  textareaContainer: {
    marginBottom: '16px',
  },
  textarea: {
    width: '100%',
    padding: '14px',
    borderRadius: '12px',
    border: '2px solid rgba(135, 116, 225, 0.3)',
    background: 'var(--tg-theme-secondary-bg-color, #2a2a2a)',
    color: 'var(--tg-theme-text-color, #fff)',
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  counter: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '8px',
    fontSize: '13px',
  },
  sendButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '16px',
    border: 'none',
    background: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 16px rgba(74, 144, 226, 0.3)',
    transition: 'opacity 0.2s',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid rgba(26, 26, 26, 0.3)',
    borderTop: '3px solid white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  sentContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px 0',
    animation: 'checkScale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  sentText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#26de81',
    margin: 0,
  },
};

export default ResponseModal;