// ===== 📄 ФАЙЛ: frontend/src/components/profile/ProfileInfoBar.js =====
import React, { useRef, useState, useEffect, memo } from 'react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';

// ===== CONSTANTS =====
const EXPANDED_HEIGHT = '85vh'; // Используем % высоты
const MAX_HEIGHT_PX = 580; // Ограничитель для планшетов
const COLLAPSED_HEIGHT = 245; // Высота шторки в закрытом виде

const GOAL_ICONS = {
  relationship: '💘 Отношения',
  friends: '🤝 Дружба',
  study: '📚 Учеба',
  hangout: '🎉 Тусовки'
};

const INTEREST_LABELS = {
  it: '💻 IT',
  games: '🎮 Игры',
  books: '📚 Книги',
  music: '🎵 Музыка',
  movies: '🎬 Кино',
  sport: '⚽ Спорт',
  art: '🎨 Творчество',
  travel: '🌍 Путешествия',
  coffee: '☕ Кофе',
  party: '🎉 Вечеринки',
  photo: '📸 Фото',
  food: '🍕 Еда',
  science: '🎓 Наука',
  startup: '🚀 Стартапы',
  fitness: '🏋️ Фитнес',
};

const INTEREST_EMOJIS = {
  it: '💻', games: '🎮', books: '📚', music: '🎵', movies: '🎬',
  sport: '⚽', art: '🎨', travel: '🌍', coffee: '☕', party: '🎉',
  photo: '📸', food: '🍕', science: '🎓', startup: '🚀', fitness: '🏋️',
};

// ===== MEMOIZED COMPONENTS =====

const CollapsedContent = memo(({ profile }) => {
  return (
    <>
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
          {profile.interests.slice(0, 5).map((interest, i) => (
            <span key={i} style={styles.emojiOnly}>
              {INTEREST_EMOJIS[interest] || '❓'}
            </span>
          ))}
          {profile.interests.length > 5 && (
            <span style={styles.moreText}>+{profile.interests.length - 5}</span>
          )}
        </div>
      )}
    </>
  );
});

const ExpandedContent = memo(({ profile }) => {
  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Prompts / Icebreaker (Dating Accent) */}
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

      {/* Goals (Dating Accent) */}
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

      {/* Interests (Subtle Highlight) */}
      {profile.interests?.length > 0 && (
        <>
          <div style={styles.sectionTitle}>Интересы</div>
          <div style={styles.interestsGrid}>
            {profile.interests.map((interest) => (
              <span key={interest} style={styles.interestTag}>
                {INTEREST_LABELS[interest] || interest}
              </span>
            ))}
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
  
  // Logic State
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const translateRange = useRef(300); // Default, пересчитывается
  const currentTranslate = useRef(300);

  // Recalculate range on mount/resize
  useEffect(() => {
    const updateDimensions = () => {
      const vh = window.innerHeight;
      const expandedH = Math.min(vh * 0.85, MAX_HEIGHT_PX);
      // Округляем до целых пикселей, чтобы избежать субпиксельного мыла
      const range = Math.round(expandedH - COLLAPSED_HEIGHT);
      translateRange.current = range;
      
      // Update position immediately
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

  // Sync with external state
  useEffect(() => {
    const targetY = externalIsExpanded ? 0 : translateRange.current;
    animateTo(targetY);
    currentTranslate.current = targetY;
  }, [externalIsExpanded]);

  if (!profile) return null;

  // --- PHYSICS ENGINE ---

  const applyStyles = (translateY) => {
    if (!containerRef.current) return;

    // Округляем translateY для четкости
    const roundedY = Math.round(translateY);
    containerRef.current.style.transform = `translate3d(0, ${roundedY}px, 0)`;

    const range = translateRange.current || 1;
    const progress = translateY / range;
    const safeProgress = Math.max(0, Math.min(1, progress)); // 0 = Open, 1 = Closed

    // Collapsed Content
    if (collapsedRef.current) {
        const opacity = (safeProgress - 0.5) * 2; 
        collapsedRef.current.style.opacity = Math.max(0, Math.min(1, opacity));
        
        const yShift = Math.round((1 - safeProgress) * -10);
        collapsedRef.current.style.transform = `translate3d(0, ${yShift}px, 0)`;
        collapsedRef.current.style.pointerEvents = safeProgress > 0.9 ? 'auto' : 'none';
    }

    // Expanded Content
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
    
    // Используем cubic-bezier как в SwipeableModal
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
    
    if (externalIsExpanded && delta < 0 && expandedRef.current?.scrollTop >= 0) {
        return; 
    }

    if (externalIsExpanded && delta > 0 && expandedRef.current?.scrollTop > 0) {
        return;
    }

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
            <CollapsedContent profile={profile} />
        </div>

        <div
            ref={expandedRef}
            style={styles.expandedLayer}
        >
            <ExpandedContent profile={profile} />
        </div>
      </div>
    </div>
  );
}

// ===== STYLES =====

const styles = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxWidth: '600px',
    margin: '0 auto',
    
    // ✅ ИСПРАВЛЕНИЕ МЫЛА:
    // 1. Сплошной цвет фона (как в SwipeableModal)
    backgroundColor: '#121212', // theme.colors.bg жестко задаем для теста
    // 2. Убираем backdrop-filter (ГЛАВНАЯ ПРИЧИНА МЫЛА ПРИ ДВИЖЕНИИ)
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    
    borderRadius: '24px 24px 0 0',
    // Тень берем пожестче, раз нет блюра
    boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', 
    
    zIndex: 100,
    paddingBottom: 'max(env(safe-area-inset-bottom), 16px)',
    display: 'flex',
    flexDirection: 'column',
    // ❌ Убрали willChange, так как он вызывает мыло на статичном слое
    touchAction: 'none',
    cursor: 'grab',

    // ✅ ANTI-ALIASING PROPS (Идентично SwipeableModal)
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    perspective: 1000,
    // ❌ Убрали transformStyle: 'preserve-3d', так как его нет в SwipeableModal
  },
  
  handleContainer: {
    width: '100%',
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    cursor: 'grab',
    marginBottom: 4,
  },
  handleBar: {
    width: 40, // Чуть шире, как в SwipeableModal
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border, // Используем border color для ручки
    margin: '0 auto',
  },

  nameSection: {
    padding: `0 ${theme.spacing.xl}px ${theme.spacing.sm}px`,
    flexShrink: 0,
  },
  name: {
    margin: 0,
    fontSize: '26px', 
    fontWeight: 700, 
    color: theme.colors.text,
    lineHeight: 1.2,
    letterSpacing: '-0.5px', 
  },
  age: {
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.textSecondary,
    fontSize: '24px', 
  },
  universityRow: {
    marginTop: 6, 
    fontSize: theme.fontSize.md, 
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
    fontWeight: theme.fontWeight.medium, 
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  collapsedLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: `0 ${theme.spacing.xl}px`,
  },
  expandedLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: `0 ${theme.spacing.xl}px 20px`,
    overflowY: 'auto',
    opacity: 0,
    pointerEvents: 'none',
    touchAction: 'pan-y',
    WebkitOverflowScrolling: 'touch',
  },
  
  goalsRowCollapsed: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  goalChip: {
    padding: '6px 12px',
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.full,
    fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c',
    whiteSpace: 'nowrap',
    fontWeight: theme.fontWeight.medium,
  },
  interestsEmojiRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  emojiOnly: {
    fontSize: 24,
  },
  moreText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  
  promptCard: {
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    marginTop: 8,
  },
  promptQuestion: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c',
    marginBottom: 8,
    fontWeight: theme.fontWeight.bold,
    opacity: 0.9,
  },
  promptAnswer: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  sectionTitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 10,
    marginTop: theme.spacing.lg,
  },
  goalsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalTag: {
    padding: '8px 14px',
    background: theme.colors.dating.light || 'rgba(255, 59, 92, 0.1)',
    border: `1px solid ${(theme.colors.dating.primary || '#ff3b5c')}40`,
    borderRadius: theme.radius.full,
    fontSize: theme.fontSize.sm,
    color: theme.colors.dating.primary || '#ff3b5c',
    fontWeight: theme.fontWeight.medium,
  },
  bio: {
    margin: 0,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },
  interestsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    padding: '8px 14px',
    background: theme.colors.card,
    border: `1px solid ${theme.colors.borderLight}`,
    borderRadius: theme.radius.full,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.regular,
  },
};

export default ProfileInfoBar;