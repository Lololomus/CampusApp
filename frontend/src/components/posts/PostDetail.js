import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft, Heart, MessageCircle, Eye, MapPin, Calendar,
  ChevronLeft, ChevronRight, MoreVertical, Link as LinkIcon,
  Gift, Phone, Trash2, Edit2, Flag
} from 'lucide-react';
import { getPost, getPostComments, createComment, likePost, likeComment, deleteComment, updateComment, reportComment, deletePost } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback, showBackButton, hideBackButton } from '../../utils/telegram';
import BottomActionBar from '../BottomActionBar';
import DropdownMenu from '../DropdownMenu';
import { Z_MODAL_FORMS } from '../../constants/zIndex';
import theme from '../../theme';
import PollView from './PollView';
import PhotoViewer from '../shared/PhotoViewer';
import { toast } from '../shared/Toast'; 

const API_URL = 'http://localhost:8000';

function PostDetail() {
  const { viewPostId, setViewPostId, user, setUpdatedPost, likedPosts, setPostLiked, setEditingContent } = useStore();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentLikes, setCommentLikes] = useState({});
  const isLiked = likedPosts[viewPostId] ?? post?.is_liked ?? false;

  const [replyTo, setReplyTo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const postMenuRef = useRef(null);

  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [reportingComment, setReportingComment] = useState(null);
  const [replyToName, setReplyToName] = useState('');

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  useEffect(() => {
    if (viewPostId) {
      loadPost();
      showBackButton(handleBack);
      return () => hideBackButton();
    }
  }, [viewPostId]);

  const loadPost = async () => {
    if (!post) setLoading(true);

    try {
      const data = await getPost(viewPostId);

      let imagesData = [];
      if (typeof data.images === 'string') {
        try { imagesData = JSON.parse(data.images); } catch (e) { imagesData = []; }
      } else {
        imagesData = data.images || [];
      }
      setPost({ ...data, images: imagesData });

      try {
        const commentsData = await getPostComments(viewPostId);
        const commentsArray = Array.isArray(commentsData) ? commentsData : [];
        setComments(commentsArray);

        const initialLikes = {};
        commentsArray.forEach(comment => {
          initialLikes[comment.id] = { isLiked: comment.is_liked || false, count: comment.likes || 0 };
        });
        setCommentLikes(initialLikes);
      } catch (error) {
        console.error('Comments error:', error);
      }
    } catch (error) {
      console.error('Post loading error:', error);
      toast.error('Не удалось загрузить пост');
    } finally {
      setLoading(false);
    }
  };

  const refreshPost = async () => {
    try {
      const fresh = await getPost(viewPostId);
      let imagesData = [];
      if (typeof fresh.images === 'string') {
        try { imagesData = JSON.parse(fresh.images); } catch (e) { imagesData = []; }
      } else { imagesData = fresh.images || []; }

      setPost({ ...fresh, images: imagesData });

      if (setUpdatedPost && viewPostId) {
        setUpdatedPost(viewPostId, {
          comments_count: fresh.comments_count,
          likes_count: fresh.likes_count,
          views_count: fresh.views_count
        });
      }
    } catch (e) { console.error('Silent update failed:', e); }
  };

  const images = useMemo(() => {
    if (!post || !post.images) return [];
    return post.images;
  }, [post]);

  const getImageUrl = (img) => {
    if (!img) return '';
    const filename = (typeof img === 'object') ? img.url : img;
    if (filename.startsWith('http')) return filename;
    return `${API_URL}/uploads/images/${filename}`;
  };

  const viewerPhotos = useMemo(() => images.map(img => getImageUrl(img)), [images]);

  const safeRatio = useMemo(() => {
    const firstImage = images.length > 0 ? images[0] : null;
    const meta = (typeof firstImage === 'object' && firstImage !== null) ? firstImage : null;
    const rawRatio = (meta?.w && meta?.h) ? meta.w / meta.h : 1;
    return Math.max(0.75, Math.min(rawRatio, 1.77));
  }, [images]);

  const { dateText, isEdited } = useMemo(() => {
    if (!post) return { dateText: '', isEdited: false };
    const created = new Date(post.created_at);
    const now = new Date();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let text = '';
    if (diffMins < 1) text = 'Только что';
    else if (diffMins < 60) text = `${diffMins}м назад`;
    else if (diffHours < 24) text = `${diffHours}ч назад`;
    else if (diffDays < 7) text = `${diffDays}д назад`;
    else text = created.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    const updated = new Date(post.updated_at || post.created_at);
    const edited = (updated - created) > 5 * 60 * 1000;
    return { dateText: text, isEdited: edited };
  }, [post?.created_at, post?.updated_at]);

  const catInfo = useMemo(() => {
    if (!post) return { label: '', color: theme.colors.text };
    switch(post.category) {
      case 'news': return { label: 'Новости', color: theme.colors.news };
      case 'events': return { label: 'Событие', color: theme.colors.events };
      case 'confessions': return { label: 'Подслушано', color: theme.colors.confessions };
      case 'lost_found': return { label: 'Бюро', color: theme.colors.lostFound };
      case 'polls': return { label: 'Опрос', color: theme.colors.primary };
      default: return { label: 'Пост', color: theme.colors.textSecondary };
    }
  }, [post?.category]);

  const isOwner = useMemo(() => {
    if (!user || !post) return false;
    const userId = user.id || user.user_id;
    const authorId = post.author_id;
    return (authorId && userId && String(authorId) === String(userId));
  }, [user, post?.author_id]);

  const authorMeta = useMemo(() => {
    return post && !post.is_anonymous && post.author
      ? [post.author.university, post.author.course ? `${post.author.course}к` : null]
          .filter(Boolean).join(' · ')
      : null;
  }, [post?.author, post?.is_anonymous]);

  const handleBack = () => {
    hapticFeedback('light');
    setViewPostId(null);
  };

  const handleLike = async () => {
    hapticFeedback('medium');
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 300);

    const prevCount = post.likes_count || 0;
    const newIsLiked = !isLiked;

    setPostLiked(viewPostId, newIsLiked);
    setPost(p => ({ ...p, likes_count: newIsLiked ? prevCount + 1 : prevCount - 1 }));

    try {
      const result = await likePost(post.id);
      setPostLiked(viewPostId, result.is_liked);
      setPost(p => ({ ...p, likes_count: result.likes, is_liked: result.is_liked }));
      if (setUpdatedPost) setUpdatedPost(viewPostId, { likes_count: result.likes, is_liked: result.is_liked });
    } catch (error) {
      setPostLiked(viewPostId, !newIsLiked);
      setPost(p => ({ ...p, likes_count: prevCount }));
    }
  };

  const handleEditPost = () => {
    setPostMenuOpen(false);
    hapticFeedback('light');
    setEditingContent(post, 'post');
  };

  const handleDeletePost = async () => {
    setPostMenuOpen(false);
    if (window.confirm('Удалить этот пост?')) {
      hapticFeedback('heavy');
      try {
        await deletePost(post.id);
        toast.success('Пост удалён');
        handleBack();
      } catch (error) {
        console.error('Ошибка удаления:', error);
        toast.error('Не удалось удалить пост');
      }
    }
  };

  const handleCopyLink = async () => {
    setPostMenuOpen(false);
    hapticFeedback('success');
    const link = `campusapp://post/${post.id}`;
    
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
    } catch (error) {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleSendComment = async (text) => {
    if (!text || !text.trim()) return;
    try {
      const comment = await createComment(viewPostId, text.trim(), replyTo);
      setComments(prev => [...prev, comment]);
      setCommentLikes(prev => ({ ...prev, [comment.id]: { isLiked: false, count: 0 } }));
      setReplyTo(null);
      await refreshPost();
    } catch (error) { 
  console.error('Ошибка отправки комментария:', error);
  toast.error('Не удалось отправить комментарий'); 
   }
  };

  const handleDirectSend = (text) => {
    hapticFeedback('success');
    alert(`Отклик отправлен автору!\n\n"${text}"`);
  };

  const handleCommentLike = async (commentId) => {
    hapticFeedback('light');
    try {
      const result = await likeComment(commentId);
      setCommentLikes(prev => ({ ...prev, [commentId]: { isLiked: result.is_liked, count: result.likes } }));
    } catch (error) {}
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
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, body: 'Комментарий удалён', is_deleted: true } : c));
      }
      await refreshPost();
    } catch (error) {}
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
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, body: updated.body, is_edited: true, updated_at: updated.updated_at } : c));
      setEditingComment(null);
      setEditText('');
    } catch (error) { 
  console.error('Ошибка редактирования:', error);
  toast.error('Не удалось отредактировать комментарий'); 
   }
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
      toast.success('Жалоба отправлена');
    } catch (error) {
      console.error('Ошибка отправки жалобы:', error);
      toast.error('Не удалось отправить жалобу');
    }
  };

  const commentTree = useMemo(() => {
    const commentMap = {};
    const roots = [];
    comments.forEach(c => { commentMap[c.id] = { ...c, replies: [] }; });
    comments.forEach(c => {
      if (c.parent_id && commentMap[c.parent_id]) {
        commentMap[c.parent_id].replies.push(commentMap[c.id]);
      } else { roots.push(commentMap[c.id]); }
    });
    return roots;
  }, [comments]);

  const postMenuItems = [
    { label: 'Скопировать ссылку', icon: <LinkIcon size={18} />, onClick: handleCopyLink },
    ...(isOwner ? [
      { label: 'Редактировать', icon: <Edit2 size={18} />, onClick: handleEditPost },
      { label: 'Удалить', icon: <Trash2 size={18} />, danger: true, onClick: handleDeletePost }
    ] : [
      { label: 'Пожаловаться', icon: <Flag size={18} />, danger: true, onClick: () => { 
        toast.success('Жалоба отправлена'); 
        setPostMenuOpen(false); 
      }}
    ])
  ];

  if (!viewPostId) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translate3d(100%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes likeBounce {
          0% { transform: scale(1); }
          40% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
      `}</style>

      <div style={styles.container}>
        <div style={styles.header}>
          <button onClick={handleBack} style={styles.backButton}>
            <ArrowLeft size={24} />
          </button>
          <span style={styles.headerTitle}>Пост</span>
        </div>

        <div style={styles.scrollContent}>
          {loading || !post ? (
            <div style={styles.cardContent}>
              <div style={styles.authorSection}>
                <div style={styles.skeletonAvatar} />
                <div style={{flex: 1}}>
                  <div style={styles.skeletonTextShort} />
                  <div style={styles.skeletonTextMini} />
                </div>
              </div>
              <div style={styles.textContent}>
                <div style={styles.skeletonTitle} />
                <div style={styles.skeletonBody} />
                <div style={styles.skeletonBody} />
              </div>
              <div style={styles.skeletonImage} />
            </div>
          ) : (
            <>
              <div style={styles.cardContent}>
                <div style={styles.authorSection}>
                  <div style={styles.authorRow}>
                    <div style={{
                      ...styles.avatar,
                      background: post.is_anonymous ? theme.colors.primary : `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`
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
                        ref={postMenuRef}
                        style={styles.menuButton}
                        onClick={(e) => { e.stopPropagation(); setPostMenuOpen(!postMenuOpen); hapticFeedback('light'); }}
                      >
                        <MoreVertical size={20} />
                      </button>
                      <DropdownMenu
                        isOpen={postMenuOpen}
                        onClose={() => setPostMenuOpen(false)}
                        anchorRef={postMenuRef}
                        items={postMenuItems}
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.textContent}>
                  {post.title && post.category !== 'polls' && (
                    <h3 style={styles.title}>{post.title}</h3>
                  )}
                  {post.body && (
                    <p style={styles.body}>{post.body}</p>
                  )}
                </div>

                {post.poll && (
                  <div style={styles.pollWrapper}>
                    <PollView poll={post.poll} onVoteUpdate={refreshPost} />
                  </div>
                )}

                {(post.event_date || post.lost_or_found || post.location || post.event_contact || post.reward_type) && (
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
                    {post.event_contact && (
                      <div style={styles.specialItem}>
                        <Phone size={14} />
                        <span>{post.event_contact}</span>
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
                    {post.reward_type && post.reward_type !== 'none' && (
                      <div style={{...styles.specialItem, color: theme.colors.success}}>
                        <Gift size={14} />
                        <span>Награда: {post.reward_value}</span>
                      </div>
                    )}
                  </div>
                )}

                {images.length > 0 && (
                  <div style={{...styles.imageContainer, aspectRatio: `${safeRatio}`}} onClick={() => { hapticFeedback('light'); setIsPhotoViewerOpen(true); }}>
                    <img
                      src={getImageUrl(images[currentImageIndex])}
                      alt=""
                      style={styles.image}
                    />
                    {images.length > 1 && (
                      <>
                        <div style={styles.imageCounter}>{currentImageIndex + 1}/{images.length}</div>
                        <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }} style={{...styles.navBtn, left: 10}}>
                          <ChevronLeft size={20}/>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }} style={{...styles.navBtn, right: 10}}>
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
                    {post.tags.map((t, i) => <span key={i} style={styles.tag}>#{t}</span>)}
                  </div>
                )}

                <div style={styles.statsFooter}>
                  <div style={styles.footerLeft}>
                    <span style={styles.dateText}>{dateText}</span>
                    {isEdited && <span style={styles.editedLabel}>(изм.)</span>}
                  </div>

                  <div style={styles.footerRight}>
                    <div style={styles.statItem}>
                      <Eye size={18} color={theme.colors.textTertiary} strokeWidth={2} />
                      <span style={styles.statText}>{post.views_count || 0}</span>
                    </div>
                    <div style={styles.statItem}>
                      <MessageCircle size={18} color={theme.colors.textSecondary} strokeWidth={2} />
                      <span style={{...styles.statText, color: theme.colors.textSecondary}}>
                        {comments.length}
                      </span>
                    </div>
                    <button
                      style={{
                        ...styles.footerAction,
                        animation: isLikeAnimating ? 'likeBounce 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none'
                      }}
                      onClick={handleLike}
                    >
                      <Heart
                        size={18}
                        fill={isLiked ? theme.colors.accent : 'none'}
                        color={isLiked ? theme.colors.accent : theme.colors.textSecondary}
                        strokeWidth={isLiked ? 0 : 2}
                      />
                      <span style={{
                        ...styles.statText,
                        color: isLiked ? theme.colors.accent : theme.colors.textSecondary
                      }}>
                        {post.likes_count || 0}
                      </span>
                    </button>
                  </div>
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
                        onCancelEdit={() => { setEditingComment(null); setEditText(''); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <BottomActionBar
          onCommentSend={handleSendComment}
          onDirectSend={handleDirectSend}
          replyTo={replyTo}
          replyToName={replyToName}
          onCancelReply={() => setReplyTo(null)}
          postAuthorName={post?.is_anonymous ? 'Аноним' : (post?.author?.name || 'Автор')}
          isAnonymousPost={post?.is_anonymous}
        />

        {reportingComment && (
          <div style={styles.modalOverlay} onClick={() => setReportingComment(null)}>
            <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>Причина жалобы</h3>
              <button onClick={() => { submitReport('spam'); }} style={styles.reportButton}>Спам</button>
              <button onClick={() => { submitReport('offensive'); }} style={styles.reportButton}>Оскорбления</button>
              <button onClick={() => setReportingComment(null)} style={styles.cancelButtonModal}>Отмена</button>
            </div>
          </div>
        )}

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

const Comment = React.memo(({ comment, depth = 0, currentUser, commentLikes, onLike, onReply, onDelete, onEdit, onReport, menuOpen, setMenuOpen, editingComment, editText, setEditText, onSaveEdit, onCancelEdit }) => {
  const menuButtonRef = useRef(null);
  const likes = commentLikes[comment.id] || { isLiked: false, count: comment.likes || 0 };
  const maxDepth = 3;
  const isMyComment = currentUser && comment.author_id === currentUser.id;
  const isEditing = editingComment === comment.id;

  const isAnonymousComment = comment.is_anonymous || false;
  const commentAuthorName = isAnonymousComment
    ? (comment.anonymous_index === 0 || !comment.anonymous_index ? "Аноним" : `Аноним ${comment.anonymous_index}`)
    : (typeof comment.author === 'object' ? comment.author.name : comment.author);
  const commentAuthorInitial = isAnonymousComment ? '?' : (typeof comment.author === 'object' ? comment.author.name?.[0] : comment.author?.[0] || '?');

  const menuItems = isMyComment ? [
    { icon: <Edit2 size={16}/>, label: 'Редактировать', onClick: () => onEdit(comment) },
    { icon: <Trash2 size={16}/>, label: 'Удалить', onClick: () => onDelete(comment.id), danger: true },
  ] : [
    { icon: <Flag size={16}/>, label: 'Пожаловаться', onClick: () => onReport(comment.id), danger: true },
  ];

  return (
    <div style={{ position: 'relative' }}>
      {comment.replies && comment.replies.length > 0 && (
        <div style={{
          position: 'absolute', left: 18, top: 36, bottom: 0, width: 2,
          backgroundColor: 'rgba(135, 116, 225, 0.25)', zIndex: 0,
        }} />
      )}

      <div style={styles.comment}>
        <div style={{
          ...styles.commentAvatar,
          background: isAnonymousComment ? theme.colors.textDisabled : `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`
        }}>
          {commentAuthorInitial}
        </div>

        <div style={styles.commentContent}>
          <div style={styles.commentHeader}>
            <span style={styles.commentAuthor}>{commentAuthorName}</span>
            {!isAnonymousComment && comment.author?.university && (
              <span style={styles.commentMeta}>
                {[comment.author?.university, comment.author?.course ? `${comment.author.course}к` : null].filter(Boolean).join(' · ')}
              </span>
            )}

            {!comment.is_deleted && (
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <button
                  ref={menuButtonRef}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === comment.id ? null : comment.id); }}
                  style={styles.menuButton}
                >
                  <MoreVertical size={16} />
                </button>
                <DropdownMenu
                  isOpen={menuOpen === comment.id} onClose={() => setMenuOpen(null)}
                  anchorRef={menuButtonRef} items={menuItems}
                />
              </div>
            )}
          </div>

          {isEditing ? (
            <div style={styles.editForm}>
              <textarea
                value={editText} onChange={(e) => setEditText(e.target.value)}
                style={styles.editTextarea} rows={3} autoFocus
              />
              <div style={styles.editButtons}>
                <button onClick={() => onSaveEdit(comment.id)} style={styles.saveButton}>Сохранить</button>
                <button onClick={onCancelEdit} style={styles.cancelEditButton}>Отмена</button>
              </div>
            </div>
          ) : (
            <p style={{
              ...styles.commentText,
              fontStyle: comment.is_deleted ? 'italic' : 'normal',
              color: comment.is_deleted ? theme.colors.textDisabled : theme.colors.textSecondary
            }}>
              {comment.body}
            </p>
          )}

          {!comment.is_deleted && !isEditing && (
            <div style={styles.commentActions}>
              <button
                style={{ ...styles.commentAction, color: likes.isLiked ? theme.colors.accent : theme.colors.textTertiary }}
                onClick={() => onLike(comment.id)}
              >
                <Heart size={14} fill={likes.isLiked ? theme.colors.accent : 'none'} />
                <span>{likes.count}</span>
              </button>

              {depth < maxDepth && (
                <button style={styles.commentAction} onClick={() => onReply(comment)}>Ответить</button>
              )}
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginLeft: 30, marginTop: theme.spacing.md, position: 'relative', zIndex: 1 }}>
          {comment.replies.map(reply => (
            <Comment
              key={reply.id} comment={reply} depth={depth + 1}
              currentUser={currentUser} commentLikes={commentLikes}
              onLike={onLike} onReply={onReply} onDelete={onDelete}
              onEdit={onEdit} onReport={onReport}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen} editingComment={editingComment}
              editText={editText} setEditText={setEditText}
              onSaveEdit={onSaveEdit} onCancelEdit={onCancelEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const styles = {
  container: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: Z_MODAL_FORMS,
    backgroundColor: theme.colors.bg,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1) forwards',
    willChange: 'transform',
    transform: 'translate3d(0,0,0)',
    WebkitOverflowScrolling: 'touch',
  },
  header: {
    position: 'sticky', top: 0,
    display: 'flex', alignItems: 'center', gap: theme.spacing.md,
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px`,
    backgroundColor: theme.colors.bgSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
    zIndex: 10,
    minHeight: 60,
  },
  backButton: {
    background: 'none', border: 'none', color: theme.colors.text,
    cursor: 'pointer', padding: theme.spacing.sm,
    display: 'flex', alignItems: 'center',
  },
  headerTitle: {
    fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text,
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 80,
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorY: 'contain',
  },
  cardContent: {
    backgroundColor: theme.colors.bgSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
    marginBottom: theme.spacing.md,
  },
  authorSection: {
    padding: `${theme.spacing.md}px ${theme.spacing.lg}px ${theme.spacing.xs + 2}px`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  authorRow: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm + 2, flex: 1, minWidth: 0,
  },
  avatar: {
    width: 40, height: 40, borderRadius: theme.radius.full,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: theme.colors.text, fontWeight: theme.fontWeight.bold, flexShrink: 0,
  },
  authorInfo: {
    display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0,
  },
  nameRow: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.xs
  },
  authorName: {
    fontSize: 15, fontWeight: theme.fontWeight.bold, color: theme.colors.text,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  pinned: { fontSize: 12 },
  authorMeta: {
    fontSize: 12, color: theme.colors.textTertiary, marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0, paddingLeft: theme.spacing.sm,
  },
  categoryText: {
    fontSize: 12, fontWeight: theme.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  menuButton: {
    padding: theme.spacing.xs + 2, background: 'transparent', border: 'none',
    color: theme.colors.textTertiary, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.full,
  },
  textContent: {
    padding: `${theme.spacing.xs}px ${theme.spacing.lg}px ${theme.spacing.md}px`,
  },
  title: {
    fontSize: 17, fontWeight: theme.fontWeight.bold, marginBottom: theme.spacing.xs + 2, lineHeight: 1.3, color: theme.colors.text,
  },
  body: {
    fontSize: 15, lineHeight: 1.5, color: theme.colors.textSecondary,
  },
  pollWrapper: { margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px` },
  specialBlock: {
    margin: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`, display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm,
  },
  specialItem: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.xs + 2, padding: `${theme.spacing.xs + 2}px ${theme.spacing.sm + 2}px`,
    background: theme.colors.elevated, borderRadius: theme.radius.sm,
    fontSize: 12, color: theme.colors.textSecondary, fontWeight: theme.fontWeight.medium
  },
  imageContainer: {
    width: '100%', position: 'relative', backgroundColor: theme.colors.bg, marginBottom: theme.spacing.md,
  },
  image: {
    width: '100%', height: '100%', objectFit: 'cover',
  },
  imageCounter: {
    position: 'absolute', top: theme.spacing.md, right: theme.spacing.md,
    background: theme.colors.overlayDark, color: theme.colors.text,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm + 2}px`, borderRadius: theme.radius.md, fontSize: 12, fontWeight: theme.fontWeight.bold
  },
  navBtn: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, borderRadius: theme.radius.full,
    background: theme.colors.overlay, color: theme.colors.text,
    border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', backdropFilter: 'blur(4px)'
  },
  dots: {
    position: 'absolute', bottom: theme.spacing.sm + 2, left: 0, right: 0,
    display: 'flex', justifyContent: 'center', gap: theme.spacing.xs + 2
  },
  dot: {
    width: 6, height: 6, borderRadius: theme.radius.full, background: theme.colors.text, transition: theme.transitions.fast
  },
  tags: {
    padding: `0 ${theme.spacing.lg}px`, display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md
  },
  tag: {
    color: theme.colors.primary, fontSize: 13, fontWeight: theme.fontWeight.medium
  },
  statsFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `${theme.spacing.sm + 2}px ${theme.spacing.lg}px`,
    backgroundColor: theme.colors.bgSecondary, minHeight: 48,
  },
  footerLeft: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0,
  },
  dateText: { fontSize: 12, color: theme.colors.textTertiary, fontWeight: theme.fontWeight.medium },
  editedLabel: { fontSize: 11, color: theme.colors.textTertiary, opacity: 0.7, fontStyle: 'italic' },
  footerRight: { display: 'flex', alignItems: 'center', gap: theme.spacing.lg },
  statItem: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, color: theme.colors.textTertiary },
  footerAction: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: theme.colors.textTertiary },
  statText: { fontSize: 14, fontWeight: theme.fontWeight.medium, color: theme.colors.textTertiary, minWidth: 14, textAlign: 'center', lineHeight: 1 },

  commentsSection: {
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.lg}px`,
  },
  commentsTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  noComments: {
    textAlign: 'center', color: theme.colors.textTertiary, padding: `${theme.spacing.xxl + 8}px ${theme.spacing.xl}px`,
  },
  noCommentsHint: {
    fontSize: theme.fontSize.base, color: theme.colors.textDisabled, marginTop: theme.spacing.sm,
  },
  commentsList: {
    display: 'flex', flexDirection: 'column', gap: theme.spacing.lg,
  },
  comment: { display: 'flex', gap: theme.spacing.md },
  commentAvatar: {
    width: 36, height: 36, borderRadius: theme.radius.full,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, color: theme.colors.text, flexShrink: 0,
  },
  commentContent: { flex: 1 },
  commentHeader: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs, flexWrap: 'wrap',
  },
  commentAuthor: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  commentMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textDisabled },
  commentText: {
    fontSize: theme.fontSize.md, lineHeight: 1.5, marginBottom: theme.spacing.sm,
    wordBreak: 'break-word', overflowWrap: 'break-word',
  },
  commentActions: { display: 'flex', gap: theme.spacing.lg },
  commentAction: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.xs,
    background: 'none', border: 'none', color: theme.colors.textTertiary,
    fontSize: theme.fontSize.sm, cursor: 'pointer', padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderRadius: theme.radius.sm,
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  editTextarea: {
    width: '100%', padding: theme.spacing.md, borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.card,
    color: theme.colors.text, fontSize: theme.fontSize.md, resize: 'vertical', outline: 'none',
  },
  editButtons: { display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' },
  saveButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`, borderRadius: theme.radius.sm,
    border: 'none', backgroundColor: theme.colors.primary, color: theme.colors.text,
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer'
  },
  cancelEditButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`, borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`, backgroundColor: 'transparent',
    color: theme.colors.textTertiary, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, backgroundColor: theme.colors.overlay,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modalContent: {
    backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl, width: '90%', maxWidth: 400,
    display: 'flex', flexDirection: 'column', gap: theme.spacing.md
  },
  modalTitle: { fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text, marginBottom: theme.spacing.sm },
  reportButton: {
    padding: 14, borderRadius: theme.radius.md, border: 'none',
    backgroundColor: theme.colors.cardHover, color: theme.colors.text,
    fontSize: theme.fontSize.md, cursor: 'pointer', textAlign: 'left',
  },
  cancelButtonModal: {
    padding: 14, borderRadius: theme.radius.md, border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent', color: theme.colors.textTertiary,
    fontSize: theme.fontSize.md, cursor: 'pointer', marginTop: theme.spacing.sm
  },

  skeletonAvatar: {
    width: 40, height: 40, borderRadius: theme.radius.full,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginRight: theme.spacing.sm + 2,
  },
  skeletonTextShort: {
    height: 14, width: '40%', marginBottom: theme.spacing.xs + 2, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonTextMini: {
    height: 10, width: '20%', borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonTitle: {
    height: 20, width: '80%', marginBottom: theme.spacing.md, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonBody: {
    height: 14, width: '100%', marginBottom: theme.spacing.sm, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonImage: {
    width: '100%', aspectRatio: '16/9', borderRadius: theme.radius.md,
    background: `linear-gradient(90deg, ${theme.colors.skeleton} 25%, ${theme.colors.skeletonHighlight} 50%, ${theme.colors.skeleton} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
};

export default PostDetail;