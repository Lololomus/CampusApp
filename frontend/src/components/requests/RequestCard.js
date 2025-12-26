// ===== RequestCard.js =====

import React from 'react';
import { Eye, MessageCircle, Clock } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';

function RequestCard({ request, onClick }) {
  // ===== КАТЕГОРИИ (цвета и иконки) =====
  const CATEGORIES = {
    study: {
      label: 'Учёба',
      icon: '📚',
      color: '#3b82f6', // синий
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    },
    help: {
      label: 'Помощь',
      icon: '🤝',
      color: '#10b981', // зелёный
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    hangout: {
      label: 'Движ',
      icon: '🎉',
      color: '#f59e0b', // оранжевый
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    }
  };

  const categoryConfig = CATEGORIES[request.category] || CATEGORIES.study;

  // ===== ТАЙМЕР (вычисляем оставшееся время) =====
  const getTimeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(request.expires_at);
    const diffMs = expiresAt - now;

    if (diffMs <= 0) return { text: 'Истёк', color: '#666', pulse: false };

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    // Форматирование
    let text = '';
    let color = 'rgba(255,255,255,0.6)'; // серый по умолчанию
    let pulse = false;

    if (days > 0) {
      text = `${days}д`;
      color = 'rgba(255,255,255,0.6)'; // серый
    } else if (hours >= 3) {
      text = `${hours}ч`;
      color = '#fff'; // белый
    } else if (hours >= 1) {
      text = `${hours}ч ${minutes % 60}м`;
      color = '#f59e0b'; // оранжевый
    } else {
      text = `${minutes}м`;
      color = '#ef4444'; // красный
      pulse = true; // пульсация для < 1ч
    }

    return { text, color, pulse };
  };

  const timeRemaining = getTimeRemaining();

  // ===== ОБРЕЗКА ТЕКСТА (2 строки) =====
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // ===== КЛИК =====
  const handleClick = () => {
    hapticFeedback('light');
    if (onClick) onClick(request);
  };

  // ===== АВТОР (имя и инфо) =====
  const authorName = request.author?.name || 'Аноним';
  const authorInitial = authorName[0]?.toUpperCase() || 'A';
  const authorInfo = [
    request.author?.course && `${request.author.course} курс`,
    request.author?.university,
    request.author?.institute
  ].filter(Boolean).join(' • ');

return (
  <>
    <style>{`
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
    `}</style>
    <div style={styles.card} onClick={handleClick}>
      {/* ХЕДЕР КАТЕГОРИИ */}
      <div style={{
        ...styles.header,
        background: categoryConfig.gradient
      }}>
        <div style={styles.categoryLabel}>
          <span style={styles.categoryIcon}>{categoryConfig.icon}</span>
          <span style={styles.categoryText}>{categoryConfig.label}</span>
        </div>
        <div style={{
          ...styles.timer,
          color: timeRemaining.color,
          animation: timeRemaining.pulse ? 'pulse 2s ease-in-out infinite' : 'none'
        }}>
          <Clock size={14} style={{ marginRight: 4 }} />
          {timeRemaining.text}
        </div>
      </div>

      {/* ЗАГОЛОВОК */}
      <div style={styles.title}>
        {request.title}
      </div>

      {/* ПРЕВЬЮ ОПИСАНИЯ */}
      <div style={styles.body}>
        {truncateText(request.body, 100)}
      </div>

      {/* БЛОК АВТОРА */}
      <div style={styles.authorBlock}>
        <div style={styles.authorAvatar}>
          {authorInitial}
        </div>
        <div style={styles.authorInfo}>
          <div style={styles.authorName}>{authorName}</div>
          {authorInfo && (
            <div style={styles.authorDetails}>{authorInfo}</div>
          )}
        </div>
      </div>

      {/* ФУТЕР: ТЕГИ + СТАТИСТИКА */}
      <div style={styles.footer}>
        {/* ТЕГИ */}
        <div style={styles.tags}>
          {request.tags && request.tags.slice(0, 3).map((tag, idx) => (
            <span key={idx} style={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>

        {/* СТАТИСТИКА */}
        <div style={styles.stats}>
          <span style={styles.statItem}>
            <Eye size={14} />
            {request.views_count || 0}
          </span>
          <span style={styles.statItem}>
            <MessageCircle size={14} />
            {request.responses_count || 0}
          </span>
        </div>
      </div>
    </div>  
  </>  
);
}

// ===== СТИЛИ =====
const styles = {
  card: {
    background: theme.colors.card, // #1e1e1e
    borderRadius: theme.radius.lg, // 16px
    overflow: 'hidden',
    cursor: 'pointer',
    marginBottom: theme.spacing.md, // 12px
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    border: `1px solid ${theme.colors.border}`,
    ':hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
    },
    ':active': {
      transform: 'scale(0.98)'
    }
  },

  // ХЕДЕР КАТЕГОРИИ
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    color: '#fff'
  },

  categoryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs, // 4px
    fontSize: theme.fontSize.sm, // 13px
    fontWeight: theme.fontWeight.semibold // 600
  },

  categoryIcon: {
    fontSize: theme.fontSize.md // 15px
  },

  categoryText: {
    fontSize: theme.fontSize.sm // 13px
  },

  timer: {
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.fontSize.xs, // 12px
    fontWeight: theme.fontWeight.semibold, // 600
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: theme.radius.sm // 8px
  },

  // ЗАГОЛОВОК
  title: {
    fontSize: theme.fontSize.lg, // 16px
    fontWeight: theme.fontWeight.semibold, // 600
    color: theme.colors.text, // #fff
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px ${theme.spacing.sm}px`,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },

  // ПРЕВЬЮ ОПИСАНИЯ
  body: {
    fontSize: theme.fontSize.sm, // 13px
    color: theme.colors.textSecondary, // #ccc
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.lg}px`,
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },

  // БЛОК АВТОРА
  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md, // 12px
    padding: theme.spacing.md, // 12px
    background: '#252525', // темнее чем карточка
    borderTop: `1px solid ${theme.colors.border}`,
    borderBottom: `1px solid ${theme.colors.border}`
  },

  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full, // круг
    background: theme.colors.primary, // #8774e1
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.lg, // 16px
    fontWeight: theme.fontWeight.semibold, // 600
    flexShrink: 0
  },

  authorInfo: {
    flex: 1,
    overflow: 'hidden'
  },

  authorName: {
    fontSize: theme.fontSize.base, // 14px
    fontWeight: theme.fontWeight.medium, // 500
    color: theme.colors.text, // #fff
    marginBottom: 2
  },

  authorDetails: {
    fontSize: theme.fontSize.xs, // 12px
    color: theme.colors.textTertiary, // #999
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  // ФУТЕР: ТЕГИ + СТАТИСТИКА
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md, // 12px
    paddingTop: theme.spacing.sm // 8px
  },

  tags: {
    display: 'flex',
    gap: theme.spacing.xs, // 4px
    flex: 1,
    overflow: 'hidden'
  },

  tag: {
    fontSize: theme.fontSize.xs, // 12px
    color: theme.colors.primary, // #8774e1
    background: 'rgba(135, 116, 225, 0.1)',
    padding: `2px ${theme.spacing.sm}px`,
    borderRadius: theme.radius.sm, // 8px
    whiteSpace: 'nowrap'
  },

  stats: {
    display: 'flex',
    gap: theme.spacing.md, // 12px
    alignItems: 'center',
    flexShrink: 0
  },

  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs, // 4px
    fontSize: theme.fontSize.xs, // 12px
    color: theme.colors.textTertiary // #999
  }
};

export default RequestCard;