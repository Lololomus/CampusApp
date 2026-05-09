// ===== 📄 ФАЙЛ: frontend/src/components/posts/PublishingPostCard.js =====
//
// Карточка-плейсхолдер для фоновой публикации поста с медиа.
// Состояния: uploading (skeleton + прогресс), success (короткая зелёная подсветка),
// error (сообщение об ошибке + действия Повторить / Открыть редактор).

import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, Edit3, X as XIcon } from 'lucide-react';
import {
  retryPublishingTask,
  cancelPublishingTask,
  recoverDraftFromTask,
} from '../../services/postPublisher';

function PublishingPostCard({ task }) {
  if (!task) return null;

  const status = task.status || 'uploading';
  const progress = Math.max(0, Math.min(100, task.progress || 0));

  let accentColor = '#0A84FF';
  let title = 'Публикуем ваш пост…';
  let subtitle = 'Не закрывайте приложение слишком надолго';
  let StatusIcon = Loader2;
  let iconSpin = true;

  if (status === 'success') {
    accentColor = '#32D74B';
    title = 'Пост опубликован';
    subtitle = '';
    StatusIcon = CheckCircle2;
    iconSpin = false;
  } else if (status === 'error') {
    accentColor = '#FF453A';
    title = 'Не удалось опубликовать пост';
    subtitle = task.errorMessage || 'Попробуйте ещё раз';
    StatusIcon = AlertTriangle;
    iconSpin = false;
  } else if (status === 'processing') {
    title = 'Пост дорабатывается…';
    subtitle = 'Файлы дошли до сервера. Скоро обновим вложения';
  } else {
    // uploading
    if (progress > 0 && progress < 100) {
      subtitle = `Загрузка ${progress}%`;
    }
  }

  const showCancel = status === 'uploading' || status === 'processing';
  const showRetry = status === 'error';
  const showRecover = status === 'error';

  const handleCancel = () => {
    cancelPublishingTask(task.id);
  };

  const handleRetry = () => {
    retryPublishingTask(task.id);
  };

  const handleRecover = () => {
    recoverDraftFromTask(task.id);
  };

  return (
    <div style={{ ...styles.card, borderColor: withAlpha(accentColor, 0.35) }}>
      <div style={styles.headerRow}>
        <div
          style={{
            ...styles.iconWrap,
            background: withAlpha(accentColor, 0.12),
            color: accentColor,
            animation: iconSpin ? 'spin 1.2s linear infinite' : 'none',
          }}
        >
          <StatusIcon size={20} strokeWidth={2.5} />
        </div>
        <div style={styles.textBlock}>
          <div style={styles.title}>{title}</div>
          {subtitle ? <div style={styles.subtitle}>{subtitle}</div> : null}
        </div>
        {showCancel && (
          <button
            type="button"
            onClick={handleCancel}
            style={styles.cancelBtn}
            aria-label="Отменить публикацию"
          >
            <XIcon size={16} />
          </button>
        )}
      </div>

      {(status === 'uploading' || status === 'processing') && (
        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${progress > 0 ? progress : 5}%`,
              background: accentColor,
              animation: progress > 0 ? 'none' : 'shimmer 1.5s infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      )}

      {(showRetry || showRecover) && (
        <div style={styles.actionsRow}>
          {showRetry && (
            <button type="button" onClick={handleRetry} style={styles.primaryBtn}>
              <RefreshCw size={14} />
              <span>Повторить</span>
            </button>
          )}
          {showRecover && (
            <button type="button" onClick={handleRecover} style={styles.secondaryBtn}>
              <Edit3 size={14} />
              <span>Открыть редактор</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function withAlpha(hex, alpha) {
  // hex как '#RRGGBB' -> rgba
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const num = parseInt(m[1], 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = {
  card: {
    background: '#1a1a1a',
    borderRadius: '12px',
    padding: '14px 14px 16px',
    marginBottom: '12px',
    border: '1px solid #2a2a2a',
    transition: 'border-color 0.3s ease',
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'Arial, sans-serif',
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  cancelBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    opacity: 0.75,
  },
  progressTrack: {
    marginTop: 12,
    height: 4,
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 999,
    transition: 'width 0.2s ease',
  },
  actionsRow: {
    marginTop: 14,
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(50,215,75,0.35)',
    background: 'rgba(50,215,75,0.12)',
    color: '#32D74B',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'Arial, sans-serif',
  },
};

export default PublishingPostCard;
