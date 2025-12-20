import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart, MessageCircle, Eye, Send } from 'lucide-react';
import { getPost, getPostComments, createComment, likePost } from '../api';
import { useStore } from '../store';
import { hapticFeedback, showBackButton, hideBackButton } from '../utils/telegram';
import { MOCK_COMMENTS } from '../types';

function PostDetail() {
  const { viewPostId, setViewPostId } = useStore();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    if (viewPostId) {
      loadPost();
      showBackButton(() => handleBack());
    }
    
    return () => {
      hideBackButton();
    };
  }, [viewPostId]);

  const loadPost = async () => {
    setLoading(true);
    try {
      const data = await getPost(viewPostId);
      setPost(data);
      setIsLiked(data.is_liked || false);

      // Загружаем реальные комментарии
      try {
        const commentsData = await getPostComments(viewPostId);
        setComments(commentsData);
      } catch (error) {
        console.error('Ошибка загрузки комментариев:', error);
        setComments([]);
      }
    } catch (error) {
      console.error('Error loading post:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setViewPostId(null);
  };

  const handleSendComment = async () => {
    if (!newComment.trim()) return;
    
    hapticFeedback('medium');
    
    try {
      const comment = await createComment(viewPostId, newComment.trim());
      setComments([comment, ...comments]);
      setNewComment('');
    } catch (error) {
      console.error('Ошибка создания комментария:', error);
      alert('Не удалось отправить комментарий');
    }
  };

  const handleLike = async () => {
    hapticFeedback('light');
    
    try {
      const result = await likePost(post.id);
      setPost({ ...post, likes: result.likes });
      setIsLiked(result.is_liked);
    } catch (error) {
      console.error('Ошибка лайка:', error);
    }
  };

  if (!viewPostId) return null;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  }

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
    <div style={styles.container}>
      {/* Header с кнопкой Назад */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Пост</span>
      </div>

      {/* Контент поста */}
      <div style={styles.content}>
        {/* Автор */}
        <div style={styles.authorSection}>
          <div style={styles.avatar}>
            {(typeof post.author === 'object' ? post.author.name : post.author)?.[0] || '?'}
          </div>
          <div style={styles.authorInfo}>
            <div style={styles.authorName}>
              {typeof post.author === 'object' ? post.author.name : post.author}
            </div>
            <div style={styles.authorMeta}>
              {post.university || post.uni} · {post.institute} · {post.course} курс
            </div>
            <div style={styles.time}>{post.time}</div>
          </div>
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
        <h1 style={styles.title}>{post.title}</h1>
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

        {/* Статистика */}
        <div style={styles.stats}>
          <button 
            style={{
              ...styles.statButton,
              color: isLiked ? '#ff3b5c' : '#999'
            }} 
            onClick={handleLike}
          >
            <Heart size={20} fill={isLiked ? '#ff3b5c' : 'none'} />
            <span>{post.likes}</span>
          </button>
          <div style={styles.statItem}>
            <MessageCircle size={20} />
            <span>{comments.length}</span>
          </div>
          <div style={styles.statItem}>
            <Eye size={20} />
            <span>{post.views}</span>
          </div>
        </div>

        {/* Комментарии */}
        <div style={styles.commentsSection}>
          <h3 style={styles.commentsTitle}>
            Комментарии ({comments.length})
          </h3>
          
          {comments.length === 0 ? (
            <div style={styles.noComments}>
              <p>Пока нет комментариев</p>
              <p style={styles.noCommentsHint}>Будь первым!</p>
            </div>
          ) : (
            <div style={styles.commentsList}>
              {comments.map((comment) => (
                <Comment key={comment.id} comment={comment} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Форма нового комментария */}
      <div style={styles.commentForm}>
        <input
          type="text"
          placeholder="Написать комментарий..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendComment()}
          style={styles.commentInput}
        />
        <button
          onClick={handleSendComment}
          disabled={!newComment.trim()}
          style={{
            ...styles.sendButton,
            opacity: newComment.trim() ? 1 : 0.5,
          }}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}

function Comment({ comment, depth = 0 }) {
  const [showReplies, setShowReplies] = useState(true);

  return (
    <div style={{ ...styles.comment, marginLeft: depth > 0 ? '32px' : 0 }}>
      <div style={styles.commentAvatar}>
        {(typeof comment.author === 'object' ? comment.author.name : comment.author)?.[0] || '?'}
      </div>
      <div style={styles.commentContent}>
        <div style={styles.commentHeader}>
          <span style={styles.commentAuthor}>
            {typeof comment.author === 'object' ? comment.author.name : comment.author}
          </span>
          <span style={styles.commentTime}>{comment.time}</span>
        </div>
        <p style={styles.commentText}>{comment.text}</p>
        <div style={styles.commentActions}>
          <button style={styles.commentAction}>
            <Heart size={14} />
            <span>{comment.likes}</span>
          </button>
          <button style={styles.commentAction}>Ответить</button>
        </div>
        
        {/* Вложенные ответы */}
        {comment.replies && comment.replies.length > 0 && (
          <div style={styles.replies}>
            {showReplies && comment.replies.map((reply) => (
              <Comment key={reply.id} comment={reply} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#121212',
    minHeight: '100vh',
    paddingBottom: '80px',
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
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  authorSection: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  avatar: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#8774e1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 0,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },
  authorMeta: {
    fontSize: '13px',
    color: '#999',
    marginTop: '2px',
  },
  time: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  category: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#fff',
    marginBottom: '12px',
    lineHeight: '1.4',
  },
  body: {
    fontSize: '16px',
    color: '#ccc',
    lineHeight: '1.6',
    marginBottom: '16px',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '16px',
  },
  tag: {
    fontSize: '14px',
    color: '#8774e1',
    fontWeight: '500',
  },
  stats: {
    display: 'flex',
    gap: '20px',
    paddingTop: '16px',
    paddingBottom: '16px',
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
  },
  statButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    fontSize: '15px',
    padding: '4px',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#666',
    fontSize: '15px',
  },
  commentsSection: {
    marginTop: '24px',
  },
  commentsTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '16px',
  },
  noComments: {
    textAlign: 'center',
    color: '#999',
    padding: '40px 20px',
  },
  noCommentsHint: {
    fontSize: '14px',
    color: '#666',
    marginTop: '8px',
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  comment: {
    display: 'flex',
    gap: '12px',
  },
  commentAvatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    backgroundColor: '#444',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
    flexShrink: 0,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  commentAuthor: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  },
  commentTime: {
    fontSize: '12px',
    color: '#666',
  },
  commentText: {
    fontSize: '15px',
    color: '#ccc',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  commentActions: {
    display: 'flex',
    gap: '16px',
  },
  commentAction: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: '#999',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '4px',
  },
  replies: {
    marginTop: '12px',
  },
  commentForm: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    gap: '12px',
    padding: '12px 16px',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
  },
  commentInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '24px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
  },
  sendButton: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontSize: '16px',
  },
};

export default PostDetail;