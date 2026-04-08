// ===== 📄 ФАЙЛ: src/components/market/Market.js =====

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { getMarketItem, getMarketItems, triggerRegistrationPrompt } from '../../api';
import AppHeader from '../shared/AppHeader';
import MarketCard from './MarketCard';
import MarketDetail from './MarketDetail';
import MarketFilters from './MarketFilters';
import CreateMarketItem from './CreateMarketItem';
import EditMarketItemModal from './EditMarketItemModal';
// [LEGACY] import EdgeBlur from '../shared/EdgeBlur';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';
import { hapticFeedback } from '../../utils/telegram';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';
import PullToRefreshIndicator from '../shared/PullToRefreshIndicator';
import {
  MARKET_PAGE_SIZE,
  INFINITE_SCROLL_ROOT_MARGIN,
} from '../../constants/layoutConstants';
import { MARKET_CATEGORIES } from '../../constants/marketConstants';

const marketCategories = [
  { id: 'all', label: 'Все', emoji: '' },
  ...MARKET_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    emoji: category.icon,
  })),
];

const Market = () => {
  const { 
    marketItems, 
    setMarketItems, 
    marketFilters, 
    setMarketFilters,
    isRegistered,
    user,
    editingMarketItem,
    setEditingMarketItem,
    updateMarketItem,
    pendingMarketItemId,
    clearPendingMarketItemId,
  } = useStore();

  // ===== STATE =====
  const [selectedCategory, setSelectedCategory] = useState(marketFilters.category || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [error, setError] = useState(null);
  const [animationKey, setAnimationKey] = useState(0); // ✅ СОХРАНИЛИ

  // Refs
  const contentRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);

  // ✅ СТАБИЛИЗАЦИЯ marketFilters
  const stabilizedFilters = useMemo(() => ({
    category: marketFilters.category || 'all',
    price_min: marketFilters.price_min,
    price_max: marketFilters.price_max,
    condition: marketFilters.condition,
    location: marketFilters.location,
    university: marketFilters.university,
    institute: marketFilters.institute,
    sort: marketFilters.sort,
  }), [
    marketFilters.category,
    marketFilters.price_min,
    marketFilters.price_max,
    marketFilters.condition,
    marketFilters.location,
    marketFilters.university,
    marketFilters.institute,
    marketFilters.sort,
  ]);

  // ✅ МЕМОИЗАЦИЯ СЧЁТЧИКА ФИЛЬТРОВ
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (stabilizedFilters.category && stabilizedFilters.category !== 'all') count++;
    if (stabilizedFilters.price_min || stabilizedFilters.price_max) count++;
    if (stabilizedFilters.condition) count++;
    if (stabilizedFilters.location && stabilizedFilters.location !== 'all') count++;
    if (stabilizedFilters.sort !== 'newest') count++;
    return count;
  }, [stabilizedFilters]);

  const marketRows = useMemo(() => (
    buildFeedSections(
      marketItems,
      (item) => item.created_at,
      { getItemKey: (item) => item.id }
    )
  ), [marketItems]);

  // ===== LOAD DATA =====
  const loadItems = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const currentPage = reset ? 0 : page;
      const limit = MARKET_PAGE_SIZE;
      
      const filters = {
        ...stabilizedFilters, // ✅ ИСПОЛЬЗУЕМ СТАБИЛИЗИРОВАННЫЙ
        skip: currentPage * limit,
        limit,
        search: searchQuery || undefined,
        category: stabilizedFilters.category !== 'all' ? stabilizedFilters.category : undefined,
      };

      const result = await getMarketItems(filters);
      
      if (reset) {
        setMarketItems(result.items);
        setPage(1);
      } else {
        const existingIds = new Set(marketItems.map(item => item.id));
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
    }
  }, [loading, page, searchQuery, stabilizedFilters, user, marketItems, setMarketItems]);

  // ===== EFFECTS =====
  
  // ✅ БЕЗ JSON.stringify
  useEffect(() => {
    setSelectedCategory(marketFilters.category || 'all');
  }, [marketFilters.category]);

  useEffect(() => {
    loadItems(true);
  }, [searchQuery, stabilizedFilters, loadItems]);

  useEffect(() => {
    if (!pendingMarketItemId) return;

    let isCancelled = false;

    const openPendingItem = async () => {
      try {
        const item = await getMarketItem(pendingMarketItemId);
        if (!isCancelled && item) {
          setShowDetail(item);
        }
      } catch (error) {
        if (!isCancelled) {
          const status = error?.response?.status;
          toast.error(status === 404 ? 'Товар не найден' : 'Не удалось загрузить товар');
        }
      } finally {
        if (!isCancelled) {
          clearPendingMarketItemId();
        }
      }
    };

    openPendingItem();

    return () => {
      isCancelled = true;
    };
  }, [pendingMarketItemId, clearPendingMarketItemId]);

  // Infinite Scroll
  useEffect(() => {
    const options = { root: null, rootMargin: INFINITE_SCROLL_ROOT_MARGIN, threshold: 0 };
    observerRef.current = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasMore && !loading) {
        loadItems();
      }
    }, options);

    if (loadMoreTriggerRef.current) {
      observerRef.current.observe(loadMoreTriggerRef.current);
    }

    return () => { if (observerRef.current) observerRef.current.disconnect(); };
  }, [hasMore, loading, loadItems]);

  // ===== HANDLERS =====
  const haptic = (type = 'light') => hapticFeedback(type);

  const handleRefresh = useCallback(() => {
    setPage(0);
    loadItems(true);
  }, [loadItems]);

  const { pullY, pullProgress, isRefreshing, snapping } = usePullToRefresh({
    onRefresh: handleRefresh,
    loading,
  });

  const handleSearchChange = (val) => setSearchQuery(val);

  const handleCategoryChange = useCallback((id) => { 
    haptic('light'); 
    setSelectedCategory(id); 
    setMarketFilters({ category: id });
    setPage(0);
    setAnimationKey(prev => prev + 1); // ✅ АНИМАЦИЯ
  }, [setMarketFilters]); // ✅ useCallback

  const handleOpenFilters = useCallback(() => { 
    haptic('light'); 
    setShowFilters(true); 
  }, []); // ✅ useCallback

  const handleApplyFilters = useCallback(() => { 
    setPage(0);
    setAnimationKey(prev => prev + 1); // ✅ АНИМАЦИЯ
  }, []); // ✅ useCallback

  const handleCardClick = useCallback((item) => { 
    haptic('medium'); 
    if (!isRegistered) {
      triggerRegistrationPrompt('open_market_item');
      return;
    }
    setShowDetail(item); 
  }, [isRegistered]); // ✅ useCallback

  return (
    <div style={styles.container}>

      {/* Верхний градиент — затемнение без блюра */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 'var(--app-fixed-left)',
        width: 'var(--app-fixed-width)',
        height: 'var(--header-padding, 160px)',
        background: 'linear-gradient(to bottom, rgba(8,8,8,0.88) 0%, rgba(8,8,8,0.45) 55%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 99,
        transition: 'height 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
      }} />

      {/* Нижний градиент — затемнение без блюра */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 'var(--app-fixed-left)',
        width: 'var(--app-fixed-width)',
        height: 120,
        background: 'linear-gradient(to top, rgba(8,8,8,0.80) 0%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 50,
      }} />

      <PullToRefreshIndicator
        pullY={pullY}
        pullProgress={pullProgress}
        isRefreshing={isRefreshing}
        snapping={snapping}
        text="Обновляем маркет"
      />

      <AppHeader
        title="Маркет"
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder="Поиск в маркете..."
        onSearchChange={handleSearchChange}
        categories={marketCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleOpenFilters}
        activeFiltersCount={activeFiltersCount}
        premium
        premiumCollapsedToolbar
        freezeBottomChromeOnSearchFocus
      />

      {/* CONTENT */}
      <div style={{
        ...styles.content,
        transform: `translateY(${pullY}px)`,
        transition: snapping ? 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      }} ref={contentRef}>

        {error && !loading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>⚠️</div>
            <div style={styles.emptyTitle}>{error}</div>
            <button style={styles.retryButton} onClick={handleRefresh}>Повторить</button>
          </div>
        )}

        {!loading && !error && marketItems.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📦</div>
            <div style={styles.emptyTitle}>Ничего не найдено</div>
            <div style={styles.emptyText}>Попробуйте изменить фильтры</div>
          </div>
        )}

        {/* ✅ СЕТКА С АНИМАЦИЕЙ */}
        <div 
          style={{
            ...styles.grid,
            animation: 'gridFadeIn 0.25s ease' // ✅ СОХРАНИЛИ
          }}
          key={animationKey} // ✅ СОХРАНИЛИ ДЛЯ АНИМАЦИИ
        >
          {marketRows.map((row) => (
            row.type === 'divider' ? (
              <div key={row.key} style={styles.gridDividerItem}>
                <FeedDateDivider label={row.label} />
              </div>
            ) : (
              <MarketCard
                key={row.key}
                item={row.item}
                index={row.index}
                onClick={() => handleCardClick(row.item)}
              />
            )
          ))}
          
          {loading && [...Array(4)].map((_, i) => (
            <MarketCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>

        {hasMore && !loading && marketItems.length > 0 && (
          <div ref={loadMoreTriggerRef} style={styles.loadMoreTrigger} />
        )}
      </div>

      {/* MODALS */}
      {showFilters && (
        <MarketFilters onClose={() => setShowFilters(false)} onApply={handleApplyFilters} />
      )}

      {showCreateItem && (
        <CreateMarketItem onClose={() => { setShowCreateItem(false); handleRefresh(); }} />
      )}

      {showDetail && (
        <MarketDetail item={showDetail} onClose={() => setShowDetail(null)} onUpdate={handleRefresh} />
      )}

      {editingMarketItem && (
        <EditMarketItemModal 
          item={editingMarketItem} 
          onClose={() => setEditingMarketItem(null)} 
          onSuccess={(item) => { 
            updateMarketItem(item.id, item); 
            setEditingMarketItem(null); 
            loadItems(true); 
          }} 
        />
      )}
    </div>
  );
};

// ===== SKELETON =====
const MarketCardSkeleton = () => (
  <div style={styles.skeletonCard}>
    <div style={styles.skeletonImage} />
    <div style={styles.skeletonInfo}>
      <div style={styles.skeletonLine} />
      <div style={styles.skeletonLineShort} />
    </div>
  </div>
);

// ===== STYLES =====
const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.premium.bg,
    minHeight: '100vh',
  },

  content: {
    // Header: 4px container + 28px title + 8px margin + 8px drawer-top + 44px search + 10px gap + 36px chips + 6px drawer-bottom = 144px
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 160px)',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.md,
    padding: '0 12px 100px 12px',
  },
  gridDividerItem: {
    gridColumn: '1 / -1',
  },


  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', minHeight: 300 },
  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: theme.colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, maxWidth: 300 },
  retryButton: { marginTop: 16, background: theme.colors.premium.primary, border: 'none', borderRadius: 12, padding: '12px 24px', color: '#000', fontWeight: 600, cursor: 'pointer' },
  loadMoreTrigger: { height: 20, width: '100%' },
  
  skeletonCard: { background: theme.colors.card, borderRadius: 20, overflow: 'hidden', animation: 'pulse 1.5s infinite', border: `1px solid ${theme.colors.premium.border}` },
  skeletonImage: { width: '100%', aspectRatio: '1', background: theme.colors.bgSecondary },
  skeletonInfo: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  skeletonLine: { height: 16, background: theme.colors.bgSecondary, borderRadius: 4 },
  skeletonLineShort: { height: 16, width: '60%', background: theme.colors.bgSecondary, borderRadius: 4 },
};

// ✅ АНИМАЦИИ СОХРАНЕНЫ
if (!document.getElementById('market-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'market-animations';
  styleSheet.textContent = `
    @keyframes pulse { 
      0%, 100% { opacity: 1; } 
      50% { opacity: 0.5; } 
    }
    
    @keyframes spin { 
      from { transform: rotate(0deg); } 
      to { transform: rotate(360deg); } 
    }
    
    @keyframes gridFadeIn {
      from { 
        opacity: 0.3; 
      }
      to { 
        opacity: 1; 
      }
    }
  `;
  document.head.appendChild(styleSheet);
}

export default Market;
