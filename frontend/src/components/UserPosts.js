import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import EditPost from './shared/EditContentModal';
import { getUserPosts, deletePost } from '../api';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import PostCard from './posts/PostCard';
import { Z_USER_POSTS } from '../constants/zIndex';
import PostCardSkeleton from './posts/PostCardSkeleton';

function UserPosts() {
  const { user, setViewPostId, setShowUserPosts, viewPostId, showUserPosts } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [editingPost, setEditingPost] = useState(null);
  const LIMIT = 10;

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    // Когда возвращаемся из детального просмотра - перезагружаем
    if (!viewPostId && showUserPosts) {
      setPosts([]);
      setOffset(0);
      setHasMore(true);
      loadPosts();
    }
  }, [viewPostId]);

  const loadPosts = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const newPosts = await getUserPosts(user.id, LIMIT, offset);
      
      if (newPosts.length < LIMIT) {
        setHasMore(false);
      }
      
      setPosts([...posts, ...newPosts]);
      setOffset(offset + LIMIT);
    } catch (error) {
      console.error('Ошибка загрузки постов:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setShowUserPosts(false);
  };

  const handlePostClick = (postId) => {
    hapticFeedback('light');
    setViewPostId(postId);
  };

  const handlePostDeleted = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
    hapticFeedback('success');
  };

  const handleLikeUpdate = (postId, updates) => {
    setPosts(posts.map(p => 
      p.id === postId 
        ? { ...p, ...updates } 
        : p
    ));
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom && hasMore && !loading) {
      loadPosts();
    }
  };

  return (
    <div style={styles.container} onScroll={handleScroll}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Мои посты ({posts.length})</span>
      </div>

      {/* Posts List */}
      <div style={styles.content}>
        {posts.length === 0 && !loading ? (
          <div style={styles.empty}>
            <div style={styles.emptyEmoji}>📝</div>
            <p style={styles.emptyText}>У вас пока нет постов</p>
            <p style={styles.emptySubtext}>
              Нажмите кнопку "+" внизу экрана, чтобы создать первый пост
            </p>
          </div>
        ) : (
          posts.map((post, idx) => (
            <div 
              key={post.id} 
              style={{
                animation: `fadeInUp 0.4s ease ${idx * 0.05}s both`
              }}
            >
              <PostCard 
                post={post} 
                onClick={handlePostClick}
                onPostDeleted={handlePostDeleted}
                onLikeUpdate={handleLikeUpdate}
              />
            </div>
          ))
        )}

        {loading && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}

        {!hasMore && posts.length > 0 && (
          <div style={styles.endMessage}>
            <div style={styles.endIcon}>✨</div>
            <div>Это все ваши посты</div>
          </div>
        )}
      </div>

      {editingPost && (
        <EditPost
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onUpdate={(updatedPost) => {
            setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
            setEditingPost(null);
          }}
        />
      )}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: Z_USER_POSTS,
    backgroundColor: '#121212',
    overflowY: 'auto',
    paddingBottom: '20px',
  },
  header: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #333',
    zIndex: 10,
    backdropFilter: 'blur(10px)',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    minWidth: '44px',
    minHeight: '44px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    animation: 'fadeInUp 0.5s ease',
  },
  emptyEmoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: '#fff',
    fontWeight: '600',
    marginBottom: '8px',
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#999',
    lineHeight: '1.5',
  },
  endMessage: {
    textAlign: 'center',
    color: '#666',
    padding: '32px 20px',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  endIcon: {
    fontSize: '24px',
  },
};

export default UserPosts;