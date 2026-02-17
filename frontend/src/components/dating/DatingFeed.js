import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingFeed, likeUser, dislikeUser, getDatingStats, getWhoLikedMe, getMyDatingProfile, getMyMatches } from '../../api';
import AppHeader from '../shared/AppHeader';
import ProfileCard from './ProfileCard';
import MatchModal from './MatchModal';
import { FeedCardSkeleton, FeedInfoBarSkeleton } from './DatingSkeletons';
import DatingOnboarding from './DatingOnboarding';
import MyDatingProfileModal from './MyDatingProfileModal';
import EditDatingProfileModal from './EditDatingProfileModal';
import PhotoViewer from '../shared/PhotoViewer';
import LikesTab from './LikesTab';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import ProfileInfoBar from './ProfileInfoBar';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import { toast } from '../shared/Toast';

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

const INTEREST_EMOJIS = {
  it: '💻',
  games: '🎮',
  books: '📚',
  music: '🎵',
  movies: '🎬',
  sport: '⚽',
  art: '🎨',
  travel: '🌍',
  coffee: '☕',
  party: '🎉',
  photo: '📸',
  food: '🍕',
  science: '🎓',
  startup: '🚀',
  fitness: '🏋️',
};

const USE_MOCK_DATA = process.env.NODE_ENV === 'development' || process.env.REACT_APP_USE_MOCK === 'true';

// 🎨 Генераторы SVG placeholder'ов для разных профилей
const createAvatar = (letter, gradient1, gradient2, size = 400) => {
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size * 1.2}'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:${gradient1};stop-opacity:1' /%3E%3Cstop offset='100%25' style='stop-color:${gradient2};stop-opacity:1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grad)'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial,sans-serif' font-size='${size * 0.35}' font-weight='bold' fill='white' text-anchor='middle' dy='.35em'%3E${letter}%3C/text%3E%3C/svg%3E`;
};

const MOCK_PROFILES = [
  { 
    id: 1, 
    name: 'Алексей', 
    age: 22, 
    bio: 'Люблю кодить по ночам, пить кофе литрами и участвовать в хакатонах.',
    university: 'МГУ', 
    institute: 'ВМК', 
    course: 3,
    interests: ['it', 'games', 'coffee', 'startup', 'music'],
    goals: ['relationship', 'study'],
    prompts: {
      question: 'Идеальное свидание?',
      answer: 'Ночной хакатон с пиццей и Red Bull, потом встретить рассвет на крыше 🌅'
    },
    photos: [
      { url: createAvatar('А', '%23667eea', '%23764ba2') }, // Синий → Фиолетовый
      { url: createAvatar('А', '%235e72e4', '%238e54e9') }  // Вариант 2
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
    prompts: {
      question: 'Что не могу пропустить?',
      answer: 'Закат в красивом месте — всегда беру камеру и ловлю момент'
    },
    photos: [
      { url: createAvatar('М', '%23f093fb', '%23f5576c') }, // Розовый → Красный
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
    prompts: {
      question: 'Мой студенческий лайфхак',
      answer: 'Гитара на общаге = автоматически +100 к популярности'
    },
    photos: [
      { url: createAvatar('Д', '%234facfe', '%2300f2fe') }, // Голубой → Бирюзовый
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
    prompts: {
      question: 'После пар я...',
      answer: 'Сразу в зал! А потом протеиновый смузи и планы на вечер'
    },
    photos: [
      { url: createAvatar('С', '%2343e97b', '%2338f9d7') }, // Зелёный → Мятный
    ] 
  },
  { 
    id: 5, 
    name: 'Максим', 
    age: 24, 
    bio: 'Стартапер, работаю над AI проектом 🚀\n\nВсегда рад новым знакомствам и нетворкингу.',
    university: 'РЭУ', 
    institute: 'Экономический', 
    course: 5,
    interests: ['startup', 'it', 'coffee', 'books', 'travel'],
    goals: ['study', 'friends'],
    prompts: {
      question: 'Мечта на стажировку',
      answer: 'Google в Калифорнии или OpenAI — хочу быть там, где создаётся будущее'
    },
    photos: [
      { url: createAvatar('М', '%23fa709a', '%23fee140') }, // Розовый → Жёлтый
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
    bio: 'Люблю театры и литературу 🎭\n\nМечтаю стать журналистом и писать о культуре.',
    photos: [
      { url: createAvatar('А', '%23ff6b6b', '%23ee5a6f', 600) }, // Красный
      { url: createAvatar('А', '%23ff8787', '%23f06595', 600) }, // Вариант 2
      { url: createAvatar('А', '%23ff5e5e', '%23d946ef', 600) }, // Вариант 3
    ],
    interests: ['books', 'art', 'movies', 'coffee'],
    goals: ['friends', 'hangout'],
    prompts: {
      question: 'Какую последнюю книгу прочитал?',
      answer: 'Перечитываю Достоевского — каждый раз нахожу что-то новое 📖'
    },
  },
  {
    id: 102,
    name: 'Илья',
    age: 22,
    university: 'МФТИ',
    institute: 'ФРКТ',
    course: 4,
    bio: 'Физтех, люблю математику и шахматы ♟️\n\nРешаю олимпиадные задачи для души.',
    photos: [
      { url: createAvatar('И', '%235b21b6', '%237c3aed', 600) }, // Фиолетовый
      { url: createAvatar('И', '%236d28d9', '%238b5cf6', 600) }, // Вариант 2
    ],
    interests: ['science', 'books', 'games', 'coffee'],
    goals: ['study', 'friends'],
  },
  {
    id: 103,
    name: 'Катя',
    age: 20,
    university: 'ВШЭ',
    institute: 'Дизайн',
    course: 2,
    bio: 'UI/UX дизайнер и художник 🎨\n\nРисую акварелью и делаю крутые интерфейсы.',
    photos: [
      { url: createAvatar('К', '%2314b8a6', '%2306b6d4', 600) }, // Бирюзовый
      { url: createAvatar('К', '%2310b981', '%233b82f6', 600) }, // Зелёный → Синий
      { url: createAvatar('К', '%230891b2', '%235eead4', 600) }, // Вариант 3
    ],
    interests: ['art', 'photo', 'coffee', 'music', 'travel'],
    goals: ['friends', 'relationship'],
    prompts: {
      question: 'Figma или Adobe XD?',
      answer: 'Только Figma! Там все плагины которые нужны 🔥'
    },
  },
  {
    id: 104,
    name: 'Даниил',
    age: 23,
    university: 'МГТУ',
    institute: 'ИБ',
    course: 4,
    bio: 'Гитарист и меломан 🎸\n\nИграю в группе, пишу свою музыку.',
    photos: [
      { url: createAvatar('Д', '%231e3a8a', '%232563eb', 600) }, // Тёмно-синий
    ],
    interests: ['music', 'party', 'sport', 'coffee'],
    goals: ['friends', 'hangout'],
  },
  {
    id: 105,
    name: 'Полина',
    age: 21,
    university: 'МГСУ',
    institute: 'ИЦИТ',
    course: 3,
    bio: 'Спортсменка и фитнес-тренер 💪\n\nЗОЖ - мой образ жизни!',
    photos: [
      { url: createAvatar('П', '%23c026d3', '%23e879f9', 600) }, // Пурпурный
      { url: createAvatar('П', '%23a21caf', '%23f0abfc', 600) }, // Вариант 2
      { url: createAvatar('П', '%23be185d', '%23fb7185', 600) }, // Розовый
    ],
    interests: ['fitness', 'sport', 'food', 'travel', 'music'],
    goals: ['friends', 'relationship'],
    prompts: {
      question: 'Зал или пробежка утром?',
      answer: 'Зал всегда! Утренняя тренировка заряжает на весь день 💪'
    },
  },
  {
    id: 106,
    name: 'Артём',
    age: 24,
    university: 'РЭУ',
    institute: 'Экономический',
    course: 5,
    bio: 'Запускаю EdTech стартап 🚀\n\nВсегда рад новым знакомствам и идеям.',
    photos: [
      { url: createAvatar('А', '%23f97316', '%23fbbf24', 600) }, // Оранжевый → Жёлтый
      { url: createAvatar('А', '%23ea580c', '%23fb923c', 600) }, // Вариант 2
    ],
    interests: ['startup', 'it', 'coffee', 'books', 'travel'],
    goals: ['study', 'friends'],
  },
];


const MOCK_MATCHES = [
  {
    id: 201,
    user_id: 2,
    name: 'Анна',
    age: 19,
    bio: 'Люблю театры и литературу 🎭📚',
    university: 'МГУ',
    institute: 'Филологический',
    course: 1,
    photos: [
      { url: createAvatar('А', '%23ff6b6b', '%23ee5a6f', 600), w: 600, h: 720 }
    ],
    interests: ['books', 'art', 'coffee'],
    goals: ['friends', 'study'],
    prompts: {
      question: 'Моя суперспособность?',
      answer: 'Могу процитировать "Мастера и Маргариту" целиком 📖'
    },
    matched_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    hours_left: 2,
    minutes_left: 0,
  },
  {
    id: 202,
    user_id: 3,
    name: 'Илья',
    age: 22,
    bio: 'Физтех, люблю математику и шахматы ♟️',
    university: 'МФТИ',
    institute: 'ФПМИ',
    course: 4,
    photos: [
      { url: createAvatar('И', '%235b21b6', '%237c3aed', 600), w: 600, h: 720 }
    ],
    interests: ['science', 'games', 'coffee'],
    goals: ['study', 'friends'],
    prompts: {
      question: 'Идеальное свидание?',
      answer: 'Партия в шахматы в Парке Горького + кофе'
    },
    matched_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    hours_left: 18,
    minutes_left: 0,
  },
  {
    id: 203,
    user_id: 4,
    name: 'Катя',
    age: 20,
    bio: 'UI/UX дизайнер и художник 🎨',
    university: 'ВШЭ',
    institute: 'Дизайн',
    course: 2,
    photos: [
      { url: createAvatar('К', '%2314b8a6', '%2306b6d4', 600), w: 600, h: 720 }
    ],
    interests: ['art', 'photo', 'coffee', 'travel'],
    goals: ['friends', 'relationship'],
    prompts: {
      question: 'Figma или Adobe XD?',
      answer: 'Figma всегда! Collaborative design — это мощь 🔥'
    },
    matched_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    hours_left: 5,
    minutes_left: 0,
  },
];

function ViewingProfileModal({ profile, profileType, onClose, onLike, onMessage }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLiking, setIsLiking] = useState(false);

  const photos = profile?.photos || [];
  const hasPhotos = photos.length > 0;

  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const nextPhoto = () => {
    if (currentPhotoIndex < photos.length - 1) {
      hapticFeedback('light');
      setCurrentPhotoIndex(prev => prev + 1);
    }
  };

  const prevPhoto = () => {
    if (currentPhotoIndex > 0) {
      hapticFeedback('light');
      setCurrentPhotoIndex(prev => prev - 1);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleLikeClick = async () => {
    if (isLiking) return;
    
    setIsLiking(true);
    hapticFeedback('medium');
    
    try {
      if (onLike) {
        await onLike();
      }
    } finally {
      setIsLiking(false);
    }
  };

  const handleMessageClick = () => {
    hapticFeedback('medium');
    if (onMessage) {
      onMessage();
    }
  };

  const isMatchProfile = profileType === 'match';

  useTelegramScreen({
    id: `dating-likes-view-profile-${profileType || 'profile'}-${profile?.id || 'unknown'}`,
    title: isMatchProfile ? 'Взаимность' : 'Кто лайкнул',
    priority: 130,
    back: {
      visible: true,
      onClick: onClose,
    },
    main: {
      visible: true,
      text: isMatchProfile ? 'Написать сообщение' : 'Лайкнуть в ответ',
      onClick: isMatchProfile ? handleMessageClick : handleLikeClick,
      enabled: !isLiking,
      loading: !isMatchProfile && isLiking,
      color: theme.colors.dating.primary,
    },
  });

  return (
    <div style={styles.viewingOverlay}>
      <DrilldownHeader title={isMatchProfile ? 'Взаимность' : 'Кто лайкнул'} onBack={onClose} />

      {/* Content */}
      <div style={styles.viewingContent}>
        {/* Photo */}
        <div style={styles.viewingPhotoSection} onClick={() => setShowPhotoViewer(true)}>
          {hasPhotos ? (
            <>
              {photos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo?.url || photo}
                  alt={profile.name}
                  style={{
                    ...styles.viewingPhoto,
                    opacity: idx === currentPhotoIndex ? 1 : 0,
                    zIndex: idx === currentPhotoIndex ? 1 : 0,
                  }}
                />
              ))}
              {photos.length > 1 && (
                <div style={styles.photoIndicatorsViewing}>
                  {photos.map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        ...styles.indicatorViewing,
                        backgroundColor: idx === currentPhotoIndex ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.3)',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          ) : profile.avatar ? (
            <img src={profile.avatar} alt={profile.name} style={styles.viewingPhoto} />
          ) : (
            <div style={styles.viewingPhotoPlaceholder}>
              {profile.name?.charAt(0) || '?'}
            </div>
          )}
          
          {/* Навигация по фото */}
          {photos.length > 1 && (
            <>
              {currentPhotoIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevPhoto();
                  }}
                  style={{ ...styles.photoNavButton, left: 12 }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {currentPhotoIndex < photos.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextPhoto();
                  }}
                  style={{ ...styles.photoNavButton, right: 12 }}
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </>
          )}
        </div>

        {/* Info */}
        <div style={styles.viewingInfo}>
          <h2 style={styles.viewingName}>
            {profile.name}
            {profile.age && <span style={styles.viewingAge}>, {profile.age}</span>}
          </h2>

          {(profile.university || profile.institute || profile.course) && (
            <div style={styles.viewingUniversity}>
              <GraduationCap size={16} color={theme.colors.textSecondary} />
              <span>
                {profile.university}
                {profile.institute && ` • ${profile.institute}`}
                {profile.course && ` • ${profile.course} курс`}
              </span>
            </div>
          )}

          {/* Icebreaker / Prompts */}
          {(profile.icebreaker || (profile.prompts?.question && profile.prompts?.answer)) && (
            <div style={styles.viewingSection}>
              <div style={styles.viewingPromptCard}>
                <div style={styles.viewingPromptQuestion}>
                  {profile.prompts?.question || 'Ледокол'}
                </div>
                <div style={styles.viewingPromptAnswer}>
                  {profile.prompts?.answer || profile.icebreaker}
                </div>
              </div>
            </div>
          )}

          {/* Goals */}
          {profile.goals && profile.goals.length > 0 && (
            <div style={styles.viewingSection}>
              <div style={styles.viewingSectionTitle}>Цели</div>
              <div style={styles.viewingGoals}>
                {profile.goals.map((goal) => (
                  <span key={goal} style={styles.viewingGoalTag}>
                    {GOAL_ICONS[goal] || goal}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && (
            <div style={styles.viewingSection}>
              <div style={styles.viewingSectionTitle}>О себе</div>
              <p style={styles.viewingBio}>{profile.bio}</p>
            </div>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div style={styles.viewingSection}>
              <div style={styles.viewingSectionTitle}>Интересы</div>
              <div style={styles.viewingInterests}>
                {profile.interests.map((interest) => (
                  <span key={interest} style={styles.viewingInterestTag}>
                    {INTEREST_LABELS[interest] || interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PhotoViewer */}
      {showPhotoViewer && (
        <PhotoViewer
          photos={photos}
          initialIndex={currentPhotoIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </div>
  );
}

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
    if (fromMyProfile) {
      setShowMyProfile(false);
    }
    setShowEditProfile(true);
  }, []);

  const closeEditProfile = useCallback(() => {
    setShowEditProfile(false);
    if (returnToMyProfileOnEditClose) {
      setShowMyProfile(true);
    }
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
    if (currentProfile?.id) {
      setInfoExpanded(false);
    }
  }, [currentProfile?.id]);

  useEffect(() => {
    const checkRegistration = async () => {
      setCheckingProfile(true);
      
      try {
        if (USE_MOCK_DATA) {
          setCheckingProfile(false);
          return;
        }
        
        const profile = await getMyDatingProfile();
        
        if (profile) {
          setDatingProfile(profile);
        } else {
          setDatingProfile(null);
        }
      } catch (e) {
        console.log('Guest mode или ошибка:', e);
        setDatingProfile(null);
      } finally {
        setCheckingProfile(false);
      }
    };
    
    checkRegistration();
  }, []);

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
    } catch (error) { 
      console.error(error); 
    } finally { 
      setLoadingMatches(false); 
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

  const triggerOnboarding = () => {
    hapticFeedback('medium');
    setShowOnboarding(true);
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

  const handleLike = async (profileId = null, fallbackUser = null) => {
    const targetId = profileId || currentProfile?.id;

    if (isGuestMode) {
      hapticFeedback('medium');
      triggerOnboarding();
      return { is_match: false };
    }

    if (!targetId || (isAnimating && !profileId)) {
      return { is_match: false };
    }

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
        // В likes tab лайк в ответ должен всегда давать мэтч.
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

      if (isMatch && !matchedUser && fallbackUser) {
        matchedUser = fallbackUser;
      }

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

  if (checkingProfile) {
    return <div style={styles.centerContainer}><div style={styles.spinner}></div></div>;
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
        {activeTab === 'profiles' && !viewingProfile && (
          <>
            <div style={styles.cardWrapper}>
              {loading ? (
                <FeedCardSkeleton />
              ) : !currentProfile ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyEmoji}>😴</div>
                  <div style={styles.emptyTitle}>Анкеты закончились</div>
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
            {/* InfoBar */}
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
            onEmptyAction={() => {
              openEditProfile(false);
            }}
          />
        )}

        {activeTab === 'likes' && viewingProfile && (
          <ViewingProfileModal
            profile={viewingProfile.user}
            profileType={viewingProfile.type}
            onClose={() => {
              hapticFeedback('light');
              setViewingProfile(null);
            }}
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
          onEditClick={() => {
            openEditProfile(true);
          }}
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

// Dating feed STYLES
const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
    maxHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
  },
  centerContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '4px solid rgba(255,255,255,0.1)',
    borderTopColor: '#f5576c',
    animation: 'spin 1s linear infinite',
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
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    paddingTop: 'calc(var(--header-padding, 104px) + 16px)',
    paddingBottom: 0,
    overflow: 'hidden',
    maxHeight: '100vh',
  },
  cardWrapper: {
    position: 'relative',
    padding: '0 12px',
    minHeight: 400,
    height: 'calc(100vh - var(--info-bar-min-height) - var(--header-height) + 250px)',
    maxHeight: 'calc(100vh - var(--info-bar-min-height) - var(--header-height) + 250px)',
    marginTop: 'auto',
    marginBottom: 0,
    overflow: 'hidden',
  },
  swipeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    letterSpacing: 4,
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  infoBarSkeleton: {
    position: 'absolute',
    bottom: 65,
    left: 0,
    right: 0,
    background: 'linear-gradient(to top, rgba(10, 10, 10, 0.98) 0%, rgba(10, 10, 10, 0.95) 85%, transparent 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: '20px 20px 24px',
    zIndex: 30,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  collapsedView: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflow: 'hidden',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  goalsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.bg,
    zIndex: 1000,
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  viewingContent: {
    minHeight: '100vh',
    paddingBottom: 'var(--screen-bottom-offset)',
  },
  viewingPhotoSection: {
    position: 'relative',
    width: '100%',
    aspectRatio: '3 / 4',
    maxHeight: '70vh',
    cursor: 'pointer',
  },
  viewingPhoto: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease',
  },
  photoIndicatorsViewing: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    display: 'flex',
    gap: 6,
    zIndex: 3,
  },
  indicatorViewing: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    transition: 'background-color 0.3s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  viewingPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 80,
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  photoNavButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    zIndex: 10,
  },
  viewingInfo: {
    padding: '20px 20px 40px 20px',
  },
  viewingName: {
    fontSize: 32,
    fontWeight: 800,
    color: theme.colors.text,
    margin: '0 0 8px 0',
    lineHeight: 1.2,
  },
  viewingAge: {
    fontWeight: 400,
  },
  viewingUniversity: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  viewingSection: {
    marginBottom: 24,
  },
  viewingSectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 12,
  },
  viewingPromptCard: {
    padding: '14px 16px',
    background: 'rgba(255, 59, 92, 0.05)',
    borderRadius: 14,
    border: '2px solid rgba(255, 59, 92, 0.2)',
  },
  viewingPromptQuestion: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ff6b9d',
    marginBottom: 10,
    lineHeight: 1.4,
  },
  viewingPromptAnswer: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  viewingGoals: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewingGoalTag: {
    padding: '8px 14px',
    borderRadius: 14,
    fontSize: 14,
    fontWeight: 600,
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.15) 0%, rgba(255, 107, 157, 0.15) 100%)',
    border: '1px solid rgba(255, 59, 92, 0.3)',
    color: '#ff6b9d',
  },
  viewingBio: {
    fontSize: 16,
    lineHeight: 1.6,
    color: theme.colors.text,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  viewingInterests: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  viewingInterestTag: {
    padding: '7px 12px',
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 600,
    backgroundColor: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    marginTop: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: theme.colors.text,
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default DatingFeed;
