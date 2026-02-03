import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { toggleMarketFavorite, deleteMarketItem } from '../../api';
import EditMarketItemModal from './EditMarketItemModal';
import PhotoViewer from '../shared/PhotoViewer';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import { Z_MARKET_DETAIL } from '../../constants/zIndex';
import { hapticFeedback } from '../../utils/telegram';
import DropdownMenu from '../DropdownMenu';

const MarketDetail = ({ item, onClose, onUpdate }) => {
  const { 
    user, 
    toggleMarketFavoriteOptimistic, 
    deleteMarketItem: deleteFromStore, 
    marketItems,
    updateMarketItem: updateInStore
  } = useStore();
  
  // Локальный state для актуальных данных
  const [localItem, setLocalItem] = useState(item);
  
  // Используем актуальные данные из store или локальные
  const currentItem = marketItems.find(i => i.id === item.id) || localItem;
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imagesLoading, setImagesLoading] = useState({});
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);
  
  const menuRef = useRef(null);

  const isOwner = currentItem.seller_id === user?.id;
  const images = currentItem.images || [];

  // Показать кнопку "Назад" в Telegram
  useEffect(() => {
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
      window.Telegram.WebApp.BackButton.onClick(onClose);
      
      return () => {
        window.Telegram.WebApp.BackButton.hide();
        window.Telegram.WebApp.BackButton.offClick(onClose);
      };
    }
  }, [onClose]);

  // Закрытие меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

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
      setCurrentImageIndex(currentImageIndex + 1);
      hapticFeedback('light');
    }

    if (swipeDistance < -minSwipeDistance && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
      hapticFeedback('light');
    }
  };

  const handleFavorite = async () => {
    hapticFeedback('medium');
    
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);
    
    const newState = !currentItem.is_favorited;
    toggleMarketFavoriteOptimistic(currentItem.id, newState);

    try {
      await toggleMarketFavorite(currentItem.id);
    } catch (error) {
      console.error('Ошибка toggle избранного:', error);
      toggleMarketFavoriteOptimistic(currentItem.id, !newState);
    }
  };

  const handleDeleteConfirm = async () => {
    hapticFeedback('heavy');
    setDeleting(true);

    try {
      await deleteMarketItem(currentItem.id);
      deleteFromStore(currentItem.id);
      toast.success('Товар удалён');
      onClose();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Ошибка удаления:', error);
      toast.error('Не удалось удалить товар');
    } finally {
      setDeleting(false);
    }
  };

  const handleContact = () => {
    hapticFeedback('medium');
    const username = currentItem.seller?.username;
    
    if (username) {
      const message = encodeURIComponent(
        `Привет! Интересует "${currentItem.title}" за ${formatPrice(currentItem.price)} ₽.\n\nКогда можем встретиться?`
      );
      const url = `https://t.me/${username}?text=${message}`;
      
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    } else {
      toast.error('У продавца не указан username');
    }
  };

  const handleCopyLink = async () => {
    hapticFeedback('light');
    setShowMenu(false);
    
    const url = `${window.location.origin}/market/${currentItem.id}`;
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success('Ссылка скопирована');
      } else {
        toast.info(`Ссылка: ${url}`);
      }
    } catch (error) {
      console.error('Ошибка копирования:', error);
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleShare = () => {
    hapticFeedback('light');
    setShowMenu(false);
    
    const url = `${window.location.origin}/market/${currentItem.id}`;
    const text = `${currentItem.title} - ${formatPrice(currentItem.price)} ₽`;
    
    if (window.Telegram?.WebApp?.openTelegramLink) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
      window.Telegram.WebApp.openTelegramLink(shareUrl);
    } else if (navigator.share) {
      navigator.share({
        title: currentItem.title,
        text: text,
        url: url
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const handleReport = () => {
    hapticFeedback('medium');
    setShowMenu(false);
    toast.info('Функция "Пожаловаться" в разработке');
  };

  // Обработчик успешного редактирования
  const handleEditSuccess = (updatedItem) => {
    hapticFeedback('success');
    setShowEditModal(false);
    
    // Обновить локальный state
    setLocalItem(updatedItem);
    
    // Обновить store
    if (updateInStore) {
      updateInStore(updatedItem);
    }
    
    // Уведомить родителя
    if (onUpdate) {
      onUpdate(updatedItem);
    }
  };

  const handleImageClick = (index) => {
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setShowPhotoViewer(true);
  };

  const handleImageLoad = (index) => {
    setImagesLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageError = (index) => {
    setImagesLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleMenuToggle = () => {
    hapticFeedback('light');
    setShowMenu(!showMenu);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const formatted = `${day}.${month}.${year}`;
    
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    let label = '';
    if (diffDays === 0) label = ' (сегодня)';
    else if (diffDays === 1) label = ' (вчера)';
    
    return formatted + label;
  };

  const getConditionText = () => {
    const conditions = {
      'new': '✨ Новое',
      'like_new': '⭐ Как новое',
      'good': '👍 Хорошее',
      'fair': '👌 Нормальное'
    };
    return conditions[currentItem.condition] || currentItem.condition;
  };

  const getCategoryText = () => {
    const categories = {
      'textbooks': '📚 Учебники',
      'electronics': '💻 Электроника',
      'furniture': '🛋️ Мебель',
      'clothing': '👕 Одежда',
      'sports': '⚽ Спорт',
      'appliances': '🔌 Техника'
    };
    return categories[currentItem.category] || currentItem.category;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const university = currentItem.seller?.university || 'Университет';
  const institute = currentItem.seller?.institute || '';

  const getMenuItems = () => {
    const commonItems = [
      {
        actionType: 'share',
        label: 'Копировать ссылку',
        icon: '🔗',
        onClick: handleCopyLink
      },
      {
        actionType: 'share',
        label: 'Поделиться',
        icon: '📤',
        onClick: handleShare
      }
    ];

    if (isOwner) {
      return commonItems;
    } else {
      return [
        ...commonItems,
        {
          actionType: 'report',
          label: 'Пожаловаться',
          icon: '⚠️',
          onClick: handleReport
        }
      ];
    }
  };

  return (
    <>
      <div style={styles.container}>
        {images.length > 0 && (
          <div style={styles.galleryContainer}>
            <div
              style={styles.gallery}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div style={styles.gradientTop} />
              
              <div style={styles.galleryTrack}>
                {images.map((img, index) => {
                  const imageUrl = img.url || img;
                  return (
                    <div
                      key={index}
                      style={{
                        ...styles.gallerySlide,
                        transform: `translateX(-${currentImageIndex * 100}%)`,
                      }}
                      onClick={() => handleImageClick(index)}
                    >
                      {imagesLoading[index] !== false && (
                        <div style={styles.imagePlaceholder}>
                          <div style={styles.spinner} />
                        </div>
                      )}
                      <img
                        src={imageUrl}
                        alt={`Фото ${index + 1}`}
                        style={styles.galleryImage}
                        onLoad={() => handleImageLoad(index)}
                        onError={() => handleImageError(index)}
                      />
                    </div>
                  );
                })}
              </div>

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
          </div>
        )}

        <div style={styles.content}>
          <div style={styles.mainInfo}>
            <div style={styles.priceRow}>
              <div style={styles.price}>{formatPrice(currentItem.price)} ₽</div>
              
              <div style={styles.actions}>
                <button 
                  style={{
                    ...styles.actionButton,
                    ...(likeAnimating ? styles.actionButtonAnimating : {}),
                  }}
                  onClick={handleFavorite}
                  aria-label={currentItem.is_favorited ? 'Убрать из избранного' : 'В избранное'}
                >
                  {currentItem.is_favorited ? '❤️' : '🤍'}
                </button>
                
                <div style={styles.menuContainer} ref={menuRef}>
                  <button 
                    style={styles.actionButton}
                    onClick={handleMenuToggle}
                    aria-label="Меню"
                  >
                    <span style={styles.dotsIcon}>⋯</span>
                  </button>
                  
                  <DropdownMenu
                    isOpen={showMenu}
                    onClose={() => setShowMenu(false)}
                    anchorRef={menuRef}
                    items={getMenuItems()}
                  />
                </div>
              </div>
            </div>

            <h1 style={styles.title}>{currentItem.title}</h1>

            <div style={styles.metaRow}>
              <div style={styles.metaBadge}>
                {getCategoryText()}
              </div>
              <div style={styles.metaBadge}>
                {getConditionText()}
              </div>
              {currentItem.views_count > 0 && (
                <div style={styles.metaBadge}>
                  👁 {currentItem.views_count}
                </div>
              )}
            </div>
          </div>

          <div style={styles.divider} />

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📄 Описание</h2>
            <p style={styles.description}>{currentItem.description}</p>
          </div>

          {currentItem.location && (
            <>
              <div style={styles.divider} />
              <div style={styles.section}>
                <h2 style={styles.sectionTitle}>📍 Местоположение</h2>
                <div style={styles.locationText}>{currentItem.location}</div>
              </div>
            </>
          )}

          <div style={styles.divider} />

          {currentItem.seller && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>👤 Продавец</h2>
              <div style={styles.sellerCard}>
                <div style={styles.sellerAvatar}>
                  {currentItem.seller.avatar ? (
                    <img 
                      src={currentItem.seller.avatar} 
                      alt={currentItem.seller.name} 
                      style={styles.sellerAvatarImg} 
                    />
                  ) : (
                    <div style={styles.sellerAvatarPlaceholder}>
                      {currentItem.seller.name[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                <div style={styles.sellerInfo}>
                  <div style={styles.sellerName}>{currentItem.seller.name}</div>
                  <div style={styles.sellerMeta}>
                    {university}
                    {institute && ` • ${institute}`}
                    {currentItem.seller.course && ` • ${currentItem.seller.course} курс`}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={styles.divider} />

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🕐 Опубликовано</h2>
            <div style={styles.publishedDate}>{formatDate(currentItem.created_at)}</div>
          </div>

          <div style={styles.bottomSpacer} />
        </div>

        <div style={styles.footer}>
          {isOwner ? (
            <div style={styles.ownerActions}>
              <button 
                style={styles.editButton} 
                onClick={() => {
                  setShowEditModal(true);
                  hapticFeedback('light');
                }}
              >
                ✏️ Редактировать
              </button>
              <button 
                style={styles.deleteButton} 
                onClick={() => {
                  setShowDeleteDialog(true);
                  hapticFeedback('medium');
                }}
                disabled={deleting}
              >
                {deleting ? '⏳' : '🗑️'}
              </button>
            </div>
          ) : (
            <button 
              style={styles.contactButton} 
              onClick={handleContact}
            >
              <span style={styles.contactIcon}>💬</span>
              <span style={styles.contactText}>Написать продавцу</span>
            </button>
          )}
        </div>
      </div>

      {showEditModal && (
        <EditMarketItemModal
          item={currentItem}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      {showPhotoViewer && (
        <PhotoViewer
          photos={images.map(img => img.url || img)}
          initialIndex={currentImageIndex}
          onClose={() => setShowPhotoViewer(false)}
        />
      )}

      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title="Удалить объявление?"
        message="Это действие нельзя отменить"
        confirmText="Удалить"
        confirmType="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteDialog(false)}
      />
    </>
  );
};

// Стили (без изменений)
const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: theme.colors.bg,
    zIndex: Z_MARKET_DETAIL,
    animation: 'slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
    willChange: 'transform',
    transform: 'translate3d(0,0,0)',
    WebkitOverflowScrolling: 'touch',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },

  galleryContainer: {
    position: 'relative',
    flexShrink: 0,
  },

  gallery: {
    position: 'relative',
    width: '100%',
    height: '420px',
    overflow: 'hidden',
    background: theme.colors.bgSecondary,
  },

  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '80px',
    background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 100%)',
    zIndex: 1,
    pointerEvents: 'none',
  },

  galleryTrack: {
    display: 'flex',
    height: '100%',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  gallerySlide: {
    minWidth: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    cursor: 'pointer',
  },

  galleryImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  imagePlaceholder: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.colors.bgSecondary,
  },

  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${theme.colors.border}`,
    borderTop: `3px solid ${theme.colors.market}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  dots: {
    position: 'absolute',
    bottom: theme.spacing.lg,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: theme.spacing.xs,
    zIndex: 1,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.full,
    background: 'rgba(255,255,255,0.4)',
    transition: theme.transitions.normal,
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },

  dotActive: {
    background: theme.colors.market,
    width: 20,
    borderRadius: 3,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
  },

  mainInfo: {
    padding: theme.spacing.lg,
  },

  priceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: theme.spacing.md,
  },

  price: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 32,
    fontWeight: 700,
    color: theme.colors.market,
    lineHeight: 1,
    letterSpacing: '-0.5px',
    flex: 1,
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },

  actionButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: theme.colors.text,
  },

  actionButtonAnimating: {
    animation: 'likeAnimation 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  dotsIcon: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 1,
  },

  menuContainer: {
    position: 'relative',
  },

  title: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 20,
    fontWeight: 700,
    color: theme.colors.text,
    lineHeight: 1.3,
    margin: 0,
    marginBottom: 12,
  },

  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },

  metaBadge: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    color: theme.colors.textSecondary,
    background: theme.colors.card,
    padding: '6px 10px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    whiteSpace: 'nowrap',
  },

  divider: {
    height: 1,
    background: theme.colors.border,
    margin: 0,
  },

  section: {
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
  },

  sectionTitle: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 16,
    fontWeight: 600,
    color: theme.colors.text,
    margin: 0,
    marginBottom: 12,
  },

  description: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 15,
    fontWeight: 400,
    color: theme.colors.text,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    margin: 0,
  },

  locationText: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 15,
    fontWeight: 400,
    color: theme.colors.text,
    lineHeight: 1.5,
  },

  sellerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    background: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
  },

  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    flexShrink: 0,
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
    fontFamily: 'Arial, sans-serif',
    fontSize: 20,
    fontWeight: 700,
    color: '#ffffff',
    background: `linear-gradient(135deg, ${theme.colors.market} 0%, ${theme.colors.marketGradientEnd} 100%)`,
  },

  sellerInfo: {
    flex: 1,
    minWidth: 0,
  },

  sellerName: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: 4,
  },

  sellerMeta: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 13,
    fontWeight: 400,
    color: theme.colors.textSecondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  publishedDate: {
    fontFamily: 'Arial, sans-serif',
    fontSize: 15,
    fontWeight: 400,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },

  bottomSpacer: {
    height: 16,
  },

  footer: {
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    paddingBottom: `calc(${theme.spacing.lg}px + env(safe-area-inset-bottom))`,
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
    boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 100,
  },

  ownerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },

  editButton: {
    flex: 1,
    fontFamily: 'Arial, sans-serif',
    background: theme.colors.market,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 600,
    padding: '16px 20px',
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
  },

  deleteButton: {
    width: 56,
    height: 56,
    background: '#ef4444',
    color: '#ffffff',
    fontSize: 20,
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  contactButton: {
    width: '100%',
    fontFamily: 'Arial, sans-serif',
    background: theme.colors.market,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 700,
    padding: '16px 20px',
    borderRadius: theme.radius.md,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    boxShadow: `0 4px 16px ${theme.colors.market}40`,
  },

  contactIcon: {
    fontSize: 20,
  },

  contactText: {
    letterSpacing: '-0.3px',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideInRight {
    from { transform: translate3d(100%, 0, 0); }
    to { transform: translate3d(0, 0, 0); }
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes likeAnimation {
    0% { transform: scale(1); }
    30% { transform: scale(1.25); }
    60% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }
`;
if (!document.head.querySelector('[data-market-detail-styles]')) {
  styleSheet.setAttribute('data-market-detail-styles', '');
  document.head.appendChild(styleSheet);
}

export default MarketDetail;