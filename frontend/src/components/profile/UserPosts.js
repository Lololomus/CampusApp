// ===== FILE: UserPosts.js =====

import { useState, useEffect, useMemo, useRef } from 'react';
import { FileText, CheckCircle } from 'lucide-react';
import { getUserPosts } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import PostCard from '../posts/PostCard';
import { Z_USER_POSTS } from '../../constants/zIndex';
import PostCardSkeleton from '../posts/PostCardSkeleton';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

// Premium palette (единый источник, без legacy theme)
const C = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  textTertiary: '#666666',
  accent: '#D4FF00',
  accentText: '#000000',
};

function UserPosts() {
  const { user, viewPostId, setViewPostId, setShowUserPosts, updatedPostId, updatedPostData, clearUpdatedPost } = useStore();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const loadLockRef = useRef(false);
  const LIMIT = 10;

  const closeScreen = () => setShowUserPosts(false);

  useTelegramScreen({
    id: 'user-posts-screen',
    title: 'Мои посты',
    priority: 40,
    back: { visible: true, onClick: () => { hapticFeedback('light'); closeScreen(); } },
  });

  useEffect(() => {
    lockBodyScroll();
    loadPosts();
    return () => unlockBodyScroll();
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
    if (hasUpdated) clearUpdatedPost();
  }, [updatedPostId, updatedPostData, clearUpdatedPost]);

  const loadPosts = async (reset = false) => {
    if (loadLockRef.current || (!hasMore && !reset)) return;
    loadLockRef.current = true;
    setLoading(true);
    try {
      const nextOffset = reset ? 0 : offset;
      const newPosts = await getUserPosts(user.id, LIMIT, nextOffset);
      if (newPosts.length < LIMIT) setHasMore(false);
      if (reset) {
        const byId = new Map();
        newPosts.forEach((p) => byId.set(p.id, p));
        setPosts(Array.from(byId.values()));
        setOffset(newPosts.length);
      } else {
        setPosts((prev) => {
          const byId = new Map();
          [...prev, ...newPosts].forEach((p) => byId.set(p.id, p));
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
    const d = getPostDate(post);
    return d ? d < new Date() : false;
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

  const counts = useMemo(() => ({
    all: posts.length,
    active: posts.filter((p) => !isArchived(p)).length,
    archive: posts.filter((p) => isArchived(p)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [posts]);

  const postRows = useMemo(() => (
    buildFeedSections(filteredPosts, (p) => p.created_at, { getItemKey: (p) => p.id })
  ), [filteredPosts]);

  const handlePostClick = (postId) => { hapticFeedback('light'); setViewPostId(postId); };
  const handlePostDeleted = (postId) => { setPosts((prev) => prev.filter((p) => p.id !== postId)); hapticFeedback('success'); };
  const handleLikeUpdate = (postId, updates) => { setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...updates } : p))); };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 2;
    if (bottom && hasMore && !loading) loadPosts();
  };

  const FILTERS = [
    { key: 'all', label: 'Все', count: counts.all },
    { key: 'active', label: 'Актуальные', count: counts.active },
    { key: 'archive', label: 'Архив', count: counts.archive },
  ];

  return (
    <EdgeSwipeBack
      onBack={() => { hapticFeedback('light'); closeScreen(); }}
      disabled={Boolean(viewPostId)}
      zIndex={Z_USER_POSTS}
    >
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader
        title={`Мои посты (${counts.all})`}
        onBack={closeScreen}
        background="#000000"
        showDivider={false}
      />

      <div style={styles.filterBar}>
        <div style={styles.tabsWrapper}>
          <div style={{ ...styles.activeIndicator, transform: `translateX(${FILTERS.findIndex(f => f.key === filter) * 100}%)` }} />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { hapticFeedback('selection'); setFilter(f.key); }}
              style={{ ...styles.tabBtn, color: filter === f.key ? '#000000' : '#8E8E93' }}
            >
              {f.label}{f.count > 0 ? ` ${f.count}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {filteredPosts.length === 0 && !loading ? (
          <div style={styles.empty}>
            <FileText size={36} color={C.textTertiary} strokeWidth={1.5} />
            <div style={styles.emptyTitle}>Посты не найдены</div>
            <div style={styles.emptySub}>
              {filter === 'all' && 'Создайте первый пост через кнопку +'}
              {filter === 'active' && 'Нет постов с актуальной датой'}
              {filter === 'archive' && 'Нет просроченных постов'}
            </div>
          </div>
        ) : (
          postRows.map((row) =>
            row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <div key={row.key} style={{ animation: `fadeInUp 0.35s ease ${row.index * 0.04}s both` }}>
                <PostCard
                  post={row.item}
                  onClick={handlePostClick}
                  onPostDeleted={handlePostDeleted}
                  onLikeUpdate={handleLikeUpdate}
                />
              </div>
            )
          )
        )}

        {loading && (
          <>
            <PostCardSkeleton />
            <PostCardSkeleton />
            <PostCardSkeleton />
          </>
        )}

        {!hasMore && posts.length > 0 && (
          <div style={styles.endMsg}>
            <CheckCircle size={20} color={C.textTertiary} strokeWidth={1.5} />
            <span>Это все ваши посты</span>
          </div>
        )}
      </div>
    </div>
    </EdgeSwipeBack>
  );
}

const styles = {
  container: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: Z_USER_POSTS,
    backgroundColor: C.bg,
    overflowY: 'auto',
  },

  filterBar: {
    padding: '12px 16px',
    backgroundColor: C.bg,
    position: 'sticky',
    top: 'calc(var(--drilldown-header-height) + env(safe-area-inset-top, 0px))',
    zIndex: 9,
  },
  tabsWrapper: {
    display: 'flex',
    background: '#1C1C1E',
    borderRadius: 14,
    position: 'relative',
    height: 42,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: 'calc(100% / 3)',
    background: C.accent,
    borderRadius: 14,
    boxShadow: '0 2px 10px rgba(212,255,0,0.2)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },
  tabBtn: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 2,
    transition: 'color 0.2s',
    WebkitTapHighlightColor: 'transparent',
  },

  content: {
    padding: '4px 0 calc(env(safe-area-inset-bottom, 20px) + 20px)',
  },

  // Empty — dashed placeholder
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: '52px 24px',
    margin: '8px 16px',
    border: '1px dashed rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: 700, color: C.text,
  },
  emptySub: {
    fontSize: 14, color: C.textMuted, lineHeight: 1.5, textAlign: 'center',
  },

  // Конец списка
  endMsg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '28px 20px',
    margin: '8px 16px 0',
    borderTop: `1px solid ${C.border}`,
    fontSize: 13,
    fontWeight: 600,
    color: C.textTertiary,
  },
};

export default UserPosts;
