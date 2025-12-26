// ===== RequestsFeed.js =====

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../../store';
import { getRequestsFeed } from '../../api';
import RequestCard from './RequestCard';
import RequestCardSkeleton from './RequestCardSkeleton';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import RequestDetailModal from './RequestDetailModal';

function RequestsFeed() {
  const { requests, setRequests, setCurrentRequest } = useStore();
  
  // ===== STATE =====
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  const offsetRef = useRef(0);
  const isLoadingRef = useRef(false);
  const observerRef = useRef(null);
  const lastCardRef = useRef(null);

  // ===== КАТЕГОРИИ ФИЛЬТРОВ =====
  const CATEGORIES = [
    { id: 'all', label: 'Все', icon: '' },
    { id: 'study', label: 'Учёба', icon: '📚' },
    { id: 'help', label: 'Помощь', icon: '🤝' },
    { id: 'hangout', label: 'Движ', icon: '🎉' }
  ];

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

      const category = activeCategory === 'all' ? null : activeCategory;
      const response = await getRequestsFeed(category, 20, offsetRef.current);

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
  }, [activeCategory, requests, setRequests]);

  // ===== INITIAL LOAD =====
  useEffect(() => {
    loadRequests(true);
  }, [activeCategory]);

  // ===== INFINITE SCROLL (IntersectionObserver) =====
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

  // ===== СМЕНА КАТЕГОРИИ =====
  const handleCategoryChange = (categoryId) => {
    if (categoryId === activeCategory) return;
    
    hapticFeedback('light');
    setActiveCategory(categoryId);
    setHasMore(true);
    offsetRef.current = 0;
  };

  // ===== КЛИК НА КАРТОЧКУ =====
  const handleCardClick = (request) => {
    setCurrentRequest(request);
    setShowDetailModal(true);
  };

  // ===== ФИЛЬТРАЦИЯ ПО ПОИСКУ (клиентская) =====
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
      {/* ХЕДЕР С ПОИСКОМ */}
      <div style={styles.header}>
        <div style={styles.searchContainer}>
          <Search size={18} color={theme.colors.textTertiary} />
          <input
            type="text"
            placeholder="Поиск запросов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* ФИЛЬТРЫ КАТЕГОРИЙ */}
      <div style={styles.filters}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            style={{
              ...styles.filterButton,
              ...(activeCategory === cat.id ? styles.filterButtonActive : {})
            }}
          >
            {cat.icon && <span style={styles.filterIcon}>{cat.icon}</span>}
            {cat.label}
          </button>
        ))}
      </div>

      {/* ЛЕНТА КАРТОЧЕК */}
      <div style={styles.feed}>
        {loading && requests.length === 0 ? (
          // SKELETON при первой загрузке
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

            {/* LOADER ПРИ ПОДГРУЗКЕ */}
            {loading && hasMore && <RequestCardSkeleton />}
          </>
        ) : (
          // EMPTY STATE
          <EmptyState 
            category={activeCategory}
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

// ===== EMPTY STATE КОМПОНЕНТ =====
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
        subtitle: 'Создай запрос на помощь с курсовой или найди репетитора'
      },
      help: {
        icon: '🤝',
        title: 'Нет запросов на помощь',
        subtitle: 'Попроси помощь или предложи свою'
      },
      hangout: {
        icon: '🎉',
        title: 'Нет запросов на движ',
        subtitle: 'Собери компанию на игру или прогулку'
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
    background: theme.colors.bg // #121212
  },

  // ХЕДЕР С ПОИСКОМ
  header: {
    padding: theme.spacing.lg, // 16px
    paddingBottom: theme.spacing.md, // 12px
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'sticky',
    top: 0,
    background: theme.colors.bg,
    zIndex: 10
  },

  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm, // 8px
    background: theme.colors.bgSecondary, // #1a1a1a
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.md, // 12px
    border: `1px solid ${theme.colors.border}`
  },

  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: theme.colors.text,
    fontSize: theme.fontSize.base, // 14px
    fontFamily: 'inherit'
  },

  // ФИЛЬТРЫ
  filters: {
    display: 'flex',
    gap: theme.spacing.sm, // 8px
    padding: theme.spacing.lg, // 16px
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    '::-webkit-scrollbar': {
      display: 'none'
    }
  },

  filterButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs, // 4px
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.full, // круглые углы
    border: `1px solid ${theme.colors.border}`,
    background: theme.colors.bgSecondary, // #1a1a1a
    color: theme.colors.textSecondary, // #ccc
    fontSize: theme.fontSize.sm, // 13px
    fontWeight: theme.fontWeight.medium, // 500
    cursor: 'pointer',
    transition: theme.transitions.normal, // 0.2s ease
    whiteSpace: 'nowrap',
    outline: 'none'
  },

  filterButtonActive: {
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, #b19ef5 100%)`,
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 12px rgba(135, 116, 225, 0.4)'
  },

  filterIcon: {
    fontSize: theme.fontSize.md // 15px
  },

  // ЛЕНТА
  feed: {
    flex: 1,
    padding: theme.spacing.lg, // 16px
    paddingTop: 0,
    overflowY: 'auto',
    paddingBottom: 80 // отступ для навигации
  },

  // EMPTY STATE
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${theme.spacing.xxxl}px ${theme.spacing.lg}px`,
    textAlign: 'center',
    minHeight: 300
  },

  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.lg // 16px
  },

  emptyTitle: {
    fontSize: theme.fontSize.xl, // 18px
    fontWeight: theme.fontWeight.semibold, // 600
    color: theme.colors.text, // #fff
    marginBottom: theme.spacing.sm // 8px
  },

  emptySubtitle: {
    fontSize: theme.fontSize.base, // 14px
    color: theme.colors.textSecondary, // #ccc
    lineHeight: 1.5,
    maxWidth: 300
  }
};

export default RequestsFeed;