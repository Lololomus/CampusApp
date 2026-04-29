// ===== FILE: src/components/dating/MatchCard.js =====
// Вертикальная карточка мэтча 165x260 для горизонтального скролла

import React from 'react';
import { MessageCircle, Clock, GraduationCap } from 'lucide-react';
import { INTEREST_EMOJIS, GOAL_EMOJIS } from '../../constants/datingConstants';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

const d = theme.colors.dating;

function MatchCard({ match, onClick, onMessage }) {
  const photo = match?.photos?.[0]?.url || match?.photos?.[0] || null;
  const commonInterests = match?.common_interests || [];
  const commonGoals = match?.common_goals || [];

  const timeLabel = match?.hours_left > 0
    ? `${match.hours_left}ч`
    : `${match?.minutes_left || 0}м`;

  return (
    <div style={styles.card} onClick={() => { hapticFeedback('light'); if (onClick) onClick(); }}>
      {/* Фото секция */}
      <div style={styles.photoSection}>
        {photo ? (
          <img src={photo} alt={match.name} style={styles.photo} loading="lazy" decoding="async" />
        ) : (
          <div style={styles.photoPlaceholder}>
            {match.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
        <div style={styles.photoGradient} />
        <div style={styles.timerBadge}>
          <Clock size={10} /> {timeLabel}
        </div>
      </div>

      {/* Инфо секция */}
      <div style={styles.infoSection}>
        <div>
          {/* Имя + возраст */}
          <div style={styles.name}>{match.name}, {match.age}</div>
          {/* Вуз (факультет) */}
          <div style={styles.university}>
            <GraduationCap size={12} />
            {match.institute || match.university}
          </div>
        </div>

        {/* Цели: emoji-only pills */}
        {match.goals?.length > 0 && (
          <div style={styles.goalsRow}>
            {match.goals.map(goal => {
              const isCommon = commonGoals.includes(goal);
              return (
                <div key={goal} style={isCommon ? styles.goalPillCommon : styles.goalPill} title={goal}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{GOAL_EMOJIS[goal] || '✨'}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Интересы: 24x24 emoji badges */}
        {match.interests?.length > 0 && (
          <div style={styles.interestsRow}>
            {match.interests.slice(0, 5).map(interest => {
              const isCommon = commonInterests.includes(interest);
              return (
                <div key={interest} style={isCommon ? styles.interestCommon : styles.interestBadge}>
                  {INTEREST_EMOJIS[interest] || '⭐'}
                </div>
              );
            })}
          </div>
        )}

        {/* Кнопка "Написать" */}
        <button
          style={styles.messageButton}
          onClick={(e) => {
            e.stopPropagation();
            hapticFeedback('medium');
            if (onMessage) onMessage(match);
          }}
        >
          <MessageCircle size={15} fill="currentColor" /> Написать
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    width: 165,
    minHeight: 260,
    borderRadius: 24,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: d.cardBg,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  photoSection: {
    position: 'relative',
    width: '100%',
    height: 130,
    flexShrink: 0,
    backgroundColor: '#111',
  },
  photo: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    objectFit: 'cover',
  },
  photoPlaceholder: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    background: `linear-gradient(to top, ${d.cardBg}, transparent)`,
    pointerEvents: 'none',
  },
  timerBadge: {
    position: 'absolute',
    top: 8, right: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: d.pink,
    fontSize: 10,
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: 8,
  },
  infoSection: {
    flex: 1,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 15,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  university: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    color: d.textMuted,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  goalsRow: {
    display: 'flex',
    gap: 6,
    marginTop: 2,
  },
  goalPill: {
    backgroundColor: d.surface,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    padding: '4px 10px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalPillCommon: {
    backgroundColor: d.commonBg,
    border: `1px solid ${d.commonBorder}`,
    boxShadow: d.commonGlow,
    padding: '4px 10px',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'nowrap',
  },
  interestBadge: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 8,
    backgroundColor: '#252525',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
  },
  interestCommon: {
    width: 24,
    height: 24,
    flexShrink: 0,
    borderRadius: 8,
    backgroundColor: d.commonBg,
    border: `1px solid ${d.commonBorder}`,
    boxShadow: d.commonGlow,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
  },
  messageButton: {
    width: '100%',
    padding: '10px 0',
    marginTop: 'auto',
    borderRadius: 12,
    border: 'none',
    backgroundColor: d.pink,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(255, 45, 85, 0.3)',
    transition: 'transform 0.15s ease',
  },
};

export default MatchCard;
