import React, { useEffect, useState, useRef } from 'react';
import { Heart, Settings } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingFeed, getPeopleWithRequests, likeUser, getDatingStats } from '../../api';
import ModeSelector from './ModeSelector';
import ProfileCard from './ProfileCard';
import LikesListModal from './LikesListModal';
import MatchModal from './MatchModal';
import ResponseModal from './ResponseModal';
import ProfileCardSkeleton from './ProfileCardSkeleton';

// ===== 🎭 MOCK DATA ДЛЯ РАЗРАБОТКИ =====
const USE_MOCK_DATA = true; // ← Поставь false когда backend заработает

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

const MOCK_STUDY_PROFILES = [
  {
    id: 1,
    telegram_id: 111111,
    name: 'Алексей',
    age: 22,
    bio: 'Футбол и программирование ⚽',
    university: 'МГУ',
    institute: 'МСА',
    course: 2,
    interests: ['python', 'react'],
    active_request: {
      id: 101,
      title: 'Помощь с React Hooks',
      body: 'Не могу разобраться с useEffect и useCallback. Кто может объяснить простым языком?',
      category: 'study',
      tags: ['react', 'hooks', 'javascript'],
      likes: 5,
      views: 23
    }
  },
  {
    id: 2,
    telegram_id: 333333,
    name: 'Иван',
    age: 23,
    bio: 'Machine Learning энтузиаст 🤖',
    university: 'МГУ',
    institute: 'ФизТех',
    course: 2,
    interests: ['ML', 'python'],
    active_request: {
      id: 102,
      title: 'Подготовка к LeetCode',
      body: 'Готовлюсь к собеседованиям в FAANG. Ищу напарника для мотивации!',
      category: 'study',
      tags: ['leetcode', 'python', 'algorithms'],
      likes: 12,
      views: 45
    }
  },
  {
    id: 3,
    telegram_id: 666666,
    name: 'Елена',
    age: 22,
    bio: 'Аниме и разработка игр 🎮',
    university: 'МГУ',
    institute: 'ФизТех',
    course: 3,
    interests: ['gamedev', 'python'],
    active_request: {
      id: 103,
      title: 'Курсовая по ML',
      body: 'Делаю проект по распознаванию образов. Нужен сокомандник!',
      category: 'study',
      tags: ['ML', 'python', 'нейросети'],
      likes: 8,
      views: 34
    }
  }
];

const MOCK_HELP_PROFILES = [
  {
    id: 2,
    telegram_id: 222222,
    name: 'Мария',
    age: 21,
    bio: 'Дизайн и фотография 📸',
    university: 'МГУ',
    institute: 'МСА',
    course: 3,
    interests: ['design', 'фото'],
    active_request: {
      id: 201,
      title: 'Дизайн для проекта',
      body: 'Сделаю дизайн для вашего проекта БЕСПЛАТНО (для портфолио). UI/UX, лендинги.',
      category: 'help',
      tags: ['дизайн', 'UI/UX', 'бесплатно'],
      likes: 15,
      views: 67
    }
  },
  {
    id: 4,
    telegram_id: 999991,
    name: 'Дмитрий',
    age: 22,
    bio: 'React разработчик ⚛️',
    university: 'МГУ',
    institute: 'МСА',
    course: 3,
    interests: ['react', 'frontend'],
    active_request: {
      id: 202,
      title: 'Репетитор по программированию',
      body: 'Python/JS/React. Помогу разобраться с курсовыми и учебными проектами.',
      category: 'help',
      tags: ['python', 'react', 'репетитор'],
      likes: 9,
      views: 38
    }
  }
];

const MOCK_HANGOUT_PROFILES = [
  {
    id: 1,
    telegram_id: 111111,
    name: 'Алексей',
    age: 22,
    bio: 'Футбол и программирование ⚽',
    university: 'МГУ',
    institute: 'МСА',
    course: 2,
    interests: ['футбол', 'спорт'],
    active_request: {
      id: 301,
      title: 'Футбол в воскресенье',
      body: 'Собираем команду на стадион МГУ. Нужно 4 человека! Уровень любой.',
      category: 'hangout',
      tags: ['футбол', 'спорт'],
      likes: 18,
      views: 89
    }
  },
  {
    id: 7,
    telegram_id: 777777,
    name: 'Максим',
    age: 21,
    bio: 'Рок-музыкант и программист 🎸',
    university: 'МГУ',
    institute: 'МСА',
    course: 2,
    interests: ['music', 'rock'],
    active_request: {
      id: 302,
      title: 'Настолки: Манчкин',
      body: 'Играем в Манчкин сегодня вечером в общаге. Приходите, весело!',
      category: 'hangout',
      tags: ['настолки', 'игры'],
      likes: 7,
      views: 42
    }
  },
  {
    id: 8,
    telegram_id: 888888,
    name: 'София',
    age: 23,
    bio: 'Стартапер и бизнес-леди 💼',
    university: 'МГУ',
    institute: 'ФизТех',
    course: 4,
    interests: ['startup', 'бизнес'],
    active_request: {
      id: 303,
      title: 'Стартап митап',
      body: 'Обсуждаем бизнес-идеи и ищем сооснователей. Zoom встреча в пятницу.',
      category: 'hangout',
      tags: ['стартап', 'бизнес'],
      likes: 24,
      views: 102
    }
  }
];

const MOCK_STATS = {
  likes_count: 3,
  matches_count: 1,
  responses_count: 2
};

function DatingFeed() {
  const {
    datingMode,
    currentProfile,
    profilesQueue,
    setCurrentProfile,
    addProfilesToQueue,
    removeCurrentProfile,
    clearProfilesQueue,
    likesCount,
    responsesCount,
    updateDatingStats,
    setShowLikesModal,
    setShowMatchModal,
    setShowResponseModal,
    showLikesModal,
    showMatchModal,
    showResponseModal,
  } = useStore();

  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const isLoadingRef = useRef(false);
  const offset = useRef(0);

  // Загрузка профилей
  const loadProfiles = async (reset = false) => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);

      if (reset) {
        offset.current = 0;
      }

      let profiles = [];

      // ===== 🎭 МОК РЕЖИМ =====
      if (USE_MOCK_DATA) {
        console.log('🎭 Используем MOCK данные');
        
        // Задержка для имитации загрузки
        await new Promise(resolve => setTimeout(resolve, 500));

        // Выбираем моки в зависимости от режима
        if (datingMode === 'dating') {
          console.log('🎭 Загружаем MOCK_DATING_PROFILES:', MOCK_DATING_PROFILES);
          profiles = MOCK_DATING_PROFILES;
        } else if (datingMode === 'study') {
          profiles = MOCK_STUDY_PROFILES;
        } else if (datingMode === 'help') {
          profiles = MOCK_HELP_PROFILES;
        } else if (datingMode === 'hangout') {
          profiles = MOCK_HANGOUT_PROFILES;
        }

        setHasMore(false); // Моковые данные статичны
      } 
      // ===== 🌐 РЕАЛЬНЫЙ API =====
      else {
        if (datingMode === 'dating') {
          profiles = await getDatingFeed(10, offset.current);
        } else {
          const response = await getPeopleWithRequests(datingMode, 10, offset.current);
          profiles = response.items || [];
          setHasMore(response.has_more);
        }
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

  // Загрузка статистики
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

  // При монтировании и смене режима
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
  }, [datingMode]);

  // Prefetch когда очередь мала
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

  // Обработка Skip
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

  // Обработка Action
  const handleAction = async () => {
    if (!currentProfile || isAnimating) return;

    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    if (datingMode === 'dating') {
      try {
        setSwipeDirection('right');
        setIsAnimating(true);

        // ===== 🎭 МОК РЕЖИМ =====
        if (USE_MOCK_DATA) {
          console.log('🎭 Моковый лайк:', currentProfile.name);
          
          // Имитация задержки API
          await new Promise(resolve => setTimeout(resolve, 300));

          // Случайный матч (20% шанс)
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
        } 
        // ===== 🌐 РЕАЛЬНЫЙ API =====
        else {
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
    } else {
      setShowResponseModal(true);
    }
  };

  // Рендер Header (унифицированный)
  const renderHeader = () => (
    <div style={styles.header}>
      <button onClick={() => setShowLikesModal(true)} style={styles.headerButton}>
        {datingMode === 'dating' ? (
          <>
            <Heart size={20} />
            {likesCount > 0 && <span style={styles.badge}>{likesCount}</span>}
          </>
        ) : (
          <>
            <span style={{ fontSize: '20px' }}>📬</span>
            {responsesCount > 0 && <span style={styles.badge}>{responsesCount}</span>}
          </>
        )}
      </button>
      <ModeSelector />
      <button style={styles.headerButton} onClick={() => console.log('Открыть фильтры')}>
        <Settings size={20} />
      </button>
    </div>
  );

  // Loading state
  if (loading && !currentProfile) {
    return (
      <div style={styles.container}>
        {renderHeader()}
        <div style={styles.cardContainer}>
          <ProfileCardSkeleton mode={datingMode} />
        </div>
      </div>
    );
  }

  // Empty state
  if (!currentProfile && !hasMore) {
    return (
      <div style={styles.container}>
        {renderHeader()}
        <div style={styles.content}>
          <div style={styles.emptyState}>
            <div style={styles.emptyEmoji}>😴</div>
            <div style={styles.emptyTitle}>
              {datingMode === 'dating' ? 'Ты посмотрел всех' : 'Нет запросов'}
            </div>
            <div style={styles.emptySubtitle}>Заходи позже!</div>
          </div>
        </div>
      </div>
    );
  }

  // Normal state
  return (
    <div style={styles.container}>
      {renderHeader()}

      <div style={styles.cardContainer}>
        {currentProfile && (
          <ProfileCard
            profile={currentProfile}
            mode={datingMode}
            onSkip={handleSkip}
            onAction={handleAction}
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
          onClick={handleAction}
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
          <span style={styles.actionIcon}>{datingMode === 'dating' ? '💜' : '📝'}</span>
        </button>
      </div>

      {showLikesModal && <LikesListModal />}
      {showMatchModal && <MatchModal />}
      {showResponseModal && <ResponseModal profile={currentProfile} />}
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    backgroundColor: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: '64px',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #1a1a1a',
    backgroundColor: '#0a0a0a',
    flexShrink: 0,
  },
  headerButton: {
    position: 'relative',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#1a1a1a',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  badge: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 'bold',
    padding: '2px 6px',
    borderRadius: '12px',
    minWidth: '20px',
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    padding: '12px 16px',
    position: 'relative',
    overflow: 'hidden',
  },
  actionsContainer: {
    position: 'fixed',
    bottom: '80px',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    padding: '0 16px',
    zIndex: 5,
  },
  actionButton: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    opacity: 0.95,
    transition: 'opacity 0.2s, transform 0.2s',
  },
  actionIcon: {
    fontSize: '32px',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  emptyState: {
    textAlign: 'center',
    padding: '32px',
  },
  emptyEmoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: '14px',
  },
};

export default DatingFeed;