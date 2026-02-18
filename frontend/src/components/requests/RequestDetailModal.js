// ===== 📄 ФАЙЛ: frontend/src/components/requests/RequestDetailModal.js =====
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Calendar, User, MoreVertical, Gift } from 'lucide-react';
import { useStore } from '../../store';
import { getRequestById, respondToRequest, updateRequest, getRequestResponses } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { REWARD_TYPE_LABELS, REWARD_TYPE_ICONS } from '../../types';
import SwipeableModal from '../shared/SwipeableModal';
import DropdownMenu from '../DropdownMenu';
import PhotoViewer from '../shared/PhotoViewer';
import ReportModal from '../shared/ReportModal';
import Avatar from '../shared/Avatar';
import ProfileMiniCard from '../shared/ProfileMiniCard';
import { toast } from '../shared/Toast';
import { isEntityOwner, getEntityActionSet } from '../../utils/entityActions';


const API_URL = 'http://localhost:8000';


function RequestDetailModal({ onClose, onEdit, onDelete }) {
  const { currentRequest, setCurrentRequest, user, updateRequest: updateStoreRequest } = useStore();
  
  const [request, setRequest] = useState(null);
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
  
  const menuButtonRef = useRef(null);
  const authorAvatarRef = useRef(null);


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


  const categoryConfig = CATEGORIES[request?.category] || CATEGORIES.study;


  const images = useMemo(() => {
    if (!request?.images) return [];
    if (Array.isArray(request.images)) return request.images;
    try { 
      return JSON.parse(request.images); 
    } catch { 
      return []; 
    }
  }, [request?.images]);


  const getImageUrl = (img) => {
    if (!img) return '';
    const filename = (typeof img === 'object') ? img.url : img;
    if (filename.startsWith('http')) return filename;
    return `${API_URL}/uploads/images/${filename}`;
  };


  const viewerPhotos = useMemo(() => images.map(img => getImageUrl(img)), [images]);
  const isOwner = useMemo(() => isEntityOwner('request', request, user), [request, user]);
  const actionSet = useMemo(
    () => getEntityActionSet('request', isOwner, { shareEnabled: false }),
    [isOwner]
  );


  useEffect(() => {
    if (!currentRequest) {
      onClose();
      return;
    }

    loadRequestData();
  }, [currentRequest]);


  const loadRequestData = async () => {
    try {
      setLoading(true);

      const data = await getRequestById(currentRequest.id);
      setRequest(data);

      if (isEntityOwner('request', data, user)) {
        const responsesData = await getRequestResponses(currentRequest.id);
        setResponses(responsesData || []);
      }

    } catch (error) {
      console.error('❌ Ошибка загрузки запроса:', error);
    } finally {
      setLoading(false);
    }
  };


  const getTimeRemaining = () => {
    if (!request?.expires_at) return null;

    const now = new Date();
    const expiresAt = new Date(request.expires_at);
    const diffMs = expiresAt - now;

    if (diffMs <= 0) {
      return { text: 'Истёк', color: '#666', pulse: false, expired: true };
    }

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let text = '';
    let color = 'rgba(255,255,255,0.9)';
    let pulse = false;

    if (days > 0) {
      text = `${days}д ${hours % 24}ч`;
      color = 'rgba(255,255,255,0.9)';
    } else if (hours >= 3) {
      text = `${hours}ч ${minutes % 60}м`;
      color = 'rgba(255,255,255,0.9)';
    } else if (hours >= 1) {
      text = `${hours}ч ${minutes % 60}м`;
      color = '#f59e0b';
    } else {
      text = `${minutes}м`;
      color = '#ef4444';
      pulse = true;
    }

    return { text, color, pulse, expired: false };
  };


  const timeRemaining = getTimeRemaining();


  const getDatesInfo = () => {
    if (!request) return null;

    const createdDate = new Date(request.created_at);
    const expiresDate = new Date(request.expires_at);
    const now = new Date();

    const createdStr = createdDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    const expiresStr = expiresDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    const isExpired = expiresDate < now;
    const diffMs = expiresDate - now;
    const hours = Math.floor(diffMs / 3600000);

    let deadlineColor = theme.colors.textSecondary;
    if (isExpired) {
      deadlineColor = '#666';
    } else if (hours < 3) {
      deadlineColor = '#ef4444';
    } else if (hours < 24) {
      deadlineColor = '#f59e0b';
    }

    return {
      created: createdStr,
      deadline: expiresStr,
      deadlineColor,
      isExpired
    };
  };


  const datesInfo = getDatesInfo();


  const handleClose = () => {
    if (isPhotoViewerJustClosed || isDropdownJustClosed) return;
    
    hapticFeedback('light');
    setCurrentRequest(null);
    onClose();
  };


  const handleImageClick = (e, index) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setIsPhotoViewerOpen(true);
  };


  const handleRespond = async () => {
    if (!request || isOwner || request.has_responded || datesInfo?.isExpired) {
      return;
    }

    try {
      setResponding(true);
      hapticFeedback('medium');

      await respondToRequest(request.id, {});

      const updatedRequest = {
        ...request,
        has_responded: true,
        responses_count: (request.responses_count || 0) + 1
      };

      setRequest(updatedRequest);
      updateStoreRequest(request.id, {
        has_responded: true,
        responses_count: updatedRequest.responses_count
      });

      hapticFeedback('success');
      alert('✅ Отклик отправлен! Автор запроса сможет написать вам в Telegram.');

    } catch (error) {
      console.error('❌ Ошибка отклика:', error);
      hapticFeedback('error');
      alert('❌ ' + (error.message || 'Не удалось отправить отклик'));
    } finally {
      setResponding(false);
    }
  };


  const handleCloseRequest = async () => {
    if (!request || !isOwner) return;

    if (!window.confirm('Закрыть запрос? Его больше нельзя будет открыть.')) {
      return;
    }

    try {
      hapticFeedback('medium');
      await updateRequest(request.id, { status: 'closed' });
      hapticFeedback('success');
      handleClose();
    } catch (error) {
      console.error('❌ Ошибка закрытия:', error);
      hapticFeedback('error');
      alert('❌ ' + (error.message || 'Не удалось закрыть запрос'));
    }
  };


  const openTelegramChat = (username) => {
    if (!username) return;
    
    hapticFeedback('light');
    const cleanUsername = username.replace('@', '');
    window.open(`https://t.me/${cleanUsername}`, '_blank');
  };

  const handleCopyLink = async () => {
    if (!request) return;
    hapticFeedback('light');
    const link = `campusapp://request/${request.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
      setMenuOpen(false);
      setIsDropdownJustClosed(true);
      setTimeout(() => setIsDropdownJustClosed(false), 300);
    } catch (error) {
      console.error('Copy request link error:', error);
      toast.error('Не удалось скопировать ссылку');
    }
  };


  const menuItems = [
    ...(actionSet.canCopyLink ? [{
      label: 'Скопировать ссылку',
      icon: '🔗',
      actionType: 'copy',
      onClick: handleCopyLink
    }] : []),
    ...(actionSet.canEdit ? [{
        label: 'Редактировать',
        icon: '✏️',
        actionType: 'edit',
        onClick: () => {
          hapticFeedback('light');
          setMenuOpen(false);
          setIsDropdownJustClosed(true);
          setTimeout(() => setIsDropdownJustClosed(false), 300);
          if (onEdit) onEdit(request);
        }
      }] : []),
    ...(actionSet.canDelete ? [{
        label: 'Удалить',
        icon: '🗑️',
        actionType: 'delete',
        onClick: () => {
          hapticFeedback('medium');
          setMenuOpen(false);
          setIsDropdownJustClosed(true);
          setTimeout(() => setIsDropdownJustClosed(false), 300);
          if (onDelete) onDelete(request);
        }
      }] : []),
    ...(actionSet.canReportContent ? [{
      label: 'Пожаловаться',
      icon: '🚩',
      actionType: 'report',
      onClick: () => {
        hapticFeedback('light');
        setMenuOpen(false);
        setIsDropdownJustClosed(true);
        setTimeout(() => setIsDropdownJustClosed(false), 300);
        setShowReportModal(true);
      }
    }] : [])
  ];


  if (!request) {
    return null;
  }


  const photoGridColumns = images.length <= 3 ? 3 : 2;


  // Custom Header Component
  const customHeader = (
    <div style={{ ...styles.header, background: categoryConfig.gradient }}>
      <div style={styles.categoryLabel}>
        <span style={styles.categoryIcon}>{categoryConfig.icon}</span>
        <span style={styles.categoryText}>{categoryConfig.label}</span>
      </div>
      
      <div style={styles.headerRight}>
        {timeRemaining && (
          <div style={{
            ...styles.timer,
            color: timeRemaining.color,
            animation: timeRemaining.pulse ? 'pulse 2s ease-in-out infinite' : 'none'
          }}>
            <Clock size={14} style={{ marginRight: 4 }} />
            {timeRemaining.text}
          </div>
        )}

        <button
          ref={menuButtonRef}
          style={styles.menuButton}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
            hapticFeedback('light');
          }}
        >
          <MoreVertical size={18} />
        </button>
      </div>
    </div>
  );


  return (
    <>
      <style>{keyframesStyles}</style>

      <SwipeableModal
        isOpen={true}
        onClose={handleClose}
        title={customHeader}
      >
        <div style={styles.content}>
          <h1 style={styles.title}>{request.title}</h1>

          <div style={styles.authorBlock}>
            <Avatar 
              ref={authorAvatarRef}
              user={request.author}
              size={48}
              onClick={() => request.author?.show_profile && setProfileOpen(true)}
              showProfile={request.author?.show_profile}
            />
            <div style={styles.authorInfo}>
              <div style={styles.authorName}>{request.author?.username || request.author?.name || 'Аноним'}</div>
              <div style={styles.authorDetails}>
                {[
                  request.author?.course && `${request.author.course} курс`,
                  request.author?.university,
                  request.author?.institute
                ].filter(Boolean).join(' • ')}
              </div>
            </div>
            {isOwner && (
              <div style={styles.authorBadge}>Вы</div>
            )}
          </div>

          {request.reward_type && request.reward_type !== 'none' && (
            <div style={styles.rewardBlock}>
              <Gift size={20} style={{ flexShrink: 0, color: '#FFD700' }} />
              <div style={styles.rewardInfo}>
                <div style={styles.rewardLabel}>
                  {REWARD_TYPE_ICONS[request.reward_type] || '🎁'} {REWARD_TYPE_LABELS[request.reward_type] || 'Награда'}
                </div>
                {request.reward_value && (
                  <div style={styles.rewardValue}>{request.reward_value}</div>
                )}
              </div>
            </div>
          )}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Описание</h3>
            <p style={styles.body}>{request.body}</p>
          </div>

          {images.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Фотографии ({images.length})</h3>
              <div style={{
                ...styles.imagesGrid,
                gridTemplateColumns: `repeat(${photoGridColumns}, 1fr)`
              }}>
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    style={styles.imageItem}
                    onClick={(e) => handleImageClick(e, idx)}
                  >
                    <img 
                      src={getImageUrl(img)} 
                      alt="" 
                      style={styles.image}
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {request.tags && request.tags.length > 0 && (
            <div style={styles.tags}>
              {request.tags.map((tag, idx) => (
                <span key={idx} style={styles.tag}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {datesInfo && (
            <div style={styles.infoBlock}>
              <div style={styles.infoItem}>
                <Calendar size={16} color={theme.colors.textSecondary} />
                <span>Создано: {datesInfo.created}</span>
              </div>
              <div style={styles.infoItem}>
                <Clock size={16} color={datesInfo.deadlineColor} />
                <span style={{ color: datesInfo.deadlineColor }}>
                  Актуально до: {datesInfo.deadline}
                </span>
              </div>
            </div>
          )}

          {isOwner && responses.length > 0 && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                Отклики ({responses.length})
              </h3>

              <div style={styles.responsesList}>
                {responses.map((response) => (
                  <div key={response.id} style={styles.responseCard}>
                    <div style={styles.responseHeader}>
                      <div style={styles.responseAvatar}>
                        {response.author?.name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <div style={styles.responseInfo}>
                        <div style={styles.responseName}>
                          {response.author?.name || 'Аноним'}
                        </div>
                        <div style={styles.responseTime}>
                          {new Date(response.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>

                    {response.message && (
                      <div style={styles.responseMessage}>
                        {response.message}
                      </div>
                    )}

                    {response.telegram_contact && (
                      <button
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

          {/* Bottom Bar */}
          <div style={styles.bottomBar}>
            {isOwner ? (
              <button
                onClick={handleCloseRequest}
                style={styles.closeRequestButton}
                disabled={request.status === 'closed'}
              >
                {request.status === 'closed' ? '✓ Запрос закрыт' : 'Закрыть запрос'}
              </button>
            ) : request.has_responded ? (
              <button style={styles.respondedButton} disabled>
                ✓ Вы откликнулись
              </button>
            ) : datesInfo?.isExpired ? (
              <button style={styles.expiredButton} disabled>
                Запрос истёк
              </button>
            ) : (
              <button
                onClick={handleRespond}
                style={styles.respondButton}
                disabled={responding}
              >
                {responding ? 'Отправка...' : 'Откликнуться →'}
              </button>
            )}
          </div>
        </div>
      </SwipeableModal>

      <DropdownMenu
        isOpen={menuOpen}
        onClose={() => {
          setMenuOpen(false);
          setIsDropdownJustClosed(true);
          setTimeout(() => setIsDropdownJustClosed(false), 300);
        }}
        anchorRef={menuButtonRef}
        items={menuItems}
      />

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
      
      {request?.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={request.author}
          anchorRef={authorAvatarRef}
          onReportUser={() => {
            const targetUserId = request.author?.id || request.author_id;
            if (!targetUserId || isOwner) return;
            setShowUserReportModal(true);
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
    </>
  );
}


// ===== СТИЛИ =====
const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    color: '#fff',
    marginLeft: `-${theme.spacing.xl}px`,
    marginRight: `-${theme.spacing.xl}px`,
    marginTop: 0,
    marginBottom: theme.spacing.xl,
  },

  categoryLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm
  },

  categoryIcon: {
    fontSize: theme.fontSize.xl
  },

  categoryText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold
  },

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs
  },

  timer: {
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: theme.radius.md
  },

  menuButton: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: 'none',
    borderRadius: theme.radius.sm,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    padding: 0
  },

  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },

  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    lineHeight: 1.3,
    margin: 0,
  },

  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
  },

  authorInfo: {
    flex: 1
  },

  authorName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 4
  },

  authorDetails: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary
  },

  authorBadge: {
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    background: theme.colors.primary,
    color: '#fff',
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold
  },

  rewardBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 165, 0, 0.2) 100%)',
    border: '2px solid rgba(255, 215, 0, 0.3)',
    borderRadius: theme.radius.lg,
  },

  rewardInfo: {
    flex: 1
  },

  rewardLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#FFD700',
    marginBottom: 4
  },

  rewardValue: {
    fontSize: theme.fontSize.base,
    color: '#FFA500',
    fontWeight: theme.fontWeight.medium
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },

  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    margin: 0,
  },

  body: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    margin: 0,
  },

  imagesGrid: {
    display: 'grid',
    gap: theme.spacing.sm
  },

  imageItem: {
    position: 'relative',
    paddingTop: '100%',
    background: theme.colors.bgSecondary,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    cursor: 'pointer'
  },

  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },

  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  tag: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    background: 'rgba(135, 116, 225, 0.1)',
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.md
  },

  infoBlock: {
    padding: theme.spacing.lg,
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
  },

  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm
  },

  responsesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md
  },

  responseCard: {
    padding: theme.spacing.lg,
    background: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
  },

  responseHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md
  },

  responseAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    background: theme.colors.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    flexShrink: 0
  },

  responseInfo: {
    flex: 1
  },

  responseName: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: 2
  },

  responseTime: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary
  },

  responseMessage: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: theme.spacing.md
  },

  telegramButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    width: '100%',
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    background: '#0088cc',
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.md,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer'
  },

  bottomBar: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  respondButton: {
    width: '100%',
    padding: theme.spacing.lg,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(135, 116, 225, 0.4)'
  },

  respondedButton: {
    width: '100%',
    padding: theme.spacing.lg,
    background: '#10b981',
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'not-allowed',
    opacity: 0.7
  },

  expiredButton: {
    width: '100%',
    padding: theme.spacing.lg,
    background: '#666',
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'not-allowed',
    opacity: 0.5
  },

  closeRequestButton: {
    width: '100%',
    padding: theme.spacing.lg,
    background: '#ef4444',
    color: '#fff',
    border: 'none',
    borderRadius: theme.radius.lg,
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer'
  }
};

const keyframesStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

export default RequestDetailModal;
