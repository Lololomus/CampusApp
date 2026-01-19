import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Flame } from 'lucide-react';
import { useStore } from '../../store';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';

function Particle({ delay, type }) {
  const [remove, setRemove] = useState(false);
  
  const randomX = Math.random() * 100;
  const randomDuration = 3 + Math.random() * 2;
  const randomDelay = delay || Math.random() * 2;
  
  const emoji = type === 'heart' ? '💗' : type === 'star' ? '✨' : '💫';
  
  return (
    <motion.div
      style={{
        position: 'absolute',
        left: `${randomX}%`,
        bottom: '-20px',
        fontSize: type === 'heart' ? '20px' : '16px',
        opacity: 0.7,
        pointerEvents: 'none',
        zIndex: 1,
      }}
      initial={{ y: 0, opacity: 0, scale: 0 }}
      animate={{ 
        y: -window.innerHeight - 100, 
        opacity: [0, 0.7, 0.7, 0],
        scale: [0, 1, 1, 0.5],
        rotate: [0, 15, -15, 0],
      }}
      transition={{ 
        duration: randomDuration, 
        delay: randomDelay,
        ease: 'easeOut',
      }}
      onAnimationComplete={() => setRemove(true)}
    >
      {!remove && emoji}
    </motion.div>
  );
}

function MatchModal() {
  const { showMatchModal, matchedUser, setShowMatchModal, datingProfile } = useStore();
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (showMatchModal) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      }

      const particleTypes = ['heart', 'star', 'sparkle'];
      const newParticles = Array.from({ length: 18 }, (_, i) => ({
        id: i,
        type: particleTypes[Math.floor(Math.random() * particleTypes.length)],
        delay: i * 0.15,
      }));
      setParticles(newParticles);

      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [showMatchModal]);

  const handleClose = () => {
    hapticFeedback('light');
    setShowMatchModal(false);
  };

  const handleMessage = () => {
    hapticFeedback('medium');
    console.log('Open chat with:', matchedUser);
    setShowMatchModal(false);
  };

  if (!showMatchModal || !matchedUser) return null;

  const myPhoto = datingProfile?.photos?.[0]?.url;
  const myName = datingProfile?.name;
  const theirPhoto = matchedUser?.photos?.[0]?.url || matchedUser?.avatar;
  const theirName = matchedUser?.name;

  // Только общие интересы, БЕЗ университета
  const myInterests = datingProfile?.interests || [];
  const theirInterests = matchedUser?.interests || [];
  const commonInterests = myInterests.filter(i => theirInterests.includes(i));
  
  const INTEREST_LABELS = {
    it: '💻 IT',
    games: '🎮 Игры',
    books: '📚 Книги',
    music: '🎵 Музыка',
    movies: '🎬 Кино',
    sport: '⚽ Спорт',
    art: '🎨 Искусство',
    travel: '✈️ Путешествия',
    coffee: '☕ Кофе',
    party: '🎉 Вечеринки',
    photo: '📸 Фото',
    food: '🍕 Еда',
    science: '🎓 Наука',
    startup: '🚀 Стартапы',
    fitness: '🏋️ Фитнес',
  };

  let matchHint = null;
  if (commonInterests.length > 0) {
    const firstCommon = commonInterests[0];
    matchHint = `Вам обоим нравится ${INTEREST_LABELS[firstCommon] || firstCommon}`;
  }

  return (
    <AnimatePresence>
      <motion.div
        style={styles.overlay}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={handleClose}
      >
        {particles.map((particle) => (
          <Particle key={particle.id} delay={particle.delay} type={particle.type} />
        ))}

        <motion.div
          style={styles.content}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.h1
            style={styles.title}
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}
          >
            <motion.span
              animate={{ 
                opacity: [1, 0.88, 1],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: 'easeInOut' 
              }}
            >
              IT'S A MATCH!
            </motion.span>
          </motion.h1>

          {/* Photos Section */}
          <div style={styles.photosSection}>
            {/* Photos Row - фото + сердечко между ними */}
            <div style={styles.photosRow}>
              {/* Left Photo */}
              <motion.div
                initial={{ x: -150, rotate: -30, opacity: 0, scale: 0.5 }}
                animate={{ x: 0, rotate: -6, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.2 }}
              >
                {myPhoto ? (
                  <img src={myPhoto} alt={myName} style={styles.photo} />
                ) : (
                  <div style={styles.photoPlaceholder}>
                    {myName?.charAt(0) || '?'}
                  </div>
                )}
              </motion.div>

              {/* Heart - МЕЖДУ фото в spacer */}
              <motion.div
                style={styles.heartBetween}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ 
                  scale: 1, 
                  rotate: 0,
                }}
                transition={{ 
                  type: 'spring', 
                  stiffness: 250, 
                  damping: 12, 
                  delay: 0.45 
                }}
              >
                <motion.div
                  style={styles.heartInner}
                  animate={{ 
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ 
                    duration: 1.8, 
                    repeat: Infinity, 
                    ease: 'easeInOut' 
                  }}
                >
                  💗
                </motion.div>
              </motion.div>

              {/* Right Photo */}
              <motion.div
                initial={{ x: 150, rotate: 30, opacity: 0, scale: 0.5 }}
                animate={{ x: 0, rotate: 6, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.2 }}
              >
                {theirPhoto ? (
                  <img src={theirPhoto} alt={theirName} style={styles.photo} />
                ) : (
                  <div style={styles.photoPlaceholder}>
                    {theirName?.charAt(0) || '?'}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Names Row */}
            <div style={styles.namesRow}>
              <motion.div
                style={styles.photoName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                {myName || 'Вы'}
              </motion.div>

              <div style={styles.namesSpacer} />

              <motion.div
                style={styles.photoName}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                {theirName}
              </motion.div>
            </div>
          </div>

          {/* Subtitle */}
          <motion.div
            style={styles.subtitleContainer}
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <p style={styles.subtitle}>
              Вы понравились друг другу! 💕
            </p>
            {matchHint && (
              <motion.p
                style={styles.hint}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.0 }}
              >
                {matchHint}
              </motion.p>
            )}
          </motion.div>

          {/* Buttons */}
          <motion.div
            style={styles.buttonsContainer}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, type: 'spring', stiffness: 200 }}
          >
            <motion.button
              style={styles.primaryButton}
              onClick={handleMessage}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
            >
              <MessageCircle size={22} strokeWidth={2.5} />
              <span>Написать сообщение</span>
            </motion.button>

            <motion.button
              style={styles.secondaryButton}
              onClick={handleClose}
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.01 }}
            >
              <Flame size={20} strokeWidth={2.5} />
              <span>Продолжить</span>
            </motion.button>
          </motion.div>
        </motion.div>

        <div style={styles.glowTop} />
        <div style={styles.glowBottom} />
      </motion.div>
    </AnimatePresence>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'radial-gradient(circle at center, rgba(255, 59, 92, 0.18) 0%, rgba(10, 10, 10, 0.97) 60%)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 10,
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 24,
  },
  title: {
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: '1.5px',
    textAlign: 'center',
    margin: 0,
    marginBottom: 8,
    background: 'linear-gradient(135deg, #ff3b5c 0%, #ff6b9d 50%, #f093fb 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    filter: 'drop-shadow(0 2px 12px rgba(255, 59, 92, 0.5))',
  },
  photosSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  photosRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 18,
    objectFit: 'cover',
    border: '4px solid #fff',
    boxShadow: '0 0 35px rgba(255, 107, 157, 0.5), 0 8px 25px rgba(0, 0, 0, 0.4)',
  },
  photoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 18,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: '4px solid #fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 44,
    fontWeight: 800,
    color: '#fff',
    boxShadow: '0 0 35px rgba(255, 107, 157, 0.5), 0 8px 25px rgba(0, 0, 0, 0.4)',
  },
  heartBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  heartInner: {
    fontSize: 56,
    filter: 'drop-shadow(0 4px 18px rgba(255, 107, 157, 0.9))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  namesRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  photoName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 2px 6px rgba(0, 0, 0, 0.5)',
    width: 110,
    textAlign: 'center',
  },
  namesSpacer: {
    width: 96,
    flexShrink: 0,
  },
  subtitleContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    margin: 0,
    textShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
  },
  hint: {
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    margin: 0,
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
  },
  buttonsContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    border: 'none',
    borderRadius: 18,
    color: '#fff',
    fontSize: 17,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    cursor: 'pointer',
    boxShadow: '0 8px 28px rgba(245, 87, 108, 0.5)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  secondaryButton: {
    width: '100%',
    height: 50,
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    border: '1.5px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
    transition: 'transform 0.2s, background 0.2s, border 0.2s',
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '70%',
    height: '250px',
    background: 'radial-gradient(ellipse at top, rgba(240, 147, 251, 0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  glowBottom: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '70%',
    height: '250px',
    background: 'radial-gradient(ellipse at bottom, rgba(245, 87, 108, 0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
    zIndex: 1,
  },
};

export default MatchModal;