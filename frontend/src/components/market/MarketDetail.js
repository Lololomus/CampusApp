// ===== 📄 ФАЙЛ: src/components/Market/MarketDetail.js =====

import React, { useState } from 'react';
import { useStore } from '../../store';
import { toggleMarketFavorite, deleteMarketItem } from '../../api';
import CreateMarketItem from './CreateMarketItem';
import theme from '../../theme';
import { Z_MARKET_DETAIL } from '../../constants/zIndex';

const MarketDetail = ({ item, onClose, onUpdate }) => {
  const { user, toggleMarketFavoriteOptimistic, deleteMarketItem: deleteFromStore } = useStore();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  const isOwner = item.seller_id === user?.id;
  const images = item.images || [];

  // ===== SWIPE HANDLING =====
  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (images.length <= 1) return;

    const swipeDistance = touchStart - touchEnd;
    const minSwipeDistance = 50;

    if (swipeDistance > minSwipeDistance && currentImageIndex < images.length - 1) {
      // Swipe left (next)
      setCurrentImageIndex(currentImageIndex + 1);
      haptic('light');
    }

    if (swipeDistance < -minSwipeDistance && currentImageIndex > 0) {
      // Swipe right (prev)
      setCurrentImageIndex(currentImageIndex - 1);
      haptic('light');
    }
  };

  // ===== ACTIONS =====
  const handleFavorite = async () => {
    haptic('medium');
    const newState = !item.is_favorited;
    toggleMarketFavoriteOptimistic(item.id, newState);

    try {
      await toggleMarketFavorite(item.id);
    } catch (error) {
      console.error('Ошибка toggle избранного:', error);
      toggleMarketFavoriteOptimistic(item.id, !newState);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Удалить объявление?')) return;

    haptic('heavy');
    setDeleting(true);

    try {
      await deleteMarketItem(item.id);
      deleteFromStore(item.id);
      onClose();
      onUpdate();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить товар');
    } finally {
      setDeleting(false);
    }
  };

  const handleContact = () => {
    haptic('medium');
    const username = item.seller?.username;
    
    if (username) {
      const message = encodeURIComponent(`Здравствуйте! Интересует "${item.title}"`);
      window.open(`https://t.me/${username}?text=${message}`, '_blank');
    } else {
      alert('У продавца не указан username');
    }
  };

  const handleShare = () => {
    haptic('light');
    
    if (window.Telegram?.WebApp) {
      const shareUrl = `${window.location.origin}/market/${item.id}`;
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    }
  };

  const handleMenu = () => {
    haptic('light');
    
    if (isOwner) {
      const action = window.confirm('Редактировать товар?');
      if (action) {
        setShowEditModal(true);
      }
    } else {
      // TODO: репорт
      alert('Пожаловаться (в разработке)');
    }
  };

  // ===== HELPERS =====
  const haptic = (type) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const getTimeAgo = () => {
    const now = new Date();
    const created = new Date(item.created_at);
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Сегодня';
    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дн. назад`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед. назад`;
    return `${Math.floor(diffDays / 30)} мес. назад`;
  };

  const getConditionText = () => {
    if (item.condition === 'new') return 'Новое';
    if (item.condition === 'like-new') return 'Как новое';
    if (item.condition === 'good') return 'Хорошее';
    if (item.condition === 'fair') return 'Удовлетворительное';
    return item.condition;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  // ===== RENDER =====
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <button style={styles.headerButton} onClick={onClose}>
            <span style={styles.headerIcon}>←</span>
          </button>

          <div style={styles.headerActions}>
            <button style={styles.headerButton} onClick={handleFavorite}>
              <span style={styles.headerIcon}>
                {item.is_favorited ? '❤️' : '🤍'}
              </span>
            </button>
            
            <button style={styles.headerButton} onClick={handleShare}>
              <span style={styles.headerIcon}>↗️</span>
            </button>
            
            <button style={styles.headerButton} onClick={handleMenu}>
              <span style={styles.headerIcon}>⋯</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={styles.content}>
          {/* Gallery */}
          {images.length > 0 && (
            <div style={styles.gallery}>
              <div
                style={styles.galleryTrack}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {images.map((img, index) => (
                  <div
                    key={index}
                    style={{
                      ...styles.gallerySlide,
                      transform: `translateX(-${currentImageIndex * 100}%)`,
                    }}
                  >
                    <img
                      src={img.url || img}
                      alt={`Фото ${index + 1}`}
                      style={styles.galleryImage}
                    />
                  </div>
                ))}
              </div>

              {/* Dots indicator */}
              {images.length > 1 && (
                <div style={styles.dots}>
                  {images.map((_, index) => (
                    <div
                      key={index}
                      style={{
                        ...styles.dot,
                        ...(index === currentImageIndex ? styles.dotActive : {}),
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Main Info */}
          <div style={styles.mainInfo}>
            {/* Цена */}
            <div style={styles.price}>
              {formatPrice(item.price)} ₽
            </div>

            {/* Название */}
            <div style={styles.title}>
              {item.title}
            </div>

            {/* ===== КОМПАКТНЫЙ ИНФО-БЛОК (3 СТРОКИ) ===== */}
            <div style={styles.infoBlock}>
              {/* Строка 1: Состояние */}
              <div style={styles.infoRow}>
                <span style={styles.infoIcon}>📦</span>
                <span style={styles.infoLabel}>Состояние:</span>
                <span style={styles.infoValue}>{getConditionText()}</span>
              </div>

              {/* Строка 2: Локация + ВУЗ */}
              <div style={styles.infoRow}>
                <span style={styles.infoIcon}>📍</span>
                <span style={styles.infoValue}>{item.location || 'Не указано'}</span>
                <span style={styles.infoDivider}>•</span>
                <span style={styles.infoIcon}>🏛️</span>
                <span style={styles.infoValue}>
                  {item.university || item.seller?.university} - {item.institute || item.seller?.institute}
                </span>
              </div>

              {/* Строка 3: Метрики */}
              <div style={styles.infoRow}>
                <span style={styles.infoIcon}>📅</span>
                <span style={styles.infoValue}>{getTimeAgo()}</span>
                <span style={styles.infoDivider}>•</span>
                <span style={styles.infoIcon}>👁️</span>
                <span style={styles.infoValue}>{item.views_count}</span>
                <span style={styles.infoDivider}>•</span>
                <span style={styles.infoIcon}>❤️</span>
                <span style={styles.infoValue}>{item.favorites_count}</span>
              </div>
            </div>

            {/* Описание (сразу после инфо!) */}
            <div style={styles.descriptionSection}>
              <div style={styles.sectionTitle}>Описание</div>
              <div style={styles.description}>
                {item.description}
              </div>
            </div>

            {/* Продавец */}
            {item.seller && (
              <div style={styles.sellerSection}>
                <div style={styles.sectionTitle}>Продавец</div>
                <div style={styles.sellerCard}>
                  <div style={styles.sellerAvatar}>
                    {item.seller.avatar ? (
                      <img src={item.seller.avatar} alt={item.seller.name} style={styles.sellerAvatarImg} />
                    ) : (
                      <div style={styles.sellerAvatarPlaceholder}>
                        {item.seller.name[0].toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div style={styles.sellerInfo}>
                    <div style={styles.sellerName}>{item.seller.name}</div>
                    <div style={styles.sellerMeta}>
                      {item.seller.course && `${item.seller.course} курс`}
                      {item.seller.username && ` • @${item.seller.username}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Spacer для кнопки */}
            <div style={{ height: 80 }} />
          </div>
        </div>

        {/* Sticky кнопка */}
        <div style={styles.stickyButton}>
          {isOwner ? (
            <button style={styles.ownerButton} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Удаление...' : '🗑️ Удалить объявление'}
            </button>
          ) : (
            <button style={styles.contactButton} onClick={handleContact}>
              💬 Написать продавцу
            </button>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <CreateMarketItem
          editItem={item}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onUpdate();
          }}
        />
      )}
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
     zIndex: Z_MARKET_DETAIL,
    animation: 'fadeIn 0.3s ease',
  },

  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.bg,
    animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    background: theme.colors.card,
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  headerButton: {
    background: 'transparent',
    border: 'none',
    padding: theme.spacing.sm,
    cursor: 'pointer',
    transition: theme.transitions.fast,
  },

  headerIcon: {
    fontSize: theme.fontSize.xl,
  },

  headerActions: {
    display: 'flex',
    gap: theme.spacing.sm,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },

  gallery: {
    position: 'relative',
    width: '100%',
    height: '400px',
    overflow: 'hidden',
    background: theme.colors.bgSecondary,
  },

  galleryTrack: {
    display: 'flex',
    height: '100%',
    transition: 'transform 0.3s ease',
  },

  gallerySlide: {
    minWidth: '100%',
    height: '100%',
    transition: 'transform 0.3s ease',
  },

  galleryImage: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  dots: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: theme.spacing.sm,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.4)',
    transition: theme.transitions.fast,
  },

  dotActive: {
    background: theme.colors.text,
    width: 24,
    borderRadius: 4,
  },

  mainInfo: {
    padding: theme.spacing.lg,
  },

  price: {
    fontSize: 28,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.market,
    marginBottom: theme.spacing.sm,
  },

  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    lineHeight: 1.4,
  },

  // ===== КОМПАКТНЫЙ ИНФО-БЛОК =====
  infoBlock: {
    background: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },

  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },

  infoIcon: {
    fontSize: theme.fontSize.base,
  },

  infoLabel: {
    color: theme.colors.textTertiary,
  },

  infoValue: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },

  infoDivider: {
    color: theme.colors.textTertiary,
    margin: `0 ${theme.spacing.xs}px`,
  },

  // ===== СЕКЦИИ =====
  descriptionSection: {
    marginBottom: theme.spacing.xl,
  },

  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },

  description: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
  },

  sellerSection: {
    marginBottom: theme.spacing.xl,
  },

  sellerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    background: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
  },

  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    overflow: 'hidden',
    background: theme.colors.primary,
  },

  sellerAvatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  sellerAvatarPlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },

  sellerInfo: {
    flex: 1,
  },

  sellerName: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs / 2,
  },

  sellerMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },

  // ===== STICKY КНОПКА =====
  stickyButton: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  contactButton: {
    width: '100%',
    background: theme.colors.market,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: 'pointer',
    transition: theme.transitions.normal,
    
    ':hover': {
      background: theme.colors.success,
      transform: 'scale(1.02)',
    },
  },

  ownerButton: {
    width: '100%',
    background: theme.colors.error,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
};

// CSS Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(styleSheet);

export default MarketDetail;
