// ===== 📄 ФАЙЛ: src/components/dating/MyDatingProfileModal.js =====

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Heart, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingStats, updateDatingSettings } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import PhotoViewer from '../shared/PhotoViewer';

const Z_MODAL = 2500;

// ===== КОНСТАНТЫ =====
const GOAL_LABELS = {
  'relationship': '💘 Отношения',
  'friends': '🤝 Дружба',
  'study': '📚 Учеба',
  'hangout': '🎉 Тусовки'
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

const LOOKING_FOR_LABELS = {
  'male': '👨 Парней',
  'female': '👩 Девушек',
  'all': '👥 Неважно'
};

const GENDER_LABELS = {
  'male': '👨 Парень',
  'female': '👩 Девушка'
};

function MyDatingProfileModal({ onClose, onEditClick }) {
  const { datingProfile, user } = useStore();
  const [stats, setStats] = useState({ likes_count: 0, matches_count: 0, views_count: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await getDatingStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleToggleVisibility = async () => {
    hapticFeedback('medium');
    setTogglingVisibility(true);
    try {
      const newValue = !user.show_in_dating;
      await updateDatingSettings({ show_in_dating: newValue });
      useStore.setState({ user: { ...user, show_in_dating: newValue } });
      hapticFeedback('success');
    } catch (e) {
      alert('Не удалось изменить настройки');
    } finally {
      setTogglingVisibility(false);
    }
  };

  if (!datingProfile) return null;

  const photos = datingProfile.photos || [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = photos[currentPhotoIndex];

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

  return (
    <>
      {/* Overlay */}
      <div style={styles.overlay} onClick={onClose} />

      {/* Modal */}
      <div style={styles.modal}>
        {/* Close Button */}
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </button>

        {/* Content */}
        <div style={styles.content}>
          
          {/* Hero Section - Photo Gallery */}
          <div style={styles.heroSection}>
            {hasPhotos ? (
              <div style={styles.photoGallery}>
                <img 
                  src={currentPhoto.url || currentPhoto} 
                  alt="" 
                  style={styles.heroPhoto}
                  onClick={() => setShowPhotoViewer(true)}
                />
                
                {/* Photo Navigation */}
                {photos.length > 1 && (
                  <>
                    <div style={styles.photoDots}>
                      {photos.map((_, idx) => (
                        <div 
                          key={idx}
                          style={{
                            ...styles.dot,
                            backgroundColor: idx === currentPhotoIndex 
                              ? '#fff' 
                              : 'rgba(255,255,255,0.4)'
                          }}
                        />
                      ))}
                    </div>
                    
                    {currentPhotoIndex > 0 && (
                      <button onClick={prevPhoto} style={{...styles.photoNavButton, left: 12}}>
                        <ChevronLeft size={24} />
                      </button>
                    )}
                    {currentPhotoIndex < photos.length - 1 && (
                      <button onClick={nextPhoto} style={{...styles.photoNavButton, right: 12}}>
                        <ChevronRight size={24} />
                      </button>
                    )}
                  </>
                )}

                {/* Gradient Overlay */}
                <div style={styles.heroGradient} />
                
                {/* Name Overlay */}
                <div style={styles.heroInfo}>
                  <h1 style={styles.heroName}>
                    {user.name}{datingProfile.age && <>, <span style={styles.heroAge}>{datingProfile.age}</span></>}
                  </h1>
                  <div style={styles.heroUniversity}>
                    {user.university} • {user.institute}
                  </div>
                </div>
              </div>
            ) : (
              <div style={styles.noPhotoPlaceholder}>
                <div style={styles.noPhotoIcon}>📷</div>
                <div style={styles.noPhotoText}>Нет фото</div>
              </div>
            )}
          </div>

          {/* Edit Button */}
          <button onClick={onEditClick} style={styles.editButton}>
            Редактировать анкету
          </button>

          {/* Stats Cards */}
          <div style={styles.statsRow}>
            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <TrendingUp size={20} color="#ff3b5c" />
              </div>
              <div style={styles.statValue}>{stats.views_count || 0}</div>
              <div style={styles.statLabel}>Просмотров</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Heart size={20} color="#ff3b5c" />
              </div>
              <div style={styles.statValue}>{stats.likes_count || 0}</div>
              <div style={styles.statLabel}>Лайков</div>
            </div>
            
            <div style={styles.statCard}>
              <div style={styles.statIconWrapper}>
                <Users size={20} color="#ff3b5c" />
              </div>
              <div style={styles.statValue}>{stats.matches_count || 0}</div>
              <div style={styles.statLabel}>Мэтчей</div>
            </div>
          </div>

          {/* Info Section */}
          <div style={styles.infoSection}>
            {/* Gender & Looking For */}
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}>Пол</div>
              <div style={styles.infoValue}>{GENDER_LABELS[datingProfile.gender]}</div>
            </div>
            
            <div style={styles.infoRow}>
              <div style={styles.infoLabel}>Ищу</div>
              <div style={styles.infoValue}>{LOOKING_FOR_LABELS[datingProfile.looking_for]}</div>
            </div>

            {/* Goals */}
            {datingProfile.goals?.length > 0 && (
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>Цели знакомства</div>
                <div style={styles.goalsRow}>
                  {datingProfile.goals.map((goal, i) => (
                    <span key={i} style={styles.goalTag}>
                      {GOAL_LABELS[goal] || goal}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Bio */}
            {datingProfile.bio && (
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>О себе</div>
                <p style={styles.bioText}>{datingProfile.bio}</p>
              </div>
            )}

            {/* Interests */}
            {datingProfile.interests?.length > 0 && (
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>Интересы</div>
                <div style={styles.interestsRow}>
                  {datingProfile.interests.map((interest, i) => (
                    <span key={i} style={styles.interestTag}>
                      {INTEREST_LABELS[interest] || `#${interest}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Visibility Toggle */}
          <div style={styles.visibilitySection}>
            <div style={styles.visibilityInfo}>
              {user.show_in_dating ? (
                <>
                  <Eye size={20} color="#10b981" />
                  <div>
                    <div style={styles.visibilityTitle}>Анкета видна</div>
                    <div style={styles.visibilityDesc}>Другие студенты могут видеть твой профиль</div>
                  </div>
                </>
              ) : (
                <>
                  <EyeOff size={20} color={theme.colors.textSecondary} />
                  <div>
                    <div style={styles.visibilityTitle}>Анкета скрыта</div>
                    <div style={styles.visibilityDesc}>Профиль не показывается другим</div>
                  </div>
                </>
              )}
            </div>
            <button 
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              style={{
                ...styles.toggleButton,
                backgroundColor: user.show_in_dating ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: user.show_in_dating ? '#ef4444' : '#10b981'
              }}
            >
              {togglingVisibility ? '...' : user.show_in_dating ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </div>
      </div>

      {/* Photo Viewer */}
      {showPhotoViewer && (
        <PhotoViewer
          photos={photos}
          initialIndex={currentPhotoIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}
    </>
  );
}

// ===== STYLES =====
const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: Z_MODAL,
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: Z_MODAL + 1,
    backgroundColor: theme.colors.bg,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInFromRight 0.35s cubic-bezier(0.4, 0.0, 0.2, 1)',
  },
  closeButton: {
    position: 'fixed',
    top: 'max(16px, env(safe-area-inset-top))',
    right: 16,
    zIndex: Z_MODAL + 2,
    background: 'rgba(0,0,0,0.5)',
    backdropFilter: 'blur(10px)',
    border: 'none',
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
  },
  
  // Hero Section
  heroSection: {
    position: 'relative',
    width: '100%',
    height: '400px',
    backgroundColor: theme.colors.card,
  },
  photoGallery: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
    pointerEvents: 'none',
  },
  heroInfo: {
    position: 'absolute',
    bottom: 20, left: 20, right: 20,
  },
  heroName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    margin: '0 0 8px 0',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  heroAge: {
    fontWeight: '400',
  },
  heroUniversity: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  },
  photoDots: {
    position: 'absolute',
    top: 12,
    left: 0, right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    transition: 'background-color 0.2s',
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
  },
  noPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
  },
  noPhotoIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  noPhotoText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  
  editButton: {
    margin: '16px 16px 12px 16px',
    width: 'calc(100% - 32px)',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 100%)',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(255, 59, 92, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    textAlign: 'center',
  },
  
  // Stats
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    padding: '0 16px 12px 16px',
  },
  statCard: {
    background: theme.colors.card,
    borderRadius: 12,
    padding: '14px 12px',
    textAlign: 'center',
    border: `1px solid ${theme.colors.border}`,
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    margin: '0 auto 8px',
    borderRadius: '50%',
    background: 'rgba(255, 59, 92, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  
  // Info Section
  infoSection: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    background: theme.colors.card,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
  },
  infoBlock: {
    padding: '14px 16px',
    background: theme.colors.card,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
  },
  infoLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: '600',
  },
  goalsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  goalTag: {
    padding: '6px 12px',
    borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.15) 0%, rgba(255, 107, 157, 0.15) 100%)',
    border: '1px solid rgba(255, 59, 92, 0.3)',
    color: '#ff6b9d',
    fontSize: 13,
    fontWeight: '600',
  },
  bioText: {
    fontSize: 15,
    lineHeight: 1.5,
    color: theme.colors.text,
    margin: '8px 0 0 0',
    whiteSpace: 'pre-line',
  },
  interestsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  interestTag: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    padding: '6px 12px',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid #333',
    fontWeight: 500,
  },
  
  // Visibility
  visibilitySection: {
    margin: '16px 16px',
    padding: '14px 16px',
    background: theme.colors.card,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  visibilityInfo: {
    flex: 1,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
  },
  visibilityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  visibilityDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  toggleButton: {
    padding: '8px 16px',
    borderRadius: 12,
    border: 'none',
    fontSize: 14,
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
};

// Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideInFromRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  
  button:active {
    transform: scale(0.97) !important;
  }
`;
if (!document.getElementById('my-dating-profile-styles')) {
  styleSheet.id = 'my-dating-profile-styles';
  document.head.appendChild(styleSheet);
}

export default MyDatingProfileModal;
