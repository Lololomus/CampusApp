// ===== 📄 ФАЙЛ: src/components/profile/UserMarketItems.js =====

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Filter } from 'lucide-react';
import { getMyMarketItems, deleteMarketItem } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import MyMarketCard from './MyMarketCard';
import { Z_USER_MARKET_ITEMS } from '../../constants/zIndex';
import theme from '../../theme';

function UserMarketItems() {
  const { user, setShowUserMarketItems, setEditingMarketItem, setShowCreateMarketItem } = useStore();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'sold'
  
  const LIMIT = 20;

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await getMyMarketItems(LIMIT, offset);
      if (newItems.length < LIMIT) setHasMore(false);
      setItems([...items, ...newItems]);
      setOffset(offset + LIMIT);
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setShowUserMarketItems(false);
  };

  const handleEdit = (item) => {
    setEditingMarketItem(item);
    setShowCreateMarketItem(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteMarketItem(itemId);
      setItems(items.filter(i => i.id !== itemId));
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete error:', error);
      alert('Ошибка при удалении');
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

  return (
    <div style={styles.container} onScroll={handleScroll}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Мои товары ({counts.all})</span>
        <div style={{ width: 44 }}></div>
      </div>

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
          filteredItems.map((item, idx) => (
            <div key={item.id} style={{ animation: `fadeInUp 0.4s ease ${idx * 0.05}s both` }}>
              <MyMarketCard 
                item={item} 
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            </div>
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

      {/* Animation */}
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
    zIndex: 1002, // Z_USER_MARKET_ITEMS
    backgroundColor: theme.colors.bg,
    overflowY: 'auto',
    paddingBottom: 20,
  },
  
  header: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 16px',
    backgroundColor: '#1a1a1a',
    borderBottom: `1px solid ${theme.colors.border}`,
    zIndex: 10,
    backdropFilter: 'blur(10px)',
  },
  
  backButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.text,
    cursor: 'pointer',
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: theme.colors.text,
    flex: 1,
    textAlign: 'center',
  },
  
  filterTabs: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.bg,
    position: 'sticky',
    top: 57,
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