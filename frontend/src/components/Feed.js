import React, { useEffect, useState, useCallback } from 'react';
import PostCard from './PostCard';
import RequestsFeed from './requests/RequestsFeed';
import { getPosts } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './PostCardSkeleton';
import theme from '../theme';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  
  const { 
    feedMode, 
    feedSubTab, 
    setFeedSubTab,
    setViewPostId, 
    viewPostId, 
    updatedPostId, 
    getUpdatedPost, 
    clearUpdatedPost
  } = useStore();

  const handleLikeUpdate = useCallback((postId, updates) => {
    setPosts(prevPosts => {
      const updated = prevPosts.map(post =>
        post.id === postId ? { ...post, ...updates } : post
      );
      return updated;
    });
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
      setPosts(data.items || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [activeCategory]);

  // Загружаем посты только для таба "Посты"
  useEffect(() => {
    if (feedSubTab === 'posts') {
      loadPosts();
    }
  }, [feedSubTab, loadPosts]);

  useEffect(() => {
    if (!viewPostId && updatedPostId) {
      const updates = getUpdatedPost(updatedPostId);
      if (updates) {
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === updatedPostId 
              ? { ...post, ...updates }
              : post
          )
        );
        clearUpdatedPost();
      }
    }
  }, [viewPostId, updatedPostId, getUpdatedPost, clearUpdatedPost]);

  const handlePostClick = (postId) => {
    setViewPostId(postId);
  };

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  // Категории для постов
  const postCategories = [
    { id: 'all', label: 'Все', emoji: '' },
    { id: 'news', label: 'Новости', emoji: '📰' },
    { id: 'events', label: 'События', emoji: '🎉' },
    { id: 'confessions', label: 'Признания', emoji: '💭' },
    { id: 'lost_found', label: 'Находки', emoji: '🔍' },
  ];

  return (
    <div style={styles.container}>
      {/* Заголовок */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎓 Campus</h1>
        <p style={styles.subtitle}>Студенческая соцсеть</p>
      </div>

      {/* Табы Посты/Запросы */}
      <div style={styles.mainTabs}>
        <MainTab 
          label="Посты" 
          active={feedSubTab === 'posts'}
          onClick={() => setFeedSubTab('posts')}
        />
        <MainTab 
          label="Запросы" 
          active={feedSubTab === 'requests'}
          onClick={() => setFeedSubTab('requests')}
        />
      </div>

      {/* Табы категорий (только для постов) */}
      {feedSubTab === 'posts' && (
        <div style={styles.tabs}>
          {postCategories.map(cat => (
            <Tab 
              key={cat.id}
              label={`${cat.emoji} ${cat.label}`.trim()} 
              active={activeCategory === cat.id}
              onClick={() => handleCategoryChange(cat.id)}
            />
          ))}
        </div>
      )}

      {/* Список постов/запросов */}
      <div style={styles.posts}>
        {feedSubTab === 'posts' ? (
          <>
            {loading && (
              <>
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
                <PostCardSkeleton />
              </>
            )}

            {!loading && posts.length === 0 && (
              <div style={styles.empty}>
                <p>Пока нет постов</p>
                <p style={styles.emptyHint}>Будь первым!</p>
              </div>
            )}

            {!loading && posts.length > 0 && posts.map((post) => (
              <PostCard 
                key={`${post.id}-${post.is_liked}-${post.likes_count}`}
                post={post} 
                onClick={handlePostClick}
                onLikeUpdate={handleLikeUpdate}
                onPostDeleted={handlePostDeleted}
              />
            ))}
          </>
        ) : (
          <RequestsFeed />
        )}
      </div>
    </div>
  );
}

function MainTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.mainTab,
        borderBottom: active ? `2px solid ${theme.colors.primary}` : '2px solid transparent',
        color: active ? theme.colors.primary : theme.colors.textTertiary,
      }}
    >
      {label}
    </button>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.tab,
        backgroundColor: active ? theme.colors.primary : 'transparent',
        color: active ? theme.colors.text : theme.colors.textTertiary,
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingBottom: 80,
    minHeight: '100vh',
  },
  header: {
    padding: `${theme.spacing.xl}px ${theme.spacing.lg}px ${theme.spacing.md}px`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.fontSize.xxxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    margin: 0,
  },
  subtitle: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textTertiary,
    margin: `${theme.spacing.xs}px 0 0`,
  },
  mainTabs: {
    display: 'flex',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  mainTab: {
    flex: 1,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    border: 'none',
    background: 'transparent',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    overflowX: 'auto',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  tab: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.xl,
    border: 'none',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: theme.transitions.normal,
  },
  posts: {
    padding: theme.spacing.lg,
  },
  empty: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: `60px ${theme.spacing.xl}px`,
  },
  emptyHint: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textDisabled,
    marginTop: theme.spacing.sm,
  },
};

export default Feed;