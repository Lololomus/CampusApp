import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Heart, MessageCircle, MapPin, Calendar, ArrowUpRight, Megaphone, Link, Share2, Edit2, Trash2, Flag, EyeOff, CheckCircle } from 'lucide-react';
import { MENU_ACTIONS } from '../../constants/contentConstants';
import { hapticFeedback } from '../../utils/telegram';
import { likePost, deletePost, trackAdImpression, trackAdClick, hideAd, unhideAd, triggerRegistrationPrompt, resolvePost } from '../../api';
import { useStore } from '../../store';
import theme from '../../theme';
import DropdownMenu from '../shared/DropdownMenu';
import OverflowMenuButton from '../shared/OverflowMenuButton';
import PollWidget from './PollWidget';
import LinkText from '../shared/LinkText';
import PhotoViewer from '../media/PhotoViewer';
import MediaGrid from '../media/MediaGrid';
import ReportModal from '../moderation/ReportModal';
import Avatar, { AVATAR_BORDER_RADIUS } from '../user/Avatar';
import ProfileMiniCard from '../user/ProfileMiniCard';
import { useModerationActions } from '../moderation/ModerationMenu';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { toast } from '../shared/Toast';
import { isEntityOwner, getEntityActionSet } from '../../utils/entityActions';
import { resolveImageUrl } from '../../utils/mediaUrl';
import { parseApiDate, formatRelativeRu } from '../../utils/datetime';
import { composeSingleTextFromTitleBody } from '../../utils/contentTextParser';
import { buildMiniAppStartappUrl } from '../../utils/deepLinks';
import { sharePostViaTelegram } from '../../utils/telegramShare';
import { Z_HEADER } from '../../constants/zIndex';

const FEED_HERO_RETURN_Z_INDEX = Z_HEADER - 2;

function getMediaHeroReturnZIndex(sourceEl) {
  if (!sourceEl || typeof window === 'undefined') return FEED_HERO_RETURN_Z_INDEX;

  let maxAncestorZIndex = null;
  let node = sourceEl.parentElement;
  while (node && node !== document.body) {
    const zIndex = Number.parseInt(window.getComputedStyle(node).zIndex, 10);
    if (Number.isFinite(zIndex) && zIndex >= Z_HEADER) {
      maxAncestorZIndex = Math.max(maxAncestorZIndex ?? zIndex, zIndex);
    }
    node = node.parentElement;
  }

  return maxAncestorZIndex ? maxAncestorZIndex + 1 : FEED_HERO_RETURN_Z_INDEX;
}

function PostCard({ post, onClick, onLikeUpdate, onPostDeleted, onAdHidden, onPostResolved, skipReveal, registerReveal }) {
  const { likedPosts, setPostLiked, user, setEditingContent, isRegistered, updatePost } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [isBodyExpanded, setIsBodyExpanded] = useState(false);
  const [isBodyOverflowing, setIsBodyOverflowing] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isResolved, setIsResolved] = useState(Boolean(post.is_resolved));
  useEffect(() => { setIsResolved(Boolean(post.is_resolved)); }, [post.is_resolved]);
  const [resolving, setResolving] = useState(false);
  const [showResolveConfirm, setShowResolveConfirm] = useState(false);
  const avatarRef = useRef(null);
  const cardRef = useRef(null);
  const bodyRef = useRef(null);
  const bodyWrapRef = useRef(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const impressionTracked = useRef(false);
  const [adHidden, setAdHidden] = useState(false);

  // ✅ Local state для likes_count
  const [localLikesCount, setLocalLikesCount] = useState(post.likes_count || 0);

  // Scroll-reveal: карточка вплывает при входе в viewport
  const [isRevealed, setIsRevealed] = useState(false);
  useEffect(() => {
    if (skipReveal) { setIsRevealed(true); return; }
    const card = cardRef.current;
    if (!card) return;

    if (registerReveal) {
      return registerReveal(card, () => setIsRevealed(true));
    }

    // Fallback для PostDetail и других контекстов без shared observer
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsRevealed(true); observer.unobserve(card); } },
      { threshold: 0, rootMargin: '50px' }
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [skipReveal, registerReveal]);

  // Синхронизируем локальный счетчик, когда пост обновился извне (например, лайк в PostDetail).
  useEffect(() => {
    setLocalLikesCount(post.likes_count || 0);
  }, [post.id, post.likes_count]);

  // Определяем, является ли пост рекламой
  const isAd = post.category === 'ad' || post._isAd;

  const images = useMemo(() => {
    if (!post.images) return [];
    if (Array.isArray(post.images)) return post.images;
    try { return JSON.parse(post.images); } catch { return []; }
  }, [post.images]);
  const hasTags = Array.isArray(post.tags) && post.tags.length > 0;

  const getImageUrl = (img) => {
    if (!img) return '';
    // Для видео показываем thumbnail, а не сам видео-файл
    if (typeof img === 'object' && img.type === 'video') {
      return img.thumbnail_url ? resolveImageUrl(img.thumbnail_url, 'images') : '';
    }
    const filename = (typeof img === 'object') ? img.url : img;
    return resolveImageUrl(filename, 'images');
  };

  const adImageUrl = useMemo(
    () => getImageUrl(images[0]),
    [images]
  );
  const [loadedImageMap, setLoadedImageMap] = useState({});
  const [failedImageMap, setFailedImageMap] = useState({});

  const markImageLoaded = (url) => {
    if (!url) return;
    const key = `${post.id}:${url}`;
    setLoadedImageMap((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    setFailedImageMap((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const markImageFailed = (url) => {
    if (!url) return;
    const key = `${post.id}:${url}`;
    setFailedImageMap((prev) => ({ ...prev, [key]: true }));
  };

  const adImageStateKey = adImageUrl ? `${post.id}:${adImageUrl}` : '';
  const isAdImageLoaded = adImageStateKey ? Boolean(loadedImageMap[adImageStateKey]) : false;
  const isAdImageError = !adImageUrl || Boolean(failedImageMap[adImageStateKey]);
  const isAdImageLoading = Boolean(adImageUrl) && !isAdImageLoaded && !isAdImageError;

  const viewerMeta = useMemo(() => ({
    author: post.is_anonymous ? null : post.author,
    caption: post.title || post.body,
  }), [post.is_anonymous, post.author, post.title, post.body]);

  const isLiked = isRegistered
    ? (likedPosts[post.id] ?? post.is_liked ?? false)
    : Boolean(post.is_liked);

  const isOwner = useMemo(() => {
    if (isAd) return false; // Реклама не "своя" в контексте редактирования
    return isEntityOwner('post', post, user);
  }, [user, post, isAd]);
  const actionSet = useMemo(
    () => getEntityActionSet('post', isOwner, { shareEnabled: true }),
    [isOwner]
  );

  // --- ЛОГИКА ЗАГОЛОВКА (АВТОР vs РЕКЛАМОДАТЕЛЬ) ---
  const headerInfo = useMemo(() => {
    if (isAd) {
      // Логика для РЕКЛАМЫ
      let subtitle = 'Спонсировано';
      if (post.scope === 'university') subtitle = `Для ${post.target_university || 'ВУЗа'}`;
      if (post.scope === 'city') subtitle = `Для г. ${post.target_city || 'твоего города'}`;
      
      return {
        name: post.advertiser_name || 'Реклама',
        avatarUrl: post.advertiser_logo, // Если null, покажем иконку
        subtitle: subtitle,
        isAd: true
      };
    } else {
      // Логика для ОБЫЧНОГО ПОСТА - используем USERNAME
      const displayName = post.is_anonymous 
        ? 'Аноним' 
        : (post.author?.username || post.author?.name || 'Пользователь');
      
      const subtitle = !post.is_anonymous && post.author
        ? [post.author.university, post.author.course ? `${post.author.course}к` : null].filter(Boolean).join(' · ')
        : null;
        
      return {
        name: displayName,
        author: post.author, // Добавляем для Avatar компонента
        subtitle: subtitle,
        isAd: false
      };
    }
  }, [post, isAd]);

  const { dateText, isEdited } = useMemo(() => {
    if (isAd) return { dateText: '', isEdited: false }; // У рекламы нет даты

    const created = parseApiDate(post.created_at);
    if (!created) return { dateText: '', isEdited: false };

    const dateText = formatRelativeRu(created);
    const updated = parseApiDate(post.updated_at || post.created_at) || created;
    const isEdited = (updated.getTime() - created.getTime()) > 5 * 60 * 1000;

    return { dateText, isEdited };
  }, [post.created_at, post.updated_at, isAd]);

  const eventDate = useMemo(() => parseApiDate(post.event_date), [post.event_date]);

  const specialMetaItems = useMemo(() => {
    if (isAd) return [];

    const items = [];

    if (eventDate) {
      items.push({
        key: 'event-date',
        icon: <Calendar size={14} />,
        text: `${eventDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${eventDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      });
    }

    const specialLocation =
      post.category === 'events'
        ? (post.event_location || post.location)
        : post.location;

    if (specialLocation) {
      items.push({
        key: 'location',
        icon: <MapPin size={14} />,
        text: specialLocation,
      });
    }

    if (post.lost_or_found) {
      const lostFoundLabel = post.lost_or_found === 'lost' ? 'Потерял' : 'Нашел';
      const lostFoundText = post.item_description
        ? `${lostFoundLabel}: ${post.item_description}`
        : lostFoundLabel;

      items.push({
        key: 'lost-found',
        icon: <span>{post.lost_or_found === 'lost' ? '🔍' : '🎁'}</span>,
        text: lostFoundText,
        style: post.lost_or_found === 'lost'
          ? {
              color: theme.colors.error,
              background: `${theme.colors.error}15`,
            }
          : {
              color: theme.colors.success,
              background: `${theme.colors.success}15`,
            },
      });
    }

    return items;
  }, [
    isAd,
    eventDate,
    post.category,
    post.event_location,
    post.location,
    post.lost_or_found,
    post.item_description,
  ]);

  const catInfo = useMemo(() => {
    const tc = theme.colors.premium.tagColors;
    if (isAd) return { label: 'Реклама', color: '#fff', bg: theme.colors.textTertiary, rotate: -5 };
    switch(post.category) {
      case 'general':     return { label: 'Без темы',    color: '#fff', bg: theme.colors.textTertiary,    rotate: -6 };
      case 'news':        return { label: 'Новости',     color: '#fff', bg: tc.news.color,                rotate: -8 };
      case 'memes':       return { label: 'Мем',         color: '#fff', bg: tc.memes.color,               rotate:  6 };
      case 'events':      return { label: 'Событие',     color: '#fff', bg: tc.events.color,              rotate: -5 };
      case 'confessions': return { label: 'Подслушано',  color: '#fff', bg: tc.confessions.color,         rotate:  9 };
      case 'lost_found':  return { label: 'Бюро',        color: '#fff', bg: tc.lostFound.color,           rotate: -7 };
      case 'help':        return { label: 'Помощь',      color: '#fff', bg: tc.help.color,                rotate:  5 };
      case 'polls':       return post.poll?.type === 'quiz'
        ? { label: 'Викторина', color: '#fff', bg: '#BF5AF2', rotate: -6 }
        : { label: 'Опрос',     color: '#000', bg: theme.colors.premium.primary, rotate:  7 };
      default:            return { label: 'Пост',        color: '#fff', bg: theme.colors.textSecondary,   rotate: -5 };
    }
  }, [post.category, isAd, post.poll?.type]);

  const displayBody = useMemo(
    () => composeSingleTextFromTitleBody(post.title, post.body),
    [post.title, post.body]
  );

  useEffect(() => {
    setIsBodyExpanded(false);
  }, [post.id]);

  useEffect(() => {
    if (!displayBody) {
      setIsBodyOverflowing(false);
      return undefined;
    }

    const updateBodyOverflow = () => {
      if (!bodyRef.current) {
        setIsBodyOverflowing(false);
        return;
      }
      const { scrollHeight, clientHeight } = bodyRef.current;
      setIsBodyOverflowing(scrollHeight - clientHeight > 1);
    };

    const frame = requestAnimationFrame(updateBodyOverflow);
    let resizeObserver = null;

    if (typeof ResizeObserver !== 'undefined' && bodyRef.current) {
      resizeObserver = new ResizeObserver(updateBodyOverflow);
      resizeObserver.observe(bodyRef.current);
    }

    return () => {
      cancelAnimationFrame(frame);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [displayBody, isBodyExpanded]);

  const handleExpand = useCallback((e) => {
    e.stopPropagation();
    const wrap = bodyWrapRef.current;
    const p = bodyRef.current;
    if (!wrap || !p) { setIsBodyExpanded(true); return; }

    // Замеряем сжатую высоту до снятия clamp
    const fromH = p.clientHeight;

    // Синхронно рендерим isExpanding=true — React снимает line-clamp через JSX
    flushSync(() => setIsExpanding(true));

    // Теперь p без clamp, измеряем полную высоту
    const toH = p.scrollHeight;

    // Фиксируем wrapper и запускаем анимацию
    wrap.style.height = `${fromH}px`;
    wrap.style.overflow = 'hidden';
    wrap.offsetHeight; // force reflow
    wrap.style.transition = 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    wrap.style.height = `${toH}px`;

    setTimeout(() => {
      wrap.style.height = '';
      wrap.style.overflow = '';
      wrap.style.transition = '';
      setIsBodyExpanded(true);
      setIsExpanding(false);
    }, 360);
  }, []);

  // ===== MODERATION HOOK =====
  const { moderationMenuItems, moderationModals } = useModerationActions({
    targetType: 'post',
    targetId: post.id,
    targetUserId: post.author_id,
    isPinned: post.is_important,
    onDeleted: () => { if (onPostDeleted) onPostDeleted(post.id); },
    onPinToggled: (pinned) => { /* parent refresh */ },
  });

  // ===== AD TRACKING =====
  // Трекаем просмотр только когда реклама реально появляется на экране (≥50% видимости)
  useEffect(() => {
    if (!isAd || !post.ad_id || !cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !impressionTracked.current) {
          impressionTracked.current = true;
          trackAdImpression(post.ad_id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [isAd, post.ad_id]);

  const handleCtaClick = (e) => {
    e.stopPropagation();
    if (isAd && post.cta_url) {
      hapticFeedback('light');
      if (post.ad_id) trackAdClick(post.ad_id);
      window.open(post.cta_url, '_blank');
    }
  };

  const handleHideAd = async () => {
    setMenuOpen(false);
    hapticFeedback('light');
    setAdHidden(true);
    if (post.ad_id) await hideAd(post.ad_id);
    if (onAdHidden) onAdHidden(post.ad_id);
  };

  const handleUnhideAd = async (e) => {
    e.stopPropagation();
    setAdHidden(false);
    if (post.ad_id) await unhideAd(post.ad_id);
  };

  const handleCardClick = () => {
    if (isAd) return; // На рекламу клик не открывает детальный вид
    if (onClick) onClick(post.id);
  };

  const handleResolve = async () => {
    if (resolving || isResolved) return;
    setShowResolveConfirm(false);
    setResolving(true);
    try {
      await resolvePost(post.id);
      setIsResolved(true);
      updatePost(post.id, { is_resolved: true });
      hapticFeedback('success');
      if (onPostResolved) onPostResolved(post.id);
    } catch {
      hapticFeedback('error');
    } finally {
      setResolving(false);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    if (!isRegistered) {
      hapticFeedback('light');
      triggerRegistrationPrompt('feed_like');
      return;
    }
    hapticFeedback('medium');

    setIsLikeAnimating(true);
    setTimeout(() => setIsLikeAnimating(false), 500);

    const newIsLiked = !isLiked;
    setPostLiked(post.id, newIsLiked);
    setLocalLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      const result = await likePost(post.id);
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
      setPostLiked(post.id, isLiked);
      setLocalLikesCount(post.likes_count || 0);
    }
  };

  const handleEdit = () => {
    setMenuOpen(false);
    hapticFeedback('light');
    setEditingContent(post, 'post');
  };

  const handleDelete = () => {
    setMenuOpen(false);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (deleting) return;

    setDeleting(true);
    hapticFeedback('heavy');
    try {
      await deletePost(post.id);
      if (onPostDeleted) onPostDeleted(post.id);
      toast.success('Пост удален');
      hapticFeedback('success');
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Delete post error:', error);
      toast.error('Ошибка удаления поста');
      hapticFeedback('error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    const link = buildMiniAppStartappUrl(`post_${post.id}`);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
      hapticFeedback('success');
    } catch (error) {
      console.error('Copy link error:', error);
      toast.error('Не удалось скопировать ссылку');
      hapticFeedback('error');
    }
  };

  const handleShareLink = () => {
    setMenuOpen(false);
    hapticFeedback('light');
    try {
      sharePostViaTelegram(post);
    } catch (error) {
      console.error('Share post error:', error);
      toast.error('Не удалось открыть Telegram для отправки');
      hapticFeedback('error');
    }
  };

  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [viewerActiveIndex, setViewerActiveIndex] = useState(null);
  const [viewerSourceRect, setViewerSourceRect] = useState(null);
  const handleMediaItemClick = useCallback((index, rect) => {
    hapticFeedback('light');
    setViewerSourceRect(rect || null);
    setViewerStartIndex(index);
    setViewerActiveIndex(index);
    setIsPhotoViewerOpen(true);
  }, []);
  const resolveViewerSourceRect = useCallback((index) => {
    const sourceEl = cardRef.current?.querySelector(`[data-media-grid-index="${index}"]`);
    if (!sourceEl) return index === viewerStartIndex ? viewerSourceRect : null;

    const rect = sourceEl.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      objectFit: sourceEl.dataset.mediaFit || viewerSourceRect?.objectFit,
      objectPosition: 'center center',
      hasContainFill: sourceEl.dataset.mediaFit === 'contain',
      zIndex: getMediaHeroReturnZIndex(sourceEl),
    };
  }, [viewerStartIndex, viewerSourceRect]);
  const handlePhotoViewerClose = useCallback(() => {
    setIsPhotoViewerOpen(false);
    setViewerActiveIndex(null);
    setViewerSourceRect(null);
  }, []);

  const menuItems = isAd ? [
    {
      label: 'Поделиться',
      icon: <Share2 size={18} />,
      onClick: handleShareLink,
      actionType: MENU_ACTIONS.SHARE,
    },
    {
      label: 'Скопировать ссылку',
      icon: <Link size={18} />,
      onClick: handleCopyLink,
      actionType: MENU_ACTIONS.COPY,
    },
    {
      label: 'Скрыть это объявление',
      icon: <EyeOff size={18} />,
      onClick: handleHideAd,
      actionType: MENU_ACTIONS.HIDE,
    },
    {
      label: 'Пожаловаться на рекламу',
      icon: <Flag size={18} />,
      onClick: () => { setMenuOpen(false); setShowReportModal(true); },
      actionType: MENU_ACTIONS.REPORT,
    },
  ] : [
    ...(actionSet.canShare ? [{
      label: 'Поделиться',
      icon: <Share2 size={18} />,
      onClick: handleShareLink,
      actionType: MENU_ACTIONS.SHARE
    }] : []),
    ...(actionSet.canCopyLink ? [{
      label: 'Скопировать ссылку',
      icon: <Link size={18} />,
      onClick: handleCopyLink,
      actionType: MENU_ACTIONS.COPY
    }] : []),
    ...(actionSet.canEdit ? [{
      label: 'Редактировать',
      icon: <Edit2 size={18} />,
      onClick: handleEdit,
      actionType: MENU_ACTIONS.EDIT
    }] : []),
    ...(actionSet.canDelete ? [{
      label: 'Удалить',
      icon: <Trash2 size={18} />,
      onClick: handleDelete,
      actionType: MENU_ACTIONS.DELETE
    }] : []),
    ...(actionSet.canReportContent ? [{
      label: 'Пожаловаться',
      icon: <Flag size={18} />,
      onClick: () => { setMenuOpen(false); setShowReportModal(true); },
      actionType: MENU_ACTIONS.REPORT
    }] : []),
    ...moderationMenuItems,
  ];

  // Скрытый баннер для рекламы
  if (adHidden) {
    return (
      <div style={styles.hiddenAdBanner}>
        <span style={{ fontSize: 14, color: theme.colors.textMuted }}>Объявление скрыто</span>
        <button
          onClick={handleUnhideAd}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: theme.colors.premium.primary, fontWeight: 600, padding: '4px 0' }}
        >
          Отменить
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes heartBurst {
          0% { transform: scale(1); }
          40% { transform: scale(1.4) rotate(-10deg); }
          70% { transform: scale(0.9) rotate(5deg); }
          100% { transform: scale(1) rotate(0); }
        }
        @keyframes imageShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        ref={cardRef}
        style={{
          ...styles.card,
          opacity: isRevealed ? 1 : 0,
          transform: isRevealed ? 'none' : 'translateY(24px) scale(0.97)',
        }}
        onClick={handleCardClick}
      >

        {/* === БЕЙДЖ КАТЕГОРИИ (штамп поверх карточки) === */}
        {!isAd && post.category && post.category !== 'general' && (
          <span style={{ ...styles.categoryBadge, color: catInfo.color, background: catInfo.bg, transform: `rotate(${catInfo.rotate}deg)` }}>
            {catInfo.label}
          </span>
        )}

        {/* === HEADER: аватар + имя + меню (одна строка) === */}
        <div style={styles.header}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Аватар */}
            {isAd ? (
              <div style={{ ...styles.avatar, background: theme.colors.surfaceElevated, border: '1px solid rgba(255,255,255,0.05)' }}>
                {headerInfo.avatarUrl ? (
                  <img
                    src={headerInfo.avatarUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: AVATAR_BORDER_RADIUS, objectFit: 'cover' }}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <Megaphone size={18} color="#FFFFFF" />
                )}
              </div>
            ) : (
              <Avatar
                ref={avatarRef}
                user={headerInfo.author}
                size={44}
                onClick={() => !post.is_anonymous && post.author?.show_profile && setProfileOpen(true)}
                showProfile={post.author?.show_profile}
                isAnonymous={post.is_anonymous}
              />
            )}
            {/* Имя + подзаголовок */}
            <div style={styles.nameMetaBlock}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={styles.authorName}>{headerInfo.name}</span>
                {post.is_important && !isAd && <span style={styles.pinned}>📌</span>}
              </div>
              {headerInfo.subtitle && (
                <span style={styles.authorMeta}>{headerInfo.subtitle}</span>
              )}
            </div>
          </div>

          <div style={styles.headerRight}>
            {isAd && (
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '4px 8px', borderRadius: 6,
              }}>
                Реклама
              </span>
            )}
            {!isAd && isResolved && (
              <span style={styles.resolvedBadge}>
                <CheckCircle size={10} strokeWidth={2.5} /> Решено
              </span>
            )}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <OverflowMenuButton
                ref={menuButtonRef}
                isOpen={menuOpen}
                onToggle={() => setMenuOpen((prev) => !prev)}
              />
              <DropdownMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuButtonRef}
                items={menuItems}
              />
            </div>
          </div>
        </div>

        {/* === КОНТЕНТ: текст + опрос === */}
        {(displayBody || specialMetaItems.length > 0 || post.poll) && (
          <div style={styles.content}>
            {displayBody && (
              <div style={{ marginTop: 0 }}>
                <div ref={bodyWrapRef} style={styles.bodyWrap}>
                  <p
                    ref={bodyRef}
                    style={{
                      ...styles.body,
                      WebkitLineClamp: (isBodyExpanded || isExpanding) ? 'unset' : 4,
                      overflow: (isBodyExpanded || isExpanding) ? 'visible' : 'hidden',
                    }}
                  >
                    <span onClick={e => e.stopPropagation()}><LinkText text={displayBody} /></span>
                  </p>
                  {!isBodyExpanded && !isExpanding && isBodyOverflowing && (
                    <div style={styles.bodyBottomFade} />
                  )}
                </div>
                {!isBodyExpanded && !isExpanding && isBodyOverflowing && (
                  <button
                    onClick={handleExpand}
                    style={styles.expandButton}
                  >
                    Показать всё
                  </button>
                )}
              </div>
            )}
            {specialMetaItems.length > 0 && (
              <div style={styles.specialBlock}>
                {specialMetaItems.map((meta) => (
                  <div key={meta.key} style={{ ...styles.specialItem, ...(meta.style || {}) }}>
                    {meta.icon}
                    <span>{meta.text}</span>
                  </div>
                ))}
              </div>
            )}
            {post.poll && (
              <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
                <PollWidget poll={post.poll} postId={post.id} showQuestion={post.category === 'polls'} />
              </div>
            )}
          </div>
        )}
        {/* Строчка «Вопрос решён?» — только автору, только для help-постов */}
        {!isAd && post.category === 'help' && isOwner && !isResolved && (
          <button
            onClick={(e) => { e.stopPropagation(); hapticFeedback('light'); setShowResolveConfirm(true); }}
            disabled={resolving}
            style={styles.resolveHint}
            className="pressable"
          >
            {resolving ? 'Отмечаем...' : 'Вопрос решён?'}
          </button>
        )}

        <div onClick={e => e.stopPropagation()}>
          <ConfirmationDialog
            isOpen={showResolveConfirm}
            title="Вопрос решён?"
            message={'Отметьте его — это покажет другим, что ответ уже найден, и они не будут беспокоить вас впустую.'}
            confirmText="Да, решён"
            cancelText="Нет"
            confirmType="primary"
            onConfirm={handleResolve}
            onCancel={() => setShowResolveConfirm(false)}
          />
        </div>

        {images.length > 0 && (
          isAd ? (
            // Для рекламы: простая картинка с отступами и скруглением по моку
            <div style={styles.adImageContainer}>
              {isAdImageLoading && <div style={styles.imageSkeleton} />}
              {isAdImageError && <div style={styles.imageFallback}>Фото недоступно</div>}
              <img
                src={adImageUrl}
                alt=""
                style={{
                  ...styles.adImage,
                  opacity: (isAdImageLoading || isAdImageError) ? 0 : 1,
                  transition: 'opacity 0.2s ease',
                }}
                loading="lazy"
                decoding="async"
                onLoad={() => markImageLoaded(adImageUrl)}
                onError={() => markImageFailed(adImageUrl)}
              />
            </div>
          ) : (
            <div style={styles.mediaBleed}>
              <MediaGrid
                mediaItems={images}
                onItemClick={handleMediaItemClick}
                containerStyle={{ borderRadius: 0, border: 'none' }}
                hiddenIndex={isPhotoViewerOpen ? viewerActiveIndex : null}
              />
            </div>
          )
        )}

        {/* === CTA BUTTON (AD ONLY) === */}
        {isAd && post.cta_text && (
          <div style={{ padding: '4px 0 14px' }}>
            <button onClick={handleCtaClick} style={styles.ctaButton}>
              {post.cta_text} <ArrowUpRight size={18} strokeWidth={2.5} color="rgba(255,255,255,0.7)" />
            </button>
          </div>
        )}

        {hasTags && (
          <div style={styles.tags}>
            {post.tags.slice(0, 3).map((t, index) => (
              <span key={`${t}-${index}`} className="hashtag-chip">#{t}</span>
            ))}
          </div>
        )}

        {/* === FOOTER (СКРЫТ ДЛЯ РЕКЛАМЫ) === */}
        {!isAd && (
          <div style={{ ...styles.footer, marginTop: hasTags ? 10 : styles.footer.marginTop }}>
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
                style={styles.metricPill}
                onClick={(e) => { e.stopPropagation(); if(onClick) onClick(post.id); }}
              >
                <MessageCircle size={18} strokeWidth={2.5} />
                <span>{post.comments_count || 0}</span>
              </button>

              {/* Likes */}
              <button
                className="pressable"
                style={{ ...styles.metricPill, color: isLiked ? theme.colors.accent : theme.colors.text }}
                onClick={handleLike}
              >
                <span style={{
                  display: 'inline-flex',
                  animation: isLikeAnimating ? 'heartBurst 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'none',
                  willChange: isLikeAnimating ? 'transform' : 'auto',
                }}>
                  <Heart
                    size={18}
                    fill={isLiked ? theme.colors.accent : 'none'}
                    strokeWidth={isLiked ? 0 : 2.5}
                  />
                </span>
                <span>{localLikesCount}</span>
              </button>
            </div>
          </div>
        )}

        {isPhotoViewerOpen && (
          <PhotoViewer
            photos={images}
            initialIndex={viewerStartIndex}
            onClose={handlePhotoViewerClose}
            meta={viewerMeta}
            sourceRect={viewerSourceRect}
            sourceRectProvider={resolveViewerSourceRect}
            onIndexChange={setViewerActiveIndex}
          />
        )}
      </div>

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType={isAd ? 'ad' : 'post'}
        targetId={isAd ? post.ad_id : post.id}
      />
      <ReportModal
        isOpen={showUserReportModal}
        onClose={() => setShowUserReportModal(false)}
        targetType="user"
        targetId={post.author?.id || post.author_id}
        sourceType="post"
        sourceId={post.id}
      />
      <ConfirmationDialog
        isOpen={showDeleteDialog}
        title="Удалить пост?"
        message="Это действие нельзя отменить."
        confirmText={deleting ? 'Удаление...' : 'Удалить'}
        confirmType="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setShowDeleteDialog(false);
        }}
      />

      {moderationModals}
      
      {/* Мини-карточка профиля */}
      {!post.is_anonymous && post.author && (
        <ProfileMiniCard
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={post.author}
          anchorRef={avatarRef}
          onReportUser={() => {
            const targetUserId = post.author?.id || post.author_id;
            if (!targetUserId || isOwner) return;
            setShowUserReportModal(true);
          }}
        />
      )}
    </>
  );
}

const styles = {
  card: {
    borderRadius: theme.radius.xl,
    margin: '0 0 12px',
    padding: '20px 20px 10px',
    position: 'relative',
    cursor: 'pointer',
    background: theme.colors.premium.surfaceElevated,
    boxShadow: '0 16px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
    border: `1px solid ${theme.colors.premium.border}`,
    WebkitTapHighlightColor: 'transparent',
    transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
    willChange: 'opacity, transform',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameMetaBlock: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 16,
    fontWeight: 800,
    letterSpacing: '-0.3px',
    color: theme.colors.text,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  pinned: { fontSize: 12 },
  authorMeta: {
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.premium.textMuted,
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    paddingLeft: 8,
  },
  resolvedBadge: {
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
    padding: '4px 8px', borderRadius: theme.radius.md,
    color: '#32D74B', background: 'rgba(50,215,75,0.15)',
  },
  categoryBadge: {
    position: 'absolute',
    top: -11,
    right: 16,
    fontSize: 11,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '4px 10px',
    borderRadius: theme.radius.md,
    zIndex: 2,
    pointerEvents: 'none',
  },
  resolveHint: {
    display: 'inline-flex',
    alignItems: 'center',
    margin: '6px 0 2px',
    padding: '4px 0',
    background: 'none',
    border: 'none',
    borderBottom: '1px dashed rgba(255,255,255,0.2)',
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: 400,
    cursor: 'pointer',
    letterSpacing: '0.1px',
  },
  resolveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    margin: '8px 0 4px',
    padding: '7px 14px',
    borderRadius: theme.radius.md,
    border: '1px solid rgba(50,215,75,0.3)',
    background: 'rgba(50,215,75,0.08)',
    color: '#32D74B',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  content: {
    marginBottom: 12,
  },
  mediaBleed: {
    margin: '0 -20px 12px',
    width: 'calc(100% + 40px)',
    maxWidth: 'calc(100% + 40px)',
    overflow: 'hidden',
  },
  title: {
    fontSize: 17,
    fontWeight: theme.fontWeight.bold,
    margin: '4px 0 4px',
    lineHeight: 1.3,
    color: theme.colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 1.45,
    color: theme.colors.premium.textBody,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    margin: 0,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  bodyWrap: {
    position: 'relative',
  },
  bodyBottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
    background: `linear-gradient(to bottom, rgba(17,17,19,0), ${theme.colors.premium.graphite} 82%)`,
    pointerEvents: 'none',
  },
  expandButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.premium.primary,
    fontSize: 14,
    fontWeight: 600,
    padding: '8px 0',
    cursor: 'pointer',
  },
  pollWrapper: { marginBottom: 12 },
  specialBlock: {
    marginTop: 12,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  specialItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 12px',
    background: theme.colors.elevated,
    borderRadius: theme.radius.sm,
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
  },
  adImageContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    border: `1px solid ${theme.colors.border}`,
    background: '#000',
    minHeight: 160,
  },
  adImage: { width: '100%', height: 'auto', display: 'block', maxHeight: 500, objectFit: 'contain' },
  imageSkeleton: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(110deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.04) 65%)',
    backgroundSize: '200% 100%',
    animation: 'imageShimmer 1.25s linear infinite',
    zIndex: 1,
  },
  imageFallback: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.premium.textMuted,
    fontSize: 13,
    fontWeight: 600,
    background: theme.colors.surfaceElevated,
    zIndex: 1,
  },
  tags: {
    display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm,
    marginBottom: 0,
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8,
    minHeight: 36,
  },
  footerLeft: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0,
  },
  dateText: {
    fontSize: 13, color: '#666666', fontWeight: 600,
  },
  editedLabel: {
    fontSize: 11, color: '#666666', opacity: 0.7, fontStyle: 'italic',
  },
  footerRight: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  metricPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 14px', borderRadius: theme.radius.lg,
    background: theme.colors.premium.border, border: 'none',
    color: theme.colors.text, cursor: 'pointer',
    fontWeight: theme.fontWeight.bold, fontSize: theme.fontSize.base,
    transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  shareBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: theme.colors.premium.border, border: 'none',
    padding: '8px 12px', borderRadius: theme.radius.lg,
    color: theme.colors.text, cursor: 'pointer', flexShrink: 0,
  },
  ctaButton: {
    width: '100%',
    padding: '14px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'background 0.2s ease, transform 0.15s cubic-bezier(0.32, 0.72, 0, 1)',
  },
  hiddenAdBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.premium.border}`,
  },
};

export default React.memo(PostCard);

