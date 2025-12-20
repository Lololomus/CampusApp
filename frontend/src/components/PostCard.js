import React, { useState } from 'react';
import { Heart, MessageCircle, Eye } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';
import { likePost } from '../api';


function PostCard({ post, onClick }) {
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);

  const handleLike = async (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    
    try {
      const result = await likePost(post.id);
      setIsLiked(result.is_liked);
      setLikesCount(result.likes);
    } catch (error) {
      console.error('Ошибка лайка:', error);
    }
  };


  const getCategoryColor = (category) => {
    const colors = {
      study: '#3b82f6',
      help: '#10b981',
      hangout: '#f59e0b',
      dating: '#ec4899',
    };
    return colors[category] || '#666';
  };


  const getCategoryLabel = (category) => {
    const labels = {
      study: 'Учёба',
      help: 'Помощь',
      hangout: 'Движ',
      dating: 'Знакомства',
    };
    return labels[category] || category;
  };


  return (
    <div style={styles.card} onClick={onClick}>
      {/* Шапка поста */}
      <div style={styles.header}>
        <div style={styles.authorInfo}>
          <div style={styles.avatar}>
            {(typeof post.author === 'object' ? post.author.name : post.author)?.[0] || '?'}
          </div>
          <div>
            <div style={styles.author}>
              {typeof post.author === 'object' ? post.author.name : post.author}
            </div>
            <div style={styles.meta}>
              {post.university || post.uni} · {post.institute} · {post.course} курс
            </div>
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
      </div>


      {/* Заголовок и текст */}
      <h3 style={styles.title}>{post.title}</h3>
      <p style={styles.body}>{post.body}</p>


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
          <span>{likesCount}</span>
        </button>
        <button style={styles.actionButton}>
          <MessageCircle size={18} />
          <span>{post.commentsCount || post.comments_count || 0}</span>
        </button>
        <div style={styles.views}>
          <Eye size={18} />
          <span>{post.views}</span>
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
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '12px',
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