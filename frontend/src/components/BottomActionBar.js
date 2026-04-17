import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';

import theme from '../theme';
import { hapticFeedback } from '../utils/telegram';
import { processImageFiles, revokeObjectURLs } from '../utils/media';
import { toast } from './shared/Toast';

function BottomActionBar({
  onCommentSend,
  disabled = false,
  replyTo = null,
  replyToName = '',
  onCancelReply = null,
  maxImages = 3,
  disableKeyboardLift = false,
}) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentUrlsRef = useRef(new Set());

  const canSend = useMemo(() => {
    return !disabled && !isSending && (text.trim().length > 0 || attachments.length > 0);
  }, [disabled, isSending, text, attachments.length]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '22px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
  }, [text]);

  useEffect(() => {
    let rafId;
    const onViewportResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!window.visualViewport) return;
        const keyboardHeight = disableKeyboardLift
          ? 0
          : Math.max(0, window.innerHeight - window.visualViewport.height);
        const node = document.querySelector('.post-detail-bottom-bar');
        if (node) {
          node.style.transform = `translateY(-${keyboardHeight}px)`;
        }
      });
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportResize);
    }

    onViewportResize();

    return () => {
      cancelAnimationFrame(rafId);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewportResize);
      }
    };
  }, [disableKeyboardLift]);

  useEffect(() => {
    return () => {
      revokeObjectURLs(Array.from(attachmentUrlsRef.current));
      attachmentUrlsRef.current.clear();
    };
  }, []);

  const openFilePicker = () => {
    if (disabled || isProcessing || attachments.length >= maxImages) return;
    hapticFeedback('light');
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event) => {
    const files = Array.from(event.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (files.length === 0) return;

    const available = maxImages - attachments.length;
    if (available <= 0) {
      toast.error(`Максимум ${maxImages} фото`);
      hapticFeedback('error');
      return;
    }

    const toProcess = files.slice(0, available);
    if (files.length > available) {
      toast.error(`Максимум ${maxImages} фото`);
    }

    setIsProcessing(true);
    try {
      const processed = await processImageFiles(toProcess);
      processed.forEach((item) => {
        if (item.preview) attachmentUrlsRef.current.add(item.preview);
      });
      setAttachments((prev) => [...prev, ...processed].slice(0, maxImages));
      hapticFeedback('success');
    } catch (error) {
      console.error('Comment attachment processing failed:', error);
      toast.error('Не удалось обработать фото');
      hapticFeedback('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const next = [...prev];
      const removed = next[index];
      if (removed?.preview) {
        revokeObjectURLs([removed.preview]);
        attachmentUrlsRef.current.delete(removed.preview);
      }
      next.splice(index, 1);
      return next;
    });
    hapticFeedback('light');
  };

  const handleSend = async () => {
    if (!canSend || typeof onCommentSend !== 'function') return;

    const payloadText = text.trim();
    const payloadFiles = attachments.map((item) => item.file).filter(Boolean);

    setIsSending(true);
    try {
      await Promise.resolve(onCommentSend(payloadText, payloadFiles));
      setText('');
      revokeObjectURLs(Array.from(attachmentUrlsRef.current));
      attachmentUrlsRef.current.clear();
      setAttachments([]);
      if (onCancelReply) onCancelReply();
      hapticFeedback('success');
    } catch (error) {
      console.error('Comment send failed:', error);
      toast.error('Не удалось отправить комментарий');
      hapticFeedback('error');
    } finally {
      setIsSending(false);
    }
  };

  const replyLabel = replyTo && replyToName
    ? (replyToName.startsWith('Аноним') ? 'Ответ анониму' : `Ответ @${replyToName}`)
    : '';

  return (
    <div className="post-detail-bottom-bar" style={styles.container}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesSelected}
        style={{ display: 'none' }}
      />

      <div style={styles.pill}>
        {replyLabel && (
          <div style={styles.replyRow}>
            <span style={styles.replyText}>{replyLabel}</span>
            <button
              type="button"
              onClick={onCancelReply}
              style={styles.replyClose}
              aria-label="Отменить ответ"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div style={styles.attachmentsRow}>
            {attachments.map((item, index) => (
              <div key={`${item.preview}-${index}`} style={styles.attachmentItem}>
                <img src={item.preview} alt="attachment" style={styles.attachmentImage} />
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  style={styles.attachmentRemove}
                  aria-label="Удалить фото"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={styles.inputRow}>
          <button
            type="button"
            onClick={openFilePicker}
            disabled={disabled || isProcessing || attachments.length >= maxImages}
            style={{
              ...styles.attachButton,
              color: attachments.length > 0 ? theme.colors.premium.primary : theme.colors.premium.textMuted,
              opacity: disabled || attachments.length >= maxImages ? 0.5 : 1,
            }}
            aria-label="Прикрепить фото"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Написать комментарий..."
            rows={1}
            maxLength={2000}
            style={styles.textarea}
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              ...styles.sendButton,
              backgroundColor: canSend ? theme.colors.premium.primary : 'transparent',
              color: canSend ? theme.colors.premium.primaryText : theme.colors.premium.textMuted,
              transform: canSend ? 'scale(1)' : 'scale(0.9)',
              opacity: canSend ? 1 : 0.6,
            }}
            aria-label="Отправить комментарий"
          >
            <Send size={16} style={{ marginLeft: canSend ? 2 : 0, transition: 'margin 0.2s' }} />
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'absolute',
    left: 'max(12px, env(safe-area-inset-left, 0px))',
    right: 'max(12px, env(safe-area-inset-right, 0px))',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
    zIndex: 115,
    transition: 'transform 0.2s ease',
    transform: 'translateZ(0)',
    willChange: 'transform',
  },
  pill: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: 24,
    border: '1px solid rgba(255,255,255,0.1)',
    background: theme.colors.premium.surfaceElevated,
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
  },
  replyRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    padding: '2px 8px 8px',
  },
  replyText: {
    fontSize: 12,
    color: theme.colors.premium.textMuted,
    fontWeight: 600,
  },
  replyClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    border: 'none',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  attachmentsRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    padding: '12px 16px 6px',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
  },
  attachmentItem: {
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: 12,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.premium.border}`,
    flexShrink: 0,
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  attachmentRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    border: 'none',
    background: 'rgba(0, 0, 0, 0.65)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '6px 6px 6px 12px',
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    background: 'transparent',
    color: theme.colors.premium.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    marginBottom: 4,
  },
  textarea: {
    flex: 1,
    minHeight: 22,
    maxHeight: 100,
    height: 22,
    resize: 'none',
    border: 'none',
    background: 'transparent',
    color: '#fff',
    fontSize: 15,
    lineHeight: 1.4,
    outline: 'none',
    padding: '11px 0',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    overflowY: 'hidden',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.32, 0.72, 0, 1)',
    flexShrink: 0,
    marginBottom: 4,
  },
};

export default BottomActionBar;
