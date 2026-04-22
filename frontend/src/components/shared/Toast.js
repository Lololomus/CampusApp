import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X as XIcon } from 'lucide-react';
import useStore from '../../store';
import { hapticFeedback } from '../../utils/telegram';

// ===== КОНФИГУРАЦИЯ ТИПОВ ТОСТОВ =====
const TOAST_CONFIG = {
  success: {
    Icon: CheckCircle2,
    color: '#32D74B',
    borderColor: 'rgba(50,215,75,0.25)',
  },
  error: {
    Icon: AlertTriangle,
    color: '#FF453A',
    borderColor: 'rgba(255,69,58,0.25)',
  },
  info: {
    Icon: Info,
    color: '#0A84FF',
    borderColor: 'rgba(10,132,255,0.25)',
  },
  warning: {
    Icon: AlertTriangle,
    color: '#FF9F0A',
    borderColor: 'rgba(255,159,10,0.25)',
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
  const ToastIcon = config.Icon;

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
        background: '#1C1C1E',
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
      <ToastIcon size={20} color={config.color} strokeWidth={2.5} style={{ flexShrink: 0 }} />

      {/* Текст */}
      <div style={styles.message}>{message}</div>

      {/* Кнопка закрытия */}
      <button
        onClick={handleClose}
        style={styles.closeButton}
        aria-label="Закрыть"
      >
        <XIcon size={14} />
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
    width: '100%',
    minWidth: 'min(320px, calc(100vw - 32px))',
    boxSizing: 'border-box',
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

export default ToastContainer;
