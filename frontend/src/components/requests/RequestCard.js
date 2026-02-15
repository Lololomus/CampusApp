// ===== RequestCard.js =====

import React, { useState, useMemo, useRef } from 'react';
import { Clock, Gift, Image as ImageIcon, MoreVertical } from 'lucide-react';
import { MENU_ACTIONS } from '../../constants/contentConstants';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { REWARD_TYPE_LABELS, REWARD_TYPE_ICONS } from '../../types';
import DropdownMenu from '../DropdownMenu';
import PhotoViewer from '../shared/PhotoViewer';
import ReportModal from '../shared/ReportModal';
import Avatar from '../shared/Avatar';
import ProfileMiniCard from '../shared/ProfileMiniCard';
import { useModerationActions } from '../shared/ModerationMenu';
import { toast } from '../shared/Toast';

const API_URL = 'http://localhost:8000';

function RequestCard({ request, onClick, onEdit, onDelete, onReport, currentUserId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerJustClosed, setIsPhotoViewerJustClosed] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef(null);
  
  const menuButtonRef = useRef(null);

  // ===== КАТЕГОРИИ (цвета и иконки) =====
  const CATEGORIES = {
    study: {
      label: 'Учёба',
      icon: '📚',
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
    },
    help: {
      label: 'Помощь',
      icon: '🤝',
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    },
    hangout: {
      label: 'Движ',
      icon: '🎉',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
    }
  };

  const categoryConfig = CATEGORIES[request.category] || CATEGORIES.study;
  const isAuthor = currentUserId && request.author?.id === currentUserId;

  // ===== MODERATION HOOK =====
  const { moderationMenuItems, moderationModals } = useModerationActions({
    targetType: 'request',
    targetId: request.id,
    targetUserId: request.author?.id,
    onDeleted: () => { if (onDelete) onDelete(request); },
  });

  // ===== ПАРСИНГ ИЗОБРАЖЕНИЙ =====
  const images = useMemo(() => {
    if (!request.images) return [];
    if (Array.isArray(request.images)) return request.images;
    try { 
      return JSON.parse(request.images); 
    } catch { 
      return []; 
    }
  }, [request.images]);

  const getImageUrl = (img) => {
    if (!img) return '';
    const filename = (typeof img === 'object') ? img.url : img;
    if (filename.startsWith('http')) return filename;
    return `${API_URL}/uploads/images/${filename}`;
  };

  const viewerPhotos = useMemo(() => images.map(img => getImageUrl(img)), [images]);

  // ===== ТАЙМЕР =====
  const getTimeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(request.expires_at);
    const diffMs = expiresAt - now;

    if (diffMs <= 0) return { text: 'Истёк', color: '#666', pulse: false };

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let text = '';
    let color = 'rgba(255,255,255,0.6)';
    let pulse = false;

    if (days > 0) {
      text = `${days}д`;
      color = 'rgba(255,255,255,0.6)';
    } else if (hours >= 3) {
      text = `${hours}ч`;
      color = '#fff';
    } else if (hours >= 1) {
      text = `${hours}ч ${minutes % 60}м`;
      color = '#f59e0b';
    } else {
      text = `${minutes}м`;
      color = '#ef4444';
      pulse = true;
    }

    return { text, color, pulse };
  };

  const timeRemaining = getTimeRemaining();

  // ===== ОБРЕЗКА ТЕКСТА =====
  const truncateText = (text, maxLength = 100) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // ===== КЛИК =====
  const handleClick = (e) => {
    if (isPhotoViewerJustClosed) {
      return;
    }
    
    if (e.target.closest('.dropdown-menu-trigger') || e.target.closest('.dropdown-menu-content')) {
      return;
    }
    
    hapticFeedback('light');
    if (onClick) onClick(request);
  };

  // ===== КЛИК НА ФОТО =====
  const handleImageClick = (e, index) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setIsPhotoViewerOpen(true);
  };

  // ===== АВТОР =====
  const authorName = request.author?.username || request.author?.name || 'Аноним';
  const authorInitial = authorName[0]?.toUpperCase() || 'A';
  const authorInfo = [
    request.author?.course && `${request.author.course} курс`,
    request.author?.university,
    request.author?.institute
  ].filter(Boolean).join(' • ');

  // ===== НАГРАДА (RENDER HELPER) =====
  const renderRewardBadge = () => {
    if (!request.reward_type || request.reward_type === 'none') return null;

    const icon = REWARD_TYPE_ICONS[request.reward_type] || '🎁';
    const label = REWARD_TYPE_LABELS[request.reward_type] || 'Награда';
    const value = request.reward_value;

    return (
      <div style={styles.rewardBadge} className="reward-badge">
        <Gift size={16} style={{ flexShrink: 0 }} />
        <span style={styles.rewardText}>
          {icon} {label}
          {value && <span style={styles.rewardValue}> · {value}</span>}
        </span>
      </div>
    );
  };

  // ===== ИЗОБРАЖЕНИЯ (RENDER HELPER) =====
  const renderImagePreview = () => {
    if (!images || images.length === 0) return null;

    const displayImages = images.slice(0, 3);
    const remaining = images.length - 3;

    return (
      <div style={styles.imagePreviewContainer}>
        <div style={styles.imageGrid}>
          {displayImages.map((img, idx) => (
            <div 
              key={idx} 
              style={styles.imagePreviewItem}
              className="image-preview-item"
              onClick={(e) => handleImageClick(e, idx)}
            >
              <img 
                src={getImageUrl(img)} 
                alt="" 
                style={styles.previewImage}
                loading="lazy"
              />
            </div>
          ))}
          {remaining > 0 && (
            <div 
              style={styles.imagePreviewItem} 
              className="image-preview-item"
              onClick={(e) => handleImageClick(e, 3)}
            >
              <div style={styles.imageOverlay}>
                <ImageIcon size={16} />
                <span style={styles.remainingCount}>+{remaining}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ===== МЕНЮ ДЕЙСТВИЙ =====
  const menuItems = [
    {
      label: 'Скопировать ссылку',
      icon: '🔗',
      actionType: MENU_ACTIONS.COPY,
      onClick: async () => {
        setMenuOpen(false);
        const link = `campusapp://request/${request.id}`;
        try {
          await navigator.clipboard.writeText(link);
          toast.success('Ссылка скопирована');
          hapticFeedback('success');
        } catch (error) {
          console.error('Copy request link error:', error);
          toast.error('Не удалось скопировать ссылку');
          hapticFeedback('error');
        }
      }
    },
    
    ...(isAuthor ? [
      {
        label: 'Редактировать',
        icon: '✏️',
        actionType: MENU_ACTIONS.EDIT,
        onClick: () => {
          hapticFeedback('light');
          setMenuOpen(false);
          if (onEdit) onEdit(request);
        }
      },
      {
        label: 'Удалить',
        icon: '🗑️',
        actionType: MENU_ACTIONS.DELETE,
        onClick: () => {
          hapticFeedback('medium');
          setMenuOpen(false);
          if (onDelete) onDelete(request);
        }
      }
    ] : [
      {
        label: 'Пожаловаться',
        icon: '🚩',
        actionType: MENU_ACTIONS.REPORT,
        onClick: () => {
          hapticFeedback('light');
          setMenuOpen(false);
          setShowReportModal(true);
        }
      }
    ]),
    // ✅ Модерация
    ...moderationMenuItems,
  ];

  return (
    <>
      <style>{keyframesStyles}</style>
      <div 
        style={styles.card} 
        onClick={handleClick}
        className="request-card"
      >
        {/* ХЕДЕР КАТЕГОРИИ */}
        <div style={{
          ...styles.header,
          background: categoryConfig.gradient
        }}>
          <div style={styles.categoryLabel}>
            <span style={styles.categoryIcon}>{categoryConfig.icon}</span>
            <span style={styles.categoryText}>{categoryConfig.label}</span>
          </div>
          
          <div style={styles.headerRight}>
            <div style={{
              ...styles.timer,
              color: timeRemaining.color,
              animation: timeRemaining.pulse ? 'pulse 2s ease-in-out infinite' : 'none'
            }}>
              <Clock size={14} style={{ marginRight: 4 }} />
              {timeRemaining.text}
            </div>

            {/* ТРОЕТОЧИЕ МЕНЮ */}
            <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <button
                ref={menuButtonRef}
                style={styles.menuButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(!menuOpen);
                  hapticFeedback('light');
                }}
                className="dropdown-menu-trigger"
              >
                <MoreVertical size={18} />
              </button>
              <DropdownMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuButtonRef}
                items={menuItems}
              />
            </div>
          </div>
        </div>

        {/* НАГРАДА */}
        {renderRewardBadge()}

        {/* ЗАГОЛОВОК */}
        <div style={styles.title}>
          {request.title}
        </div>

        {/* ПРЕВЬЮ ОПИСАНИЯ */}
        <div style={styles.body}>
          {truncateText(request.body, 100)}
        </div>

        {/* ИЗОБРАЖЕНИЯ */}
        {renderImagePreview()}

        {/* БЛОК АВТОРА */}
        <div style={styles.authorBlock}>
          <div 
            onClick={(e) => {
              if (request.author?.show_profile) {
                e.stopPropagation();
                setProfileOpen(true);
              }
            }}
            style={{ cursor: request.author?.show_profile ? 'pointer' : 'default' }}
          >
            {/* Передаем объект user целиком, как в PostCard */}
            <Avatar 
              ref={avatarRef}
              user={request.author} 
              size={40}
              isAnonymous={false} // Запросы обычно не анонимны, или добавь проверку
            />
          </div>

          {/* Информация об авторе (тоже кликабельная) */}
          <div 
            style={{...styles.authorInfo, cursor: request.author?.show_profile ? 'pointer' : 'default'}}
            onClick={(e) => {
              if (request.author?.show_profile) {
                e.stopPropagation();
                setProfileOpen(true);
              }
            }}
          >
            <div style={styles.authorName}>{authorName}</div>
            {authorInfo && (
              <div style={styles.authorDetails}>{authorInfo}</div>
            )}
          </div>
        </div>

        {/* ФУТЕР: ТОЛЬКО ТЕГИ */}
        <div style={styles.footer}>
          <div style={styles.tags}>
            {request.tags && request.tags.slice(0, 3).map((tag, idx) => (
              <span key={idx} style={styles.tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* PHOTOVIEWER */}
        {isPhotoViewerOpen && (
          <PhotoViewer
            photos={viewerPhotos}
            initialIndex={currentImageIndex}
            onClose={() => {
              setIsPhotoViewerOpen(false);
              setIsPhotoViewerJustClosed(true);
              setTimeout(() => setIsPhotoViewerJustClosed(false), 100);
            }}
          />
        )}
      </div>

      {/* Модалка жалобы */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="request"
        targetId={request.id}
      />

      {/* Модалки модерации */}
      {moderationModals}
      
      {/* Мини-карточка профиля */}
      {request.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={request.author}
          anchorRef={avatarRef}
          onReport={() => setShowReportModal(true)}
        />
      )}
    </>  
  );
}

// ===== СТИЛИ =====
const styles = {
  card: {
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    cursor: 'pointer',
    marginBottom: theme.spacing.md,
    transition: 'transform 0.1s ease-out',
    border: `1px solid ${theme.colors.border}`,
    position: 'relative',
    WebkitTapHighlightColor: 'transparent'
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    color: '#fff'
  },

  categoryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold
  },

  categoryIcon: {
    fontSize: theme.fontSize.md
  },

  categoryText: {
    fontSize: theme.fontSize.sm
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs
  },

  timer: {
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: theme.radius.sm
  },

  menuButton: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: 'none',
    borderRadius: theme.radius.sm,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    transition: 'all 0.2s ease',
    padding: 0
  },

  rewardBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.2) 100%)',
    borderBottom: `2px solid rgba(255, 215, 0, 0.3)`,
    animation: 'fadeInSlide 0.4s ease-out',
    fontSize: theme.fontSize.base,
    color: '#FFD700',
    fontWeight: theme.fontWeight.semibold
  },

  rewardText: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },

  rewardValue: {
    color: '#FFA500',
    fontWeight: theme.fontWeight.bold
  },

  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px ${theme.spacing.sm}px`,
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },

  body: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },

  imagePreviewContainer: {
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`
  },

  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.md,
    overflow: 'hidden'
  },

  imagePreviewItem: {
    position: 'relative',
    paddingTop: '75%',
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    cursor: 'pointer'
  },

  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  imageOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    gap: theme.spacing.xs
  },

  remainingCount: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.bold
  },

  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    background: '#252525',
    borderTop: `1px solid ${theme.colors.border}`,
    borderBottom: `1px solid ${theme.colors.border}`
  },

  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    background: theme.colors.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    flexShrink: 0
  },

  authorInfo: {
    flex: 1,
    overflow: 'hidden'
  },

  authorName: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2
  },

  authorDetails: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },

  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px ${theme.spacing.md}px`
  },

  tags: {
    display: 'flex',
    gap: theme.spacing.xs,
    flex: 1,
    overflow: 'hidden',
    flexWrap: 'wrap'
  },

  tag: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    background: 'rgba(135, 116, 225, 0.1)',
    padding: `2px ${theme.spacing.sm}px`,
    borderRadius: theme.radius.sm,
    whiteSpace: 'nowrap'
  }
};

// ===== АНИМАЦИИ =====
const keyframesStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes fadeInSlide {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .request-card:active {
    transform: scale(0.98);
  }

  .reward-badge {
    position: relative;
  }

  .reward-badge::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.15) 100%);
    animation: shimmer 3s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.7; }
  }
`;

export default RequestCard;
