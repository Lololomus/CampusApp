// ===== 📄 ФАЙЛ: src/components/dating/ProfileCard.js =====

import React, { useState, useEffect, useRef } from 'react';
import { Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import theme from '../../theme';
import PhotoViewer from '../shared/PhotoViewer';

function ProfileCard({
  profile,
  onSwipeStart,
  onSwipeMove,
  onSwipeEnd,
  isBlurred = false,
  onRegisterTrigger,
  isInteractive = true,
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const dragDistanceRef = useRef(0);

  const photos = profile?.photos && profile.photos.length > 0
    ? profile.photos
    : (profile?.avatar ? [profile.avatar] : []);

  useEffect(() => {
    setImageLoaded(false);
    setPhotoIndex(0);
  }, [profile?.id]);

  if (!profile) return null;

  const maxDrag = 350;

  // ===== ЛОГИКА КЛИКА (TAP) =====
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
        setShowPhotoViewer(true);
      }
    } catch (e) {
      console.error('Tap error:', e);
    }
  };

  // ===== TOUCH EVENTS =====
  const handleTouchStart = (e) => {
    if (!isInteractive) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = e.touches[0].clientX;
    dragDistanceRef.current = 0;
    setIsDragging(true);
    if (onSwipeStart) onSwipeStart();
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isInteractive) return;
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
    if (!isInteractive) return;
    setIsDragging(false);
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
    e.preventDefault();
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    currentXRef.current = e.clientX;
    dragDistanceRef.current = 0;
    setIsDragging(true);
    if (onSwipeStart) onSwipeStart();

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      currentXRef.current = moveEvent.clientX;
      dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(deltaX));
      let delta = Math.max(-maxDrag, Math.min(maxDrag, deltaX));
      if (onSwipeMove) onSwipeMove(delta);
    };

    const handleMouseUp = (upEvent) => {
      setIsDragging(false);
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
          onClose={() => setShowPhotoViewer(false)}
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
          {/* ✅ НОВОЕ: Crossfade для плавного переключения фото */}
          {photos.length > 0 ? (
            <div style={styles.photosStack}>
              {photos.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo?.url || photo}
                  alt={`${profile.name} - фото ${idx + 1}`}
                  draggable={false}
                  onLoad={() => {
                    if (idx === 0) setImageLoaded(true);
                  }}
                  style={{
                    ...styles.avatarImage,
                    opacity: idx === photoIndex ? 1 : 0,
                    zIndex: idx === photoIndex ? 2 : 1,
                    filter: isBlurred ? 'blur(24px) brightness(0.8)' : 'none',
                    transform: isBlurred ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={styles.avatarPlaceholder}>
              {profile.name?.charAt(0) || '?'}
            </div>
          )}

          {/* Loading skeleton */}
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

          {/* Navigation buttons */}
          {!isBlurred && photos.length > 1 && isInteractive && (
            <>
              {photoIndex > 0 && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex(prev => prev - 1);
                  }}
                  style={styles.navButtonLeft}
                >
                  <ChevronLeft size={32} strokeWidth={3} />
                </button>
              )}

              {photoIndex < photos.length - 1 && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhotoIndex(prev => prev + 1);
                  }}
                  style={styles.navButtonRight}
                >
                  <ChevronRight size={28} strokeWidth={2.5} />
                </button>
              )}
            </>
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
        </div>
      </div>
    </>
  );
}

// ===== Profile card STYLES =====
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
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.bgSecondary,
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
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
    userSelect: 'none',
    transition: 'opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease',
  },
  imageSkeleton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`,
    zIndex: 5,
    overflow: 'hidden'
  },
  skeletonShimmer: {
    position: 'absolute',
    top: 0,
    left: '-100%',
    right: 0,
    bottom: 0,
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
    animation: 'shimmer 2s infinite'
  },
  navButtonLeft: {
    position: 'absolute',
    top: '50%',
    left: 12,
    transform: 'translateY(-50%)',
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'none',
    outline: 'none',
  },
  navButtonRight: {
    position: 'absolute',
    top: '50%',
    right: 12,
    transform: 'translateY(-50%)',
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(8px)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'none',
    outline: 'none',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    gap: 16,
    background: 'rgba(0, 0, 0, 0.3)'
  },
  blurBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(0, 0, 0, 0.6)',
    padding: '6px 12px',
    borderRadius: 20,
    backdropFilter: 'blur(4px)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600
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
    cursor: 'pointer'
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
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`
  },
  indicatorsRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    display: 'flex',
    gap: 4,
    zIndex: 10
  },
  indicator: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
    transition: 'opacity 0.2s'
  },
};

export default ProfileCard;