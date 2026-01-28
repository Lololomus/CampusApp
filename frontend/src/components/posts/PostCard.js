import React, { useState, useRef, useMemo } from 'react';
import { Heart, MessageCircle, Eye, MapPin, MoreVertical, ChevronLeft, ChevronRight, Calendar, Link as LinkIcon } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import { likePost, deletePost } from '../../api';
import { useStore } from '../../store';
import theme from '../../theme';
import DropdownMenu from '../DropdownMenu';
import PollWidget from './PollWidget';
import PhotoViewer from '../shared/PhotoViewer';

const API_URL = 'http://localhost:8000';

function PostCard({ post, onClick, onLikeUpdate, onPostDeleted }) {
  const { likedPosts, setPostLiked, user, setEditingContent } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  // ✅ Local state для likes_count
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count || 0);

  const images = useMemo(() => {
    if (!post.images) return [];
    if (Array.isArray(post.images)) return post.images;
    try { return JSON.parse(post.images); } catch { return []; }
  }, [post.images]);

  const firstImage = images.length > 0 ? images[0] : null;
  const meta = (typeof firstImage === 'object' && firstImage !== null) ? firstImage : null;
  const rawRatio = (meta?.w && meta?.h) ? meta.w / meta.h : 1;
  const safeRatio = Math.max(0.75, Math.min(rawRatio, 1.77));

  const [currentImageIndex, setCurrentImageIndex] = useState(() => {
    const saved = sessionStorage.getItem(`post-${post.id}-imageIndex`);
    return saved ? parseInt(saved, 10) : 0;
  });

  const getImageUrl = (img) => {
    if (!img) return '';
    const filename = (typeof img === 'object') ? img.url : img;
    if (filename.startsWith('http')) return filename;
    return `${API_URL}/uploads/images/${filename}`;
  };

  const viewerPhotos = useMemo(() => images.map(img => getImageUrl(img)), [images]);

  const isLiked = likedPosts[post.id] ?? post.is_liked ?? false;

  const isOwner = useMemo(() => {
    if (!user) return false;
    const userId = user.id || user.user_id;
    if (post.author_id && userId && String(post.author_id) === String(userId)) return true;
    if (post.author_telegram_id && user.telegram_id && String(user.telegram_id) === String(post.author_telegram_id)) return true;
    return false;
  }, [user, post]);

  const authorMeta = !post.is_anonymous && post.author
    ? [post.author.university, post.author.course ? `${post.author.course}к` : null]
        .filter(Boolean).join(' · ')
    : null;

  const { dateText, isEdited } = useMemo(() => {
    const created = new Date(post.created_at);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let dateText = '';
    if (diffMins < 1) dateText = 'Только что';
    else if (diffMins < 60) dateText = `${diffMins}м назад`;
    else if (diffHours < 24) dateText = `${diffHours}ч назад`;
    else if (diffDays < 7) dateText = `${diffDays}д назад`;
    else dateText = created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    const updated = new Date(post.updated_at || post.created_at);
    const isEdited = (updated - created) > 5 * 60 * 1000;

    return { dateText, isEdited };
  }, [post.created_at, post.updated_at]);

  const catInfo = useMemo(() => {
    switch(post.category) {
      case 'news': return { label: 'Новости', color: theme.colors.news };
      case 'events': return { label: 'Событие', color: theme.colors.events };
      case 'confessions': return { label: 'Подслушано', color: theme.colors.confessions };
      case 'lost_found': return { label: 'Бюро', color: theme.colors.lostFound };
      case 'polls': return { label: 'Опрос', color: theme.colors.primary };
      default: return { label: 'Пост', color: theme.colors.textSecondary };
    }
  }, [post.category]);

  const handleCardClick = () => {
    if (onClick) onClick(post.id);
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    hapticFeedback('medium');

    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 300);

    const newIsLiked = !isLiked;
    
    // Optimistic update
    setPostLiked(post.id, newIsLiked);
    setLocalLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      const result = await likePost(post.id);
      
      // Применяем реальный ответ сервера
      setPostLiked(post.id, result.is_liked);
      setLocalLikesCount(result.likes);
      
      if (onLikeUpdate) {
        onLikeUpdate(post.id, {
          is_liked: result.is_liked,
          likes_count: result.likes
        });
      }
    } catch (error) {
      console.error('Like error:', error);
      // Откат при ошибке
      setPostLiked(post.id, isLiked);
      setLocalLikesCount(post.likes_count || 0);
    }
  };

  const handleEdit = () => {
    setMenuOpen(false);
    hapticFeedback('light');
    setEditingContent(post, 'post');
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (window.confirm('Удалить этот пост?')) {
      hapticFeedback('heavy');
      try {
        await deletePost(post.id);
        if (onPostDeleted) onPostDeleted(post.id);
      } catch (error) {
        alert('Ошибка удаления');
      }
    }
  };

  const handleCopyLink = () => {
    setMenuOpen(false);
    hapticFeedback('success');
    const link = `campusapp://post/${post.id}`;
    navigator.clipboard.writeText(link);
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setIsPhotoViewerOpen(true);
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(prev => {
      const n = prev === 0 ? images.length - 1 : prev - 1;
      sessionStorage.setItem(`post-${post.id}-imageIndex`, n);
      return n;
    });
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex(prev => {
      const n = prev === images.length - 1 ? 0 : prev + 1;
      sessionStorage.setItem(`post-${post.id}-imageIndex`, n);
      return n;
    });
  };

  const menuItems = [
    { label: 'Скопировать ссылку', icon: <LinkIcon size={18} />, onClick: handleCopyLink },
    ...(isOwner ? [
      { label: 'Редактировать', icon: '✏️', onClick: handleEdit },
      { label: 'Удалить', icon: '🗑️', danger: true, onClick: handleDelete }
    ] : [
      { label: 'Пожаловаться', icon: '🚩', danger: true, onClick: () => { alert('Жалоба отправлена'); setMenuOpen(false); } }
    ])
  ];

  return (
    <>
      <style>{`
        @keyframes likeBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={styles.card} onClick={handleCardClick}>
        <div style={styles.header}>
          <div style={styles.authorRow}>
            <div style={{
              ...styles.avatar,
              background: post.is_anonymous 
                ? theme.colors.primary 
                : `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`
            }}>
              {post.is_anonymous ? 'A' : (post.author?.name?.[0] || 'A')}
            </div>

            <div style={styles.authorInfo}>
              <div style={styles.nameRow}>
                <span style={styles.authorName}>
                  {post.is_anonymous ? 'Аноним' : (post.author?.name || 'Пользователь')}
                </span>
                {post.is_important && <span style={styles.pinned}>📌</span>}
              </div>
              {authorMeta && <span style={styles.authorMeta}>{authorMeta}</span>}
            </div>
          </div>

          <div style={styles.headerRight}>
            <span style={{...styles.categoryText, color: catInfo.color}}>
              {catInfo.label}
            </span>

            <div style={{position: 'relative', display: 'flex', alignItems: 'center'}}>
              <button
                ref={menuButtonRef}
                style={styles.menuButton}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); hapticFeedback('light'); }}
              >
                <MoreVertical size={20} />
              </button>
              <DropdownMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuButtonRef}
                items={menuItems}
              />
            </div>
          </div>
        </div>

        <div style={styles.content}>
          {post.title && post.category !== 'polls' && (
            <h3 style={styles.title}>{post.title}</h3>
          )}

          {post.body && (
            <p style={styles.body}>{post.body}</p>
          )}
        </div>

        {post.poll && (
          <div style={styles.pollWrapper} onClick={e => e.stopPropagation()}>
            <PollWidget poll={post.poll} postId={post.id} />
          </div>
        )}

        {(post.event_date || post.lost_or_found || post.location) && (
          <div style={styles.specialBlock}>
            {post.event_date && (
              <div style={styles.specialItem}>
                <Calendar size={14} />
                <span>
                  {new Date(post.event_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в {new Date(post.event_date).toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}
                </span>
              </div>
            )}
            {post.location && (
              <div style={styles.specialItem}>
                <MapPin size={14} />
                <span>{post.location}</span>
              </div>
            )}
            {post.lost_or_found && (
              <div style={{
                ...styles.specialItem,
                color: post.lost_or_found === 'lost' ? theme.colors.error : theme.colors.success,
                background: post.lost_or_found === 'lost' ? `${theme.colors.error}15` : `${theme.colors.success}15`
              }}>
                {post.lost_or_found === 'lost' ? '🔍 Потерял' : '🎁 Нашёл'}
                {post.item_description && ` — ${post.item_description}`}
              </div>
            )}
          </div>
        )}

        {images.length > 0 && (
          <div style={{...styles.imageContainer, aspectRatio: `${safeRatio}`}} onClick={handleImageClick}>
            <img
              src={getImageUrl(images[currentImageIndex])}
              alt=""
              style={styles.image}
            />

            {images.length > 1 && (
              <>
                <div style={styles.imageCounter}>{currentImageIndex + 1}/{images.length}</div>
                <button onClick={handlePrevImage} style={{...styles.navBtn, left: 10}}>
                  <ChevronLeft size={20}/>
                </button>
                <button onClick={handleNextImage} style={{...styles.navBtn, right: 10}}>
                  <ChevronRight size={20}/>
                </button>
                <div style={styles.dots}>
                  {images.map((_, i) => (
                    <div key={i} style={{...styles.dot, opacity: i === currentImageIndex ? 1 : 0.4}} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div style={styles.tags}>
            {post.tags.slice(0, 3).map(t => <span key={t} style={styles.tag}>#{t}</span>)}
          </div>
        )}

        <div style={styles.footer}>
          <div style={styles.footerLeft}>
            <span style={styles.dateText}>{dateText}</span>
            {isEdited && <span style={styles.editedLabel}>(изм.)</span>}
          </div>

          <div style={styles.footerRight}>
            <div style={styles.statItem}>
              <Eye size={20} color={theme.colors.textTertiary} strokeWidth={2} />
              <span style={styles.statText}>{post.views_count || 0}</span>
            </div>

            <button
              style={styles.footerAction}
              onClick={(e) => {
                e.stopPropagation();
                if(onClick) onClick(post.id);
              }}
            >
              <MessageCircle size={20} color={theme.colors.textSecondary} strokeWidth={2} />
              <span style={{...styles.statText, color: theme.colors.textSecondary}}>
                {post.comments_count || 0}
              </span>
            </button>

            <button
              style={{
                ...styles.footerAction,
                animation: isLikeAnimating ? 'likeBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
              }}
              onClick={handleLike}
            >
              <Heart
                size={20}
                fill={isLiked ? theme.colors.accent : 'none'}
                color={isLiked ? theme.colors.accent : theme.colors.textSecondary}
                strokeWidth={isLiked ? 0 : 2}
              />
              <span style={{
                ...styles.statText,
                color: isLiked ? theme.colors.accent : theme.colors.textSecondary
              }}>
                {localLikesCount}
              </span>
            </button>
          </div>
        </div>

        {isPhotoViewerOpen && (
          <PhotoViewer
            photos={viewerPhotos}
            initialIndex={currentImageIndex}
            onClose={() => setIsPhotoViewerOpen(false)}
          />
        )}
      </div>
    </>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.lg,
    marginBottom: 8, // ✅ БЫЛО: 12 → СТАЛО: 8 (VK style)
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
    transition: 'transform 0.1s ease-out',
    WebkitTapHighlightColor: 'transparent',
  },
  header: {
    padding: '12px 16px 2px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    flexShrink: 0,
  },
  authorInfo: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  authorName: {
    fontSize: 15,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  pinned: {
    fontSize: 12,
  },
  authorMeta: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flexShrink: 0,
    paddingLeft: theme.spacing.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  menuButton: {
    padding: 6,
    background: 'transparent',
    border: 'none',
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
  },
  content: {
    padding: '1px 16px 1px',
  },
  title: {
    fontSize: 17,
    fontWeight: theme.fontWeight.bold,
    marginBottom: 6,
    lineHeight: 1.3,
    color: theme.colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 1.5,
    color: theme.colors.textSecondary,
    display: '-webkit-box',
    WebkitLineClamp: 4,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  pollWrapper: {
    margin: `0 16px 12px`,
  },
  specialBlock: {
    margin: `0 16px 12px`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  specialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 10px',
    background: theme.colors.elevated,
    borderRadius: theme.radius.sm,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  imageContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: theme.colors.bg,
    marginBottom: 10,
    margin: '0 16px 10px',
    width: 'calc(100% - 32px)',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    background: theme.colors.overlayDark,
    color: theme.colors.text,
    padding: '4px 10px',
    borderRadius: theme.radius.md,
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    background: theme.colors.overlay,
    color: theme.colors.text,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  dots: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.full,
    background: theme.colors.text,
    transition: theme.transitions.fast,
  },
  tags: {
    padding: `0 16px`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: 10,
  },
  tag: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 16px',
    backgroundColor: theme.colors.bgSecondary,
    minHeight: 40,
  },
  footerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  dateText: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.medium,
  },
  editedLabel: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  footerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 14, // ✅ БЫЛО: 16px (theme.spacing.lg) → СТАЛО: 14px (плотнее)
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    color: theme.colors.textTertiary,
  },
  footerAction: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    color: theme.colors.textTertiary,
  },
  statText: {
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.textTertiary,
    minWidth: 14,
    textAlign: 'center',
    lineHeight: 1,
  },
};

export default PostCard;