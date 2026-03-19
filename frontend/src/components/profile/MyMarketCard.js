// ===== FILE: src/components/profile/MyMarketCard.js =====

import { Edit2, Trash2, Eye, Heart } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';

const C = {
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255, 255, 255, 0.06)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  primary: '#D4FF00',
  blue: '#4DA6FF',
  success: '#32D74B',
  error: '#FF453A',
  warning: '#FF9F0A',
};

function MyMarketCard({ item, onEdit, onDelete, onOpen }) {

  const parseImages = (imagesData) => {
    if (!imagesData) return [];
    if (typeof imagesData === 'string') {
      try { return JSON.parse(imagesData); } catch { return []; }
    }
    return Array.isArray(imagesData) ? imagesData : [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Недавно';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Недавно';
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      if (diffHours < 1) return 'только что';
      if (diffHours < 24) return `${diffHours} ч назад`;
      if (diffDays === 1) return 'вчера';
      if (diffDays < 7) return `${diffDays} дн назад`;
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch { return 'Недавно'; }
  };

  const images = parseImages(item.images);
  const primaryImage = images.length > 0 ? images[0].url : null;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'sold':
        return { label: 'Продано', color: C.textMuted, bg: 'rgba(142, 142, 147, 0.1)' };
      case 'reserved':
        return { label: 'Забронировано', color: C.warning, bg: 'rgba(255, 159, 10, 0.1)' };
      default:
        return { label: 'Активно', color: C.success, bg: 'rgba(50, 215, 75, 0.1)' };
    }
  };

  const statusConfig = getStatusConfig(item.status);

  const handleEdit = (e) => {
    e.stopPropagation();
    hapticFeedback('light');
    onEdit(item);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    hapticFeedback('medium');
    onDelete(item.id);
  };

  const handleOpen = () => {
    if (onOpen) onOpen(item);
  };

  return (
    <div style={styles.card} onClick={handleOpen}>
      {/* ЛЕВАЯ ЧАСТЬ: Фото */}
      <div style={styles.imageContainer}>
        {primaryImage ? (
          <img src={primaryImage} alt={item.title} style={styles.image} loading="lazy" decoding="async" />
        ) : (
          <div style={styles.imagePlaceholder}>📦</div>
        )}
      </div>

      {/* ПРАВАЯ ЧАСТЬ: Инфо */}
      <div style={styles.content}>
        {/* ВЕРХ: Цена + Статус */}
        <div style={styles.header}>
          <span style={styles.price}>{item.price} ₽</span>
          <span style={{ ...styles.statusBadge, color: statusConfig.color, backgroundColor: statusConfig.bg }}>
            {statusConfig.label}
          </span>
        </div>

        {/* НАЗВАНИЕ */}
        <div style={styles.title}>{item.title}</div>

        {/* МИНИ-СТАТИСТИКА */}
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <Eye size={13} color={C.textMuted} />
            <span style={styles.statValue}>{item.views_count || 0}</span>
          </div>
          <div style={styles.statItem}>
            <Heart size={13} color={C.textMuted} />
            <span style={styles.statValue}>{item.favorites_count || 0}</span>
          </div>
          <span style={styles.date}>{formatDate(item.created_at)}</span>
        </div>

        {/* КНОПКИ ДЕЙСТВИЙ */}
        <div style={styles.actions}>
          <button onClick={handleEdit} style={styles.editBtn}>
            <Edit2 size={14} color={C.blue} />
            <span style={{ ...styles.actionLabel, color: C.blue }}>Изменить</span>
          </button>
          <button onClick={handleDeleteClick} style={styles.deleteBtn}>
            <Trash2 size={14} color={C.error} />
            <span style={{ ...styles.actionLabel, color: C.error }}>Удалить</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'rgba(28, 28, 30, 0.5)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 16,
    border: '1px solid rgba(255, 255, 255, 0.06)',
    display: 'flex',
    gap: 12,
    padding: 12,
    cursor: 'pointer',
    transition: 'transform 0.15s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.15s',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
  },

  imageContainer: {
    width: 96,
    height: 96,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: '#111',
  },

  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  imagePlaceholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 36,
    backgroundColor: '#2C2C2E',
  },

  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    minWidth: 0,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  price: {
    fontSize: 17,
    fontWeight: 800,
    color: '#D4FF00',
    letterSpacing: '-0.3px',
  },

  statusBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '3px 8px',
    borderRadius: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    flexShrink: 0,
  },

  title: {
    fontSize: 14,
    fontWeight: 600,
    color: '#FFFFFF',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.35,
  },

  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginTop: 'auto',
  },

  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
  },

  statValue: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: 500,
  },

  date: {
    fontSize: 11,
    color: '#8E8E93',
    marginLeft: 'auto',
    fontWeight: 500,
  },

  actions: {
    display: 'flex',
    gap: 6,
    marginTop: 2,
  },

  editBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '7px 10px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'rgba(77, 166, 255, 0.08)',
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.15s cubic-bezier(0.32, 0.72, 0, 1)',
    WebkitTapHighlightColor: 'transparent',
  },

  deleteBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: '7px 10px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: 'rgba(255, 69, 58, 0.07)',
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.15s cubic-bezier(0.32, 0.72, 0, 1)',
    WebkitTapHighlightColor: 'transparent',
  },

  actionLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
};

export default MyMarketCard;
