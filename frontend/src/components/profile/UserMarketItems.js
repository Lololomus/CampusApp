// ===== FILE: UserMarketItems.js =====

import { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShoppingBag, CheckCircle } from 'lucide-react';
import { getMyMarketItems, deleteMarketItem } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import MyMarketCard from './MyMarketCard';
import EditMarketItemModal from '../market/EditMarketItemModal';
import MarketDetail from '../market/MarketDetail';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { Z_USER_MARKET_ITEMS } from '../../constants/zIndex';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

const C = {
  bg: '#000000',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  textTertiary: '#666666',
  accent: '#D4FF00', // campus lime
  accentText: '#000000',
};

function UserMarketItems() {
  const { setShowUserMarketItems } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const LIMIT = 20;

  const closeScreen = () => setShowUserMarketItems(false);

  useTelegramScreen({
    id: 'user-market-items-screen',
    title: 'Мои товары',
    priority: 40,
    back: { visible: true, onClick: () => { hapticFeedback('light'); closeScreen(); } },
  });

  useEffect(() => {
    lockBodyScroll();
    loadItems();
    return () => unlockBodyScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await getMyMarketItems(LIMIT, offset);
      if (newItems.length < LIMIT) setHasMore(false);
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        return [...prev, ...newItems.filter(i => !existingIds.has(i.id))];
      });
      setOffset(prev => prev + newItems.length);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Не удалось загрузить товары');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => { hapticFeedback('light'); setEditingItem(item); };
  const handleEditSuccess = (updatedItem) => { setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i)); setEditingItem(null); };
  const handleDeleteClick = (itemId) => { hapticFeedback('medium'); setItemToDelete(itemId); };
  const handleOpenItem = (item) => { hapticFeedback('light'); setSelectedItem(item); };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteMarketItem(itemToDelete);
      setItems(prev => prev.filter(i => i.id !== itemToDelete));
      toast.success('Товар удалён');
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка при удалении');
    } finally {
      setItemToDelete(null);
    }
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 50;
    if (bottom && hasMore && !loading) loadItems();
  };

  const filteredItems = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'active') return item.status === 'active';
    if (filter === 'sold') return item.status === 'sold';
    return true;
  });

  const counts = {
    all: items.length,
    active: items.filter(i => i.status === 'active').length,
    sold: items.filter(i => i.status === 'sold').length,
  };

  const itemRows = useMemo(() => (
    buildFeedSections(filteredItems, (i) => i.created_at, { getItemKey: (i) => i.id })
  ), [filteredItems]);

  const FILTERS = [
    { key: 'all', label: 'Все', count: counts.all },
    { key: 'active', label: 'Активные', count: counts.active },
    { key: 'sold', label: 'Проданные', count: counts.sold },
  ];

  const renderModals = () => createPortal(
    <>
      {editingItem && (
        <EditMarketItemModal item={editingItem} onClose={() => setEditingItem(null)} onSuccess={handleEditSuccess} />
      )}
      {selectedItem && (
        <MarketDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onUpdate={(updatedItem) => {
            if (updatedItem?.id) {
              setItems(prev => prev.map(i => (String(i.id) === String(updatedItem.id) ? { ...i, ...updatedItem } : i)));
              setSelectedItem(updatedItem);
            } else {
              setItems(prev => prev.filter(i => String(i.id) !== String(selectedItem.id)));
              setSelectedItem(null);
            }
          }}
        />
      )}
      <ConfirmationDialog
        isOpen={!!itemToDelete}
        title="Удалить товар?"
        message="Это действие нельзя отменить."
        confirmText="Удалить"
        confirmType="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </>,
    document.body
  );

  return (
    <EdgeSwipeBack
      onBack={() => { hapticFeedback('light'); closeScreen(); }}
      disabled={Boolean(selectedItem)}
      zIndex={Z_USER_MARKET_ITEMS}
    >
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader
        title={`Мои товары (${counts.all})`}
        onBack={closeScreen}
        background="#000000"
        showDivider={false}
      />

      <div style={styles.filterBar}>
        <div style={styles.tabsWrapper}>
          <div style={{ ...styles.activeIndicator, transform: `translateX(${FILTERS.findIndex(f => f.key === filter) * 100}%)` }} />
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { hapticFeedback('selection'); setFilter(f.key); }}
              style={{ ...styles.tabBtn, color: filter === f.key ? '#000000' : '#8E8E93' }}
            >
              {f.label}{f.count > 0 ? ` ${f.count}` : ''}
            </button>
          ))}
        </div>
      </div>

      <div style={styles.content}>
        {filteredItems.length > 0 ? (
          itemRows.map((row) =>
            row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <div key={row.key} style={{ animation: `fadeInUp 0.35s ease ${row.index * 0.04}s both` }}>
                <MyMarketCard
                  item={row.item}
                  onOpen={handleOpenItem}
                  onEdit={handleEdit}
                  onDelete={() => handleDeleteClick(row.item.id)}
                />
              </div>
            )
          )
        ) : !loading ? (
          <div style={styles.empty}>
            <ShoppingBag size={36} color={C.textTertiary} strokeWidth={1.5} />
            <div style={styles.emptyTitle}>Нет товаров</div>
            <div style={styles.emptySub}>
              {filter === 'all' && 'Создайте первое объявление'}
              {filter === 'active' && 'Все товары проданы'}
              {filter === 'sold' && 'Пока ничего не продано'}
            </div>
          </div>
        ) : null}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px' }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...styles.skeleton, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {!hasMore && items.length > 0 && (
          <div style={styles.endMsg}>
            <CheckCircle size={20} color={C.textTertiary} strokeWidth={1.5} />
            <span>Все товары загружены</span>
          </div>
        )}
      </div>

      {renderModals()}
    </div>
    </EdgeSwipeBack>
  );
}

const styles = {
  container: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: Z_USER_MARKET_ITEMS,
    backgroundColor: C.bg,
    overflowY: 'auto',
  },
  filterBar: {
    padding: '12px 16px',
    backgroundColor: C.bg,
    position: 'sticky',
    top: 'calc(var(--drilldown-header-height) + env(safe-area-inset-top, 0px))',
    zIndex: 9,
  },
  tabsWrapper: {
    display: 'flex',
    background: '#1C1C1E',
    borderRadius: 14,
    position: 'relative',
    height: 42,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0,
    width: 'calc(100% / 3)',
    background: C.accent,
    borderRadius: 14,
    boxShadow: '0 2px 10px rgba(212,255,0,0.2)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },
  tabBtn: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 2,
    transition: 'color 0.2s',
    WebkitTapHighlightColor: 'transparent',
  },
  content: {
    padding: '4px 16px calc(env(safe-area-inset-bottom, 20px) + 20px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '52px 24px',
    border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: C.text },
  emptySub: { fontSize: 14, color: C.textMuted, lineHeight: 1.5, textAlign: 'center' },
  skeleton: {
    height: 80, borderRadius: 16,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  endMsg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '28px 20px', marginTop: 8,
    borderTop: `1px solid ${C.border}`,
    fontSize: 13, fontWeight: 600, color: C.textTertiary,
  },
};

export default UserMarketItems;
