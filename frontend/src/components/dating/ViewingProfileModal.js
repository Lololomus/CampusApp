// ===== FILE: src/components/dating/ViewingProfileModal.js =====
// Полноэкранный просмотр профиля из вкладки "Симпатии" — slide-in from right

import { useState, useEffect } from 'react';
import { GraduationCap, ChevronLeft, ChevronRight, Heart, MessageCircle } from 'lucide-react';
import { GOAL_LABELS, INTEREST_LABELS } from '../../constants/datingConstants';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import PhotoViewer from '../shared/PhotoViewer';
import DrilldownHeader from '../shared/DrilldownHeader';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';
import { useModalAnimation, SCREEN_EXIT_MS } from '../../hooks/useModalAnimation';
import { Z_MODAL_LIKES_LIST } from '../../constants/zIndex';
import theme from '../../theme';

const d = theme.colors.dating;

function ViewingProfileModal({ profile, profileType, onClose, onLike, onMessage, zIndex = Z_MODAL_LIKES_LIST }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  const photos = profile?.photos || [];
  const hasPhotos = photos.length > 0;
  const isMatchProfile = profileType === 'match';
  const commonInterests = profile?.common_interests || [];
  const commonGoals = profile?.common_goals || [];

  const { isMounted, isVisible, handleClose } = useModalAnimation(onClose, SCREEN_EXIT_MS);

  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  // Скрываем Telegram MainButton — кнопка теперь in-app
  useTelegramScreen({
    id: `dating-view-profile-${profileType || 'profile'}-${profile?.id || 'unknown'}`,
    title: '',
    priority: 130,
    back: { visible: true, onClick: handleClose },
    main: { visible: false },
  });

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

  // Навигация по фото через тап-зоны
  const openPhotoViewer = () => {
    if (!hasPhotos) return;
    setShowPhotoViewer(true);
  };

  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    if (currentPhotoIndex === 0) return;
    hapticFeedback('light');
    setCurrentPhotoIndex(prev => prev - 1);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    if (currentPhotoIndex >= photos.length - 1) return;
    hapticFeedback('light');
    setCurrentPhotoIndex(prev => prev + 1);
  };

  const icebreaker = profile?.prompts?.question && profile?.prompts?.answer
    ? { question: profile.prompts.question, answer: profile.prompts.answer }
    : profile?.icebreaker
      ? { question: 'Ледокол', answer: profile.icebreaker }
      : null;

  if (!isMounted) return null;

  return (
    <EdgeSwipeBack onBack={handleClose} disabled={showPhotoViewer} zIndex={zIndex}>
      <div style={{
        ...styles.overlay,
        transform: isVisible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <div style={styles.headerOverlay}>
          <DrilldownHeader
            title=""
            onBack={handleClose}
            showTitle={false}
            showDivider={false}
            sticky={false}
            transparent
          />
        </div>

        <div style={styles.scrollContent}>
          {/* Фото 4:5 с градиентом и overlaid инфо */}
          <div style={styles.photoSection} onClick={openPhotoViewer}>
            {hasPhotos ? (
              <>
                {photos.map((photo, idx) => (
                  <img
                    key={idx}
                    src={photo?.url || photo}
                    alt={profile.name}
                    style={{
                      ...styles.photo,
                      opacity: idx === currentPhotoIndex ? 1 : 0,
                      zIndex: idx === currentPhotoIndex ? 1 : 0,
                    }}
                  />
                ))}
                {photos.length > 1 && (
                  <div style={styles.photoIndicators}>
                    {photos.map((_, idx) => (
                      <div
                        key={idx}
                        style={{
                          ...styles.indicator,
                          backgroundColor: idx === currentPhotoIndex ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)',
                        }}
                      />
                    ))}
                  </div>
                )}
                {photos.length > 1 && currentPhotoIndex > 0 && (
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={handlePrevPhoto}
                    style={{ ...styles.photoNavButton, left: 12 }}
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}
                {photos.length > 1 && currentPhotoIndex < photos.length - 1 && (
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={handleNextPhoto}
                    style={{ ...styles.photoNavButton, right: 12 }}
                  >
                    <ChevronRight size={22} />
                  </button>
                )}
              </>
            ) : (
              <div style={styles.photoPlaceholder}>
                {profile.name?.charAt(0) || '?'}
              </div>
            )}

            <div style={styles.photoGradient} />

            {/* Имя + вуз overlaid на фото */}
            <div style={styles.photoOverlay}>
              <h1 style={styles.overlayName}>
                {profile.name}, {profile.age}
              </h1>
              <div style={styles.overlayUni}>
                <GraduationCap size={16} />
                {profile.university}
                {profile.institute && ` • ${profile.institute}`}
                {profile.course && ` • ${profile.course} курс`}
              </div>
            </div>
          </div>

          {/* Контент под фото */}
          <div style={styles.infoSection}>
            {/* Icebreaker */}
            {icebreaker && (
              <div style={styles.icebreaker}>
                <div style={styles.icebreakerAccent} />
                <h4 style={styles.icebreakerQuestion}>{icebreaker.question}</h4>
                <p style={styles.icebreakerAnswer}>{icebreaker.answer}</p>
              </div>
            )}

            {/* Цели */}
            {profile.goals?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>Цели</div>
                <div style={styles.goalsRow}>
                  {profile.goals.map(goal => {
                    const isCommon = commonGoals.includes(goal);
                    return (
                      <div key={goal} style={isCommon ? styles.goalTagCommon : styles.goalTag}>
                        {GOAL_LABELS[goal] || goal}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* О себе */}
            {profile.bio && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>О себе</div>
                <p style={styles.bioText}>{profile.bio}</p>
              </div>
            )}

            {/* Интересы */}
            {profile.interests?.length > 0 && (
              <div style={styles.section}>
                <div style={styles.interestsHeader}>
                  <div style={styles.sectionTitle}>Интересы</div>
                  {commonInterests.length > 0 && (
                    <span style={styles.commonBadge}>
                      {commonInterests.length} общих
                    </span>
                  )}
                </div>
                <div style={styles.interestsGrid}>
                  {profile.interests.map(interest => {
                    const isCommon = commonInterests.includes(interest);
                    return (
                      <div key={interest} style={isCommon ? styles.interestCommon : styles.interestChip}>
                        {INTEREST_LABELS[interest] || interest}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Fixed bottom CTA */}
        <div style={styles.bottomBar}>
          <button
            style={styles.ctaButton}
            onClick={isMatchProfile ? handleMessageClick : handleLikeClick}
            disabled={!isMatchProfile && isLiking}
          >
            {isMatchProfile ? (
              <><MessageCircle size={22} fill="currentColor" /> Написать сообщение</>
            ) : (
              <><Heart size={22} fill="currentColor" /> Лайкнуть в ответ</>
            )}
          </button>
        </div>

        {showPhotoViewer && (
          <PhotoViewer
            photos={photos}
            initialIndex={currentPhotoIndex}
            onClose={() => setShowPhotoViewer(false)}
            dismissMode="swipe"
          />
        )}
      </div>
    </EdgeSwipeBack>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
    backgroundColor: '#050505',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    padding: '52px 16px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'pointer',
    pointerEvents: 'auto',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
    pointerEvents: 'auto',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 160,
  },
  photoSection: {
    position: 'relative',
    width: '100%',
    aspectRatio: '4 / 5',
    backgroundColor: d.surface,
    cursor: 'pointer',
  },
  photo: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    objectFit: 'cover',
    transition: 'opacity 0.3s ease',
  },
  photoPlaceholder: {
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
  photoIndicators: {
    position: 'absolute',
    top: 12, left: 12, right: 12,
    display: 'flex',
    gap: 6,
    zIndex: 3,
  },
  photoNavButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 4,
  },
  indicator: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    transition: 'background-color 0.3s ease',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  },
  photoGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    background: 'linear-gradient(to top, #050505, transparent)',
    pointerEvents: 'none',
    zIndex: 2,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    zIndex: 3,
  },
  overlayName: {
    fontSize: 36,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    lineHeight: 1.1,
    textShadow: '0 4px 16px rgba(0,0,0,0.5)',
  },
  overlayUni: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 15,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 6,
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  infoSection: {
    padding: '24px 20px',
  },
  icebreaker: {
    position: 'relative',
    backgroundColor: 'rgba(255, 45, 85, 0.1)',
    border: '1px solid rgba(255, 45, 85, 0.2)',
    borderRadius: 16,
    padding: '16px 16px 16px 20px',
    marginBottom: 32,
    overflow: 'hidden',
  },
  icebreakerAccent: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    backgroundColor: d.pink,
  },
  icebreakerQuestion: {
    fontSize: 13,
    fontWeight: 700,
    color: d.pink,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 8px 0',
  },
  icebreakerAnswer: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 1.5,
    margin: 0,
    fontWeight: 500,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: d.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 12,
    margin: '0 0 12px 0',
  },
  goalsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalTag: {
    backgroundColor: d.surface,
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  goalTagCommon: {
    backgroundColor: d.commonBg,
    border: `1px solid ${d.commonBorder}`,
    color: d.accent,
    padding: '8px 16px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: d.commonGlow,
  },
  bioText: {
    fontSize: 16,
    color: d.textLight,
    lineHeight: 1.5,
    margin: 0,
    whiteSpace: 'pre-line',
  },
  interestsHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commonBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: d.accent,
    backgroundColor: 'rgba(212, 255, 0, 0.1)',
    padding: '4px 8px',
    borderRadius: 6,
  },
  interestsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: d.surface,
    border: '1px solid rgba(255, 255, 255, 0.04)',
    color: d.textLight,
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
  },
  interestCommon: {
    backgroundColor: d.commonBg,
    border: `1px solid ${d.commonBorder}`,
    color: d.accent,
    padding: '8px 12px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 500,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: '16px 20px',
    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
    background: 'linear-gradient(to top, #050505, #050505 80%, transparent)',
    zIndex: 5,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: d.pink,
    color: '#fff',
    fontWeight: 800,
    fontSize: 18,
    padding: '16px 0',
    borderRadius: 16,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 8px 24px rgba(255, 45, 85, 0.35)',
  },
};

// Inject slideInRight keyframe
if (typeof document !== 'undefined' && !document.getElementById('viewing-profile-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'viewing-profile-styles';
  styleSheet.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default ViewingProfileModal;
