// ===== FILE: src/components/dating/ProfileSheet.js =====
// Bottom sheet для просмотра полной анкеты из фида (мок-дизайн datingfeed.txt)

import React from 'react';
import { ChevronDown, GraduationCap, Sparkles, Heart, X } from 'lucide-react';
import { GOAL_LABELS, INTEREST_LABELS } from '../../constants/datingConstants';
import { hapticFeedback } from '../../utils/telegram';
import SwipeableModal from '../shared/SwipeableModal';
import theme from '../../theme';

const d = theme.colors.dating;

function ProfileSheet({ profile, isOpen, onClose, onLike, onSkip }) {
  if (!profile) return null;

  const commonInterests = profile.common_interests || [];
  const isFromUni = profile.match_reason && (
    profile.match_reason.includes('вуз') ||
    profile.match_reason.includes('факультет') ||
    profile.match_reason.includes('Из твоего')
  );

  const handleLike = () => {
    hapticFeedback('medium');
    if (onLike) onLike();
    onClose();
  };

  const handleSkip = () => {
    hapticFeedback('light');
    if (onSkip) onSkip();
    onClose();
  };

  const icebreaker = profile.prompts?.question && profile.prompts?.answer
    ? { question: profile.prompts.question, answer: profile.prompts.answer }
    : profile.icebreaker
      ? { question: 'Ледокол', answer: profile.icebreaker }
      : null;

  const footer = (
    <div style={{ display: 'flex', gap: 12 }}>
      <button style={styles.skipButton} onClick={handleSkip}>
        <X size={24} color={d.textMuted} /> Пропустить
      </button>
      <button style={styles.likeButton} onClick={handleLike}>
        <Heart size={20} fill="currentColor" /> Лайк
      </button>
    </div>
  );

  return (
    <SwipeableModal isOpen={isOpen} onClose={onClose} footer={footer} zIndex={2000}>
      {/* Header: Имя + возраст + кнопка закрытия */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.name}>{profile.name}, {profile.age}</h1>
          <div style={styles.uniRow}>
            <GraduationCap size={18} color={d.textMuted} />
            <span>{profile.university}{profile.institute ? ` • ${profile.institute}` : ''}</span>
          </div>
        </div>
        <button style={styles.closeButton} onClick={onClose}>
          <ChevronDown size={24} color={d.textMuted} />
        </button>
      </div>

      {/* Бейджи: вуз + цели */}
      <div style={styles.badgesRow}>
        {isFromUni && (
          <div style={styles.uniBadge}>
            <Sparkles size={14} /> Из твоего вуза
          </div>
        )}
        {profile.goals?.map(goal => (
          <div key={goal} style={styles.goalBadge}>
            {GOAL_LABELS[goal] || goal}
          </div>
        ))}
      </div>

      {/* Icebreaker */}
      {icebreaker && (
        <div style={styles.icebreaker}>
          <div style={styles.icebreakerAccent} />
          <span style={styles.icebreakerLabel}>Ледокол</span>
          <span style={styles.icebreakerQuestion}>{icebreaker.question}</span>
          <p style={styles.icebreakerAnswer}>{icebreaker.answer}</p>
        </div>
      )}

      {/* О себе */}
      {profile.bio && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>О себе</h3>
          <p style={styles.bioText}>{profile.bio}</p>
        </div>
      )}

      {/* Интересы */}
      {profile.interests?.length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Интересы</h3>
          <div style={styles.interestsGrid}>
            {profile.interests.map(interest => {
              const isCommon = commonInterests.includes(interest);
              return (
                <div key={interest} style={isCommon ? styles.interestCommon : styles.interestChip}>
                  {INTEREST_LABELS[interest] || interest}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </SwipeableModal>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingTop: 4,
  },
  name: {
    fontSize: 30,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    lineHeight: 1.1,
  },
  uniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    color: d.textMuted,
    fontWeight: 500,
    fontSize: 15,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: d.surfaceHover,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  },
  badgesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  uniBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    border: '1px solid rgba(212, 255, 0, 0.2)',
    color: d.accent,
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  goalBadge: {
    backgroundColor: d.surfaceHover,
    border: '1px solid rgba(255, 255, 255, 0.04)',
    color: '#fff',
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 700,
  },
  icebreaker: {
    position: 'relative',
    backgroundColor: 'rgba(44, 44, 46, 0.5)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: '16px 16px 16px 20px',
    marginBottom: 32,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  icebreakerAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: d.pink,
  },
  icebreakerLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: d.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  icebreakerQuestion: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  icebreakerAnswer: {
    fontSize: 15,
    color: d.textLight,
    lineHeight: 1.5,
    margin: 0,
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: d.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 12,
    margin: '0 0 12px 0',
  },
  bioText: {
    fontSize: 16,
    color: d.textLight,
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  interestsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: d.surfaceHover,
    border: '1px solid rgba(255, 255, 255, 0.04)',
    color: d.textLight,
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
  },
  interestCommon: {
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    border: '1px solid rgba(212, 255, 0, 0.3)',
    color: d.accent,
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
  },
  skipButton: {
    flex: 1,
    backgroundColor: d.surfaceHover,
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  likeButton: {
    flex: 1,
    backgroundColor: d.pink,
    color: '#fff',
    fontWeight: 700,
    fontSize: 18,
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 8px 24px rgba(255, 45, 85, 0.3)',
  },
};

export default ProfileSheet;
