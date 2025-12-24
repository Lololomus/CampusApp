import React, { useState, useEffect } from 'react';
import { ArrowLeft, Edit, Trash2, MoreVertical } from 'lucide-react';
import EditPost from './EditPost';
import { getUserPosts, deletePost } from '../api';
import { useStore } from '../store';
import { hapticFeedback, showBackButton, hideBackButton } from '../utils/telegram';
import PostCard from './PostCard';
import { Z_USER_POSTS } from '../constants/zIndex';
import PostCardSkeleton from './PostCardSkeleton';

function UserPosts() {
  const { user, setViewPostId, setShowUserPosts, viewPostId, showUserPosts } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [menuOpen, setMenuOpen] = useState(null);
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

  const handleEdit = (post, e) => {
    e.stopPropagation();
    hapticFeedback('medium');
    setMenuOpen(null);
    setEditingPost(post);
  };

  const handleDelete = async (postId, e) => {
    e.stopPropagation();
    setMenuOpen(null);
    
    if (!window.confirm('Удалить пост? Это действие нельзя отменить.')) {
      return;
    }

    hapticFeedback('medium');
    
    try {
      await deletePost(postId);
      setPosts(posts.filter(p => p.id !== postId));
      hapticFeedback('success');
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить пост');
    }
  };

  const handlePostUpdate = (updatedPost) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
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
            <p style={styles.emptyText}>У вас пока нет постов</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} style={styles.postWrapper}>
              <PostCard 
                post={post} 
                onClick={() => handlePostClick(post.id)}
              />
              
              {/* Кнопка меню */}
              <button
                style={styles.menuButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(menuOpen === post.id ? null : post.id);
                }}
              >
                <MoreVertical size={20} />
              </button>

              {/* Меню действий */}
              {menuOpen === post.id && (
                <div style={styles.menu}>
                    <button
                    style={styles.menuItem}
                    onClick={(e) => handleEdit(post, e)}
                    >
                    <Edit size={16} />
                    <span>Редактировать</span>
                    </button>
                  <button
                    style={{...styles.menuItem, color: '#ff4444'}}
                    onClick={(e) => handleDelete(post.id, e)}
                  >
                    <Trash2 size={16} />
                    <span>Удалить</span>
                  </button>
                </div>
              )}
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
          <div style={styles.endMessage}>Это все ваши посты</div>
        )}
      </div>

      {editingPost && (
        <EditPost
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onUpdate={handlePostUpdate}
        />
      )}
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
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  postWrapper: {
    position: 'relative',
    marginBottom: '12px',
  },
  menuButton: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#1a1a1acc',
    backdropFilter: 'blur(8px)',
    border: '1px solid #333',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 5,
  },
  menu: {
    position: 'absolute',
    top: '52px',
    right: '12px',
    backgroundColor: '#2a2a2a',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '180px',
    border: '1px solid #333',
  },
  menuItem: {
    width: '100%',
    padding: '14px 16px',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '15px',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'background 0.2s',
  },
  empty: {
    textAlign: 'center',
    padding: '60px 20px',
  },
  emptyText: {
    fontSize: '16px',
    color: '#999',
  },
  endMessage: {
    textAlign: 'center',
    color: '#666',
    padding: '20px',
    fontSize: '14px',
  },
};

export default UserPosts;