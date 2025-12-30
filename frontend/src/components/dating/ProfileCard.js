// ===== 📄 ФАЙЛ: src/components/dating/ProfileCard.js =====

import React, { useState, useEffect } from 'react';
import { GraduationCap, Calendar, Lock } from 'lucide-react';
import theme from '../../theme';

function ProfileCard({ 
  profile, 
  onSkip, 
  onAction, 
  isAnimating, 
  swipeDirection,
  isBlurred = false,
  onRegisterTrigger
}) {
  // 1. ХУКИ (Всегда в начале, безусловно)
  const [photoIndex, setPhotoIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Безопасное получение данных (даже если profile = null)
  const photos = profile?.photos && profile.photos.length > 0 
    ? profile.photos 
    : (profile?.avatar ? [profile.avatar] : []);

  // 2. ЭФФЕКТЫ (Тоже до return)
  useEffect(() => {
    setImageLoaded(false);
  }, [photoIndex, profile?.id]); // Используем опциональную цепочку ?.

  // 3. EARLY RETURN (Только после всех хуков)
  if (!profile) return null;

  // 4. ЛОГИКА И РЕНДЕР
  let animationStyle = 'slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
  if (isAnimating) {
    if (swipeDirection === 'left') animationStyle = 'swipeLeft 0.4s ease-out forwards';
    else if (swipeDirection === 'right') animationStyle = 'swipeRight 0.4s ease-out forwards';
  }

  const handleTap = (e) => {
    if (isBlurred) {
      if (onRegisterTrigger) onRegisterTrigger();
      return;
    }
    if (photos.length <= 1) return;
    const { clientX, currentTarget } = e;
    const { left, width } = currentTarget.getBoundingClientRect();
    const x = clientX - left;
    if (x < width * 0.35) {
      if (photoIndex > 0) setPhotoIndex(prev => prev - 1);
    } else {
      if (photoIndex < photos.length - 1) setPhotoIndex(prev => prev + 1);
    }
  };

  const cardStyle = { ...styles.card, animation: animationStyle };

  return (
    <>
      <style>{keyframes}</style>
      <div style={cardStyle}>
        
        {/* === ФОТО ГАЛЕРЕЯ === */}
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

          {/* SKELETON */}
          {!imageLoaded && photos.length > 0 && (
            <div style={styles.imageSkeleton} />
          )}

          {/* OVERLAY */}
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

          {/* INDICATORS */}
          {!isBlurred && photos.length > 1 && imageLoaded && (
            <div style={styles.indicatorsRow}>
              {photos.map((_, idx) => (
                <div key={idx} style={{...styles.indicator, opacity: idx === photoIndex ? 1 : 0.4}} />
              ))}
            </div>
          )}

          <div style={styles.gradientOverlay} />
        </div>

        {/* === INFO === */}
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
  },

  imageContainer: {
    position: 'relative', flex: '1 1 65%', width: '100%',
    backgroundColor: theme.colors.bgSecondary,
    cursor: 'pointer', overflow: 'hidden',
  },
  avatarImage: {
    width: '100%', height: '100%', objectFit: 'cover',
    pointerEvents: 'none',
    transition: 'filter 0.3s ease, transform 0.3s ease, opacity 0.5s ease',
  },
  imageSkeleton: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: `linear-gradient(135deg, ${theme.colors.bgSecondary} 0%, ${theme.colors.card} 100%)`,
    animation: 'pulseSkeleton 1.5s infinite ease-in-out', zIndex: 5,
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
  @keyframes swipeLeft { to { transform: translateX(-150%) rotate(-10deg); opacity: 0; } }
  @keyframes swipeRight { to { transform: translateX(150%) rotate(10deg); opacity: 0; } }
  @keyframes pulseSkeleton { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
`;

export default ProfileCard;