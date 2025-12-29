// ===== 📄 ФАЙЛ: src/components/market/Market.js =====

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { getMarketItems } from '../../api';
import AppHeader from '../shared/AppHeader';
import MarketCard from './MarketCard';
import MarketDetail from './MarketDetail';
import MarketFilters from './MarketFilters';
import CreateMarketItem from './CreateMarketItem';
import theme from '../../theme';

const Market = () => {
  const { 
    marketItems, 
    setMarketItems, 
    marketFilters, 
    user 
  } = useStore();

  // ===== STATE =====
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'my' | 'favorites'
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

  // Refs
  const contentRef = useRef(null);
  const observerRef = useRef(null);
  const loadMoreTriggerRef = useRef(null);

  // ===== CATEGORIES =====
  const categories = [
    { id: 'all', label: 'Все', emoji: '📋' },
    { id: 'textbooks', label: 'Учебники', emoji: '📚' },
    { id: 'electronics', label: 'Электроника', emoji: '💻' },
    { id: 'furniture', label: 'Мебель', emoji: '🛋️' },
    { id: 'clothing', label: 'Одежда', emoji: '👕' },
    { id: 'sports', label: 'Спорт', emoji: '⚽' },
    { id: 'appliances', label: 'Техника', emoji: '🔌' },
  ];

  // ===== DYNAMIC TITLE =====
  const getDynamicTitle = () => {
    if (activeTab === 'my') return 'Мои товары';
    if (activeTab === 'favorites') return 'Избранное';
    if (selectedCategory === 'all') return 'Барахолка';
    const category = categories.find(c => c.id === selectedCategory);
    return category ? category.label : 'Барахолка';
  };

  // ===== LOAD DATA =====
  const loadItems = useCallback(async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    setError(null);

    try {
      const currentPage = reset ? 0 : page;
      const limit = 20;
      
      const filters = {
        ...marketFilters,
        skip: currentPage * limit,
        limit,
        search: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
      };

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
  }, [loading, page, selectedCategory, searchQuery, marketFilters, activeTab, user, marketItems, setMarketItems]);

  // ===== EFFECTS =====
  useEffect(() => {
    loadItems(true);
  }, [selectedCategory, searchQuery, activeTab, JSON.stringify(marketFilters)]);

  // Infinite Scroll
  useEffect(() => {
    const options = { root: null, rootMargin: '200px', threshold: 0 };
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

  // Pull to Refresh (Basic)
  useEffect(() => {
    let startY = 0;
    const handleTouchStart = (e) => { if (window.scrollY === 0) startY = e.touches[0].clientY; };
    const handleTouchMove = (e) => {
      if (window.scrollY === 0 && e.touches[0].clientY - startY > 80 && !refreshing) {
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
  }, [refreshing]);

  // ===== HANDLERS =====
  const haptic = (type) => window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(type);

  const handleRefresh = () => { haptic('light'); setPage(0); loadItems(true); };
  const handleSearchChange = (val) => setSearchQuery(val);
  const handleCategoryChange = (id) => { haptic('light'); setSelectedCategory(id); setPage(0); };
  const handleOpenFilters = () => { haptic('light'); setShowFilters(true); };
  const handleApplyFilters = () => { setPage(0); loadItems(true); };
  const handleCardClick = (item) => { haptic('medium'); setShowDetail(item); };

  // Новый хендлер табов (с вибрацией)
  const handleTabSwitch = (tab) => {
    if (activeTab !== tab) {
      haptic('medium');
      setActiveTab(tab);
      setPage(0);
    }
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (marketFilters.price_min || marketFilters.price_max) count++;
    if (marketFilters.condition) count++;
    if (marketFilters.location !== 'all') count++;
    if (marketFilters.sort !== 'newest') count++;
    return count;
  };

  // Расчет позиции индикатора для 3-х табов
  const getIndicatorPosition = () => {
    switch (activeTab) {
      case 'all': return '0%';
      case 'my': return '100%';
      case 'favorites': return '200%';
      default: return '0%';
    }
  };

  return (
    <div style={styles.container}>
      
      <AppHeader 
        title={getDynamicTitle()}
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder="Поиск товаров..."
        onSearchChange={handleSearchChange}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleOpenFilters}
        activeFiltersCount={getActiveFiltersCount()}
      >
        {/* ✅ НОВЫЕ ТАБЫ (SEGMENTED CONTROL - GREEN STYLE) */}
        <div style={styles.tabsWrapper}>
          <div style={styles.tabsContainer}>
            {/* Зеленый индикатор */}
            <div 
              style={{
                ...styles.activeIndicator,
                transform: `translateX(${getIndicatorPosition()})`,
              }} 
            />
            
            <button 
              onClick={() => handleTabSwitch('all')}
              style={{...styles.tabButton, color: activeTab === 'all' ? '#fff' : theme.colors.textSecondary}}
            >
              Все
            </button>

            <button 
              onClick={() => handleTabSwitch('my')}
              style={{...styles.tabButton, color: activeTab === 'my' ? '#fff' : theme.colors.textSecondary}}
            >
              Мои
            </button>

            <button 
              onClick={() => handleTabSwitch('favorites')}
              style={{...styles.tabButton, color: activeTab === 'favorites' ? '#fff' : theme.colors.textSecondary}}
            >
              Избранное
            </button>
          </div>
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

        {/* СЕТКА ТОВАРОВ */}
        <div style={styles.grid}>
          {marketItems.map((item, index) => (
            <MarketCard
              key={item.id}
              item={item}
              index={index}
              onClick={() => handleCardClick(item)}
            />
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
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
  },

  // ✅ НОВЫЕ СТИЛИ ТАБОВ
  tabsWrapper: {
    padding: '0 12px 12px 12px',
  },

  tabsContainer: {
    position: 'relative',
    display: 'flex',
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radius.lg,
    padding: '4px',
    height: 44,
    border: `1px solid ${theme.colors.border}`,
  },

  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    width: 'calc(33.33% - 4px)', // Треть ширины минус отступы
    backgroundColor: theme.colors.market, // 💚 ЗЕЛЕНЫЙ ЦВЕТ ДЛЯ БАРАХОЛКИ
    borderRadius: theme.radius.md,
    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)', // Зеленая тень
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: 1,
  },

  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    background: 'transparent',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ✅ ОБНОВЛЕННЫЙ CONTENT
  content: {
    // Используем нашу "магическую" формулу отступа
    paddingTop: 'calc(var(--header-padding, 104px) + 16px)',
    transition: 'padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.md,
    padding: '0 12px 100px 12px', // Отступы по бокам и снизу
  },

  // Остальные стили (без изменений)
  refreshIndicator: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, color: theme.colors.textSecondary },
  refreshIcon: { fontSize: 20, animation: 'spin 1s linear infinite' },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', minHeight: 300 },
  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: theme.colors.text, marginBottom: 8 },
  emptyText: { fontSize: 14, color: theme.colors.textSecondary, maxWidth: 300 },
  retryButton: { marginTop: 16, background: theme.colors.market, border: 'none', borderRadius: 12, padding: '12px 24px', color: '#fff', fontWeight: 600 },
  loadMoreTrigger: { height: 20, width: '100%' },
  
  skeletonCard: { background: theme.colors.card, borderRadius: 16, overflow: 'hidden', animation: 'pulse 1.5s infinite', aspectRatio: '0.7' },
  skeletonImage: { width: '100%', height: '60%', background: theme.colors.bgSecondary },
  skeletonInfo: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8 },
  skeletonLine: { height: 16, background: theme.colors.bgSecondary, borderRadius: 4 },
  skeletonLineShort: { height: 16, width: '60%', background: theme.colors.bgSecondary, borderRadius: 4 },
};

// Animations
if (!document.getElementById('market-animations')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'market-animations';
  styleSheet.textContent = `
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(styleSheet);
}

export default Market;