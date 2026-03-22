// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ReportList.js =====

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Filter, RefreshCw, Inbox } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import { getReports } from '../../api';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import ReportCard from './ReportCard';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Ожидают' },
  { id: 'reviewed', label: 'Решено' },
  { id: 'dismissed', label: 'Отклонено' },
];

const TYPE_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'post', label: 'Посты' },
  { id: 'comment', label: 'Комменты' },
  { id: 'request', label: 'Запросы' },
  { id: 'market_item', label: 'Товары' },
  { id: 'user', label: 'Пользователи' },
];

function ReportList({ reports: initialReports, loading, onProcessed, onRefresh }) {
  const PAGE_SIZE = 50;
  const [status, setStatus] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [reports, setReports] = useState(initialReports || []);
  const [localLoading, setLocalLoading] = useState(false);
  const [offset, setOffset] = useState((initialReports || []).length);
  const [hasMore, setHasMore] = useState((initialReports || []).length >= PAGE_SIZE);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);

  // Sync с props для pending (начальных)
  useEffect(() => {
    if (status === 'pending' && typeFilter === 'all') {
      const incoming = initialReports || [];
      setReports(incoming);
      setOffset(incoming.length);
      setHasMore(incoming.length >= PAGE_SIZE);
    }
  }, [PAGE_SIZE, initialReports, status, typeFilter]);

  const handleStatusChange = async (newStatus) => {
    hapticFeedback('selection');
    setStatus(newStatus);
    if (newStatus === 'pending') {
      const incoming = initialReports || [];
      setReports(incoming);
      setOffset(incoming.length);
      setHasMore(incoming.length >= PAGE_SIZE);
      return;
    }
    setLocalLoading(true);
    try {
      const data = await getReports(newStatus, typeFilter === 'all' ? null : typeFilter, PAGE_SIZE, 0);
      const items = Array.isArray(data) ? data : data?.items || [];
      setReports(items);
      setOffset(items.length);
      setHasMore(Array.isArray(data) ? items.length >= PAGE_SIZE : Boolean(data?.has_more));
    } catch (err) {
      toast.error('Ошибка загрузки');
      console.error(err);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleTypeFilter = async (type) => {
    hapticFeedback('selection');
    setTypeFilter(type);
    setLocalLoading(true);
    try {
      const data = await getReports(status, type === 'all' ? null : type, PAGE_SIZE, 0);
      const items = Array.isArray(data) ? data : data?.items || [];
      setReports(items);
      setOffset(items.length);
      setHasMore(Array.isArray(data) ? items.length >= PAGE_SIZE : Boolean(data?.has_more));
    } catch (err) {
      toast.error('Ошибка загрузки');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (localLoading || !hasMore) return;

    setLocalLoading(true);
    try {
      const data = await getReports(
        status,
        typeFilter === 'all' ? null : typeFilter,
        PAGE_SIZE,
        offset
      );
      const items = Array.isArray(data) ? data : data?.items || [];
      setReports((prev) => {
        const merged = [...prev, ...items];
        const byId = new Map();
        merged.forEach((report) => byId.set(report.id, report));
        return Array.from(byId.values());
      });
      setOffset((prev) => prev + items.length);
      setHasMore(Array.isArray(data) ? items.length >= PAGE_SIZE : Boolean(data?.has_more));
    } catch (err) {
      toast.error('Ошибка загрузки');
      console.error(err);
    } finally {
      setLocalLoading(false);
    }
  }, [PAGE_SIZE, hasMore, localLoading, offset, status, typeFilter]);

  const handleProcessed = (reportId) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    onProcessed?.(reportId);
  };

  const filteredReports = typeFilter === 'all'
    ? reports
    : reports.filter(r => r.target_type === typeFilter);

  const reportRows = useMemo(() => (
    buildFeedSections(
      filteredReports,
      (report) => report.created_at,
      { getItemKey: (report, index) => report.id || `report-${index}` }
    )
  ), [filteredReports]);

  useEffect(() => {
    if (!hasMore || localLoading || filteredReports.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !localLoading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerRef.current = observer;
    if (loadMoreTriggerRef.current) observer.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [filteredReports.length, hasMore, localLoading, handleLoadMore]);

  const isLoading = loading || (localLoading && reports.length === 0);

  return (
    <div style={styles.container}>
      {/* Status tabs */}
      <div style={styles.statusRow}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.id}
            style={{
              ...styles.statusChip,
              background: status === opt.id ? theme.colors.premium.primary : 'transparent',
              color: status === opt.id ? theme.colors.premium.primaryText : theme.colors.textSecondary,
              borderColor: status === opt.id ? theme.colors.premium.primary : theme.colors.border,
            }}
            onClick={() => handleStatusChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
        <button
          style={{
            ...styles.filterToggle,
            color: showFilters ? theme.colors.premium.primary : theme.colors.textTertiary,
          }}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} />
        </button>
      </div>

      {/* Type filters */}
      {showFilters && (
        <div style={styles.typeRow}>
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              style={{
                ...styles.typeChip,
                background: typeFilter === opt.id ? `${theme.colors.premium.primary}1A` : 'transparent',
                color: typeFilter === opt.id ? theme.colors.premium.primary : theme.colors.textSecondary,
              }}
              onClick={() => handleTypeFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
        </div>
      ) : filteredReports.length === 0 ? (
        <div style={styles.emptyState}>
          <Inbox size={40} color={theme.colors.textTertiary} strokeWidth={1.5} />
          <div style={styles.emptyText}>Нет жалоб</div>
          <button
            style={styles.refreshBtn}
            onClick={() => {
              if (status === 'pending' && typeFilter === 'all') onRefresh?.();
              else handleTypeFilter(typeFilter);
            }}
          >
            <RefreshCw size={14} />
            <span>Обновить</span>
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {reportRows.map((row) => (
            row.type === 'divider' ? (
              <FeedDateDivider key={row.key} label={row.label} />
            ) : (
              <ReportCard
                key={row.key}
                report={row.item}
                onProcessed={handleProcessed}
                compact={true}
              />
            )
          ))}
        </div>
      )}

      {!loading && hasMore && filteredReports.length > 0 && (
        <>
          <div ref={loadMoreTriggerRef} style={styles.loadMoreTrigger} />
          <button
            style={styles.loadMoreBtn}
            onClick={handleLoadMore}
            disabled={localLoading}
          >
            {localLoading ? (
              <div style={styles.spinnerSmall} />
            ) : (
              <>
                <RefreshCw size={14} />
                <span>Загрузить ещё</span>
              </>
            )}
          </button>
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  statusRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },

  statusChip: {
    padding: '7px 14px',
    borderRadius: 10,
    border: '1.5px solid',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: 'none',
  },

  filterToggle: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  typeRow: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },

  typeChip: {
    padding: '5px 12px',
    borderRadius: 8,
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px 0',
  },

  spinner: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.premium.primary,
    animation: 'spin 0.8s linear infinite',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    gap: 6,
  },

  emptyText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },

  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
  loadMoreTrigger: {
    height: 4,
  },
  loadMoreBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '10px',
    borderRadius: 10,
    background: theme.colors.bgSecondary,
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  spinnerSmall: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.premium.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default ReportList;
