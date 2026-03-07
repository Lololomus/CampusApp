// ===== 📄 ФАЙЛ: frontend/src/components/requests/RequestsFeed.js (ОБНОВЛЕНО) =====

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { getRequestsFeed, deleteRequest, getRequestById } from '../../api';
import RequestCard from './RequestCard';
import RequestCardSkeleton from './RequestCardSkeleton';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import RequestDetailModal from './RequestDetailModal';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';


function RequestsFeed({ category = 'all', searchQuery = '' }) {
  const { 
    requests, 
    setRequests, 
    setCurrentRequest,
    user,
    deleteRequest: deleteStoreRequest,
    setEditingContent,
    requestsFilters,
  } = useStore();
  
  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const observerRef = useRef(null);
  const lastCardRef = useRef(null);


  // ===== ЗАГРУЗКА ЗАПРОСОВ =====
  const loadRequests = useCallback(async (reset = false) => {
    if (isLoadingRef.current) return;

    try {
      isLoadingRef.current = true;
      setLoading(true);

      if (reset) {
        offsetRef.current = 0;
        setRequests([]);
      }

      // ПОДГОТОВКА ФИЛЬТРОВ ДЛЯ API
      const apiFilters = {
        category: category === 'all' ? null : category,
        limit: 20,
        offset: offsetRef.current,
      };

      // Локация
      if (requestsFilters.location === 'my_university') {
        apiFilters.university = requestsFilters.university;
      } else if (requestsFilters.location === 'my_institute') {
        apiFilters.university = requestsFilters.university;
        apiFilters.institute = requestsFilters.institute;
      }

      // Статус
      if (requestsFilters.status !== 'active') {
        apiFilters.status = requestsFilters.status;
      }

      // Вознаграждение
      if (requestsFilters.hasReward !== 'all') {
        apiFilters.hasReward = requestsFilters.hasReward;
      }

      // Срочность
      if (requestsFilters.urgency !== 'all') {
        apiFilters.urgency = requestsFilters.urgency;
      }

      // Сортировка
      if (requestsFilters.sort !== 'newest') {
        apiFilters.sort = requestsFilters.sort;
      }

      console.log('📡 Загрузка запросов с фильтрами:', apiFilters);

      const response = await getRequestsFeed(apiFilters);

      console.log('✅ Загружено запросов:', response.items?.length || 0);

      const newRequests = response.items || [];

      if (reset) {
        setRequests(newRequests);
      } else {
        setRequests((prev) => {
          const merged = [...prev, ...newRequests];
          const byId = new Map();
          merged.forEach((req) => byId.set(req.id, req));
          return Array.from(byId.values());
        });
      }

      setHasMore(response.has_more);
      offsetRef.current += newRequests.length;

    } catch (error) {
      console.error('❌ Ошибка загрузки запросов:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [category, setRequests, requestsFilters]); // ✅ ДОБАВИЛИ requestsFilters


  // ===== INITIAL LOAD (ОБНОВЛЕНО) =====
  useEffect(() => {
    loadRequests(true);
  }, [loadRequests]); // ✅ ДОБАВИЛИ requestsFilters


  // ===== INFINITE SCROLL =====
  useEffect(() => {
    if (loading || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingRef.current && hasMore) {
          console.log('📦 Загружаем еще запросы...');
          loadRequests(false);
        }
      },
      { threshold: 0.1 }
    );

    if (lastCardRef.current) {
      observer.observe(lastCardRef.current);
    }

    observerRef.current = observer;

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loading, hasMore, loadRequests]);


  // ===== РЕДАКТИРОВАТЬ ЗАПРОС =====
  const handleEdit = async (request) => {
    console.log('✏️ Редактирование запроса:', request.id);
    
    // Загружаем ПОЛНЫЕ данные с сервера
    try {
      hapticFeedback('light');
      
      // Закрываем модалки
      setShowDetailModal(false);
      setCurrentRequest(null);
      
      // Загружаем полные данные запроса
      console.log('📡 Загружаем полные данные запроса...');
      const fullRequest = await getRequestById(request.id);
      
      console.log('✅ Полные данные получены:', fullRequest);
      
      // Открываем EditContentModal с ПОЛНЫМИ данными
      setEditingContent(fullRequest, 'request');
      
    } catch (error) {
      console.error('❌ Ошибка загрузки запроса:', error);
      hapticFeedback('error');
      alert('Не удалось загрузить данные запроса');
    }
  };


  // ===== УДАЛИТЬ ЗАПРОС =====
  const handleDelete = async (request) => {
    console.log('🗑️ Удаление запроса:', request.id);
    
    if (!window.confirm(`Удалить запрос "${request.title}"? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      hapticFeedback('medium');
      
      await deleteRequest(request.id);
      
      // Удаляем из store
      deleteStoreRequest(request.id);
      
      // Закрываем модалку (если открыта)
      setShowDetailModal(false);
      setCurrentRequest(null);
      
      hapticFeedback('success');
      
      console.log('✅ Запрос удалён:', request.id);
      
    } catch (error) {
      console.error('❌ Ошибка удаления:', error);
      hapticFeedback('error');
      alert('❌ Не удалось удалить запрос. Попробуйте ещё раз.');
    }
  };

  // ===== КЛИК НА КАРТОЧКУ =====
  const handleCardClick = (request) => {
    setCurrentRequest(request);
    setShowDetailModal(true);
  };


  // ===== ФИЛЬТРАЦИЯ ПО ПОИСКУ =====
  const filteredRequests = requests.filter(req => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      req.title?.toLowerCase().includes(query) ||
      req.body?.toLowerCase().includes(query) ||
      req.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  const requestRows = useMemo(() => (
    buildFeedSections(
      filteredRequests,
      (req) => req.created_at,
      { getItemKey: (req) => req.id }
    )
  ), [filteredRequests]);

  const lastVisibleRequestId = filteredRequests.length
    ? filteredRequests[filteredRequests.length - 1].id
    : null;


  return (
    <div style={styles.container}>
      {/* ЛЕНТА КАРТОЧЕК */}
      <div style={styles.feed}>
        {loading && requests.length === 0 ? (
          <>
            <RequestCardSkeleton />
            <RequestCardSkeleton />
            <RequestCardSkeleton />
          </>
        ) : filteredRequests.length > 0 ? (
          <>
            {requestRows.map((row, rowIndex) => {
              const isAfterDivider =
                row.type === 'item' &&
                rowIndex > 0 &&
                requestRows[rowIndex - 1].type === 'divider';

              return row.type === 'divider' ? (
                <FeedDateDivider key={row.key} label={row.label} />
              ) : (
                <div
                  key={row.key}
                  ref={row.item.id === lastVisibleRequestId ? lastCardRef : null}
                >
                  <RequestCard
                    request={row.item}
                    onClick={handleCardClick}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    currentUserId={user?.id}
                    compactTop={isAfterDivider}
                  />
                </div>
              );
            })}

            {loading && hasMore && <RequestCardSkeleton />}
          </>
        ) : (
          <EmptyState 
            category={category}
            hasSearch={!!searchQuery.trim()}
          />
        )}
      </div>

      {/* МОДАЛКА ДЕТАЛЬНОГО ПРОСМОТРА */}
      {showDetailModal && (
        <RequestDetailModal 
          onClose={() => setShowDetailModal(false)}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}


// ===== EMPTY STATE =====
function EmptyState({ category, hasSearch }) {
  const getEmptyMessage = () => {
    if (hasSearch) {
      return {
        icon: '🔍',
        title: 'Ничего не найдено',
        subtitle: 'Попробуйте изменить запрос'
      };
    }

    const messages = {
      all: {
        icon: '🎯',
        title: 'Пока нет запросов',
        subtitle: 'Будь первым, кто создаст запрос!'
      },
      study: {
        icon: '📚',
        title: 'Нет запросов по учёбе',
        subtitle: 'Создай запрос на помощь с курсовой'
      },
      help: {
        icon: '🤝',
        title: 'Нет запросов на помощь',
        subtitle: 'Попроси помощь или предложи свою'
      },
      hangout: {
        icon: '🎉',
        title: 'Нет запросов на движ',
        subtitle: 'Собери компанию на игру'
      }
    };

    return messages[category] || messages.all;
  };

  const message = getEmptyMessage();

  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{message.icon}</div>
      <div style={styles.emptyTitle}>{message.title}</div>
      <div style={styles.emptySubtitle}>{message.subtitle}</div>
    </div>
  );
}


// ===== СТИЛИ =====
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },

  feed: {
    flex: 1,
    display: 'block',
    paddingBottom: theme.spacing.sm,
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${theme.spacing.xxxl}px ${theme.spacing.lg}px`,
    textAlign: 'center',
    minHeight: 300,
  },

  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },

  emptyTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },

  emptySubtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    maxWidth: 300,
  },
};


export default RequestsFeed;
