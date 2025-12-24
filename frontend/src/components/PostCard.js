import React, { useState } from 'react';
import { Heart, MessageCircle, Eye, MapPin, Calendar } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';
import { likePost } from '../api';
import { useStore } from '../store';

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
      news: '#3b82f6',
      events: '#f59e0b',
      confessions: '#ec4899',
      lost_found: '#10b981',
    };
    return colors[category] || '#666';
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


  // Проверка анонимности
  const isAnonymous = post.is_anonymous === true;
  const displayAuthorName = isAnonymous ? 'Аноним' : (typeof post.author === 'object' ? post.author.name : post.author);
  const displayAuthorAvatar = isAnonymous ? '?' : (typeof post.author === 'object' ? post.author.name : post.author)?.[0] || '?';


  return (
    <div style={styles.card} onClick={() => onClick(post.id)}>
      {/* Шапка поста */}
      <div style={styles.header}>
        <div style={styles.authorInfo}>
          <div style={{
            ...styles.avatar,
            backgroundColor: isAnonymous ? '#666' : '#8774e1'
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
          backgroundColor: getCategoryColor(post.category) + '20',
          color: getCategoryColor(post.category),
        }}
      >
        {getCategoryLabel(post.category)}
        {post.category === 'news' && post.is_important && (
          <span style={styles.importantBadge}>⭐</span>
        )}
      </div>


      {/* Заголовок и текст */}
      <h3 style={styles.title}>{post.title}</h3>
      <p style={styles.body}>{post.body}</p>


      {/* LOST & FOUND компактная инфа */}
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


      {/* EVENTS компактная инфа */}
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


      {/* Футер с действиями */}
      <div style={styles.footer}>
        <button 
          style={{
            ...styles.actionButton,
            color: isLiked ? '#ff3b5c' : '#999'
          }}
          onClick={handleLike}
        >
          <Heart size={18} fill={isLiked ? '#ff3b5c' : 'none'} />
          <span>{likesCount}</span> {/* ✅ УЖЕ ПРАВИЛЬНО */}
        </button>
        <button style={styles.actionButton}>
          <MessageCircle size={18} />
          <span>{post.commentsCount || post.comments_count || 0}</span> {/* ✅ УЖЕ ПРАВИЛЬНО */}
        </button>
        <div style={styles.views}>
          <Eye size={18} />
          <span>{post.views_count || post.views || 0}</span> {/* ✅ ИСПРАВЛЕНО */}
        </div>
      </div>
    </div>
  );
}


const styles = {
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: '1px solid #333',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px',
  },
  authorInfo: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#8774e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
  },
  author: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
  },
  meta: {
    fontSize: '12px',
    color: '#999',
    marginTop: '2px',
  },
  time: {
    fontSize: '12px',
    color: '#666',
  },
  category: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  importantBadge: {
    fontSize: '11px',
    marginLeft: '2px',
  },
  title: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  body: {
    fontSize: '15px',
    color: '#ccc',
    lineHeight: '1.5',
    marginBottom: '12px',
  },
  extraInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '8px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  extraLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
  },
  extraDetail: {
    fontSize: '12px',
    color: '#999',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '12px',
  },
  tag: {
    fontSize: '13px',
    color: '#8774e1',
    fontWeight: '500',
  },
  footer: {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #333',
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: '4px',
    fontSize: '14px',
    transition: 'color 0.2s',
  },
  views: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#666',
    fontSize: '14px',
    marginLeft: 'auto',
  },
};


export default PostCard;