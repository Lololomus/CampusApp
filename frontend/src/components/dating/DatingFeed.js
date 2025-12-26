import React, { useEffect, useState, useRef } from 'react';
import { Heart, Settings } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, getDatingStats } from '../../api';
import ProfileCard from './ProfileCard';
import LikesListModal from './LikesListModal';
import MatchModal from './MatchModal';
import ProfileCardSkeleton from './ProfileCardSkeleton';
import theme from '../../theme';


// ===== 🎭 MOCK DATA ДЛЯ РАЗРАБОТКИ =====
const USE_MOCK_DATA = true;


const MOCK_DATING_PROFILES = [
  {
    id: 1,
    telegram_id: 111111,
    name: 'Алексей',
    age: 22,
    bio: 'Футбол и программирование ⚽ Ищу компанию для хакатонов',
    avatar: null,
    university: 'МГУ',
    institute: 'МСА',
    course: 2,
    group: 'ПИ-21',
    interests: ['python', 'футбол', 'музыка']
  },
  {
    id: 2,
    telegram_id: 222222,
    name: 'Мария',
    age: 21,
    bio: 'Дизайн и фотография 📸 Люблю создавать красоту',
    avatar: null,
    university: 'МГУ',
    institute: 'МСА',
    course: 3,
    group: 'ДИ-31',
    interests: ['design', 'фото', 'кофе']
  },
  {
    id: 3,
    telegram_id: 333333,
    name: 'Иван',
    age: 23,
    bio: 'Machine Learning энтузиаст 🤖 Готовлюсь к PhD',
    avatar: null,
    university: 'МГУ',
    institute: 'ФизТех',
    course: 2,
    group: 'ИВТ-21',
    interests: ['python', 'ML', 'AI']
  },
  {
    id: 4,
    telegram_id: 444444,
    name: 'Анна',
    age: 20,
    bio: 'Музыка и танцы 💃 Выступаю в студенческой команде',
    avatar: null,
    university: 'МГУ',
    institute: 'ФизТех',
    course: 1,
    group: 'ИБ-11',
    interests: ['музыка', 'танцы', 'travel']
  },
  {
    id: 5,
    telegram_id: 555555,
    name: 'Пётр',
    age: 24,
    bio: 'Спорт и саморазвитие 📚 Марафонец и книголюб',
    avatar: null,
    university: 'МГУ',
    institute: 'МСА',
    course: 4,
    group: 'ПИ-41',
    interests: ['спорт', 'книги', 'бег']
  },
  {
    id: 6,
    telegram_id: 666666,
    name: 'Елена',
    age: 22,
    bio: 'Аниме и разработка игр 🎮 Делаю инди-игру в Unity',
    avatar: null,
    university: 'МГУ',
    institute: 'ФизТех',
    course: 3,
    group: 'ПИ-31',
    interests: ['anime', 'python', 'gamedev']
  },
  {
    id: 7,
    telegram_id: 777777,
    name: 'Максим',
    age: 21,
    bio: 'Рок-музыкант и программист 🎸 Играю в группе по выходным',
    avatar: null,
    university: 'МГУ',
    institute: 'МСА',
    course: 2,
    group: 'ИС-21',
    interests: ['guitar', 'rock', 'coding']
  },
  {
    id: 8,
    telegram_id: 888888,
    name: 'София',
    age: 23,
    bio: 'Стартапер и бизнес-леди 💼 Запускаю 3-й проект',
    avatar: null,
    university: 'МГУ',
    institute: 'ФизТех',
    course: 4,
    group: 'ИВТ-41',
    interests: ['startup', 'бизнес', 'кофе']
  }
];


const MOCK_STATS = {
  likes_count: 3,
  matches_count: 1
};


function DatingFeed() {
  const {
    currentProfile,
    profilesQueue,
    setCurrentProfile,
    addProfilesToQueue,
    removeCurrentProfile,
    clearProfilesQueue,
    likesCount,
    updateDatingStats,
    setShowLikesModal,
    setShowMatchModal,
    showLikesModal,
    showMatchModal,
  } = useStore();


  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const isLoadingRef = useRef(false);
  const offset = useRef(0);


  const loadProfiles = async (reset = false) => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);

      if (reset) {
        offset.current = 0;
      }

      let profiles = [];

      if (USE_MOCK_DATA) {
        console.log('🎭 Используем MOCK данные');
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('🎭 Загружаем MOCK_DATING_PROFILES:', MOCK_DATING_PROFILES);
        profiles = MOCK_DATING_PROFILES;
        setHasMore(false);
      } else {
        profiles = await getDatingFeed(10, offset.current);
      }

      console.log('✅ Загружено профилей:', profiles.length);

      if (profiles.length === 0) {
        setCurrentProfile(null);
        setHasMore(false);
      } else if (reset || !currentProfile) {
        setCurrentProfile(profiles[0]);
        if (profiles.length > 1) {
          addProfilesToQueue(profiles.slice(1));
        } else {
          setHasMore(false);
        }
        offset.current += profiles.length;
      } else {
        addProfilesToQueue(profiles);
        offset.current += profiles.length;
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки профилей:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };


  const loadStats = async () => {
    try {
      if (USE_MOCK_DATA) {
        console.log('🎭 Используем MOCK статистику');
        updateDatingStats(MOCK_STATS);
        return;
      }

      const stats = await getDatingStats();
      updateDatingStats(stats);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  };


  useEffect(() => {
    clearProfilesQueue();
    setCurrentProfile(null);
    setHasMore(true);
    offset.current = 0;
    loadProfiles(true);
    loadStats();

    return () => {
      isLoadingRef.current = false;
    };
  }, []);


  useEffect(() => {
    if (
      profilesQueue.length < 3 &&
      hasMore &&
      !loading &&
      !isLoadingRef.current &&
      currentProfile
    ) {
      console.log('📦 Prefetch...');
      loadProfiles();
    }
  }, [profilesQueue.length]);


  const handleSkip = () => {
    if (isAnimating) return;

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }

    setSwipeDirection('left');
    setIsAnimating(true);

    setTimeout(() => {
      removeCurrentProfile();
      setIsAnimating(false);
      setSwipeDirection(null);
    }, 400);
  };


  const handleLike = async () => {
    if (!currentProfile || isAnimating) return;

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    try {
      setSwipeDirection('right');
      setIsAnimating(true);

      if (USE_MOCK_DATA) {
        console.log('🎭 Моковый лайк:', currentProfile.name);
        await new Promise(resolve => setTimeout(resolve, 300));
        const isMatch = Math.random() < 0.2;

        setTimeout(() => {
          removeCurrentProfile();
          setIsAnimating(false);
          setSwipeDirection(null);

          if (isMatch) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            setShowMatchModal(true, currentProfile);
          }
        }, 400);
      } else {
        const result = await likeUser(currentProfile.id);

        setTimeout(() => {
          removeCurrentProfile();
          setIsAnimating(false);
          setSwipeDirection(null);

          if (result.is_match) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
              window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            setShowMatchModal(true, result.matched_user);
          }
        }, 400);
      }
    } catch (error) {
      console.error('Ошибка лайка:', error);
      setIsAnimating(false);
      setSwipeDirection(null);
    }
  };


  const renderHeader = () => (
    <div style={styles.header}>
      <button onClick={() => setShowLikesModal(true)} style={styles.headerButton}>
        <Heart size={20} />
        {likesCount > 0 && <span style={styles.badge}>{likesCount}</span>}
      </button>
      <h1 style={styles.headerTitle}>Знакомства</h1>
      <button style={styles.headerButton} onClick={() => console.log('Открыть фильтры')}>
        <Settings size={20} />
      </button>
    </div>
  );


  if (loading && !currentProfile) {
    return (
      <div style={styles.container}>
        {renderHeader()}
        <div style={styles.cardContainer}>
          <ProfileCardSkeleton />
        </div>
      </div>
    );
  }


  if (!currentProfile && !hasMore) {
    return (
      <div style={styles.container}>
        {renderHeader()}
        <div style={styles.content}>
          <div style={styles.emptyState}>
            <div style={styles.emptyEmoji}>😴</div>
            <div style={styles.emptyTitle}>Ты посмотрел всех</div>
            <div style={styles.emptySubtitle}>Заходи позже!</div>
          </div>
        </div>
      </div>
    );
  }


  return (
    <div style={styles.container}>
      {renderHeader()}

      <div style={styles.cardContainer}>
        {currentProfile && (
          <ProfileCard
            profile={currentProfile}
            onSkip={handleSkip}
            onAction={handleLike}
            isAnimating={isAnimating}
            swipeDirection={swipeDirection}
          />
        )}
      </div>

      <div style={styles.actionsContainer}>
        <button
          onClick={handleSkip}
          style={{
            ...styles.actionButton,
            background: `linear-gradient(135deg, ${theme.colors.gradientStart} 0%, ${theme.colors.gradientEnd} 100%)`,
          }}
          disabled={isAnimating}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.95';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={styles.actionIcon}>✕</span>
        </button>
        <button
          onClick={handleLike}
          style={{
            ...styles.actionButton,
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          }}
          disabled={isAnimating}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.95';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={styles.actionIcon}>💜</span>
        </button>
      </div>

      {showLikesModal && <LikesListModal />}
      {showMatchModal && <MatchModal />}
    </div>
  );
}


const styles = {
  container: {
    height: '100vh',
    backgroundColor: theme.colors.bg,
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 64,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    borderBottom: `1px solid ${theme.colors.bgSecondary}`,
    backgroundColor: theme.colors.bg,
    flexShrink: 0,
  },
  headerButton: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.bgSecondary,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    margin: 0,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.primary,
    color: theme.colors.text,
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    padding: `2px 6px`,
    borderRadius: theme.radius.md,
    minWidth: 20,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    position: 'relative',
    overflow: 'hidden',
  },
  actionsContainer: {
    position: 'fixed',
    bottom: 80,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: theme.spacing.xxl,
    padding: `0 ${theme.spacing.lg}px`,
    zIndex: 5,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: theme.radius.full,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: theme.shadows.lg,
    opacity: 0.95,
    transition: theme.transitions.normal,
  },
  actionIcon: {
    fontSize: 32,
    fontWeight: theme.fontWeight.bold,
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.base,
  },
};


export default DatingFeed;