// ===== 📄 ФАЙЛ: src/components/dating/DatingFeed.js =====

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, dislikeUser, getDatingStats, getWhoLikedMe, getMyDatingProfile, getMyMatches } from '../../api';
import AppHeader from '../shared/AppHeader';
import ProfileCard from './ProfileCard';
import MatchModal from './MatchModal';
import { FeedCardSkeleton, FeedInfoBarSkeleton } from './DatingSkeletons';
import DatingOnboarding from './DatingOnboarding';
import MyDatingProfileModal from './MyDatingProfileModal';
import EditDatingProfileModal from './EditDatingProfileModal';
import LikesTab from './LikesTab';
import ViewingProfileModal from './ViewingProfileModal';
import ProfileInfoBar from './ProfileInfoBar';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import { toast } from '../shared/Toast';
import { USE_MOCK_DATA, MOCK_PROFILES, MOCK_LIKES, MOCK_MATCHES } from './mockData';


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
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [returnToMyProfileOnEditClose, setReturnToMyProfileOnEditClose] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [matches, setMatches] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  const openEditProfile = useCallback((fromMyProfile = false) => {
    setReturnToMyProfileOnEditClose(fromMyProfile);
    if (fromMyProfile) setShowMyProfile(false);
    setShowEditProfile(true);
  }, []);

  const closeEditProfile = useCallback(() => {
    setShowEditProfile(false);
    if (returnToMyProfileOnEditClose) setShowMyProfile(true);
    setReturnToMyProfileOnEditClose(false);
  }, [returnToMyProfileOnEditClose]);
  
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
  const swipeThreshold = 100;

  useEffect(() => {
    if (currentProfile?.id) setInfoExpanded(false);
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
        console.log('Guest mode или ошибка:', e);
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
      console.log('⚡ Prefetch triggered');
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

  const handleSwipeStart = () => setIsDragging(true);
  const handleSwipeMove = (delta) => setDragX(delta);

  const handleSwipeEnd = async (finalDelta = 0) => {
    setIsDragging(false);
    const deltaToCheck = typeof finalDelta === 'number' ? finalDelta : dragX;
    if (Math.abs(deltaToCheck) > swipeThreshold) {
      if (deltaToCheck > 0) await handleLike();
      else await handleSkip();
    } else {
      setDragX(0);
    }
  };

  const handleSkip = async () => {
    if (isAnimating || !currentProfile) return;
    hapticFeedback('light');
    setSwipeDirection('left');
    setIsAnimating(true);
    if (!isGuestMode && currentProfile?.id) {
      dislikeUser(currentProfile.id).catch(console.error);
    }
    removeCurrentProfile();
    setDragX(0);
    setTimeout(() => {
      setIsAnimating(false);
      setSwipeDirection(null);
      setInfoExpanded(false);
    }, 500);
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
      setSwipeDirection('right');
      setIsAnimating(true);
      removeCurrentProfile();
      setDragX(0);
      setTimeout(() => {
        setIsAnimating(false);
        setSwipeDirection(null);
        setInfoExpanded(false);
      }, 500);
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
        setSwipeDirection(null);
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

  const overlayOpacity = Math.min(Math.abs(dragX) / 200, 0.8);
  const showLikeOverlay = dragX > 50;
  const showNopeOverlay = dragX < -50;

  // === RENDER: Main ===
  return (
    <div style={styles.container}>
      {!viewingProfile && (
        <AppHeader title="Знакомства">
          <div style={styles.tabsWrapper}>
            <div style={styles.tabsContainer}>
              <div 
                style={{
                  ...styles.activeIndicator,
                  transform: `translateX(${activeTab === 'profiles' ? '0%' : 'calc(100% + 80px)'})`
                }} 
              />
              
              <button 
                onClick={() => handleTabSwitch('profiles')} 
                style={{
                  ...styles.tabButton, 
                  color: activeTab === 'profiles' ? '#fff' : theme.colors.textSecondary
                }}
              >
                Анкеты
              </button>

              <button 
                style={styles.avatarButtonCenter}
                onClick={() => {
                  hapticFeedback('medium');
                  if (isGuestMode) {
                    setShowOnboarding(true);
                  } else {
                    setShowMyProfile(true);
                  }
                }}
              >
                {datingProfile?.photos?.[0]?.url ? (
                  <img 
                    src={datingProfile.photos[0].url} 
                    alt="" 
                    style={styles.avatarImg}
                  />
                ) : user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt="" 
                    style={styles.avatarImg}
                  />
                ) : (
                  <div style={styles.avatarFallback}>
                    {user?.name?.[0] || '?'}
                  </div>
                )}
              </button>

              <button 
                onClick={() => handleTabSwitch('likes')} 
                style={{
                  ...styles.tabButton, 
                  color: activeTab === 'likes' ? '#fff' : theme.colors.textSecondary
                }}
              >
                Симпатии {likesCount > 0 && <span style={styles.badge}>{likesCount}</span>}
              </button>
            </div>
          </div>
        </AppHeader>
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
                      const rotation = isActive ? dragX * 0.05 : 0;
                      const translateX = isActive ? dragX : 0;
                      
                      return (
                        <motion.div
                          key={profile.id}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex,
                          }}
                          initial={{ scale: 0.8, opacity: 0, y: 50 }}
                          animate={{ 
                            scale, opacity, y: translateY, x: translateX, rotate: rotation,
                            transition: isDragging && isActive 
                              ? { duration: 0 }
                              : { type: 'spring', stiffness: 260, damping: 20 }
                          }}
                          exit={isActive ? { 
                            x: swipeDirection === 'left' ? -500 : 500,
                            opacity: 0, scale: 0.8,
                            rotate: swipeDirection === 'left' ? -30 : 30,
                            transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
                          } : undefined}
                        >
                          {isActive && showLikeOverlay && (
                            <div style={{
                              ...styles.swipeOverlay,
                              background: `radial-gradient(circle at center, rgba(76, 175, 80, ${overlayOpacity}), rgba(76, 175, 80, ${overlayOpacity * 0.6}))`
                            }}>
                              <div style={{...styles.swipeLabel, color: '#4caf50'}}>❤️</div>
                              <div style={{...styles.swipeLabelText, color: '#4caf50'}}>LIKE</div>
                            </div>
                          )}
                          {isActive && showNopeOverlay && (
                            <div style={{
                              ...styles.swipeOverlay,
                              background: `radial-gradient(circle at center, rgba(244, 67, 54, ${overlayOpacity}), rgba(244, 67, 54, ${overlayOpacity * 0.6}))`
                            }}>
                              <div style={{...styles.swipeLabel, color: '#f44336'}}>✕</div>
                              <div style={{...styles.swipeLabelText, color: '#f44336'}}>NOPE</div>
                            </div>
                          )}
                          
                          <ProfileCard
                            profile={profile}
                            onSwipeStart={isActive ? handleSwipeStart : undefined}
                            onSwipeMove={isActive ? handleSwipeMove : undefined}
                            onSwipeEnd={isActive ? handleSwipeEnd : undefined}
                            isBlurred={isGuestMode}
                            onRegisterTrigger={triggerOnboarding}
                            isInteractive={isActive}
                          />
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
              )}
            </div>

            {/* InfoBar — теперь получает match_reason и common_interests через profile */}
            {!loading && currentProfile && (
              <ProfileInfoBar
                profile={currentProfile}
                isExpanded={infoExpanded}
                onToggle={setInfoExpanded}
              />
            )}

            {loading && (
              <div style={styles.infoBarSkeleton}>
                <FeedInfoBarSkeleton />
              </div>
            )}
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
            onQuickLike={async (userId) => {
              const result = await handleLike(userId);
              return result;
            }}
            onMessage={(user) => {
              hapticFeedback('medium');
              console.log('Open chat with', user);
            }}
            onEmptyAction={() => openEditProfile(false)}
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
                console.log('Open chat with', viewingProfile.user);
                setViewingProfile(null);
              }
            }}
          />
        )}
      </div>

      {showMyProfile && (
        <MyDatingProfileModal 
          onClose={() => setShowMyProfile(false)}
          onEditClick={() => openEditProfile(true)}
        />
      )}

      {showEditProfile && (
        <EditDatingProfileModal 
          onClose={closeEditProfile}
          onSuccess={() => console.log('✅')}
        />
      )}

      {showMatchModal && <MatchModal />}
    </div>
  );
}

// ===== STYLES =====
const styles = {
  container: {
    flex: 1, backgroundColor: theme.colors.bg,
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
  tabsWrapper: {
    padding: '0 8px 12px 8px',
    overflow: 'visible',
  },
  tabsContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: 4,
    height: 44,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'visible',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: 'calc((100% - 88px) / 2)',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    borderRadius: theme.radius.md,
    boxShadow: '0 2px 8px rgba(245, 87, 108, 0.4)',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    background: 'transparent',
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '0 4px',
    height: '100%',
  },
  badge: {
    backgroundColor: '#fff',
    color: '#f5576c',
    fontSize: 11,
    fontWeight: 800,
    padding: '1px 6px',
    borderRadius: 10,
    minWidth: 18,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
  },
  avatarButtonCenter: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    border: '2px solid transparent',
    backgroundImage: 'linear-gradient(#0a0a0a, #0a0a0a), linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 50%, #f093fb 100%)',
    backgroundOrigin: 'border-box',
    backgroundClip: 'padding-box, border-box',
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'transform 0.2s, box-shadow 0.2s',
    margin: '0 12px',
    boxShadow: '0 4px 16px rgba(255, 59, 92, 0.4), 0 0 24px rgba(240, 147, 251, 0.3)',
    position: 'relative',
    transform: 'translateY(0px)',
    zIndex: 10,
  },
  content: {
    display: 'flex', flexDirection: 'column', flex: 1,
    paddingTop: 'calc(var(--header-padding, 104px) + 16px)',
    paddingBottom: 0, overflow: 'hidden', maxHeight: '100vh',
  },
  cardWrapper: {
    position: 'relative', padding: '0 12px', minHeight: 400,
    height: 'calc(100vh - var(--info-bar-min-height) - var(--header-height) + 250px)',
    maxHeight: 'calc(100vh - var(--info-bar-min-height) - var(--header-height) + 250px)',
    marginTop: 'auto', marginBottom: 0, overflow: 'hidden',
  },
  swipeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 8, zIndex: 20, pointerEvents: 'none', borderRadius: 24,
  },
  swipeLabel: { fontSize: 72, fontWeight: 900, textShadow: '0 4px 16px rgba(0,0,0,0.5)' },
  swipeLabelText: { fontSize: 28, fontWeight: 900, letterSpacing: 4, textShadow: '0 2px 8px rgba(0,0,0,0.5)' },
  infoBarSkeleton: {
    position: 'absolute', bottom: 65, left: 0, right: 0,
    background: 'linear-gradient(to top, rgba(10, 10, 10, 0.98) 0%, rgba(10, 10, 10, 0.95) 85%, transparent 100%)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    padding: '20px 20px 24px', zIndex: 30,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
    maxHeight: '70vh', overflowY: 'auto',
  },
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
