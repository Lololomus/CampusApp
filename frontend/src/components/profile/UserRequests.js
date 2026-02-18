import React, { useMemo, useState, useEffect } from 'react';
import { getMyRequests, deleteRequest } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import RequestCard from '../requests/RequestCard';
import RequestDetailModal from '../requests/RequestDetailModal';
import EditContentModal from '../shared/EditContentModal';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { Z_MODAL_REQUEST_DETAIL } from '../../constants/zIndex';
import theme from '../../theme';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';

function UserRequests() {
  const { user, setShowUserRequests, setCurrentRequest } = useStore();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('all');
  const [editingRequest, setEditingRequest] = useState(null);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
  
  const LIMIT = 20;

  const closeScreen = () => {
    setShowUserRequests(false);
  };

  const handleTelegramBack = () => {
    hapticFeedback('light');
    closeScreen();
  };

  useTelegramScreen({
    id: 'user-requests-screen',
    title: 'Мои запросы',
    priority: 40,
    back: {
      visible: true,
      onClick: handleTelegramBack,
    },
  });

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
      
      setRequests((prev) => {
        const merged = [...prev, ...newRequests];
        const byId = new Map();
        merged.forEach((req) => byId.set(req.id, req));
        return Array.from(byId.values());
      });
      setOffset((prev) => prev + newRequests.length);
    } catch (error) {
      console.error('Ошибка загрузки запросов:', error);
      toast.error('Не удалось загрузить запросы');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRequest = (request) => {
    hapticFeedback('light');
    setEditingRequest(request);
  };

  const handleDeleteRequest = (request) => {
    hapticFeedback('medium');
    setRequestToDelete(request);
  };

  const handleOpenRequest = (request) => {
    hapticFeedback('light');
    setCurrentRequest(request);
    setShowRequestDetail(true);
  };

  const confirmDeleteRequest = async () => {
    if (!requestToDelete?.id) return;

    try {
      await deleteRequest(requestToDelete.id);
      setRequests(prev => prev.filter(r => r.id !== requestToDelete.id));
      toast.success('Запрос удалён');
      hapticFeedback('success');
    } catch (error) {
      console.error('Delete request error:', error);
      toast.error('Ошибка при удалении запроса');
    } finally {
      setRequestToDelete(null);
    }
  };

  const handleScroll = (e) => {
    const bottom = e.target.scrollHeight - e.target.scrollTop <= e.target.clientHeight + 2;
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

  const requestRows = useMemo(() => (
    buildFeedSections(
      filteredRequests,
      (request) => request.created_at,
      { getItemKey: (request) => request.id }
    )
  ), [filteredRequests]);

  return (
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader title={`Мои запросы (${counts.all})`} onBack={closeScreen} />

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
          requestRows.map((row) => (
            row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <div
                key={row.key}
                style={{
                  animation: `fadeInUp 0.4s ease ${row.index * 0.05}s both`
                }}
              >
                <RequestCard
                  request={row.item}
                  currentUserId={user?.id}
                  onClick={handleOpenRequest}
                  onEdit={handleEditRequest}
                  onDelete={handleDeleteRequest}
                />
              </div>
            )
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

      {editingRequest && (
        <EditContentModal
          contentType="request"
          initialData={editingRequest}
          onClose={() => setEditingRequest(null)}
          onSuccess={(updatedRequest) => {
            setRequests(prev => prev.map(r => (r.id === updatedRequest.id ? updatedRequest : r)));
            setEditingRequest(null);
          }}
        />
      )}

      {showRequestDetail && (
        <RequestDetailModal
          onClose={() => {
            setShowRequestDetail(false);
            setCurrentRequest(null);
          }}
          onEdit={(request) => {
            setShowRequestDetail(false);
            setCurrentRequest(null);
            handleEditRequest(request);
          }}
          onDelete={(request) => {
            setShowRequestDetail(false);
            setCurrentRequest(null);
            handleDeleteRequest(request);
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={!!requestToDelete}
        title="Удалить запрос?"
        message="Это действие нельзя отменить."
        confirmText="Удалить"
        confirmType="danger"
        onConfirm={confirmDeleteRequest}
        onCancel={() => setRequestToDelete(null)}
      />

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



