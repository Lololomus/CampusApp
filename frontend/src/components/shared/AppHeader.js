import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useStore } from '../../store';
import { triggerRegistrationPrompt } from '../../api';
import { BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS } from '../../constants/layoutConstants';

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
  accentColor,
  premium = false,
  premiumTrailing = null,
  premiumCollapsedToolbar = false,
  freezeBottomChromeOnSearchFocus = false,
  categoryOutline = false,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState(searchValue);
  const [collapsibleVisible, setCollapsibleVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const [compactFilterPressed, setCompactFilterPressed] = useState(false);
  const [compactTitleWidth, setCompactTitleWidth] = useState(0);
  const [dimensions, setDimensions] = useState({ sticky: 56, collapsible: 0 });

  const lastScrollYRef = useRef(0);
  const collapsibleVisibleRef = useRef(true);
  const isScrolledRef = useRef(false);
  const isManualExpandedRef = useRef(false);
  const scrollRafRef = useRef(null);
  const compactTitleWidthRef = useRef(0);
  const premiumSearchRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const categoriesRef = useRef(null);
  const stickyRef = useRef(null);
  const collapsibleRef = useRef(null);
  const compactTitleMeasureRef = useRef(null);
  const compactGestureRef = useRef({ startY: 0, lastY: 0, collapsed: false });

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

  const effectiveAccentColor = accentColor || theme.colors.primary;
  const hasPremiumDrawerContent = Boolean(showSearch || showFilters || categories);
  const hasSecondaryPremiumContent = premium && Boolean(children || premiumTrailing);
  const useCollapsedToolbarPremium = premium && premiumCollapsedToolbar && !hasSecondaryPremiumContent && Boolean(title) && hasPremiumDrawerContent;
  const showDrawer = hasPremiumDrawerContent && (!isScrolled || isManualExpanded);
  const showClearButton = Boolean(localSearchValue && localSearchValue.length > 0);
  const hasActiveSearchValue = typeof localSearchValue === 'string' && localSearchValue.trim().length > 0;

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
  }, [children, showSearch, categories, premium, showFilters, title]);

  useEffect(() => {
    const totalHeight = collapsibleVisible ? dimensions.sticky + dimensions.collapsible : dimensions.sticky;
    document.documentElement.style.setProperty('--header-padding', `${totalHeight}px`);
  }, [collapsibleVisible, dimensions]);

  useEffect(() => {
    collapsibleVisibleRef.current = collapsibleVisible;
  }, [collapsibleVisible]);

  useEffect(() => {
    isScrolledRef.current = isScrolled;
  }, [isScrolled]);

  useEffect(() => {
    isManualExpandedRef.current = isManualExpanded;
  }, [isManualExpanded]);

  useLayoutEffect(() => {
    if (!useCollapsedToolbarPremium) return undefined;

    let rafId = null;

    const measureCompactTitle = () => {
      if (!compactTitleMeasureRef.current) return;
      const measuredWidth = Math.ceil(compactTitleMeasureRef.current.getBoundingClientRect().width);
      if (measuredWidth && measuredWidth !== compactTitleWidthRef.current) {
        compactTitleWidthRef.current = measuredWidth;
        setCompactTitleWidth(measuredWidth);
      }
    };

    measureCompactTitle();
    rafId = window.requestAnimationFrame(measureCompactTitle);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [title, useCollapsedToolbarPremium]);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollRafRef.current) return;
      scrollRafRef.current = window.requestAnimationFrame(() => {
        scrollRafRef.current = null;
        if (isModalOpen || document.body.style.position === 'fixed') return;

        const currentScrollY = window.scrollY;
        let nextCollapsibleVisible = collapsibleVisibleRef.current;

        if (currentScrollY < 10) nextCollapsibleVisible = true;
        else if (currentScrollY > lastScrollYRef.current) nextCollapsibleVisible = false;
        else if (currentScrollY < lastScrollYRef.current) nextCollapsibleVisible = true;

        if (nextCollapsibleVisible !== collapsibleVisibleRef.current) {
          collapsibleVisibleRef.current = nextCollapsibleVisible;
          setCollapsibleVisible(nextCollapsibleVisible);
        }

        if (premium) {
          const nextIsScrolled = currentScrollY > 40;
          if (nextIsScrolled !== isScrolledRef.current) {
            isScrolledRef.current = nextIsScrolled;
            setIsScrolled(nextIsScrolled);
          }

          if (!nextIsScrolled && isManualExpandedRef.current) {
            isManualExpandedRef.current = false;
            setIsManualExpanded(false);
          }
        }

        lastScrollYRef.current = currentScrollY;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollRafRef.current) {
        window.cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [premium, isModalOpen]);

  useEffect(() => {
    if (!showDrawer && premiumSearchRef.current) premiumSearchRef.current.blur();
  }, [showDrawer]);

  useEffect(() => {
    if (!freezeBottomChromeOnSearchFocus) return undefined;
    return () => document.body.classList.remove(BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS);
  }, [freezeBottomChromeOnSearchFocus]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (localSearchValue !== searchValue && onSearchChange) {
      searchTimeoutRef.current = setTimeout(() => onSearchChange(localSearchValue), 300);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [localSearchValue, searchValue, onSearchChange]);

  useEffect(() => {
    setLocalSearchValue(searchValue);
  }, [searchValue]);

  const handleSearchFocus = () => {
    setSearchFocused(true);
    if (freezeBottomChromeOnSearchFocus) {
      document.body.classList.add(BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS);
    }
  };

  const handleSearchBlur = () => {
    setSearchFocused(false);
    if (freezeBottomChromeOnSearchFocus) {
      document.body.classList.remove(BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS);
    }
  };

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

  const collapsePremiumDrawer = () => {
    isManualExpandedRef.current = false;
    setIsManualExpanded(false);
    setSearchFocused(false);
    setCompactFilterPressed(false);
    premiumSearchRef.current?.blur();
    if (freezeBottomChromeOnSearchFocus) {
      document.body.classList.remove(BOTTOM_CHROME_STATIC_WHILE_SEARCH_CLASS);
    }
  };

  const styles = {
    stickyHeader: { position: 'fixed', top: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)', zIndex: 1000, backgroundColor: transparent ? 'rgba(26, 26, 26, 0.8)' : theme.colors.bgSecondary, backdropFilter: transparent ? 'blur(20px)' : 'blur(0px)', WebkitBackdropFilter: transparent ? 'blur(20px)' : 'blur(0px)', borderBottom: `1px solid ${theme.colors.border}`, paddingTop: 'calc(var(--screen-top-offset) + 4px)', transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 0.3s cubic-bezier(0.4, 0, 0.2, 1), -webkit-backdrop-filter 0.3s cubic-bezier(0.4, 0, 0.2, 1)' },
    titleRow: { height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', position: 'relative' },
    titleBlock: { textAlign: 'center', flex: 1 },
    title: { fontSize: 20, fontWeight: 600, color: theme.colors.text, margin: 0, lineHeight: '24px' },
    subtitle: { fontSize: 13, fontWeight: 400, color: theme.colors.textSecondary, margin: '2px 0 0 0' },
    rightActions: { position: 'absolute', right: 8, display: 'flex', gap: 4 },
    childrenContainer: { display: children ? 'block' : 'none' },
    collapsibleWrapper: { position: 'fixed', top: 'var(--sticky-height, 56px)', left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)', zIndex: 999, backgroundColor: theme.colors.bgSecondary, transform: collapsibleVisible ? 'translateY(0)' : 'translateY(-100%)', opacity: collapsibleVisible ? 1 : 0, pointerEvents: collapsibleVisible ? 'auto' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)', borderBottom: `1px solid ${theme.colors.border}` },
    searchRow: { display: showSearch ? 'flex' : 'none', alignItems: 'center', padding: '8px 12px', gap: 8 },
    searchContainer: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
    searchInput: { width: '100%', height: 40, backgroundColor: theme.colors.bg, border: `1px solid ${searchFocused ? effectiveAccentColor : theme.colors.border}`, borderRadius: theme.radius.md, padding: '0 36px', fontSize: 15, color: theme.colors.text, outline: 'none', transition: 'border-color 0.2s ease' },
    searchIcon: { position: 'absolute', left: 10, color: theme.colors.textSecondary, pointerEvents: 'none' },
    clearButton: { position: 'absolute', right: 6, width: 24, height: 24, display: showClearButton ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.border, borderRadius: theme.radius.full, border: 'none', cursor: 'pointer', color: theme.colors.text, opacity: 0.6, transition: 'opacity 0.2s ease' },
    filterButton: { position: 'relative', width: 40, height: 40, display: showFilters ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', backgroundColor: activeFiltersCount > 0 ? effectiveAccentColor : theme.colors.bg, border: `1px solid ${activeFiltersCount > 0 ? effectiveAccentColor : theme.colors.border}`, borderRadius: theme.radius.md, cursor: 'pointer', color: activeFiltersCount > 0 ? '#fff' : theme.colors.textSecondary, transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease' },
    filterBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, backgroundColor: theme.colors.error, borderRadius: theme.radius.full, display: activeFiltersCount > 0 ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#fff', padding: '0 5px' },
    categoriesRow: { display: categories ? 'flex' : 'none', alignItems: 'center', overflowX: 'auto', overflowY: 'hidden', padding: '4px 12px 8px', gap: 6, scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' },
    categoryPill: (isActive) => ({ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', backgroundColor: isActive ? effectiveAccentColor : theme.colors.bg, border: `1px solid ${isActive ? effectiveAccentColor : theme.colors.border}`, borderRadius: theme.radius.full, fontSize: 14, fontWeight: isActive ? 600 : 500, color: theme.colors.text, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease' }),
    actionButton: { position: 'relative', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', border: 'none', borderRadius: theme.radius.md, cursor: 'pointer', color: theme.colors.text, transition: 'background-color 0.2s ease' },
    actionBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, backgroundColor: theme.colors.error, borderRadius: theme.radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff', padding: '0 4px' },
  };

  if (premium) {
    const p = theme.colors.premium;
    const hasSecondaryContent = hasSecondaryPremiumContent;
    const useCollapsedToolbar = useCollapsedToolbarPremium;
    const showCollapsedToolbar = useCollapsedToolbar && isScrolled;
    const showCollapsedBtn = !useCollapsedToolbar && hasPremiumDrawerContent && isScrolled && !isManualExpanded && !hasSecondaryContent;
    const showSecondarySearchToggle = hasPremiumDrawerContent && isScrolled && !showCollapsedToolbar && hasSecondaryContent;
    const collapsedSearchActive = Boolean(showSearch) && (isManualExpanded || (!showDrawer && hasActiveSearchValue));
    const premiumTopRowHeight = useCollapsedToolbar ? 44 : 28;
    const premiumTopRowMarginBottom = hasSecondaryContent ? 8 : showDrawer ? 8 : 0;
    const premiumTitleStyle = { margin: 0, fontSize: 24, fontWeight: 800, color: '#FFF', letterSpacing: '-0.5px', lineHeight: '28px', transform: 'translateY(2px)' };
    const springMorph = 'cubic-bezier(0.2, 0.8, 0.2, 1.15)';
    const springSmooth = 'cubic-bezier(0.32, 0.72, 0, 1)';
    const handlePremiumSearchToggle = () => {
      hapticFeedback('light');
      if (isManualExpanded) {
        collapsePremiumDrawer();
        return;
      }
      isManualExpandedRef.current = true;
      setIsManualExpanded(true);
    };

    if (useCollapsedToolbar) {
      const isCompact = isScrolled && !isManualExpanded;
      const compactTopInset = 4;
      const compactPillHeight = 48;
      const compactControlSize = 40;
      const compactPillPadding = 4;
      const compactTitleGap = 6;
      const compactPillTop = compactTopInset;
      const compactMeasuredTitleWidth = compactTitleWidth || Math.max(64, Math.ceil(String(title || '').length * 14));
      const compactPillWidth = Math.ceil((compactPillPadding * 2) + (compactControlSize * 2) + (compactTitleGap * 2) + compactMeasuredTitleWidth);
      const compactHalfWidth = compactPillWidth / 2;
      const containerHeight = isCompact ? compactPillTop + compactPillHeight : 148;
      const titleTop = isCompact ? compactPillTop + (compactPillHeight / 2) : 14;
      const titleFontSize = 24;
      const titleLetterSpacing = isCompact ? '0px' : '-0.5px';
      const titleTextTransform = 'none';

      const compactFilterBg = activeFiltersCount > 0 ? p.primary : 'rgba(255,255,255,0.08)';
      const compactFilterColor = activeFiltersCount > 0 ? '#000' : '#FFF';
      const compactSearchBg = collapsedSearchActive ? p.primary : 'rgba(255,255,255,0.08)';
      const compactSearchColor = collapsedSearchActive ? '#000' : '#FFF';

      const filterSize = 40;
      const filterTop = isCompact ? compactPillTop + compactPillPadding : 96;
      const filterLeft = isCompact ? `calc(50% - ${compactHalfWidth - compactPillPadding}px)` : '0px';
      const filterBg = isCompact ? compactFilterBg : p.surfaceElevated;
      const filterColor = isCompact ? compactFilterColor : '#FFF';
      const filterRadius = isCompact ? 20 : 14;
      const filterOpacity = showFilters ? 1 : 0;

      const searchTop = isCompact ? compactPillTop + compactPillPadding : 44;
      const searchLeft = isCompact ? `calc(50% + ${compactHalfWidth - compactPillPadding - compactControlSize}px)` : '0px';
      const searchWidth = isCompact ? '40px' : '100%';
      const searchHeight = isCompact ? 40 : 44;
      const searchRadius = isCompact ? 20 : 22;
      const searchBg = isCompact ? compactSearchBg : p.surfaceElevated;
      const searchColor = isCompact ? compactSearchColor : '#FFF';
      const searchIconLeft = isCompact ? 11 : 14;
      const searchIconTop = isCompact ? 11 : 13;

      const tagsLeft = showFilters ? '48px' : '0px';
      const tagsWidth = showFilters ? 'calc(100% - 48px)' : '100%';
      const tagsOpacity = categories && !isCompact ? 1 : 0;
      const tagsPointer = categories && !isCompact ? 'auto' : 'none';
      const overlayActive = isScrolled && isManualExpanded && !isModalOpen;
      const overlayTop = `calc(var(--screen-top-offset, 0px) + 4px + ${containerHeight}px)`;
      const swipeThreshold = 16;
      const resetCompactGesture = () => {
        compactGestureRef.current = { startY: 0, lastY: 0, collapsed: false };
      };
      const handleOverlayCollapse = (event) => {
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        collapsePremiumDrawer();
      };
      const handleOverlayTouchStart = (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        compactGestureRef.current = {
          startY: touch.clientY,
          lastY: touch.clientY,
          collapsed: false,
        };
      };
      const handleOverlayTouchMove = (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        const gesture = compactGestureRef.current;
        gesture.lastY = touch.clientY;
        if (gesture.collapsed) return;
        if (Math.abs(touch.clientY - gesture.startY) >= swipeThreshold) {
          gesture.collapsed = true;
          handleOverlayCollapse(event);
        }
      };
      const handleOverlayTouchEnd = (event) => {
        const gesture = compactGestureRef.current;
        if (!gesture.collapsed && Math.abs(gesture.lastY - gesture.startY) < 8) {
          handleOverlayCollapse(event);
        }
        resetCompactGesture();
      };

      return (
        <>
          {overlayActive && (
            <div
              onMouseDown={handleOverlayCollapse}
              onTouchStart={handleOverlayTouchStart}
              onTouchMove={handleOverlayTouchMove}
              onTouchEnd={handleOverlayTouchEnd}
              onWheel={handleOverlayCollapse}
              style={{
                position: 'fixed',
                top: overlayTop,
                bottom: 0,
                left: 'var(--app-fixed-left)',
                width: 'var(--app-fixed-width)',
                zIndex: 99,
                background: 'transparent',
                touchAction: 'none',
              }}
            />
          )}

          <span
            ref={compactTitleMeasureRef}
            style={{
              position: 'fixed',
              top: -9999,
              left: -9999,
              visibility: 'hidden',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: '0px',
              lineHeight: '28px',
              fontFamily: 'inherit',
            }}
          >
            {title}
          </span>

          <div
            ref={stickyRef}
            style={{
              position: 'fixed',
              top: 0,
              left: 'var(--app-fixed-left)',
              width: 'var(--app-fixed-width)',
              boxSizing: 'border-box',
              zIndex: 100,
              background: 'transparent',
              paddingTop: 'calc(var(--screen-top-offset, 0px) + 4px)',
              paddingLeft: 16,
              paddingRight: 16,
              paddingBottom: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                height: containerHeight,
                transition: `height 0.45s ${springSmooth}`,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: compactPillTop,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: compactPillWidth,
                  height: compactPillHeight,
                  borderRadius: 24,
                  background: 'rgba(8,8,10,0.78)',
                  opacity: isCompact ? 1 : 0,
                  pointerEvents: 'none',
                  boxShadow: '0 14px 34px rgba(0,0,0,0.42), inset 0 1px 1px rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: isCompact ? 'blur(10px) saturate(120%)' : 'none',
                  WebkitBackdropFilter: isCompact ? 'blur(10px) saturate(120%)' : 'none',
                  transition: `opacity 0.5s ${springMorph}, transform 0.5s ${springMorph}`,
                }}
              />

              {showFilters && (
                <button
                  onClick={handleFiltersClick}
                  style={{
                    position: 'absolute',
                    top: filterTop,
                    left: filterLeft,
                    width: filterSize,
                    height: filterSize,
                    borderRadius: filterRadius,
                    background: filterBg,
                    color: filterColor,
                    opacity: filterOpacity,
                    transform: isCompact && compactFilterPressed ? 'scale(0.94)' : 'scale(1)',
                    filter: isCompact && compactFilterPressed ? 'brightness(0.92)' : 'none',
                    transition: `top 0.5s ${springMorph}, left 0.5s ${springMorph}, width 0.45s ${springMorph}, height 0.45s ${springMorph}, border-radius 0.5s ${springMorph}, background 0.3s ${springSmooth}, color 0.3s ${springSmooth}, opacity 0.3s ease, transform 0.2s ${springSmooth}, filter 0.2s ${springSmooth}`,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 3,
                    boxShadow: isCompact ? 'none' : 'inset 0 1px 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                  }}
                  onPointerDown={() => setCompactFilterPressed(true)}
                  onPointerUp={() => setCompactFilterPressed(false)}
                  onPointerLeave={() => setCompactFilterPressed(false)}
                  onPointerCancel={() => setCompactFilterPressed(false)}
                >
                  <SlidersHorizontal size={18} strokeWidth={2.25} />
                  {activeFiltersCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        minWidth: 16,
                        height: 16,
                        background: theme.colors.error,
                        borderRadius: 999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        padding: '0 3px',
                        pointerEvents: 'none',
                      }}
                    >
                      {activeFiltersCount}
                    </span>
                  )}
                </button>
              )}

              {showSearch && (
                <div
                  style={{
                    position: 'absolute',
                    top: searchTop,
                    left: searchLeft,
                    width: searchWidth,
                    height: searchHeight,
                    borderRadius: searchRadius,
                    background: searchBg,
                    transition: `top 0.5s ${springMorph}, left 0.5s ${springMorph}, width 0.5s ${springMorph}, height 0.5s ${springMorph}, border-radius 0.5s ${springMorph}, background 0.3s ${springSmooth}`,
                    overflow: 'hidden',
                    zIndex: 3,
                    boxShadow: isCompact ? 'none' : 'inset 0 1px 1px rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.02)',
                  }}
                >
                  {isCompact && (
                    <button
                      onClick={handlePremiumSearchToggle}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        zIndex: 2,
                      }}
                    />
                  )}

                  <Search
                    size={18}
                    color={isCompact ? searchColor : (searchFocused ? p.primary : p.textMuted)}
                    style={{
                      position: 'absolute',
                      left: searchIconLeft,
                      top: searchIconTop,
                      transition: `left 0.5s ${springMorph}, top 0.5s ${springMorph}, color 0.3s ${springSmooth}`,
                      pointerEvents: 'none',
                    }}
                  />

                  <input
                    ref={premiumSearchRef}
                    type="text"
                    value={localSearchValue}
                    onChange={handleSearchInputChange}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    placeholder={searchPlaceholder}
                    style={{
                      position: 'absolute',
                      left: 44,
                      top: 0,
                      width: 'calc(100% - 76px)',
                      height: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: '#FFF',
                      outline: 'none',
                      fontSize: 16,
                      fontWeight: 500,
                      opacity: isCompact ? 0 : 1,
                      pointerEvents: isCompact ? 'none' : 'auto',
                      transition: 'opacity 0.28s ease',
                    }}
                  />

                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearSearch();
                      premiumSearchRef.current?.focus();
                    }}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: 13,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      background: 'rgba(255,255,255,0.14)',
                      color: '#FFF',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      opacity: !isCompact && localSearchValue ? 1 : 0,
                      pointerEvents: !isCompact && localSearchValue ? 'auto' : 'none',
                      transform: !isCompact && localSearchValue ? 'scale(1)' : 'scale(0.5)',
                      transition: `opacity 0.28s ${springSmooth}, transform 0.28s ${springMorph}`,
                    }}
                  >
                    <X size={12} strokeWidth={3} />
                  </button>
                </div>
              )}

              {Boolean(title) && (
                <div
                  style={{
                    position: 'absolute',
                    top: titleTop,
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    opacity: 1,
                    fontWeight: 800,
                    fontSize: titleFontSize,
                    letterSpacing: titleLetterSpacing,
                    textTransform: titleTextTransform,
                    color: '#FFF',
                    pointerEvents: 'none',
                    zIndex: 4,
                    transition: `top 0.5s ${springMorph}, font-size 0.5s ${springMorph}, letter-spacing 0.5s ${springSmooth}, color 0.3s ${springSmooth}`,
                  }}
                >
                  {title}
                </div>
              )}

              {categories && (
                <div
                  ref={categoriesRef}
                  style={{
                    position: 'absolute',
                    top: 96,
                    left: tagsLeft,
                    width: tagsWidth,
                    opacity: tagsOpacity,
                    pointerEvents: tagsPointer,
                    transition: `opacity 0.4s ${springSmooth}, transform 0.45s ${springMorph}`,
                    transform: isCompact ? 'translateY(-10px)' : 'translateY(0)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      overflowX: 'auto',
                      paddingRight: 16,
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {categories.map((cat) => {
                      const isActive = selectedCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.id)}
                          style={{
                            height: 40,
                            padding: '0 18px',
                            borderRadius: 14,
                            background: isActive ? (categoryOutline ? 'transparent' : p.primary) : p.surfaceElevated,
                            color: isActive ? (categoryOutline ? p.primary : '#000') : '#FFF',
                            border: categoryOutline ? `1px solid ${isActive ? p.primary : 'transparent'}` : 'none',
                            fontSize: 14,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            flexShrink: 0,
                            boxShadow: isActive && !categoryOutline ? '0 10px 22px rgba(212,255,0,0.18)' : 'inset 0 1px 1px rgba(255,255,255,0.05)',
                            transition: `background 0.25s ${springSmooth}, color 0.25s ${springSmooth}, box-shadow 0.25s ${springSmooth}, border-color 0.25s ${springSmooth}`,
                          }}
                        >
                          {cat.emoji && `${cat.emoji} `}
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

    return (
      <div ref={stickyRef} style={{ position: 'fixed', top: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)', boxSizing: 'border-box', zIndex: 100, background: 'transparent', display: 'flex', flexDirection: 'column', paddingTop: 'calc(var(--screen-top-offset, 0px) + 4px)', paddingLeft: 16, paddingRight: 16, paddingBottom: 0 }}>
        {(Boolean(title) || showCollapsedToolbar) && (
          <div style={{ position: 'relative', height: premiumTopRowHeight, marginBottom: premiumTopRowMarginBottom }}>
            {Boolean(title) && (
              <div style={{ position: useCollapsedToolbar ? 'absolute' : 'relative', inset: useCollapsedToolbar ? 0 : 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: showCollapsedToolbar ? 0 : 1, pointerEvents: showCollapsedToolbar ? 'none' : 'auto', transform: showCollapsedToolbar ? 'translateY(-6px)' : 'translateY(0)', transition: useCollapsedToolbar ? 'opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1), transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)' : 'none' }}>
                <h1 style={premiumTitleStyle}>{title}</h1>
              </div>
            )}

            {showCollapsedToolbar && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: showCollapsedToolbar ? 1 : 0, transform: showCollapsedToolbar ? 'translateY(0)' : 'translateY(6px)', transition: 'opacity 0.35s cubic-bezier(0.32, 0.72, 0, 1), transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                <div style={{ width: 'min(100%, 320px)', display: 'grid', gridTemplateColumns: '44px minmax(0, 1fr) 44px', alignItems: 'center', columnGap: 10 }}>
                  <div style={{ width: 44, height: 44, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showFilters ? (
                      <>
                        <button onClick={handleFiltersClick} style={{ width: 44, height: 44, borderRadius: 22, background: activeFiltersCount > 0 ? p.primary : p.surfaceElevated, color: activeFiltersCount > 0 ? '#000' : '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', transition: 'background 0.3s cubic-bezier(0.32, 0.72, 0, 1), color 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                          <SlidersHorizontal size={18} strokeWidth={2.25} />
                        </button>
                        {activeFiltersCount > 0 && <span style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, background: theme.colors.error, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 3px', pointerEvents: 'none' }}>{activeFiltersCount}</span>}
                      </>
                    ) : <div style={{ width: 44, height: 44 }} />}
                  </div>

                  <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    <h1 style={{ ...premiumTitleStyle, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{title}</h1>
                  </div>

                  <div style={{ width: 44, height: 44, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {showSearch ? (
                      <button onClick={handlePremiumSearchToggle} style={{ width: 44, height: 44, borderRadius: 22, background: collapsedSearchActive ? p.primary : p.surfaceElevated, color: collapsedSearchActive ? '#000' : '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', transition: 'background 0.3s cubic-bezier(0.32, 0.72, 0, 1), color 0.3s cubic-bezier(0.32, 0.72, 0, 1), transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                        {isManualExpanded ? <X size={18} strokeWidth={2.5} /> : <Search size={18} strokeWidth={2.5} />}
                      </button>
                    ) : <div style={{ width: 44, height: 44 }} />}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {hasSecondaryContent && (
          <div style={{ display: 'flex', alignItems: 'center', height: 36, width: '100%' }}>
            <div style={{ flex: 1, height: '100%', background: children ? p.surfaceElevated : 'transparent', borderRadius: 18, display: 'flex', padding: children ? 3 : 0, transition: 'background 0.4s cubic-bezier(0.32, 0.72, 0, 1), padding 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>{children}</div>
            {premiumTrailing && <div style={{ marginLeft: children ? 12 : 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{premiumTrailing}</div>}
            {showSecondarySearchToggle && (
              <div style={{ width: 36, marginLeft: 8, opacity: 1, overflow: 'hidden', transition: 'width 0.4s cubic-bezier(0.32, 0.72, 0, 1), margin-left 0.4s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button onClick={handlePremiumSearchToggle} style={{ width: 36, height: 36, borderRadius: 18, background: isManualExpanded ? p.primary : p.surfaceElevated, border: 'none', color: isManualExpanded ? '#000' : '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'background 0.3s, color 0.3s' }}>
                  {isManualExpanded ? <X size={18} strokeWidth={2.5} /> : <Search size={18} strokeWidth={2.5} />}
                </button>
              </div>
            )}
          </div>
        )}

        {!hasSecondaryContent && !useCollapsedToolbar && hasPremiumDrawerContent && (
          <div style={{ display: 'grid', gridTemplateRows: showCollapsedBtn ? '1fr' : '0fr', transition: 'grid-template-rows 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
            <div style={{ minHeight: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 6, paddingBottom: 8, opacity: showCollapsedBtn ? 1 : 0, transform: showCollapsedBtn ? 'translateY(0)' : 'translateY(-4px)', transition: 'opacity 0.35s ease, transform 0.35s ease' }}>
                <button onClick={handlePremiumSearchToggle} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 20px', borderRadius: 17, background: p.surfaceElevated, border: 'none', color: p.textMuted, fontSize: 14, fontWeight: 400, cursor: 'pointer', transition: 'background 0.2s', whiteSpace: 'nowrap' }}>
                  <Search size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  <span>Поиск...</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {hasPremiumDrawerContent && (
          <div style={{ display: 'grid', gridTemplateRows: showDrawer ? '1fr' : '0fr', transition: 'grid-template-rows 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
            <div style={{ minHeight: 0, overflow: 'hidden' }}>
              <div style={{ paddingTop: 8, paddingBottom: 6, display: 'flex', flexDirection: 'column', gap: 10, opacity: showDrawer ? 1 : 0, transform: showDrawer ? 'translateY(0)' : 'translateY(-8px)', transition: 'opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                {showSearch && (
                  <div style={{ display: 'flex', alignItems: 'center', height: 44, padding: '0 14px', background: p.surfaceElevated, borderRadius: 22, border: `1px solid ${p.border}` }}>
                    <Search size={18} style={{ color: p.textMuted, marginRight: 10, flexShrink: 0 }} />
                    <input ref={premiumSearchRef} value={localSearchValue} onChange={handleSearchInputChange} onFocus={handleSearchFocus} onBlur={handleSearchBlur} placeholder={searchPlaceholder} style={{ flex: 1, height: '100%', background: 'transparent', border: 'none', color: '#FFF', fontSize: 16, outline: 'none' }} />
                    {localSearchValue && <X size={16} onClick={handleClearSearch} style={{ color: p.textMuted, cursor: 'pointer' }} />}
                  </div>
                )}

                {(showFilters || categories) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {showFilters && (
                      <button onClick={handleFiltersClick} style={{ width: 36, height: 36, borderRadius: 18, background: activeFiltersCount > 0 ? p.primary : p.surfaceElevated, color: activeFiltersCount > 0 ? '#000' : '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', border: 'none', position: 'relative' }}>
                        <SlidersHorizontal size={16} />
                        {activeFiltersCount > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, background: theme.colors.error, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', padding: '0 3px' }}>{activeFiltersCount}</span>}
                      </button>
                    )}

                    {categories && (
                      <div ref={categoriesRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none', touchAction: 'pan-x pan-y' }}>
                        {categories.map((cat) => {
                          const isActive = selectedCategory === cat.id;
                          return (
                            <button key={cat.id} onClick={() => handleCategoryClick(cat.id)} style={{ padding: '0 14px', height: 36, borderRadius: 18, background: isActive ? (categoryOutline ? 'transparent' : p.primary) : p.surfaceElevated, color: isActive ? (categoryOutline ? p.primary : '#000') : '#FFF', border: categoryOutline ? `1px solid ${isActive ? p.primary : 'transparent'}` : 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s cubic-bezier(0.32, 0.72, 0, 1), color 0.2s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.2s cubic-bezier(0.32, 0.72, 0, 1)' }}>
                              {cat.emoji && `${cat.emoji} `}
                              {cat.label}
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
        )}
      </div>
    );
  }

  return (
    <>
      <div ref={stickyRef} style={styles.stickyHeader}>
        <div style={styles.titleRow}>
          <div style={styles.titleBlock}>
            <h1 style={styles.title}>{title}</h1>
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
          {rightActions.length > 0 && (
            <div style={styles.rightActions}>
              {rightActions.map((action, index) => (
                <button key={index} style={styles.actionButton} onClick={action.onClick}>
                  {action.icon}
                  {action.badge && <span style={styles.actionBadge}>{action.badge}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {children && <div style={styles.childrenContainer}>{children}</div>}
      </div>

      {(showSearch || categories) && (
        <div ref={collapsibleRef} style={styles.collapsibleWrapper}>
          {showSearch && (
            <div style={styles.searchRow}>
              <div style={styles.searchContainer}>
                <Search size={18} style={styles.searchIcon} />
                <input type="text" value={localSearchValue} onChange={handleSearchInputChange} onFocus={handleSearchFocus} onBlur={handleSearchBlur} placeholder={searchPlaceholder} style={styles.searchInput} />
                <button style={styles.clearButton} onClick={handleClearSearch}>
                  <X size={14} />
                </button>
              </div>
              {showFilters && (
                <button style={styles.filterButton} onClick={handleFiltersClick}>
                  <Filter size={18} />
                  {activeFiltersCount > 0 && <span style={styles.filterBadge}>{activeFiltersCount}</span>}
                </button>
              )}
            </div>
          )}

          {categories && (
            <div ref={categoriesRef} style={styles.categoriesRow}>
              {categories.map((category) => (
                <button key={category.id} style={styles.categoryPill(selectedCategory === category.id)} onClick={() => handleCategoryClick(category.id)}>
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
