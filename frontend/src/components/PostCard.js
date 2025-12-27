import React, { useState, useRef } from 'react';
import { Heart, MessageCircle, Eye, MapPin, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { hapticFeedback } from '../utils/telegram';
import { likePost, deletePost } from '../api';
import { useStore } from '../store';
import theme from '../theme';
import DropdownMenu from './DropdownMenu';
import EditPost from './EditPost';


function PostCard({ post, onClick, onLikeUpdate, onPostDeleted }) {
  const { likedPosts, setPostLiked, user } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [imageHeight, setImageHeight] = useState(() => {
    const images = post.images || [];
    if (images.length > 0) {
      const cachedHeight = sessionStorage.getItem(`img-height-${images[0]}`);
      if (cachedHeight) {
        return parseInt(cachedHeight, 10);
      }
    }
    return 350;
  });

  const [currentImageIndex, setCurrentImageIndex] = useState(() => {
    const saved = sessionStorage.getItem(`post-${post.id}-imageIndex`);
    return saved ? parseInt(saved, 10) : 0;
  });

  const images = post.images || [];
  const hasImages = images.length > 0;
  const isLiked = likedPosts[post.id] ?? post.is_liked ?? false;
  const likesCount = post.likes_count || post.likes || 0;
  
  // Проверка авторства
  const currentUserId = user?.id;
  const isAuthor = currentUserId && post.author_id === currentUserId;
  
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

  const handlePrevImage = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex((prev) => {
      const newIndex = prev === 0 ? images.length - 1 : prev - 1;
      sessionStorage.setItem(`post-${post.id}-imageIndex`, newIndex);
      return newIndex;
    });
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setCurrentImageIndex((prev) => {
      const newIndex = prev === images.length - 1 ? 0 : prev + 1;
      sessionStorage.setItem(`post-${post.id}-imageIndex`, newIndex);
      return newIndex;
    });
  };

  const handleImageLoad = (e) => {
    const img = e.target;
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    
    let height;
    if (aspectRatio >= 1.5) {
      height = 240; // Широкие горизонтальные
    } else if (aspectRatio >= 1.1) {
      height = 300; // Квадратные
    } else if (aspectRatio >= 0.7) {
      height = 400; // Немного вертикальные
    } else {
      height = 480; // Очень вертикальные
    }
    
    // Сохраняем в кэш
    const imageUrl = images[currentImageIndex];
    sessionStorage.setItem(`img-height-${imageUrl}`, height);
    
    setImageHeight(height);
  };

  const handleMenuClick = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    setMenuOpen(!menuOpen);
  };

  const handleEdit = () => {
    setMenuOpen(false);
    hapticFeedback('medium');
    setIsEditModalOpen(true);
  };

  const handleEditUpdate = (updatedPost) => {
    hapticFeedback('success');
    
    // Обновляем данные в родителе
    if (onLikeUpdate) {
      onLikeUpdate(post.id, updatedPost);
    }
    
    // Закрываем модалку
    setIsEditModalOpen(false);
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    
    if (!window.confirm('Удалить пост? Это действие нельзя отменить.')) {
      return;
    }
    
    hapticFeedback('heavy');
    
    try {
      await deletePost(post.id);
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (error) {
      console.error('Ошибка удаления:', error);
      alert('Не удалось удалить пост');
    }
  };

  const handlePin = () => {
    setMenuOpen(false);
    hapticFeedback('medium');
    alert('Функция закрепления в разработке');
  };

  const handleReport = () => {
    setMenuOpen(false);
    hapticFeedback('medium');
    alert('Функция жалобы в разработке');
  };

  const handleCopyLink = async () => {
    setMenuOpen(false);
    hapticFeedback('light');
    
    const link = `${window.location.origin}/post/${post.id}`;
    
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert('Ссылка скопирована!');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Ссылка скопирована!');
      }
    } catch (error) {
      console.error('Ошибка копирования:', error);
      alert('Не удалось скопировать ссылку');
    }
  };

  const handleRepost = () => {
    setMenuOpen(false);
    hapticFeedback('medium');
    alert('Функция репоста в разработке');
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

  const getCategoryIcon = (category) => {
    const icons = {
      news: '📰',
      events: '🎉',
      confessions: '💭',
      lost_found: '🔍',
    };
    return icons[category] || '';
  };

  const getCategoryName = (category) => {
    const names = {
      news: 'Новости',
      events: 'События',
      confessions: 'Признания',
      lost_found: 'Находки',
    };
    return names[category] || category;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('ru-RU', options).replace(' г.', '');
  };

  const isAnonymous = post.is_anonymous === true;
  const authorName = isAnonymous ? 'Аноним' : (post.author?.name || 'Пользователь');
  const authorMeta = !isAnonymous && post.author 
    ? [post.author.university, post.author.course ? `${post.author.course}к` : null]
        .filter(Boolean).join(' · ')
    : null;

  const truncateText = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Обновляем высоту при смене фото (если есть кэш)
  React.useEffect(() => {
    if (images.length > 0) {
      const imageUrl = images[currentImageIndex];
      const cachedHeight = sessionStorage.getItem(`img-height-${imageUrl}`);
      if (cachedHeight) {
        setImageHeight(parseInt(cachedHeight, 10));
      } else {
        setImageHeight(350); // Временная высота до загрузки
      }
    }
  }, [currentImageIndex, images]);


  // Меню действий
  const menuItems = isAuthor ? [
    { icon: '✏️', label: 'Редактировать', onClick: handleEdit },
    { icon: '📌', label: 'Закрепить', onClick: handlePin },
    { icon: '🗑', label: 'Удалить', onClick: handleDelete, danger: true },
    { divider: true },
    { icon: '🔗', label: 'Копировать ссылку', onClick: handleCopyLink },
    { icon: '📤', label: 'Репост', onClick: handleRepost },
  ] : [
    { icon: '🚫', label: 'Пожаловаться', onClick: handleReport, danger: true },
    { divider: true },
    { icon: '🔗', label: 'Копировать ссылку', onClick: handleCopyLink },
    { icon: '📤', label: 'Репост', onClick: handleRepost },
  ];

  return (
    <div 
      style={{
        ...styles.card,
        borderLeft: `4px solid ${getCategoryColor(post.category)}`
      }} 
      onClick={() => onClick(post.id)}
    >
      {/* ХЕДЕР */}
      <div style={styles.header}>
        <div style={styles.authorSection}>
          <div style={{
            ...styles.avatar,
            backgroundColor: isAnonymous ? theme.colors.textDisabled : theme.colors.primary
          }}>
            {authorName[0]?.toUpperCase() || '?'}
          </div>
          <div style={styles.authorText}>
            <span style={styles.authorName}>{authorName}</span>
            {authorMeta && (
              <>
                <span style={styles.dot}> · </span>
                <span style={styles.authorMeta}>{authorMeta}</span>
              </>
            )}
          </div>
        </div>
        
        <div style={styles.headerRight}>
          <div style={styles.categoryIcon}>
            {getCategoryIcon(post.category)} {getCategoryName(post.category)}
          </div>
          
          {/* МЕНЮ (3 точки) */}
          <button 
            ref={menuButtonRef}
            style={styles.menuButton}
            onClick={handleMenuClick}
            aria-label="Меню"
          >
            <MoreVertical size={18} />
          </button>

          <DropdownMenu 
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            items={menuItems}
            anchorRef={menuButtonRef}
          />
        </div>
      </div>

      {/* ЗАГОЛОВОК */}
      <h3 style={styles.title}>{post.title}</h3>

      {/* ГАЛЕРЕЯ ИЗОБРАЖЕНИЙ */}
      {hasImages && (
        <div style={{...styles.imageContainer, height: imageHeight}}>
        <img 
          src={images[currentImageIndex]} 
          alt={`${post.title} - фото ${currentImageIndex + 1}`}
          style={styles.image}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          
          {/* Индикатор количества фото */}
          {images.length > 1 && (
            <>
              {/* Счётчик */}
              <div style={styles.imageCounter}>
                {currentImageIndex + 1} / {images.length}
              </div>
              
              {/* Кнопки навигации */}
              <button 
                onClick={handlePrevImage}
                style={{...styles.imageNavButton, left: 8}}
                aria-label="Предыдущее фото"
              >
                <ChevronLeft size={20} />
              </button>
              
              <button 
                onClick={handleNextImage}
                style={{...styles.imageNavButton, right: 8}}
                aria-label="Следующее фото"
              >
                <ChevronRight size={20} />
              </button>
              
              {/* Точки-индикаторы */}
              <div style={styles.imageDots}>
                {images.map((_, index) => (
                  <div 
                    key={index}
                    style={{
                      ...styles.dot,
                      opacity: index === currentImageIndex ? 1 : 0.4,
                      transform: index === currentImageIndex ? 'scale(1.2)' : 'scale(1)'
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ОПИСАНИЕ */}
      <p style={styles.body}>
        {truncateText(post.body, 180)}
      </p>

      {/* ДОП ИНФО */}
      {(post.event_name || post.event_date || post.item_description || post.location) && (
        <div style={styles.metaInfo}>
          {post.event_name && (
            <span style={styles.metaItem}>
              📅 {post.event_name} • {formatDate(post.event_date)}
            </span>
          )}
          {post.item_description && (
            <span style={styles.metaItem}>
              {post.lost_or_found === 'lost' ? '😢' : '🎉'} {post.item_description}
            </span>
          )}
          {post.location && (
            <span style={styles.metaItem}>
              <MapPin size={12} style={{verticalAlign: 'middle', marginRight: 4}} />
              {post.location}
            </span>
          )}
        </div>
      )}

      {/* ТЕГИ */}
      {post.tags && post.tags.length > 0 && (
        <div style={styles.tags}>
          {post.tags.slice(0, 3).map((tag, index) => (
            <span key={index} style={styles.tag}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* ФУТЕР */}
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
          <span>{post.comments_count || 0}</span>
        </button>
        <div style={styles.views}>
          <Eye size={16} />
          <span>{post.views_count || 0}</span>
        </div>
      </div>
      {/* Модалка редактирования */}
      {isEditModalOpen && (
        <EditPost 
          post={post}
          onClose={handleEditClose}
          onUpdate={handleEditUpdate}
        />
      )}
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    border: `1px solid ${theme.colors.border}`,
  },
  
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  authorSection: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
  },
  authorText: {
    fontSize: 13,
    lineHeight: 1.3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  authorName: {
    fontWeight: 600,
    color: theme.colors.text,
  },
  dot: {
    color: theme.colors.textTertiary,
  },
  authorMeta: {
    color: theme.colors.textTertiary,
  },
  
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    position: 'relative',
  },
  categoryIcon: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  
  menuButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.textTertiary,
    cursor: 'pointer',
    padding: 4,
    display: 'flex',
    alignItems: 'center',
    borderRadius: 6,
    transition: 'all 0.2s',
  },
  
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.colors.text,
    marginBottom: 10,
    lineHeight: 1.3,
    margin: '0 0 10px 0',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    minHeight: '240px',
    maxHeight: '480px',
    borderRadius: `${theme.radius.lg}px`,
    overflow: 'hidden',
    backgroundColor: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'height 0.3s ease',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  imageCounter: {
    position: 'absolute',
    top: 8,
    right: 8,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 12,
    zIndex: 2,
  },
  imageNavButton: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 3,
    transition: 'all 0.2s',
    opacity: 0.8,
  },
  imageDots: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: 6,
    zIndex: 2,
  },
  
  body: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
    marginBottom: 8,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  
  metaInfo: {
    fontSize: 13,
    color: theme.colors.textTertiary,
    marginBottom: 8,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaItem: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: 500,
  },
  
  footer: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    paddingTop: 10,
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
    padding: 4,
    fontSize: 14,
    transition: 'color 0.2s',
  },
  views: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: theme.colors.textDisabled,
    fontSize: 14,
    marginLeft: 'auto',
  },
};

export default PostCard;