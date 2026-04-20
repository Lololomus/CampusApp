// ===== FILE: MediaGrid.js =====
import React, { useState, useCallback, useMemo } from 'react';
import theme from '../../theme';
import { resolveImageUrl } from '../../utils/mediaUrl';

// Получить URL превью: для видео — thumbnail_url, для остальных — url/filename
function getItemThumbnailUrl(item) {
  if (!item) return '';
  if (typeof item === 'object' && item.type === 'video') {
    return item.thumbnail_url ? resolveImageUrl(item.thumbnail_url, 'images') : '';
  }
  const filename = (typeof item === 'object') ? item.url : item;
  return resolveImageUrl(filename, 'images');
}

const cellStyles = {
  skeleton: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(110deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.04) 65%)',
    backgroundSize: '200% 100%',
    animation: 'mediaGridShimmer 1.25s linear infinite',
    zIndex: 1,
  },
  fallback: {
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
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: theme.colors.overlay,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  overflowOverlay: {
    position: 'absolute',
    inset: 0,
    background: theme.colors.overlayDark,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  overflowText: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
};

// Одна ячейка сетки
const MediaCell = React.memo(function MediaCell({
  item, index, total, maxVisible, onItemClick, isSingleItem, spanStyle, isHidden,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = getItemThumbnailUrl(item);
  const isVideo = typeof item === 'object' && item?.type === 'video';
  const isOverflowCell = (index === maxVisible - 1) && (total > maxVisible);
  const overflowCount = total - maxVisible + 1;

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onItemClick(index, e.currentTarget.getBoundingClientRect());
  }, [index, onItemClick]);

  const wrapperStyle = {
    position: 'relative',
    overflow: 'hidden',
    cursor: 'pointer',
    width: '100%',
    height: isSingleItem ? 'auto' : '100%',
    minHeight: isSingleItem ? 200 : undefined,
    backgroundColor: theme.colors.surfaceElevated,
    ...spanStyle,
  };

  return (
    <div data-media-grid-index={index} style={wrapperStyle} onClick={handleClick}>
      {!isHidden && !loaded && !failed && <div style={cellStyles.skeleton} />}
      {!isHidden && failed && <div style={cellStyles.fallback}>Фото недоступно</div>}
      {!isHidden && url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: isSingleItem ? 'auto' : '100%',
            maxHeight: isSingleItem ? 500 : undefined,
            objectFit: 'cover',
            display: 'block',
            opacity: (loaded && !failed) ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
      {!isHidden && isVideo && !failed && (
        <div style={cellStyles.playIcon}>
          <svg width={18} height={18} viewBox="0 0 18 18" fill="white">
            <polygon points="5,2 16,9 5,16" />
          </svg>
        </div>
      )}
      {!isHidden && isOverflowCell && (
        <div style={cellStyles.overflowOverlay}>
          <span style={cellStyles.overflowText}>+{overflowCount}</span>
        </div>
      )}
    </div>
  );
});

// Динамическая плитка медиа (1–4 элемента)
const MediaGrid = React.memo(function MediaGrid({ mediaItems, onItemClick, maxVisible = 4, containerStyle, hiddenIndex = null }) {
  const total = mediaItems.length;
  const count = Math.min(total, maxVisible);
  const isSingleItem = count === 1;

  const gridStyle = useMemo(() => {
    const base = {
      display: 'grid',
      gap: 2,
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${theme.colors.premium.border}`,
      ...containerStyle,
    };
    if (count === 1) return { ...base, gridTemplateColumns: '1fr', maxHeight: 500 };
    if (count === 2) return { ...base, gridTemplateColumns: '1fr 1fr', height: 320 };
    // 3 или 4: двухколоночная сетка 2×2
    return { ...base, gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 320 };
  }, [count, containerStyle]);

  const visibleItems = mediaItems.slice(0, maxVisible);

  return (
    <div style={gridStyle}>
      <style>{`
        @keyframes mediaGridShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      {visibleItems.map((item, index) => (
        <MediaCell
          key={index}
          item={item}
          index={index}
          total={total}
          maxVisible={maxVisible}
          onItemClick={onItemClick}
          isSingleItem={isSingleItem}
          isHidden={hiddenIndex === index}
          // При 3 элементах первый занимает оба столбца
          spanStyle={count === 3 && index === 0 ? { gridColumn: '1 / span 2' } : {}}
        />
      ))}
    </div>
  );
});

export default MediaGrid;
