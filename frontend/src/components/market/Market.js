// ===== 📄 ФАЙЛ: src/components/market/Market.js =====

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { getMarketItems, triggerRegistrationPrompt } from '../../api';
import AppHeader from '../shared/AppHeader';
import MarketCard from './MarketCard';
import MarketDetail from './MarketDetail';
import MarketFilters from './MarketFilters';
import CreateMarketItem from './CreateMarketItem';
import EditMarketItemModal from './EditMarketItemModal';
import EdgeBlur from '../shared/EdgeBlur';
import theme from '../../theme';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';
import { hapticFeedback } from '../../utils/telegram';
import {
  MARKET_PAGE_SIZE,
  PULL_TO_REFRESH_THRESHOLD,
  INFINITE_SCROLL_ROOT_MARGIN,
} from '../../constants/layoutConstants';

const Market = () => {
  const { 
    marketItems, 
    setMarketItems, 
    marketFilters, 
    isRegistered,
    user,
    editingMarketItem,
    setEditingMarketItem,
    updateMarketItem
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
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // ✅ СОХРАНИЛИ

  const [headerScrolled, setHeaderScrolled] = useState(false);

  // Refs
  const contentRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);
  const startYRef = useRef(0); // ✅ ДЛЯ PULL TO REFRESH

  // ===== CATEGORIES =====
  const goodsCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'books', label: 'Учебники', emoji: '📚' },
    { id: 'electronics', label: 'Техника', emoji: '💻' },
    { id: 'clothes', label: 'Одежда', emoji: '👕' },
    { id: 'home', label: 'Общага', emoji: '🛋️' },
    { id: 'hobby', label: 'Хобби', emoji: '🎸' },
  ];

  const servicesCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'tutor', label: 'Репетитор', emoji: '👨‍🏫' },
    { id: 'homework', label: 'Курсачи', emoji: '📝' },
    { id: 'repair', label: 'Ремонт', emoji: '🛠️' },
    { id: 'design', label: 'Дизайн', emoji: '🎨' },
    { id: 'delivery', label: 'Курьер', emoji: '🏃' },
  ];

  const currentCategories = activeTab === 'services' ? servicesCategories : goodsCategories;

  // ✅ СТАБИЛИЗАЦИЯ marketFilters
  const stabilizedFilters = useMemo(() => ({
    price_min: marketFilters.price_min,
    price_max: marketFilters.price_max,
    condition: marketFilters.condition,
    location: marketFilters.location,
    university: marketFilters.university,
    institute: marketFilters.institute,
    sort: marketFilters.sort,
  }), [
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
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        item_type: activeTab === 'services' ? 'service' : 'product',
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
      setRefreshing(false);
    }
  }, [loading, page, selectedCategory, searchQuery, stabilizedFilters, activeTab, user, marketItems, setMarketItems]);

  // ===== EFFECTS =====
  
  // ✅ БЕЗ JSON.stringify
  useEffect(() => {
    loadItems(true);
  }, [selectedCategory, searchQuery, activeTab, stabilizedFilters]);

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

  // ✅ ОПТИМИЗИРОВАННЫЙ Pull to Refresh
  useEffect(() => {
    const handleTouchStart = (e) => { 
      if (window.scrollY === 0) startYRef.current = e.touches[0].clientY; 
    };
    
    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && e.touches[0].clientY - startYRef.current > PULL_TO_REFRESH_THRESHOLD && !refreshing) {
        setRefreshing(true);
        handleRefresh();
      }
    };
    
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [refreshing, loading]); // ✅ ТОЛЬКО НУЖНЫЕ ЗАВИСИМОСТИ

  // Scroll-детект для EdgeBlur (синхронно с premium AppHeader)
  useEffect(() => {
    const handleScroll = () => setHeaderScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ===== HANDLERS =====
  const haptic = (type = 'light') => hapticFeedback(type);

  const handleRefresh = useCallback(() => { 
    haptic('light'); 
    setPage(0); 
    loadItems(true); 
  }, [loadItems]); // ✅ useCallback

  const handleSearchChange = (val) => setSearchQuery(val);

  const handleCategoryChange = useCallback((id) => { 
    haptic('light'); 
    setSelectedCategory(id); 
    setPage(0);
    setAnimationKey(prev => prev + 1); // ✅ АНИМАЦИЯ
  }, []); // ✅ useCallback

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

  const handleTabSwitch = useCallback((tab) => {
    if (activeTab !== tab) {
      haptic('medium');
      setActiveTab(tab);
      setSelectedCategory('all');
      setPage(0);
      setAnimationKey(prev => prev + 1);
    }
  }, [activeTab]);

  return (
    <div style={styles.container}>

      <EdgeBlur position="top" height={headerScrolled ? 90 : 160} zIndex={50} animateHeight />
      <EdgeBlur position="bottom" height={100} zIndex={50} />

      <AppHeader
        title="Маркет"
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder="Поиск товаров..."
        onSearchChange={handleSearchChange}
        categories={currentCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleOpenFilters}
        activeFiltersCount={activeFiltersCount}
        premium
      >
        <div style={{ position: 'relative', width: '100%', display: 'flex' }}>
          <div
            style={{
              ...styles.activeIndicator,
              transform: `translateX(${activeTab === 'all' ? '0' : '100%'})`,
            }}
          />
          <button
            onClick={() => handleTabSwitch('all')}
            style={{ ...styles.tabButton, color: activeTab === 'all' ? '#000' : '#FFF' }}
          >
            Товары
          </button>
          <button
            onClick={() => handleTabSwitch('services')}
            style={{ ...styles.tabButton, color: activeTab === 'services' ? '#000' : '#FFF' }}
          >
            Услуги
          </button>
        </div>
      </AppHeader>

      {/* CONTENT */}
      <div style={styles.content} ref={contentRef}>
        {refreshing && (
          <div style={styles.refreshIndicator}>
            <span style={styles.refreshIcon}>↻</span>
            <span>Обновление...</span>
          </div>
        )}

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

  activeIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '50%',
    backgroundColor: theme.colors.premium.primary,
    borderRadius: 15,
    boxShadow: `0 2px 10px ${theme.colors.premium.primary}30`,
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },

  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    background: 'transparent',
    border: 'none',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    paddingTop: 'var(--header-padding, 140px)',
    transition: 'padding-top 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
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

  refreshIndicator: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, color: theme.colors.textSecondary },
  refreshIcon: { fontSize: 20, animation: 'spin 1s linear infinite' },
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
