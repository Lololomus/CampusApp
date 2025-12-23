import React, { useEffect, useState } from 'react';
import { X, Heart } from 'lucide-react';
import { useStore } from '../../store';
import { getWhoLikedMe, likeUser } from '../../api';

function LikesListModal() {
  const { setShowLikesModal, whoLikedMe, setWhoLikedMe, setShowMatchModal } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWhoLikedMe();
  }, []);

  const loadWhoLikedMe = async () => {
    try {
      const users = await getWhoLikedMe(20, 0);
      setWhoLikedMe(users);
    } catch (error) {
      console.error('Ошибка загрузки лайков:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setShowLikesModal(false);
  };

  const handleSkip = (userId) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    setWhoLikedMe(whoLikedMe.filter(u => u.id !== userId));
  };

  const handleLike = async (user) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }

    try {
      const result = await likeUser(user.id);
      
      // Убираем из списка
      setWhoLikedMe(whoLikedMe.filter(u => u.id !== user.id));

      // Если матч
      if (result.is_match) {
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        }
        setShowLikesModal(false);
        setShowMatchModal(true, result.matched_user);
      }
    } catch (error) {
      console.error('Ошибка лайка:', error);
      alert('Не удалось отправить лайк');
    }
  };

  return (
    <>
      {/* Overlay */}
      <div style={styles.overlay} onClick={handleClose} />

      {/* Modal */}
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>💜 Вас лайкнули</h2>
          <button style={styles.closeButton} onClick={handleClose}>
            <X size={24} />
          </button>
        </div>

        <p style={styles.subtitle}>
          {whoLikedMe.length} {whoLikedMe.length === 1 ? 'человек ждёт' : 'человек ждут'} вашего ответа
        </p>

        {/* Content */}
        <div style={styles.content}>
          {loading ? (
            <div style={styles.loadingContainer}>
              <div style={styles.spinner} />
              <p>Загрузка...</p>
            </div>
          ) : whoLikedMe.length === 0 ? (
            <div style={styles.emptyContainer}>
              <span style={styles.emptyEmoji}>💔</span>
              <p style={styles.emptyText}>Пока никто не лайкнул</p>
              <p style={styles.emptySubtext}>Продолжай знакомиться!</p>
              <button style={styles.backButton} onClick={handleClose}>
                ← Вернуться к ленте
              </button>
            </div>
          ) : (
            <div style={styles.list}>
              {whoLikedMe.map((user, index) => (
                <div
                  key={user.id}
                  style={{
                    ...styles.card,
                    animationDelay: `${index * 80}ms`,
                  }}
                >
                  {/* Avatar */}
                  <div style={styles.cardAvatar}>
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name} style={styles.avatarImg} />
                    ) : (
                      <div style={styles.avatarPlaceholder}>
                        {user.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={styles.cardInfo}>
                    <h3 style={styles.cardName}>
                      {user.name}{user.age ? `, ${user.age}` : ''}
                    </h3>
                    <p style={styles.cardUniversity}>
                      {user.university} · {user.institute}
                      {user.course && ` · ${user.course} курс`}
                    </p>
                    {user.interests && user.interests.length > 0 && (
                      <div style={styles.cardTags}>
                        {user.interests.slice(0, 3).map((tag, idx) => (
                          <span key={idx} style={styles.tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={styles.cardActions}>
                    <button
                      style={styles.skipBtn}
                      onClick={() => handleSkip(user.id)}
                    >
                      <X size={20} />
                    </button>
                    <button
                      style={styles.likeBtn}
                      onClick={() => handleLike(user)}
                    >
                      <Heart size={20} fill="white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    zIndex: 1000,
    animation: 'fadeIn 0.3s ease-out',
  },
  modal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90vh',
    background: 'var(--tg-theme-bg-color, #1a1a1a)',
    borderRadius: '24px 24px 0 0',
    zIndex: 1001,
    animation: 'slideUp 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 0',
  },
  title: {
    fontSize: '22px',
    fontWeight: 'bold',
    margin: 0,
    color: 'var(--tg-theme-text-color, #fff)',
  },
  closeButton: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'rgba(0, 0, 0, 0.05)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--tg-theme-text-color, #fff)',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--tg-theme-hint-color, #888)',
    margin: '4px 0 16px',
    paddingLeft: '20px',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px 20px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    gap: '12px',
  },
  spinner: {
    width: '32px',
    height: '32px',
    border: '3px solid rgba(135, 116, 225, 0.2)',
    borderTop: '3px solid #8774e1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    textAlign: 'center',
  },
  emptyEmoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: 'var(--tg-theme-text-color, #fff)',
    margin: '0 0 4px 0',
  },
  emptySubtext: {
    fontSize: '14px',
    color: 'var(--tg-theme-hint-color, #888)',
    marginBottom: '24px',
  },
  backButton: {
    padding: '12px 24px',
    borderRadius: '12px',
    border: '2px solid #8774e1',
    background: 'transparent',
    color: '#8774e1',
    fontSize: '15px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'var(--tg-theme-secondary-bg-color, #2a2a2a)',
    borderRadius: '16px',
    animation: 'slideUp 0.3s ease-out both',
  },
  cardAvatar: {
    flexShrink: 0,
  },
  avatarImg: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '20px',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: '17px',
    fontWeight: 'bold',
    margin: '0 0 4px 0',
    color: 'var(--tg-theme-text-color, #fff)',
  },
  cardUniversity: {
    fontSize: '13px',
    color: 'var(--tg-theme-hint-color, #888)',
    margin: '0 0 8px 0',
  },
  cardTags: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: '12px',
    padding: '4px 8px',
    background: 'rgba(135, 116, 225, 0.1)',
    color: '#8774e1',
    borderRadius: '8px',
  },
  cardActions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  skipBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid #666',
    background: 'transparent',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  likeBtn: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    background: '#8774e1',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(135, 116, 225, 0.4)',
  },
};

export default LikesListModal;