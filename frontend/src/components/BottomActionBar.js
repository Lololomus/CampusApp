import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Mail, X, Check } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';

function BottomActionBar({
  onCommentSend,
  onDirectSend,
  disabled = false,
  replyTo = null,
  replyToName = '',
  onCancelReply = null,
  postAuthorName = 'автора',
}) {
  const [mode, setMode] = useState('default');
  const [commentText, setCommentText] = useState('');
  const [directText, setDirectText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [sendState, setSendState] = useState('idle');

  const commentInputRef = useRef(null);
  const directInputRef = useRef(null);

  useEffect(() => {
    if (!replyTo) return;
    if (mode !== 'comment') switchMode('comment');
    setTimeout(() => {
      if (commentInputRef.current) {
        commentInputRef.current.focus();
      }
    }, 0);
  }, [replyTo]);

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

  const performSendWithSuccess = (sendCallback, clearCallback) => {
    sendCallback();
    hapticFeedback('success');
    setSendState('success');
    clearCallback();
    setTimeout(() => {
      setSendState('idle');
      setMode('default');
      if (onCancelReply) onCancelReply();
    }, 500);
  };

  const sendComment = () => {
    const text = commentText.trim();
    if (!text) return;
    performSendWithSuccess(
      () => onCommentSend(text),
      () => setCommentText('')
    );
  };

  const sendDirect = () => {
    const text = directText.trim();
    if (!text) {
      hapticFeedback('error');
      return;
    }
    performSendWithSuccess(
      () => onDirectSend(text),
      () => setDirectText('')
    );
  };

  const autoResize = (e) => {
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  };

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

  const isSuccess = sendState === 'success';

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
          <div style={styles.inputWrap}>
            {replyTo && replyToName && (
              <div style={styles.contextRow}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticFeedback('light');
                    onCancelReply && onCancelReply();
                  }}
                  style={styles.closeBtn}
                  aria-label="Отменить ответ"
                >
                  <X size={16} color="#8e8e93" />
                </button>
                <span style={styles.contextLabel}>
                  Ответить @{postAuthorName}
                </span>
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
                placeholder="Напишите комментарий..."
                style={styles.textarea}
                rows={1}
                maxLength={2000}
              />

              {(commentText.trim() || isSuccess) && (
                <button
                  type="button"
                  onClick={sendComment}
                  disabled={isSuccess}
                  style={{
                    ...styles.sendFab,
                    background: isSuccess
                      ? '#34c759'
                      : 'linear-gradient(135deg, #8774e1 0%, #6b5dd3 100%)',
                    transform: isSuccess
                      ? 'translateY(-50%) scale(1.1)'
                      : 'translateY(-50%) scale(1)',
                  }}
                  className="send-fab-animate"
                >
                  {isSuccess ? <Check size={20} /> : <Send size={18} />}
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
          <div style={styles.inputWrap}>
            {/* Крестик для закрытия панели Direct */}
            <div style={styles.contextRow}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  hapticFeedback('light');
                  switchMode('default');
                }}
                style={styles.closeBtn}
                aria-label="Закрыть"
              >
                <X size={16} color="#8e8e93" />
              </button>
              <span style={styles.contextLabel}>
                ЛС для @{replyToName || 'автора'}
              </span>
            </div>

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

              {(directText.trim() || isSuccess) && (
                <button
                  type="button"
                  onClick={sendDirect}
                  disabled={isSuccess}
                  style={{
                    ...styles.sendFab,
                    background: isSuccess
                      ? '#34c759'
                      : 'linear-gradient(135deg, #8774e1 0%, #6b5dd3 100%)',
                    transform: isSuccess
                      ? 'translateY(-50%) scale(1.1)'
                      : 'translateY(-50%) scale(1)',
                  }}
                  className="send-fab-animate"
                >
                  {isSuccess ? <Check size={20} /> : <Send size={18} />}
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
    transition: 'flex .25s cubic-bezier(.4,0,.2,1), background-color .18s ease, border .18s ease, height .25s ease',
    position: 'relative',
  },
  bgIdle: '#2a2a2a',
  bgActive: '#333',
  accent: '#8774e1',

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

  inputWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: '100%',
    padding: '8px 12px',
  },

  contextRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minHeight: 20,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    padding: 4,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'transform .1s ease',
  },
  contextLabel: {
    fontSize: 11,
    color: '#8774e1',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
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
    color: '#fff',
    boxShadow: '0 4px 14px rgba(135,116,225,0.4)',
    cursor: 'pointer',
    transition: 'all .3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    flexShrink: 0,
  },
};

const styleTag = document.createElement('style');
styleTag.textContent = `
  .action-button.active {
    animation: glowPulse 2s ease-in-out infinite;
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 18px rgba(135,116,225,.30); }
    50%      { box-shadow: 0 0 26px rgba(135,116,225,.45); }
  }

  .action-button.inactive .button-label { 
    display: none; 
  }
  .action-button.inactive .button-content { 
    justify-content: center; 
    gap: 0; 
    padding: 0; 
  }

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

  .send-fab-animate:hover {
    transform: translateY(-50%) scale(1.08) !important;
    box-shadow: 0 6px 20px rgba(135,116,225,0.6) !important;
  }
  .send-fab-animate:active {
    transform: translateY(-50%) scale(0.92) !important;
    box-shadow: 0 2px 8px rgba(135,116,225,0.3) !important;
  }

  .bottom-action-bar button[aria-label="Отменить ответ"]:hover,
  .bottom-action-bar button[aria-label="Закрыть"]:hover {
    transform: scale(1.1);
  }
  .bottom-action-bar button[aria-label="Отменить ответ"]:active,
  .bottom-action-bar button[aria-label="Закрыть"]:active {
    transform: scale(0.9);
  }

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
if (!document.getElementById('bottom-action-bar-styles')) {
  styleTag.id = 'bottom-action-bar-styles';
  document.head.appendChild(styleTag);
}

export default BottomActionBar;