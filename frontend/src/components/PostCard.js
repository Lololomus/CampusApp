import React from 'react';
import { Heart, MessageCircle, Eye, MapPin, Calendar } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';
import { likePost } from '../api';
import { useStore } from '../store';
import theme from '../theme';

function PostCard({ post, onClick, onLikeUpdate }) {
  const { likedPosts, setPostLiked } = useStore();
  const isLiked = likedPosts[post.id] ?? post.is_liked ?? false;
  const likesCount = post.likes_count || post.likes || 0;
  
  const handleLike = async (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    
    const newIsLiked = !isLiked;
    setPostLiked(post.id, newIsLiked);
    
    try {
      const result = await likePost(post.id);
      setPostLiked(post.id, result.is_liked);
      
      if (onLikeUpdate) {
        onLikeUpdate(post.id, {
          is_liked: result.is_liked,
          likes_count: result.likes
        });
      }
    } catch (error) {
      console.error('Ошибка лайка:', error);
      setPostLiked(post.id, isLiked);
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      news: theme.colors.news,
      events: theme.colors.events,
      confessions: theme.colors.confessions,
      lost_found: theme.colors.lostFound,
    };
    return colors[category] || theme.colors.textDisabled;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      news: '📰 Новости',
      events: '🎉 События',
      confessions: '💭 Признания',
      lost_found: '🔍 Находки',
    };
    return labels[category] || category;
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('ru-RU', options);
  };

  const isAnonymous = post.is_anonymous === true;
  const displayAuthorName = isAnonymous ? 'Аноним' : (typeof post.author === 'object' ? post.author.name : post.author);
  const displayAuthorAvatar = isAnonymous ? '?' : (typeof post.author === 'object' ? post.author.name : post.author)?.[0] || '?';

  return (
    <div style={styles.card} onClick={() => onClick(post.id)}>
      {/* Шапка */}
      <div style={styles.header}>
        <div style={styles.authorInfo}>
          <div style={{
            ...styles.avatar,
            backgroundColor: isAnonymous ? theme.colors.textDisabled : theme.colors.primary
          }}>
            {displayAuthorAvatar}
          </div>
          <div>
            <div style={styles.author}>
              {displayAuthorName}
            </div>
            {!isAnonymous && (post.author?.university || post.author?.institute || post.author?.course) && (
              <div style={styles.meta}>
                {[
                  post.author?.university, 
                  post.author?.institute, 
                  post.author?.course ? `${post.author.course} курс` : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
          </div>
        </div>
        <div style={styles.time}>{post.time}</div>
      </div>

      {/* Категория */}
      <div
        style={{
          ...styles.category,
          backgroundColor: `${getCategoryColor(post.category)}20`,
          color: getCategoryColor(post.category),
        }}
      >
        {getCategoryLabel(post.category)}
        {post.category === 'news' && post.is_important && (
          <span style={styles.importantBadge}>⭐</span>
        )}
      </div>

      {/* Контент */}
      <h3 style={styles.title}>{post.title}</h3>
      <p style={styles.body}>{post.body}</p>

      {/* LOST & FOUND */}
      {post.category === 'lost_found' && post.item_description && (
        <div style={styles.extraInfo}>
          <span style={styles.extraLabel}>
            {post.lost_or_found === 'lost' ? '😢' : '🎉'} {post.item_description}
          </span>
          {post.location && (
            <span style={styles.extraDetail}>
              <MapPin size={12} /> {post.location}
            </span>
          )}
        </div>
      )}

      {/* EVENTS */}
      {post.category === 'events' && post.event_name && (
        <div style={styles.extraInfo}>
          <span style={styles.extraLabel}>{post.event_name}</span>
          {post.event_date && (
            <span style={styles.extraDetail}>
              <Calendar size={12} /> {formatEventDate(post.event_date)}
            </span>
          )}
        </div>
      )}

      {/* Теги */}
      {post.tags && post.tags.length > 0 && (
        <div style={styles.tags}>
          {post.tags.map((tag, index) => (
            <span key={index} style={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Футер */}
      <div style={styles.footer}>
        <button 
          style={{
            ...styles.actionButton,
            color: isLiked ? theme.colors.accent : theme.colors.textTertiary
          }}
          onClick={handleLike}
        >
          <Heart size={18} fill={isLiked ? theme.colors.accent : 'none'} />
          <span>{likesCount}</span>
        </button>
        <button style={styles.actionButton}>
          <MessageCircle size={18} />
          <span>{post.commentsCount || post.comments_count || 0}</span>
        </button>
        <div style={styles.views}>
          <Eye size={18} />
          <span>{post.views_count || post.views || 0}</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    cursor: 'pointer',
    transition: theme.transitions.normal,
    border: `1px solid ${theme.colors.border}`,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  authorInfo: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  author: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  time: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
  },
  category: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs}px 10px`,
    borderRadius: 6,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.md,
  },
  importantBadge: {
    fontSize: 11,
    marginLeft: 2,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    lineHeight: 1.4,
  },
  body: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    marginBottom: theme.spacing.md,
  },
  extraInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
  },
  extraLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  extraDetail: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textTertiary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tag: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  footer: {
    display: 'flex',
    gap: theme.spacing.lg,
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: 'none',
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    padding: theme.spacing.xs,
    fontSize: theme.fontSize.base,
    transition: theme.transitions.normal,
  },
  views: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: theme.colors.textDisabled,
    fontSize: theme.fontSize.base,
    marginLeft: 'auto',
  },
};

export default PostCard;