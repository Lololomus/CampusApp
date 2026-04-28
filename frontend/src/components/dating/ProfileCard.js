// ===== FILE: src/components/dating/ProfileCard.js =====

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Lock, ChevronUp, GraduationCap, Heart, X } from 'lucide-react';
import { GOAL_LABELS, INTEREST_LABELS } from '../../constants/datingConstants';
import theme from '../../theme';
import PhotoViewer from '../media/PhotoViewer';
import { getDatingPhotoList } from './photoUtils';
import { captureSourceRect } from '../../utils/mediaRect';

const d = theme.colors.dating;

const getPhotoSourceRect = (element) => captureSourceRect(element, {
  objectFit: 'contain',
  borderRadius: 0,
  hasContainFill: true,
});

const ProfileCard = memo(function ProfileCard({
  profile,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  isBlurred = false,
  onRegisterTrigger,
  isInteractive = true,
  onExpandProfile,
  onLike,
  onSkip,
  eagerFirstPhoto = false,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerSourceRect, setPhotoViewerSourceRect] = useState(null);
  const isDraggingRef = useRef(false);
  const cardRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const dragDistanceRef = useRef(0);

  const photos = getDatingPhotoList(profile);
  const commonGoals = profile?.common_goals || [];
  const getPhotoSrc = (photo) => photo?.url || photo;
  const activePhotoSrc = getPhotoSrc(photos[photoIndex]);
  const shouldLoadPhoto = (idx) => idx === photoIndex || (eagerFirstPhoto && idx === 0);
  const getPhotoLoading = (idx) => (idx === 0 && eagerFirstPhoto ? 'eager' : 'lazy');

  useEffect(() => {
    setImageLoaded(false);
    setPhotoIndex(0);
    setShowPhotoViewer(false);
    setPhotoViewerSourceRect(null);
  }, [profile?.id]);

  const resolvePhotoViewerSourceRect = useCallback((index) => (
    getPhotoSourceRect(cardRef.current?.querySelector(`[data-profile-photo-index="${index}"]`))
    || (index === photoIndex ? photoViewerSourceRect : null)
  ), [photoIndex, photoViewerSourceRect]);

  if (!profile) return null;

  const maxDrag = 350;

  const isFromUni = profile.match_reason && (
    profile.match_reason.includes('вуз') ||
    profile.match_reason.includes('факультет') ||
    profile.match_reason.includes('Из твоего')
  );

  // ===== ЛОГИКА КЛИКА (TAP) =====
  const isControlTarget = (target) => Boolean(
    target &&
    typeof target.closest === 'function' &&
    target.closest('[data-card-control="true"]')
  );

  const handleTap = (clientX) => {
    const target = cardRef.current;
    if (!target) return;

    if (isBlurred) {
      if (onRegisterTrigger) onRegisterTrigger();
      return;
    }

    try {
      const { left, width } = target.getBoundingClientRect();
      const x = clientX - left;
      const centerZone = width * 0.3;

      if (x < centerZone && photoIndex > 0) {
        setPhotoIndex(prev => prev - 1);
      } else if (x > width - centerZone && photoIndex < photos.length - 1) {
        setPhotoIndex(prev => prev + 1);
      } else {
        if (photos.length > 0) {
          const sourceEl = cardRef.current?.querySelector(`[data-profile-photo-index="${photoIndex}"]`);
          setPhotoViewerSourceRect(getPhotoSourceRect(sourceEl));
          setShowPhotoViewer(true);
        } else if (onExpandProfile) {
          onExpandProfile();
        }
      }
    } catch (e) {
      console.error('Tap error:', e);
    }
  };

  // ===== TOUCH EVENTS =====
  const handleTouchStart = (e) => {
    if (!isInteractive) return;
    if (isControlTarget(e.target)) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = e.touches[0].clientX;
    dragDistanceRef.current = 0;
    isDraggingRef.current = true;
    if (onSwipeStart) onSwipeStart();
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current || !isInteractive) return;
    const currentX = e.touches[0].clientX;
    currentXRef.current = currentX;
    const deltaX = currentX - startXRef.current;
    const deltaY = e.touches[0].clientY - startYRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(deltaX));

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (e.cancelable && Math.abs(deltaX) > 5) e.preventDefault();
      let delta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
      if (onSwipeMove) onSwipeMove(delta);
    }
  };

  const handleTouchEnd = (e) => {
    if (!isInteractive || !isDraggingRef.current) return;
    isDraggingRef.current = false;
    const finalDelta = currentXRef.current - startXRef.current;

    if (dragDistanceRef.current < 5) {
      const touch = e.changedTouches[0];
      handleTap(touch.clientX);
      if (onSwipeEnd) onSwipeEnd(0);
    } else {
      if (onSwipeEnd) onSwipeEnd(finalDelta);
    }
  };

  // ===== MOUSE EVENTS =====
  const handleMouseDown = (e) => {
    if (!isInteractive) return;
    if (isControlTarget(e.target)) return;
    e.preventDefault();
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentXRef.current = e.clientX;
    dragDistanceRef.current = 0;
    isDraggingRef.current = true;
    if (onSwipeStart) onSwipeStart();

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      currentXRef.current = moveEvent.clientX;
      dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(deltaX));
      let delta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
      if (onSwipeMove) onSwipeMove(delta);
    };

    const handleMouseUp = (upEvent) => {
      isDraggingRef.current = false;
      const finalDelta = upEvent.clientX - startXRef.current;

      if (dragDistanceRef.current < 5) {
        handleTap(upEvent.clientX);
        if (onSwipeEnd) onSwipeEnd(0);
      } else {
        if (onSwipeEnd) onSwipeEnd(finalDelta);
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <>
      {showPhotoViewer && (
        <PhotoViewer
          photos={photos}
          initialIndex={photoIndex}
          onClose={() => {
            setShowPhotoViewer(false);
            setPhotoViewerSourceRect(null);
          }}
          dismissMode="swipe"
          sourceRect={photoViewerSourceRect}
          sourceRectProvider={resolvePhotoViewerSourceRect}
          onIndexChange={setPhotoIndex}
        />
      )}

      <div
        ref={cardRef}
        style={styles.card}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        <div style={styles.imageContainer}>
          {photos.length > 0 ? (
            <div style={styles.photosStack}>
              <img
                src={activePhotoSrc}
                alt=""
                aria-hidden="true"
                draggable={false}
                loading={getPhotoLoading(photoIndex)}
                decoding="async"
                style={{
                  ...styles.avatarImageBackdrop,
                  opacity: imageLoaded ? 1 : 0,
                }}
              />
              {photos.map((photo, idx) => (
                <img
                  key={idx}
                  data-profile-photo-index={idx}
                  src={shouldLoadPhoto(idx) ? getPhotoSrc(photo) : undefined}
                  alt={`${profile.name} - фото ${idx + 1}`}
                  draggable={false}
                  loading={getPhotoLoading(idx)}
                  decoding="async"
                  onLoad={() => {
                    if (idx === 0) setImageLoaded(true);
                  }}
                  style={{
                    ...styles.avatarImage,
                    opacity: idx === photoIndex ? 1 : 0,
                    zIndex: idx === photoIndex ? 2 : 1,
                    visibility: showPhotoViewer && idx === photoIndex ? 'hidden' : 'visible',
                    filter: isBlurred ? 'blur(24px) brightness(0.8)' : 'none',
                    transform: isBlurred ? 'scale(1.1)' : 'none',
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={styles.avatarPlaceholder}>
              {profile.name?.charAt(0) || '?'}
            </div>
          )}

          {!imageLoaded && photos.length > 0 && (
            <div style={styles.imageSkeleton}>
              <div style={styles.skeletonShimmer} />
            </div>
          )}

          {/* Blur overlay для гостей */}
          {isBlurred && (
            <div style={styles.blurOverlay}>
              <div style={styles.blurBadge}>
                <Lock size={16} />
                <span>Скрыто</span>
              </div>
              <button
                data-card-control="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onRegisterTrigger) onRegisterTrigger();
                }}
                style={styles.showPhotoButton}
              >
                Показать фото
              </button>
            </div>
          )}

          {/* Photo indicators */}
          {!isBlurred && photos.length > 1 && imageLoaded && (
            <div style={styles.indicatorsRow}>
              {photos.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    ...styles.indicator,
                    opacity: idx === photoIndex ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
          )}

          {/* Нижний градиент */}
          {!isBlurred && (
            <div style={styles.bottomGradient} />
          )}

          {/* Инфо-оверлей поверх фото */}
          {!isBlurred && (
            <div style={styles.infoOverlay}>
              <div style={styles.infoLeft}>
                <div style={styles.nameRow}>
                  <h2 style={styles.profileName}>
                    {profile.name}, {profile.age}
                  </h2>
                </div>
                <div style={styles.uniRow}>
                  <GraduationCap size={16} />
                  {profile.university}{profile.institute ? ` • ${profile.institute}` : ''}
                </div>

                {/* Бейджи */}
                <div style={styles.badgesRow}>
                  {isFromUni && (
                    <div style={styles.uniBadge}>
                      Из твоего вуза
                    </div>
                  )}
                  {profile.goals?.slice(0, 2).map(goal => {
                    const isCommon = commonGoals.includes(goal);
                    return (
                      <div key={goal} style={isCommon ? styles.goalPillCommon : styles.goalPill}>
                        {GOAL_LABELS[goal] || goal}
                      </div>
                    );
                  })}
                  {profile.interests?.slice(0, 2).map(interest => (
                    <div key={interest} style={styles.interestPill}>
                      {INTEREST_LABELS[interest] || interest}
                    </div>
                  ))}
                </div>
              </div>

              {/* ChevronUp кнопка */}
              {onExpandProfile && (
                <button
                  style={styles.expandButton}
                  data-card-control="true"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onExpandProfile();
                  }}
                >
                  <ChevronUp size={24} color="#fff" />
                </button>
              )}
            </div>
          )}

          {/* Кнопки Heart / X справа по центру */}
          {!isBlurred && isInteractive && (
            <div style={styles.actionButtons}>
              <button
                style={styles.heartButton}
                data-card-control="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onLike) onLike();
                }}
              >
                <Heart size={28} fill="currentColor" />
              </button>
              <button
                style={styles.skipButton}
                data-card-control="true"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSkip) onSkip();
                }}
              >
                <X size={24} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

// ===== STYLES =====
// Solid backgrounds вместо backdropFilter — убирает GPU-тяжёлый blur compositing
const solidCircle = {
  borderRadius: '50%',
  background: 'rgba(0, 0, 0, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  outline: 'none',
};

const solidPill = {
  background: 'rgba(0, 0, 0, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  color: '#fff',
  padding: '6px 12px',
  borderRadius: 12,
  fontSize: 12,
  fontWeight: 700,
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  whiteSpace: 'nowrap',
};

const styles = {
  card: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.card,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    touchAction: 'none',
    userSelect: 'none',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    willChange: 'transform',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    cursor: 'grab',
    overflow: 'hidden',
    flex: 1,
  },
  photosStack: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  avatarImage: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    // Только opacity transition для смены фото, без transform/filter transitions
    transition: 'opacity 0.25s ease',
  },
  avatarImageBackdrop: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    transform: 'scale(1.08)',
    filter: 'blur(14px)',
    opacity: 0.42,
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: 0,
    transition: 'opacity 0.25s ease',
  },
  imageSkeleton: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`,
    zIndex: 5,
    overflow: 'hidden',
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0, left: '-100%', right: 0, bottom: 0,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
    animation: 'shimmer 2s infinite',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    gap: 16,
    background: 'rgba(0, 0, 0, 0.3)',
  },
  blurBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(0, 0, 0, 0.6)',
    padding: '6px 12px',
    borderRadius: 20,
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
  },
  showPhotoButton: {
    padding: '12px 24px',
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 16,
    fontSize: 15,
    fontWeight: 700,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    cursor: 'pointer',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 80,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.1)',
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`,
  },
  indicatorsRow: {
    position: 'absolute',
    top: 10, left: 10, right: 10,
    display: 'flex',
    gap: 4,
    zIndex: 10,
  },
  indicator: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
    transition: 'opacity 0.2s',
  },

  // === Инфо-оверлей ===
  bottomGradient: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 3,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    padding: 20,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    zIndex: 5,
    pointerEvents: 'none',
  },
  infoLeft: {
    flex: 1,
    paddingRight: 56,
    pointerEvents: 'none',
  },
  nameRow: {
    marginBottom: 4,
  },
  profileName: {
    fontSize: 32,
    fontWeight: 800,
    color: '#fff',
    margin: 0,
    lineHeight: 1,
    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
  },
  uniRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: 500,
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
    marginBottom: 12,
  },
  badgesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  uniBadge: {
    backgroundColor: 'rgba(212, 255, 0, 0.9)',
    color: '#000',
    padding: '6px 12px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 700,
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  goalPill: {
    ...solidPill,
  },
  goalPillCommon: {
    ...solidPill,
    background: d.commonBg,
    border: `1px solid ${d.commonBorder}`,
    color: d.accent,
    boxShadow: d.commonGlow,
  },
  interestPill: {
    ...solidPill,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 140,
  },
  expandButton: {
    ...solidCircle,
    width: 44,
    height: 44,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'auto',
    flexShrink: 0,
  },

  // === Кнопки действий справа ===
  actionButtons: {
    position: 'absolute',
    top: '50%',
    right: 16,
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 15,
  },
  heartButton: {
    ...solidCircle,
    width: 56,
    height: 56,
    color: d.pink,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  },
  skipButton: {
    ...solidCircle,
    width: 48,
    height: 48,
    color: 'rgba(255, 255, 255, 0.7)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    marginLeft: 4,
  },
};

export default ProfileCard;
