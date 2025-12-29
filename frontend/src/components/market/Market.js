// ===== 📄 ФАЙЛ: src/components/Market/Market.js =====

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { getMarketItems } from '../../api';
import MarketCard from './MarketCard';
import MarketDetail from './MarketDetail';
import MarketFilters from './MarketFilters';
import theme from '../../theme';

const Market = () => {
  const { 
    marketItems, 
    setMarketItems, 
    marketFilters, 
    user 
  } = useStore();

  // ===== STATE =====
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Refs
  const contentRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);

  // ===== CATEGORIES =====
  const categories = [
    { id: 'all', label: 'Все', icon: '📋' },
    { id: 'textbooks', label: 'Учебники', icon: '📚' },
    { id: 'electronics', label: 'Электроника', icon: '💻' },
    { id: 'furniture', label: 'Мебель', icon: '🛋️' },
    { id: 'clothing', label: 'Одежда', icon: '👕' },
    { id: 'sports', label: 'Спорт', icon: '⚽' },
    { id: 'appliances', label: 'Техника', icon: '🔌' },
  ];

  // ===== LOAD DATA (С ИСПРАВЛЕНИЕМ ДУБЛИКАТОВ) =====
  const loadItems = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const currentPage = reset ? 0 : page;
      const limit = 20;
      
      // Подготовка фильтров
      const filters = {
        // 1. Сначала дефолтные фильтры из стора (чтобы их можно было переопределить)
        ...marketFilters,
        
        // 2. Затем пагинация и поиск
        skip: currentPage * limit,
        limit,
        search: searchQuery || undefined,
        
        // 3. Категория из чипсов имеет приоритет над фильтром, если она выбрана
        // Если selectedCategory !== 'all', мы перезаписываем то, что пришло из marketFilters
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      };

      // Фильтрация по табам (добавляет флаги для api.js)
      if (activeTab === 'my') {
        filters.seller_id = user?.id;
      } else if (activeTab === 'favorites') {
        filters.favorites_only = true;
      }

      const result = await getMarketItems(filters);
      
      if (reset) {
        setMarketItems(result.items);
        setPage(1);
      } else {
        // ✅ ФИКС: Фильтруем дубликаты перед добавлением
        // Берем текущие ID
        const existingIds = new Set(marketItems.map(item => item.id));
        // Оставляем только те новые, которых еще нет
        const uniqueNewItems = result.items.filter(item => !existingIds.has(item.id));
        
        if (uniqueNewItems.length > 0) {
          setMarketItems([...marketItems, ...uniqueNewItems]);
        }
        
        setPage(currentPage + 1);
      }

      setHasMore(result.has_more);

    } catch (err) {
      console.error('Ошибка загрузки товаров:', err);
      setError('Не удалось загрузить товары');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loading, page, selectedCategory, searchQuery, marketFilters, activeTab, user, marketItems, setMarketItems]);

  // ===== INITIAL LOAD =====
    // Срабатывает автоматически при изменении фильтров, поиска или табов
    useEffect(() => {
        loadItems(true);
    }, [
        selectedCategory, 
        searchQuery, 
        activeTab,
        // ✅ ФИКС: Используем JSON.stringify, чтобы React точно увидел изменения внутри объекта фильтров
        JSON.stringify(marketFilters) 
    ]);

  // ===== INFINITE SCROLL =====
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '200px', // Грузим заранее
      threshold: 0,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !loading) {
        loadItems();
      }
    }, options);

    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, loadItems]);

  // ===== PULL TO REFRESH =====
  useEffect(() => {
    let startY = 0;
    let isDragging = false;

    const handleTouchStart = (e) => {
      if (contentRef.current?.scrollTop === 0) {
        startY = e.touches[0].clientY;
        isDragging = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 80 && !refreshing) {
        setRefreshing(true);
        isDragging = false;
        handleRefresh();
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener('touchstart', handleTouchStart);
      content.addEventListener('touchmove', handleTouchMove);
      content.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (content) {
        content.removeEventListener('touchstart', handleTouchStart);
        content.removeEventListener('touchmove', handleTouchMove);
        content.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [refreshing]);

  // ===== HANDLERS =====
  const handleRefresh = () => {
    haptic('light');
    setPage(0);
    loadItems(true);
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(0);
      loadItems(true);
    }, 300);
  };

  const handleCategoryChange = (categoryId) => {
    haptic('light');
    setSelectedCategory(categoryId);
    setPage(0);
  };

  const handleTabChange = (tab) => {
    haptic('medium');
    setActiveTab(tab);
    setPage(0);
  };

  const handleOpenFilters = () => {
    haptic('light');
    setShowFilters(true);
  };

  const handleApplyFilters = () => {
    // Загрузку вызовет useEffect выше, так как marketFilters в сторе изменились.
    // Ручной вызов loadItems(true) здесь вызывал бы запрос со СТАРЫМИ данными.
    setPage(0);
  };

  const handleCardClick = (item) => {
    haptic('medium');
    setShowDetail(item);
  };

  const haptic = (type) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (marketFilters.price_min !== null) count++;
    if (marketFilters.price_max !== null) count++;
    if (marketFilters.condition) count++;
    if (marketFilters.location !== 'all') count++;
    if (marketFilters.sort !== 'newest') count++;
    return count;
  };

  const filteredItems = marketItems; // Фильтрация теперь на сервере + поисковая строка

  // ===== RENDER =====
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTop}>
          <div style={styles.headerTitle}>🛒 Барахолка</div>
          <div style={styles.headerActions}>
            <button style={styles.headerButton} onClick={handleOpenFilters}>
              <span style={styles.headerIcon}>🎛️</span>
              {getActiveFiltersCount() > 0 && (
                <div style={styles.filterBadge}>{getActiveFiltersCount()}</div>
              )}
            </button>
            <button style={styles.headerButton} onClick={() => handleTabChange('favorites')}>
              <span style={styles.headerIcon}>❤️</span>
            </button>
          </div>
        </div>

        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Поиск товаров..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button style={styles.searchClear} onClick={() => handleSearch('')}>✕</button>
          )}
        </div>

        <div style={styles.categoryChips} className="market-category-chips">
          {categories.map((cat) => (
            <button
              key={cat.id}
              style={{
                ...styles.categoryChip,
                ...(selectedCategory === cat.id ? styles.categoryChipActive : {}),
              }}
              onClick={() => handleCategoryChange(cat.id)}
            >
              <span style={styles.categoryChipIcon}>{cat.icon}</span>
              <span style={styles.categoryChipLabel}>{cat.label}</span>
            </button>
          ))}
        </div>

        <div style={styles.tabs}>
          {['all', 'my', 'favorites'].map(tab => (
             <button
              key={tab}
              style={{
                ...styles.tab,
                ...(activeTab === tab ? styles.tabActive : {}),
              }}
              onClick={() => handleTabChange(tab)}
            >
              {tab === 'all' ? 'Все' : tab === 'my' ? 'Мои' : 'Избранное'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content} ref={contentRef}>
        {refreshing && (
          <div style={styles.refreshIndicator}>
            <span style={styles.refreshIcon}>↻</span>
            <span style={styles.refreshText}>Обновление...</span>
          </div>
        )}

        {error && !loading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⚠️</div>
            <div style={styles.emptyTitle}>{error}</div>
            <button style={styles.retryButton} onClick={handleRefresh}>Попробовать снова</button>
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <div style={styles.emptyTitle}>Ничего не найдено</div>
            <div style={styles.emptyText}>Попробуйте изменить параметры поиска</div>
          </div>
        )}

        <div style={styles.grid}>
          {filteredItems.map((item, index) => (
            <MarketCard
              key={item.id} // ⚠️ Ключи теперь точно уникальны благодаря фильтрации
              item={item}
              index={index}
              onClick={() => handleCardClick(item)}
            />
          ))}
          
          {loading && [...Array(4)].map((_, i) => <MarketCardSkeleton key={`skeleton-${i}`} />)}
        </div>

        {hasMore && !loading && filteredItems.length > 0 && (
          <div ref={loadMoreTriggerRef} style={styles.loadMoreTrigger} />
        )}
      </div>

      {showFilters && (
        <MarketFilters onClose={() => setShowFilters(false)} onApply={handleApplyFilters} />
      )}

      {showDetail && (
        <MarketDetail item={showDetail} onClose={() => setShowDetail(null)} onUpdate={handleRefresh} />
      )}
    </div>
  );
};

// ... Skeleton and Styles remain the same ...
// ✅ Убедись, что styles.grid имеет paddingBottom: theme.spacing.xl, 
// чтобы контент не перекрывался таббаром если он есть

const MarketCardSkeleton = () => (
  <div style={styles.skeletonCard}>
    <div style={styles.skeletonImage} />
    <div style={styles.skeletonInfo}>
      <div style={styles.skeletonLine} />
      <div style={styles.skeletonLineShort} />
    </div>
  </div>
);

const styles = {
    container: {
        paddingBottom: 80,
        minHeight: '100vh',
        backgroundColor: theme.colors.bgPrimary,
    },
    header: {
        background: theme.colors.card,
        borderBottom: `1px solid ${theme.colors.border}`,
        display: 'flex',
        flexDirection: 'column',
    },
    headerTop: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing.lg,
    },
    headerTitle: {
        fontSize: theme.fontSize.xl,
        fontWeight: theme.fontWeight.bold,
        color: theme.colors.text,
    },
    headerActions: {
        display: 'flex',
        gap: theme.spacing.sm,
    },
    headerButton: {
        position: 'relative',
        background: theme.colors.bgSecondary,
        border: 'none',
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        cursor: 'pointer',
    },
    headerIcon: {
        fontSize: theme.fontSize.xl,
    },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        background: theme.colors.market,
        color: theme.colors.text,
        fontSize: theme.fontSize.xs,
        fontWeight: theme.fontWeight.bold,
        padding: `2px ${theme.spacing.xs}px`,
        borderRadius: theme.radius.full,
        minWidth: 18,
        height: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        background: theme.colors.bgSecondary,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
        margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
    },
    searchIcon: {
        fontSize: theme.fontSize.lg,
        color: theme.colors.textSecondary,
    },
    searchInput: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        color: theme.colors.text,
        fontSize: theme.fontSize.base,
        outline: 'none',
    },
    searchClear: {
        background: 'transparent',
        border: 'none',
        color: theme.colors.textSecondary,
        fontSize: theme.fontSize.base,
        padding: theme.spacing.xs,
    },
    categoryChips: {
        display: 'flex',
        gap: theme.spacing.sm,
        padding: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
    },
    categoryChip: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
        background: theme.colors.bgSecondary,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.full,
        padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
        whiteSpace: 'nowrap',
        transition: theme.transitions.fast,
    },
    categoryChipActive: {
        background: theme.colors.market,
        borderColor: theme.colors.market,
    },
    categoryChipIcon: { fontSize: theme.fontSize.base },
    categoryChipLabel: {
        fontSize: theme.fontSize.sm,
        fontWeight: theme.fontWeight.medium,
        color: theme.colors.text,
    },
    tabs: {
        display: 'flex',
        borderTop: `1px solid ${theme.colors.border}`,
    },
    tab: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        borderBottomWidth: '2px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'transparent',
        padding: theme.spacing.md,
        color: theme.colors.textSecondary,
        fontSize: theme.fontSize.base,
        fontWeight: theme.fontWeight.medium,
    },
    tabActive: {
        color: theme.colors.market,
        borderBottomColor: theme.colors.market,
    },
    content: {
        flex: 1,
        // overflowY: 'auto' // Убрал, так как скролл на window для infinite scroll лучше работает
    },
    refreshIndicator: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.md,
        color: theme.colors.textSecondary,
    },
    refreshIcon: {
        fontSize: theme.fontSize.xl,
        animation: 'spin 1s linear infinite',
    },
    refreshText: { fontSize: theme.fontSize.sm },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: theme.spacing.md,
        padding: theme.spacing.lg,
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xxxl,
        textAlign: 'center',
        minHeight: 300,
    },
    emptyIcon: { fontSize: 64, marginBottom: theme.spacing.lg, opacity: 0.5 },
    emptyTitle: {
        fontSize: theme.fontSize.lg,
        fontWeight: theme.fontWeight.semibold,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    emptyText: {
        fontSize: theme.fontSize.base,
        color: theme.colors.textSecondary,
        maxWidth: 300,
    },
    retryButton: {
        marginTop: theme.spacing.lg,
        background: theme.colors.market,
        border: 'none',
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.md}px ${theme.spacing.xl}px`,
        color: theme.colors.text,
        fontSize: theme.fontSize.base,
        fontWeight: theme.fontWeight.semibold,
    },
    loadMoreTrigger: {
        height: 20,
        width: '100%',
    },
    skeletonCard: {
        background: theme.colors.card,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        animation: 'pulse 1.5s ease-in-out infinite',
        aspectRatio: '0.7',
    },
    skeletonImage: {
        width: '100%',
        height: '60%',
        background: theme.colors.bgSecondary,
    },
    skeletonInfo: {
        padding: theme.spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
    },
    skeletonLine: {
        height: 16,
        background: theme.colors.bgSecondary,
        borderRadius: 4,
    },
    skeletonLineShort: {
        height: 16,
        width: '60%',
        background: theme.colors.bgSecondary,
        borderRadius: 4,
    },
};

// CSS Animations
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .market-category-chips { scrollbar-width: none; -ms-overflow-style: none; }
  .market-category-chips::-webkit-scrollbar { display: none; }
`;
document.head.appendChild(styleSheet);

export default Market;