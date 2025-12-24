import React, { useState, useEffect } from 'react';
import { ArrowLeft, Heart, MessageCircle, Eye, Send, MoreVertical, MapPin, Calendar, Clock } from 'lucide-react';
import { getPost, getPostComments, createComment, likePost, likeComment, deleteComment, updateComment, reportComment } from '../api';
import { useStore } from '../store';
import { hapticFeedback, showBackButton, hideBackButton } from '../utils/telegram';
import BottomActionBar from './BottomActionBar';
import { Z_MODAL_FORMS } from '../constants/zIndex';
import theme from '../theme';

function PostDetail() {
  const { viewPostId, setViewPostId, user, updatePost, setUpdatedPost, likedPosts, setPostLiked } = useStore();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentLikes, setCommentLikes] = useState({});
  const isLiked = likedPosts[viewPostId] ?? post?.is_liked ?? false;
  const [replyTo, setReplyTo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [reportingComment, setReportingComment] = useState(null);
  const [replyToName, setReplyToName] = useState('');

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

      try {
        const commentsData = await getPostComments(viewPostId);
        const commentsArray = Array.isArray(commentsData) ? commentsData : [];
        setComments(commentsArray);
        
        const initialLikes = {};
        commentsArray.forEach(comment => {
          initialLikes[comment.id] = {
            isLiked: comment.is_liked || false,
            count: comment.likes || 0
          };
        });
        setCommentLikes(initialLikes);
      } catch (error) {
        console.error('❌ Ошибка загрузки комментариев:', error);
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
      const fresh = await getPost(viewPostId);
      setPost(fresh);
      
      if (setUpdatedPost && viewPostId) {
        setUpdatedPost(viewPostId, { 
          comments_count: fresh.comments_count, 
          likes_count: fresh.likes_count, 
          views_count: fresh.views_count 
        });
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
    hapticFeedback('success');
    alert(`Отклик отправлен автору!\n\n"${text}"`);
  };

  const handleLike = async () => {
    hapticFeedback('light');
    
    const wasLiked = isLiked;
    const prevCount = post.likes_count || 0;
    const newIsLiked = !isLiked;
    
    setPostLiked(viewPostId, newIsLiked);
    setPost({ ...post, likes_count: newIsLiked ? prevCount + 1 : prevCount - 1 });
    
    try {
      const result = await likePost(post.id);
      setPostLiked(viewPostId, result.is_liked);
      setPost({ 
        ...post, 
        likes_count: result.likes,
        is_liked: result.is_liked
      });
      
      if (setUpdatedPost && viewPostId) {
        setUpdatedPost(viewPostId, { 
          comments_count: post.comments_count,
          likes_count: result.likes,
          views_count: post.views_count,
          is_liked: result.is_liked
        });
      }
    } catch (error) {
      console.error('Ошибка лайка:', error);
      setPostLiked(viewPostId, wasLiked);
      setPost({ ...post, likes_count: prevCount });
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

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Удалить комментарий?')) return;

    hapticFeedback('medium');
    setMenuOpen(null);

    try {
      const result = await deleteComment(commentId);

      if (result.type === 'hard_delete') {
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        setComments(comments.map(c =>
          c.id === commentId
            ? { ...c, body: 'Комментарий удалён', is_deleted: true }
            : c
        ));
      }

      await refreshPost();
      hapticFeedback('success');
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить комментарий');
    }
  };

  const handleEditComment = (comment) => {
    hapticFeedback('light');
    setEditingComment(comment.id);
    setEditText(comment.body);
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
          body: updated.body,
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
      'news': theme.colors.news,
      'events': theme.colors.events,
      'confessions': theme.colors.confessions,
      'lost_found': theme.colors.lostFound,
    };
    return colors[category] || theme.colors.textDisabled;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      'news': '📰 Новости',
      'events': '🎉 События',
      'confessions': '💭 Признания',
      'lost_found': '🔍 Находки',
    };
    return labels[category] || category;
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString('ru-RU', options);
  };

  const commentTree = buildCommentTree(comments);
  const isAnonymous = post.is_anonymous === true;
  const displayAuthorName = isAnonymous ? 'Аноним' : (typeof post.author === 'object' ? post.author.name : post.author);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Пост</span>
      </div>

      <div style={styles.content}>
        <div style={styles.authorSection}>
          <div style={{
            ...styles.avatar,
            backgroundColor: isAnonymous ? theme.colors.textDisabled : theme.colors.primary
          }}>
            {isAnonymous ? '?' : (typeof post.author === 'object' ? post.author.name[0] : post.author?.[0] || '?')}
          </div>
          <div style={styles.authorInfo}>
            <div style={styles.authorName}>
              {displayAuthorName}
            </div>
            {!isAnonymous && (post.author?.university || post.author?.institute || post.author?.course) && (
              <div style={styles.authorMeta}>
                {[
                  post.author?.university,
                  post.author?.institute,
                  post.author?.course ? `${post.author.course} курс` : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            )}
            <div style={styles.time}>{post.time}</div>
          </div>
        </div>

        <div
          style={{
            ...styles.category,
            backgroundColor: `${getCategoryColor(post.category)}20`,
            color: getCategoryColor(post.category),
          }}
        >
          {getCategoryLabel(post.category)}
          {post.category === 'news' && post.is_important && (
            <span style={styles.importantBadge}>⭐ Важное</span>
          )}
        </div>

        <h1 style={styles.title}>{post.title}</h1>
        <p style={styles.body}>{post.body}</p>

        {post.category === 'lost_found' && (
          <div style={styles.additionalInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>
                {post.lost_or_found === 'lost' ? '😢 Потеряно' : '🎉 Найдено'}:
              </span>
              <span style={styles.infoValue}>{post.item_description}</span>
            </div>
            {post.location && (
              <div style={styles.infoRow}>
                <MapPin size={16} style={{ color: theme.colors.lostFound }} />
                <span style={styles.infoValue}>{post.location}</span>
              </div>
            )}
          </div>
        )}

        {post.category === 'events' && (
          <div style={styles.additionalInfo}>
            {post.event_name && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Событие:</span>
                <span style={styles.infoValue}>{post.event_name}</span>
              </div>
            )}
            {post.event_date && (
              <div style={styles.infoRow}>
                <Calendar size={16} style={{ color: theme.colors.events }} />
                <span style={styles.infoValue}>{formatEventDate(post.event_date)}</span>
              </div>
            )}
            {post.event_location && (
              <div style={styles.infoRow}>
                <MapPin size={16} style={{ color: theme.colors.events }} />
                <span style={styles.infoValue}>{post.event_location}</span>
              </div>
            )}
          </div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div style={styles.tags}>
            {post.tags.map((tag, index) => (
              <span key={index} style={styles.tag}>#{tag}</span>
            ))}
          </div>
        )}

        <div style={styles.stats}>
          <button
            style={{
              ...styles.statButton,
              color: isLiked ? theme.colors.accent : theme.colors.textTertiary
            }}
            onClick={handleLike}
          >
            <Heart size={20} fill={isLiked ? theme.colors.accent : 'none'} />
            <span>{post.likes_count || 0}</span>
          </button>
          <div style={styles.statItem}>
            <MessageCircle size={20} />
            <span>{comments.length}</span>
          </div>
          <div style={styles.statItem}>
            <Eye size={20} />
            <span>{post.views_count || 0}</span>
          </div>
        </div>

        <div style={styles.commentsSection}>
          <h3 style={styles.commentsTitle}>Комментарии ({comments.length})</h3>

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
        postAuthorName={displayAuthorName}
      />

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
      {comment.replies && comment.replies.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 18,
            top: 36,
            bottom: 0,
            width: 2,
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
            {!comment.is_anonymous && (comment.author?.university || comment.author?.course) && (
              <span style={styles.commentMeta}>
                {[
                  comment.author?.university,
                  comment.author?.course ? `${comment.author.course} курс` : null
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
            
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
                color: comment.is_deleted ? theme.colors.textDisabled : theme.colors.textSecondary
              }}>
                {comment.body}
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
                  color: likes.isLiked ? theme.colors.accent : theme.colors.textTertiary
                }}
                onClick={() => onLike(comment.id)}
              >
                <Heart size={14} fill={likes.isLiked ? theme.colors.accent : 'none'} />
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

      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginLeft: 30, marginTop: theme.spacing.md, position: 'relative', zIndex: 1 }}>
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
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: Z_MODAL_FORMS,
    backgroundColor: theme.colors.bg,
    minHeight: '100vh',
    paddingBottom: 72,
    overflowY: 'auto',
  },
  header: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    backgroundColor: theme.colors.bgSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
    zIndex: 10,
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.text,
    cursor: 'pointer',
    padding: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  content: {
    padding: theme.spacing.lg,
  },
  authorSection: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    flexShrink: 0,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  authorMeta: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textTertiary,
    marginTop: 2,
  },
  time: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
    marginTop: theme.spacing.xs,
  },
  category: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `6px ${theme.spacing.md}px`,
    borderRadius: theme.radius.sm,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.lg,
  },
  importantBadge: {
    fontSize: theme.fontSize.xs,
    padding: `2px ${theme.spacing.sm}px`,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: theme.spacing.xs,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    lineHeight: 1.4,
  },
  body: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.textSecondary,
    lineHeight: 1.6,
    marginBottom: theme.spacing.lg,
  },
  additionalInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.radius.md,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.fontSize.base,
  },
  infoLabel: {
    color: theme.colors.textTertiary,
    fontWeight: theme.fontWeight.semibold,
  },
  infoValue: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.medium,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  tag: {
    fontSize: theme.fontSize.base,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.medium,
  },
  stats: {
    display: 'flex',
    gap: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  statButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: theme.fontSize.md,
    padding: theme.spacing.xs,
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    color: theme.colors.textDisabled,
    fontSize: theme.fontSize.md,
  },
  commentsSection: {
    marginTop: theme.spacing.xxl,
  },
  commentsTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  noComments: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: `40px ${theme.spacing.xl}px`,
  },
  noCommentsHint: {
    fontSize: theme.fontSize.base,
    color: theme.colors.textDisabled,
    marginTop: theme.spacing.sm,
  },
  commentsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  comment: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.textDisabled,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    flexShrink: 0,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  commentAuthor: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  commentMeta: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
  },
  commentText: {
    fontSize: theme.fontSize.md,
    lineHeight: 1.5,
    marginBottom: theme.spacing.sm,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
  },
  commentActions: {
    display: 'flex',
    gap: theme.spacing.lg,
  },
  commentAction: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    background: 'none',
    border: 'none',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.sm,
    cursor: 'pointer',
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    minHeight: 44,
    minWidth: 44,
    borderRadius: theme.radius.sm,
    transition: theme.transitions.normal,
  },
  menuButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    padding: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    minWidth: 32,
    minHeight: 32,
    transition: theme.transitions.normal,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.cardHover,
    borderRadius: theme.radius.sm,
    boxShadow: theme.shadows.lg,
    overflow: 'hidden',
    zIndex: 100,
    minWidth: 140,
  },
  menuItem: {
    width: '100%',
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    background: 'none',
    border: 'none',
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    cursor: 'pointer',
    textAlign: 'left',
    transition: theme.transitions.normal,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  loading: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: 40,
    fontSize: theme.fontSize.lg,
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  editTextarea: {
    width: '100%',
    maxWidth: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.card,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
  editButtons: {
    display: 'flex',
    gap: theme.spacing.sm,
    justifyContent: 'flex-end'
  },
  saveButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.sm,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer'
  },
  cancelEditButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer'
  },
  editedLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textDisabled,
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
    display: 'block'
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: theme.colors.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: theme.colors.bgSecondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl,
    width: '90%',
    maxWidth: 400,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm
  },
  reportButton: {
    padding: 14,
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.cardHover,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    cursor: 'pointer',
    textAlign: 'left',
    transition: theme.transitions.normal
  },
  cancelButtonModal: {
    padding: 14,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent',
    color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md,
    cursor: 'pointer',
    marginTop: theme.spacing.sm
  }
};

export default PostDetail;