// ===== FILE: src/components/dating/DatingSkeletons.js =====
import React from 'react';
import theme from '../../theme';

const d = theme.colors.dating;

// ============================================
// 1. СКЕЛЕТОН ДЛЯ КАРТОЧКИ В ЛЕНТЕ (фото + overlay)
// ============================================
export function FeedCardSkeleton() {
  return (
    <div style={styles.feedCard}>
      <div style={styles.feedPhotoArea} className="skeleton-pulse" />

      {/* Photo indicators */}
      <div style={styles.feedIndicators}>
        <div style={styles.indicator} className="skeleton-pulse" />
        <div style={styles.indicator} className="skeleton-pulse" />
        <div style={styles.indicator} className="skeleton-pulse" />
      </div>

      {/* Info overlay at bottom */}
      <div style={styles.feedOverlay}>
        <div style={styles.feedNameBlock} className="skeleton-pulse" />
        <div style={styles.feedUniBlock} className="skeleton-pulse" />
        <div style={styles.feedBadgesRow}>
          <div style={styles.feedBadge} className="skeleton-pulse" />
          <div style={styles.feedBadge} className="skeleton-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// 2. СКЕЛЕТОН ДЛЯ ВЗАИМНОСТЕЙ (вертикальная карточка 165x260)
// ============================================
export function MatchCardSkeleton() {
  return (
    <div style={styles.matchCard}>
      {/* Photo */}
      <div style={styles.matchPhoto} className="skeleton-pulse" />

      {/* Info */}
      <div style={styles.matchInfo}>
        <div style={styles.matchName} className="skeleton-pulse" />
        <div style={styles.matchUni} className="skeleton-pulse" />
        <div style={styles.matchGoals}>
          <div style={styles.matchGoalPill} className="skeleton-pulse" />
          <div style={styles.matchGoalPill} className="skeleton-pulse" />
        </div>
        <div style={styles.matchInterests}>
          <div style={styles.matchInterestBadge} className="skeleton-pulse" />
          <div style={styles.matchInterestBadge} className="skeleton-pulse" />
          <div style={styles.matchInterestBadge} className="skeleton-pulse" />
        </div>
        <div style={styles.matchButton} className="skeleton-pulse" />
      </div>
    </div>
  );
}

// ============================================
// 3. СКЕЛЕТОН ДЛЯ "КТО ЛАЙКНУЛ" (фото 4:5 + emoji panel)
// ============================================
export function LikesCardSkeleton() {
  return (
    <div style={styles.likesCard}>
      {/* Photo 4:5 */}
      <div style={styles.likesPhoto} className="skeleton-pulse" />

      {/* Info panel below photo */}
      <div style={styles.likesInfoPanel}>
        <div style={styles.likesGoalsRow}>
          <div style={styles.likesGoalPill} className="skeleton-pulse" />
          <div style={styles.likesGoalPill} className="skeleton-pulse" />
        </div>
        <div style={styles.likesInterestsRow}>
          <div style={styles.likesInterestBadge} className="skeleton-pulse" />
          <div style={styles.likesInterestBadge} className="skeleton-pulse" />
          <div style={styles.likesInterestBadge} className="skeleton-pulse" />
          <div style={styles.likesInterestBadge} className="skeleton-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// STYLES
// ============================================
const styles = {
  // === Feed Card ===
  feedCard: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: d.surface,
    borderRadius: 24,
    overflow: 'hidden',
  },
  feedPhotoArea: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${d.cardBg} 0%, ${d.surface} 100%)`,
  },
  feedIndicators: {
    position: 'absolute',
    top: 10, left: 10, right: 10,
    display: 'flex',
    gap: 4,
    zIndex: 10,
  },
  indicator: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  feedOverlay: {
    position: 'absolute',
    bottom: 20, left: 20, right: 70,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    zIndex: 5,
  },
  feedNameBlock: {
    width: '70%',
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  feedUniBlock: {
    width: '50%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  feedBadgesRow: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  feedBadge: {
    width: 80,
    height: 28,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  // === Match Card (vertical 165x260) ===
  matchCard: {
    width: 165,
    minHeight: 260,
    borderRadius: 24,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: d.cardBg,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
  },
  matchPhoto: {
    width: '100%',
    height: 130,
    flexShrink: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  matchInfo: {
    flex: 1,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  matchName: {
    width: '80%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  matchUni: {
    width: '60%',
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  matchGoals: {
    display: 'flex',
    gap: 6,
    marginTop: 4,
  },
  matchGoalPill: {
    width: 36,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  matchInterests: {
    display: 'flex',
    gap: 4,
  },
  matchInterestBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  matchButton: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    marginTop: 'auto',
  },

  // === Likes Card (photo 4:5 + info below) ===
  likesCard: {
    backgroundColor: d.cardBg,
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  likesPhoto: {
    width: '100%',
    aspectRatio: '4 / 5',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  likesInfoPanel: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  likesGoalsRow: {
    display: 'flex',
    gap: 6,
  },
  likesGoalPill: {
    width: 36,
    height: 28,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  likesInterestsRow: {
    display: 'flex',
    gap: 4,
  },
  likesInterestBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
};

// Inject pulse animation
if (typeof document !== 'undefined' && !document.getElementById('dating-skeletons-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'dating-skeletons-styles';
  styleSheet.textContent = `
    .skeleton-pulse {
      animation: skeleton-pulse 1.5s ease-in-out infinite;
    }
    @keyframes skeleton-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(styleSheet);
}
