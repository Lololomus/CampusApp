import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Clock,
  Flag,
  Gift,
  Image as ImageIcon,
  Link,
  Share2,
  Lock,
  Pencil,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { MENU_ACTIONS } from '../../constants/contentConstants';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { REWARD_TYPE_ICONS, REWARD_TYPE_LABELS } from '../../types';
import DropdownMenu from '../DropdownMenu';
import OverflowMenuButton from '../shared/OverflowMenuButton';
import MediaViewer from '../shared/MediaViewer';
import ReportModal from '../shared/ReportModal';
import Avatar from '../shared/Avatar';
import ProfileMiniCard from '../shared/ProfileMiniCard';
import { useModerationActions } from '../shared/ModerationMenu';
import { toast } from '../shared/Toast';
import { getEntityActionSet, isEntityOwner } from '../../utils/entityActions';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { parseApiDate } from '../../utils/datetime';
import { buildMiniAppStartappUrl } from '../../utils/deepLinks';
import { shareRequestViaTelegram } from '../../utils/telegramShare';

const CATEGORY_CONFIG = {
  study: {
    label: '📚 УЧЁБА',
    color: '#4DA6FF',
    bg: 'rgba(77, 166, 255, 0.15)',
  },
  help: {
    label: '🤝 ПОМОЩЬ',
    color: '#FF9F0A',
    bg: 'rgba(255, 159, 10, 0.15)',
  },
  hangout: {
    label: '🎉 ДВИЖ',
    color: '#D4FF00',
    bg: 'rgba(212, 255, 0, 0.15)',
  },
};

function RequestCard({ request, onClick, onEdit, onDelete, currentUserId, compactTop = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerJustClosed, setIsPhotoViewerJustClosed] = useState(false);
  const [isMenuPressing, setIsMenuPressing] = useState(false);
  const [isImagePressing, setIsImagePressing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [loadedImageMap, setLoadedImageMap] = useState({});
  const [failedImageMap, setFailedImageMap] = useState({});

  const menuButtonRef = useRef(null);
  const avatarRef = useRef(null);

  const categoryConfig = CATEGORY_CONFIG[request.category] || CATEGORY_CONFIG.study;

  const isAuthor = useMemo(
    () => isEntityOwner('request', request, { id: currentUserId }),
    [request, currentUserId]
  );
  const actionSet = useMemo(
    () => getEntityActionSet('request', isAuthor, { shareEnabled: true }),
    [isAuthor]
  );

  const { moderationMenuItems, moderationModals } = useModerationActions({
    targetType: 'request',
    targetId: request.id,
    targetUserId: request.author?.id,
    onDeleted: () => {
      if (onDelete) onDelete(request);
    },
  });

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
    const filename = typeof img === 'object' ? img.url : img;
    return resolveImageUrl(filename, 'images');
  };

  const viewerMedia = useMemo(
    () => images
      .map((img) => ({ type: 'image', url: getImageUrl(img) })),
    [images]
  );
  const viewerMeta = useMemo(() => ({
    author: request.author || null,
    caption: request.title || request.body || null,
  }), [request.author, request.title, request.body]);

  const markImageLoaded = (url) => {
    if (!url) return;
    const key = `${request.id}:${url}`;
    setLoadedImageMap((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    setFailedImageMap((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const markImageFailed = (url) => {
    if (!url) return;
    const key = `${request.id}:${url}`;
    setFailedImageMap((prev) => ({ ...prev, [key]: true }));
  };

  const authorName = request.author?.username || request.author?.name || 'Аноним';
  const authorMeta = [
    request.author?.course && `${request.author.course} курс`,
    request.author?.university,
    request.author?.institute,
  ].filter(Boolean).join(' • ');

  const statusInfo = useMemo(() => {
    const now = new Date();
    const expiresAt = parseApiDate(request.expires_at);
    const isClosed = request.status === 'closed';
    const isExpired = !isClosed && (!expiresAt || expiresAt <= now || request.status === 'expired');
    const isUnavailable = !isClosed && !isExpired && request.status !== 'active';

    if (isClosed) {
      return {
        isClosed: true,
        isExpired: false,
        isUnavailable: false,
        text: 'Закрыт',
        color: '#888888',
        bg: '#2C2C2E',
        urgent: false,
        burning: false,
      };
    }

    if (isExpired) {
      return {
        isClosed: false,
        isExpired: true,
        isUnavailable: false,
        text: 'Истёк',
        color: '#888888',
        bg: '#2C2C2E',
        urgent: false,
        burning: false,
      };
    }
    if (isUnavailable) {
      return {
        isClosed: false,
        isExpired: false,
        isUnavailable: true,
        text: 'Недоступен',
        color: '#888888',
        bg: '#2C2C2E',
        urgent: false,
        burning: false,
      };
    }

    const diffMs = Math.max(0, expiresAt - now);
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let text = '';
    if (days > 0) text = `${days}д ${hours % 24}ч`;
    else if (hours > 0) text = `${hours}ч ${minutes % 60}м`;
    else text = `${minutes}м`;

    const urgent = diffMs <= 3 * 60 * 60 * 1000;
    const burning = diffMs <= 60 * 60 * 1000;

    return {
      isClosed: false,
      isExpired: false,
      isUnavailable: false,
      text: `Осталось ${text}`,
      color: urgent ? '#FF453A' : '#888888',
      bg: urgent ? 'rgba(255, 69, 58, 0.15)' : '#2C2C2E',
      urgent,
      burning,
    };
  }, [request.expires_at, request.status]);

  const rewardText = useMemo(() => {
    if (!request.reward_type || request.reward_type === 'none') return null;
    const icon = REWARD_TYPE_ICONS[request.reward_type] || '🎁';
    const label = REWARD_TYPE_LABELS[request.reward_type] || 'Награда';
    if (request.reward_value) return `${icon} ${request.reward_value}`;
    return `${icon} ${label}`;
  }, [request.reward_type, request.reward_value]);

  const footerMeta = useMemo(() => {
    if (statusInfo.isClosed) return { text: 'Запрос закрыт', color: '#888888' };
    if (statusInfo.isExpired) return { text: 'Срок истёк', color: '#888888' };
    if (statusInfo.isUnavailable) return { text: 'Запрос недоступен', color: '#888888' };

    const responses = request.responses_count || 0;
    if (responses > 0) {
      return {
        text: `${responses} откликнулись`,
        color: '#D1D1D1',
        withIcon: true,
      };
    }

    return { text: 'Пока нет откликов', color: '#666666' };
  }, [request.responses_count, statusInfo.isClosed, statusInfo.isExpired, statusInfo.isUnavailable]);

  const ctaState = useMemo(() => {
    if (isAuthor) {
      return {
        text: 'Моя таска',
        disabled: true,
        style: styles.myTaskButton,
        icon: null,
      };
    }
    if (statusInfo.isClosed || statusInfo.isExpired || statusInfo.isUnavailable) {
      return {
        text: statusInfo.isClosed ? 'Закрыт' : statusInfo.isExpired ? 'Истёк' : 'Недоступен',
        disabled: true,
        style: styles.lockedButton,
        icon: <Lock size={14} />,
      };
    }
    if (request.has_responded) {
      return {
        text: 'Откликнулись',
        disabled: true,
        style: styles.respondedButton,
        icon: null,
      };
    }
    return {
      text: 'Помочь',
      disabled: false,
      style: styles.helpButton,
      icon: <ChevronRight size={14} />,
    };
  }, [isAuthor, request.has_responded, statusInfo]);

  const handleCardClick = (e) => {
    if (isPhotoViewerJustClosed) return;
    if (e.target.closest('.dropdown-menu-trigger') || e.target.closest('.dropdown-menu-content')) return;
    hapticFeedback('light');
    if (onClick) onClick(request);
  };

  const openCardFromCTA = (e) => {
    e.stopPropagation();
    if (ctaState.disabled) return;
    hapticFeedback('light');
    if (onClick) onClick(request);
  };

  const handleImageClick = (e, index) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setIsPhotoViewerOpen(true);
  };

  const handleImagePressStart = (e) => {
    e.stopPropagation();
    setIsImagePressing(true);
  };

  const handleImagePressEnd = () => {
    setIsImagePressing(false);
  };

  const handleShareLink = () => {
    setMenuOpen(false);
    hapticFeedback('light');
    try {
      shareRequestViaTelegram(request);
    } catch (error) {
      console.error('Share request error:', error);
      toast.error('Не удалось открыть Telegram для отправки');
      hapticFeedback('error');
    }
  };

  const menuItems = [
    ...(actionSet.canShare
      ? [{
          label: 'Поделиться',
          icon: <Share2 size={18} />,
          actionType: MENU_ACTIONS.SHARE,
          onClick: handleShareLink,
        }]
      : []),
    ...(actionSet.canCopyLink
      ? [{
          label: 'Скопировать ссылку',
          icon: <Link size={18} />,
          actionType: MENU_ACTIONS.COPY,
          onClick: async () => {
            setMenuOpen(false);
            const link = buildMiniAppStartappUrl(`request_${request.id}`);
            try {
              await navigator.clipboard.writeText(link);
              toast.success('Ссылка скопирована');
              hapticFeedback('success');
            } catch (error) {
              console.error('Copy request link error:', error);
              toast.error('Не удалось скопировать ссылку');
              hapticFeedback('error');
            }
          },
        }]
      : []),
    ...(actionSet.canEdit
      ? [{
          label: 'Редактировать',
          icon: <Pencil size={18} />,
          actionType: MENU_ACTIONS.EDIT,
          onClick: () => {
            hapticFeedback('light');
            setMenuOpen(false);
            if (onEdit) onEdit(request);
          },
        }]
      : []),
    ...(actionSet.canDelete
      ? [{
          label: 'Удалить',
          icon: <Trash2 size={18} />,
          actionType: MENU_ACTIONS.DELETE,
          onClick: () => {
            hapticFeedback('medium');
            setMenuOpen(false);
            if (onDelete) onDelete(request);
          },
        }]
      : []),
    ...(actionSet.canReportContent
      ? [{
          label: 'Пожаловаться',
          icon: <Flag size={18} />,
          actionType: MENU_ACTIONS.REPORT,
          onClick: () => {
            hapticFeedback('light');
            setMenuOpen(false);
            setShowReportModal(true);
          },
        }]
      : []),
    ...moderationMenuItems,
  ];

  const previewImages = images.slice(0, 3);
  const remainingImages = images.length - 3;

  const cardStyle = compactTop ? { ...styles.card, paddingTop: 16 } : styles.card;

  return (
    <>
      <style>{keyframesStyles}</style>

      <div
        style={cardStyle}
        onClick={handleCardClick}
        className={`request-card-spring${(isMenuPressing || isImagePressing) ? ' request-card-no-active' : ''}`}
      >
        <div style={styles.mainRow}>
          <div
            onClick={(e) => {
              if (!request.author?.show_profile) return;
              e.stopPropagation();
              setProfileOpen(true);
            }}
            style={{ cursor: request.author?.show_profile ? 'pointer' : 'default' }}
          >
            <Avatar
              ref={avatarRef}
              user={request.author}
              size={44}
              isAnonymous={false}
            />
          </div>

          <div style={styles.mainContent}>
            <div style={styles.topRow}>
              <div style={styles.authorBlock}>
                <div style={styles.authorNameRow}>
                  <span style={styles.authorName}>{authorName}</span>
                  {isAuthor && <span style={styles.ownerBadge}>ВЫ</span>}
                </div>
                {authorMeta && <span style={styles.authorMeta}>{authorMeta}</span>}
              </div>

              <div style={styles.rightActions}>
                <span
                  style={{
                    ...styles.categoryBadge,
                    color: categoryConfig.color,
                    background: categoryConfig.bg,
                  }}
                >
                  {categoryConfig.label}
                </span>

                <div style={{ position: 'relative' }}>
                  <OverflowMenuButton
                    ref={menuButtonRef}
                    isOpen={menuOpen}
                    className="dropdown-menu-trigger"
                    onPressStart={() => setIsMenuPressing(true)}
                    onPressEnd={() => setIsMenuPressing(false)}
                    onToggle={() => {
                      setMenuOpen((prev) => !prev);
                      setIsMenuPressing(false);
                    }}
                  />
                  <DropdownMenu
                    isOpen={menuOpen}
                    onClose={() => {
                      setMenuOpen(false);
                      setIsMenuPressing(false);
                    }}
                    anchorRef={menuButtonRef}
                    items={menuItems}
                  />
                </div>
              </div>
            </div>

            <h3 style={styles.title}>{request.title}</h3>
            <p style={styles.body}>{request.body}</p>

            <div style={styles.chipsRow}>
              {rewardText && (
                <div style={styles.rewardChip}>
                  <Gift size={14} />
                  <span>{rewardText}</span>
                </div>
              )}
              <div
                style={{
                  ...styles.timeChip,
                  color: statusInfo.color,
                  background: statusInfo.bg,
                }}
              >
                {statusInfo.burning ? (
                  <span className="burning-dot" />
                ) : statusInfo.urgent ? (
                  <Zap size={14} strokeWidth={2.8} />
                ) : (
                  <Clock size={14} />
                )}
                <span>{statusInfo.text}</span>
              </div>
            </div>
          </div>
        </div>

        {previewImages.length > 0 && (
          <div style={styles.imagesWrap}>
            <div style={styles.imagesGrid}>
              {previewImages.map((img, index) => (
                (() => {
                  const imageUrl = getImageUrl(img);
                  const imageStateKey = imageUrl ? `${request.id}:${imageUrl}` : '';
                  const isLoaded = imageStateKey ? Boolean(loadedImageMap[imageStateKey]) : false;
                  const isFailed = !imageUrl || Boolean(failedImageMap[imageStateKey]);
                  return (
                    <button
                      key={`${request.id}-img-${index}`}
                      type="button"
                      onClick={(e) => handleImageClick(e, index)}
                      onPointerDown={handleImagePressStart}
                      onPointerUp={handleImagePressEnd}
                      onPointerCancel={handleImagePressEnd}
                      onPointerLeave={handleImagePressEnd}
                      style={styles.imageButton}
                    >
                      {!isLoaded && !isFailed && <div style={styles.imageSkeleton} />}
                      {isFailed && <div style={styles.imageFallback}>Нет фото</div>}
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt=""
                          style={{
                            ...styles.image,
                            opacity: isLoaded && !isFailed ? 1 : 0,
                            transition: 'opacity 0.2s ease',
                          }}
                          loading="lazy"
                          onLoad={() => markImageLoaded(imageUrl)}
                          onError={() => markImageFailed(imageUrl)}
                        />
                      )}
                    </button>
                  );
                })()
              ))}
              {remainingImages > 0 && (
                <button
                  type="button"
                  onClick={(e) => handleImageClick(e, 3)}
                  onPointerDown={handleImagePressStart}
                  onPointerUp={handleImagePressEnd}
                  onPointerCancel={handleImagePressEnd}
                  onPointerLeave={handleImagePressEnd}
                  style={styles.imageButton}
                >
                  <div style={styles.imageOverlay}>
                    <ImageIcon size={16} />
                    <span>+{remainingImages}</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <div style={styles.footerMeta}>
            {footerMeta.withIcon ? <Users size={16} /> : null}
            <span style={{ color: footerMeta.color }}>{footerMeta.text}</span>
          </div>

          <button type="button" onClick={openCardFromCTA} style={{ ...styles.ctaBase, ...ctaState.style }}>
            {ctaState.icon}
            <span>{ctaState.text}</span>
          </button>
        </div>
      </div>

      {isPhotoViewerOpen && (
        <MediaViewer
          mediaList={viewerMedia}
          initialIndex={currentImageIndex}
          meta={viewerMeta}
          onClose={() => {
            setIsPhotoViewerOpen(false);
            setIsImagePressing(false);
            setIsPhotoViewerJustClosed(true);
            setTimeout(() => setIsPhotoViewerJustClosed(false), 120);
          }}
        />
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="request"
        targetId={request.id}
      />
      <ReportModal
        isOpen={showUserReportModal}
        onClose={() => setShowUserReportModal(false)}
        targetType="user"
        targetId={request.author?.id || request.author_id}
        sourceType="request"
        sourceId={request.id}
      />

      {moderationModals}

      {request.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={request.author}
          anchorRef={avatarRef}
          onReportUser={() => {
            const targetUserId = request.author?.id || request.author_id;
            if (!targetUserId || isAuthor) return;
            setShowUserReportModal(true);
          }}
        />
      )}
    </>
  );
}

const styles = {
  card: {
    padding: '24px 0 16px',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  },
  mainRow: {
    display: 'flex',
    gap: 12,
    padding: '0 16px',
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  authorBlock: {
    minWidth: 0,
    flex: 1,
  },
  authorNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  ownerBadge: {
    padding: '2px 6px',
    borderRadius: 6,
    border: `1px solid ${theme.colors.premium.border}`,
    background: '#2C2C2E',
    fontSize: 10,
    fontWeight: 700,
    color: '#FFFFFF',
    flexShrink: 0,
  },
  authorMeta: {
    color: '#888888',
    fontSize: 13,
    marginTop: 2,
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    display: 'block',
  },
  rightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    flexShrink: 0,
  },
  categoryBadge: {
    padding: '4px 10px',
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
  },
  title: {
    margin: '0 0 6px',
    fontSize: 16,
    lineHeight: 1.3,
    fontWeight: 700,
    color: '#FFFFFF',
  },
  body: {
    margin: 0,
    color: '#D1D1D1',
    fontSize: 15,
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  rewardChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    color: '#32D74B',
    background: 'rgba(50, 215, 75, 0.12)',
  },
  timeChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
  },
  imagesWrap: {
    marginTop: 12,
    padding: '0 16px',
  },
  imagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 8,
  },
  imageButton: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    border: 'none',
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    background: '#1C1C1E',
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageSkeleton: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(110deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0.05) 65%)',
    backgroundSize: '200% 100%',
    animation: 'imageShimmer 1.25s linear infinite',
    zIndex: 1,
  },
  imageFallback: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#A0A0A0',
    background: '#1C1C1E',
    zIndex: 1,
  },
  imageOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    color: '#FFFFFF',
    background: 'rgba(0,0,0,0.55)',
    fontSize: 13,
    fontWeight: 700,
  },
  footer: {
    marginTop: 16,
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  footerMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#888888',
    minWidth: 0,
  },
  ctaBase: {
    border: 'none',
    borderRadius: 14,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
  },
  helpButton: {
    background: '#2C2C2E',
    color: '#FFFFFF',
    cursor: 'pointer',
  },
  myTaskButton: {
    background: 'transparent',
    border: `1px solid ${theme.colors.premium.border}`,
    color: '#FFFFFF',
    cursor: 'default',
    pointerEvents: 'none',
  },
  lockedButton: {
    background: '#2C2C2E',
    color: '#666666',
    cursor: 'default',
    pointerEvents: 'none',
  },
  respondedButton: {
    background: '#2C2C2E',
    color: '#B0B0B0',
    cursor: 'default',
    pointerEvents: 'none',
  },
};

const keyframesStyles = `
  .request-card-spring {
    transition: transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s;
  }

  .request-card-spring:not(.request-card-no-active):active {
    transform: scale(0.98);
    opacity: 0.9;
  }

  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.8); }
    50% { box-shadow: 0 0 0 10px rgba(255, 69, 58, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0); }
  }

  @keyframes imageShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  .burning-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #FF453A;
    display: inline-block;
    flex-shrink: 0;
    animation: pulseGlow 1.2s infinite cubic-bezier(0.2, 0.8, 0.2, 1);
  }
`;

export default RequestCard;
