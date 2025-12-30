// ===== 📄 ФАЙЛ: src/components/dating/DatingFeed.js =====

import React, { useEffect, useState, useRef } from 'react';
import { Heart, X, ChevronLeft } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, getDatingStats, getWhoLikedMe, getMyDatingProfile } from '../../api';
import AppHeader from '../shared/AppHeader';
import ProfileCard from './ProfileCard';
import MatchModal from './MatchModal';
import ProfileCardSkeleton from './ProfileCardSkeleton';
import DatingOnboarding from './DatingOnboarding';
import theme from '../../theme';

// ===== 🎭 MOCK DATA =====
const USE_MOCK_DATA = true;

const MOCK_PROFILES = [
  { 
    id: 1, 
    name: 'Алексей', 
    age: 22, 
    bio: 'Ищу напарника на хакатон 💻', 
    university: 'МГУ', 
    institute: 'ВМК', 
    interests: ['python', 'coding'], 
    photos: [
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1000&auto=format&fit=crop', // Портрет парня
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1000&auto=format&fit=crop'  // Кодинг
    ] 
  },
  { 
    id: 2, 
    name: 'Мария', 
    age: 20, 
    bio: 'Фотограф, ищу моделей 📸', 
    university: 'ВШЭ', 
    institute: 'Дизайн', 
    interests: ['photo', 'art'], 
    photos: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=1000&auto=format&fit=crop', // Портрет девушки
      'https://images.unsplash.com/photo-1554048612-387768052bf7?q=80&w=1000&auto=format&fit=crop'  // Фотоаппарат
    ] 
  },
  { 
    id: 3, 
    name: 'Дмитрий', 
    age: 23, 
    bio: 'Гитарист в поиске группы 🎸', 
    university: 'МГТУ', 
    institute: 'ИБ', 
    interests: ['rock', 'music'], 
    photos: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop', // Портрет парня 2
      'https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=1000&auto=format&fit=crop'  // Музыка
    ] 
  },
];

const MOCK_LIKES = [
  { id: 101, name: 'Анна', age: 19, university: 'МГУ', institute: 'Журфак', bio: 'Люблю театры и выставки 🎭', avatar: null, interests: ['dance', 'art'] },
];

function DatingFeed() {
  const {
    datingProfile,
    setDatingProfile,
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
  } = useStore();

  // ===== STATE =====
  // 1. Проверяем регистрацию
  const [checkingProfile, setCheckingProfile] = useState(!datingProfile);
  
  // 2. Флаг: если нет профиля -> мы в режиме "Гость" (Teaser Mode)
  const isGuestMode = !datingProfile; 

  // 3. Если true -> перекрываем всё онбордингом
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [activeTab, setActiveTab] = useState('profiles');
  const [loading, setLoading] = useState(true);
  const [loadingLikes, setLoadingLikes] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  const [viewingProfile, setViewingProfile] = useState(null);
  
  const isLoadingRef = useRef(false);
  const offset = useRef(0);

  // ===== 1. INITIAL CHECK =====
  useEffect(() => {
    const checkRegistration = async () => {
      if (datingProfile) {
        setCheckingProfile(false);
        return;
      }
      try {
        if (USE_MOCK_DATA) {
          // Имитируем отсутствие профиля для теста
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

  // ===== 2. LOAD DATA (ГРУЗИМ ДАЖЕ ДЛЯ ГОСТЯ!) =====
  const loadProfiles = async (reset = false) => {
    if (isLoadingRef.current) return;
    try {
      isLoadingRef.current = true;
      if (reset) {
        setLoading(true);
        offset.current = 0;
      }
      
      let profiles = [];
      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 600)); 
        profiles = reset ? MOCK_PROFILES : []; 
      } else {
        // API должно уметь отдавать профили даже гостям (или используем мок)
        profiles = await getDatingFeed(10, offset.current);
      }

      if (profiles.length === 0) {
        if (reset) setCurrentProfile(null);
      } else if (reset || !currentProfile) {
        setCurrentProfile(profiles[0]);
        if (profiles.length > 1) addProfilesToQueue(profiles.slice(1));
        offset.current += profiles.length;
      } else {
        addProfilesToQueue(profiles);
        offset.current += profiles.length;
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const loadLikes = async () => {
    if (isGuestMode) return; // Гостям лайки не грузим
    setLoadingLikes(true);
    try {
      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 500));
        setWhoLikedMe(MOCK_LIKES);
      } else {
        const users = await getWhoLikedMe(20, 0);
        setWhoLikedMe(users);
      }
    } catch (error) { console.error(error); } finally { setLoadingLikes(false); }
  };

  // Запуск загрузки (теперь не зависит от datingProfile!)
  useEffect(() => {
    if (!checkingProfile) {
      loadProfiles(true);
      if (!isGuestMode) {
        if (USE_MOCK_DATA) updateDatingStats({ likes_count: MOCK_LIKES.length });
        else getDatingStats().then(updateDatingStats).catch(console.error);
      }
    }
  }, [checkingProfile]); // Запускаем как только проверили статус

  useEffect(() => {
    if (activeTab === 'likes' && !isGuestMode) loadLikes();
  }, [activeTab]);

  // ===== HANDLERS =====
  const haptic = (type) => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);

  // 🚀 ГЛАВНЫЙ ТРИГГЕР ОНБОРДИНГА
  const triggerOnboarding = () => {
    haptic('medium');
    setShowOnboarding(true);
  };

  const handleTabSwitch = (tab) => {
    if (isGuestMode && tab === 'likes') {
      // Если гость тыкает на "Симпатии" -> сразу в регистрацию
      triggerOnboarding();
      return;
    }
    if (activeTab !== tab) {
      haptic('medium');
      setActiveTab(tab);
      setViewingProfile(null);
    }
  };

  const handleSkip = () => {
    // Гость МОЖЕТ свайпать влево (смотреть следующего), 
    // но давай для агрессивности тоже покажем онбординг?
    // Или дадим посмотреть пару анкет?
    // Решение: Свайп влево (Крестик) работает (пусть смотрят), но свайп вправо (Лайк) триггерит.
    
    if (isAnimating) return;
    haptic('light');
    setSwipeDirection('left');
    setIsAnimating(true);
    setTimeout(() => {
      removeCurrentProfile();
      setIsAnimating(false);
      setSwipeDirection(null);
    }, 400);
  };

  const handleLike = async (profileId = null) => {
    // 🔒 ЕСЛИ ГОСТЬ -> ОНБОРДИНГ
    if (isGuestMode) {
      triggerOnboarding();
      return;
    }

    const targetId = profileId || currentProfile?.id;
    if (!targetId || (isAnimating && !profileId)) return;

    haptic('medium');
    if (!profileId) {
      setSwipeDirection('right');
      setIsAnimating(true);
    }

    try {
      let isMatch = false;
      let matchedUser = null;

      if (USE_MOCK_DATA) {
        await new Promise(r => setTimeout(r, 300));
        isMatch = Math.random() < 0.3;
        matchedUser = profileId ? whoLikedMe.find(u => u.id === profileId) : currentProfile;
      } else {
        const res = await likeUser(targetId);
        isMatch = res.is_match;
        matchedUser = res.matched_user;
      }

      if (!profileId) {
        setTimeout(() => {
          removeCurrentProfile();
          setIsAnimating(false);
          setSwipeDirection(null);
          if (isMatch) handleMatch(matchedUser);
        }, 400);
      } else {
        setWhoLikedMe(prev => prev.filter(u => u.id !== targetId));
        setViewingProfile(null);
        if (isMatch) handleMatch(matchedUser);
      }
    } catch (e) { console.error(e); if (!profileId) setIsAnimating(false); }
  };

  const handleMatch = (user) => {
    if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    setShowMatchModal(true, user);
  };

  // ===== RENDER =====

  // 1. Пока проверяем - спиннер
  if (checkingProfile) {
    return <div style={styles.centerContainer}><div style={styles.spinner}></div></div>;
  }

  // 2. Если нажали "Зарегистрироваться" -> Показываем ОНБОРДИНГ
  if (showOnboarding && isGuestMode) {
    return <DatingOnboarding />;
  }

  // 3. ОСНОВНОЙ ИНТЕРФЕЙС (Для гостей и юзеров)
  return (
    <div style={styles.container}>
      
      {!viewingProfile && (
        <AppHeader title="Знакомства">
          <div style={styles.tabsWrapper}>
            <div style={styles.tabsContainer}>
              <div 
                style={{
                  ...styles.activeIndicator,
                  transform: `translateX(${activeTab === 'profiles' ? '0%' : '100%'})`,
                }} 
              />
              <button onClick={() => handleTabSwitch('profiles')} style={{...styles.tabButton, color: activeTab === 'profiles' ? '#fff' : theme.colors.textSecondary}}>
                Анкеты
              </button>
              <button onClick={() => handleTabSwitch('likes')} style={{...styles.tabButton, color: activeTab === 'likes' ? '#fff' : theme.colors.textSecondary}}>
                Симпатии {likesCount > 0 && <span style={styles.badge}>{likesCount}</span>}
              </button>
            </div>
          </div>
        </AppHeader>
      )}

      <div style={styles.content}>
        
        {/* === TAB 1: ЛЕНТА === */}
        {activeTab === 'profiles' && !viewingProfile && (
          <>
            <div style={styles.cardWrapper}>
              {loading ? <ProfileCardSkeleton /> : currentProfile ? (
                <ProfileCard
                  profile={currentProfile}
                  onSkip={handleSkip}
                  onAction={handleLike}
                  isAnimating={isAnimating}
                  swipeDirection={swipeDirection}
                  // ✨ ГЛАВНАЯ МАГИЯ: БЛЮР ЕСЛИ ГОСТЬ
                  isBlurred={isGuestMode} 
                  onRegisterTrigger={triggerOnboarding}
                />
              ) : (
                <div style={styles.emptyState}>
                  <div style={styles.emptyEmoji}>😴</div>
                  <div style={styles.emptyTitle}>Анкеты закончились</div>
                </div>
              )}
            </div>

            {currentProfile && !loading && (
              <div style={styles.actionsContainer}>
                {/* Крестик работает (можно скипать) */}
                <button onClick={handleSkip} style={styles.actionButtonSkip} disabled={isAnimating}>
                  <X size={32} strokeWidth={2.5} />
                </button>
                {/* Лайк ТРИГГЕРИТ регистрацию */}
                <button onClick={() => handleLike(null)} style={styles.actionButtonLike} disabled={isAnimating}>
                  <Heart size={30} fill="white" stroke="none" />
                </button>
              </div>
            )}
          </>
        )}

        {/* === TAB 2: ЛАЙКИ (Скрыт для гостей логикой switchTab) === */}
        {activeTab === 'likes' && !viewingProfile && (
          <div style={styles.likesList}>
            {loadingLikes ? <div style={styles.loader}>Загрузка...</div> : whoLikedMe.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyEmoji}>💔</div>
                <div style={styles.emptyTitle}>Пока пусто</div>
              </div>
            ) : (
              whoLikedMe.map((user, idx) => (
                <div 
                  key={user.id} 
                  style={{...styles.likeCard, animationDelay: `${idx * 0.05}s`}} 
                  onClick={() => { haptic('light'); setViewingProfile(user); }}
                >
                  <div style={styles.likeCardAvatar}>
                    {user.avatar ? <img src={user.avatar} style={styles.avatarImg} alt="" /> : <div style={styles.avatarPlaceholder}>{user.name[0]}</div>}
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

        {/* === VIEWING PROFILE === */}
        {viewingProfile && (
          <div style={styles.fullProfileContainer}>
            <div style={styles.overlayHeader}>
              <button onClick={() => setViewingProfile(null)} style={styles.backButton}>
                <ChevronLeft size={24} /> Назад
              </button>
            </div>
            <div style={styles.cardWrapper}>
              <ProfileCard profile={viewingProfile} />
            </div>
            <div style={styles.actionsContainer}>
              <button onClick={() => {haptic('light'); setViewingProfile(null);}} style={styles.actionButtonSkip}><X size={32} /></button>
              <button onClick={() => handleLike(viewingProfile.id)} style={styles.actionButtonLike}><Heart size={30} fill="white" /></button>
            </div>
          </div>
        )}

      </div>
      {showMatchModal && <MatchModal />}
    </div>
  );
}

// ===== STYLES =====
const styles = {
  container: { flex: 1, backgroundColor: theme.colors.bg, minHeight: '100vh' },
  centerContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  spinner: { width: 40, height: 40, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#f5576c', animation: 'spin 1s linear infinite' },
  
  tabsWrapper: { padding: '0 12px 12px 12px' },
  tabsContainer: { position: 'relative', display: 'flex', backgroundColor: theme.colors.bg, borderRadius: theme.radius.lg, padding: '4px', height: 44, border: `1px solid ${theme.colors.border}` },
  activeIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc(50% - 4px)', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', borderRadius: theme.radius.md, boxShadow: '0 2px 8px rgba(245, 87, 108, 0.4)', transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', zIndex: 1 },
  tabButton: { flex: 1, position: 'relative', zIndex: 2, background: 'transparent', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'color 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  badge: { backgroundColor: '#fff', color: '#f5576c', fontSize: 11, fontWeight: 800, padding: '1px 6px', borderRadius: 10, minWidth: 18 },

  content: { display: 'flex', flexDirection: 'column', height: '100%', paddingTop: 'calc(var(--header-padding, 104px) + 16px)', transition: 'padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
  cardWrapper: { flex: 1, padding: '0 12px 160px 12px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' },
  
  actionsContainer: { position: 'fixed', bottom: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 24, zIndex: 20, pointerEvents: 'none' },
  actionButtonSkip: { width: 64, height: 64, borderRadius: '50%', border: 'none', background: theme.colors.card, color: theme.colors.error, boxShadow: theme.shadows.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.1s' },
  actionButtonLike: { width: 64, height: 64, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: '#fff', boxShadow: '0 4px 20px rgba(245, 87, 108, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto', transition: 'transform 0.1s' },

  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: 700, color: theme.colors.text, marginBottom: 8 },
  
  likesList: { padding: '0 12px 100px', display: 'flex', flexDirection: 'column', gap: 12 },
  likeCard: { display: 'flex', alignItems: 'center', gap: 12, background: theme.colors.card, padding: 12, borderRadius: 16, animation: 'fadeInUp 0.3s ease forwards', opacity: 0, cursor: 'pointer' },
  likeCardAvatar: { flexShrink: 0 },
  avatarImg: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 },
  likeCardInfo: { flex: 1, minWidth: 0 },
  likeCardName: { fontSize: 16, fontWeight: 700, color: theme.colors.text, marginBottom: 2 },
  likeCardUni: { fontSize: 13, color: theme.colors.textSecondary },
  loader: { textAlign: 'center', padding: 20, color: theme.colors.textSecondary },

  fullProfileContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: theme.colors.bg, zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.3s ease' },
  overlayHeader: { padding: '12px', height: 56, display: 'flex', alignItems: 'center' },
  backButton: { display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: theme.colors.text, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(styleSheet);

export default DatingFeed;