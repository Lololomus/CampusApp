import React, { useEffect, useState } from 'react';
import PostCard from './PostCard';
import { getPosts } from '../api';
import { useStore } from '../store';

function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { feedMode, setViewPostId } = useStore();

  useEffect(() => {
    const loadPosts = async () => {
      setLoading(true);
      try {
        const data = await getPosts({ 
          category: feedMode === 'global' ? null : feedMode 
        });
        setPosts(data.items);
        
        // 🔍 ВРЕМЕННЫЙ ЛОГ
        if (data.items.length > 0) {
          console.log('📦 Структура поста:', data.items[0]);
          console.log('👤 Автор поста:', data.items[0].author);
        }
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedMode]);

  const handlePostClick = (postId) => {
    setViewPostId(postId);
    console.log('Open post detail:', postId);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Заголовок */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎓 Campus</h1>
        <p style={styles.subtitle}>Студенческая соцсеть</p>
      </div>

      {/* Табы фильтров */}
      <div style={styles.tabs}>
        <Tab label="Все" active={feedMode === 'global'} />
        <Tab label="Мой вуз" active={feedMode === 'my_uni'} />
        <Tab label="Уникальное" active={feedMode === 'unique'} />
      </div>

      {/* Список постов */}
      <div style={styles.posts}>
        {posts.length === 0 ? (
          <div style={styles.empty}>
            <p>Пока нет постов</p>
            <p style={styles.emptyHint}>Будь первым!</p>
          </div>
        ) : (
          posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onClick={() => handlePostClick(post.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Tab({ label, active }) {
  return (
    <button
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
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontSize: '16px',
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