// ===== 📄 ФАЙЛ: frontend/src/components/dating/MatchCard.js =====
import React from 'react';
import { MessageCircle, Clock } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

const INTEREST_EMOJIS = {
  it: '💻', games: '🎮', books: '📚', music: '🎵', movies: '🎬',
  sport: '⚽', art: '🎨', travel: '✈️', coffee: '☕', party: '🎉',
  photo: '📷', food: '🍕', science: '🔬', startup: '🚀', fitness: '💪',
};

function MatchCard({ match, onClick, onMessage }) {
  const photo = match?.photos?.[0]?.url || match?.photos?.[0] || null;
  const isCritical = match?.hours_left < 3;
  const isUrgent = match?.hours_left < 6;

  const getTimerColor = () => {
    if (isCritical) return '#ff3b5c';
    if (isUrgent) return '#ffc107';
    return '#4caf50';
  };

  return (
    <div
      style={{
        ...styles.card,
        ...(isCritical && styles.cardCritical),
      }}
        onClick={() => {
        hapticFeedback('light');
        if (onClick) onClick();
        }}
    >
      {/* LEFT: Photo */}
      <div style={styles.photoSection}>
        {photo ? (
          <img src={photo} alt={match.name} style={styles.photo} />
        ) : (
          <div style={styles.photoPlaceholder}>
            {match.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* RIGHT: Info */}
      <div style={styles.infoSection}>
        {/* Name + Timer Badge */}
        <div style={styles.topRow}>
          <h3 style={styles.name}>
            {match.name}, {match.age}
          </h3>
          <div
            style={{
              ...styles.timerBadge,
              backgroundColor: getTimerColor(),
            }}
          >
            <Clock size={11} strokeWidth={3} />
            <span>
              {match.hours_left > 0 ? `${match.hours_left}ч` : `${match.minutes_left}м`}
            </span>
          </div>
        </div>

        {/* University */}
        <div style={styles.university}>
          {match.university}
          {match.institute && ` • ${match.institute}`}
          {match.course && ` • ${match.course} курс`}
        </div>

        {/* Interests */}
        {match.interests && match.interests.length > 0 && (
          <div style={styles.interestsRow}>
            {match.interests.slice(0, 4).map((interest, idx) => (
              <span key={idx} style={styles.interestIcon}>
                {INTEREST_EMOJIS[interest] || '⭐'}
              </span>
            ))}
            {match.interests.length > 4 && (
              <span style={styles.moreCount}>+{match.interests.length - 4}</span>
            )}
          </div>
        )}

        {/* Message Button (Full-width) */}
        <button
          style={styles.messageButton}
          onClick={(e) => {
            e.stopPropagation();
            hapticFeedback('medium');
            if (onMessage) onMessage(match);
          }}
        >
          <MessageCircle size={18} strokeWidth={2.5} />
          <span>Написать сообщение</span>
        </button>
      </div>
    </div>
  );
}

const styles = {
    card: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    },

  cardCritical: {
    border: '2px solid #ff3b5c',
    boxShadow: '0 0 16px rgba(255, 59, 92, 0.4)',
  },

  photoSection: {
    flexShrink: 0,
    width: 90,
    borderRadius: 14,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },

  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  photoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },

  infoSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },

  topRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  name: {
    fontSize: 18,
    fontWeight: 800,
    color: theme.colors.text,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },

  timerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 8px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    color: '#fff',
    flexShrink: 0,
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  },

  university: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    lineHeight: 1.3,
  },

  interestsRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },

  interestIcon: {
    fontSize: 20,
  },

  moreCount: {
    fontSize: 12,
    fontWeight: 700,
    color: theme.colors.textSecondary,
  },

  messageButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '11px 16px',
    marginTop: 4,
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(245, 87, 108, 0.35)',
    transition: 'transform 0.15s ease',
  },
};

export default MatchCard;