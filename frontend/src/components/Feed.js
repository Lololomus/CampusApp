import React, { useEffect, useState, useCallback } from 'react';
import PostCard from './PostCard';
import { getPosts } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './PostCardSkeleton';
import theme from '../theme';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const { feedMode, setViewPostId, viewPostId, updatedPostId, getUpdatedPost, clearUpdatedPost } = useStore();

  const handleLikeUpdate = useCallback((postId, updates) => {
    setPosts(prevPosts => {
      const updated = prevPosts.map(post =>
        post.id === postId ? { ...post, ...updates } : post
      );
      return updated;
    });
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

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

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

  return (
    <div style={styles.container}>
      {/* Заголовок */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎓 Campus</h1>
        <p style={styles.subtitle}>Студенческая соцсеть</p>
      </div>

      {/* Табы категорий */}
      <div style={styles.tabs}>
        <Tab 
          label="Все" 
          active={activeCategory === 'all'}
          onClick={() => handleCategoryChange('all')}
        />
        <Tab 
          label="📰 Новости" 
          active={activeCategory === 'news'}
          onClick={() => handleCategoryChange('news')}
        />
        <Tab 
          label="🎉 События" 
          active={activeCategory === 'events'}
          onClick={() => handleCategoryChange('events')}
        />
        <Tab 
          label="💭 Признания" 
          active={activeCategory === 'confessions'}
          onClick={() => handleCategoryChange('confessions')}
        />
        <Tab 
          label="🔍 Находки" 
          active={activeCategory === 'lost_found'}
          onClick={() => handleCategoryChange('lost_found')}
        />
      </div>

      {/* Список постов */}
      <div style={styles.posts}>
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
          />
        ))}
      </div>
    </div>
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