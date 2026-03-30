// ===== 📄 ФАЙЛ: src/components/dating/DatingFeed.js =====

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate as animateValue } from 'framer-motion';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, dislikeUser, getDatingStats, getWhoLikedMe, getMyDatingProfile, getMyMatches } from '../../api';
import AppHeader from '../shared/AppHeader';
import ProfileCard from './ProfileCard';
import MatchModal from './MatchModal';
import { FeedCardSkeleton } from './DatingSkeletons';
import DatingOnboarding from './DatingOnboarding';
import MyDatingProfileModal from './MyDatingProfileModal';
import LikesTab from './LikesTab';
import ViewingProfileModal from './ViewingProfileModal';
import ProfileSheet from './ProfileSheet';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { toast } from '../shared/Toast';
import { USE_MOCK_DATA, MOCK_PROFILES, MOCK_LIKES, MOCK_MATCHES } from './mockData';
import { SWIPE_THRESHOLD } from '../../constants/layoutConstants';


function DatingFeed() {
  const {
    datingProfile,
    setDatingProfile,
    user,
    currentProfile,
    profilesQueue,
    setCurrentProfile,
    addProfilesToQueue,
    removeCurrentProfile,
    likesCount,
    updateDatingStats,
    showMatchModal,
    setShowMatchModal,
    whoLikedMe,
    setWhoLikedMe,
    setIsLoadingProfiles,
    hasMoreProfiles,
    setHasMoreProfiles,
    setOnPrefetchNeeded,
  } = useStore();

  const [checkingProfile, setCheckingProfile] = useState(!datingProfile);
  const isGuestMode = !datingProfile; 
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('profiles');
  const [loading, setLoading] = useState(true);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const motionX = useMotionValue(0);
  const isDraggingRef = useRef(false);
  const cardRotation = useTransform(motionX, [-500, 0, 500], [-25, 0, 25]);
  const likeOverlayOpacity = useTransform(motionX, [0, 50, 200], [0, 0, 0.8]);
  const nopeOverlayOpacity = useTransform(motionX, [-200, -50, 0], [0.8, 0, 0]);
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  useEffect(() => {
    document.body.classList.add('dating-active');
    document.getElementById('root')?.classList.add('dating-active');
    return () => {
      document.body.classList.remove('dating-active');
      document.getElementById('root')?.classList.remove('dating-active');
    };
  }, []);

  const isLoadingRef = useRef(false);
  const offset = useRef(0);
  const swipeThreshold = SWIPE_THRESHOLD;

  useEffect(() => {
    if (currentProfile?.id) setShowProfileSheet(false);
  }, [currentProfile?.id]);

  // === Check registration ===
  useEffect(() => {
    const checkRegistration = async () => {
      setCheckingProfile(true);
      try {
        if (USE_MOCK_DATA) { setCheckingProfile(false); return; }
        const profile = await getMyDatingProfile();
        setDatingProfile(profile || null);
      } catch (e) {
        setDatingProfile(null);
      } finally {
        setCheckingProfile(false);
      }
    };
    checkRegistration();
  }, []);

  // === Initial load ===
  useEffect(() => {
    if (checkingProfile) return;
    if (!currentProfile && hasMoreProfiles) {
      loadProfiles(true);
    } else {
      setLoading(false);
    }
    if (!isGuestMode) {
      if (USE_MOCK_DATA) updateDatingStats({ likes_count: MOCK_LIKES.length });
      else getDatingStats().then(updateDatingStats).catch(console.error);
    }
  }, [checkingProfile]);

  // === Load profiles ===
  const loadProfiles = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      if (reset) { setLoading(true); offset.current = 0; }
      else { setIsLoadingProfiles(true); }
      
      let profiles = [];
      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 600)); 
        profiles = reset ? MOCK_PROFILES : [];
      } else {
        profiles = await getDatingFeed(10, offset.current);
      }

      if (profiles.length === 0) {
        setHasMoreProfiles(false);
        if (reset) setCurrentProfile(null);
      } else {
        offset.current += profiles.length;
        if (reset || !useStore.getState().currentProfile) {
          setCurrentProfile(profiles[0]);
          if (profiles.length > 1) addProfilesToQueue(profiles.slice(1));
        } else {
          addProfilesToQueue(profiles);
        }
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false); 
      setIsLoadingProfiles(false);
      isLoadingRef.current = false;
    }
  }, [setCurrentProfile, addProfilesToQueue, setIsLoadingProfiles, setHasMoreProfiles]);

  // === Load likes ===
  const loadLikes = async () => {
    if (isGuestMode) return;
    setLoadingLikes(true);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 500));
        setWhoLikedMe(MOCK_LIKES);
      } else {
        const users = await getWhoLikedMe(20, 0);
        setWhoLikedMe(users);
      }
    } catch (error) { console.error(error); }
    finally { setLoadingLikes(false); }
  };

  // === Load matches ===
  const loadMatches = async () => {
    if (isGuestMode) return;
    setLoadingMatches(true);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 500));
        setMatches(MOCK_MATCHES);
      } else {
        const data = await getMyMatches();
        setMatches(data || []);
      }
    } catch (error) { console.error(error); }
    finally { setLoadingMatches(false); }
  };

  // === Prefetch ===
  useEffect(() => {
    if (!checkingProfile && !currentProfile && hasMoreProfiles) loadProfiles(true);
    if (!checkingProfile && !isGuestMode) {
      if (USE_MOCK_DATA) updateDatingStats({ likes_count: MOCK_LIKES.length });
      else getDatingStats().then(updateDatingStats).catch(console.error);
    }
  }, [checkingProfile]);

  useEffect(() => {
    setOnPrefetchNeeded(() => {
      loadProfiles(false);
    });
  }, [setOnPrefetchNeeded, loadProfiles]);

  useEffect(() => {
    if (activeTab === 'likes' && !isGuestMode) {
      loadLikes();
      loadMatches();
    }
  }, [activeTab, isGuestMode]);

  // === Handlers ===
  const triggerOnboarding = () => {
    hapticFeedback('medium');
    setShowOnboarding(true);
  };

  const handleTabSwitch = (tab) => {
    if (isGuestMode && tab === 'likes') { triggerOnboarding(); return; }
    if (activeTab !== tab) {
      hapticFeedback('medium');
      setActiveTab(tab);
      setViewingProfile(null);
    }
  };

  const handleSwipeStart = useCallback(() => { isDraggingRef.current = true; }, []);
  const handleSwipeMove = useCallback((delta) => { motionX.set(delta); }, [motionX]);

  const handleSwipeEnd = async (finalDelta = 0) => {
    isDraggingRef.current = false;
    const deltaToCheck = typeof finalDelta === 'number' ? finalDelta : motionX.get();
    if (Math.abs(deltaToCheck) > swipeThreshold) {
      if (deltaToCheck > 0) await handleLike();
      else await handleSkip();
    } else {
      motionX.set(0);
    }
  };

  const handleSkip = async () => {
    if (isAnimating || !currentProfile) return;
    hapticFeedback('light');
    setIsAnimating(true);
    // Анимируем карточку за экран, потом убираем
    await animateValue(motionX, -500, { duration: 0.1, ease: [0.4, 0, 1, 1] });
    if (!isGuestMode && currentProfile?.id) {
      dislikeUser(currentProfile.id).catch(console.error);
    }
    removeCurrentProfile();
    motionX.set(0);
    setIsAnimating(false);
    setShowProfileSheet(false);
  };

  const handleLike = async (profileId = null, fallbackUser = null) => {
    const targetId = profileId || currentProfile?.id;

    if (isGuestMode) {
      hapticFeedback('medium');
      triggerOnboarding();
      return { is_match: false };
    }

    if (!targetId || (isAnimating && !profileId)) return { is_match: false };
    hapticFeedback('medium');

    if (!profileId) {
      setIsAnimating(true);
      // Анимируем карточку вправо за экран, потом убираем
      await animateValue(motionX, 500, { duration: 0.18, ease: [0.4, 0, 1, 1] });
      removeCurrentProfile();
      motionX.set(0);
      setIsAnimating(false);
      setShowProfileSheet(false);
    }

    try {
      let isMatch = false;
      let matchedUser = null;

      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 300));
        isMatch = profileId ? true : Math.random() > 0.3;
        const baseUser = profileId 
          ? (whoLikedMe.find(u => u.id === profileId) || fallbackUser)
          : currentProfile;
        if (isMatch && baseUser) {
          matchedUser = {
            ...baseUser,
            user_id: baseUser.id,
            matched_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            hours_left: 24,
            minutes_left: 0,
          };
        }
      } else {
        const res = await likeUser(targetId);
        isMatch = res.is_match;
        matchedUser = res.matched_user;
      }

      if (isMatch && !matchedUser && fallbackUser) matchedUser = fallbackUser;

      if (profileId) {
        setWhoLikedMe(prev => (prev || []).filter(u => u.id !== targetId));
        setViewingProfile(null);
      }

      if (isMatch && matchedUser) {
        setMatches(prev => [matchedUser, ...(prev || [])]);
        handleMatch(matchedUser);
      }

      return { is_match: isMatch, matched_user: matchedUser };
    } catch (e) {
      console.error('Like error:', e);
      toast.error(e?.message || 'Не удалось поставить лайк');
      if (!profileId) {
        setIsAnimating(false);
      }
      return { is_match: false };
    }
  };

  const handleMatch = (user) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    setShowMatchModal(true, user);
  };

  // === RENDER: Loading / Onboarding gates ===

  if (checkingProfile) {
    return <div style={styles.centerContainer}><div style={styles.spinner} /></div>;
  }

  if (showOnboarding) {
    return (
      <DatingOnboarding 
        onClose={() => {
          setShowOnboarding(false);
          if (datingProfile) {
            loadProfiles(true);
            getDatingStats().then(updateDatingStats).catch(console.error);
          }
        }}
      />
    );
  }

  // === RENDER: Main ===
  return (
    <div style={styles.container}>
      {!viewingProfile && (
        <>
          <AppHeader
            title="Знакомства"
            premium
            premiumTrailing={
              <button
                style={styles.avatarButton}
                onClick={() => {
                  hapticFeedback('medium');
                  if (isGuestMode) setShowOnboarding(true);
                  else setShowMyProfile(true);
                }}
              >
                {datingProfile?.photos?.[0]?.url ? (
                  <img src={datingProfile.photos[0].url} alt="" style={styles.avatarImg} />
                ) : user?.avatar ? (
                  <img src={user.avatar} alt="" style={styles.avatarImg} />
                ) : (
                  <div style={styles.avatarFallback}>
                    {user?.name?.[0] || '?'}
                  </div>
                )}
              </button>
            }
          >
            <div style={styles.tabsRail}>
              <div
                style={{
                  ...styles.activeIndicator,
                  transform: `translateX(${activeTab === 'profiles' ? '0' : '100%'})`,
                }}
              />
              <button
                onClick={() => handleTabSwitch('profiles')}
                style={{
                  ...styles.tabButton,
                  color: activeTab === 'profiles' ? '#000' : '#FFF',
                }}
              >
                Анкеты
              </button>
              <button
                onClick={() => handleTabSwitch('likes')}
                style={{
                  ...styles.tabButton,
                  color: activeTab === 'likes' ? '#000' : '#FFF',
                }}
              >
                Симпатии
                {likesCount > 0 && (
                  <span style={{
                    ...styles.pillBadge,
                    backgroundColor: activeTab === 'likes' ? '#000' : d.pink,
                    color: activeTab === 'likes' ? d.accent : '#fff',
                  }}>
                    {likesCount}
                  </span>
                )}
              </button>
            </div>
          </AppHeader>
        </>
      )}

      <div style={styles.content}>
        {/* ===== TAB: Profiles ===== */}
        {activeTab === 'profiles' && !viewingProfile && (
          <>
            <div style={styles.cardWrapper}>
              {loading ? (
                <FeedCardSkeleton />
              ) : !currentProfile ? (
                /* Обновлённый empty state */
                <div style={styles.emptyState}>
                  <div style={styles.emptyEmoji}>😴</div>
                  <div style={styles.emptyTitle}>Анкеты закончились</div>
                  <div style={styles.emptySubtitle}>Загляни позже — появятся новые люди</div>
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {[currentProfile, ...profilesQueue]
                    .filter((p, i, self) => p && self.findIndex(t => t.id === p.id) === i)
                    .slice(0, 2)
                    .map((profile, index) => {
                      const isActive = index === 0;
                      const zIndex = 10 - index;
                      const scale = index === 0 ? 1 : 1 - (index * 0.05);
                      const translateY = isActive ? 0 : 16;
                      const opacity = index === 0 ? 1 : 0.6 - (index * 0.1);

                      return (
                        <motion.div
                          key={profile.id}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex,
                            willChange: 'transform',
                            // motionX/cardRotation обновляют DOM без re-render
                            x: isActive ? motionX : 0,
                            rotate: isActive ? cardRotation : 0,
                          }}
                          initial={{ scale: 0.8, opacity: 0, y: 50 }}
                          animate={{
                            scale, opacity, y: translateY,
                            transition: { type: 'spring', stiffness: 260, damping: 20 }
                          }}
                          exit={false}
                        >
                          {/* Overlays: всегда рендерятся, opacity через motion values */}
                          {isActive && (
                            <>
                              <motion.div style={{
                                ...styles.swipeOverlay,
                                opacity: likeOverlayOpacity,
                                background: 'radial-gradient(circle at center, rgba(76, 175, 80, 0.8), rgba(76, 175, 80, 0.5))',
                              }}>
                                <div style={{...styles.swipeLabel, color: '#4caf50'}}>❤️</div>
                                <div style={{...styles.swipeLabelText, color: '#4caf50'}}>LIKE</div>
                              </motion.div>
                              <motion.div style={{
                                ...styles.swipeOverlay,
                                opacity: nopeOverlayOpacity,
                                background: 'radial-gradient(circle at center, rgba(244, 67, 54, 0.8), rgba(244, 67, 54, 0.5))',
                              }}>
                                <div style={{...styles.swipeLabel, color: '#f44336'}}>✕</div>
                                <div style={{...styles.swipeLabelText, color: '#f44336'}}>NOPE</div>
                              </motion.div>
                            </>
                          )}

                          <ProfileCard
                            profile={profile}
                            onSwipeStart={isActive ? handleSwipeStart : undefined}
                            onSwipeMove={isActive ? handleSwipeMove : undefined}
                            onSwipeEnd={isActive ? handleSwipeEnd : undefined}
                            isBlurred={isGuestMode}
                            onRegisterTrigger={triggerOnboarding}
                            isInteractive={isActive}
                            onExpandProfile={() => setShowProfileSheet(true)}
                            onLike={handleLike}
                            onSkip={handleSkip}
                          />
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              )}
            </div>

            {/* ProfileSheet — bottom sheet для полной анкеты */}
            <ProfileSheet
              profile={currentProfile}
              isOpen={showProfileSheet}
              onClose={() => setShowProfileSheet(false)}
              onLike={handleLike}
              onSkip={handleSkip}
            />
          </>
        )}

        {/* ===== TAB: Likes ===== */}
        {activeTab === 'likes' && !viewingProfile && (
          <LikesTab
            matches={matches}
            users={whoLikedMe}
            loading={loadingLikes}
            matchesLoading={loadingMatches}
            onViewProfile={(user, type) => {
              hapticFeedback('light');
              setViewingProfile({ user, type });
            }}
            onMessage={(user) => {
              hapticFeedback('medium');
            }}
            onEmptyAction={() => setShowMyProfile(true)}
          />
        )}

        {/* ===== Viewing profile (from likes tab) ===== */}
        {activeTab === 'likes' && viewingProfile && (
          <ViewingProfileModal
            profile={viewingProfile.user}
            profileType={viewingProfile.type}
            onClose={() => { hapticFeedback('light'); setViewingProfile(null); }}
            onLike={() => {
              if (viewingProfile.type === 'like') {
                return handleLike(viewingProfile.user.id, viewingProfile.user);
              }
              return Promise.resolve({ is_match: false });
            }}
            onMessage={() => {
              if (viewingProfile.type === 'match') {
                hapticFeedback('medium');
                setViewingProfile(null);
              }
            }}
          />
        )}
      </div>

      {showMyProfile && (
        <MyDatingProfileModal
          onClose={() => setShowMyProfile(false)}
        />
      )}

      {showMatchModal && <MatchModal />}
    </div>
  );
}

const d = theme.colors.dating;

// ===== STYLES =====
const styles = {
  container: {
    display: 'flex', flexDirection: 'column',
    flex: 1, backgroundColor: theme.colors.premium.bg,
    minHeight: '100vh', maxHeight: '100vh',
    position: 'relative', overflow: 'hidden',
  },
  centerContainer: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
  },
  spinner: {
    width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: theme.colors.dating.primary || '#ff3b5c',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  tabsRail: {
    position: 'relative',
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: '50%',
    backgroundColor: d.accent,
    borderRadius: 15,
    boxShadow: '0 2px 10px rgba(212, 255, 0, 0.2)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    background: 'transparent',
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.3s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillBadge: {
    fontSize: 11,
    fontWeight: 800,
    padding: '2px 6px',
    borderRadius: 6,
    lineHeight: 1,
    transition: 'all 0.2s ease',
  },
  avatarButton: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    backgroundColor: d.surface,
    border: '2px solid rgba(255, 255, 255, 0.1)',
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    outline: 'none',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  content: {
    display: 'flex', flexDirection: 'column', flex: 1,
    paddingTop: 'calc(var(--header-padding, 96px) + 8px)',
    paddingBottom: 80, overflow: 'hidden', maxHeight: '100vh',
  },
  cardWrapper: {
    position: 'relative', padding: '0 8px',
    flex: 1, overflow: 'hidden',
  },
  swipeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, zIndex: 20, pointerEvents: 'none', borderRadius: 24,
  },
  swipeLabel: { fontSize: 72, fontWeight: 900, textShadow: '0 4px 16px rgba(0,0,0,0.5)' },
  swipeLabelText: { fontSize: 28, fontWeight: 900, letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
  emptyState: {
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', marginTop: 60,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: theme.colors.text },
  emptySubtitle: {
    fontSize: 14, color: theme.colors.textSecondary, marginTop: 8,
    maxWidth: 260, lineHeight: 1.4,
  },
};

// Inject keyframes
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleSheet);
}

export default DatingFeed;
