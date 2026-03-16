// ===== 📄 ФАЙЛ: src/components/shared/AppHeader.js =====

import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useStore } from '../../store';
import { triggerRegistrationPrompt } from '../../api';

const AppHeader = ({
  title = '',
  subtitle = null,
  showSearch = false,
  searchValue = '',
  searchPlaceholder = 'Поиск...',
  onSearchChange = null,
  categories = null,
  selectedCategory = 'all',
  onCategoryChange = null,
  showFilters = false,
  onFiltersClick = null,
  activeFiltersCount = 0,
  rightActions = [],
  transparent = false,
  children = null,
  accentColor, // ✅ НОВЫЙ ПРОП: для перекраски в зеленый
  premium = false, // #New Premium: включает новый визуальный режим
  categoryOutline = false, // когда true, активная категория = border + text (без заливки)
}) => {
  // ===== STATE =====
  const [searchFocused, setSearchFocused] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [collapsibleVisible, setCollapsibleVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // #New Premium: scroll + ручное открытие поиска
  const [isScrolled, setIsScrolled] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const premiumSearchRef = useRef(null);
  const isModalOpen = useStore((state) => Boolean(
    state.showAuthModal ||
    state.showCreateModal ||
    state.showCreateRequestModal ||
    state.showCreateMarketItem ||
    state.showEditModal ||
    state.editingContent ||
    state.viewPostId ||
    state.currentRequest ||
    state.currentMarketItem ||
    state.showSettingsModal ||
    state.showLikesModal ||
    state.showMatchModal
  ));
  const isRegistered = useStore((state) => Boolean(state.isRegistered));

  // #New Premium: drawer виден если не скроллили ИЛИ если юзер нажал лупу
  const showDrawer = !isScrolled || isManualExpanded;

  // ===== REFS =====
  const searchTimeoutRef = useRef(null);
  const categoriesRef = useRef(null);

  // Рефы для блоков
  const stickyRef = useRef(null);
  const collapsibleRef = useRef(null);

  // Состояние высот для точной синхронизации
  const [dimensions, setDimensions] = useState({ sticky: 56, collapsible: 0 });

  // ✅ ОПРЕДЕЛЯЕМ АКТИВНЫЙ ЦВЕТ
  const effectiveAccentColor = accentColor || theme.colors.primary;

  // ===== 1. ИЗМЕРЕНИЕ ВЫСОТЫ (ТВОЯ ОРИГИНАЛЬНАЯ ЛОГИКА) =====
  useLayoutEffect(() => {
    const updateDimensions = () => {
      const sticky = stickyRef.current ? stickyRef.current.offsetHeight : 56;
      const collapsible = collapsibleRef.current ? collapsibleRef.current.offsetHeight : 0;
      
      setDimensions({ sticky, collapsible });
      
      document.documentElement.style.setProperty('--sticky-height', `${sticky}px`);
    };

    const observer = new ResizeObserver(updateDimensions);
    if (stickyRef.current) observer.observe(stickyRef.current);
    if (collapsibleRef.current) observer.observe(collapsibleRef.current);
    
    updateDimensions();
    return () => observer.disconnect();
  }, [children, showSearch, categories]);

  // ===== 2. УМНЫЙ ОТСТУП =====
  useEffect(() => {
    const totalHeight = collapsibleVisible 
      ? dimensions.sticky + dimensions.collapsible 
      : dimensions.sticky;

    document.documentElement.style.setProperty('--header-padding', `${totalHeight}px`);
  }, [collapsibleVisible, dimensions]);

  // ===== SCROLL HANDLER =====
  useEffect(() => {
    const handleScroll = () => {
      if (isModalOpen || document.body.style.position === 'fixed') return;
      const currentScrollY = window.scrollY;

      if (currentScrollY < 10) {
        setCollapsibleVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setCollapsibleVisible(false);
      } else if (currentScrollY < lastScrollY) {
        setCollapsibleVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isModalOpen]);

  // #New Premium: scroll-детект для drawer-анимации
  useEffect(() => {
    if (!premium) return;
    const handlePremiumScroll = () => {
      if (isModalOpen || document.body.style.position === 'fixed') return;
      const y = window.scrollY;
      if (y > 40) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
        setIsManualExpanded(false);
      }
    };
    window.addEventListener('scroll', handlePremiumScroll, { passive: true });
    return () => window.removeEventListener('scroll', handlePremiumScroll);
  }, [premium, isModalOpen]);

  // #New Premium: автофокус при ручном открытии
  useEffect(() => {
    if (premium && isScrolled && isManualExpanded && premiumSearchRef.current) {
      premiumSearchRef.current.focus();
    }
  }, [premium, isScrolled, isManualExpanded]);

  // ===== DEBOUNCE SEARCH =====
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (localSearchValue !== searchValue && onSearchChange) {
      searchTimeoutRef.current = setTimeout(() => onSearchChange(localSearchValue), 300);
    }
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [localSearchValue, searchValue, onSearchChange]);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  // ===== HANDLERS =====
  const handleSearchInputChange = (e) => {
    const nextValue = e.target.value;
    if (!isRegistered && nextValue.trim().length > 0) {
      triggerRegistrationPrompt('search');
      return;
    }
    setLocalSearchValue(nextValue);
  };
  const handleClearSearch = () => {
    hapticFeedback('light');
    setLocalSearchValue('');
    if (onSearchChange) onSearchChange('');
  };
  const handleCategoryClick = (id) => {
    hapticFeedback('light');
    if (onCategoryChange) onCategoryChange(id);
  };
  const handleFiltersClick = () => {
    hapticFeedback('medium');
    if (!isRegistered) {
      triggerRegistrationPrompt('open_filters');
      return;
    }
    if (onFiltersClick) onFiltersClick();
  };

  const showClearButton = localSearchValue && localSearchValue.length > 0;

  // ===== STYLES =====
  const styles = {
    stickyHeader: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      backgroundColor: transparent 
        ? 'rgba(26, 26, 26, 0.8)' 
        : theme.colors.bgSecondary,
      backdropFilter: transparent ? 'blur(20px)' : 'blur(0px)',
      WebkitBackdropFilter: transparent ? 'blur(20px)' : 'blur(0px)',
      borderBottom: `1px solid ${theme.colors.border}`,
      paddingTop: 'var(--screen-top-offset)',
      transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 0.3s cubic-bezier(0.4, 0, 0.2, 1), -webkit-backdrop-filter 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    
    titleRow: {
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 12px',
      position: 'relative',
    },
    
    titleBlock: { textAlign: 'center', flex: 1 },
    title: { fontSize: 20, fontWeight: 600, color: theme.colors.text, margin: 0, lineHeight: '24px' },
    subtitle: { fontSize: 13, fontWeight: 400, color: theme.colors.textSecondary, margin: '2px 0 0 0' },
    
    rightActions: { position: 'absolute', right: 8, display: 'flex', gap: 4 },
    childrenContainer: { display: children ? 'block' : 'none' },

    collapsibleWrapper: {
      position: 'fixed',
      top: 'var(--sticky-height, 56px)',
      left: 0,
      right: 0,
      zIndex: 999,
      backgroundColor: theme.colors.bgSecondary,
      transform: collapsibleVisible ? 'translateY(0)' : 'translateY(-100%)',
      opacity: collapsibleVisible ? 1 : 0,
      pointerEvents: collapsibleVisible ? 'auto' : 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      borderBottom: `1px solid ${theme.colors.border}`,
    },

    searchRow: { display: showSearch ? 'flex' : 'none', alignItems: 'center', padding: '8px 12px', gap: 8 },
    searchContainer: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
    
    searchInput: {
      width: '100%',
      height: 40,
      backgroundColor: theme.colors.bg,
      // ✅ ИСПОЛЬЗУЕМ effectiveAccentColor ДЛЯ ФОКУСА
      border: `1px solid ${searchFocused ? effectiveAccentColor : theme.colors.border}`,
      borderRadius: theme.radius.md,
      padding: '0 36px',
      fontSize: 15,
      color: theme.colors.text,
      outline: 'none',
      transition: 'border-color 0.2s ease',
    },
    
    searchIcon: { position: 'absolute', left: 10, color: theme.colors.textSecondary, pointerEvents: 'none' },
    
    clearButton: {
      position: 'absolute', right: 6, width: 24, height: 24,
      display: showClearButton ? 'flex' : 'none',
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: theme.colors.border, borderRadius: theme.radius.full,
      border: 'none', cursor: 'pointer', color: theme.colors.text, opacity: 0.6, transition: 'opacity 0.2s ease',
    },
    
    filterButton: {
      position: 'relative', width: 40, height: 40,
      display: showFilters ? 'flex' : 'none',
      alignItems: 'center', justifyContent: 'center',
      // ✅ ИСПОЛЬЗУЕМ effectiveAccentColor ДЛЯ АКТИВНОГО ФОНА
      backgroundColor: activeFiltersCount > 0 ? effectiveAccentColor : theme.colors.bg,
      border: `1px solid ${activeFiltersCount > 0 ? effectiveAccentColor : theme.colors.border}`,
      borderRadius: theme.radius.md,
      cursor: 'pointer',
      color: activeFiltersCount > 0 ? '#fff' : theme.colors.textSecondary,
      transition: 'all 0.2s ease',
    },
    
    filterBadge: {
      position: 'absolute', top: -4, right: -4,
      minWidth: 18, height: 18,
      backgroundColor: theme.colors.error, // Бейдж счетчика оставляем красным или меняем на акцент?
      borderRadius: theme.radius.full,
      display: activeFiltersCount > 0 ? 'flex' : 'none',
      alignItems: 'center', justifyContent: 'center',
      fontSize: 11, fontWeight: 600, color: '#fff', padding: '0 5px',
    },

    categoriesRow: {
      display: categories ? 'flex' : 'none', alignItems: 'center',
      overflowX: 'auto', overflowY: 'hidden', padding: '4px 12px 8px', gap: 6,
      scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
    },
    
    // ✅ ИСПОЛЬЗУЕМ effectiveAccentColor ДЛЯ ТЕГОВ
    categoryPill: (isActive) => ({
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
      backgroundColor: isActive ? effectiveAccentColor : theme.colors.bg,
      border: `1px solid ${isActive ? effectiveAccentColor : theme.colors.border}`,
      borderRadius: theme.radius.full,
      fontSize: 14, fontWeight: isActive ? 600 : 500,
      color: theme.colors.text,
      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.2s ease',
    }),

    actionButton: {
      position: 'relative', width: 40, height: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent', border: 'none', borderRadius: theme.radius.md,
      cursor: 'pointer', color: theme.colors.text, transition: 'background-color 0.2s ease',
    },
    
    actionBadge: {
      position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16,
      backgroundColor: theme.colors.error, borderRadius: theme.radius.full,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 600, color: '#fff', padding: '0 4px',
    },
  };

  // ===== PREMIUM RENDER =====
  if (premium) {
    const p = theme.colors.premium;
    return (
      <div ref={stickyRef} style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'var(--screen-top-offset, 0px)',
        paddingLeft: 16,
        paddingRight: 16,
        paddingBottom: 0,
      }}>
        {/* 1. Заголовок — всегда виден */}
        <div style={{
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}>
          <h1 style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 800,
            color: '#FFF',
            letterSpacing: '-0.5px',
          }}>{title || 'Campus.'}</h1>
        </div>

        {/* 2. Строка: Табы + Search-иконка при скролле */}
        <div style={{ display: 'flex', alignItems: 'center', height: 36, width: '100%' }}>
          {/* Pill-switcher с children (передаётся из Feed.js) */}
          <div style={{
            flex: 1,
            height: '100%',
            background: p.surfaceElevated,
            borderRadius: 18,
            display: 'flex',
            padding: 3,
            transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          }}>
            {children}
          </div>

          {/* Search-иконка — появляется только при скролле */}
          <div style={{
            width: isScrolled ? 36 : 0,
            marginLeft: isScrolled ? 8 : 0,
            opacity: isScrolled ? 1 : 0,
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <button
              onClick={() => { hapticFeedback('light'); setIsManualExpanded(v => !v); }}
              style={{
                width: 36, height: 36, borderRadius: 18,
                background: isManualExpanded ? p.primary : p.surfaceElevated,
                border: 'none',
                color: isManualExpanded ? '#000' : '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.3s, color 0.3s',
              }}
            >
              {isManualExpanded ? <X size={18} strokeWidth={2.5} /> : <Search size={18} strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        {/* 3. Drawer: Поиск + Теги — анимация через grid */}
        <div style={{
          display: 'grid',
          gridTemplateRows: showDrawer ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>
          <div style={{ minHeight: 0, overflow: 'hidden' }}>
            <div style={{
              paddingTop: 12,
              paddingBottom: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              opacity: showDrawer ? 1 : 0,
              transform: showDrawer ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'all 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
            }}>
              {/* Строка поиска */}
              {showSearch && (
                <div style={{
                  display: 'flex', alignItems: 'center', height: 44,
                  padding: '0 16px', background: '#161618',
                  borderRadius: 22, border: `1px solid ${p.border}`,
                }}>
                  <Search size={18} style={{ color: p.textMuted, marginRight: 10, flexShrink: 0 }} />
                  <input
                    ref={premiumSearchRef}
                    value={localSearchValue}
                    onChange={handleSearchInputChange}
                    placeholder={searchPlaceholder}
                    style={{
                      flex: 1, height: '100%', background: 'transparent',
                      border: 'none', color: '#FFF', fontSize: 15, outline: 'none',
                    }}
                  />
                  {localSearchValue && (
                    <X size={16} onClick={handleClearSearch} style={{ color: p.textMuted, cursor: 'pointer' }} />
                  )}
                </div>
              )}

              {/* Строка тегов/категорий */}
              {(showFilters || categories) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Кнопка фильтров — вне скроллируемого контейнера, чтобы бейдж не обрезался */}
                  {showFilters && (
                    <button
                      onClick={handleFiltersClick}
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        background: activeFiltersCount > 0 ? p.primary : p.surfaceElevated,
                        color: activeFiltersCount > 0 ? '#000' : '#FFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, cursor: 'pointer', border: 'none',
                        position: 'relative',
                      }}
                    >
                      <SlidersHorizontal size={16} />
                      {activeFiltersCount > 0 && (
                        <span style={{
                          position: 'absolute', top: -4, right: -4,
                          minWidth: 16, height: 16,
                          background: theme.colors.error, borderRadius: 999,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 3px',
                        }}>{activeFiltersCount}</span>
                      )}
                    </button>
                  )}
                  {/* Категории — в отдельном скроллируемом контейнере */}
                  {categories && (
                    <div style={{
                      display: 'flex', gap: 8, overflowX: 'auto', flex: 1,
                      scrollbarWidth: 'none', msOverflowStyle: 'none',
                    }}>
                      {categories.map((cat) => {
                        const isActive = selectedCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat.id)}
                            style={{
                              padding: '0 14px', height: 36, borderRadius: 18,
                              background: isActive
                                ? (categoryOutline ? 'transparent' : p.primary)
                                : p.surfaceElevated,
                              color: isActive
                                ? (categoryOutline ? p.primary : '#000')
                                : '#FFF',
                              border: categoryOutline
                                ? `1px solid ${isActive ? p.primary : 'transparent'}`
                                : 'none',
                              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                              cursor: 'pointer', flexShrink: 0,
                              transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
                            }}
                          >
                            {cat.emoji && `${cat.emoji} `}{cat.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* STICKY HEADER */}
      <div ref={stickyRef} style={styles.stickyHeader}>
        <div style={styles.titleRow}>
          <div style={styles.titleBlock}>
            <h1 style={styles.title}>{title}</h1>
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>

          {rightActions.length > 0 && (
            <div style={styles.rightActions}>
              {rightActions.map((action, index) => (
                <button
                  key={index}
                  style={styles.actionButton}
                  onClick={action.onClick}
                >
                  {action.icon}
                  {action.badge && <span style={styles.actionBadge}>{action.badge}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CHILDREN (MAINTABS) */}
        {children && <div style={styles.childrenContainer}>{children}</div>}
      </div>

      {/* COLLAPSIBLE (SEARCH + PILLS) */}
      {(showSearch || categories) && (
        <div ref={collapsibleRef} style={styles.collapsibleWrapper}>
          {showSearch && (
            <div style={styles.searchRow}>
              <div style={styles.searchContainer}>
                <Search size={18} style={styles.searchIcon} />
                <input
                  type="text"
                  value={localSearchValue}
                  onChange={handleSearchInputChange}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={searchPlaceholder}
                  style={styles.searchInput}
                />
                <button style={styles.clearButton} onClick={handleClearSearch}>
                  <X size={14} />
                </button>
              </div>

              {showFilters && (
                <button
                  style={styles.filterButton}
                  onClick={handleFiltersClick}
                >
                  <Filter size={18} />
                  {activeFiltersCount > 0 && (
                    <span style={styles.filterBadge}>{activeFiltersCount}</span>
                  )}
                </button>
              )}
            </div>
          )}

          {categories && (
            <div ref={categoriesRef} style={styles.categoriesRow}>
              {categories.map((category) => (
                <button
                  key={category.id}
                  style={styles.categoryPill(selectedCategory === category.id)}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  {category.emoji && <span>{category.emoji}</span>}
                  {category.icon && category.icon}
                  <span>{category.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AppHeader;
