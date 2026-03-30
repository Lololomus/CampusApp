// ===== 📄 ФАЙЛ: src/components/Feed.js =====

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PostCard from './posts/PostCard';
import RequestsFeed from './requests/RequestsFeed';
import FiltersModal from './shared/FiltersModal';
import { getPosts, getAdsForFeed, triggerRegistrationPrompt } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './posts/PostCardSkeleton';
import theme from '../theme';
import AppHeader from './shared/AppHeader';
import FeedDateDivider from './shared/FeedDateDivider';
import { buildFeedSections } from '../utils/feedDateSections';
import { hapticFeedback } from '../utils/telegram';
import EdgeBlur from './shared/EdgeBlur';
import {
  POSTS_PAGE_SIZE,
  PULL_TO_REFRESH_THRESHOLD,
  INFINITE_SCROLL_ROOT_MARGIN,
} from '../constants/layoutConstants';

const IS_DEV = import.meta.env.DEV;

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [feedAds, setFeedAds] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestsCategory, setRequestsCategory] = useState('all');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const postsOffsetRef = useRef(0);
  const postsLoadingRef = useRef(false);
  const hasMorePostsRef = useRef(true);
  const pullToRefreshLockRef = useRef(false);
  const lastPostCardRef = useRef(null);
  const postsObserverRef = useRef(null);
  
  const {
    feedSubTab,
    setFeedSubTab,
    setViewPostId,
    isRegistered,
    viewPostId,
    updatedPostId,
    getUpdatedPost,
    clearUpdatedPost,
    posts: storePosts,
    postsFilters,
    requestsFilters,
    user,
  } = useStore();

  const haptic = (type = 'light') => {
    hapticFeedback(type);
  };

  const postCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'news', label: 'Новости', emoji: '📰' },
    { id: 'memes', label: 'Мемы', emoji: '🤡' },
    { id: 'events', label: 'События', emoji: '🎉' },
    { id: 'confessions', label: 'Признания', emoji: '💭' },
    { id: 'lost_found', label: 'Находки', emoji: '🔍' },
  ];

  const requestCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'study', label: 'Учёба', emoji: '📚' },
    { id: 'help', label: 'Помощь', emoji: '🤝' },
    { id: 'hangout', label: 'Движ', emoji: '🎉' }
  ];

  // МЕМОИЗАЦИЯ СЧЁТЧИКА ФИЛЬТРОВ
  const countActiveFilters = useMemo(() => {
    if (feedSubTab === 'posts') {
      let count = 0;
      if (postsFilters.location !== 'all') count++;
      if (postsFilters.tags && postsFilters.tags.length > 0) count++;
      if (postsFilters.dateRange !== 'all') count++;
      if (postsFilters.sort !== 'newest') count++;
      return count;
    } else {
      let count = 0;
      if (requestsFilters.location !== 'all') count++;
      if (requestsFilters.status !== 'active') count++;
      if (requestsFilters.hasReward !== 'all') count++;
      if (requestsFilters.urgency !== 'all') count++;
      if (requestsFilters.sort !== 'newest') count++;
      return count;
    }
  }, [feedSubTab, postsFilters, requestsFilters]);

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
    location: postsFilters.location,
    university: postsFilters.university,
    institute: postsFilters.institute,
    tags: postsFilters.tags,
    dateRange: postsFilters.dateRange,
    sort: postsFilters.sort,
  }), [
    postsFilters.location,
    postsFilters.university,
    postsFilters.institute,
    postsFilters.tags,
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
        category: activeCategory === 'all' ? null : activeCategory,
        skip: nextOffset,
        limit: POSTS_PAGE_SIZE,
      };

      if (stabilizedFilters.location === 'my_university') {
        apiFilters.university = stabilizedFilters.university;
        apiFilters.viewer_city = user?.city || undefined;
      } else if (stabilizedFilters.location === 'my_institute') {
        apiFilters.university = stabilizedFilters.university;
        apiFilters.institute = stabilizedFilters.institute;
        apiFilters.viewer_city = user?.city || undefined;
      }

      if (stabilizedFilters.tags && stabilizedFilters.tags.length > 0) {
        apiFilters.tags = stabilizedFilters.tags;
      }

      if (stabilizedFilters.dateRange !== 'all') {
        apiFilters.dateRange = stabilizedFilters.dateRange;
      }

      if (stabilizedFilters.sort !== 'newest') {
        apiFilters.sort = stabilizedFilters.sort;
      }

      const data = await getPosts(apiFilters);
      
      const postsWithImages = (data.items || []).map(post => {
        let images = [];
        try {
          images = typeof post.images === 'string' ? JSON.parse(post.images) : (post.images || []);
        } catch (e) { images = []; }
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

      // Подгрузка рекламы
      if (reset) {
        try { const ads = await getAdsForFeed(3); setFeedAds(ads || []); } catch { setFeedAds([]); }
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
  }, [activeCategory, stabilizedFilters]);

  // ✅ БЕЗ JSON.stringify
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

  // Pull to Refresh БЕЗ ЛИШНИХ ПЕРЕСОЗДАНИЙ
  const handleRefresh = useCallback(() => {
    haptic('light');
    loadPosts(true);
  }, [loadPosts]);

  const startYRef = useRef(0);
  
  useEffect(() => {
    const handleTouchStart = (e) => { 
      pullToRefreshLockRef.current = false;
      if (window.scrollY === 0) startYRef.current = e.touches[0].clientY; 
    };
    
    const handleTouchMove = (e) => {
      if (
        window.scrollY === 0 &&
        e.touches[0].clientY - startYRef.current > PULL_TO_REFRESH_THRESHOLD &&
        !loading &&
        !pullToRefreshLockRef.current
      ) {
        pullToRefreshLockRef.current = true;
        handleRefresh();
      }
    };
    
    const handleTouchEnd = () => {
      pullToRefreshLockRef.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [loading, handleRefresh]);

  const handlePostClick = (postId) => {
    if (!isRegistered) {
      triggerRegistrationPrompt('open_post');
      return;
    }
    setViewPostId(postId);
  };

  const handleCategoryChange = (category) => {
    if (feedSubTab === 'posts') setActiveCategory(category);
    else setRequestsCategory(category);
    haptic('light');
  };

  const handleSearchChange = (query) => setSearchQuery(query);
  
  const handleFiltersClick = () => {
    haptic('medium');
    setShowFiltersModal(true);
  };

  const handleFiltersApply = () => {
    if (feedSubTab === 'posts') {
      loadPosts(true);
    }
  };

  const handleTabSwitch = (tab) => {
    if (feedSubTab !== tab) {
      haptic('medium');
      setFeedSubTab(tab);
    }
  };

  const currentCategories = feedSubTab === 'posts' ? postCategories : requestCategories;
  const selectedCategory = feedSubTab === 'posts' ? activeCategory : requestsCategory;

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
      
      {/* Верхний блюр шапки — высота меняется при сворачивании, анимируем */}
      <EdgeBlur position="top" height="var(--header-padding)" zIndex={50} animateHeight />

      {/* Нижний блюр — от края экрана вверх, прозрачный конец совпадает с верхним краем навбара */}
      <EdgeBlur position="bottom" height={100} zIndex={50} />

      <AppHeader
        title="Лента"
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder={feedSubTab === 'posts' ? 'Поиск постов...' : 'Поиск запросов...'}
        onSearchChange={handleSearchChange}
        categories={currentCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleFiltersClick}
        activeFiltersCount={countActiveFilters}
        premium
      >
        {/* Premium pill-switcher: только кнопки, обёртка — в AppHeader */}
        <div style={{ position: 'relative', width: '100%', display: 'flex' }}>
          <div
            style={{
              ...styles.activeIndicator,
              transform: `translateX(${feedSubTab === 'posts' ? '0' : '100%'})`,
            }}
          />
          <button
            onClick={() => handleTabSwitch('posts')}
            style={{
              ...styles.tabButton,
              color: feedSubTab === 'posts' ? '#000' : '#FFF',
            }}
          >
            Посты
          </button>
          <button
            onClick={() => handleTabSwitch('requests')}
            style={{
              ...styles.tabButton,
              color: feedSubTab === 'requests' ? '#000' : '#FFF',
            }}
          >
            Помощь
          </button>
        </div>
      </AppHeader>

      <div style={styles.content}>
        {feedSubTab === 'posts' ? (
          <>
            {loading && posts.length === 0 && (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            )}

            {!loading && posts.length === 0 && (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>📝</div>
                <p style={styles.emptyTitle}>Пока нет постов</p>
                <p style={styles.emptyHint}>Будь первым!</p>
              </div>
            )}

            {posts.length > 0 && postsWithDividers.map((row) => (
              row.type === 'divider' ? (
                <FeedDateDivider key={row.key} label={row.label} />
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
        ) : (
          <RequestsFeed 
            category={requestsCategory}
            searchQuery={searchQuery}
          />
        )}
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
    paddingTop: 'calc(var(--screen-top-offset, 0px) + 192px)',
    paddingLeft: '0px',
    paddingRight: '0px',
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
};

export default Feed;
