import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Mail, X } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';

function BottomActionBar({
  onCommentSend,
  onDirectSend,
  disabled = false,
  replyTo = null,
  replyToName = '',
  onCancelReply = null,
}) {
  const [mode, setMode] = useState('default');
  const [commentText, setCommentText] = useState('');
  const [directText, setDirectText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);

  const commentInputRef = useRef(null);
  const directInputRef = useRef(null);

  // Автооткрытие режима комментария по replyTo + подстановка "@имя, "
  useEffect(() => {
    if (!replyTo) return;
    if (mode !== 'comment') switchMode('comment');
    setTimeout(() => {
      setCommentText((prev) => {
        const mention = replyToName ? `@${replyToName}, ` : '';
        if (!mention) return prev;
        if (prev.startsWith(mention)) return prev;
        return prev ? prev : mention;
      });
      if (commentInputRef.current) {
        const v = commentInputRef.current.value;
        commentInputRef.current.setSelectionRange(v.length, v.length);
        commentInputRef.current.focus();
      }
    }, 0);
  }, [replyTo]); // eslint-disable-line

  const switchMode = (next) => {
    if (isAnimating || disabled || mode === next) return;
    hapticFeedback('light');
    setIsAnimating(true);
    setMode(next);
    setTimeout(() => {
      setIsAnimating(false);
      if (next === 'comment' && commentInputRef.current) commentInputRef.current.focus();
      if (next === 'direct' && directInputRef.current) directInputRef.current.focus();
    }, 220);
  };

  const sendComment = () => {
    const text = commentText.trim();
    if (!text) return;
    hapticFeedback('medium');
    onCommentSend(text);
    setCommentText('');
    setMode('default');
    if (onCancelReply) onCancelReply();
  };

  const sendDirect = () => {
    const text = directText.trim();
    if (!text) {
      hapticFeedback('error');
      return;
    }
    hapticFeedback('success');
    onDirectSend(text);
    setDirectText('');
    setMode('default');
  };

  const autoResize = (e) => {
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

  // Поднятие бара с клавиатурой
  useEffect(() => {
    const onResize = () => {
      if (!window.visualViewport) return;
      const kb = window.innerHeight - window.visualViewport.height;
      const bar = document.querySelector('.bottom-action-bar');
      if (bar) bar.style.transform = `translateY(-${kb}px)`;
    };
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);
    return () => {
      if (window.visualViewport) window.visualViewport.removeEventListener('resize', onResize);
    };
  }, []);

  const placeholderComment =
    replyTo && replyToName ? `Ответить @${replyToName}…` : 'Напишите комментарий...';

  return (
    <div
      className="bottom-action-bar"
      style={{
        ...styles.container,
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      {/* Левая — комментарий */}
      <div
        className={`action-button action-button-left ${mode === 'comment' ? 'active' : ''} ${mode === 'direct' ? 'inactive' : ''}`}
        style={{
          ...styles.button,
          flex: mode === 'comment' ? 6 : 1,
          backgroundColor: mode === 'comment' ? styles.bgActive : styles.bgIdle,
          border: mode === 'comment' ? `1px solid ${styles.accent}` : '1px solid transparent',
        }}
        onClick={() => mode !== 'comment' && switchMode('comment')}
      >
        {mode === 'comment' ? (
          <div style={styles.inputWrap} className="input-container-active">
            {/* НОВОЕ: индикатор ответа НАД полем, крестик слева */}
            {replyTo && replyToName && (
              <div style={styles.replyBar}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticFeedback('light');
                    onCancelReply && onCancelReply();
                  }}
                  style={styles.replyCloseBtn}
                  aria-label="Отменить ответ"
                >
                  <X size={16} />
                </button>
                <span style={styles.replyText}>Ответ для @{replyToName}</span>
              </div>
            )}

            <div style={styles.inputRow}>
              <textarea
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => {
                  setCommentText(e.target.value);
                  autoResize(e);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendComment();
                  }
                }}
                placeholder={placeholderComment}
                style={styles.textarea}
                rows={1}
                maxLength={2000}
              />

              {/* ИСПРАВЛЕНО: кнопка появляется только при наличии текста */}
              {commentText.trim() && (
                <button
                  type="button"
                  onClick={sendComment}
                  style={styles.sendFab}
                  className="send-fab-animate"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="button-content" style={styles.buttonContent}>
            <MessageCircle size={20} color="#fff" style={{ flexShrink: 0 }} />
            <span className="button-label" style={styles.buttonLabel}>
              Комментарий
            </span>
          </div>
        )}
      </div>

      {/* Правая — лично */}
      <div
        className={`action-button action-button-right ${mode === 'direct' ? 'active' : ''} ${mode === 'comment' ? 'inactive' : ''}`}
        style={{
          ...styles.button,
          flex: mode === 'direct' ? 6 : 1,
          backgroundColor: mode === 'direct' ? styles.bgActive : styles.bgIdle,
          border: mode === 'direct' ? `1px solid ${styles.accent}` : '1px solid transparent',
        }}
        onClick={() => mode !== 'direct' && switchMode('direct')}
      >
        {mode === 'direct' ? (
          <div style={styles.inputWrap} className="input-container-active">
            <div style={styles.inputRow}>
              <textarea
                ref={directInputRef}
                value={directText}
                onChange={(e) => {
                  setDirectText(e.target.value);
                  autoResize(e);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendDirect();
                  }
                }}
                placeholder="Отклик автору..."
                style={styles.textarea}
                rows={1}
                maxLength={500}
              />

              {/* ИСПРАВЛЕНО: кнопка появляется только при наличии текста */}
              {directText.trim() && (
                <button
                  type="button"
                  onClick={sendDirect}
                  style={styles.sendFab}
                  className="send-fab-animate"
                >
                  <Send size={18} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="button-content" style={styles.buttonContent}>
            <Mail size={20} color="#fff" style={{ flexShrink: 0 }} />
            <span className="button-label" style={styles.buttonLabel}>
              Лично
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 8,
    paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
    display: 'flex',
    gap: 8,
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    zIndex: 100,
    transition: 'transform .25s ease',
  },
    button: {
    minHeight: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'flex .25s cubic-bezier(.4,0,.2,1), background-color .18s ease, border .18s ease, height .25s ease',  // ← ДОБАВИЛ height в transition
    position: 'relative',
    },
  bgIdle: '#2a2a2a',
  bgActive: '#333',
  accent: '#8774e1',

  // Контент свернутой кнопки
  buttonContent: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '0 16px',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    whiteSpace: 'nowrap',
    transition: 'opacity .25s ease, width .25s ease',
  },

  // Активный ввод
  inputWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    width: '100%',
    padding: '8px 12px',
  },
  
  // НОВОЕ: индикатор ответа с крестиком слева
    replyBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    backgroundColor: 'rgba(135, 116, 225, 0.15)',
    borderRadius: 8,
    minHeight: 28,
    },
  replyCloseBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    minWidth: 28,
    minHeight: 28,
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#9aa0a6',
    cursor: 'pointer',
    padding: 0,
    transition: 'background-color .15s ease, transform .1s ease',
    flexShrink: 0,
  },
  replyText: {
    flex: 1,
    fontSize: 13,
    color: '#8774e1',
    fontWeight: '500',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  inputRow: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minHeight: 32,
  },
    textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#f9fafb',
    fontSize: 15,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    resize: 'none',
    minHeight: 24,
    maxHeight: 120,
    lineHeight: '24px',
    padding: '0 48px 0 0',
    overflowY: 'auto',
    },
  
  sendFab: {
    position: 'absolute',
    right: 4,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #8774e1 0%, #6b5dd3 100%)',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(135,116,225,0.4)',
    cursor: 'pointer',
    transition: 'transform .15s ease, box-shadow .15s ease',
    flexShrink: 0,
  },
};

// CSS для анимаций и состояний
const styleTag = document.createElement('style');
styleTag.textContent = `
  .action-button.active {
    animation: glowPulse 2s ease-in-out infinite;
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 18px rgba(135,116,225,.30); }
    50%      { box-shadow: 0 0 26px rgba(135,116,225,.45); }
  }

  /* Когда кнопка сжата — скрыть лейбл, центрировать иконку */
  .action-button.inactive .button-label { 
    display: none; 
  }
  .action-button.inactive .button-content { 
    justify-content: center; 
    gap: 0; 
    padding: 0; 
  }

  /* Анимация появления кнопки Send */
  .send-fab-animate {
    animation: sendBounceIn 0.35s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  }
  @keyframes sendBounceIn {
    0% {
      transform: translateY(-50%) scale(0) rotate(-180deg);
      opacity: 0;
    }
    60% {
      transform: translateY(-50%) scale(1.15) rotate(10deg);
    }
    100% {
      transform: translateY(-50%) scale(1) rotate(0deg);
      opacity: 1;
    }
  }

  /* Hover/Active эффекты для кнопки Send */
  .send-fab-animate:hover {
    transform: translateY(-50%) scale(1.08) !important;
    box-shadow: 0 6px 20px rgba(135,116,225,0.6) !important;
  }
  .send-fab-animate:active {
    transform: translateY(-50%) scale(0.92) !important;
    box-shadow: 0 2px 8px rgba(135,116,225,0.3) !important;
  }

  /* Hover/Active для крестика отмены */
  .bottom-action-bar button[aria-label="Отменить ответ"]:hover {
    background-color: rgba(255,255,255,0.18);
    transform: scale(1.05);
  }
  .bottom-action-bar button[aria-label="Отменить ответ"]:active {
    background-color: rgba(255,255,255,0.25);
    transform: scale(0.95);
  }

  /* Скроллбар textarea */
  .bottom-action-bar textarea::-webkit-scrollbar {
    width: 4px;
  }
  .bottom-action-bar textarea::-webkit-scrollbar-track {
    background: transparent;
  }
  .bottom-action-bar textarea::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 2px;
  }
  .bottom-action-bar textarea::placeholder {
    color: #999;
    opacity: 1;
  }
`;
document.head.appendChild(styleTag);

export default BottomActionBar;