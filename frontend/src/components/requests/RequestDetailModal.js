import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Clock,
  Flag,
  Gift,
  Link,
  Lock,
  MessageSquare,
  Pencil,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import { useStore } from '../../store';
import {
  getRequestById,
  getRequestResponses,
  respondToRequest,
  updateRequest,
} from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { REWARD_TYPE_ICONS, REWARD_TYPE_LABELS } from '../../types';
import DropdownMenu from '../DropdownMenu';
import MediaViewer from '../shared/MediaViewer';
import ReportModal from '../shared/ReportModal';
import Avatar from '../shared/Avatar';
import ProfileMiniCard from '../shared/ProfileMiniCard';
import OverflowMenuButton from '../shared/OverflowMenuButton';
import { toast } from '../shared/Toast';
import { getEntityActionSet, isEntityOwner } from '../../utils/entityActions';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { parseApiDate } from '../../utils/datetime';
import { stripLeadingTitleFromBody } from '../../utils/contentTextParser';
import { MENU_ACTIONS } from '../../constants/contentConstants';
import { Z_MODAL_REQUEST_DETAIL } from '../../constants/zIndex';
import LinkText from '../shared/LinkText';
import SwipeableModal from '../shared/SwipeableModal';

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

function RequestDetailModal({ onClose, onEdit, onDelete }) {
  const {
    currentRequest,
    setCurrentRequest,
    user,
    updateRequest: updateStoreRequest,
  } = useStore();

  const [request, setRequest] = useState(currentRequest || null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerJustClosed, setIsPhotoViewerJustClosed] = useState(false);
  const [isDropdownJustClosed, setIsDropdownJustClosed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionScrollState, setDescriptionScrollState] = useState({
    isTop: true,
    isBottom: false,
  });

  const menuButtonRef = useRef(null);
  const authorAvatarRef = useRef(null);
  const descriptionRef = useRef(null);

  const safeRequest = request || currentRequest;
  const categoryConfig = CATEGORY_CONFIG[safeRequest?.category] || CATEGORY_CONFIG.study;

  const images = useMemo(() => {
    if (!safeRequest?.images) return [];
    if (Array.isArray(safeRequest.images)) return safeRequest.images;
    try {
      return JSON.parse(safeRequest.images);
    } catch {
      return [];
    }
  }, [safeRequest?.images]);

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
    author: safeRequest?.author || null,
    caption: safeRequest?.title || safeRequest?.body || null,
  }), [safeRequest?.author, safeRequest?.title, safeRequest?.body]);
  const isOwner = useMemo(() => isEntityOwner('request', safeRequest, user), [safeRequest, user]);
  const actionSet = useMemo(
    () => getEntityActionSet('request', isOwner, { shareEnabled: false }),
    [isOwner]
  );

  useEffect(() => {
    if (!currentRequest) {
      onClose();
      return;
    }
    setRequest(currentRequest);
    loadRequestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRequest]);

  useEffect(() => {
    setDescriptionExpanded(false);
    setDescriptionScrollState({ isTop: true, isBottom: false });
    if (descriptionRef.current) descriptionRef.current.scrollTop = 0;
  }, [safeRequest?.id]);

  useEffect(() => {
    if (!descriptionExpanded) return;
    const timer = setTimeout(() => {
      updateDescriptionScrollState();
    }, 200);
    return () => clearTimeout(timer);
  }, [descriptionExpanded]);

  const handleClose = () => {
    if (isPhotoViewerJustClosed || isDropdownJustClosed) return;
    hapticFeedback('light');
    setCurrentRequest(null);
    onClose();
  };

  const loadRequestData = async () => {
    if (!currentRequest?.id) return;

    try {
      setLoading(true);
      const data = await getRequestById(currentRequest.id);
      setRequest(data);

      if (isEntityOwner('request', data, user)) {
        const responsesData = await getRequestResponses(currentRequest.id);
        setResponses(responsesData || []);
      } else {
        setResponses([]);
      }
    } catch (error) {
      console.error('Request detail load error:', error);
      toast.error('Не удалось загрузить запрос');
    } finally {
      setLoading(false);
    }
  };

  const timeState = useMemo(() => {
    if (!safeRequest) {
      return {
        isClosed: false,
        isExpired: false,
        text: '—',
        color: '#888888',
        bg: '#2C2C2E',
        urgent: false,
        burning: false,
      };
    }

    const now = new Date();
    const expiresAt = parseApiDate(safeRequest.expires_at);
    const isClosed = safeRequest.status === 'closed';
    const isExpired = !isClosed && (!expiresAt || expiresAt <= now || safeRequest.status === 'expired');

    if (isClosed) {
      return {
        isClosed: true,
        isExpired: false,
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
        text: 'Истёк',
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
      text: `Осталось ${text}`,
      color: urgent ? '#FF453A' : '#888888',
      bg: urgent ? 'rgba(255, 69, 58, 0.15)' : '#2C2C2E',
      urgent,
      burning,
    };
  }, [safeRequest]);

  const rewardText = useMemo(() => {
    if (!safeRequest?.reward_type || safeRequest.reward_type === 'none') return null;
    const icon = REWARD_TYPE_ICONS[safeRequest.reward_type] || '🎁';
    const label = REWARD_TYPE_LABELS[safeRequest.reward_type] || 'Награда';
    return safeRequest.reward_value ? `${icon} ${safeRequest.reward_value}` : `${icon} ${label}`;
  }, [safeRequest?.reward_type, safeRequest?.reward_value]);

  const formatRuDateTime = (value) => {
    const parsed = parseApiDate(value);
    if (!parsed) return '';
    return parsed.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const datesInfo = useMemo(() => {
    if (!safeRequest) return null;
    const createdDate = parseApiDate(safeRequest.created_at);
    const expiresDate = parseApiDate(safeRequest.expires_at);
    if (!createdDate || !expiresDate) return null;

    const now = new Date();
    const diffHours = Math.floor((expiresDate - now) / 3600000);
    const isExpired = expiresDate <= now || safeRequest.status === 'expired';

    let deadlineColor = '#D1D1D1';
    if (isExpired || safeRequest.status === 'closed') deadlineColor = '#888888';
    else if (diffHours < 3) deadlineColor = '#FF453A';
    else if (diffHours < 24) deadlineColor = '#FF9F0A';

    return {
      created: formatRuDateTime(createdDate),
      deadline: formatRuDateTime(expiresDate),
      isExpired,
      deadlineColor,
    };
  }, [safeRequest]);

  const updateDescriptionScrollState = () => {
    if (!descriptionRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = descriptionRef.current;
    setDescriptionScrollState({
      isTop: scrollTop <= 1,
      isBottom: scrollTop + clientHeight >= scrollHeight - 1,
    });
  };

  const handleImageClick = (e, index) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setIsPhotoViewerOpen(true);
  };

  const handleRespond = async () => {
    if (!safeRequest || isOwner || safeRequest.has_responded || datesInfo?.isExpired || safeRequest.status !== 'active') {
      return;
    }

    try {
      setResponding(true);
      hapticFeedback('medium');
      await respondToRequest(safeRequest.id);

      const updatedRequest = {
        ...safeRequest,
        has_responded: true,
        responses_count: (safeRequest.responses_count || 0) + 1,
      };
      setRequest(updatedRequest);
      updateStoreRequest(safeRequest.id, {
        has_responded: true,
        responses_count: updatedRequest.responses_count,
      });

      hapticFeedback('success');
      toast.success('Отклик отправлен');
    } catch (error) {
      console.error('Request respond error:', error);
      hapticFeedback('error');
      toast.error(error?.message || 'Не удалось отправить отклик');
    } finally {
      setResponding(false);
    }
  };

  const handleCloseRequest = async () => {
    if (!safeRequest || !isOwner) return;
    if (!window.confirm('Закрыть запрос? Его больше нельзя будет открыть.')) return;

    try {
      hapticFeedback('medium');
      await updateRequest(safeRequest.id, { status: 'closed' });
      setRequest((prev) => (prev ? { ...prev, status: 'closed' } : prev));
      updateStoreRequest(safeRequest.id, { status: 'closed' });
      hapticFeedback('success');
      toast.success('Запрос закрыт');
    } catch (error) {
      console.error('Request close error:', error);
      hapticFeedback('error');
      toast.error(error?.message || 'Не удалось закрыть запрос');
    }
  };

  const openTelegramChat = (username) => {
    if (!username) return;
    hapticFeedback('light');
    const cleanUsername = username.replace('@', '');
    window.open(`https://t.me/${cleanUsername}`, '_blank');
  };

  const handleCopyLink = async () => {
    if (!safeRequest) return;
    hapticFeedback('light');
    try {
      await navigator.clipboard.writeText(`campusapp://request/${safeRequest.id}`);
      toast.success('Ссылка скопирована');
      setMenuOpen(false);
      setIsDropdownJustClosed(true);
      setTimeout(() => setIsDropdownJustClosed(false), 250);
    } catch (error) {
      console.error('Copy request link error:', error);
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const menuItems = [
    ...(actionSet.canCopyLink
      ? [{
          label: 'Скопировать ссылку',
          icon: <Link size={18} />,
          actionType: MENU_ACTIONS.COPY,
          onClick: handleCopyLink,
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
            setIsDropdownJustClosed(true);
            setTimeout(() => setIsDropdownJustClosed(false), 250);
            if (onEdit && safeRequest) onEdit(safeRequest);
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
            setIsDropdownJustClosed(true);
            setTimeout(() => setIsDropdownJustClosed(false), 250);
            if (onDelete && safeRequest) onDelete(safeRequest);
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
            setIsDropdownJustClosed(true);
            setTimeout(() => setIsDropdownJustClosed(false), 250);
            setShowReportModal(true);
          },
        }]
      : []),
  ];

  if (!safeRequest) return null;

  const descriptionText = stripLeadingTitleFromBody(safeRequest.title, safeRequest.body);
  const descriptionLong = descriptionText.length > 150;
  const descriptionTopFadeVisible = descriptionExpanded && !descriptionScrollState.isTop;
  const descriptionBottomFadeVisible = !descriptionExpanded || !descriptionScrollState.isBottom;
  const photoGridColumns = images.length <= 3 ? 3 : 2;

  const footer = (
    <>
      {isOwner ? (
        <button
          type="button"
          onClick={handleCloseRequest}
          style={styles.ownerFooterButton}
          disabled={safeRequest.status === 'closed'}
        >
          {safeRequest.status === 'closed' ? 'Запрос закрыт' : 'Закрыть таску (Решено)'}
        </button>
      ) : safeRequest.has_responded ? (
        <button type="button" style={styles.disabledFooterButton} disabled>
          Вы уже откликнулись
        </button>
      ) : datesInfo?.isExpired || safeRequest.status !== 'active' ? (
        <button type="button" style={styles.disabledFooterButton} disabled>
          <Lock size={18} /> Запрос недоступен
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRespond}
          style={styles.primaryFooterButton}
          disabled={responding}
        >
          <MessageSquare size={20} strokeWidth={2.4} />
          {responding ? 'Отправка...' : 'Откликнуться'}
        </button>
      )}
    </>
  );

  return (
    <>
      <style>{cssStyles}</style>

      <SwipeableModal
        isOpen={!!currentRequest}
        onClose={handleClose}
        zIndex={Z_MODAL_REQUEST_DETAIL}
        footer={footer}
      >
        {loading && !request ? <div style={styles.loading}>Загрузка...</div> : null}

        <h1 style={styles.title}>{safeRequest.title}</h1>

        <div style={styles.chipsRow}>
          <div style={{ ...styles.chip, color: categoryConfig.color, background: categoryConfig.bg }}>
            {categoryConfig.label}
          </div>
          {rewardText && (
            <div style={{ ...styles.chip, color: '#32D74B', background: 'rgba(50, 215, 75, 0.12)' }}>
              <Gift size={14} />
              {rewardText}
            </div>
          )}
          <div style={{ ...styles.chip, color: timeState.color, background: timeState.bg }}>
            {timeState.burning ? (
              <span className="burning-dot" />
            ) : timeState.urgent ? (
              <Zap size={14} strokeWidth={2.8} />
            ) : (
              <Clock size={14} />
            )}
            {timeState.text}
          </div>
        </div>

        <div style={styles.authorRow}>
          <div style={styles.authorLeft}>
            <Avatar
              ref={authorAvatarRef}
              user={safeRequest.author}
              size={48}
              onClick={() => safeRequest.author?.show_profile && setProfileOpen(true)}
              showProfile={safeRequest.author?.show_profile}
            />
            <div style={styles.authorInfo}>
              <div style={styles.authorNameWrap}>
                <span style={styles.authorName}>
                  {safeRequest.author?.username || safeRequest.author?.name || 'Аноним'}
                </span>
                {isOwner && <span style={styles.ownerBadge}>ЭТО ВЫ</span>}
              </div>
              <div style={styles.authorMeta}>
                {[
                  safeRequest.author?.course && `${safeRequest.author.course} курс`,
                  safeRequest.author?.university,
                  safeRequest.author?.institute,
                ].filter(Boolean).join(' • ')}
              </div>
            </div>
          </div>

          <OverflowMenuButton
            ref={menuButtonRef}
            isOpen={menuOpen}
            onToggle={() => setMenuOpen((prev) => !prev)}
            style={{ flexShrink: 0 }}
          />
        </div>

        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>ОПИСАНИЕ</h4>
          <div style={styles.descriptionWrap}>
            {descriptionLong && (
              <div style={{ ...styles.descriptionTopFade, opacity: descriptionTopFadeVisible ? 1 : 0 }} />
            )}
            <div
              ref={descriptionRef}
              onScroll={updateDescriptionScrollState}
              style={{
                ...styles.description,
                maxHeight: descriptionExpanded ? 220 : 96,
                overflowY: descriptionExpanded ? 'auto' : 'hidden',
              }}
            >
              <LinkText text={descriptionText} />
            </div>
            {descriptionLong && (
              <div
                style={{
                  ...styles.descriptionBottomFade,
                  opacity: descriptionBottomFadeVisible ? 1 : 0,
                }}
              />
            )}
          </div>
          {descriptionLong && !descriptionExpanded && (
            <button type="button" onClick={() => setDescriptionExpanded(true)} style={styles.expandButton}>
              Показать ещё
            </button>
          )}
        </div>

        {images.length > 0 && (
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>ФОТО ({images.length})</h4>
            <div style={{ ...styles.imagesGrid, gridTemplateColumns: `repeat(${photoGridColumns}, 1fr)` }}>
              {images.map((img, index) => (
                <button
                  key={`${safeRequest.id}-image-${index}`}
                  type="button"
                  style={styles.imageButton}
                  onClick={(e) => handleImageClick(e, index)}
                >
                  <img src={getImageUrl(img)} alt="" style={styles.image} loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {safeRequest.tags && safeRequest.tags.length > 0 && (
          <div style={styles.tags}>
            {safeRequest.tags.map((tag, index) => (
              <span key={`${tag}-${index}`} className="hashtag-chip" style={styles.tagChip}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {datesInfo && (
          <div style={styles.infoBlock}>
            <div style={styles.infoRow}>
              <Calendar size={16} />
              <span>Создано: {datesInfo.created}</span>
            </div>
            <div style={styles.infoRow}>
              <Clock size={16} />
              <span>
                Актуально до:{' '}
                <span style={{ color: datesInfo.deadlineColor, fontWeight: 700 }}>
                  {datesInfo.deadline}
                </span>
              </span>
            </div>
          </div>
        )}

        {isOwner && responses.length > 0 && (
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>ОТКЛИКИ ({responses.length})</h4>
            <div style={styles.responsesList}>
              {responses.map((response) => (
                <div key={response.id} style={styles.responseCard}>
                  <div style={styles.responseHeader}>
                    <div style={styles.responseAvatar}>
                      {response.author?.name?.[0]?.toUpperCase() || 'A'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={styles.responseName}>{response.author?.name || 'Аноним'}</div>
                      <div style={styles.responseTime}>{formatRuDateTime(response.created_at)}</div>
                    </div>
                  </div>
                  {response.message && (
                    <div style={styles.responseMessage}>{response.message}</div>
                  )}
                  {response.telegram_contact && (
                    <button
                      type="button"
                      onClick={() => openTelegramChat(response.telegram_contact)}
                      style={styles.telegramButton}
                    >
                      <User size={16} />
                      Написать в Telegram
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </SwipeableModal>

      <DropdownMenu
        isOpen={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setIsDropdownJustClosed(true);
          setTimeout(() => setIsDropdownJustClosed(false), 250);
        }}
        anchorRef={menuButtonRef}
        items={menuItems}
      />

      {isPhotoViewerOpen && (
        <MediaViewer
          mediaList={viewerMedia}
          initialIndex={currentImageIndex}
          meta={viewerMeta}
          onClose={() => {
            setIsPhotoViewerOpen(false);
            setIsPhotoViewerJustClosed(true);
            setTimeout(() => setIsPhotoViewerJustClosed(false), 120);
          }}
        />
      )}

      {safeRequest.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={safeRequest.author}
          anchorRef={authorAvatarRef}
          onReportUser={() => {
            const targetUserId = safeRequest.author?.id || safeRequest.author_id;
            if (!targetUserId || isOwner) return;
            setShowUserReportModal(true);
          }}
        />
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="request"
        targetId={safeRequest.id}
      />
      <ReportModal
        isOpen={showUserReportModal}
        onClose={() => setShowUserReportModal(false)}
        targetType="user"
        targetId={safeRequest.author?.id || safeRequest.author_id}
        sourceType="request"
        sourceId={safeRequest.id}
      />
    </>
  );
}

const styles = {
  loading: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 12,
  },
  title: {
    margin: '0 0 16px',
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 800,
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  chipsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 700,
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 16,
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    marginBottom: 16,
  },
  authorLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  authorInfo: { minWidth: 0 },
  authorNameWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  ownerBadge: {
    border: '1px solid #D4FF00',
    color: '#D4FF00',
    borderRadius: 6,
    padding: '2px 6px',
    fontSize: 10,
    fontWeight: 800,
    flexShrink: 0,
  },
  authorMeta: {
    marginTop: 4,
    color: '#888888',
    fontSize: 13,
    lineHeight: 1.2,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    margin: '0 0 8px',
    color: '#888888',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  descriptionWrap: { position: 'relative' },
  description: {
    margin: 0,
    color: '#EAEAEA',
    fontSize: 15,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
    transition: 'max-height 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  descriptionTopFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    background: 'linear-gradient(to top, transparent, #151516)',
    pointerEvents: 'none',
    zIndex: 2,
    transition: 'opacity 0.25s ease',
  },
  descriptionBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 42,
    background: 'linear-gradient(to bottom, rgba(21,21,22,0), #151516 70%)',
    pointerEvents: 'none',
    zIndex: 2,
    transition: 'opacity 0.25s ease',
  },
  expandButton: {
    marginTop: 10,
    border: 'none',
    background: 'transparent',
    color: '#D4FF00',
    fontSize: 14,
    fontWeight: 700,
    padding: 0,
    cursor: 'pointer',
  },
  imagesGrid: {
    display: 'grid',
    gap: 8,
  },
  imageButton: {
    position: 'relative',
    width: '100%',
    paddingTop: '100%',
    border: 'none',
    borderRadius: 12,
    overflow: 'hidden',
    background: '#2C2C2E',
    cursor: 'pointer',
  },
  image: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tagChip: {
    backgroundColor: '#2C2C2E',
    border: `1px solid ${theme.colors.premium.border}`,
    color: '#E5E5E5',
  },
  infoBlock: {
    background: '#2C2C2E',
    borderRadius: 12,
    border: `1px solid ${theme.colors.premium.border}`,
    padding: 12,
    marginBottom: 24,
    display: 'grid',
    gap: 10,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#CFCFCF',
    fontSize: 14,
    lineHeight: 1.35,
  },
  responsesList: {
    display: 'grid',
    gap: 12,
  },
  responseCard: {
    background: '#2C2C2E',
    borderRadius: 12,
    border: `1px solid ${theme.colors.premium.border}`,
    padding: 12,
  },
  responseHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  responseAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    background: 'rgba(255,255,255,0.08)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    flexShrink: 0,
  },
  responseName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.2,
  },
  responseTime: {
    marginTop: 2,
    color: '#888888',
    fontSize: 12,
    lineHeight: 1.2,
  },
  responseMessage: {
    marginTop: 10,
    color: '#D4D4D4',
    fontSize: 14,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  },
  telegramButton: {
    marginTop: 12,
    width: '100%',
    minHeight: 42,
    borderRadius: 10,
    border: 'none',
    background: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  primaryFooterButton: {
    width: '100%',
    minHeight: 48,
    border: 'none',
    borderRadius: 14,
    background: '#D4FF00',
    color: '#101010',
    fontSize: 16,
    fontWeight: 800,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'pointer',
  },
  disabledFooterButton: {
    width: '100%',
    minHeight: 48,
    border: 'none',
    borderRadius: 14,
    background: '#2C2C2E',
    color: '#666666',
    fontSize: 15,
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: 'default',
  },
  ownerFooterButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    border: 'none',
    background: '#2C2C2E',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
};

const cssStyles = `
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.8); }
    50% { box-shadow: 0 0 0 10px rgba(255, 69, 58, 0); }
    100% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0); }
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

export default RequestDetailModal;
