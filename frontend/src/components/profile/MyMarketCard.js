// ===== 📄 ФАЙЛ: src/components/profile/MyMarketCard.js =====

import React from 'react';
import { Edit2, Trash2, Eye, Heart } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';

function MyMarketCard({ item, onEdit, onDelete, onOpen }) {

  const parseImages = (imagesData) => {
    if (!imagesData) return [];
    
    if (typeof imagesData === 'string') {
      try {
        return JSON.parse(imagesData);
      } catch {
        return [];
      }
    }
    
    return Array.isArray(imagesData) ? imagesData : [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Недавно';
    
    try {
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return 'Недавно';
      }
      
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffHours < 1) return 'только что';
      if (diffHours < 24) return `${diffHours} ч назад`;
      if (diffDays === 1) return 'вчера';
      if (diffDays < 7) return `${diffDays} дн назад`;
      
      return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    } catch {
      return 'Недавно';
    }
  };

  const images = parseImages(item.images);
  const primaryImage = images.length > 0 ? images[0].url : null;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'sold':
        return { label: 'Продано', color: '#666', bg: 'rgba(102, 102, 102, 0.1)' };
      case 'reserved':
        return { label: 'Забронировано', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' };
      default:
        return { label: 'Активно', color: theme.colors.market, bg: 'rgba(16, 185, 129, 0.1)' };
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
            <img src={primaryImage} alt={item.title} style={styles.image} />
          ) : (
            <div style={styles.imagePlaceholder}>📦</div>
          )}
        </div>

        {/* ПРАВАЯ ЧАСТЬ: Инфо */}
        <div style={styles.content}>
          {/* ВЕРХ: Цена + Статус */}
          <div style={styles.header}>
            <span style={styles.price}>{item.price} ₽</span>
            <span style={{...styles.statusBadge, color: statusConfig.color, backgroundColor: statusConfig.bg}}>
              {statusConfig.label}
            </span>
          </div>

          {/* НАЗВАНИЕ */}
          <div style={styles.title}>{item.title}</div>

          {/* МИНИ-СТАТИСТИКА */}
          <div style={styles.stats}>
            <div style={styles.statItem}>
              <Eye size={14} color={theme.colors.textTertiary} />
              <span style={styles.statValue}>{item.views_count || 0}</span>
            </div>
            <div style={styles.statItem}>
              <Heart size={14} color={theme.colors.textTertiary} />
              <span style={styles.statValue}>{item.favorites_count || 0}</span>
            </div>
            <span style={styles.date}>{formatDate(item.created_at)}</span>
          </div>

          {/* КНОПКИ ДЕЙСТВИЙ */}
          <div style={styles.actions}>
            <button onClick={handleEdit} style={styles.actionBtn}>
              <Edit2 size={16} color={theme.colors.market} />
              <span style={{...styles.actionLabel, color: theme.colors.market}}>Редактировать</span>
            </button>
            <button onClick={handleDeleteClick} style={styles.actionBtn}>
              <Trash2 size={16} color="#ef4444" />
              <span style={{...styles.actionLabel, color: '#ef4444'}}>Удалить</span>
            </button>
          </div>
        </div>
      </div>
  );
}

const styles = {
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    gap: 12,
    padding: 12,
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer',
  },
  
  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    backgroundColor: '#000',
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
    fontSize: 40,
    backgroundColor: theme.colors.bgSecondary,
  },
  
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    minWidth: 0,
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  
  price: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.colors.market,
  },
  
  statusBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  
  title: {
    fontSize: 15,
    fontWeight: 600,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    lineHeight: 1.3,
  },
  
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 'auto',
  },
  
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  
  statValue: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: 500,
  },
  
  date: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginLeft: 'auto',
  },
  
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 4,
  },
  
  actionBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 12px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  
  actionLabel: {
    fontSize: 13,
    fontWeight: 600,
  },
};

export default MyMarketCard;
