import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart, MessageCircle, Eye, Send, MoreVertical } from 'lucide-react';
import { getPost, getPostComments, createComment, likePost, likeComment, deleteComment, updateComment, reportComment } from '../api';
import { useStore } from '../store';
import { hapticFeedback, showBackButton, hideBackButton } from '../utils/telegram';
import BottomActionBar from './BottomActionBar';

function PostDetail() {
  const { viewPostId, setViewPostId, user, updatePost } = useStore();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [commentLikes, setCommentLikes] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  
  // состояние для редактирования
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  
  // состояние для жалоб
  const [reportingComment, setReportingComment] = useState(null);

  useEffect(() => {
    if (viewPostId) {
      loadPost();
      showBackButton(handleBack);
      return () => hideBackButton();
    }
  }, [viewPostId]);

  const loadPost = async () => {
    setLoading(true);
    try {
      const data = await getPost(viewPostId);
      setPost(data);
      setIsLiked(data.is_liked || false);

      try {
        const commentsData = await getPostComments(viewPostId);
        setComments(commentsData);
        const initialLikes = {};
        commentsData.forEach(comment => {
          initialLikes[comment.id] = {
            isLiked: comment.is_liked || false,
            count: comment.likes || 0
          };
        });
        setCommentLikes(initialLikes);
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

  const refreshPost = async () => {
    try {
      console.log('🔄 Запрашиваю свежий пост с сервера...');
      const fresh = await getPost(viewPostId);
      console.log('✅ Получил с сервера comments_count:', fresh.comments_count);
      console.log('📦 Полный объект поста:', fresh);
      
      setPost(fresh);
      
      if (updatePost && viewPostId) {
        updatePost(viewPostId, { comments_count: fresh.comments_count, likes: fresh.likes, views: fresh.views });
      }
    } catch (e) {
      console.error('❌ Не удалось обновить пост:', e);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setViewPostId(null);
  };

  const handleSendComment = async (text) => {
    if (!text || !text.trim()) return;
    
    try {
      const comment = await createComment(viewPostId, text.trim(), replyTo);
      setComments([...comments, comment]);
      setCommentLikes({
        ...commentLikes,
        [comment.id]: { isLiked: false, count: 0 }
      });
      setReplyTo(null);

      await refreshPost();
    } catch (error) {
      console.error('Ошибка создания комментария:', error);
      alert('Не удалось отправить комментарий');
    }
  };

  const handleDirectSend = async (text) => {
    console.log('✉️ Личное сообщение автору:', text);
    hapticFeedback('success');
    
    // Mock отправка (пока нет backend API)
    alert(`Отклик отправлен автору!\n\n"${text}"`);
    
    // TODO: После создания backend раскомментируй:
    // try {
    //   await createResponse(viewPostId, text);
    //   alert('Отклик успешно отправлен!');
    // } catch (error) {
    //   console.error('Ошибка отправки отклика:', error);
    //   alert('Не удалось отправить отклик');
    // }
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

  const handleCommentLike = async (commentId) => {
    hapticFeedback('light');
    try {
      const result = await likeComment(commentId);
      setCommentLikes({
        ...commentLikes,
        [commentId]: {
          isLiked: result.is_liked,
          count: result.likes
        }
      });
    } catch (error) {
      console.error('Ошибка лайка комментария:', error);
    }
  };

  const handleReply = (comment) => {
    hapticFeedback('light');
    setReplyTo(comment.id);
    const authorName = typeof comment.author === 'object' ? comment.author.name : comment.author;
    setReplyToName(authorName || '');
    setMenuOpen(null);
  };

  const [replyToName, setReplyToName] = useState('');

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;

    hapticFeedback('medium');
    setMenuOpen(null);

    try {
      const result = await deleteComment(commentId);

      if (result.type === 'hard_delete') {
        // HARD DELETE: полностью убираем из массива
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        // SOFT DELETE: оставляем, но меняем текст и is_deleted = true
        setComments(comments.map(c =>
          c.id === commentId
            ? { ...c, text: 'Комментарий удалён', is_deleted: true }
            : c
        ));
      }

      // берем свежий счётчик с сервера (для обоих случаев)
      await refreshPost();
      hapticFeedback('success');
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить комментарий');
    }
  };

  // НОВОЕ: редактирование комментария
  const handleEditComment = (comment) => {
    hapticFeedback('light');
    setEditingComment(comment.id);
    setEditText(comment.text);
    setMenuOpen(null);
  };

  const handleSaveEdit = async (commentId) => {
    if (!editText.trim()) return;
    
    hapticFeedback('medium');
    try {
      const updated = await updateComment(commentId, editText.trim());
      
      setComments(comments.map(c => 
        c.id === commentId ? { 
          ...c, 
          text: updated.text, 
          is_edited: true, 
          updated_at: updated.updated_at 
        } : c
      ));
      
      setEditingComment(null);
      setEditText('');
      hapticFeedback('success');
    } catch (error) {
      console.error('Ошибка редактирования:', error);
      alert('Не удалось отредактировать комментарий');
    }
  };

  const cancelEdit = () => {
    hapticFeedback('light');
    setEditingComment(null);
    setEditText('');
  };

  // НОВОЕ: жалоба на комментарий
  const handleReportComment = (commentId) => {
    hapticFeedback('light');
    setReportingComment(commentId);
    setMenuOpen(null);
  };

  const submitReport = async (reason) => {
    hapticFeedback('medium');
    try {
      await reportComment(reportingComment, reason);
      setReportingComment(null);
      hapticFeedback('success');
      alert('Жалоба отправлена. Модераторы рассмотрят её.');
    } catch (error) {
      console.error('Ошибка отправки жалобы:', error);
      alert('Не удалось отправить жалобу');
    }
  };

  const buildCommentTree = (comments) => {
    const commentMap = {};
    const roots = [];

    comments.forEach(comment => {
      commentMap[comment.id] = { ...comment, replies: [] };
    });

    comments.forEach(comment => {
      if (comment.parent_id) {
        if (commentMap[comment.parent_id]) {
          commentMap[comment.parent_id].replies.push(commentMap[comment.id]);
        }
      } else {
        roots.push(commentMap[comment.id]);
      }
    });

    return roots;
  };

  if (!viewPostId) return null;

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} />
          </button>
          <span style={styles.headerTitle}>Пост</span>
        </div>
        <div style={styles.loading}>Пост не найден</div>
      </div>
    );
  }

  const getCategoryColor = (category) => {
    const colors = {
      'study': '#3b82f6',
      'help': '#10b981',
      'hangout': '#f59e0b',
      'dating': '#ec4899',
    };
    return colors[category] || '#666';
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'study': 'Учёба',
      'help': 'Помощь',
      'hangout': 'Движ',
      'dating': 'Знакомства',
    };
    return labels[category] || category;
  };

  const commentTree = buildCommentTree(comments);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Пост</span>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Author Section */}
        <div style={styles.authorSection}>
          <div style={styles.avatar}>
            {typeof post.author === 'object' ? post.author.name[0] : post.author?.[0] || '?'}
          </div>
          <div style={styles.authorInfo}>
            <div style={styles.authorName}>
              {typeof post.author === 'object' ? post.author.name : post.author}
            </div>
            <div style={styles.authorMeta}>
              {post.university || post.uni} • {post.institute} • {post.course} курс
            </div>
            <div style={styles.time}>{post.time}</div>
          </div>
        </div>

        {/* Category Badge */}
        <div
          style={{
            ...styles.category,
            backgroundColor: `${getCategoryColor(post.category)}20`,
            color: getCategoryColor(post.category),
          }}
        >
          {getCategoryLabel(post.category)}
        </div>

        {/* Title & Body */}
        <h1 style={styles.title}>{post.title}</h1>
        <p style={styles.body}>{post.body}</p>

        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div style={styles.tags}>
            {post.tags.map((tag, index) => (
              <span key={index} style={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}

        {/* Stats */}
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
            <span>{post.comments_count || comments.length}</span>
          </div>
          <div style={styles.statItem}>
            <Eye size={20} />
            <span>{post.views}</span>
          </div>
        </div>

        {/* Comments Section */}
        <div style={styles.commentsSection}>
          <h3 style={styles.commentsTitle}>Комментарии ({post.comments_count || comments.length})</h3>

          {commentTree.length === 0 ? (
            <div style={styles.noComments}>
              <p>Пока нет комментариев</p>
              <p style={styles.noCommentsHint}>Будьте первым!</p>
            </div>
          ) : (
            <div style={styles.commentsList}>
              {commentTree.map(comment => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  currentUser={user}
                  commentLikes={commentLikes}
                  onLike={handleCommentLike}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                  onEdit={handleEditComment}
                  onReport={handleReportComment}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  editingComment={editingComment}
                  editText={editText}
                  setEditText={setEditText}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={cancelEdit}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomActionBar
        onCommentSend={handleSendComment}
        onDirectSend={handleDirectSend}
        replyTo={replyTo}
        replyToName={replyToName}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Report Modal */}
      {reportingComment && (
        <div style={styles.modalOverlay} onClick={() => setReportingComment(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Причина жалобы</h3>
            <button onClick={() => submitReport('spam')} style={styles.reportButton}>
              Спам
            </button>
            <button onClick={() => submitReport('abuse')} style={styles.reportButton}>
              Оскорбления
            </button>
            <button onClick={() => submitReport('inappropriate')} style={styles.reportButton}>
              Неприемлемый контент
            </button>
            <button onClick={() => setReportingComment(null)} style={styles.cancelButtonModal}>
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Comment({ 
  comment, 
  depth = 0, 
  currentUser, 
  commentLikes, 
  onLike, 
  onReply, 
  onDelete,
  onEdit,
  onReport,
  menuOpen, 
  setMenuOpen,
  editingComment,
  editText,
  setEditText,
  onSaveEdit,
  onCancelEdit
}) {
  const likes = commentLikes[comment.id] || { isLiked: false, count: comment.likes || 0 };
  const maxDepth = 3;
  const isMyComment = currentUser && comment.author_id === currentUser.id;
  const isEditing = editingComment === comment.id;

  return (
    <div style={{ position: 'relative' }}>
      {/* Вертикальная линия на всю высоту ветки */}
      {comment.replies && comment.replies.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: '18px',
            top: '36px',
            bottom: '0',
            width: '2px',
            backgroundColor: 'rgba(135, 116, 225, 0.25)',
            zIndex: 0,
          }}
        />
      )}

      <div style={styles.comment}>
        <div style={styles.commentAvatar}>
          {typeof comment.author === 'object' 
            ? comment.author.name[0] 
            : comment.author?.[0] || '?'}
        </div>
        
        <div style={styles.commentContent}>
          <div style={styles.commentHeader}>
            <span style={styles.commentAuthor}>
              {typeof comment.author === 'object' ? comment.author.name : comment.author}
            </span>
            <span style={styles.commentMeta}>
              {comment.author?.university} • {comment.author?.course} курс
            </span>
            
            {!comment.is_deleted && (
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <button
                  onClick={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                  style={styles.menuButton}
                >
                  <MoreVertical size={16} />
                </button>
                
                {menuOpen === comment.id && (
                  <div style={styles.menu}>
                    {isMyComment ? (
                      <>
                        <button onClick={() => onEdit(comment)} style={styles.menuItem}>
                          Редактировать
                        </button>
                        <button onClick={() => onDelete(comment.id)} style={styles.menuItem}>
                          Удалить
                        </button>
                      </>
                    ) : (
                      <button onClick={() => onReport(comment.id)} style={styles.menuItem}>
                        Пожаловаться
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {isEditing ? (
            <div style={styles.editForm}>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                style={styles.editTextarea}
                rows={3}
                autoFocus
              />
              <div style={styles.editButtons}>
                <button onClick={() => onSaveEdit(comment.id)} style={styles.saveButton}>
                  Сохранить
                </button>
                <button onClick={onCancelEdit} style={styles.cancelEditButton}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <p style={{
                ...styles.commentText,
                fontStyle: comment.is_deleted ? 'italic' : 'normal',
                color: comment.is_deleted ? '#666' : '#ccc'
              }}>
                {comment.text}
              </p>
              
              {comment.is_edited && !comment.is_deleted && (
                <span style={styles.editedLabel}>(отредактировано)</span>
              )}
            </>
          )}
          
          {!comment.is_deleted && !isEditing && (
            <div style={styles.commentActions}>
              <button
                style={{
                  ...styles.commentAction,
                  color: likes.isLiked ? '#ff3b5c' : '#999'
                }}
                onClick={() => onLike(comment.id)}
              >
                <Heart size={14} fill={likes.isLiked ? '#ff3b5c' : 'none'} />
                <span>{likes.count}</span>
              </button>
              
              {depth < maxDepth && (
                <button style={styles.commentAction} onClick={() => onReply(comment)}>
                  Ответить
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginLeft: '30px', marginTop: '12px', position: 'relative', zIndex: 1 }}>
          {comment.replies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUser={currentUser}
              commentLikes={commentLikes}
              onLike={onLike}
              onReply={onReply}
              onDelete={onDelete}
              onEdit={onEdit}
              onReport={onReport}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
              editingComment={editingComment}
              editText={editText}
              setEditText={setEditText}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#121212',
    minHeight: '100vh',
    paddingBottom: '72px',
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
    lineHeight: 1.4,
  },
  body: {
    fontSize: '16px',
    color: '#ccc',
    lineHeight: 1.6,
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
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#fff',
  },
  commentMeta: {
    fontSize: '12px',
    color: '#666',
  },
  commentText: {
    fontSize: '15px',
    color: '#ccc',
    lineHeight: 1.5,
    marginBottom: '8px',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
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
    padding: '8px 12px',
    minHeight: '44px',
    minWidth: '44px',
    borderRadius: '8px',
    transition: 'background 0.2s',
  },
  menuButton: {
    background: 'none',
    border: 'none',
    color: '#999',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    minWidth: '32px',
    minHeight: '32px',
    transition: 'background 0.2s',
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '4px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    zIndex: 100,
    minWidth: '140px',
  },
  menuItem: {
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  loading: {
    textAlign: 'center',
    color: '#999',
    padding: '40px',
    fontSize: '16px',
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '8px',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  editTextarea: {
    width: '100%',
    maxWidth: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '15px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  editButtons: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end'
  },
  saveButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#8774e1',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  cancelEditButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #333',
    backgroundColor: 'transparent',
    color: '#999',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  editedLabel: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    marginTop: '4px',
    display: 'block'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: '16px',
    padding: '24px',
    width: '90%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '8px'
  },
  reportButton: {
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    backgroundColor: '#2a2a2a',
    color: '#fff',
    fontSize: '15px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.2s'
  },
  cancelButtonModal: {
    padding: '14px',
    borderRadius: '12px',
    border: '1px solid #333',
    backgroundColor: 'transparent',
    color: '#999',
    fontSize: '15px',
    cursor: 'pointer',
    marginTop: '8px'
  }
};

export default PostDetail;