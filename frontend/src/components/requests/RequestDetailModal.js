// ===== RequestDetailModal.js =====

import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, MessageCircle, Clock, Calendar, User } from 'lucide-react';
import { useStore } from '../../store';
import { getRequestById, respondToRequest, updateRequest, getRequestResponses } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { Z_MODAL_FORMS } from '../../constants/zIndex';

function RequestDetailModal({ onClose }) {
  const { currentRequest, setCurrentRequest, user, updateRequest: updateStoreRequest } = useStore();
  
  const [request, setRequest] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  
  const modalRef = useRef(null);
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

      // Загружаем полные данные запроса
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
  const getTimeInfo = () => {
    if (!request?.expires_at) return null;

    const now = new Date();
    const expiresAt = new Date(request.expires_at);
    const diffMs = expiresAt - now;

    if (diffMs <= 0) {
      return {
        text: 'Запрос истёк',
        color: '#666',
        expired: true
      };
    }

    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    let timeLeft = '';
    let color = theme.colors.textSecondary;

    if (days > 0) {
      timeLeft = `${days}д ${hours % 24}ч`;
    } else if (hours > 0) {
      timeLeft = `${hours}ч ${minutes % 60}м`;
      color = hours < 3 ? '#f59e0b' : theme.colors.textSecondary;
    } else {
      timeLeft = `${minutes}м`;
      color = '#ef4444';
    }

    // Форматируем дату
    const dateStr = expiresAt.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      text: `Актуально до ${dateStr}`,
      timeLeft,
      color,
      expired: false
    };
  };

  const timeInfo = getTimeInfo();

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
    hapticFeedback('light');
    setCurrentRequest(null);
    onClose();
  };

  // ===== ОТКЛИКНУТЬСЯ =====
  const handleRespond = async () => {
    if (!request || request.is_author || request.has_responded || timeInfo?.expired) {
      return;
    }

    try {
      setResponding(true);
      hapticFeedback('medium');

      await respondToRequest(request.id, {});

      // Обновляем локальное состояние
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

  if (!request) {
    return null;
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* BACKDROP */}
      <div style={styles.backdrop} onClick={handleClose} />

      {/* МОДАЛКА */}
      <div
        ref={modalRef}
        style={styles.modal}
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
          {timeInfo && !timeInfo.expired && (
            <div style={{ ...styles.timer, color: timeInfo.color }}>
              <Clock size={14} style={{ marginRight: 4 }} />
              {timeInfo.timeLeft}
            </div>
          )}
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

          {/* ОПИСАНИЕ */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Описание</h3>
            <p style={styles.body}>{request.body}</p>
          </div>

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

          {/* ИНФО БЛОК */}
          <div style={styles.infoBlock}>
            {timeInfo && (
              <div style={styles.infoItem}>
                <Calendar size={16} color={timeInfo.color} />
                <span style={{ color: timeInfo.color }}>{timeInfo.text}</span>
              </div>
            )}
            <div style={styles.statsRow}>
              <div style={styles.statItem}>
                <Eye size={16} />
                <span>{request.views_count || 0} просмотров</span>
              </div>
              <div style={styles.statItem}>
                <MessageCircle size={16} />
                <span>{request.responses_count || 0} откликов</span>
              </div>
            </div>
          </div>

          {/* ОТКЛИКИ (только для автора) */}
          {request.is_author && (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                Отклики ({responses.length})
              </h3>

              {responses.length > 0 ? (
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
              ) : (
                <div style={styles.emptyResponses}>
                  <MessageCircle size={32} color={theme.colors.textTertiary} />
                  <p style={styles.emptyText}>Пока нет откликов</p>
                </div>
              )}
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
          ) : timeInfo?.expired ? (
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
    animation: 'fadeIn 0.3s ease'
  },

  modal: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90vh',
    background: theme.colors.bg,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    zIndex: Z_MODAL_FORMS + 1,
    animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    overflowY: 'auto',
    boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.5)'
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
    zIndex: 10,
    transition: theme.transitions.normal
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

  timer: {
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    padding: `${theme.spacing.xs}px ${theme.spacing.md}px`,
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: theme.radius.md
  },

  content: {
    padding: theme.spacing.xl,
    paddingBottom: 100
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

  section: {
    marginBottom: theme.spacing.xl
  },

  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`
  },

  body: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap'
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
    marginBottom: theme.spacing.md
  },

  statsRow: {
    display: 'flex',
    gap: theme.spacing.xl
  },

  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary
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
    cursor: 'pointer',
    transition: theme.transitions.normal
  },

  emptyResponses: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
    textAlign: 'center'
  },

  emptyText: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textTertiary,
    marginTop: theme.spacing.md
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
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
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
    cursor: 'pointer',
    transition: theme.transitions.normal
  }
};

export default RequestDetailModal;