// ===== 📄 ФАЙЛ: frontend/src/components/dating/DatingSkeletons.js =====
import React from 'react';
import theme from '../../theme';

// ============================================
// 1️⃣ СКЕЛЕТОН ДЛЯ КАРТОЧКИ В ЛЕНТЕ (только фото)
// ============================================
export function FeedCardSkeleton() {
  return (
    <div style={styles.feedCard}>
      {/* Photo area (full card) */}
      <div style={styles.feedPhotoArea} className="skeleton-pulse" />

      {/* Photo indicators */}
      <div style={styles.feedIndicators}>
        <div style={styles.indicator} className="skeleton-pulse" />
        <div style={styles.indicator} className="skeleton-pulse" />
        <div style={styles.indicator} className="skeleton-pulse" />
      </div>
    </div>
  );
}

// ============================================
// 1️⃣-B СКЕЛЕТОН ДЛЯ INFOBAR (шторка снизу)
// ============================================
export function FeedInfoBarSkeleton() {
  return (
    <>
      {/* Expand button */}
      <div style={styles.feedExpandButton} className="skeleton-pulse" />

      {/* Content */}
      <div style={styles.feedInfoContent}>
        {/* Name section */}
        <div style={styles.feedNameSection}>
          <div style={styles.feedNameBlock} className="skeleton-pulse" />
          <div style={styles.feedUniversityBlock} className="skeleton-pulse" />
        </div>

        {/* Goals chips */}
        <div style={styles.feedGoalsRow}>
          <div style={styles.feedGoalChip} className="skeleton-pulse" />
          <div style={styles.feedGoalChip} className="skeleton-pulse" />
        </div>

        {/* Interests emoji */}
        <div style={styles.feedInterestsRow}>
          <div style={styles.feedEmojiCircle} className="skeleton-pulse" />
          <div style={styles.feedEmojiCircle} className="skeleton-pulse" />
          <div style={styles.feedEmojiCircle} className="skeleton-pulse" />
          <div style={styles.feedEmojiCircle} className="skeleton-pulse" />
          <div style={styles.feedEmojiCircle} className="skeleton-pulse" />
        </div>
      </div>
    </>
  );
}

// ============================================
// 2️⃣ СКЕЛЕТОН ДЛЯ ВЗАИМНОСТЕЙ (MatchCard)
// ============================================
export function MatchCardSkeleton() {
  return (
    <div style={styles.matchCard}>
      {/* LEFT: Photo */}
      <div style={styles.matchPhoto} className="skeleton-pulse" />

      {/* RIGHT: Info */}
      <div style={styles.matchInfo}>
        {/* Name + Timer (в одну строку) */}
        <div style={styles.matchTopRow}>
          <div style={styles.matchName} className="skeleton-pulse" />
          <div style={styles.matchTimer} className="skeleton-pulse" />
        </div>

        {/* University */}
        <div style={styles.matchUniversity} className="skeleton-pulse" />

        {/* Interests */}
        <div style={styles.matchInterests}>
          <div style={styles.interestIcon} className="skeleton-pulse" />
          <div style={styles.interestIcon} className="skeleton-pulse" />
          <div style={styles.interestIcon} className="skeleton-pulse" />
          <div style={styles.interestIcon} className="skeleton-pulse" />
        </div>

        {/* Button (full-width) */}
        <div style={styles.matchButton} className="skeleton-pulse" />
      </div>
    </div>
  );
}

// ============================================
// 3️⃣ СКЕЛЕТОН ДЛЯ "КТО ЛАЙКНУЛ" (LikesTab grid)
// ============================================
export function LikesCardSkeleton() {
  return (
    <div style={styles.likesCard}>
      {/* Photo */}
      <div style={styles.likesPhoto} className="skeleton-pulse">
        <div style={styles.likesAvatarCircle} />
      </div>

      {/* Overlay gradient */}
      <div style={styles.likesOverlay} />

      {/* Bottom info */}
      <div style={styles.likesInfo}>
        <div style={styles.likesName} className="skeleton-pulse" />
        <div style={styles.likesBio} className="skeleton-pulse" />
        <div style={styles.likesTags}>
          <div style={styles.likesTag} className="skeleton-pulse" />
          <div style={styles.likesTag} className="skeleton-pulse" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// STYLES
// ============================================
const styles = {
  // ===== 1️⃣ FEED CARD (ПОЛНОЭКРАННАЯ КАРТОЧКА) =====
  feedCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
  },

  feedPhotoArea: {
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`,
  },

  feedIndicators: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
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

  // ===== 1️⃣-B INFOBAR SKELETON (шторка снизу) =====
  feedExpandButton: {
    width: 40,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    margin: '0 auto 16px',
  },

  feedInfoContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  feedNameSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  feedNameBlock: {
    width: '65%',
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  feedUniversityBlock: {
    width: '80%',
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  feedGoalsRow: {
    display: 'flex',
    gap: 8,
  },

  feedGoalChip: {
    width: 100,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  feedInterestsRow: {
    display: 'flex',
    gap: 10,
  },

  feedEmojiCircle: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  // ===== 2️⃣ MATCH CARD =====
  matchCard: {
    display: 'flex',
    alignItems: 'stretch',
    gap: 12,
    padding: 12,
    borderRadius: 20,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
  },

  matchPhoto: {
    width: 90,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
  },

  matchInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },

  matchTopRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  matchName: {
    flex: 1,
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  matchTimer: {
    width: 50,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    flexShrink: 0,
  },

  matchUniversity: {
    width: '85%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  matchInterests: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },

  interestIcon: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },

  matchButton: {
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 147, 251, 0.15)',
    marginTop: 4,
  },

  // ===== 3️⃣ LIKES CARD =====
  likesCard: {
    position: 'relative',
    aspectRatio: '3 / 4.2',
    borderRadius: 20,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
  },

  likesPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  likesAvatarCircle: {
    width: 60,
    height: 60,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },

  likesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.15) 75%, transparent 100%)',
  },

  likesInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },

  likesName: {
    width: '70%',
    height: 20,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  likesBio: {
    width: '90%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  likesTags: {
    display: 'flex',
    gap: 5,
  },

  likesTag: {
    width: 50,
    height: 24,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
};

// ============================================
// CSS ANIMATIONS
// ============================================
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  .skeleton-pulse {
    animation: skeleton-pulse 1.5s ease-in-out infinite;
  }

  @keyframes skeleton-pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
`;

if (!document.getElementById('dating-skeletons-styles')) {
  styleSheet.id = 'dating-skeletons-styles';
  document.head.appendChild(styleSheet);
}