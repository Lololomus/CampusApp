// ===== 📄 ФАЙЛ: src/components/Market/MarketCard.js =====

import React, { useRef, useState } from 'react';
import { useStore } from '../../store';
import { toggleMarketFavorite, deleteMarketItem } from '../../api';
import theme from '../../theme';
import DropdownMenu from '../DropdownMenu';

const MarketCard = ({ item, onClick, index = 0 }) => {
  const { 
    toggleMarketFavoriteOptimistic, 
    user, 
    deleteMarketItem: deleteFromStore,
    setEditingMarketItem, 
    setShowCreateMarketItem 
  } = useStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  
  const isOwner = user?.id === item.seller_id;

  const coverImage = item.images && item.images.length > 0 ? item.images[0] : null;
  const imageUrl = coverImage?.url || coverImage;

  const getCategoryGradient = () => {
    const gradients = {
      textbooks: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      electronics: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      furniture: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      clothing: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      sports: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      appliances: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    };
    return gradients[item.category] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');

    const newState = !item.is_favorited;
    toggleMarketFavoriteOptimistic(item.id, newState);

    try {
      await toggleMarketFavorite(item.id);
    } catch (error) {
      console.error('Ошибка toggle избранного:', error);
      toggleMarketFavoriteOptimistic(item.id, !newState);
    }
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    setIsMenuOpen(true);
  };

  // ===== ACTIONS =====

  const handleEdit = () => {
    setIsMenuOpen(false);
    setEditingMarketItem(item); // Записываем товар в стор
    setShowCreateMarketItem(true); // Открываем модалку
  };

  const handleDelete = async () => {
    setIsMenuOpen(false);
    if (window.confirm('Удалить это объявление?')) {
      if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('heavy');
      try {
        await deleteMarketItem(item.id); // API запрос
        deleteFromStore(item.id); // Удаляем из UI
      } catch (error) {
        alert('Ошибка при удалении');
      }
    }
  };

  const handleReport = () => {
    setIsMenuOpen(false);
    alert('Жалоба отправлена модераторам');
  };

  const handleShare = () => {
    setIsMenuOpen(false);
    // TODO: Реализовать share через Telegram WebApp
    console.log('Share item:', item.id);
  };

  // Меню действий
  const menuItems = isOwner 
    ? [
        { icon: '✏️', label: 'Редактировать', onClick: handleEdit },
        { icon: '🗑️', label: 'Удалить', onClick: handleDelete, danger: true },
      ]
    : [
        { icon: '⚠️', label: 'Пожаловаться', onClick: handleReport },
        { icon: '↗️', label: 'Поделиться', onClick: handleShare },
      ];

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  return (
    <>
      <div 
        style={{
          ...styles.card,
          animationDelay: `${index * 0.05}s`,
        }}
        onClick={onClick}
        className="market-card-touch"
      >
        {/* === IMAGE SECTION === */}
        <div style={styles.imageContainer}>
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={item.title}
              style={styles.image}
              loading="lazy"
            />
          ) : (
            <div style={{
              ...styles.imagePlaceholder,
              background: getCategoryGradient(),
            }}>
              <div style={styles.placeholderText}>
                {item.category}
              </div>
            </div>
          )}

          {/* Badge "1/N" */}
          {item.images && item.images.length > 1 && (
            <div style={styles.photoBadge}>
              1/{item.images.length}
            </div>
          )}

          {/* ❤️ Лайк */}
          <button style={styles.likeButton} onClick={handleFavorite}>
            <span style={{
              ...styles.likeIcon,
              transform: item.is_favorited ? 'scale(1.1)' : 'scale(1)',
              color: item.is_favorited ? theme.colors.error : '#fff'
            }}>
              {item.is_favorited ? '❤️' : '🤍'}
            </span>
          </button>
        </div>

        {/* === INFO SECTION === */}
        <div style={styles.info}>
          <div style={styles.topRow}>
            <div style={styles.price}>{formatPrice(item.price)} ₽</div>
            
            {/* ⋯ Меню (с ref) */}
            <button 
              ref={menuButtonRef}
              style={styles.menuButton} 
              onClick={handleMenuClick}
            >
              <span style={styles.menuIcon}>⋯</span>
            </button>
          </div>

          <div style={styles.title}>{item.title}</div>
          
          <div style={styles.metaRow}>
            <span style={styles.metaText}>
              {item.condition === 'new' && 'Новое'}
              {item.condition === 'like-new' && 'Как новое'}
              {item.condition === 'good' && 'Хорошее'}
              {item.condition === 'fair' && 'Удовлетв.'}
            </span>
            <span style={styles.metaDivider}>•</span>
            <span style={styles.metaText}>{item.location || 'Нет локации'}</span>
          </div>
        </div>
      </div>

      {/* Выпадающее меню (через портал) */}
      <DropdownMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorRef={menuButtonRef}
        items={menuItems}
      />
    </>
  );
};

const styles = {
  card: {
    position: 'relative',
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    transition: 'transform 0.1s ease',
    animation: 'fadeInUp 0.4s ease forwards',
    opacity: 0,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 160,
    backgroundColor: theme.colors.bgTertiary,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imagePlaceholder: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  placeholderText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'capitalize',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  
  // Badge (Счетчик фото)
  photoBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    background: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(4px)',
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: theme.fontWeight.bold,
    padding: '2px 6px',
    borderRadius: theme.radius.sm,
    zIndex: 2,
  },

  // Кнопка Лайка (на картинке)
  likeButton: {
    position: 'absolute',
    bottom: theme.spacing.sm,
    right: theme.spacing.sm,
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.4)', // Полупрозрачная подложка
    backdropFilter: 'blur(4px)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 2,
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  likeIcon: {
    fontSize: 18,
    lineHeight: 1,
    transition: 'all 0.2s ease',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
  },

  info: {
    padding: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  
  // Строка с ценой и меню
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  
  price: {
    color: theme.colors.market,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    lineHeight: '1.2',
  },

  // Кнопка меню
  menuButton: {
    background: 'transparent',
    border: 'none',
    padding: 4,
    marginRight: -4,
    marginTop: -4,
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 0.5,
  },

  title: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.xs,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.3',
    height: '2.6em', 
  },
  
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: 11,
    color: theme.colors.textSecondary,
    opacity: 0.7,
  },
  metaText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '60px',
  },
  metaDivider: { color: theme.colors.textTertiary },
};

// CSS Animation + Active State (Touch)
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .market-card-touch:active {
    transform: scale(0.98);
    opacity: 0.95;
  }
`;
document.head.appendChild(styleSheet);

export default MarketCard;