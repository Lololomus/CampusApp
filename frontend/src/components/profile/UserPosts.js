import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getUserPosts } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import PostCard from '../posts/PostCard';
import { Z_USER_POSTS } from '../../constants/zIndex';
import PostCardSkeleton from '../posts/PostCardSkeleton';
import theme from '../../theme';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';

function UserPosts() {
  const { user, setViewPostId, setShowUserPosts, updatedPostId, updatedPostData, clearUpdatedPost } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const loadLockRef = useRef(false);
  const LIMIT = 10;

  const closeScreen = () => {
    setShowUserPosts(false);
  };

  const handleTelegramBack = () => {
    hapticFeedback('light');
    closeScreen();
  };

  useTelegramScreen({
    id: 'user-posts-screen',
    title: 'Мои посты',
    priority: 40,
    back: {
      visible: true,
      onClick: handleTelegramBack,
    },
  });

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!updatedPostId) return;

    let hasUpdated = false;
    setPosts((prev) => prev.map((post) => {
      if (String(post.id) !== String(updatedPostId)) return post;
      hasUpdated = true;
      return { ...post, ...updatedPostData };
    }));

    if (hasUpdated) {
      clearUpdatedPost();
    }
  }, [updatedPostId, updatedPostData, clearUpdatedPost]);

  const loadPosts = async (reset = false) => {
    if (loadLockRef.current || (!hasMore && !reset)) return;

    loadLockRef.current = true;
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const newPosts = await getUserPosts(user.id, LIMIT, nextOffset);

      if (newPosts.length < LIMIT) {
        setHasMore(false);
      }

      if (reset) {
        const byId = new Map();
        newPosts.forEach((post) => byId.set(post.id, post));
        setPosts(Array.from(byId.values()));
        setOffset(LIMIT);
      } else {
        setPosts((prev) => {
          const merged = [...prev, ...newPosts];
          const byId = new Map();
          merged.forEach((post) => byId.set(post.id, post));
          return Array.from(byId.values());
        });
        setOffset((prev) => prev + newPosts.length);
      }
    } catch (error) {
      console.error('Ошибка загрузки постов:', error);
      toast.error('Не удалось загрузить посты');
    } finally {
      setLoading(false);
      loadLockRef.current = false;
    }
  };

  const getPostDate = (post) => {
    const rawDate = post.event_date || post.expires_at || post.deadline_at || post.date;
    if (!rawDate) return null;
    const parsed = new Date(rawDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const isArchived = (post) => {
    const postDate = getPostDate(post);
    if (!postDate) return false;
    return postDate < new Date();
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (filter === 'all') return true;
      if (filter === 'active') return !isArchived(post);
      if (filter === 'archive') return isArchived(post);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, filter]);

  const counts = useMemo(() => {
    return {
      all: posts.length,
      active: posts.filter((post) => !isArchived(post)).length,
      archive: posts.filter((post) => isArchived(post)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const handlePostClick = (postId) => {
    hapticFeedback('light');
    setViewPostId(postId);
  };

  const handlePostDeleted = (postId) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    hapticFeedback('success');
  };

  const handleLikeUpdate = (postId, updates) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))
    );
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom && hasMore && !loading) {
      loadPosts();
    }
  };

  return (
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader title={`Мои посты (${counts.all})`} onBack={closeScreen} />

      <div style={styles.filterTabs}>
        <button
          onClick={() => {
            hapticFeedback('selection');
            setFilter('all');
          }}
          style={{ ...styles.filterTab, ...(filter === 'all' && styles.filterTabActive) }}
        >
          Все {counts.all > 0 && `(${counts.all})`}
        </button>
        <button
          onClick={() => {
            hapticFeedback('selection');
            setFilter('active');
          }}
          style={{ ...styles.filterTab, ...(filter === 'active' && styles.filterTabActive) }}
        >
          Актуальные {counts.active > 0 && `(${counts.active})`}
        </button>
        <button
          onClick={() => {
            hapticFeedback('selection');
            setFilter('archive');
          }}
          style={{ ...styles.filterTab, ...(filter === 'archive' && styles.filterTabActive) }}
        >
          Архив {counts.archive > 0 && `(${counts.archive})`}
        </button>
      </div>

      <div style={styles.content}>
        {filteredPosts.length === 0 && !loading ? (
          <div style={styles.empty}>
            <div style={styles.emptyEmoji}>📝</div>
            <p style={styles.emptyText}>Посты не найдены</p>
            <p style={styles.emptySubtext}>
              {filter === 'all' && 'Создайте первый пост через кнопку +'}
              {filter === 'active' && 'Нет постов с актуальной датой'}
              {filter === 'archive' && 'Нет просроченных постов'}
            </p>
          </div>
        ) : (
          filteredPosts.map((post, idx) => (
            <div
              key={post.id}
              style={{
                animation: `fadeInUp 0.4s ease ${idx * 0.05}s both`,
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
    backgroundColor: theme.colors.bg,
    overflowY: 'auto',
    paddingBottom: '20px',
  },
  filterTabs: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.bg,
    position: 'sticky',
    top: 'calc(var(--drilldown-header-height) + env(safe-area-inset-top, 0px))',
    zIndex: 9,
  },
  filterTab: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
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
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: '8px',
  },
  emptySubtext: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: '1.5',
  },
  endMessage: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
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
