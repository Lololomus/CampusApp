// ===== RequestsFeed.js (РЕФАКТОРЕННЫЙ) =====

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { getRequestsFeed } from '../../api';
import RequestCard from './RequestCard';
import RequestCardSkeleton from './RequestCardSkeleton';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import RequestDetailModal from './RequestDetailModal';

// ✅ ДОБАВЛЕНЫ PROPS: category, searchQuery
function RequestsFeed({ category = 'all', searchQuery = '' }) {
  const { requests, setRequests, setCurrentRequest } = useStore();
  
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

      const cat = category === 'all' ? null : category;
      const response = await getRequestsFeed(cat, 20, offsetRef.current);

      console.log('✅ Загружено запросов:', response.items?.length || 0);

      const newRequests = response.items || [];

      if (reset) {
        setRequests(newRequests);
      } else {
        setRequests([...requests, ...newRequests]);
      }

      setHasMore(response.has_more);
      offsetRef.current += newRequests.length;

    } catch (error) {
      console.error('❌ Ошибка загрузки запросов:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [category, requests, setRequests]);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    loadRequests(true);
  }, [category]);

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

  return (
    <div style={styles.container}>
      {/* ✅ УБРАН HEADER И FILTERS (теперь в Feed.js) */}

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
            {filteredRequests.map((request, index) => (
              <div
                key={request.id}
                ref={index === filteredRequests.length - 1 ? lastCardRef : null}
              >
                <RequestCard
                  request={request}
                  onClick={handleCardClick}
                />
              </div>
            ))}

            {loading && hasMore && <RequestCardSkeleton />}
          </>
        ) : (
          <EmptyState 
            category={category}
            hasSearch={!!searchQuery.trim()}
          />
        )}
      </div>

      {/* МОДАЛКИ */}
      {showDetailModal && (
        <RequestDetailModal onClose={() => setShowDetailModal(false)} />
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

// ===== СТИЛИ (УПРОЩЕНЫ) =====
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    // Убрали все отступы, так как они задаются в родителе (Feed.js)
  },

  feed: {
    flex: 1,
    // Убрали overflowY, так как скроллится вся страница (window)
    
    // ✅ ИСПРАВЛЕНИЕ: Убрали padding-top, padding-left, padding-right, padding-bottom.
    // Теперь этот блок просто занимает доступное место внутри Feed.js.
    display: 'block', 
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