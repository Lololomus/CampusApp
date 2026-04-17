import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Heart, MessageCircle, MapPin, Calendar,
  ChevronLeft, ChevronRight,
  Gift, Phone, Link2, Share2, Pencil, Trash2, Flag, CheckCircle
} from 'lucide-react';
import { getPost, getPostComments, createComment, likePost, likeComment, deleteComment, updateComment, deletePost, resolvePost, triggerRegistrationPrompt } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import BottomActionBar from '../BottomActionBar';
import DropdownMenu from '../DropdownMenu';
import { Z_MODAL_POST_DETAIL } from '../../constants/zIndex';
import theme from '../../theme';
import PollView from './PollView';
import PhotoViewer from '../shared/PhotoViewer';
import ReportModal from '../shared/ReportModal';
import Avatar from '../shared/Avatar';
import ProfileMiniCard from '../shared/ProfileMiniCard';
import { toast } from '../shared/Toast'; 
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import EdgeBlur from '../shared/EdgeBlur';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import OverflowMenuButton from '../shared/OverflowMenuButton';
import LinkText from '../shared/LinkText';
import { isEntityOwner, getEntityActionSet } from '../../utils/entityActions';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { parseApiDate, formatRelativeRu } from '../../utils/datetime';
import { composeSingleTextFromTitleBody } from '../../utils/contentTextParser';
import { IMAGE_ASPECT_RATIO_MIN, IMAGE_ASPECT_RATIO_MAX } from '../../constants/layoutConstants';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';
import { buildMiniAppStartappUrl } from '../../utils/deepLinks';
import { sharePostViaTelegram } from '../../utils/telegramShare';

const parseImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getImageUrl = (img) => {
  if (!img) return '';
  if (typeof img === 'object' && img.type === 'video') {
    return img.thumbnail_url ? resolveImageUrl(img.thumbnail_url, 'images') : '';
  }
  const filename = (typeof img === 'object') ? img.url : img;
  return resolveImageUrl(filename, 'images');
};

const formatPostDateForDetail = (value, nowValue = new Date()) => {
  const date = parseApiDate(value);
  const now = parseApiDate(nowValue) || new Date();
  if (!date) return '';

  const timePart = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dayNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((dayNow.getTime() - dayDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return `Сегодня в ${timePart}`;
  if (diffDays === 1) return `Вчера в ${timePart}`;
  return date.toLocaleDateString('ru-RU');
};

const alignPostWithLocalLikeState = (postData, localLikeValue, isRegistered) => {
  if (!postData || !isRegistered) return postData;
  if (typeof localLikeValue !== 'boolean') return postData;
  if (typeof postData.is_liked !== 'boolean') return postData;
  if (localLikeValue === postData.is_liked) return postData;

  const baseLikes = Number(postData.likes_count || 0);
  const adjustedLikes = Math.max(0, baseLikes + (localLikeValue ? 1 : -1));
  return { ...postData, is_liked: localLikeValue, likes_count: adjustedLikes };
};

function PostDetail() {
  const { viewPostId, setViewPostId, user, isRegistered, setUpdatedPost, likedPosts, setPostLiked, setEditingContent } = useStore();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentLikes, setCommentLikes] = useState({});
  const [localLikesCount, setLocalLikesCount] = useState(0);
  const [isLikeInFlight, setIsLikeInFlight] = useState(false);
  const isLiked = isRegistered
    ? (likedPosts[viewPostId] ?? post?.is_liked ?? false)
    : Boolean(post?.is_liked);

  const [replyTo, setReplyTo] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const postMenuRef = useRef(null);
  
  const [profileOpen, setProfileOpen] = useState(false);
  const avatarRef = useRef(null);

  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');
  const [commentReportTargetId, setCommentReportTargetId] = useState(null);
  const [replyToName, setReplyToName] = useState('');
  const [showPostReportModal, setShowPostReportModal] = useState(false);
  const [showPostAuthorReportModal, setShowPostAuthorReportModal] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [isResolved, setIsResolved] = useState(Boolean(post?.is_resolved));
  const [resolving, setResolving] = useState(false);
  const [commentViewer, setCommentViewer] = useState({ isOpen: false, photos: [], index: 0 });
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const closeTimeoutRef = useRef(null);
  const scrollContentRef = useRef(null);
  const commentsSectionRef = useRef(null);
  const lockedViewportHeightRef = useRef(
    typeof window !== 'undefined' ? Math.round(window.innerHeight || 0) : 0
  );

  const closeDetail = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    closeTimeoutRef.current = setTimeout(() => {
      setViewPostId(null);
    }, 340);
  }, [isExiting, setViewPostId]);

  const handleBack = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    closeDetail();
  }, [closeDetail, isExiting]);

  const handleResolve = async () => {
    if (resolving || isResolved || !post) return;
    setResolving(true);
    try {
      await resolvePost(post.id);
      setIsResolved(true);
      hapticFeedback('success');
    } catch {
      hapticFeedback('error');
    } finally {
      setResolving(false);
    }
  };

  useTelegramScreen({
    id: 'post-detail-screen',
    title: 'Пост',
    priority: 90,
    back: {
      visible: true,
      onClick: handleBack,
    },
  });

  useEffect(() => {
    if (viewPostId) {
      loadPost();
    }
  }, [viewPostId]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Блокировка скролла страницы пока PostDetail открыт
  useEffect(() => {
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, []);

  useEffect(() => {
    setLocalLikesCount(Number(post?.likes_count || 0));
  }, [post?.id, post?.likes_count]);

  const loadPost = async () => {
    if (!post) setLoading(true);

    try {
      const dataRaw = await getPost(viewPostId);
      const data = alignPostWithLocalLikeState(
        dataRaw,
        likedPosts[viewPostId],
        isRegistered
      );

      const imagesData = parseImages(data.images);
      setPost({ ...data, images: imagesData });

      try {
        const commentsData = await getPostComments(viewPostId);
        const commentsArray = Array.isArray(commentsData)
          ? commentsData.map((item) => ({ ...item, images: parseImages(item.images) }))
          : [];
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
      const freshRaw = await getPost(viewPostId);
      const fresh = alignPostWithLocalLikeState(
        freshRaw,
        likedPosts[viewPostId],
        isRegistered
      );
      const imagesData = parseImages(fresh.images);

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

  const viewerMeta = useMemo(() => ({
    author: post?.is_anonymous ? null : post?.author,
    caption: post?.title || post?.body,
  }), [post?.is_anonymous, post?.author, post?.title, post?.body]);

  const safeRatio = useMemo(() => {
    const firstImage = images.length > 0 ? images[0] : null;
    const meta = (typeof firstImage === 'object' && firstImage !== null) ? firstImage : null;
    const rawRatio = (meta?.w && meta?.h) ? meta.w / meta.h : 1;
    return Math.max(IMAGE_ASPECT_RATIO_MIN, Math.min(rawRatio, IMAGE_ASPECT_RATIO_MAX));
  }, [images]);

  const { dateText, isEdited } = useMemo(() => {
    if (!post) return { dateText: '', isEdited: false };
    const created = parseApiDate(post.created_at);
    if (!created) return { dateText: '', isEdited: false };

    const text = formatPostDateForDetail(created);
    const updated = parseApiDate(post.updated_at || post.created_at) || created;
    const edited = (updated.getTime() - created.getTime()) > 5 * 60 * 1000;
    return { dateText: text, isEdited: edited };
  }, [post?.created_at, post?.updated_at]);

  const eventDate = useMemo(() => parseApiDate(post?.event_date), [post?.event_date]);

  const catInfo = useMemo(() => {
    const tc = theme.colors.premium.tagColors;
    if (!post) return { label: '', color: theme.colors.text };
    switch(post.category) {
      case 'news':        return { label: 'Новости',     color: tc.news.color };
      case 'memes':       return { label: 'Мем',         color: tc.memes.color };
      case 'events':      return { label: 'Событие',     color: tc.events.color };
      case 'confessions': return { label: 'Подслушано',  color: tc.confessions.color };
      case 'lost_found':  return { label: 'Бюро',        color: tc.lostFound.color };
      case 'help':        return { label: 'Помощь',      color: tc.help.color };
      case 'polls': return post?.poll?.type === 'quiz'
        ? { label: 'Викторина', color: '#BF5AF2' }
        : { label: 'Опрос',     color: theme.colors.premium.primary };
      default: return { label: 'Пост', color: theme.colors.textSecondary };
    }
  }, [post?.category, post?.poll?.type]);

  const isOwner = useMemo(() => isEntityOwner('post', post, user), [post, user]);
  const postActionSet = useMemo(
    () => getEntityActionSet('post', isOwner, { shareEnabled: true }),
    [isOwner]
  );

  const authorMeta = useMemo(() => {
    return post && !post.is_anonymous && post.author
      ? [post.author.university, post.author.course ? `${post.author.course}к` : null]
          .filter(Boolean).join(' · ')
      : null;
  }, [post?.author, post?.is_anonymous]);

  const displayBody = useMemo(
    () => composeSingleTextFromTitleBody(post?.title, post?.body),
    [post?.title, post?.body]
  );

  const handleLike = async () => {
    if (!post || isLikeInFlight) return;
    if (!isRegistered) {
      hapticFeedback('light');
      triggerRegistrationPrompt('feed_like');
      return;
    }
    hapticFeedback('medium');
    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 500);

    const targetPostId = post.id;
    const prevCount = Number(localLikesCount || 0);
    const prevIsLiked = Boolean(isLiked);
    const newIsLiked = !prevIsLiked;
    const optimisticCount = Math.max(0, newIsLiked ? prevCount + 1 : prevCount - 1);

    setIsLikeInFlight(true);
    setPostLiked(targetPostId, newIsLiked);
    setLocalLikesCount(optimisticCount);
    setPost((p) => {
      if (!p || p.id !== targetPostId) return p;
      return { ...p, is_liked: newIsLiked, likes_count: optimisticCount };
    });

    try {
      const result = await likePost(targetPostId);
      const serverLikes = Number(result.likes || 0);
      setPostLiked(targetPostId, result.is_liked);
      setLocalLikesCount(serverLikes);
      setPost((p) => {
        if (!p || p.id !== targetPostId) return p;
        return { ...p, likes_count: serverLikes, is_liked: result.is_liked };
      });
      if (setUpdatedPost) {
        setUpdatedPost(targetPostId, { likes_count: serverLikes, is_liked: result.is_liked });
      }
    } catch (error) {
      setPostLiked(targetPostId, prevIsLiked);
      setLocalLikesCount(prevCount);
      setPost((p) => {
        if (!p || p.id !== targetPostId) return p;
        return { ...p, likes_count: prevCount, is_liked: prevIsLiked };
      });
    } finally {
      setIsLikeInFlight(false);
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
    const link = buildMiniAppStartappUrl(`post_${post.id}`);
    
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
    } catch (error) {
      toast.error('Не удалось скопировать ссылку');
    }
  };

  const handleShareLink = () => {
    setPostMenuOpen(false);
    hapticFeedback('light');
    try {
      sharePostViaTelegram(post);
    } catch (error) {
      console.error('Share post error:', error);
      toast.error('Не удалось открыть Telegram для отправки');
      hapticFeedback('error');
    }
  };

  const handleSendComment = async (text, files = []) => {
    const safeText = (text || '').trim();
    const safeFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!safeText && safeFiles.length === 0) return;
    try {
      const comment = await createComment(viewPostId, {
        body: safeText,
        parentId: replyTo,
        images: safeFiles,
      });
      const normalizedComment = { ...comment, images: parseImages(comment.images) };
      setComments(prev => [...prev, normalizedComment]);
      setCommentLikes(prev => ({ ...prev, [normalizedComment.id]: { isLiked: false, count: normalizedComment.likes || 0 } }));
      setReplyTo(null);
      setReplyToName('');
      await refreshPost();
    } catch (error) {
      console.error('Ошибка отправки комментария:', error);
      throw error;
    }
  };

  const handleCommentLike = async (commentId) => {
    hapticFeedback('light');
    try {
      const result = await likeComment(commentId);
      setCommentLikes(prev => ({ ...prev, [commentId]: { isLiked: result.is_liked, count: result.likes } }));
    } catch {
      // Keep the current optimistic state when a like request fails.
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
        setComments(prev => prev.filter(c => c.id !== commentId));
      } else {
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, body: 'Комментарий удалён', is_deleted: true, images: [] } : c));
      }
      await refreshPost();
    } catch {
      // The UI stays unchanged if deleting a comment fails.
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
    setCommentReportTargetId(commentId);
    setMenuOpen(null);
  };

  const openCommentImageViewer = (imagesList, index = 0) => {
    const photos = (imagesList || [])
      .map((item) => getImageUrl(item))
      .filter(Boolean);
    if (photos.length === 0) return;
    setCommentViewer({
      isOpen: true,
      photos,
      index: Math.max(0, Math.min(index, photos.length - 1)),
    });
  };

  const handleScrollToComments = useCallback(() => {
    const scrollNode = scrollContentRef.current;
    const commentsNode = commentsSectionRef.current;
    if (!scrollNode || !commentsNode) return;
    hapticFeedback('light');
    scrollNode.scrollTo({
      top: Math.max(0, commentsNode.offsetTop - 12),
      behavior: 'smooth',
    });
  }, []);

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
    ...(postActionSet.canShare ? [{
      label: 'Поделиться',
      icon: <Share2 size={16} />,
      actionType: 'share',
      onClick: handleShareLink
    }] : []),
    ...(postActionSet.canCopyLink ? [{
      label: 'Скопировать ссылку', 
      icon: <Link2 size={16} />,
      actionType: 'copy',
      onClick: handleCopyLink 
    }] : []),
    ...(postActionSet.canEdit ? [{
        label: 'Редактировать', 
        icon: <Pencil size={16} />,
        actionType: 'edit',
        onClick: handleEditPost 
      }] : []),
    ...(postActionSet.canDelete ? [{
        label: 'Удалить', 
        icon: <Trash2 size={16} />,
        actionType: 'delete',
        onClick: handleDeletePost 
      }] : []),
    ...(postActionSet.canReportContent ? [{
        label: 'Пожаловаться', 
        icon: <Flag size={16} />,
        actionType: 'report',
        onClick: () => { 
          hapticFeedback('light');
          setPostMenuOpen(false); 
          setShowPostReportModal(true);
        }
      }] : [])
  ];

  if (!viewPostId) return null;
  const containerStyle = {
    ...styles.container,
    bottom: 'auto',
    height: lockedViewportHeightRef.current
      ? `${lockedViewportHeightRef.current}px`
      : 'var(--tg-app-viewport-stable-height, 100lvh)',
    animation: isExiting
      ? 'pdSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
      : 'pdSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
    pointerEvents: isExiting ? 'none' : 'auto',
  };

  return (
    <>
      <style>{`
        @keyframes pdSlideIn {
          from { transform: translate3d(100%, 0, 0); }
          to { transform: translate3d(0, 0, 0); }
        }
        @keyframes pdSlideOut {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(100%, 0, 0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes heartBurst {
          0% { transform: scale(1); }
          40% { transform: scale(1.4) rotate(-10deg); }
          70% { transform: scale(0.9) rotate(5deg); }
          100% { transform: scale(1) rotate(0); }
        }
      `}</style>

      <EdgeSwipeBack
        onBack={() => setViewPostId(null)}
        disabled={isExiting || isPhotoViewerOpen}
        zIndex={Z_MODAL_POST_DETAIL}
      >
      <div style={containerStyle}>
        {/* Нижний блюр — поверх поля комментария */}
        <EdgeBlur position="bottom" height={90} zIndex={105} />

        <div ref={scrollContentRef} style={styles.scrollContent}>
          <DrilldownHeader
            title=""
            onBack={handleBack}
            showTitle={false}
            sticky={false}
            showDivider={false}
            background="#000000"
          />
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
                    <Avatar
                      ref={avatarRef}
                      user={post.author}
                      size={44}
                      onClick={() => !post.is_anonymous && post.author?.show_profile && setProfileOpen(true)}
                      showProfile={post.author?.show_profile}
                      isAnonymous={post.is_anonymous}
                    />

                    <div style={styles.authorInfo}>
                      <div style={styles.nameRow}>
                        <span style={styles.authorName}>
                          {post.is_anonymous ? 'Аноним' : (post.author?.username || post.author?.name || 'Пользователь')}
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
                    {isResolved && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#32D74B', background: 'rgba(50,215,75,0.15)', padding: '4px 8px', borderRadius: 8 }}>
                        <CheckCircle size={10} strokeWidth={2.5} /> Решено
                      </span>
                    )}
                    <OverflowMenuButton
                      ref={postMenuRef}
                      isOpen={postMenuOpen}
                      onToggle={() => setPostMenuOpen((prev) => !prev)}
                    />
                  </div>
                </div>
                
                {/* DropdownMenu вне relative контейнера */}
                <DropdownMenu
                  isOpen={postMenuOpen}
                  onClose={() => setPostMenuOpen(false)}
                  anchorRef={postMenuRef}
                  items={postMenuItems}
                />

                <div style={styles.textContent}>
                  {displayBody && (
                    <div style={{ marginTop: 0 }}>
                      <p style={styles.body}><LinkText text={displayBody} /></p>
                    </div>
                  )}
                </div>

                {post.poll && (
                  <div style={styles.pollWrapper}>
                    <PollView poll={post.poll} onVoteUpdate={refreshPost} showQuestion={post.category === 'polls'} />
                  </div>
                )}

                {(eventDate || post.lost_or_found || post.location || post.event_contact || post.reward_type) && (
                  <div style={styles.specialBlock}>
                    {eventDate && (
                      <div style={styles.specialItem}>
                        <Calendar size={14} />
                        <span>
                          {eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в {eventDate.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'})}
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

                {post.category === 'help' && isOwner && !isResolved && (
                  <button onClick={handleResolve} disabled={resolving} className="pressable" style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 4px', padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(50,215,75,0.3)', background: 'rgba(50,215,75,0.08)', color: '#32D74B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <CheckCircle size={14} strokeWidth={2} />
                    {resolving ? 'Отмечаем...' : 'Вопрос решён'}
                  </button>
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
                    {post.tags.map((t, i) => (
                      <span key={`${t}-${i}`} className="hashtag-chip">#{t}</span>
                    ))}
                  </div>
                )}

                <div style={styles.statsFooter}>
                  <div style={styles.footerLeft}>
                    <span style={styles.dateText}>{dateText}</span>
                    {isEdited && <span style={styles.editedLabel}>(изм.)</span>}
                  </div>

                  <div style={styles.footerRight}>
                    {/* Share — icon-only */}
                    <button
                      className="pressable"
                      style={styles.shareBtn}
                      onClick={(e) => { e.stopPropagation(); handleShareLink(); }}
                    >
                      <Share2 size={18} />
                    </button>

                    {/* Comments */}
                    <button
                      className="pressable"
                      style={styles.footerAction}
                      onClick={handleScrollToComments}
                    >
                      <MessageCircle size={18} strokeWidth={2.5} />
                      <span style={styles.statText}>{comments.length}</span>
                    </button>

                    {/* Likes */}
                    <button
                      className="pressable"
                      style={{ ...styles.footerAction, color: isLiked ? theme.colors.accent : theme.colors.text }}
                      onClick={handleLike}
                      disabled={isLikeInFlight}
                    >
                      <span style={{
                        display: 'inline-flex',
                        animation: isLikeAnimating ? 'heartBurst 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
                        willChange: isLikeAnimating ? 'transform' : 'auto',
                      }}>
                        <Heart
                          size={18}
                          fill={isLiked ? theme.colors.accent : 'none'}
                          color={isLiked ? theme.colors.accent : theme.colors.text}
                          strokeWidth={isLiked ? 0 : 2.5}
                        />
                      </span>
                      <span style={{ ...styles.statText, color: isLiked ? theme.colors.accent : theme.colors.text }}>
                        {localLikesCount}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <div ref={commentsSectionRef} style={styles.commentsSection}>
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
                        onOpenImage={openCommentImageViewer}
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
          replyTo={replyTo}
          replyToName={replyToName}
          onCancelReply={() => { setReplyTo(null); setReplyToName(''); }}
          disableKeyboardLift={Boolean(editingComment)}
          scrollLockTargetRef={scrollContentRef}
        />

        {isPhotoViewerOpen && (
          <PhotoViewer
            photos={images}
            initialIndex={currentImageIndex}
            onClose={() => setIsPhotoViewerOpen(false)}
            meta={viewerMeta}
          />
        )}

        {commentViewer.isOpen && (
          <PhotoViewer
            photos={commentViewer.photos}
            initialIndex={commentViewer.index}
            onClose={() => setCommentViewer({ isOpen: false, photos: [], index: 0 })}
          />
        )}

        <ReportModal
          isOpen={showPostReportModal}
          onClose={() => setShowPostReportModal(false)}
          targetType="post"
          targetId={post?.id}
        />
        <ReportModal
          isOpen={showPostAuthorReportModal}
          onClose={() => setShowPostAuthorReportModal(false)}
          targetType="user"
          targetId={post?.author?.id || post?.author_id}
          sourceType="post"
          sourceId={post?.id}
        />
        <ReportModal
          isOpen={!!commentReportTargetId}
          onClose={() => setCommentReportTargetId(null)}
          targetType="comment"
          targetId={commentReportTargetId}
        />
        
        {/* ProfileMiniCard для автора поста */}
        {!loading && post && !post.is_anonymous && post.author && (
          <ProfileMiniCard
            isOpen={profileOpen}
            onClose={() => setProfileOpen(false)}
            user={post.author}
            anchorRef={avatarRef}
            onReportUser={() => {
              const targetUserId = post.author?.id || post.author_id;
              if (!targetUserId || isOwner) return;
              setShowPostAuthorReportModal(true);
            }}
          />
        )}
      </div>
      </EdgeSwipeBack>
    </>
  );
}

const Comment = React.memo(({ comment, depth = 0, currentUser, commentLikes, onLike, onReply, onDelete, onEdit, onReport, menuOpen, setMenuOpen, editingComment, editText, setEditText, onSaveEdit, onCancelEdit, onOpenImage }) => {
  const menuButtonRef = useRef(null);
  const avatarRef = useRef(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  
  const likes = commentLikes[comment.id] || { isLiked: false, count: comment.likes || 0 };
  const maxDepth = 3;
  const isMyComment = isEntityOwner('comment', comment, currentUser);
  const isEditing = editingComment === comment.id;
  const commentCreatedAt = parseApiDate(comment.created_at);
  const commentUpdatedAt = parseApiDate(comment.updated_at || comment.created_at) || commentCreatedAt;
  const commentTimeText = commentCreatedAt ? formatRelativeRu(commentCreatedAt) : '';
  const isCommentEdited = Boolean(
    comment.is_edited
    || (commentCreatedAt && commentUpdatedAt && (commentUpdatedAt.getTime() - commentCreatedAt.getTime()) > 5 * 60 * 1000)
  );

  const isAnonymousComment = comment.is_anonymous || false;
  const commentAuthorName = isAnonymousComment
    ? (comment.anonymous_index === 0 || !comment.anonymous_index ? "Аноним" : `Аноним ${comment.anonymous_index}`)
    : (typeof comment.author === 'object' ? (comment.author.username || comment.author.name) : comment.author);

  const menuItems = isMyComment ? [
    { 
      icon: <Pencil size={16} />, 
      label: 'Редактировать',
      actionType: 'edit',
      onClick: () => onEdit(comment) 
    },
    { 
      icon: <Trash2 size={16} />, 
      label: 'Удалить',
      actionType: 'delete',
      onClick: () => onDelete(comment.id)
    },
  ] : [
    { 
      icon: <Flag size={16} />, 
      label: 'Пожаловаться',
      actionType: 'report',
      onClick: () => onReport(comment.id)
    },
  ];
    
  const commentImages = parseImages(comment.images);

  return (
    <div style={{ position: 'relative' }}>
      {comment.replies && comment.replies.length > 0 && (
        <div style={{
          position: 'absolute', left: 17.5, top: 36, bottom: -16, width: 2,
          backgroundColor: theme.colors.premium.border, zIndex: 0,
        }} />
      )}

      <div style={styles.comment}>
        {isAnonymousComment ? (
          <Avatar size={36} isAnonymous showProfile={false} />
        ) : (
          // Avatar компонент для обычных комментариев
          <Avatar 
            ref={avatarRef}
            user={comment.author}
            size={36}
            onClick={() => comment.author?.show_profile && setProfileOpen(true)}
            showProfile={comment.author?.show_profile}
          />
        )}

        <div style={styles.commentContent}>
          <div style={styles.commentHeader}>
            <div style={styles.commentHeaderMain}>
              <div style={styles.commentNameRow}>
                <span style={styles.commentAuthor}>{commentAuthorName}</span>
                {commentTimeText && (
                  <>
                    <span style={styles.commentNameDivider}>·</span>
                    <span style={styles.commentTime}>{commentTimeText}</span>
                  </>
                )}
                {!comment.is_deleted && !isEditing && isCommentEdited && (
                  <span style={styles.commentEdited}>(изм.)</span>
                )}
              </div>
              {!isAnonymousComment && comment.author?.university && (
                <span style={styles.commentMeta}>
                  {[comment.author?.university, comment.author?.course ? `${comment.author.course}к` : null].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {!comment.is_deleted && (
              <div style={{ marginLeft: 'auto', position: 'relative', flexShrink: 0 }}>
                <OverflowMenuButton
                  ref={menuButtonRef}
                  isOpen={menuOpen === comment.id}
                  onToggle={() => setMenuOpen(menuOpen === comment.id ? null : comment.id)}
                />
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
              <LinkText text={comment.body} />
            </p>
          )}

          {!comment.is_deleted && commentImages.length > 0 && (
            <div
              style={{
                ...styles.commentImages,
                gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, commentImages.length))}, minmax(0, 1fr))`,
              }}
            >
              {commentImages.map((img, idx) => {
                const url = getImageUrl(img);
                if (!url) return null;
                return (
                  <button
                    key={`${comment.id}-img-${idx}`}
                    style={styles.commentImageButton}
                    onClick={() => onOpenImage(commentImages, idx)}
                  >
                    <img src={url} alt="" style={styles.commentImage} />
                  </button>
                );
              })}
            </div>
          )}

          {!comment.is_deleted && !isEditing && (
            <div style={styles.commentActions}>
              {depth < maxDepth && (
                <button style={styles.commentAction} onClick={() => onReply(comment)}>Ответить</button>
              )}
              <button
                style={{ ...styles.commentAction, color: likes.isLiked ? theme.colors.accent : theme.colors.textTertiary }}
                onClick={() => onLike(comment.id)}
              >
                <Heart size={14} fill={likes.isLiked ? theme.colors.accent : 'none'} />
                <span>{likes.count}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginLeft: 28, marginTop: theme.spacing.md, position: 'relative', zIndex: 1 }}>
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
              onOpenImage={onOpenImage}
            />
          ))}
        </div>
      )}
      
      {/* ProfileMiniCard для комментариев */}
      {!isAnonymousComment && comment.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={comment.author}
          anchorRef={avatarRef}
          onReportUser={() => {
            const targetUserId = comment.author?.id || comment.author_id;
            if (!targetUserId || isMyComment) return;
            setShowUserReportModal(true);
          }}
        />
      )}
      <ReportModal
        isOpen={showUserReportModal}
        onClose={() => setShowUserReportModal(false)}
        targetType="user"
        targetId={comment.author?.id || comment.author_id}
        sourceType="comment"
        sourceId={comment.id}
      />
    </div>
  );
});

const styles = {
  container: {
    position: 'fixed',
    top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)',
    zIndex: Z_MODAL_POST_DETAIL,
    backgroundColor: theme.colors.premium.bg,
    display: 'flex',
    flexDirection: 'column',
    willChange: 'transform',
    transform: 'translate3d(0,0,0)',
    WebkitOverflowScrolling: 'touch',
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    paddingBottom: 190,
    WebkitOverflowScrolling: 'touch',
    overscrollBehaviorY: 'contain',
  },
  cardContent: {
    backgroundColor: theme.colors.premium.bg,
    borderBottom: `1px solid ${theme.colors.premium.border}`,
    marginBottom: theme.spacing.md,
  },
  authorSection: {
    padding: `20px ${theme.spacing.lg}px ${theme.spacing.xs + 2}px`,
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  authorRow: {
    display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0,
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
    fontSize: 16, fontWeight: theme.fontWeight.bold, color: theme.colors.text,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  pinned: { fontSize: 12 },
  authorMeta: {
    fontSize: 13, color: theme.colors.textTertiary, marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  headerRight: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0, paddingLeft: theme.spacing.sm,
  },
  categoryText: {
    fontSize: 12, fontWeight: theme.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  textContent: {
    padding: `0 ${theme.spacing.lg}px ${theme.spacing.md}px`,
  },
  title: {
    fontSize: 17, fontWeight: theme.fontWeight.bold, margin: '4px 0 2px', lineHeight: 1.3, color: theme.colors.text,
  },
  body: {
    fontSize: 15, lineHeight: 1.45, color: theme.colors.textSecondary, margin: 0,
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-word',
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
    width: 'calc(100% - 32px)',
    position: 'relative',
    backgroundColor: theme.colors.bg,
    margin: '0 16px 12px',
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.premium.border}`,
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
    padding: `0 ${theme.spacing.lg}px`, display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: 0
  },
  statsFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: `0 ${theme.spacing.lg}px 6px`,
    marginTop: 8,
    backgroundColor: theme.colors.premium.bg, minHeight: 36,
  },
  footerLeft: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0,
  },
  dateText: { fontSize: 12, color: theme.colors.premium.textMuted, fontWeight: theme.fontWeight.medium },
  editedLabel: { fontSize: 11, color: theme.colors.premium.textMuted, opacity: 0.7, fontStyle: 'italic' },
  footerRight: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  shareBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: theme.colors.premium.border, border: 'none',
    padding: '8px 12px', borderRadius: theme.radius.lg,
    color: theme.colors.text, cursor: 'pointer', flexShrink: 0,
  },
  readonlyMetricText: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.premium.textMuted,
    lineHeight: 1,
    minWidth: 14,
    textAlign: 'center',
  },
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    color: theme.colors.premium.textMuted,
    padding: '6px 10px',
    borderRadius: 16,
    border: `1px solid ${theme.colors.premium.border}`,
    backgroundColor: theme.colors.premium.surfaceElevated,
    fontWeight: 600,
  },
  footerAction: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    border: 'none',
    background: theme.colors.premium.border,
    padding: '8px 14px',
    cursor: 'pointer',
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.base,
  },
  statText: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.bold, minWidth: 14, textAlign: 'center', lineHeight: 1 },

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
  commentContent: { flex: 1, paddingLeft: 10, minWidth: 0 },
  commentHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  commentHeaderMain: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  commentNameRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' },
  commentAuthor: { fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  commentNameDivider: { fontSize: 12, color: theme.colors.textDisabled, lineHeight: 1 },
  commentMeta: { fontSize: theme.fontSize.xs, color: theme.colors.textDisabled, marginTop: 2 },
  commentTime: { fontSize: 12, color: theme.colors.textDisabled },
  commentEdited: {
    fontSize: 11,
    color: '#666666',
    opacity: 0.75,
    fontStyle: 'italic',
  },
  commentText: {
    margin: '4px 0 8px',
    fontSize: 14,
    lineHeight: 1.45,
    wordBreak: 'break-word', overflowWrap: 'break-word',
  },
  commentActions: { display: 'flex', gap: 16, alignItems: 'center' },
  commentAction: {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', color: theme.colors.textTertiary,
    fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0,
    transition: 'opacity 0.2s',
  },
  editForm: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  editTextarea: {
    width: '100%', padding: theme.spacing.md, borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.premium.border}`,
    backgroundColor: theme.colors.premium.surfaceElevated,
    color: theme.colors.text, fontSize: theme.fontSize.md, resize: 'vertical', outline: 'none',
    boxSizing: 'border-box',
  },
  editButtons: { display: 'flex', gap: theme.spacing.sm, justifyContent: 'flex-end' },
  saveButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`, borderRadius: theme.radius.sm,
    border: 'none', backgroundColor: theme.colors.premium.primary, color: theme.colors.premium.primaryText,
    fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer'
  },
  cancelEditButton: {
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`, borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.premium.border}`, backgroundColor: 'transparent',
    color: theme.colors.premium.textMuted, fontSize: theme.fontSize.base, fontWeight: theme.fontWeight.semibold, cursor: 'pointer'
  },
  commentImages: {
    display: 'grid',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  commentImageButton: {
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.premium.border}`,
    backgroundColor: theme.colors.premium.surfaceElevated,
    overflow: 'hidden',
    padding: 0,
    cursor: 'pointer',
  },
  commentImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  modalOverlay: {
    position: 'fixed', top: 0, bottom: 0, left: 'var(--app-fixed-left)', width: 'var(--app-fixed-width)', backgroundColor: theme.colors.overlay,
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
  },
  modalContent: {
    backgroundColor: theme.colors.bgSecondary, borderRadius: theme.radius.lg,
    padding: theme.spacing.xxl, width: 'calc(100% - 32px)', maxWidth: 'none', boxSizing: 'border-box',
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
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite', marginRight: theme.spacing.sm + 2,
  },
  skeletonTextShort: {
    height: 14, width: '40%', marginBottom: theme.spacing.xs + 2, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonTextMini: {
    height: 10, width: '20%', borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonTitle: {
    height: 20, width: '80%', marginBottom: theme.spacing.md, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonBody: {
    height: 14, width: '100%', marginBottom: theme.spacing.sm, borderRadius: theme.radius.xs,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
  skeletonImage: {
    width: '100%', aspectRatio: '16/9', borderRadius: theme.radius.md,
    background: `linear-gradient(90deg, ${theme.colors.premium.surfaceElevated} 25%, ${theme.colors.premium.surfaceHover} 50%, ${theme.colors.premium.surfaceElevated} 75%)`,
    backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite',
  },
};

export default PostDetail;
