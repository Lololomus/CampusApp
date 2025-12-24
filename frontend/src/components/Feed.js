import React, { useEffect, useState, useCallback } from 'react';
import PostCard from './PostCard';
import { getPosts } from '../api';
import { useStore } from '../store';
import PostCardSkeleton from './PostCardSkeleton';


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


  // ✅ НОВОЕ: Когда закрываем PostDetail и есть обновлённый пост - обновляем только его
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
        clearUpdatedPost(); // Очищаем после применения
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
        {/* SKELETON при загрузке */}
        {loading && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}


        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div style={styles.empty}>
            <p>Пока нет постов</p>
            <p style={styles.emptyHint}>Будь первым!</p>
          </div>
        )}


        {/* Посты */}
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
        backgroundColor: active ? '#8774e1' : 'transparent',
        color: active ? '#fff' : '#999',
      }}
    >
      {label}
    </button>
  );
}


const styles = {
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingBottom: '80px',
    minHeight: '100vh',
  },
  header: {
    padding: '20px 16px 12px',
    borderBottom: '1px solid #333',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#999',
    margin: '4px 0 0',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    overflowX: 'auto',
    borderBottom: '1px solid #333',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
  },
  posts: {
    padding: '16px',
  },
  empty: {
    textAlign: 'center',
    color: '#999',
    padding: '60px 20px',
  },
  emptyHint: {
    fontSize: '14px',
    color: '#666',
    marginTop: '8px',
  },
};


export default Feed;