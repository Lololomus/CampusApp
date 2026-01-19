// ===== 📄 ФАЙЛ: frontend/src/components/dating/LikesTab.js =====
import React, { useEffect, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useStore } from '../../store';
import { getMyMatches } from '../../api';
import MatchCard from './MatchCard';
import { MatchCardSkeleton, LikesCardSkeleton } from './DatingSkeletons'; 

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

const GOAL_LABELS = {
  relationship: '💘 Отношения',
  friends: '🤝 Дружба',
  study: '📚 Учеба',
  hangout: '🎉 Тусовки',
};

// ✅ НОВОЕ: Включить моки для тестирования UI
const USE_MOCK_DATA = true; // Поставь false когда backend заработает

// ✅ НОВОЕ: Моки для матчей (24-часовые)
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
      { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=800', w: 800, h: 1000 }
    ],
    interests: ['books', 'art', 'coffee'],
    goals: ['friends', 'study'],
    prompts: {
      question: 'Моя суперспособность?',
      answer: 'Могу процитировать "Мастера и Маргариту" целиком 📖'
    },
    matched_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    hours_left: 22,
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
      { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=800', w: 800, h: 1000 }
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
      { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=800', w: 800, h: 1000 }
    ],
    interests: ['art', 'photo', 'coffee', 'travel'],
    goals: ['friends', 'relationship'],
    prompts: {
      question: 'Figma или Adobe XD?',
      answer: 'Figma всегда! Collaborative design — это мощь 🔥'
    },
    matched_at: new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
    hours_left: 9,
    minutes_left: 0,
  },
  {
    id: 204,
    user_id: 5,
    name: 'Даниил',
    age: 23,
    bio: 'Гитарист и меломан 🎸🎵',
    university: 'МГТУ',
    institute: 'Радиотехника',
    course: 4,
    photos: [
      { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=800', w: 800, h: 1000 }
    ],
    interests: ['music', 'party', 'sport'],
    goals: ['friends', 'hangout'],
    prompts: {
      question: 'Мой плейлист сейчас:',
      answer: 'Arctic Monkeys, Кино, The Strokes — классика вечна'
    },
    matched_at: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    hours_left: 1,
    minutes_left: 0,
  },
  {
    id: 205,
    user_id: 6,
    name: 'Алиса',
    age: 21,
    bio: 'Стартапер, работаю над EdTech проектом 🚀',
    university: 'РЭУ',
    institute: 'Менеджмент',
    course: 5,
    photos: [
      { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=800', w: 800, h: 1000 }
    ],
    interests: ['startup', 'it', 'coffee', 'books'],
    goals: ['study', 'friends'],
    prompts: {
      question: 'Мой любимый founder?',
      answer: 'Илон Маск — безумие, но работает!'
    },
    matched_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    hours_left: 20,
    minutes_left: 0,
  },
];

function LikesTab({ users = [], loading = false, onViewProfile, onQuickLike, onEmptyAction }) {
  const { matches, setMatches } = useStore();
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadMatches();
  }, []);

  const loadMatches = async () => {
    setMatchesLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Загрузка матчей...');
      
      let matchesData;
      
      // ✅ НОВОЕ: Используем моки для тестирования
      if (USE_MOCK_DATA) {
        console.log('🎭 Используем моки (USE_MOCK_DATA = true)');
        await new Promise(r => setTimeout(r, 500)); // Имитация загрузки
        matchesData = MOCK_MATCHES;
      } else {
        matchesData = await getMyMatches();
      }
      
      console.log('📦 Полученные данные:', matchesData);
      console.log('📊 Это массив?', Array.isArray(matchesData));
      console.log('📏 Длина:', matchesData?.length);
      
      setMatches(matchesData || []);
      
    } catch (error) {
      console.error('❌ Error loading matches:', error);
      setError(error.message);
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  };

  // ===== LOADING STATE =====
  if (loading || matchesLoading) {
    return (
      <div style={styles.containerScroll}>
        {/* Скелетоны для взаимностей */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Sparkles size={20} color="#f093fb" strokeWidth={2.5} />
            <h2 style={styles.sectionTitle}>Взаимность</h2>
          </div>
          <p style={styles.sectionSubtitle}>
            Активно 24 часа, не упусти момент!
          </p>
          <div style={styles.matchesList}>
            <MatchCardSkeleton />
            <MatchCardSkeleton />
          </div>
        </div>

        {/* Скелетоны для "кто лайкнул" */}
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Heart size={20} color="#ff6b9d" strokeWidth={2.5} />
            <h2 style={styles.sectionTitle}>Кто лайкнул</h2>
          </div>
          <p style={styles.sectionSubtitle}>
            Узнайте, кому вы понравились
          </p>
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

  // ===== ERROR STATE =====
  if (error) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyIcon}>⚠️</div>
        <h3 style={styles.emptyTitle}>Ошибка загрузки</h3>
        <p style={styles.emptyText}>{error}</p>
        <button style={styles.emptyButton} onClick={loadMatches}>
          Повторить
        </button>
      </div>
    );
  }

  // ===== DEBUG LOG =====
  console.log('🎨 Рендер LikesTab:', {
    matches: matches?.length,
    users: users?.length,
    matchesType: typeof matches,
    isArray: Array.isArray(matches)
  });

  // ===== EMPTY STATE =====
  if ((!users || users.length === 0) && (!matches || matches.length === 0)) {
    return (
      <div style={styles.emptyState}>
        {/* Большая иллюстрация */}
        <div style={styles.emptyIllustration}>
          <div style={styles.emptyCircle}>
            <Sparkles size={48} color="#f093fb" strokeWidth={1.5} />
          </div>
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

        <p style={styles.emptyHint}>
          💡 Совет: пролистай 10-15 анкет —<br />
          обычно появляется хотя бы одна взаимность
        </p>

        {onEmptyAction && (
          <button
            style={styles.emptyButton}
            onClick={() => {
              hapticFeedback('medium');
              onEmptyAction();
            }}
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
      {/* 1️⃣ MATCHES (24 HOURS) */}
      {matches && matches.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Sparkles size={20} color="#f093fb" strokeWidth={2.5} />
            <h2 style={styles.sectionTitle}>Взаимность ({matches.length})</h2>
          </div>
          <p style={styles.sectionSubtitle}>
            Активно 24 часа, не упусти момент!
          </p>

          <div style={styles.matchesList}>
            {matches.map((match) => (
              <MatchCard
                key={match.id || match.user_id}
                match={match}
                onMessage={handleMessage}
                onViewProfile={onViewProfile}
              />
            ))}
          </div>
        </div>
      )}

      {/* 2️⃣ WHO LIKED ME */}
      {users && users.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionHeader}>
            <Heart size={20} color="#ff6b9d" strokeWidth={2.5} />
            <h2 style={styles.sectionTitle}>
              Кто лайкнул ({users.length})
            </h2>
          </div>
          <p style={styles.sectionSubtitle}>
            Узнайте, кому вы понравились
          </p>

          <div style={styles.grid}>
            {users.map((user, idx) => {
              const photo = user?.photos?.[0]?.url || user?.photos?.[0] || user?.avatar?.url || user?.avatar || null;
              const hasPhoto = !!photo;

              return (
                <div
                  key={user.id}
                  style={{ ...styles.card, animationDelay: `${idx * 0.05}s` }}
                  onClick={() => {
                    hapticFeedback('light');
                    if (onViewProfile) onViewProfile(user);
                  }}
                >
                  {/* Photo */}
                  {hasPhoto ? (
                    <img
                      src={photo}
                      alt={user.name}
                      style={styles.cardImage}
                      draggable={false}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div style={styles.cardPlaceholder}>
                      {user.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}

                  {/* Overlay */}
                  <div style={styles.cardOverlay} />

                  {/* University Badge */}
                  {user.university && (
                    <div style={styles.universityBadge}>
                      {user.university}
                    </div>
                  )}

                  {/* Quick Like Button */}
                  <button
                    style={styles.likeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      hapticFeedback('medium');
                      if (onQuickLike && user.id) onQuickLike(user.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Heart size={20} strokeWidth={2.5} />
                  </button>

                  {/* Bottom Info */}
                  <div style={styles.cardInfo}>
                    {/* Name + Age */}
                    <div style={styles.cardName}>
                      {user.name}{user.age ? `, ${user.age}` : ''}
                    </div>

                    {/* Bio */}
                    {user.bio && (
                      <div style={styles.bioPreview}>
                        {user.bio.split('\n')[0].slice(0, 50)}
                        {user.bio.length > 50 ? '...' : ''}
                      </div>
                    )}

                    {/* Goals */}
                    {user.goals && user.goals.length > 0 && (
                      <div style={styles.goalsRow}>
                        {user.goals.slice(0, 2).map((goal) => (
                          <span key={goal} style={styles.goalBadge}>
                            {GOAL_LABELS[goal]?.split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Interests */}
                    {user.interests && user.interests.length > 0 && (
                      <div style={styles.tagsRow}>
                        {user.interests.slice(0, 3).map((interest) => (
                          <span key={interest} style={styles.tag}>
                            {INTEREST_LABELS[interest] || interest}
                          </span>
                        ))}
                        {user.interests.length > 3 && (
                          <span style={styles.tagMore}>
                            +{user.interests.length - 3}
                          </span>
                        )}
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

  function handleMessage(match) {
    console.log('Open chat with:', match);
    if (window.Telegram?.WebApp) {
      if (match.username) {
        window.Telegram.WebApp.openTelegramLink(`https://t.me/${match.username}`);
      } else {
        window.Telegram.WebApp.showAlert(`${match.name} не указал username!`);
      }
    }
  }
}

// ===== STYLES (БЕЗ ИЗМЕНЕНИЙ) =====
const styles = {
  containerScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: '100px',
  },

  loadingText: {
    textAlign: 'center',
    padding: '40px 20px',
    color: theme.colors.textSecondary,
    fontSize: 15,
  },

  section: {
    marginBottom: 32,
    padding: '0 12px',
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: theme.colors.text,
    margin: 0,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    margin: '0 0 16px 0',
  },

  matchesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 10,
  },

  card: {
    position: 'relative',
    aspectRatio: '3 / 4.2',
    borderRadius: 20,
    overflow: 'hidden',
    cursor: 'pointer',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    animation: 'fadeInUp 0.4s ease forwards',
    opacity: 0,
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  },

  cardImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
  },

  cardPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 52,
    fontWeight: 800,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },

  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0.15) 75%, transparent 100%)',
    pointerEvents: 'none',
  },

  universityBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    padding: '5px 10px',
    borderRadius: 10,
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(10px)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
    zIndex: 2,
    maxWidth: 'calc(100% - 70px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  likeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.25)',
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.95), rgba(255, 107, 157, 0.95))',
    backdropFilter: 'blur(10px)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 3,
    transition: 'none',
    outline: 'none',
    boxShadow: '0 4px 16px rgba(255, 59, 92, 0.4)',
  },

  cardInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    zIndex: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 7,
  },

  cardName: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    textShadow: '0 2px 10px rgba(0,0,0,0.7)',
    lineHeight: 1.15,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  bioPreview: {
    fontSize: 12,
    lineHeight: 1.35,
    color: 'rgba(255,255,255,0.9)',
    textShadow: '0 1px 4px rgba(0,0,0,0.6)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },

  goalsRow: {
    display: 'flex',
    gap: 5,
    flexWrap: 'wrap',
  },

  goalBadge: {
    fontSize: 16,
    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
  },

  tagsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 5,
  },

  tag: {
    padding: '3px 7px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.95)',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.22)',
    backdropFilter: 'blur(8px)',
    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
  },

  tagMore: {
    padding: '3px 7px',
    borderRadius: 8,
    fontSize: 10,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.75)',
    background: 'rgba(255,255,255,0.10)',
    border: '1px solid rgba(255,255,255,0.15)',
  },

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

  emptyIcon: {
    fontSize: 72,
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: theme.colors.text,
    margin: '0 0 12px 0',
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: theme.colors.textSecondary,
    margin: '0 0 24px 0',
  },

  emptyButton: {
    padding: '14px 24px',
    borderRadius: 16,
    border: 'none',
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(245, 87, 108, 0.35)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    transition: 'none',
    outline: 'none',
  },

  emptyIllustration: {
    marginBottom: 24,
  },

  emptyCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, rgba(240, 147, 251, 0.15), rgba(245, 87, 108, 0.15))',
    border: '3px solid rgba(240, 147, 251, 0.3)',
    animation: 'float 3s ease-in-out infinite',
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
    background: 'linear-gradient(135deg, #f093fb, #f5576c)',
    color: '#fff',
    flexShrink: 0,
  },

  stepText: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text,
    lineHeight: 1.4,
  },

  emptyHint: {
    fontSize: 13,
    lineHeight: 1.6,
    color: theme.colors.textSecondary,
    margin: '0 0 24px 0',
    padding: '12px 16px',
    borderRadius: 12,
    background: 'rgba(240, 147, 251, 0.08)',
    border: '1px solid rgba(240, 147, 251, 0.15)',
  },
};

// ===== ANIMATIONS =====
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0%, 100% { 
      transform: translateY(0px); 
    }
    50% { 
      transform: translateY(-10px); 
    }
  }
`;
if (!document.getElementById('likes-tab-styles')) {
  styleSheet.id = 'likes-tab-styles';
  document.head.appendChild(styleSheet);
}

export default LikesTab;