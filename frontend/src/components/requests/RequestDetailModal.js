// ===== RequestDetailModal.js =====

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Clock, Calendar, User, MoreVertical, Edit2, Trash2, Flag, Gift } from 'lucide-react';
import { useStore } from '../../store';
import { getRequestById, respondToRequest, updateRequest, getRequestResponses } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_FORMS } from '../../constants/zIndex';
import { REWARD_TYPE_LABELS, REWARD_TYPE_ICONS } from '../../types';
import DropdownMenu from '../DropdownMenu';
import PhotoViewer from '../shared/PhotoViewer';

const API_URL = 'http://localhost:8000';

function RequestDetailModal({ onClose, onEdit, onDelete, onReport }) {
  const { currentRequest, setCurrentRequest, user, updateRequest: updateStoreRequest } = useStore();
  
  const [request, setRequest] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerJustClosed, setIsPhotoViewerJustClosed] = useState(false);
  
  const modalRef = useRef(null);
  const menuButtonRef = useRef(null);
  const startYRef = useRef(0);
  const currentYRef = useRef(0);

  // ===== КАТЕГОРИИ =====
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

  // ===== ПАРСИНГ ИЗОБРАЖЕНИЙ =====
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

  // ===== ЗАГРУЗКА ДАННЫХ =====
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

      // Если я автор - загружаем отклики
      if (data.is_author) {
        const responsesData = await getRequestResponses(currentRequest.id);
        setResponses(responsesData || []);
      }

    } catch (error) {
      console.error('❌ Ошибка загрузки запроса:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===== ТАЙМЕР =====
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

  // ===== ДАТЫ (СОЗДАНИЕ И ДЕДЛАЙН) =====
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

  // ===== СВАЙП ДЛЯ ЗАКРЫТИЯ =====
  const handleTouchStart = (e) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    currentYRef.current = e.touches[0].clientY;
    const diff = currentYRef.current - startYRef.current;

    if (diff > 0 && modalRef.current) {
      modalRef.current.style.transform = `translateY(${diff}px)`;
    }
  };

  const handleTouchEnd = () => {
    const diff = currentYRef.current - startYRef.current;

    if (diff > 150) {
      handleClose();
    } else if (modalRef.current) {
      modalRef.current.style.transform = 'translateY(0)';
    }
  };

  // ===== ЗАКРЫТИЕ =====
  const handleClose = () => {
    if (isPhotoViewerJustClosed) return;
    
    hapticFeedback('light');
    setCurrentRequest(null);
    onClose();
  };

  // ===== КЛИК НА BACKDROP =====
  const handleBackdropClick = (e) => {
    if (isPhotoViewerJustClosed) return;
    handleClose();
  };

  // ===== КЛИК НА ФОТО =====
  const handleImageClick = (e, index) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(index);
    setIsPhotoViewerOpen(true);
  };

  // ===== ОТКЛИКНУТЬСЯ =====
  const handleRespond = async () => {
    if (!request || request.is_author || request.has_responded || datesInfo?.isExpired) {
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

  // ===== ЗАКРЫТЬ ЗАПРОС (для автора) =====
  const handleCloseRequest = async () => {
    if (!request || !request.is_author) return;

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

  // ===== ОТКРЫТЬ TELEGRAM ЧАТ =====
  const openTelegramChat = (username) => {
    if (!username) return;
    
    hapticFeedback('light');
    const cleanUsername = username.replace('@', '');
    window.open(`https://t.me/${cleanUsername}`, '_blank');
  };

  // ===== МЕНЮ ДЕЙСТВИЙ =====
  const menuItems = [
    ...(request?.is_author ? [
      {
        label: 'Редактировать',
        icon: <Edit2 size={18} />,
        onClick: () => {
          hapticFeedback('light');
          setMenuOpen(false);
          if (onEdit) onEdit(request);
        }
      },
      {
        label: 'Удалить',
        icon: <Trash2 size={18} />,
        danger: true,
        onClick: () => {
          hapticFeedback('medium');
          setMenuOpen(false);
          if (onDelete) onDelete(request);
        }
      }
    ] : []),
    {
      label: 'Пожаловаться',
      icon: <Flag size={18} />,
      danger: !request?.is_author,
      onClick: () => {
        hapticFeedback('light');
        setMenuOpen(false);
        if (onReport) onReport(request);
      }
    }
  ];

  if (!request) {
    return null;
  }

  // Определяем количество колонок для фото: 1-3 фото = 3 колонки, 4+ = 2 колонки
  const photoGridColumns = images.length <= 3 ? 3 : 2;

  return (
    <>
      <style>{keyframesStyles}</style>

      {/* BACKDROP */}
      <div style={styles.backdrop} onClick={handleBackdropClick} />

      {/* МОДАЛКА */}
      <div
        ref={modalRef}
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* HANDLE для свайпа */}
        <div style={styles.handle} />

        {/* КНОПКА ЗАКРЫТЬ */}
        <button onClick={handleClose} style={styles.closeButton}>
          <X size={24} color={theme.colors.text} />
        </button>

        {/* ХЕДЕР КАТЕГОРИИ */}
        <div style={{ ...styles.header, background: categoryConfig.gradient }}>
          <div style={styles.categoryLabel}>
            <span style={styles.categoryIcon}>{categoryConfig.icon}</span>
            <span style={styles.categoryText}>{categoryConfig.label}</span>
          </div>
          
          <div style={styles.headerRight}>
            {/* ТАЙМЕР */}
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

        {/* КОНТЕНТ */}
        <div style={styles.content}>
          {/* ЗАГОЛОВОК */}
          <h1 style={styles.title}>{request.title}</h1>

          {/* БЛОК АВТОРА */}
          <div style={styles.authorBlock}>
            <div style={styles.authorAvatar}>
              {request.author?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div style={styles.authorInfo}>
              <div style={styles.authorName}>{request.author?.name || 'Аноним'}</div>
              <div style={styles.authorDetails}>
                {[
                  request.author?.course && `${request.author.course} курс`,
                  request.author?.university,
                  request.author?.institute
                ].filter(Boolean).join(' • ')}
              </div>
            </div>
            {request.is_author && (
              <div style={styles.authorBadge}>Вы</div>
            )}
          </div>

          {/* НАГРАДА */}
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

          {/* ОПИСАНИЕ */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Описание</h3>
            <p style={styles.body}>{request.body}</p>
          </div>

          {/* ФОТО */}
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

          {/* ТЕГИ */}
          {request.tags && request.tags.length > 0 && (
            <div style={styles.tags}>
              {request.tags.map((tag, idx) => (
                <span key={idx} style={styles.tag}>
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* ИНФО БЛОК: ДАТЫ */}
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

          {/* ОТКЛИКИ (только для автора) */}
          {request.is_author && responses.length > 0 && (
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
        </div>

        {/* STICKY КНОПКА ВНИЗУ */}
        <div style={styles.bottomBar}>
          {request.is_author ? (
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
    </>
  );
}

// ===== СТИЛИ =====
const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    zIndex: Z_MODAL_FORMS,
    animation: 'fadeIn 0.25s ease-out'
  },

  modal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    minHeight: '50vh',
    maxHeight: '90vh',
    background: theme.colors.bg,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    zIndex: Z_MODAL_FORMS + 1,
    animation: 'slideUp 0.3s ease-out',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    overflowY: 'auto',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)',
    willChange: 'transform'
  },

  handle: {
    width: 40,
    height: 4,
    background: theme.colors.textTertiary,
    borderRadius: theme.radius.full,
    margin: `${theme.spacing.md}px auto`,
    opacity: 0.5
  },

  closeButton: {
    position: 'absolute',
    top: theme.spacing.lg,
    right: theme.spacing.lg,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    background: 'rgba(0, 0, 0, 0.5)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
    color: '#fff'
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
    padding: theme.spacing.xl,
    paddingBottom: 10
  },

  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    lineHeight: 1.3,
    marginBottom: theme.spacing.xl
  },

  authorBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    background: '#252525',
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.xl
  },

  authorAvatar: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    background: theme.colors.primary,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    flexShrink: 0
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
    marginBottom: theme.spacing.xl
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
    marginBottom: theme.spacing.xl
  },

  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md
  },

  body: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap'
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
    marginBottom: theme.spacing.xl
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
    background: '#252525',
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.xl
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
    background: '#252525',
    borderRadius: theme.radius.lg,
    border: `1px solid ${theme.colors.border}`
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
    position: 'sticky',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.lg,
    background: theme.colors.bg,
    borderTop: `1px solid ${theme.colors.border}`,
    zIndex: 10
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

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
`;

export default RequestDetailModal;