// ===== FILE: src/components/dating/LikesTab.js =====
import React, { useEffect, useRef, useState } from 'react';
import { Heart, Sparkles, GraduationCap } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import MatchCard from './MatchCard';
import { MatchCardSkeleton, LikesCardSkeleton } from './DatingSkeletons';
import { INTEREST_EMOJIS, GOAL_EMOJIS } from '../../constants/datingConstants';

const d = theme.colors.dating;

function LikesTab({
  matches = [],
  users = [],
  loading = false,
  matchesLoading = false,
  onViewProfile,
  onMessage,
  onEmptyAction,
  onQuickLike,
  quickLikeIds = [],
}) {
  const [quickLikeFx, setQuickLikeFx] = useState({});
  const quickLikeTimeoutsRef = useRef({});

  useEffect(() => {
    return () => {
      Object.values(quickLikeTimeoutsRef.current).forEach((timeoutIds) => {
        (Array.isArray(timeoutIds) ? timeoutIds : [timeoutIds]).forEach((timeoutId) => {
          window.clearTimeout(timeoutId);
        });
      });
    };
  }, []);

  const startQuickLikeFx = (user) => {
    const userId = user?.id;
    if (!userId) return;

    const existing = quickLikeTimeoutsRef.current[userId] || [];
    existing.forEach((timeoutId) => window.clearTimeout(timeoutId));

    setQuickLikeFx((prev) => ({ ...prev, [userId]: 'arming' }));

    const triggerTimeout = window.setTimeout(() => {
      setQuickLikeFx((prev) => ({ ...prev, [userId]: 'burst' }));
      onQuickLike?.(user);
    }, 130);

    const cleanupTimeout = window.setTimeout(() => {
      setQuickLikeFx((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
      delete quickLikeTimeoutsRef.current[userId];
    }, 900);

    quickLikeTimeoutsRef.current[userId] = [triggerTimeout, cleanupTimeout];
  };

  // ===== LOADING STATE =====
  if (loading || matchesLoading) {
    return (
      <div style={styles.containerScroll}>
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.iconCirclePink}>
              <Sparkles size={16} color={d.pink} />
            </div>
            <h2 style={styles.sectionTitle}>Взаимность</h2>
          </div>
          <div style={styles.matchesCarousel}>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        </div>

        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.iconCircleGray}>
              <Heart size={16} color={d.textMuted} />
            </div>
            <div>
              <h2 style={styles.sectionTitle}>Кто лайкнул</h2>
              <span style={styles.sectionSubtitle}>Узнай, кому ты понравился</span>
            </div>
          </div>
          <div style={styles.grid}>
            <LikesCardSkeleton />
            <LikesCardSkeleton />
            <LikesCardSkeleton />
            <LikesCardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  // ===== EMPTY STATE =====
  if ((!users || users.length === 0) && (!matches || matches.length === 0)) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyCircle}>
          <Sparkles size={48} color={d.pink} strokeWidth={1.5} />
        </div>

        <h3 style={styles.emptyTitle}>Пока нет взаимностей</h3>

        <div style={styles.emptySteps}>
          <div style={styles.emptyStep}>
            <span style={styles.stepNumber}>1</span>
            <span style={styles.stepText}>Листай анкеты в ленте</span>
          </div>
          <div style={styles.emptyStep}>
            <span style={styles.stepNumber}>2</span>
            <span style={styles.stepText}>Лайкай тех, кто нравится</span>
          </div>
          <div style={styles.emptyStep}>
            <span style={styles.stepNumber}>3</span>
            <span style={styles.stepText}>Взаимные симпатии появятся тут!</span>
          </div>
        </div>

        {onEmptyAction && (
          <button
            style={styles.emptyButton}
            onClick={() => { hapticFeedback('medium'); onEmptyAction(); }}
          >
            <Heart size={20} fill="#fff" strokeWidth={0} />
            <span>Смотреть анкеты</span>
          </button>
        )}
      </div>
    );
  }

  // ===== MAIN CONTENT =====
  return (
    <div style={styles.containerScroll}>
      {/* Взаимность — горизонтальная карусель */}
      {matches && matches.length > 0 && (
        <div style={styles.sectionNoSidePadding}>
          <div style={{ ...styles.sectionHeader, padding: '0 16px' }}>
            <div style={styles.iconCirclePink}>
              <Sparkles size={16} color={d.pink} />
            </div>
            <h2 style={styles.sectionTitle}>
              Взаимность <span style={styles.countMuted}>{matches.length}</span>
            </h2>
          </div>

          <div style={styles.matchesCarousel}>
            {matches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onClick={() => {
                  hapticFeedback('light');
                  onViewProfile(match, 'match');
                }}
                onMessage={() => {
                  hapticFeedback('medium');
                  onMessage(match);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Кто лайкнул — emoji grid */}
      {users && users.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <div style={styles.iconCircleGray}>
              <Heart size={16} color={d.textMuted} />
            </div>
            <div>
              <h2 style={styles.sectionTitle}>
                Кто лайкнул <span style={styles.countMuted}>{users.length}</span>
              </h2>
              <span style={styles.sectionSubtitle}>Узнай, кому ты понравился</span>
            </div>
          </div>

          <div style={styles.grid}>
            {users.map((user, idx) => {
              const photo = user?.photos?.[0]?.url || user?.photos?.[0] || null;
              const commonInterests = user?.common_interests || [];
              const commonGoals = user?.common_goals || [];
              const isQuickLiking = quickLikeIds.includes(user.id);
              const quickLikeStage = quickLikeFx[user.id] || 'idle';
              const isQuickLikeActive = isQuickLiking || quickLikeStage !== 'idle';

              return (
                <div
                  key={user.id}
                  style={{ ...styles.card, animationDelay: `${idx * 0.05}s` }}
                  onClick={() => {
                    hapticFeedback('light');
                    if (onViewProfile) onViewProfile(user, 'like');
                  }}
                >
                  {/* Фото 4:5 */}
                  <div style={styles.photoWrapper}>
                    {photo ? (
                      <img src={photo} alt={user.name} style={styles.cardImage} draggable={false} />
                    ) : (
                      <div style={styles.cardPlaceholder}>
                        {user.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div style={styles.photoGradient} />

                    {/* Heart badge top-right */}
                    <button
                      type="button"
                      aria-label="Быстрый лайк"
                      disabled={isQuickLiking}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!onQuickLike || isQuickLiking) return;
                        startQuickLikeFx(user);
                      }}
                      style={{
                        ...styles.heartBadge,
                        backgroundColor: isQuickLikeActive ? d.pink : 'rgba(255, 255, 255, 0.96)',
                        color: isQuickLikeActive ? '#fff' : d.pink,
                        boxShadow: isQuickLikeActive
                          ? '0 6px 18px rgba(255, 45, 85, 0.42)'
                          : '0 8px 18px rgba(0, 0, 0, 0.2)',
                        border: isQuickLikeActive
                          ? 'none'
                          : '1px solid rgba(255, 45, 85, 0.18)',
                        animation: quickLikeStage === 'burst' ? 'quickLikePop 0.42s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
                        opacity: isQuickLiking ? 0.65 : 1,
                        cursor: isQuickLiking ? 'default' : 'pointer',
                      }}
                    >
                      <Heart
                        size={18}
                        fill={isQuickLikeActive ? '#fff' : 'none'}
                        color={isQuickLikeActive ? '#fff' : d.pink}
                        strokeWidth={2.5}
                        style={{
                          transform: quickLikeStage === 'burst' ? 'scale(1.08)' : 'scale(1)',
                          transition: 'transform 0.18s ease, color 0.18s ease, fill 0.18s ease',
                        }}
                      />
                    </button>

                    {/* Имя + вуз overlaid на фото (bottom) */}
                    <div style={styles.photoInfo}>
                      <div style={styles.cardName}>
                        {user.name}, {user.age}
                      </div>
                      <div style={styles.cardUni}>
                        <GraduationCap size={12} />
                        {user.institute || user.university}
                      </div>
                    </div>
                  </div>

                  {/* Инфографика под фото */}
                  <div style={styles.infoPanel}>
                    {/* Цели: emoji-only pills */}
                    {user.goals?.length > 0 && (
                      <div style={styles.goalsRow}>
                        {user.goals.map(goal => {
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
                    {user.interests?.length > 0 && (
                      <div style={styles.interestsRow}>
                        {user.interests.slice(0, 5).map(interest => {
                          const isCommon = commonInterests.includes(interest);
                          return (
                            <div key={interest} style={isCommon ? styles.interestCommon : styles.interestBadge}>
                              {INTEREST_EMOJIS[interest] || '⭐'}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== STYLES =====
const styles = {
  containerScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 40,
    padding: '0 16px',
  },
  sectionNoSidePadding: {
    marginBottom: 40,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  iconCirclePink: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGray: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    backgroundColor: d.surface,
    border: '1px solid rgba(255, 255, 255, 0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    lineHeight: 1.2,
  },
  countMuted: {
    color: d.textMuted,
    fontWeight: 600,
    fontSize: 16,
    marginLeft: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: d.textMuted,
    fontWeight: 500,
    marginTop: 2,
    display: 'block',
  },

  // Карусель матчей
  matchesCarousel: {
    display: 'flex',
    overflowX: 'auto',
    gap: 16,
    padding: '0 16px 8px',
    alignItems: 'stretch',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },

  // Сетка "Кто лайкнул"
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  card: {
    backgroundColor: d.cardBg,
    borderRadius: 20,
    overflow: 'hidden',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeInUp 0.4s ease forwards',
    opacity: 0,
  },
  photoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 5',
    backgroundColor: '#000',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 48,
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
  heartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    transition: 'background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  },
  photoInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  cardUni: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    fontWeight: 500,
    color: d.textLight,
    marginTop: 2,
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Инфографика под фото
  infoPanel: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    flex: 1,
  },
  goalsRow: {
    display: 'flex',
    gap: 6,
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
    marginTop: 'auto',
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

  // Empty state
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '60px 24px 100px',
    minHeight: '60vh',
  },
  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 45, 85, 0.1)',
    border: '3px solid rgba(255, 45, 85, 0.2)',
    marginBottom: 24,
    animation: 'float 3s ease-in-out infinite',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#fff',
    margin: '0 0 12px 0',
  },
  emptySteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    maxWidth: 280,
    marginBottom: 24,
  },
  emptyStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    textAlign: 'left',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 800,
    backgroundColor: d.pink,
    color: '#fff',
    flexShrink: 0,
  },
  stepText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    lineHeight: 1.4,
  },
  emptyButton: {
    padding: '14px 24px',
    borderRadius: 16,
    border: 'none',
    backgroundColor: d.pink,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(255, 45, 85, 0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
};

// Inject keyframes
if (typeof document !== 'undefined' && !document.getElementById('likes-tab-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'likes-tab-styles';
  styleSheet.textContent = `
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes quickLikePop {
      0% { transform: scale(1); }
      38% { transform: scale(1.16); }
      68% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    .hide-scroll::-webkit-scrollbar { display: none; }
  `;
  document.head.appendChild(styleSheet);
}

export default LikesTab;
