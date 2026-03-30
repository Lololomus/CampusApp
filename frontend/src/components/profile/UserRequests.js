// ===== FILE: UserRequests.js =====

import { useMemo, useState, useEffect } from 'react';
import { Zap, CheckCircle } from 'lucide-react';
import { getMyRequests, deleteRequest, getRequestById } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import RequestCard from '../requests/RequestCard';
import RequestDetailModal from '../requests/RequestDetailModal';
import EditContentModal from '../shared/EditContentModal';
import ConfirmationDialog from '../shared/ConfirmationDialog';
import { Z_MODAL_REQUEST_DETAIL } from '../../constants/zIndex';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import DrilldownHeader from '../shared/DrilldownHeader';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';
import { parseApiDate } from '../../utils/datetime';
import { lockBodyScroll, unlockBodyScroll } from '../../utils/bodyScrollLock';

const C = {
  bg: '#000000',
  surface: '#1C1C1E',
  surfaceElevated: '#2C2C2E',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  textTertiary: '#666666',
  accent: '#D4FF00',
  accentText: '#000000',
};

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

  const closeScreen = () => setShowUserRequests(false);

  useTelegramScreen({
    id: 'user-requests-screen',
    title: 'Мои запросы',
    priority: 40,
    back: { visible: true, onClick: () => { hapticFeedback('light'); closeScreen(); } },
  });

  useEffect(() => {
    lockBodyScroll();
    loadRequests();
    return () => unlockBodyScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRequests = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newRequests = await getMyRequests(LIMIT, offset);
      if (newRequests.length < LIMIT) setHasMore(false);
      setRequests((prev) => {
        const byId = new Map();
        [...prev, ...newRequests].forEach((r) => byId.set(r.id, r));
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

  const handleEditRequest = async (request) => {
    hapticFeedback('light');
    try {
      const fullRequest = await getRequestById(request.id);
      setEditingRequest(fullRequest);
    } catch (error) {
      console.error('Request load error before edit:', error);
      toast.error('Не удалось загрузить запрос для редактирования');
    }
  };

  const handleDeleteRequest = (request) => { hapticFeedback('medium'); setRequestToDelete(request); };
  const handleOpenRequest = (request) => { hapticFeedback('light'); setCurrentRequest(request); setShowRequestDetail(true); };

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
    if (bottom && hasMore && !loading) loadRequests();
  };

  const now = new Date();
  const filteredRequests = requests.filter(request => {
    const expiresAt = parseApiDate(request.expires_at);
    if (filter === 'all') return true;
    if (filter === 'active') return expiresAt ? expiresAt > now : true;
    if (filter === 'expired') return expiresAt ? expiresAt <= now : false;
    return true;
  });

  const counts = {
    all: requests.length,
    active: requests.filter((r) => { const d = parseApiDate(r.expires_at); return !d || d > now; }).length,
    expired: requests.filter((r) => { const d = parseApiDate(r.expires_at); return !!d && d <= now; }).length,
  };

  const requestRows = useMemo(() => (
    buildFeedSections(filteredRequests, (r) => r.created_at, { getItemKey: (r) => r.id })
  ), [filteredRequests]);

  const FILTERS = [
    { key: 'all', label: 'Все', count: counts.all },
    { key: 'active', label: 'Активные', count: counts.active },
    { key: 'expired', label: 'Истёкшие', count: counts.expired },
  ];

  return (
    <EdgeSwipeBack
      onBack={() => { hapticFeedback('light'); closeScreen(); }}
      disabled={showRequestDetail}
      zIndex={Z_MODAL_REQUEST_DETAIL}
    >
    <div style={styles.container} onScroll={handleScroll}>
      <DrilldownHeader
        title={`Мои запросы (${counts.all})`}
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
        {filteredRequests.length > 0 ? (
          requestRows.map((row, rowIndex) => {
            const isAfterDivider = row.type === 'item' && rowIndex > 0 && requestRows[rowIndex - 1].type === 'divider';
            return row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <div key={row.key} style={{ animation: `fadeInUp 0.35s ease ${row.index * 0.04}s both` }}>
                <RequestCard
                  request={row.item}
                  currentUserId={user?.id}
                  onClick={handleOpenRequest}
                  onEdit={handleEditRequest}
                  onDelete={handleDeleteRequest}
                  compactTop={isAfterDivider}
                />
              </div>
            );
          })
        ) : !loading ? (
          <div style={styles.empty}>
            <Zap size={36} color={C.textTertiary} strokeWidth={1.5} />
            <div style={styles.emptyTitle}>Нет запросов</div>
            <div style={styles.emptySub}>
              {filter === 'all' && 'Создайте первый запрос'}
              {filter === 'active' && 'Все запросы истекли'}
              {filter === 'expired' && 'Нет истёкших запросов'}
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

        {!hasMore && requests.length > 0 && (
          <div style={styles.endMsg}>
            <CheckCircle size={20} color={C.textTertiary} strokeWidth={1.5} />
            <span>Это все ваши запросы</span>
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
          onClose={() => { setShowRequestDetail(false); setCurrentRequest(null); }}
          onEdit={(request) => { setShowRequestDetail(false); setCurrentRequest(null); handleEditRequest(request); }}
          onDelete={(request) => { setShowRequestDetail(false); setCurrentRequest(null); handleDeleteRequest(request); }}
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
    </div>
    </EdgeSwipeBack>
  );
}

const styles = {
  container: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    zIndex: Z_MODAL_REQUEST_DETAIL,
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
    padding: '4px 0 calc(env(safe-area-inset-bottom, 20px) + 20px)',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    padding: '52px 24px', margin: '8px 16px',
    border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: C.text },
  emptySub: { fontSize: 14, color: C.textMuted, lineHeight: 1.5, textAlign: 'center' },
  skeleton: {
    height: 100, borderRadius: 16,
    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  },
  endMsg: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: '28px 20px', margin: '8px 16px 0',
    borderTop: `1px solid ${C.border}`,
    fontSize: 13, fontWeight: 600, color: C.textTertiary,
  },
};

export default UserRequests;
