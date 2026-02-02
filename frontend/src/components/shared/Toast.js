import React, { useEffect, useState, useRef } from 'react';
import useStore from '../../store';
import { hapticFeedback } from '../../utils/telegram';

// ===== КОНФИГУРАЦИЯ ТИПОВ ТОСТОВ =====
const TOAST_CONFIG = {
  success: {
    icon: '✓',
    color: '#10b981',
    bg: '#10b98125',
    borderColor: '#10b981',
  },
  error: {
    icon: '✗',
    color: '#ef4444',
    bg: '#ef444425',
    borderColor: '#ef4444',
  },
  info: {
    icon: 'ℹ',
    color: '#3b82f6',
    bg: '#3b82f625',
    borderColor: '#3b82f6',
  },
  warning: {
    icon: '⚠',
    color: '#f59e0b',
    bg: '#f59e0b25',
    borderColor: '#f59e0b',
  },
};

// ===== КОМПОНЕНТ ОДИНОЧНОГО ТОСТА =====
const Toast = ({ id, type = 'info', message, duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const remainingTimeRef = useRef(duration);

  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;

  // Появление
  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  // Автозакрытие с прогресс-баром
  useEffect(() => {
    if (isPaused) return;

    const startTime = Date.now();
    const endTime = startTime + remainingTimeRef.current;

    const updateProgress = () => {
      const now = Date.now();
      const remaining = endTime - now;
      const progressValue = (remaining / duration) * 100;

      if (remaining <= 0) {
        handleClose();
      } else {
        setProgress(Math.max(0, progressValue));
        timerRef.current = requestAnimationFrame(updateProgress);
      }
    };

    timerRef.current = requestAnimationFrame(updateProgress);

    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, [isPaused, duration]);

  const handleClose = () => {
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
    }
    setIsExiting(true);
    hapticFeedback('light');
    setTimeout(() => onClose(id), 300);
  };

  const handleMouseEnter = () => {
    setIsPaused(true);
    const elapsed = Date.now() - startTimeRef.current;
    remainingTimeRef.current = Math.max(0, duration - elapsed);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    startTimeRef.current = Date.now();
  };

  return (
    <div
      style={{
        ...styles.toast,
        background: config.bg,
        borderColor: config.borderColor,
        animation: isExiting
          ? 'slideOutDown 0.3s ease forwards'
          : isVisible
          ? 'slideInUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
          : 'none',
        opacity: isVisible ? 1 : 0,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Иконка */}
      <div style={{ ...styles.icon, color: config.color }}>
        {config.icon}
      </div>

      {/* Текст */}
      <div style={styles.message}>{message}</div>

      {/* Кнопка закрытия */}
      <button
        onClick={handleClose}
        style={styles.closeButton}
        aria-label="Закрыть"
      >
        ✕
      </button>

      {/* Прогресс-бар */}
      <div
        style={{
          ...styles.progressBar,
          background: config.color,
          width: `${progress}%`,
        }}
      />
    </div>
  );
};

// ===== КОНТЕЙНЕР ВСЕХ ТОСТОВ =====
const ToastContainer = () => {
  const { toasts, removeToast } = useStore();

  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

// ===== API ДЛЯ ВЫЗОВА ТОСТОВ =====
export const toast = {
  success: (message, options = {}) => {
    const store = useStore.getState();
    store.addToast({
      type: 'success',
      message,
      ...options,
    });
    hapticFeedback('success');
  },

  error: (message, options = {}) => {
    const store = useStore.getState();
    store.addToast({
      type: 'error',
      message,
      ...options,
    });
    hapticFeedback('error');
  },

  info: (message, options = {}) => {
    const store = useStore.getState();
    store.addToast({
      type: 'info',
      message,
      ...options,
    });
    hapticFeedback('light');
  },

  warning: (message, options = {}) => {
    const store = useStore.getState();
    store.addToast({
      type: 'warning',
      message,
      ...options,
    });
    hapticFeedback('medium');
  },
};

// ===== СТИЛИ =====
const styles = {
  container: {
    position: 'fixed',
    bottom: '80px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '400px',
    zIndex: 10000,
    pointerEvents: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },

  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 16px',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid',
    position: 'relative',
    overflow: 'hidden',
    pointerEvents: 'auto',
    transition: 'all 0.2s ease',
  },

  icon: {
    fontSize: '20px',
    fontWeight: 'bold',
    flexShrink: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  message: {
    flex: 1,
    fontSize: '15px',
    fontWeight: 600,
    color: '#ffffff',
    lineHeight: 1.4,
    fontFamily: 'Arial, sans-serif',
  },

  closeButton: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: 'none',
    background: 'rgba(255,255,255,0.15)',
    color: '#ffffff',
    opacity: 0.7,
    transition: 'all 0.2s ease',
    flexShrink: 0,
    padding: 0,
  },

  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '3px',
    transition: 'none',
    pointerEvents: 'none',
  },
};

// ===== CSS АНИМАЦИИ =====
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideInUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  @keyframes slideOutDown {
    from {
      transform: translateY(0);
      opacity: 1;
    }
    to {
      transform: translateY(100%);
      opacity: 0;
    }
  }

  /* Hover эффекты */
  div[style*="toast"]:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  }

  div[style*="toast"]:hover button {
    opacity: 1;
    background: rgba(255,255,255,0.25);
  }

  button[aria-label="Закрыть"]:hover {
    background: rgba(255,255,255,0.35) !important;
  }

  button[aria-label="Закрыть"]:active {
    transform: scale(0.9);
  }
`;

if (!document.head.querySelector('[data-toast-styles]')) {
  styleSheet.setAttribute('data-toast-styles', '');
  document.head.appendChild(styleSheet);
}

export default ToastContainer;