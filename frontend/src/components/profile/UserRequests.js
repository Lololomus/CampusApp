import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getMyRequests, deleteRequest } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import RequestCard from '../requests/RequestCard';
import { Z_MODAL_REQUEST_DETAIL } from '../../constants/zIndex';
import theme from '../../theme';

function UserRequests() {
  const { user, setShowUserRequests } = useStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  
  const LIMIT = 20;

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const newRequests = await getMyRequests(LIMIT, offset);
      
      if (newRequests.length < LIMIT) {
        setHasMore(false);
      }
      
      setRequests([...requests, ...newRequests]);
      setOffset(offset + LIMIT);
    } catch (error) {
      console.error('Ошибка загрузки запросов:', error);
      toast.error('Не удалось загрузить запросы');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    hapticFeedback('light');
    setShowUserRequests(false);
  };

  const handleRequestDeleted = (requestId) => {
    setRequests(requests.filter(r => r.id !== requestId));
    toast.success('Запрос удалён');
    hapticFeedback('success');
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop === e.target.clientHeight;
    if (bottom && hasMore && !loading) {
      loadRequests();
    }
  };

  const now = new Date();
  const filteredRequests = requests.filter(request => {
    if (filter === 'all') return true;
    if (filter === 'active') {
      return request.expires_at ? new Date(request.expires_at) > now : true;
    }
    if (filter === 'expired') {
      return request.expires_at ? new Date(request.expires_at) <= now : false;
    }
    return true;
  });

  const counts = {
    all: requests.length,
    active: requests.filter(r => !r.expires_at || new Date(r.expires_at) > now).length,
    expired: requests.filter(r => r.expires_at && new Date(r.expires_at) <= now).length,
  };

  return (
    <div style={styles.container} onScroll={handleScroll}>
      {/* Header */}
      <div style={styles.header}>
        <button onClick={handleBack} style={styles.backButton}>
          <ArrowLeft size={24} />
        </button>
        <span style={styles.headerTitle}>Мои запросы ({counts.all})</span>
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
          onClick={() => { hapticFeedback('selection'); setFilter('expired'); }} 
          style={{...styles.filterTab, ...(filter === 'expired' && styles.filterTabActive)}}
        >
          Истёкшие {counts.expired > 0 && `(${counts.expired})`}
        </button>
      </div>

      {/* Requests List */}
      <div style={styles.content}>
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request, idx) => (
            <div 
              key={request.id} 
              style={{
                animation: `fadeInUp 0.4s ease ${idx * 0.05}s both`
              }}
            >
              <RequestCard 
                request={request} 
                onRequestDeleted={handleRequestDeleted}
              />
            </div>
          ))
        ) : (
          <div style={styles.empty}>
            <div style={styles.emptyEmoji}>⚡</div>
            <p style={styles.emptyText}>Нет запросов</p>
            <p style={styles.emptySubtext}>
              {filter === 'all' && 'Создайте первый запрос'}
              {filter === 'active' && 'Все запросы истекли'}
              {filter === 'expired' && 'Нет истёкших запросов'}
            </p>
          </div>
        )}

        {loading && (
          <div style={styles.loading}>Загрузка...</div>
        )}

        {!hasMore && requests.length > 0 && (
          <div style={styles.endMessage}>
            <div style={styles.endIcon}>✨</div>
            <div>Это все ваши запросы</div>
          </div>
        )}
      </div>

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
    zIndex: Z_MODAL_REQUEST_DETAIL,
    backgroundColor: theme.colors.bg,
    overflowY: 'auto',
    paddingBottom: '20px',
  },
  header: {
    position: 'sticky',
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
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
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    minWidth: '44px',
    minHeight: '44px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: '600',
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
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  content: {
    padding: '16px',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    animation: 'fadeInUp 0.5s ease',
  },
  emptyEmoji: {
    fontSize: '64px',
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '18px',
    color: theme.colors.text,
    fontWeight: '600',
    marginBottom: '8px',
  },
  emptySubtext: {
    fontSize: '14px',
    color: theme.colors.textSecondary,
    lineHeight: '1.5',
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
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  endIcon: {
    fontSize: '24px',
  },
};

export default UserRequests;