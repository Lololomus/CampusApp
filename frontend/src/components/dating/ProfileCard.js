// ===== 📄 ФАЙЛ: src/components/dating/ProfileCard.js =====

import React, { useState, useEffect, useRef } from 'react';
import { GraduationCap, Calendar, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import theme from '../../theme';
import PhotoViewer from '../shared/PhotoViewer';

function ProfileCard({ 
  profile, 
  onSkip, 
  onAction, 
  isAnimating, 
  swipeDirection,
  isBlurred = false,
  onRegisterTrigger,
  isInteractive = true, // ✅ NEW: для стопки карточек
  style = {} // ✅ NEW: для позиционирования в стопке
}) {
  // ===== HOOKS =====
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);

  // ✅ NEW: Свайп жесты
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const cardRef = useRef(null);

  const photos = profile?.photos && profile.photos.length > 0 
    ? profile.photos 
    : (profile?.avatar ? [profile.avatar] : []);

  // Reset image loaded при смене фото
  useEffect(() => {
    setImageLoaded(false);
  }, [photoIndex, profile?.id]);

  // Early return
  if (!profile) return null;

  // ===== АНИМАЦИЯ =====
  let animationStyle = 'slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
  if (isAnimating) {
    // ✅ ИЗМЕНЕНО: 0.4s → 0.6s (задача 6)
    if (swipeDirection === 'left') animationStyle = 'swipeLeft 0.6s ease-out forwards';
    else if (swipeDirection === 'right') animationStyle = 'swipeRight 0.6s ease-out forwards';
  }

  // ===== СВАЙП ЛОГИКА (задача 4) =====
  const handleTouchStart = (e) => {
    if (!isInteractive || isBlurred) return;
    startXRef.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !isInteractive) return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - startXRef.current;
    setDragX(delta);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !isInteractive) return;
    
    const threshold = 100;
    
    if (Math.abs(dragX) > threshold) {
      if (dragX > 0 && onAction) {
        onAction(); // Лайк
      } else if (dragX < 0 && onSkip) {
        onSkip(); // Skip
      }
    }
    
    setDragX(0);
    setIsDragging(false);
  };

  // ===== TAP НАВИГАЦИЯ (оригинал + показ шевронов) =====
  const handleTap = (e) => {
    if (isBlurred) {
      if (onRegisterTrigger) onRegisterTrigger();
      return;
    }
    
    // ✅ NEW: Клик по центру = PhotoViewer
    const { clientX, currentTarget } = e;
    const { left, width } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    const centerZone = width * 0.3; // 30% по краям для навигации
    
    if (x < centerZone && photoIndex > 0) {
      // Лево
      setPhotoIndex(prev => prev - 1);
    } else if (x > width - centerZone && photoIndex < photos.length - 1) {
      // Право
      setPhotoIndex(prev => prev + 1);
    } else {
      // Центр = открываем viewer
      setShowPhotoViewer(true);
    }
  };

  // ===== НАВИГАЦИЯ ШЕВРОНАМИ (задача 1) =====
  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    if (photoIndex > 0) setPhotoIndex(prev => prev - 1);
  };

  const handleNextPhoto = (e) => {
    e.stopPropagation();
    if (photoIndex < photos.length - 1) setPhotoIndex(prev => prev + 1);
  };

  // ===== СТИЛИ С ТРАНСФОРМАЦИЕЙ =====
  const cardStyle = { 
    ...styles.card, 
    ...style, // ✅ NEW: для стопки
    animation: animationStyle,
    // ✅ NEW: Свайп трансформация
    transform: isDragging 
      ? `translateX(${dragX}px) rotate(${dragX * 0.1}deg) ${style.transform || ''}`
      : style.transform || 'none',
    transition: isDragging ? 'none' : 'transform 0.3s ease-out',
  };

  // ✅ NEW: Цветной оверлей при свайпе
  const overlayOpacity = Math.min(Math.abs(dragX) / 200, 0.8);
  const showLikeOverlay = dragX > 50;
  const showNopeOverlay = dragX < -50;

  return (
    <>
      <style>{keyframes}</style>

      {showPhotoViewer && (
        <PhotoViewer
          photos={photos}
          initialIndex={photoIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      <div 
        ref={cardRef}
        style={cardStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* ===== ФОТО ГАЛЕРЕЯ ===== */}
        <div style={styles.imageContainer} onClick={handleTap}>
          
          {photos.length > 0 ? (
            <img 
              src={photos[photoIndex].url || photos[photoIndex]} 
              alt={profile.name} 
              onLoad={() => setImageLoaded(true)} 
              style={{
                ...styles.avatarImage,
                filter: isBlurred ? 'blur(24px) brightness(0.8)' : 'none',
                transform: isBlurred ? 'scale(1.1)' : 'scale(1)',
                opacity: imageLoaded ? 1 : 0, 
              }} 
            />
          ) : (
            <div style={styles.avatarPlaceholder}>
              {profile.name?.charAt(0) || '?'}
            </div>
          )}

          {/* ✅ УЛУЧШЕН: SKELETON (задача 7) */}
          {!imageLoaded && photos.length > 0 && (
            <div style={styles.imageSkeleton}>
              <div style={styles.skeletonShimmer} />
            </div>
          )}

          {/* ✅ NEW: СВАЙП ОВЕРЛЕИ (задача 4) */}
          {showLikeOverlay && (
            <div style={{...styles.swipeOverlay, backgroundColor: `rgba(76, 175, 80, ${overlayOpacity})`}}>
              <div style={styles.swipeLabel}>❤️ LIKE</div>
            </div>
          )}
          {showNopeOverlay && (
            <div style={{...styles.swipeOverlay, backgroundColor: `rgba(244, 67, 54, ${overlayOpacity})`}}>
              <div style={styles.swipeLabel}>✕ NOPE</div>
            </div>
          )}

          {/* BLUR OVERLAY (оригинал) */}
          {isBlurred && (
            <div style={styles.blurOverlay}>
              <div style={styles.blurBadge}>
                <Lock size={16} />
                <span>Скрыто</span>
              </div>
              <button style={styles.showPhotoButton}>
                Показать фото
              </button>
            </div>
          )}

          {/* ШЕВРОНЫ ВСЕГДА ВИДНЫ */}
          {!isBlurred && photos.length > 1 && isInteractive && (
            <>
              {photoIndex > 0 && (
                <button 
                  style={styles.navButtonLeft} 
                  onClick={handlePrevPhoto}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <ChevronLeft size={32} strokeWidth={3} />
                </button>
              )}
              {photoIndex < photos.length - 1 && (
                <button 
                  style={styles.navButtonRight} 
                  onClick={handleNextPhoto}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <ChevronRight size={32} strokeWidth={3} />
                </button>
              )}
            </>
          )}

          {/* INDICATORS (оригинал) */}
          {!isBlurred && photos.length > 1 && imageLoaded && (
            <div style={styles.indicatorsRow}>
              {photos.map((_, idx) => (
                <div key={idx} style={{...styles.indicator, opacity: idx === photoIndex ? 1 : 0.4}} />
              ))}
            </div>
          )}

          <div style={styles.gradientOverlay} />
        </div>

        {/* ===== INFO (оригинал) ===== */}
        <div style={styles.content}>
          <div style={styles.header}>
            <h2 style={styles.name}>
              {profile.name}, <span style={styles.age}>{profile.age}</span>
            </h2>
            <div style={styles.onlineBadge} />
          </div>
          <div style={styles.infoSection}>
            <div style={styles.infoItem}><GraduationCap size={16} color={theme.colors.primary} /><span>{profile.university} • {profile.institute}</span></div>
            {profile.course && <div style={styles.infoItem}><Calendar size={16} color={theme.colors.primary} /><span>{profile.course} курс</span></div>}
          </div>
          {profile.goals && profile.goals.length > 0 && (
            <div style={styles.goalsRow}>{profile.goals.map((goal, i) => <span key={i} style={styles.goalTag}>{goal}</span>)}</div>
          )}
          {profile.bio && <div style={styles.bioSection}><p style={styles.bioText}>{profile.bio}</p></div>}
          {profile.interests && profile.interests.length > 0 && (
            <div style={styles.interestsRow}>{profile.interests.map((tag, i) => <span key={i} style={styles.interestTag}>#{tag}</span>)}</div>
          )}
        </div>
      </div>
    </>
  );
}

// ===== STYLES =====
const styles = {
  card: {
    position: 'relative', width: '100%', height: '100%',
    backgroundColor: theme.colors.card, borderRadius: 24,
    overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
    display: 'flex', flexDirection: 'column',
    touchAction: 'pan-y', // ✅ Разрешаем вертикальный скролл, но блокируем горизонтальный
  },

  imageContainer: {
    position: 'relative',
    height: '65vh', // ✅ ИЗМЕНЕНО: фиксированная высота (задача 3)
    minHeight: '400px',
    maxHeight: '600px',
    width: '100%',
    backgroundColor: theme.colors.bgSecondary,
    cursor: 'pointer', overflow: 'hidden',
  },
  avatarImage: {
    width: '100%', height: '100%',
    objectFit: 'cover', // ✅ ИЗМЕНЕНО: обрезает края (задача 3)
    pointerEvents: 'none',
    transition: 'filter 0.3s ease, transform 0.3s ease, opacity 0.5s ease',
  },
  
  // ✅ УЛУЧШЕН: Skeleton (задача 7)
  imageSkeleton: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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

  // ✅ NEW: Свайп оверлеи (задача 4)
  swipeOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 15, pointerEvents: 'none',
  },
  swipeLabel: {
    fontSize: 48, fontWeight: 900, color: '#fff',
    textShadow: '0 4px 12px rgba(0,0,0,0.5)',
    transform: 'rotate(-15deg)',
  },

  // ✅ NEW: Шевроны навигации (задача 1)
  navButtonLeft: {
    position: 'absolute', top: '50%', left: 12,
    transform: 'translateY(-50%)',
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)',
    border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'background 0.2s, transform 0.2s',
  },
  navButtonRight: {
    position: 'absolute', top: '50%', right: 12,
    transform: 'translateY(-50%)',
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(8px)',
    border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', zIndex: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    transition: 'background 0.2s, transform 0.2s',
  },

  blurOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    zIndex: 20, gap: 16,
  },
  blurBadge: { display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0, 0, 0, 0.6)', padding: '6px 12px', borderRadius: 20, backdropFilter: 'blur(4px)', color: '#fff', fontSize: 13, fontWeight: 600, },
  showPhotoButton: { padding: '12px 24px', background: '#fff', color: '#000', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', cursor: 'pointer', },
  avatarPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, fontWeight: 'bold', color: 'rgba(255,255,255,0.1)', background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`, },
  gradientOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px', background: 'linear-gradient(to top, rgba(30,30,30, 1) 0%, transparent 100%)', zIndex: 1, },
  indicatorsRow: { position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 4, zIndex: 10, },
  indicator: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)', transition: 'opacity 0.2s', },
  
  content: { flex: '0 0 auto', padding: '16px 20px 24px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: theme.colors.card, zIndex: 2, marginTop: -20, borderRadius: '24px 24px 0 0', },
  header: { display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontSize: 26, fontWeight: 800, color: theme.colors.text, margin: 0 },
  age: { fontWeight: 400 },
  onlineBadge: { width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', marginTop: 4 },
  infoSection: { display: 'flex', flexDirection: 'column', gap: 6 },
  infoItem: { display: 'flex', alignItems: 'center', gap: 8, color: theme.colors.textSecondary, fontSize: 14 },
  goalsRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  goalTag: { padding: '4px 10px', borderRadius: 12, backgroundColor: 'rgba(245, 87, 108, 0.15)', color: '#f5576c', fontSize: 12, fontWeight: 600 },
  bioSection: { marginTop: 4 },
  bioText: { fontSize: 15, lineHeight: 1.4, color: theme.colors.text, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  interestsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  interestTag: { fontSize: 12, color: theme.colors.textTertiary, padding: '4px 8px', borderRadius: 8, backgroundColor: theme.colors.bg },
};

const keyframes = `
  @keyframes slideIn { from { opacity: 0; transform: scale(0.95) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  @keyframes swipeLeft { to { transform: translateX(-120%) rotate(-8deg); opacity: 0; } }
  @keyframes swipeRight { to { transform: translateX(120%) rotate(8deg); opacity: 0; } }
  @keyframes shimmer { to { left: 100%; } }
`;

export default ProfileCard;