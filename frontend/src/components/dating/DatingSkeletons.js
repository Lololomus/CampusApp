// ===== FILE: src/components/dating/DatingSkeletons.js =====
import React from 'react';
import theme from '../../theme';

const d = theme.colors.dating;

// ============================================
// 1. СКЕЛЕТОН ДЛЯ КАРТОЧКИ В ЛЕНТЕ (фото + overlay)
// ============================================
export function FeedCardSkeleton() {
  return (
    <div style={styles.feedStack}>
      <div style={styles.feedCardBack}>
        <div style={styles.feedPhotoArea} className="skeleton-pulse" />
        <div style={styles.feedBottomGradient} />
      </div>

      <div style={styles.feedCard}>
        <div style={styles.feedPhotoArea} className="skeleton-pulse" />

        <div style={styles.feedIndicators}>
          <div style={styles.indicator} className="skeleton-pulse" />
          <div style={styles.indicator} className="skeleton-pulse" />
          <div style={styles.indicator} className="skeleton-pulse" />
        </div>

        <div style={styles.feedBottomGradient} />

        <div style={styles.feedOverlay}>
          <div style={styles.feedInfoLeft}>
            <div style={styles.feedNameBlock} className="skeleton-pulse" />
            <div style={styles.feedUniRow}>
              <div style={styles.feedUniIcon} className="skeleton-pulse" />
              <div style={styles.feedUniBlock} className="skeleton-pulse" />
            </div>
            <div style={styles.feedBadgesRow}>
              <div style={styles.feedBadgeWide} className="skeleton-pulse" />
              <div style={styles.feedBadge} className="skeleton-pulse" />
              <div style={styles.feedBadge} className="skeleton-pulse" />
            </div>
          </div>

          <div style={styles.feedExpandButton} className="skeleton-pulse" />
        </div>

        <div style={styles.feedActionButtons}>
          <div style={styles.feedActionButtonPrimary} className="skeleton-pulse" />
          <div style={styles.feedActionButtonSecondary} className="skeleton-pulse" />
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
  feedStack: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  feedCard: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: d.surface,
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  },
  feedCardBack: {
    position: 'absolute',
    top: 16,
    left: 8,
    right: 8,
    bottom: -4,
    backgroundColor: d.surface,
    borderRadius: 24,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    opacity: 0.42,
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
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    zIndex: 5,
  },
  feedInfoLeft: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  feedBottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '52%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.42) 48%, transparent 100%)',
  },
  feedNameBlock: {
    width: '62%',
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  feedUniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  feedUniIcon: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
  },
  feedUniBlock: {
    width: '58%',
    height: 15,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  feedBadgesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  feedBadgeWide: {
    width: 118,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  feedBadge: {
    width: 84,
    height: 30,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  feedExpandButton: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexShrink: 0,
  },
  feedActionButtons: {
    position: 'absolute',
    top: '50%',
    right: 16,
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 6,
  },
  feedActionButtonPrimary: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  feedActionButtonSecondary: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 4,
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
