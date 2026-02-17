// ===== 📄 ФАЙЛ: src/components/dating/ViewingProfileModal.js =====
// Полноэкранный просмотр профиля из вкладки "Симпатии" / "Матчи"

import React, { useState, useEffect } from 'react';
import { GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { GOAL_ICONS, INTEREST_LABELS } from '../../constants/datingConstants';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import PhotoViewer from '../shared/PhotoViewer';
import theme from '../../theme';

function ViewingProfileModal({ profile, profileType, onClose, onLike, onMessage }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const photos = profile?.photos || [];
  const hasPhotos = photos.length > 0;

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
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleLikeClick = async () => {
    if (isLiking) return;
    setIsLiking(true);
    hapticFeedback('medium');
    try {
      if (onLike) await onLike();
    } finally {
      setIsLiking(false);
    }
  };

  const handleMessageClick = () => {
    hapticFeedback('medium');
    if (onMessage) onMessage();
  };

  const isMatchProfile = profileType === 'match';

  useTelegramScreen({
    id: `dating-likes-view-profile-${profileType || 'profile'}-${profile?.id || 'unknown'}`,
    title: isMatchProfile ? 'Взаимность' : 'Кто лайкнул',
    priority: 130,
    back: { visible: true, onClick: onClose },
    main: {
      visible: true,
      text: isMatchProfile ? 'Написать сообщение' : 'Лайкнуть в ответ',
      onClick: isMatchProfile ? handleMessageClick : handleLikeClick,
      enabled: !isLiking,
      loading: !isMatchProfile && isLiking,
      color: theme.colors.dating.action,
    },
  });

  return (
    <div style={styles.viewingOverlay}>
      <DrilldownHeader title={isMatchProfile ? 'Взаимность' : 'Кто лайкнул'} onBack={onClose} />

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
          
          {photos.length > 1 && (
            <>
              {currentPhotoIndex > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                  style={{ ...styles.photoNavButton, left: 12 }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              {currentPhotoIndex < photos.length - 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
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

          {profile.bio && (
            <div style={styles.viewingSection}>
              <div style={styles.viewingSectionTitle}>О себе</div>
              <p style={styles.viewingBio}>{profile.bio}</p>
            </div>
          )}

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

const styles = {
  viewingOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
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
    top: 0, left: 0, width: '100%', height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease',
  },
  photoIndicatorsViewing: {
    position: 'absolute',
    top: 12, left: 12, right: 12,
    display: 'flex', gap: 6, zIndex: 3,
  },
  indicatorViewing: {
    flex: 1, height: 4, borderRadius: 2,
    transition: 'background-color 0.3s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  viewingPhotoPlaceholder: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 80, fontWeight: 800, color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  photoNavButton: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
    border: 'none', borderRadius: '50%', width: 40, height: 40,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', cursor: 'pointer', zIndex: 10,
  },
  viewingInfo: { padding: '20px 20px 40px 20px' },
  viewingName: {
    fontSize: 32, fontWeight: 800, color: theme.colors.text,
    margin: '0 0 8px 0', lineHeight: 1.2,
  },
  viewingAge: { fontWeight: 400 },
  viewingUniversity: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 15, color: theme.colors.textSecondary, marginBottom: 20,
  },
  viewingSection: { marginBottom: 24 },
  viewingSectionTitle: {
    fontSize: 13, fontWeight: 700, color: theme.colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12,
  },
  viewingPromptCard: {
    padding: '14px 16px', background: 'rgba(255, 59, 92, 0.05)',
    borderRadius: 14, border: '2px solid rgba(255, 59, 92, 0.2)',
  },
  viewingPromptQuestion: {
    fontSize: 14, fontWeight: 700, color: '#ff6b9d', marginBottom: 10, lineHeight: 1.4,
  },
  viewingPromptAnswer: { fontSize: 15, color: theme.colors.text, lineHeight: 1.5 },
  viewingGoals: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  viewingGoalTag: {
    padding: '8px 14px', borderRadius: 14, fontSize: 14, fontWeight: 600,
    background: 'linear-gradient(135deg, rgba(255, 59, 92, 0.15) 0%, rgba(255, 107, 157, 0.15) 100%)',
    border: '1px solid rgba(255, 59, 92, 0.3)', color: '#ff6b9d',
  },
  viewingBio: {
    fontSize: 16, lineHeight: 1.6, color: theme.colors.text, margin: 0, whiteSpace: 'pre-line',
  },
  viewingInterests: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  viewingInterestTag: {
    padding: '7px 12px', borderRadius: 12, fontSize: 13, fontWeight: 600,
    backgroundColor: theme.colors.card, border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
  },
};

export default ViewingProfileModal;
