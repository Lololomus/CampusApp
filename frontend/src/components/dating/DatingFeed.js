// ===== 📄 ФАЙЛ: frontend/src/components/dating/DatingFeed.js (ИСПРАВЛЕНО) =====

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, Calendar, ChevronUp, Heart } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, dislikeUser, getDatingStats, getWhoLikedMe, getMyDatingProfile } from '../../api';
import AppHeader from '../shared/AppHeader';
import ProfileCard from './ProfileCard';
import MatchModal from './MatchModal';
import ProfileCardSkeleton from './ProfileCardSkeleton';
import DatingOnboarding from './DatingOnboarding';
import MyDatingProfileModal from './MyDatingProfileModal';
import EditDatingProfileModal from './EditDatingProfileModal';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

// ===== КОНСТАНТЫ =====
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

// ===== MOCK DATA =====
const USE_MOCK_DATA = process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_MOCK === 'true';

const MOCK_PROFILES = [
  { 
    id: 1, 
    name: 'Алексей', 
    age: 22, 
    bio: 'Ищу напарника на хакатон 💻\n\nЛюблю кодить по ночам, пить кофе литрами и участвовать в хакатонах.',
    university: 'МГУ', 
    institute: 'ВМК', 
    course: 3,
    interests: ['it', 'games', 'coffee', 'startup', 'music'],
    goals: ['relationship', 'study'],
    photos: [
      { url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1000&auto=format&fit=crop' },
      { url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop' }
    ] 
  },
  { 
    id: 2, 
    name: 'Мария', 
    age: 20, 
    bio: 'Фотограф, ищу моделей для портфолио 📸\n\nЛюблю творчество и искусство.',
    university: 'ВШЭ', 
    institute: 'Дизайн', 
    course: 2,
    interests: ['photo', 'art', 'music', 'coffee', 'books'],
    goals: ['friends', 'hangout'],
    photos: [
      { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1000&auto=format&fit=crop' },
    ] 
  },
  { 
    id: 3, 
    name: 'Дмитрий', 
    age: 23, 
    bio: 'Гитарист в поиске группы 🎸\n\nРок, метал, все что громко!',
    university: 'МГТУ', 
    institute: 'ИБ', 
    course: 4,
    interests: ['music', 'party', 'sport', 'travel'],
    goals: ['friends', 'hangout'],
    photos: [
      { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop' },
    ] 
  },
  { 
    id: 4, 
    name: 'София', 
    age: 21, 
    bio: 'Люблю спорт и здоровый образ жизни 🏋️\n\nИщу компанию для пробежек и зала.',
    university: 'МГСУ', 
    institute: 'ИЦИТ', 
    course: 3,
    interests: ['fitness', 'sport', 'food', 'travel', 'music'],
    goals: ['friends', 'relationship'],
    photos: [
      { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=1000&auto=format&fit=crop' },
    ] 
  },
  { 
    id: 5, 
    name: 'Максим', 
    age: 24, 
    bio: 'Стартапер, работаю над AI проектом 🚀\n\nВсегда рад новым знакомствам и нетворкингу.',
    university: 'РУК', 
    institute: 'Экономический', 
    course: 5,
    interests: ['startup', 'it', 'coffee', 'books', 'travel'],
    goals: ['study', 'friends'],
    photos: [
      { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1000&auto=format&fit=crop' },
    ] 
  },
];

const MOCK_LIKES = [
  { 
    id: 101, 
    name: 'Анна', 
    age: 19, 
    university: 'МГУ', 
    institute: 'Журфак',
    course: 1,
    bio: 'Люблю театры и литературу 🎭',
    avatar: null,
    interests: ['books', 'art', 'movies'],
    goals: ['friends', 'hangout']
  },
  { 
    id: 102, 
    name: 'Илья', 
    age: 22, 
    university: 'МФТИ', 
    institute: 'ФРКТ',
    course: 4,
    bio: 'Физтех, люблю математику и шахматы ♟️',
    avatar: null,
    interests: ['science', 'books', 'games'],
    goals: ['study', 'friends']
  },
];

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

  // ===== STATE =====
  const [checkingProfile, setCheckingProfile] = useState(!datingProfile);
  const isGuestMode = !datingProfile; 
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('profiles');
  const [loading, setLoading] = useState(true);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [infoExpanded, setInfoExpanded] = useState(false);
  
  // Drag state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  const isLoadingRef = useRef(false);
  const offset = useRef(0);
  const swipeThreshold = 100;

  // ===== 1. INITIAL CHECK & LOAD =====
  useEffect(() => {
    const checkRegistration = async () => {
      if (datingProfile) {
        setCheckingProfile(false);
        return;
      }
      try {
        if (USE_MOCK_DATA) {
          setCheckingProfile(false);
        } else {
          const profile = await getMyDatingProfile();
          if (profile) setDatingProfile(profile);
        }
      } catch (e) {
        console.log('Guest mode');
      } finally {
        setCheckingProfile(false);
      }
    };
    checkRegistration();
  }, [datingProfile, setDatingProfile]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingProfile]);

  // ===== 2. LOAD DATA =====
  const loadProfiles = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      
      if (reset) {
        setLoading(true);
        offset.current = 0;
      } else {
        setIsLoadingProfiles(true);
      }
      
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
    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoadingLikes(false); 
    }
  };

  useEffect(() => {
    if (!checkingProfile && !currentProfile && hasMoreProfiles) {
      loadProfiles(true);
    }
    
    if (!checkingProfile && !isGuestMode) {
      if (USE_MOCK_DATA) updateDatingStats({ likes_count: MOCK_LIKES.length });
      else getDatingStats().then(updateDatingStats).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingProfile]); 

  useEffect(() => {
    setOnPrefetchNeeded(() => {
      console.log('⚡ Prefetch triggered');
      loadProfiles(false);
    });
  }, [setOnPrefetchNeeded, loadProfiles]);

  useEffect(() => {
    if (activeTab === 'likes' && !isGuestMode) loadLikes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isGuestMode]);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('datingTutorialSeen');
    if (!hasSeenTutorial && !isGuestMode && currentProfile && !loading) {
      setTimeout(() => setShowTutorial(true), 800);
    }
  }, [currentProfile, isGuestMode, loading]);

  // ===== HANDLERS =====
  const triggerOnboarding = () => {
    hapticFeedback('medium');
    setShowOnboarding(true);
  };

  const closeTutorial = () => {
    localStorage.setItem('datingTutorialSeen', 'true');
    setShowTutorial(false);
    hapticFeedback('medium');
  };

  const handleTabSwitch = (tab) => {
    if (isGuestMode && tab === 'likes') {
      triggerOnboarding();
      return;
    }
    if (activeTab !== tab) {
      hapticFeedback('medium');
      setActiveTab(tab);
      setViewingProfile(null);
    }
  };

  // ===== SWIPE LOGIC =====
  const handleSwipeStart = () => {
    setIsDragging(true);
  };

  const handleSwipeMove = (delta) => {
    setDragX(delta);
  };

  const handleSwipeEnd = async (finalDelta = 0) => {
    setIsDragging(false);
    
    const deltaToCheck = typeof finalDelta === 'number' ? finalDelta : dragX;
    
    if (Math.abs(deltaToCheck) > swipeThreshold) {
      if (deltaToCheck > 0) {
        await handleLike();
      } else {
        await handleSkip();
      }
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

  const handleLike = async (profileId = null) => {
    const targetId = profileId || currentProfile?.id;
    
    if (isGuestMode) {
      hapticFeedback('medium');
      triggerOnboarding();
      return;
    }
    
    if (!targetId || (isAnimating && !profileId)) return;
    
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
        isMatch = Math.random() > 0.3;
        matchedUser = profileId 
          ? whoLikedMe.find(u => u.id === profileId) 
          : currentProfile;
      } else {
        const res = await likeUser(targetId);
        isMatch = res.is_match;
        matchedUser = res.matched_user;
      }
      
      if (profileId) {
        setWhoLikedMe(prev => prev.filter(u => u.id !== targetId));
        setViewingProfile(null);
      }
      
      if (isMatch) {
        handleMatch(matchedUser);
      }
    } catch (e) {
      console.error('Like error:', e);
      alert('Ошибка при лайке');
      
      if (!profileId) {
        setSwipeDirection(null);
        setIsAnimating(false);
      }
    }
  };

  const handleMatch = (user) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }
    setShowMatchModal(true, user);
  };

  // ===== RENDER =====
  if (checkingProfile) {
    return <div style={styles.centerContainer}><div style={styles.spinner}></div></div>;
  }

  // ✅ Онбординг показывается ТОЛЬКО когда явно вызван
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

  return (
    <div style={styles.container}>
      {!viewingProfile && (
        <AppHeader title="Знакомства">
          <div style={styles.tabsWrapper}>
            <div style={styles.tabsContainer}>
              <div 
                style={{
                  ...styles.activeIndicator,
                  transform: `translateX(${activeTab === 'profiles' ? '0%' : 'calc(100% + 52px)'})`,
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
        {activeTab === 'profiles' && !viewingProfile && (
          <>
            <div style={styles.cardWrapper}>
              {loading ? (
                <ProfileCardSkeleton />
              ) : !currentProfile ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyEmoji}>😴</div>
                  <div style={styles.emptyTitle}>Анкеты закончились</div>
                </div>
              ) : (
                <AnimatePresence initial={false} mode="popLayout">
                  {[currentProfile, ...profilesQueue]
                    .filter((p, i, self) => p && self.findIndex(t => t.id === p.id) === i)
                    .slice(0, 3) 
                    .map((profile, index) => {
                      const isActive = index === 0;
                      const zIndex = 10 - index;
                      
                      const scale = index === 0 ? 1 : 1 - (index * 0.05);
                      const translateY = index * 16;
                      const opacity = index === 0 ? 1 : 0.6 - (index * 0.1);
                      
                      const rotation = isActive ? dragX * 0.05 : 0;
                      const translateX = isActive ? dragX : 0;
                      
                      return (
                        <motion.div
                          key={profile.id}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            zIndex: zIndex,
                          }}
                          initial={{ scale: 0.8, opacity: 0, y: 50 }}
                          animate={{ 
                            scale: scale,
                            opacity: opacity,
                            y: translateY,
                            x: translateX,
                            rotate: rotation,
                            transition: isDragging && isActive 
                              ? { duration: 0 }
                              : { type: 'spring', stiffness: 260, damping: 20 }
                          }}
                          exit={isActive ? { 
                            x: swipeDirection === 'left' ? -500 : 500,
                            opacity: 0,
                            scale: 0.8,
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

            {currentProfile && !loading && (
              <div style={{
                ...styles.infoBar,
                height: infoExpanded ? 'auto' : '170px',
                maxHeight: infoExpanded ? '60vh' : '170px',
              }}>
                <button 
                  style={styles.expandButton} 
                  onClick={() => { 
                    setInfoExpanded(!infoExpanded); 
                    hapticFeedback('light'); 
                  }}
                >
                  <ChevronUp 
                    size={20} 
                    strokeWidth={3}
                    style={{
                      transform: infoExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s',
                    }}
                  />
                </button>

                <div style={styles.infoContent}>
                  <div style={styles.header}>
                    <h2 style={styles.name}>
                      {currentProfile.name}, <span style={styles.age}>{currentProfile.age}</span>
                    </h2>
                  </div>
                  
                  {/* ===== ВУЗ НА ОДНОЙ СТРОКЕ ===== */}
                  <div style={styles.universityRow}>
                    🎓 {currentProfile.university} • {currentProfile.institute}
                    {currentProfile.course && ` • ${currentProfile.course} курс`}
                  </div>

                  {/* ===== GOALS В ЗАКРЫТОЙ ШТОРКЕ ===== */}
                  {!infoExpanded && currentProfile.goals?.length > 0 && (
                    <div style={styles.goalsRow}>
                      {currentProfile.goals.slice(0, 2).map((goal, i) => (
                        <span key={i} style={styles.goalTag}>
                          {GOAL_ICONS[goal] || goal}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ===== ИНТЕРЕСЫ В ЗАКРЫТОЙ ШТОРКЕ ===== */}
                  {!infoExpanded && currentProfile.interests?.length > 0 && (
                    <div style={styles.interestsRowCollapsed}>
                      {currentProfile.interests.slice(0, 3).map((interest, i) => (
                        <span key={i} style={styles.interestTagSmall}>
                          {INTEREST_LABELS[interest] || interest}
                        </span>
                      ))}
                      {currentProfile.interests.length > 3 && (
                        <span style={styles.interestTagSmall}>+{currentProfile.interests.length - 3}</span>
                      )}
                    </div>
                  )}

                  {!infoExpanded && currentProfile.bio && (
                    <div style={styles.bioCollapsed}>
                      <p style={styles.bioTextCollapsed}>{currentProfile.bio}</p>
                      <div style={styles.fadeGradient} />
                    </div>
                  )}

                  {infoExpanded && (
                    <div style={styles.expandedContent}>
                      {currentProfile.goals?.length > 0 && (
                        <div style={styles.goalsRow}>
                          {currentProfile.goals.map((goal, i) => (
                            <span key={i} style={styles.goalTag}>
                              {GOAL_ICONS[goal] || goal}
                            </span>
                          ))}
                        </div>
                      )}
                      {currentProfile.bio && (
                        <div style={styles.bioSection}>
                          <p style={styles.bioText}>{currentProfile.bio}</p>
                        </div>
                      )}
                      {currentProfile.interests?.length > 0 && (
                        <div style={styles.interestsRow}>
                          {currentProfile.interests.map((interest, i) => (
                            <span key={i} style={styles.interestTag}>
                              {INTEREST_LABELS[interest] || interest}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'likes' && !viewingProfile && (
          <div style={styles.likesList}>
            {loadingLikes ? (
              <div style={styles.loader}>Загрузка...</div>
            ) : whoLikedMe.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyEmoji}>💔</div>
                <div style={styles.emptyTitle}>Пока пусто</div>
              </div>
            ) : (
              whoLikedMe.map((user, idx) => (
                <div 
                  key={user.id} 
                  style={{...styles.likeCard, animationDelay: `${idx * 0.05}s`}} 
                  onClick={() => { 
                    hapticFeedback('light'); 
                    setViewingProfile(user); 
                  }}
                >
                  <div style={styles.likeCardAvatar}>
                    {user.avatar ? (
                      <img src={user.avatar} style={styles.avatarImg} alt="" />
                    ) : (
                      <div style={styles.avatarPlaceholder}>{user.name[0]}</div>
                    )}
                  </div>
                  <div style={styles.likeCardInfo}>
                    <div style={styles.likeCardName}>{user.name}, {user.age}</div>
                    <div style={styles.likeCardUni}>{user.university}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showTutorial && (
        <div style={styles.tutorialOverlay} onClick={closeTutorial}>
          <div style={styles.tutorialContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.tutorialIcon}>👆</div>
            <h3 style={styles.tutorialTitle}>Как это работает</h3>
            <div style={styles.tutorialRow}>
              <div style={styles.tutorialItem}>
                <div style={styles.arrowLeft}>←</div>
                <p style={styles.tutorialText}>Свайп влево<br/><strong>Нет</strong></p>
              </div>
              <div style={styles.tutorialItem}>
                <div style={styles.arrowRight}>→</div>
                <p style={styles.tutorialText}>Свайп вправо<br/><strong>Лайк</strong></p>
              </div>
            </div>
            <button onClick={closeTutorial} style={styles.tutorialButton}>Понятно!</button>
          </div>
        </div>
      )}

      {showMyProfile && (
        <MyDatingProfileModal
          onClose={() => setShowMyProfile(false)}
          onEditClick={() => {
            setShowMyProfile(false);
            setShowEditProfile(true);
          }}
        />
      )}

      {showEditProfile && (
        <EditDatingProfileModal
          onClose={() => setShowEditProfile(false)}
          onSuccess={() => {
            console.log('✅ Профиль обновлен');
          }}
        />
      )}

      {showMatchModal && <MatchModal />}
    </div>
  );
}

// ===== STYLES =====
const styles = {
  container: { 
    flex: 1, 
    backgroundColor: theme.colors.bg, 
    minHeight: '100vh', 
    position: 'relative' 
  },
  centerContainer: { 
    flex: 1, 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    height: '100vh' 
  },
  spinner: { 
    width: 40, 
    height: 40, 
    borderRadius: '50%', 
    border: '4px solid rgba(255,255,255,0.1)', 
    borderTopColor: '#f5576c', 
    animation: 'spin 1s linear infinite' 
  },
  
  tabsWrapper: { 
    padding: '0 8px 12px 8px'
  },
  tabsContainer: { 
    position: 'relative', 
    display: 'flex', 
    alignItems: 'center',
    backgroundColor: theme.colors.bg, 
    borderRadius: theme.radius.lg, 
    padding: '4px', 
    height: 44, 
    border: `1px solid ${theme.colors.border}` 
  },
  activeIndicator: { 
    position: 'absolute', 
    top: 4, 
    bottom: 4, 
    left: 4, 
    width: 'calc((100% - 52px) / 2 - 4px)',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
    borderRadius: theme.radius.md, 
    boxShadow: '0 2px 8px rgba(245, 87, 108, 0.4)', 
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', 
    zIndex: 1 
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
    padding: '0 8px',
    height: '100%',
  },
  badge: { 
    backgroundColor: '#fff', 
    color: '#f5576c', 
    fontSize: 11, 
    fontWeight: 800, 
    padding: '1px 6px', 
    borderRadius: 10, 
    minWidth: 18 
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
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '2px solid #8774e1',
    padding: 0,
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
    backgroundColor: theme.colors.card,
    transition: 'transform 0.2s, box-shadow 0.2s',
    margin: '0 10px',
    boxShadow: '0 2px 8px rgba(135, 116, 225, 0.3)',
  },

  content: { 
    display: 'flex', 
    flexDirection: 'column', 
    minHeight: '100vh', 
    paddingTop: 'calc(var(--header-padding, 104px) + 16px)', 
    paddingBottom: '180px' 
  },
  cardWrapper: { 
    position: 'relative',
    flex: 1, 
    padding: '0 12px',
    minHeight: '500px',
    maxHeight: 'calc(100vh - 360px)',
    marginBottom: '16px',
  },

  swipeOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    zIndex: 20,
    pointerEvents: 'none',
    borderRadius: 24,
  },
  swipeLabel: {
    fontSize: 72,
    fontWeight: 900,
    textShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  swipeLabelText: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: '4px',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },

  infoBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: 'rgba(30, 30, 30, 0.98)',
    backdropFilter: 'blur(20px)',
    borderRadius: '24px 24px 0 0',
    transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
    zIndex: 100,
    overflow: 'hidden',
    paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 60px)',
  },

  expandButton: {
    width: '100%',
    height: 32,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  infoContent: {
    padding: '0 20px 20px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  header: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: 8 
  },
  name: { 
    fontSize: 24, 
    fontWeight: 800, 
    color: theme.colors.text, 
    margin: 0 
  },
  age: { 
    fontWeight: 400 
  },
  universityRow: {
    fontSize: 14,
    fontWeight: 500,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
    marginBottom: 4
  },
  bioCollapsed: {
    position: 'relative',
    maxHeight: '40px',
    overflow: 'hidden',
    marginTop: 4,
  },
  bioTextCollapsed: {
    fontSize: 15,
    lineHeight: 1.4,
    color: theme.colors.text,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '20px',
    background: 'linear-gradient(to bottom, transparent, rgba(30, 30, 30, 0.98))',
    pointerEvents: 'none',
  },
  expandedContent: { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 },
  goalsRow: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    gap: 8,
    marginTop: 8
  },
  goalTag: { 
    padding: '6px 12px', 
    borderRadius: 14, 
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.15) 0%, rgba(255, 107, 157, 0.15) 100%)', 
    border: '1px solid rgba(255, 59, 92, 0.3)',
    color: '#ff6b9d', 
    fontSize: 13, 
    fontWeight: 600 
  },
  interestsRowCollapsed: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  interestTagSmall: {
    padding: '4px 10px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid #333',
    color: theme.colors.textTertiary,
    fontSize: 12,
    fontWeight: 500,
  },
  interestsRow: { 
    display: 'flex', 
    flexWrap: 'wrap', 
    gap: 6 
  },
  interestTag: { 
    fontSize: 13, 
    color: theme.colors.textSecondary, 
    padding: '6px 12px', 
    borderRadius: 12, 
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid #333',
    fontWeight: 500
  },
  bioCollapsed: {
    position: 'relative',
    maxHeight: '40px',
    overflow: 'hidden',
    marginTop: 8,
  },
  bioTextCollapsed: {
    fontSize: 15,
    lineHeight: 1.4,
    color: theme.colors.text,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  fadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '20px',
    background: 'linear-gradient(to bottom, transparent, rgba(30, 30, 30, 0.98))',
    pointerEvents: 'none',
  },
  expandedContent: { 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 12, 
    marginTop: 8 
  },
  bioSection: { 
    marginTop: 4 
  },
  bioText: { 
    fontSize: 15, 
    lineHeight: 1.4, 
    color: theme.colors.text, 
    margin: 0, 
    whiteSpace: 'pre-line' 
  },
  bioSection: { marginTop: 4 },
  bioText: { fontSize: 15, lineHeight: 1.4, color: theme.colors.text, margin: 0, whiteSpace: 'pre-line' },
  interestsRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  interestTag: { fontSize: 12, color: theme.colors.textTertiary, padding: '4px 8px', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },

  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: theme.colors.text },
  
  likesList: { padding: '0 12px 100px', display: 'flex', flexDirection: 'column', gap: 12 },
  likeCard: { display: 'flex', alignItems: 'center', gap: 12, background: theme.colors.card, padding: 12, borderRadius: 16, animation: 'fadeInUp 0.3s ease forwards', opacity: 0, cursor: 'pointer' },
  likeCardAvatar: { flexShrink: 0 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 },
  likeCardInfo: { flex: 1 },
  likeCardName: { fontSize: 16, fontWeight: 700, color: theme.colors.text },
  likeCardUni: { fontSize: 13, color: theme.colors.textSecondary },
  loader: { textAlign: 'center', padding: 20, color: theme.colors.textSecondary },

  tutorialOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.85)', zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' },
  tutorialContent: { background: theme.colors.card, borderRadius: 24, padding: '32px 24px', maxWidth: '320px', textAlign: 'center' },
  tutorialIcon: { fontSize: 64, marginBottom: 16, animation: 'bounce 1s infinite' },
  tutorialTitle: { fontSize: 20, fontWeight: 700, color: theme.colors.text, marginBottom: 24, margin: '0 0 24px 0' },
  tutorialRow: { display: 'flex', gap: 24, marginBottom: 24 },
  tutorialItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  tutorialText: { fontSize: 14, color: theme.colors.textSecondary, margin: 0, lineHeight: 1.4 },
  arrowLeft: { fontSize: 40, color: theme.colors.error, fontWeight: 700 },
  arrowRight: { fontSize: 40, color: '#f5576c', fontWeight: 700 },
  tutorialButton: { width: '100%', padding: '14px', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#fff', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 700, cursor: 'pointer' },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
  @keyframes pulse { 
    0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(240, 147, 251, 0.4); } 
    50% { transform: scale(1.05); box-shadow: 0 12px 40px rgba(240, 147, 251, 0.6); } 
  }
`;
document.head.appendChild(styleSheet);

export default DatingFeed;