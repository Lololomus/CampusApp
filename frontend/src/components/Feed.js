// ===== 📄 ФАЙЛ: src/components/Feed.js =====

import React, { useEffect, useState, useCallback } from 'react';
import PostCard from './posts/PostCard';
import RequestsFeed from './requests/RequestsFeed';
import CreateContentModal from './shared/CreateContentModal';
import { getPosts } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './posts/PostCardSkeleton';
import theme from '../theme';
import AppHeader from './shared/AppHeader';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [requestsCategory, setRequestsCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  const { 
    feedSubTab, 
    setFeedSubTab,
    setViewPostId, 
    viewPostId, 
    updatedPostId, 
    getUpdatedPost, 
    clearUpdatedPost,
    posts: storePosts
  } = useStore();

  const haptic = (type = 'light') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const postCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'news', label: 'Новости', emoji: '📰' },
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

  const getDynamicTitle = () => {
    if (feedSubTab === 'posts') {
      if (activeCategory === 'all') return 'Посты';
      const cat = postCategories.find(c => c.id === activeCategory);
      return cat ? cat.label : 'Посты';
    } else {
      if (requestsCategory === 'all') return 'Запросы';
      const cat = requestCategories.find(c => c.id === requestsCategory);
      return cat ? cat.label : 'Запросы';
    }
  };

  // ✅ ИСПРАВЛЕНО: явно указываем обновление is_liked и likes_count
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

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPosts({ 
        category: activeCategory === 'all' ? null : activeCategory
      });
      
      const postsWithImages = (data.items || []).map(post => {
        let images = [];
        try {
          images = typeof post.images === 'string' ? JSON.parse(post.images) : (post.images || []);
        } catch (e) { images = []; }
        return { ...post, images };
      });
      
      setPosts(postsWithImages);
    } catch (error) {
      console.error('Error loading posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (feedSubTab === 'posts') loadPosts();
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

  const handlePostClick = (postId) => setViewPostId(postId);

  const handleCategoryChange = (category) => {
    if (feedSubTab === 'posts') setActiveCategory(category);
    else setRequestsCategory(category);
    haptic('light');
  };

  const handleSearchChange = (query) => setSearchQuery(query);
  const handleFiltersClick = () => haptic('medium');

  const handleTabSwitch = (tab) => {
    if (feedSubTab !== tab) {
      haptic('medium');
      setFeedSubTab(tab);
    }
  };

  const currentCategories = feedSubTab === 'posts' ? postCategories : requestCategories;
  const selectedCategory = feedSubTab === 'posts' ? activeCategory : requestsCategory;

  return (
    <div style={styles.container}>
      
      <AppHeader 
        title={getDynamicTitle()}
        showSearch={true}
        searchValue={searchQuery}
        searchPlaceholder={feedSubTab === 'posts' ? 'Поиск постов...' : 'Поиск запросов...'}
        onSearchChange={handleSearchChange}
        categories={currentCategories}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        showFilters={true}
        onFiltersClick={handleFiltersClick}
        activeFiltersCount={0}
      >
        {/* ТАБЫ (SEGMENTED CONTROL) */}
        <div style={styles.tabsWrapper}>
          <div style={styles.tabsContainer}>
            {/* Скользящий фон */}
            <div 
              style={{
                ...styles.activeIndicator,
                transform: `translateX(${feedSubTab === 'posts' ? '0%' : '100%'})`,
              }} 
            />
            
            {/* Кнопка Посты */}
            <button 
              onClick={() => handleTabSwitch('posts')}
              style={{
                ...styles.tabButton,
                color: feedSubTab === 'posts' ? '#fff' : theme.colors.textSecondary,
              }}
            >
              Посты
            </button>

            {/* Кнопка Запросы */}
            <button 
              onClick={() => handleTabSwitch('requests')}
              style={{
                ...styles.tabButton,
                color: feedSubTab === 'requests' ? '#fff' : theme.colors.textSecondary,
              }}
            >
              Запросы
            </button>
          </div>
        </div>
      </AppHeader>

      <div style={styles.content}>
        {feedSubTab === 'posts' ? (
          <>
            {loading && (
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

            {!loading && posts.length > 0 && posts.map((post) => (
              <div key={post.id} style={{ marginBottom: 16 }}>
                 <PostCard 
                   post={post} 
                   onClick={handlePostClick}
                   onLikeUpdate={handleLikeUpdate}
                   onPostDeleted={handlePostDeleted}
                 />
              </div>
            ))}
          </>
        ) : (
          <RequestsFeed 
            category={requestsCategory}
            searchQuery={searchQuery}
          />
        )}
      </div>

      {showCreateModal && (
        <CreateContentModal 
          onClose={() => {
            setShowCreateModal(false);
            loadPosts();
          }} 
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
  },

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
    width: 'calc(50% - 4px)',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    boxShadow: '0 2px 8px rgba(135, 116, 225, 0.3)',
    transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: 1,
  },

  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    background: 'transparent',
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'color 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    display: 'block',
    paddingTop: 'calc(var(--header-padding, 104px) + 16px)', 
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingBottom: 100, 
    transition: 'padding-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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