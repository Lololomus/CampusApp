// ===== 📄 ФАЙЛ: frontend/src/components/market/MarketCard.js =====

import React, { useRef, useState, useMemo } from 'react';
import { useStore } from '../../store';
import { toggleMarketFavorite, deleteMarketItem } from '../../api';
import theme from '../../theme';
import DropdownMenu from '../DropdownMenu';
import OverflowMenuButton from '../shared/OverflowMenuButton';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import { MENU_ACTIONS } from '../../constants/contentConstants';
import { hapticFeedback } from '../../utils/telegram';
import ReportModal from '../shared/ReportModal';
import { useModerationActions } from '../shared/ModerationMenu';
import { isEntityOwner, getEntityActionSet } from '../../utils/entityActions';
import { parseApiDate, formatRelativeRu } from '../../utils/datetime';

const MarketCard = ({ item, onClick, index = 0 }) => {
  const { 
    toggleMarketFavoriteOptimistic, 
    user, 
    deleteMarketItem: deleteFromStore,
    setEditingMarketItem, 
    setShowCreateMarketItem 
  } = useStore();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);  
  const [showReportModal, setShowReportModal] = useState(false);
  const menuButtonRef = useRef(null);
  
  const isOwner = useMemo(() => isEntityOwner('market_item', item, user), [item, user]);
  const actionSet = useMemo(
    () => getEntityActionSet('market_item', isOwner, { shareEnabled: false }),
    [isOwner]
  );

  // ===== MODERATION HOOK =====
  const { moderationMenuItems, moderationModals } = useModerationActions({
    targetType: 'market_item',
    targetId: item.id,
    targetUserId: item.seller_id,
    onDeleted: () => { deleteFromStore(item.id); },
  });

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

  const getCategoryInfo = () => {
    const categories = {
      textbooks: { emoji: '📚', label: 'Учебники' },
      electronics: { emoji: '💻', label: 'Электроника' },
      furniture: { emoji: '🛋️', label: 'Мебель' },
      clothing: { emoji: '👕', label: 'Одежда' },
      sports: { emoji: '⚽', label: 'Спорт' },
      appliances: { emoji: '🔌', label: 'Техника' }
    };
    return categories[item.category] || { emoji: '📦', label: item.category };
  };

  const getConditionText = () => {
    const conditions = {
      'new': '✨ Новое',
      'like_new': '⭐ Как новое',
      'good': '👍 Хорошее',
      'fair': '👌 Нормальное'
    };
    return conditions[item.condition] || item.condition;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU').format(price);
  };

  const formatRelativeDate = (dateString) => {
    const date = parseApiDate(dateString);
    const now = new Date();
    if (!date) return '';
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return formatRelativeRu(date, now);
    if (diffDays === 1) return 'вчера';
    if (diffDays < 7) return `${diffDays}д`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}н`;
    return `${Math.floor(diffDays / 30)}м`;
  };

  const handleFavorite = async (e) => {
    e.stopPropagation();
    hapticFeedback('medium');

    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 400);

    const newState = !item.is_favorited;
    toggleMarketFavoriteOptimistic(item.id, newState);

    try {
      await toggleMarketFavorite(item.id);
      if (newState) {
        toast.success('Добавлено в избранное');
      }
    } catch (error) {
      console.error('Ошибка toggle избранного:', error);
      toggleMarketFavoriteOptimistic(item.id, !newState);
      toast.error('Не удалось обновить избранное');
    }
  };

  const handleEdit = () => {
    setIsMenuOpen(false);
    hapticFeedback('light');
    setEditingMarketItem(item);
  };

  const handleDelete = async () => {
    hapticFeedback('heavy');
    try {
      await deleteMarketItem(item.id);
      deleteFromStore(item.id);
      toast.success('Товар удалён');
    } catch (error) {
      console.error('Ошибка удаления:', error);
      toast.error('Не удалось удалить товар');
    }
  };

  const handleCopyLink = () => {
    setIsMenuOpen(false);
    hapticFeedback('light');
    const link = `${window.location.origin}/market/${item.id}`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
        .then(() => toast.success('Ссылка скопирована'))
        .catch(() => toast.error('Не удалось скопировать'));
    } else {
      toast.info(`Ссылка: ${link}`);
    }
  };

  const menuItems = [
    ...(actionSet.canCopyLink ? [{
      icon: '🔗',
      label: 'Копировать ссылку',
      actionType: MENU_ACTIONS.COPY,
      onClick: handleCopyLink
    }] : []),
    ...(actionSet.canEdit ? [{
        icon: '✏️',
        label: 'Редактировать',
        actionType: MENU_ACTIONS.EDIT,
        onClick: handleEdit
      }] : []),
    ...(actionSet.canDelete ? [{
        icon: '🗑️',
        label: 'Удалить',
        actionType: MENU_ACTIONS.DELETE,
        onClick: () => {
          setIsMenuOpen(false);
          setShowDeleteDialog(true);
        }
      }] : []),
    ...(actionSet.canReportContent ? [{
        icon: '🚩',
        label: 'Пожаловаться',
        actionType: MENU_ACTIONS.REPORT,
        onClick: () => {
          setIsMenuOpen(false);
          setShowReportModal(true);
        }
      }] : []),
    // ✅ Модерация
    ...moderationMenuItems,
  ];

  const categoryInfo = getCategoryInfo();

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
                {categoryInfo.emoji} {categoryInfo.label}
              </div>
            </div>
          )}

          {/* Категория badge */}
          <div style={styles.categoryBadge}>
            {categoryInfo.emoji} {categoryInfo.label}
          </div>

          {/* Badge "1/N" */}
          {item.images && item.images.length > 1 && (
            <div style={styles.photoBadge}>
              1/{item.images.length}
            </div>
          )}

          {/* Статус "Срочно" */}
          {item.is_urgent && (
            <div style={styles.urgentBadge}>
              ⚡ Срочно
            </div>
          )}

          {/* ❤️ Лайк */}
          <button 
            style={{
              ...styles.likeButton,
              ...(likeAnimating ? styles.likeButtonAnimating : {}),
            }} 
            onClick={handleFavorite}
          >
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
            
            <OverflowMenuButton
              ref={menuButtonRef}
              isOpen={isMenuOpen}
              onToggle={() => setIsMenuOpen((prev) => !prev)}
              icon={<span style={styles.menuIcon}>⋯</span>}
              style={styles.menuButton}
              activeBorderColor={theme.colors.border}
            />
          </div>

          <div style={styles.title}>{item.title}</div>
          
          <div style={styles.metaRow}>
            <span style={styles.metaText}>
              {getConditionText()}
            </span>
            <span style={styles.metaDivider}>•</span>
            <span style={styles.metaText}>
              {item.seller?.university || 'Университет'}
              {item.seller?.institute && `, ${item.seller.institute.slice(0, 10)}`}
            </span>
            <span style={styles.metaDivider}>•</span>
            <span style={styles.metaText}>
              {formatRelativeDate(item.created_at)}
            </span>
          </div>
        </div>
      </div>

      <DropdownMenu 
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        anchorRef={menuButtonRef}
        items={menuItems}
      />

      {showDeleteDialog && (
        <ConfirmationDialog
          isOpen={showDeleteDialog}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={() => {
            setShowDeleteDialog(false);
            handleDelete();
          }}
          title="Удалить товар?"
          message={`Вы уверены, что хотите удалить "${item.title}"? Это действие нельзя отменить.`}
          confirmText="Удалить"
          cancelText="Отмена"
          confirmType="danger"
        />
      )}

      {/* ✅ Модалка жалобы */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="market_item"
        targetId={item.id}
      />

      {/* ✅ Модалки модерации */}
      {moderationModals}
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
    fontFamily: 'Arial, sans-serif',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: theme.colors.bgSecondary,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: 600,
    fontFamily: 'Arial, sans-serif',
    textTransform: 'capitalize',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },

  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'Arial, sans-serif',
    padding: '3px 7px',
    borderRadius: 6,
    zIndex: 2,
  },
  
  photoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(4px)',
    color: theme.colors.text,
    fontSize: 11,                    
    fontWeight: 700,                 
    fontFamily: 'Arial, sans-serif', 
    padding: '3px 7px',              
    borderRadius: 6,
    zIndex: 2,
  },

  urgentBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    background: theme.colors.warning,
    color: theme.colors.textInverted,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'Arial, sans-serif',
    padding: '3px 8px',
    borderRadius: 6,
    zIndex: 2,
  },

  likeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.4)',
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

  likeButtonAnimating: {
    animation: 'likeAnimation 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  info: {
    padding: '10px 12px',
  },
  
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  price: {
    color: theme.colors.market,
    fontSize: 20,
    fontWeight: 700,
    fontFamily: 'Arial, sans-serif',
    lineHeight: 1,
  },

  menuButton: {
    background: 'transparent',
    border: '1px solid transparent',
    width: 40,
    height: 40,
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    marginTop: -8,
  },
  menuIcon: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 1,
    fontFamily: 'Arial, sans-serif',
  },

  title: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: 500,
    fontFamily: 'Arial, sans-serif',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: 1.3,
    minHeight: '2.6em',
  },
  
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    fontSize: 11,
    fontFamily: 'Arial, sans-serif',
    color: theme.colors.textSecondary,
    opacity: 0.75,
    lineHeight: 1.3,
  },
  metaText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metaDivider: { 
    color: theme.colors.textTertiary 
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes likeAnimation {
    0% { transform: scale(1); }
    30% { transform: scale(1.25); }
    60% { transform: scale(0.95); }
    100% { transform: scale(1); }
  }

  .market-card-touch:active {
    transform: scale(0.98);
    opacity: 0.95;
  }
`;

document.head.appendChild(styleSheet);

export default MarketCard;
