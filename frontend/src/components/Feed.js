// ===== 📄 ФАЙЛ: src/components/Feed.js =====

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PostCard from './posts/PostCard';
// [LEGACY] import RequestsFeed from './requests/RequestsFeed';
import FiltersModal from './shared/FiltersModal';
import { getPosts, getAdsForFeed, triggerRegistrationPrompt } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './posts/PostCardSkeleton';
import theme from '../theme';
import AppHeader from './shared/AppHeader';
import FeedDateDivider from './shared/FeedDateDivider';
import { buildFeedSections } from '../utils/feedDateSections';
import { hapticFeedback } from '../utils/telegram';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import PullToRefreshIndicator from './shared/PullToRefreshIndicator';
// [LEGACY] import EdgeBlur from './shared/EdgeBlur';
import {
  POSTS_PAGE_SIZE,
  INFINITE_SCROLL_ROOT_MARGIN,
} from '../constants/layoutConstants';
import { CREATE_CONTENT_POST_CATEGORIES } from '../constants/createContentUiConfig';

const IS_DEV = import.meta.env.DEV;
const postCategories = [
  { id: 'all', label: 'Все', emoji: '' },
  ...CREATE_CONTENT_POST_CATEGORIES
    .filter((category) => category.value !== 'general')
    .map((category) => ({
      id: category.value,
      label: category.label,
      emoji: category.icon,
    })),
  ...CREATE_CONTENT_POST_CATEGORIES
    .filter((category) => category.value === 'general')
    .map((category) => ({
    id: category.value,
    label: category.label,
    emoji: category.icon,
  })),
];

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [feedAds, setFeedAds] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const postsOffsetRef = useRef(0);
  const postsLoadingRef = useRef(false);
  const hasMorePostsRef = useRef(true);
  const lastPostCardRef = useRef(null);
  const postsObserverRef = useRef(null);
  
  const {
    feedSubTab,
    setViewPostId,
    isRegistered,
    viewPostId,
    updatedPostId,
    getUpdatedPost,
    clearUpdatedPost,
    posts: storePosts,
    postsFilters,
    setPostsFilters,
    clearPostsFilters,
    user,
  } = useStore();

  const haptic = (type = 'light') => {
    hapticFeedback(type);
  };

  // МЕМОИЗАЦИЯ СЧЁТЧИКА ФИЛЬТРОВ
  const countActiveFilters = useMemo(() => {
    let count = 0;
    if (postsFilters.category && postsFilters.category !== 'all') count++;
    if (postsFilters.location !== 'all') count++;
    if (postsFilters.dateRange !== 'all') count++;
    if (postsFilters.sort !== 'newest') count++;
    return count;
  }, [postsFilters]);

  const handleLikeUpdate = useCallback((postId, updates) => {
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              is_liked: updates.is_liked, 
              likes_count: updates.likes_count 
            } 
          : post
      )
    );
  }, []);

  const handlePostDeleted = useCallback((postId) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  }, []);

  // СТАБИЛИЗАЦИЯ postsFilters через useMemo
  const stabilizedFilters = useMemo(() => ({
    category: postsFilters.category || 'all',
    location: postsFilters.location,
    university: postsFilters.university,
    institute: postsFilters.institute,
    dateRange: postsFilters.dateRange,
    sort: postsFilters.sort,
  }), [
    postsFilters.category,
    postsFilters.location,
    postsFilters.university,
    postsFilters.institute,
    postsFilters.dateRange,
    postsFilters.sort,
  ]);

  const loadPosts = useCallback(async (reset = false) => {
    if (postsLoadingRef.current || (!reset && !hasMorePostsRef.current)) return;

    postsLoadingRef.current = true;
    setLoading(true);
    try {
      if (reset) {
        postsOffsetRef.current = 0;
        hasMorePostsRef.current = true;
        setHasMorePosts(true);
      }

      const nextOffset = reset ? 0 : postsOffsetRef.current;
      const apiFilters = {
        category: stabilizedFilters.category === 'all' ? null : stabilizedFilters.category,
        skip: nextOffset,
        limit: POSTS_PAGE_SIZE,
        search: searchQuery || undefined,
      };

      if (stabilizedFilters.location === 'my_university') {
        apiFilters.university = stabilizedFilters.university;
        apiFilters.viewer_city = user?.city || undefined;
      } else if (stabilizedFilters.location === 'my_institute') {
        apiFilters.university = stabilizedFilters.university;
        apiFilters.institute = stabilizedFilters.institute;
        apiFilters.viewer_city = user?.city || undefined;
      }

      if (stabilizedFilters.dateRange !== 'all') {
        apiFilters.dateRange = stabilizedFilters.dateRange;
      }

      if (stabilizedFilters.sort !== 'newest') {
        apiFilters.sort = stabilizedFilters.sort;
      }

      const data = await getPosts(apiFilters);
      
      const postsWithImages = (data.items || []).map(post => {
        let images;
        try {
          images = typeof post.images === 'string' ? JSON.parse(post.images) : (post.images || []);
        } catch { images = []; }
        return { ...post, images };
      });
      
      if (reset) {
        setPosts(postsWithImages);
      } else {
        setPosts((prevPosts) => {
          const merged = [...prevPosts, ...postsWithImages];
          const byId = new Map();
          merged.forEach((post) => byId.set(post.id, post));
          return Array.from(byId.values());
        });
      }

      postsOffsetRef.current = nextOffset + postsWithImages.length;
      hasMorePostsRef.current = Boolean(data.has_more);
      setHasMorePosts(hasMorePostsRef.current);

      if (reset) {
        getAdsForFeed(3)
          .then((ads) => setFeedAds(ads || []))
          .catch(() => setFeedAds([]));
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      if (reset) {
        setPosts([]);
      }
    } finally {
      postsLoadingRef.current = false;
      setLoading(false);
    }
  }, [searchQuery, stabilizedFilters, user?.city]);

  // ✅ БЕЗ JSON.stringify
  useEffect(() => {
    setActiveCategory(postsFilters.category || 'all');
  }, [postsFilters.category]);

  useEffect(() => {
    if (feedSubTab === 'posts') loadPosts(true);
  }, [feedSubTab, loadPosts]);

  useEffect(() => {
    if (storePosts.length > 0 && feedSubTab === 'posts') {
      setPosts(prevPosts => {
        const storePostIds = new Set(storePosts.map(p => p.id));
        const existingPosts = prevPosts.filter(p => !storePostIds.has(p.id));
        return [...storePosts, ...existingPosts];
      });
    }
  }, [storePosts, feedSubTab]);

  useEffect(() => {
    if (!viewPostId && updatedPostId) {
      const updates = getUpdatedPost(updatedPostId);
      if (updates) {
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === updatedPostId ? { ...post, ...updates } : post
          )
        );
        clearUpdatedPost();
      }
    }
  }, [viewPostId, updatedPostId, getUpdatedPost, clearUpdatedPost]);

  const handleRefresh = useCallback(() => {
    loadPosts(true);
  }, [loadPosts]);

  const { pullY, pullProgress, isRefreshing, snapping } = usePullToRefresh({
    onRefresh: handleRefresh,
    loading,
  });

  const handlePostClick = (postId) => {
    if (!isRegistered) {
      triggerRegistrationPrompt('open_post');
      return;
    }
    setViewPostId(postId);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setPostsFilters({ category, tags: [] });
    haptic('light');
  };

  const handleSearchChange = (query) => setSearchQuery(query);

  const handleFiltersClick = () => {
    haptic('medium');
    setShowFiltersModal(true);
  };

  const handleFiltersApply = () => {
    loadPosts(true);
  };

  const handleClearFiltersAndSearch = useCallback(() => {
    clearPostsFilters();
    setSearchQuery('');
  }, [clearPostsFilters]);

  // Подмешивание рекламы: После 1-го поста, а потом каждые 5
  const postsWithAds = useMemo(() => {
    if (!feedAds.length) return posts;
    const result = [];
    let ai = 0;
    
    posts.forEach((p, i) => {
      result.push(p);
      
      // Логика: Вставляем рекламу после самого первого поста (индекс 0)
      // ИЛИ после каждого 5-го поста (индексы 4, 9, 14...)
      const shouldInsertAd = (i === 0 || (i + 1) % 5 === 0);

      if (shouldInsertAd && ai < feedAds.length) {
        // Подготавливаем объект рекламы так, чтобы PostCard его понял
        const ad = feedAds[ai];
        result.push({ 
          ...ad, 
          // Важно: маппинг полей для PostCard, если API возвращает их с префиксом post_
          title: ad.post_title || ad.title,
          body: ad.post_body || ad.body,
          images: ad.post_images || ad.images || [],
          
          _isAd: true, 
          id: `ad-${ad.id || ad.ad_id}`, // Уникальный ID для React key
          category: 'ad' 
        });
        ai++;
      }
    });
    return result;
  }, [posts, feedAds]); 

  const postsWithDividers = useMemo(() => {
    const withContextDate = postsWithAds.map((item, index, arr) => {
      if (!item?._isAd || item.created_at) return item;

      for (let i = index - 1; i >= 0; i -= 1) {
        if (arr[i]?.created_at) {
          return { ...item, _dividerDate: arr[i].created_at };
        }
      }
      return item;
    });

    return buildFeedSections(
      withContextDate,
      (item) => item._dividerDate || item.created_at,
      { getItemKey: (item) => item.id }
    );
  }, [postsWithAds]);

  // ✅ МЕМОИЗАЦИЯ ВЫНЕСЕННОГО СТИЛЯ
  const lastVisiblePostId = useMemo(() => {
    for (let i = postsWithDividers.length - 1; i >= 0; i -= 1) {
      if (postsWithDividers[i].type === 'item') {
        return postsWithDividers[i].item.id;
      }
    }
    return null;
  }, [postsWithDividers]);

  useEffect(() => {
    if (feedSubTab !== 'posts' || loading || !hasMorePosts) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !postsLoadingRef.current && hasMorePosts) {
          loadPosts(false);
        }
      },
      { threshold: 0.1, rootMargin: INFINITE_SCROLL_ROOT_MARGIN }
    );

    postsObserverRef.current = observer;
    if (lastPostCardRef.current) observer.observe(lastPostCardRef.current);

    return () => {
      if (postsObserverRef.current) {
        postsObserverRef.current.disconnect();
      }
    };
  }, [feedSubTab, hasMorePosts, loading, loadPosts, lastVisiblePostId]);

  const postCardWrapperStyle = useMemo(() => ({ marginBottom: 0 }), []);

  return (
    <div style={styles.container}>
      
      {/* Верхний градиент — затемнение без блюра, следует за высотой шапки */}
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
        text="Обновляем ленту"
      />

      <AppHeader
        title="Лента"
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder="Поиск постов..."
        onSearchChange={handleSearchChange}
        categories={postCategories}
        selectedCategory={activeCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleFiltersClick}
        activeFiltersCount={countActiveFilters}
        premiumCollapsedToolbar
        freezeBottomChromeOnSearchFocus
      />

      <div style={{
        ...styles.content,
        transform: `translateY(${pullY}px)`,
        transition: snapping ? 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
      }}>
        <>
          {loading && posts.length === 0 && (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          )}

          {!loading && posts.length === 0 && (
            <div style={styles.empty}>
              {(countActiveFilters > 0 || searchQuery) ? (
                <>
                  <div style={styles.emptyIcon}>🔍</div>
                  <p style={styles.emptyTitle}>Ничего не найдено</p>
                  <p style={styles.emptyHint}>Попробуй изменить или сбросить фильтры</p>
                  <button onClick={handleClearFiltersAndSearch} style={styles.emptyResetBtn}>
                    Сбросить фильтры
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.emptyIcon}>📝</div>
                  <p style={styles.emptyTitle}>Пока нет постов</p>
                  <p style={styles.emptyHint}>Будь первым!</p>
                </>
              )}
            </div>
          )}

          {posts.length > 0 && (
            <div style={styles.resultsCount}>
              {posts.length}{hasMorePosts ? '+' : ''} постов
            </div>
          )}

          {posts.length > 0 && postsWithDividers.map((row, rowIndex) => (
            row.type === 'divider' ? (
              <FeedDateDivider
                key={row.key}
                label={row.label}
                spacingBefore={rowIndex > 0 && postsWithDividers[rowIndex - 1].type === 'item' ? 12 : 0}
              />
            ) : (
              <div
                key={row.key}
                style={postCardWrapperStyle}
                ref={row.item.id === lastVisiblePostId ? lastPostCardRef : null}
              >
                <PostCard
                  post={row.item}
                  onClick={row.item._isAd ? undefined : handlePostClick}
                  onLikeUpdate={row.item._isAd ? undefined : handleLikeUpdate}
                  onPostDeleted={row.item._isAd ? undefined : handlePostDeleted}
                  onAdHidden={
                    row.item._isAd
                      ? (adId) => {
                          if (IS_DEV) return;
                          setFeedAds(prev => prev.filter(a => a.id !== adId && a.ad_id !== adId));
                        }
                      : undefined
                  }
                />
              </div>
            )
          ))}

          {loading && posts.length > 0 && (
            <PostCardSkeleton />
          )}
        </>
      </div>

      {showFiltersModal && (
        <FiltersModal
          onClose={() => setShowFiltersModal(false)}
          onApply={handleFiltersApply}
        />
      )}
    </div>
  );
}

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
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.3s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    display: 'block',
    // Фиксированный paddingTop — не зависит от --header-padding, устраняет дёрганье при анимации шапки
    // Header: 4px container + 28px title + 8px margin + 8px drawer-top + 44px search + 10px gap + 36px chips + 6px drawer-bottom = 144px
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 160px)',
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 120,
  },

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: '60px 20px',
  },

  emptyIcon: { fontSize: 64, marginBottom: 16, opacity: 0.5 },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: theme.colors.text, marginBottom: 8 },
  emptyHint: { fontSize: 15, color: theme.colors.textDisabled, marginTop: 8 },
  emptyResetBtn: {
    marginTop: 20,
    padding: '10px 24px',
    borderRadius: 12,
    background: 'rgba(212,255,0,0.1)',
    border: '1px solid rgba(212,255,0,0.3)',
    color: '#D4FF00',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  resultsCount: {
    padding: '4px 16px 0',
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: 500,
    letterSpacing: 0.2,
  },
};

export default Feed;
