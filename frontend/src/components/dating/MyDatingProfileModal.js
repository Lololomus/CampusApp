// ===== 📄 ФАЙЛ: src/components/dating/MyDatingProfileModal.js (ФИНАЛ) =====

import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Heart, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../../store';
import { getDatingStats, updateDatingSettings } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import PhotoViewer from '../shared/PhotoViewer';
import {
  GOAL_LABELS,
  INTEREST_LABELS,
  LOOKING_FOR_LABELS,
  GENDER_LABELS
} from '../../constants/datingConstants';

const Z_MODAL = 2500;

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

  // ✅ DEBUG: Проверяем данные
  console.log('🔍 Dating Profile:', datingProfile);
  console.log('🔍 Interests:', datingProfile.interests);
  console.log('🔍 Prompts:', datingProfile.prompts);

  const photos = datingProfile.photos || [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = photos[currentPhotoIndex];

  // ✅ ПРАВИЛЬНАЯ ПРОВЕРКА ПРОМПТА (это объект, а не массив!)
  const hasPrompt = datingProfile.prompts && 
                    datingProfile.prompts.question && 
                    datingProfile.prompts.answer;

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
      <div style={styles.overlay} onClick={onClose} />

      <div style={styles.modal}>
        <button onClick={onClose} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </button>

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
              </div>
            ) : (
              <div style={styles.noPhotoPlaceholder}>
                <div style={styles.noPhotoIcon}>📷</div>
                <div style={styles.noPhotoText}>Нет фото</div>
              </div>
            )}
          </div>

          {/* Header Card - Name, Age, University */}
          <div style={styles.headerCard}>
            <h1 style={styles.profileName}>
              {user.name}
              {datingProfile.age && <span style={styles.profileAge}>, {datingProfile.age}</span>}
            </h1>
            <div style={styles.profileUniversity}>
              {user.university} • {user.institute}
              {user.course && <> • {user.course} курс</>}
            </div>

            {/* Stats Row */}
            <div style={styles.statsRowCompact}>
              <div style={styles.statItemCompact}>
                <TrendingUp size={16} color="#ff3b5c" />
                <span style={styles.statValueCompact}>{stats.views_count || 0}</span>
                <span style={styles.statLabelCompact}>просмотров</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statItemCompact}>
                <Heart size={16} color="#ff3b5c" />
                <span style={styles.statValueCompact}>{stats.likes_count || 0}</span>
                <span style={styles.statLabelCompact}>лайков</span>
              </div>
              <div style={styles.statDivider} />
              <div style={styles.statItemCompact}>
                <Users size={16} color="#ff3b5c" />
                <span style={styles.statValueCompact}>{stats.matches_count || 0}</span>
                <span style={styles.statLabelCompact}>мэтчей</span>
              </div>
            </div>
          </div>

          {/* Edit Button */}
          <button onClick={onEditClick} style={styles.editButton}>
            Редактировать анкету
          </button>

          {/* Bio Section */}
          {datingProfile.bio && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>О себе</div>
              <p style={styles.bioText}>{datingProfile.bio}</p>
            </div>
          )}

          {/* Parameters Section */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>Параметры</div>
            <div style={styles.paramsGrid}>
              <div style={styles.paramChip}>
                <span style={styles.paramLabel}>Пол:</span>
                <span style={styles.paramValue}>{GENDER_LABELS[datingProfile.gender]}</span>
              </div>
              <div style={styles.paramChip}>
                <span style={styles.paramLabel}>Ищу:</span>
                <span style={styles.paramValue}>{LOOKING_FOR_LABELS[datingProfile.looking_for]}</span>
              </div>
            </div>

            {/* Goals */}
            {datingProfile.goals?.length > 0 && (
              <div style={styles.goalsBlock}>
                <div style={styles.goalsLabel}>Цели знакомства</div>
                <div style={styles.goalsRow}>
                  {datingProfile.goals.map((goal, i) => (
                    <span key={i} style={styles.goalTag}>
                      {GOAL_LABELS[goal] || goal}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Interests Section */}
          {datingProfile.interests?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>Интересы</div>
              <div style={styles.interestsRow}>
                {datingProfile.interests.map((interest, i) => (
                  <span key={i} style={styles.interestTag}>
                    {INTEREST_LABELS[interest] || interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Section */}
          {hasPrompt && (
            <div style={styles.section}>
              <div style={styles.promptCard}>
                <div style={styles.promptQuestion}>
                  💬 {datingProfile.prompts.question}
                </div>
                <div style={styles.promptAnswer}>
                  {datingProfile.prompts.answer}
                </div>
              </div>
            </div>
          )}

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

// ===== STYLES (без изменений) =====
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
    top: 0, left: 0, right: 0, bottom: 0,
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
    height: '360px',
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
  photoDots: {
    position: 'absolute',
    top: 12,
    left: 0, right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    transition: 'background-color 0.2s',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
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
  
  // Header Card (Name + Stats)
  headerCard: {
    margin: '16px 16px 12px',
    padding: '16px',
    background: theme.colors.card,
    borderRadius: 16,
    border: `1px solid ${theme.colors.border}`,
  },
  profileName: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.colors.text,
    margin: '0 0 4px 0',
  },
  profileAge: {
    fontWeight: '400',
    color: theme.colors.textSecondary,
  },
  profileUniversity: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  
  // Compact Stats Row
  statsRowCompact: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '12px 0 0',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  statItemCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  statValueCompact: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  statLabelCompact: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statDivider: {
    width: 1,
    height: 20,
    background: theme.colors.border,
  },
  
  // Edit Button
  editButton: {
    margin: '0 16px 12px',
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
    transition: 'transform 0.2s',
  },
  
  // Section
  section: {
    margin: '0 16px 12px',
    padding: '16px',
    background: theme.colors.card,
    borderRadius: 12,
    border: `1px solid ${theme.colors.border}`,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  
  // Bio
  bioText: {
    fontSize: 15,
    lineHeight: 1.6,
    color: theme.colors.text,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  
  // Parameters
  paramsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 12,
  },
  paramChip: {
    padding: '10px 12px',
    background: theme.colors.bgSecondary,
    borderRadius: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  paramLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  paramValue: {
    fontSize: 14,
    color: theme.colors.text,
    fontWeight: '600',
  },
  
  // Goals
  goalsBlock: {
    paddingTop: 12,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  goalsLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  goalsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
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
  
  // Interests
  interestsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    fontSize: 13,
    color: theme.colors.text,
    padding: '6px 12px',
    borderRadius: 12,
    backgroundColor: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`,
    fontWeight: 500,
  },

  // Prompt
  promptCard: {
    padding: '14px',
    background: 'rgba(255, 59, 92, 0.05)',
    borderRadius: 12,
    border: '2px solid rgba(255, 59, 92, 0.2)',
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ff6b9d',
    marginBottom: 8,
    lineHeight: 1.3,
  },
  promptAnswer: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 1.5,
  },
  
  // Visibility
  visibilitySection: {
    margin: '0 16px 16px',
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
    transition: 'transform 0.2s',
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

`;
if (!document.getElementById('my-dating-profile-styles')) {
  styleSheet.id = 'my-dating-profile-styles';
  document.head.appendChild(styleSheet);
}

export default MyDatingProfileModal;