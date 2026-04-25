import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle, Heart } from 'lucide-react';
import { getMarketItems } from '../../api';
import { useStore } from '../../store';
import theme from '../../theme';
import { hapticFeedback } from '../../utils/telegram';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { toast } from '../shared/Toast';
import { buildFeedSections } from '../../utils/feedDateSections';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { MARKET_PAGE_SIZE } from '../../constants/layoutConstants';
import { Z_MARKET_FAVORITES } from '../../constants/zIndex';
import MarketCard from './MarketCard';
import MarketDetail from './MarketDetail';

const C = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  textTertiary: '#666666',
  accent: '#D4FF00',
};

function MarketFavoritesScreen({ onClose }) {
  const { marketFavorites, setMarketFavorites } = useStore();
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isExiting, setIsExiting] = useState(false);

  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const closeTimeoutRef = useRef(null);

  const closeImmediately = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExiting(false);
    onClose?.();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsExiting(false);
      onClose?.();
    }, 340);
  }, [isExiting, onClose]);

  useTelegramScreen({
    id: 'market-favorites-screen',
    title: 'Избранное',
    priority: 45,
    back: { visible: true, onClick: handleClose },
  });

  const loadFavorites = useCallback(async (reset = false) => {
    if (loadingRef.current || (!reset && !hasMoreRef.current)) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    if (reset) {
      offsetRef.current = 0;
      hasMoreRef.current = true;
      setHasMore(true);
      setMarketFavorites([]);
    }

    try {
      const offset = reset ? 0 : offsetRef.current;
      const result = await getMarketItems({
        favorites_only: true,
        skip: offset,
        limit: MARKET_PAGE_SIZE,
      });
      const nextItems = result.items || [];

      setMarketFavorites((prev) => {
        if (reset) return nextItems;
        const existingIds = new Set(prev.map((item) => item.id));
        return [...prev, ...nextItems.filter((item) => !existingIds.has(item.id))];
      });

      offsetRef.current = offset + nextItems.length;
      hasMoreRef.current = Boolean(result.has_more);
      setHasMore(Boolean(result.has_more));
    } catch (err) {
      console.error('Market favorites load error:', err);
      setError('Не удалось загрузить избранное');
      toast.error('Не удалось загрузить избранное');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [setMarketFavorites]);

  useBodyScrollLock(!isExiting);

  useEffect(() => {
    loadFavorites(true);

    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, [loadFavorites]);

  const favoriteRows = useMemo(() => (
    buildFeedSections(marketFavorites, (item) => item.created_at, { getItemKey: (item) => item.id })
  ), [marketFavorites]);

  const handleScroll = (event) => {
    const target = event.currentTarget;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 80;
    if (bottom) loadFavorites(false);
  };

  const handleOpenItem = (item) => {
    hapticFeedback('light');
    setSelectedItem(item);
  };

  const handleDetailUpdate = (updatedItem) => {
    if (updatedItem?.id) {
      setMarketFavorites((prev) => (
        updatedItem.is_favorited === false
          ? prev.filter((item) => String(item.id) !== String(updatedItem.id))
          : prev.map((item) => (String(item.id) === String(updatedItem.id) ? { ...item, ...updatedItem } : item))
      ));
      setSelectedItem(updatedItem);
      return;
    }

    if (selectedItem?.id) {
      setMarketFavorites((prev) => prev.filter((item) => String(item.id) !== String(selectedItem.id)));
    }
    setSelectedItem(null);
  };

  const containerStyle = {
    ...styles.container,
    animation: isExiting
      ? 'marketFavoritesSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
      : 'marketFavoritesSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
    pointerEvents: isExiting ? 'none' : 'auto',
  };

  return (
    <>
      <style>{`
        @keyframes marketFavoritesSlideIn { from { transform: translate3d(100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
        @keyframes marketFavoritesSlideOut { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(100%, 0, 0); } }
        @keyframes marketFavoritesShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
      `}</style>
      <EdgeSwipeBack
        onBack={closeImmediately}
        disabled={Boolean(selectedItem) || isExiting}
        passThrough={isExiting}
        zIndex={Z_MARKET_FAVORITES}
      >
        <div style={containerStyle} onScroll={handleScroll}>
          <DrilldownHeader
            title="Избранное"
            onBack={handleClose}
            background="#000000"
            showDivider={false}
          />

          <div style={styles.content}>
            {error && !loading && (
              <div style={styles.empty}>
                <Heart size={38} color={C.textTertiary} strokeWidth={1.6} />
                <div style={styles.emptyTitle}>{error}</div>
                <button type="button" style={styles.primaryButton} onClick={() => loadFavorites(true)}>
                  Повторить
                </button>
              </div>
            )}

            {!error && marketFavorites.length > 0 && (
              <div style={styles.grid}>
                {favoriteRows.map((row, rowIndex) => (
                  row.type === 'divider' ? (
                    <div key={row.key} style={styles.gridDividerItem}>
                      <FeedDateDivider
                        label={row.label}
                        spacingBefore={rowIndex > 0 ? theme.spacing.md : 0}
                        spacingAfter={rowIndex < favoriteRows.length - 1 ? theme.spacing.md : 0}
                      />
                    </div>
                  ) : (
                    <MarketCard
                      key={row.key}
                      item={row.item}
                      index={row.index}
                      onClick={() => handleOpenItem(row.item)}
                    />
                  )
                ))}
              </div>
            )}

            {!error && !loading && marketFavorites.length === 0 && (
              <div style={styles.empty}>
                <div style={styles.emptyIcon}>
                  <Heart size={38} color={C.accent} strokeWidth={1.8} />
                </div>
                <div style={styles.emptyTitle}>Пока нет избранного</div>
                <div style={styles.emptySub}>Добавляйте товары сердечком, чтобы быстро вернуться к ним</div>
                <button type="button" style={styles.primaryButton} onClick={handleClose}>
                  В маркет
                </button>
              </div>
            )}

            {loading && (
              <div style={styles.grid}>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} style={styles.skeletonCard}>
                    <div style={styles.skeletonImage} />
                    <div style={styles.skeletonInfo}>
                      <div style={styles.skeletonLine} />
                      <div style={styles.skeletonLineShort} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && !hasMore && marketFavorites.length > 0 && (
              <div style={styles.endMsg}>
                <CheckCircle size={20} color={C.textTertiary} strokeWidth={1.5} />
                <span>Все избранные товары загружены</span>
              </div>
            )}
          </div>

          {selectedItem && (
            <MarketDetail
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
              onUpdate={handleDetailUpdate}
            />
          )}
        </div>
      </EdgeSwipeBack>
    </>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 'var(--app-fixed-left)',
    width: 'var(--app-fixed-width)',
    zIndex: Z_MARKET_FAVORITES,
    backgroundColor: C.bg,
    overflowY: 'auto',
  },
  content: {
    minHeight: 'calc(100vh - var(--drilldown-header-height))',
    padding: '8px 12px calc(env(safe-area-inset-bottom, 20px) + 20px)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: theme.spacing.md,
    paddingBottom: 16,
  },
  gridDividerItem: {
    gridColumn: '1 / -1',
  },
  empty: {
    minHeight: 360,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 8,
    background: 'rgba(212,255,0,0.08)',
    border: `1px solid ${C.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: '22px',
    fontWeight: 800,
    color: C.text,
  },
  emptySub: {
    maxWidth: 300,
    fontSize: 14,
    lineHeight: '20px',
    color: C.textMuted,
  },
  primaryButton: {
    marginTop: 8,
    height: 44,
    padding: '0 22px',
    borderRadius: 8,
    border: 'none',
    background: C.accent,
    color: '#000000',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  skeletonCard: {
    borderRadius: 8,
    overflow: 'hidden',
    border: `1px solid ${C.border}`,
    background: C.surface,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: '1',
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'marketFavoritesShimmer 1.5s infinite',
  },
  skeletonInfo: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  skeletonLine: {
    height: 16,
    borderRadius: 8,
    background: C.surfaceElevated,
  },
  skeletonLineShort: {
    width: '60%',
    height: 16,
    borderRadius: 8,
    background: C.surfaceElevated,
  },
  endMsg: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '28px 20px',
    marginTop: 8,
    fontSize: 13,
    fontWeight: 700,
    color: C.textTertiary,
  },
};

export default MarketFavoritesScreen;
