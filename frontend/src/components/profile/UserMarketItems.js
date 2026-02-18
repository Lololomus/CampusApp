// ===== 📄 ФАЙЛ: src/components/profile/UserMarketItems.js =====

import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✅ Добавлено для рендера модалок поверх всего
import { getMyMarketItems, deleteMarketItem } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import MyMarketCard from './MyMarketCard';
import EditMarketItemModal from '../market/EditMarketItemModal';
import MarketDetail from '../market/MarketDetail';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { Z_USER_MARKET_ITEMS } from '../../constants/zIndex';
import theme from '../../theme';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';

function UserMarketItems() {
  const { setShowUserMarketItems } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  
  // Локальные модалки
  const [editingItem, setEditingItem] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  
  const LIMIT = 20;

  const closeScreen = () => {
    setShowUserMarketItems(false);
  };

  const handleTelegramBack = () => {
    hapticFeedback('light');
    closeScreen();
  };

  useTelegramScreen({
    id: 'user-market-items-screen',
    title: 'Мои товары',
    priority: 40,
    back: {
      visible: true,
      onClick: handleTelegramBack,
    },
  });

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await getMyMarketItems(LIMIT, offset);
      
      if (newItems.length < LIMIT) {
        setHasMore(false);
      }
      
      // ✅ FIX: Фильтруем дубликаты перед добавлением в стейт
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id));
        const uniqueNewItems = newItems.filter(i => !existingIds.has(i.id));
        return [...prev, ...uniqueNewItems];
      });
      
      setOffset(prev => prev + newItems.length);
    } catch (error) {
      console.error('Error loading items:', error);
      toast.error('Не удалось загрузить товары');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    hapticFeedback('light');
    setEditingItem(item);
  };

  const handleEditSuccess = (updatedItem) => {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setEditingItem(null);
  };

  const handleDeleteClick = (itemId) => {
    hapticFeedback('medium');
    setItemToDelete(itemId);
  };

  const handleOpenItem = (item) => {
    hapticFeedback('light');
    setSelectedItem(item);
  };

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
    if (bottom && hasMore && !loading) {
      loadItems();
    }
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
    buildFeedSections(
      filteredItems,
      (item) => item.created_at,
      { getItemKey: (item) => item.id }
    )
  ), [filteredItems]);

  // ✅ FIX: Рендерим модалки через Portal, чтобы они были поверх родительских трансформаций
  const renderModals = () => {
    return createPortal(
      <>
        {editingItem && (
          <EditMarketItemModal
            item={editingItem}
            onClose={() => setEditingItem(null)}
            onSuccess={handleEditSuccess}
          />
        )}

        {selectedItem && (
          <MarketDetail
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
            onUpdate={(updatedItem) => {
              if (updatedItem?.id) {
                setItems(prev => prev.map(i => (
                  String(i.id) === String(updatedItem.id) ? { ...i, ...updatedItem } : i
                )));
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
  };

  return (
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader title={`Мои товары (${counts.all})`} onBack={closeScreen} />

      {/* Filter Tabs */}
      <div style={styles.filterTabs}>
        <button 
          onClick={() => { hapticFeedback('selection'); setFilter('all'); }} 
          style={{...styles.filterTab, ...(filter === 'all' && styles.filterTabActive)}}
        >
          Все {counts.all > 0 && `(${counts.all})`}
        </button>
        <button 
          onClick={() => { hapticFeedback('selection'); setFilter('active'); }} 
          style={{...styles.filterTab, ...(filter === 'active' && styles.filterTabActive)}}
        >
          Активные {counts.active > 0 && `(${counts.active})`}
        </button>
        <button 
          onClick={() => { hapticFeedback('selection'); setFilter('sold'); }} 
          style={{...styles.filterTab, ...(filter === 'sold' && styles.filterTabActive)}}
        >
          Проданные {counts.sold > 0 && `(${counts.sold})`}
        </button>
      </div>

      {/* Items List */}
      <div style={styles.content}>
        {filteredItems.length > 0 ? (
          itemRows.map((row) => (
            row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <div key={row.key} style={{ animation: `fadeInUp 0.4s ease ${row.index * 0.05}s both` }}>
                <MyMarketCard
                  item={row.item}
                  onOpen={handleOpenItem}
                  onEdit={handleEdit}
                  onDelete={() => handleDeleteClick(row.item.id)}
                />
              </div>
            )
          ))
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyEmoji}>📦</div>
            <p style={styles.emptyText}>Нет товаров</p>
            <p style={styles.emptySubtext}>
              {filter === 'all' && 'Создайте первое объявление'}
              {filter === 'active' && 'Все товары проданы'}
              {filter === 'sold' && 'Пока ничего не продано'}
            </p>
          </div>
        )}
        
        {loading && (
          <div style={styles.loading}>Загрузка...</div>
        )}
        
        {!hasMore && items.length > 0 && (
          <div style={styles.endMessage}>
            <div style={styles.endIcon}>✅</div>
            <div>Все товары загружены</div>
          </div>
        )}
      </div>

      {renderModals()}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
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
    zIndex: Z_USER_MARKET_ITEMS,
    backgroundColor: theme.colors.bg,
    overflowY: 'auto',
    paddingBottom: 20,
  },
  
  filterTabs: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.bg,
    position: 'sticky',
    top: 'calc(var(--drilldown-header-height) + env(safe-area-inset-top, 0px))',
    zIndex: 9,
  },
  
  filterTab: {
    flex: 1,
    padding: '8px 12px',
    border: 'none',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  
  filterTabActive: {
    backgroundColor: theme.colors.market,
    color: '#fff',
  },
  
  content: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    animation: 'fadeInUp 0.5s ease',
  },
  
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  
  emptyText: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: 600,
    marginBottom: 8,
  },
  
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  
  loading: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: 20,
    fontSize: 14,
  },
  
  endMessage: {
    textAlign: 'center',
    color: theme.colors.textTertiary,
    padding: '32px 20px',
    fontSize: 14,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  
  endIcon: {
    fontSize: 24,
  },
};

export default UserMarketItems;
