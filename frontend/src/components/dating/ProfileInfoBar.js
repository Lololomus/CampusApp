// ===== 📄 ФАЙЛ: frontend/src/components/dating/ProfileInfoBar.js =====
import React, { useRef, useState, useEffect, memo } from 'react';
import { hapticFeedback } from '../../utils/telegram';
import {
  GOAL_ICONS,
  INTEREST_LABELS,
  INTEREST_EMOJIS,
  MATCH_REASON_CONFIG,
} from '../../constants/datingConstants';
import theme from '../../theme';

// ===== CONSTANTS =====
const EXPANDED_HEIGHT = '85vh';
const MAX_HEIGHT_PX = 580;
const COLLAPSED_HEIGHT = 245;

// ===== HELPERS =====

/** Проверить, является ли интерес общим */
const isCommonInterest = (interest, commonInterests) => {
  if (!commonInterests || commonInterests.length === 0) return false;
  return commonInterests.includes(interest);
};

// ===== MATCH REASON BADGE =====

const MatchReasonBadge = memo(({ reason }) => {
  if (!reason) return null;
  
  return (
    <div style={badgeStyles.container}>
      <span style={badgeStyles.icon}>{MATCH_REASON_CONFIG.icon}</span>
      <span style={badgeStyles.text}>{reason}</span>
    </div>
  );
});

const badgeStyles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    borderRadius: 20,
    background: MATCH_REASON_CONFIG.badgeBg,
    border: `1px solid ${MATCH_REASON_CONFIG.badgeBorder}`,
    marginTop: 8,
  },
  icon: {
    fontSize: 12,
  },
  text: {
    fontSize: 12,
    fontWeight: 600,
    color: MATCH_REASON_CONFIG.badgeText,
    letterSpacing: '0.2px',
  },
};

// ===== MEMOIZED COMPONENTS =====

const CollapsedContent = memo(({ profile, commonInterests }) => {
  return (
    <>
      {/* Match reason badge */}
      {profile.match_reason && (
        <div style={{ marginBottom: 10 }}>
          <MatchReasonBadge reason={profile.match_reason} />
        </div>
      )}

      {profile.goals?.length > 0 && (
        <div style={styles.goalsRowCollapsed}>
          {profile.goals.slice(0, 2).map((goal, i) => (
            <span key={i} style={styles.goalChip}>
              {GOAL_ICONS[goal] || goal}
            </span>
          ))}
        </div>
      )}

      {profile.interests?.length > 0 && (
        <div style={styles.interestsEmojiRow}>
          {profile.interests.slice(0, 5).map((interest, i) => {
            const isCommon = isCommonInterest(interest, commonInterests);
            return (
              <span
                key={i}
                style={{
                  ...styles.emojiOnly,
                  ...(isCommon ? styles.emojiCommon : {}),
                }}
                title={isCommon ? 'Общий интерес!' : INTEREST_LABELS[interest]}
              >
                {INTEREST_EMOJIS[interest] || '❓'}
              </span>
            );
          })}
          {profile.interests.length > 5 && (
            <span style={styles.moreText}>+{profile.interests.length - 5}</span>
          )}
        </div>
      )}
    </>
  );
});

const ExpandedContent = memo(({ profile, commonInterests }) => {
  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Match reason badge (expanded) */}
      {profile.match_reason && (
        <div style={{ marginBottom: 12, marginTop: 4 }}>
          <MatchReasonBadge reason={profile.match_reason} />
        </div>
      )}

      {/* Prompts / Icebreaker */}
      {(profile.icebreaker || (profile.prompts?.question && profile.prompts?.answer)) && (
        <div style={styles.promptCard}>
          <div style={styles.promptQuestion}>
            {profile.prompts?.question || 'Ледокол'}
          </div>
          <div style={styles.promptAnswer}>
            {profile.prompts?.answer || profile.icebreaker}
          </div>
        </div>
      )}

      {/* Goals */}
      {profile.goals?.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Цели</div>
          <div style={styles.goalsGrid}>
            {profile.goals.map((goal) => (
              <span key={goal} style={styles.goalTag}>
                {GOAL_ICONS[goal] || goal}
              </span>
            ))}
          </div>
        </>
      )}

      {/* Bio */}
      {profile.bio && (
        <>
          <div style={styles.sectionTitle}>О себе</div>
          <p style={styles.bio}>{profile.bio}</p>
        </>
      )}

      {/* Interests — с подсветкой общих */}
      {profile.interests?.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Интересы</div>
          <div style={styles.interestsGrid}>
            {profile.interests.map((interest) => {
              const isCommon = isCommonInterest(interest, commonInterests);
              return (
                <span
                  key={interest}
                  style={isCommon ? styles.interestTagCommon : styles.interestTag}
                >
                  {INTEREST_LABELS[interest] || interest}
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
});

// ===== MAIN COMPONENT =====

function ProfileInfoBar({ profile, isExpanded: externalIsExpanded, onToggle }) {
  const containerRef = useRef(null);
  const collapsedRef = useRef(null);
  const expandedRef = useRef(null);
  
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const translateRange = useRef(300);
  const currentTranslate = useRef(300);

  // Достаём common_interests из профиля (приходит с бэка)
  const commonInterests = profile?.common_interests || [];

  useEffect(() => {
    const updateDimensions = () => {
      const vh = window.innerHeight;
      const expandedH = Math.min(vh * 0.85, MAX_HEIGHT_PX);
      const range = Math.round(expandedH - COLLAPSED_HEIGHT);
      translateRange.current = range;
      
      const target = externalIsExpanded ? 0 : range;
      currentTranslate.current = target;
      if (containerRef.current) {
         containerRef.current.style.height = `${Math.round(expandedH)}px`;
         animateTo(target);
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const targetY = externalIsExpanded ? 0 : translateRange.current;
    animateTo(targetY);
    currentTranslate.current = targetY;
  }, [externalIsExpanded]);

  if (!profile) return null;

  // --- PHYSICS ENGINE ---

  const applyStyles = (translateY) => {
    if (!containerRef.current) return;

    const roundedY = Math.round(translateY);
    containerRef.current.style.transform = `translate3d(0, ${roundedY}px, 0)`;

    const range = translateRange.current || 1;
    const progress = translateY / range;
    const safeProgress = Math.max(0, Math.min(1, progress));

    if (collapsedRef.current) {
        const opacity = (safeProgress - 0.5) * 2; 
        collapsedRef.current.style.opacity = Math.max(0, Math.min(1, opacity));
        const yShift = Math.round((1 - safeProgress) * -10);
        collapsedRef.current.style.transform = `translate3d(0, ${yShift}px, 0)`;
        collapsedRef.current.style.pointerEvents = safeProgress > 0.9 ? 'auto' : 'none';
    }

    if (expandedRef.current) {
        const opacity = 1 - (safeProgress * 1.3);
        expandedRef.current.style.opacity = Math.max(0, opacity);
        const yShift = Math.round(safeProgress * 30);
        expandedRef.current.style.transform = `translate3d(0, ${yShift}px, 0)`;
        expandedRef.current.style.pointerEvents = safeProgress < 0.1 ? 'auto' : 'none';
    }
  };

  const animateTo = (targetY) => {
    if (!containerRef.current) return;
    
    const transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease';
    
    containerRef.current.style.transition = transition;
    if (collapsedRef.current) collapsedRef.current.style.transition = transition;
    if (expandedRef.current) expandedRef.current.style.transition = transition;

    applyStyles(targetY);
  };

  // --- HANDLERS ---

  const handleStart = (clientY, target) => {
    const content = expandedRef.current;
    if (externalIsExpanded && content && content.contains(target)) {
        if (content.scrollTop > 0) return;
    }

    isDragging.current = true;
    startY.current = clientY;
    startTime.current = Date.now();

    if (containerRef.current) containerRef.current.style.transition = 'none';
    if (collapsedRef.current) collapsedRef.current.style.transition = 'none';
    if (expandedRef.current) expandedRef.current.style.transition = 'none';
  };

  const handleMove = (clientY) => {
    if (!isDragging.current) return;

    const delta = clientY - startY.current;
    const baseTranslate = externalIsExpanded ? 0 : translateRange.current;
    
    if (externalIsExpanded && delta < 0 && expandedRef.current?.scrollTop >= 0) return;
    if (externalIsExpanded && delta > 0 && expandedRef.current?.scrollTop > 0) return;

    let newTranslate = baseTranslate + delta;

    if (newTranslate < 0) {
        newTranslate = newTranslate * 0.3;
    } else if (newTranslate > translateRange.current) {
        const excess = newTranslate - translateRange.current;
        newTranslate = translateRange.current + (excess * 0.3);
    }

    applyStyles(newTranslate);
    currentTranslate.current = newTranslate;
  };

  const handleEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const timeDiff = Date.now() - startTime.current;
    const distance = currentTranslate.current - (externalIsExpanded ? 0 : translateRange.current);
    const velocity = Math.abs(distance / timeDiff);
    const range = translateRange.current;

    let shouldExpand = externalIsExpanded;

    if (velocity > 0.4) {
        shouldExpand = distance < 0; 
    } else {
        if (externalIsExpanded) {
            shouldExpand = currentTranslate.current < 100;
        } else {
            shouldExpand = currentTranslate.current < (range - 60);
        }
    }

    onToggle(shouldExpand);
    hapticFeedback(shouldExpand === externalIsExpanded ? 'light' : 'medium');
  };

  return (
    <div
      ref={containerRef}
      style={{
        ...styles.container,
        height: MAX_HEIGHT_PX,
        transform: `translate3d(0, ${translateRange.current}px, 0)`,
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientY, e.target)}
      onTouchMove={(e) => handleMove(e.touches[0].clientY)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientY, e.target)}
      onMouseMove={(e) => isDragging.current && handleMove(e.clientY)}
      onMouseUp={handleEnd}
      onMouseLeave={() => isDragging.current && handleEnd()}
    >
      <div 
        style={styles.handleContainer}
        onClick={() => {
            onToggle(!externalIsExpanded);
            hapticFeedback('light');
        }}
      >
        <div style={styles.handleBar} />
      </div>

      <div style={styles.nameSection}>
        <h2 style={styles.name}>
          {profile.name}, <span style={styles.age}>{profile.age}</span>
        </h2>
        <div style={styles.universityRow}>
          🎓 {profile.university}
          {profile.institute && ` • ${profile.institute}`}
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, width: '100%', overflow: 'hidden' }}>
          
        <div ref={collapsedRef} style={styles.collapsedLayer}>
            <CollapsedContent profile={profile} commonInterests={commonInterests} />
        </div>

        <div ref={expandedRef} style={styles.expandedLayer}>
            <ExpandedContent profile={profile} commonInterests={commonInterests} />
        </div>
      </div>
    </div>
  );
}

// ===== STYLES =====

const styles = {
  container: {
    position: 'fixed',
    bottom: 0, left: 0, right: 0,
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: '#121212',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    borderRadius: '24px 24px 0 0',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', 
    zIndex: 100,
    paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
    display: 'flex',
    flexDirection: 'column',
    touchAction: 'none',
    cursor: 'grab',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    perspective: 1000,
  },
  handleContainer: {
    width: '100%', height: 24,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    paddingTop: 8, cursor: 'grab', marginBottom: 4,
  },
  handleBar: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border, margin: '0 auto',
  },
  nameSection: {
    padding: `0 ${theme.spacing.xl}px ${theme.spacing.sm}px`,
    flexShrink: 0,
  },
  name: {
    margin: 0, fontSize: '26px', fontWeight: 700, 
    color: theme.colors.text, lineHeight: 1.2, letterSpacing: '-0.5px', 
  },
  age: {
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textSecondary, fontSize: '24px', 
  },
  universityRow: {
    marginTop: 6, fontSize: theme.fontSize.md, 
    color: theme.colors.textSecondary, lineHeight: 1.4,
    fontWeight: theme.fontWeight.medium, 
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  // --- Layers ---
  collapsedLayer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    padding: `0 ${theme.spacing.xl}px`,
  },
  expandedLayer: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    padding: `0 ${theme.spacing.xl}px 20px`,
    overflowY: 'auto', opacity: 0, pointerEvents: 'none',
    touchAction: 'pan-y', WebkitOverflowScrolling: 'touch',
  },

  // --- Collapsed ---
  goalsRowCollapsed: { display: 'flex', gap: 8, marginBottom: 12 },
  goalChip: {
    padding: '6px 12px',
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.full,
    fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c',
    whiteSpace: 'nowrap', fontWeight: theme.fontWeight.medium,
  },
  interestsEmojiRow: { display: 'flex', gap: 12, alignItems: 'center' },
  emojiOnly: { fontSize: 24, transition: 'transform 0.3s ease' },
  emojiCommon: {
    // Золотое свечение для общих интересов
    filter: 'drop-shadow(0 0 6px rgba(255, 215, 0, 0.6))',
    transform: 'scale(1.15)',
  },
  moreText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium,
  },

  // --- Expanded ---
  promptCard: {
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.lg, padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg, marginTop: 8,
  },
  promptQuestion: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c',
    marginBottom: 8, fontWeight: theme.fontWeight.bold, opacity: 0.9,
  },
  promptAnswer: {
    fontSize: theme.fontSize.md, color: theme.colors.text,
    lineHeight: 1.5, whiteSpace: 'pre-wrap',
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm, color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold, textTransform: 'uppercase',
    letterSpacing: '0.5px', marginBottom: 10, marginTop: theme.spacing.lg,
  },
  goalsGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  goalTag: {
    padding: '8px 14px',
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.full, fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c', fontWeight: theme.fontWeight.medium,
  },
  bio: {
    margin: 0, fontSize: theme.fontSize.md, color: theme.colors.text,
    lineHeight: 1.6, whiteSpace: 'pre-wrap',
  },
  interestsGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  interestTag: {
    padding: '8px 14px', background: theme.colors.card,
    border: `1px solid ${theme.colors.borderLight}`,
    borderRadius: theme.radius.full, fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary, fontWeight: theme.fontWeight.regular,
    transition: 'all 0.3s ease',
  },
  // Золотая подсветка для общих интересов
  interestTagCommon: {
    padding: '8px 14px',
    background: MATCH_REASON_CONFIG.commonInterestBg,
    border: `1px solid ${MATCH_REASON_CONFIG.commonInterestBorder}`,
    borderRadius: theme.radius.full, fontSize: theme.fontSize.sm,
    color: MATCH_REASON_CONFIG.commonInterestText,
    fontWeight: theme.fontWeight.medium,
    transition: 'all 0.3s ease',
  },
};

export default ProfileInfoBar;