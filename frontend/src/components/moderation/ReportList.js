// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ReportList.js =====

import React, { useState } from 'react';
import { Filter, RefreshCw, Inbox } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import { getReports } from '../../api';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import ReportCard from './ReportCard';

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Ожидают' },
  { id: 'resolved', label: 'Решено' },
  { id: 'dismissed', label: 'Отклонено' },
];

const TYPE_OPTIONS = [
  { id: 'all', label: 'Все' },
  { id: 'post', label: 'Посты' },
  { id: 'comment', label: 'Комменты' },
  { id: 'request', label: 'Запросы' },
  { id: 'market_item', label: 'Товары' },
];

function ReportList({ reports: initialReports, loading, onProcessed, onRefresh }) {
  const [status, setStatus] = useState('pending');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [reports, setReports] = useState(initialReports);
  const [localLoading, setLocalLoading] = useState(false);

  // Sync с props для pending (начальных)
  React.useEffect(() => {
    if (status === 'pending') setReports(initialReports);
  }, [initialReports, status]);

  const handleStatusChange = async (newStatus) => {
    hapticFeedback('selection');
    setStatus(newStatus);
    if (newStatus === 'pending') {
      setReports(initialReports);
      return;
    }
    setLocalLoading(true);
    try {
      const data = await getReports(newStatus, typeFilter === 'all' ? null : typeFilter, 50, 0);
      setReports(Array.isArray(data) ? data : data?.items || []);
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
      const data = await getReports(status, type === 'all' ? null : type, 50, 0);
      setReports(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      toast.error('Ошибка загрузки');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleProcessed = (reportId) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
    onProcessed?.(reportId);
  };

  const filteredReports = typeFilter === 'all'
    ? reports
    : reports.filter(r => r.target_type === typeFilter);

  const isLoading = loading || localLoading;

  return (
    <div style={styles.container}>
      {/* Status tabs */}
      <div style={styles.statusRow}>
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.id}
            style={{
              ...styles.statusChip,
              background: status === opt.id ? theme.colors.primary : 'transparent',
              color: status === opt.id ? '#fff' : theme.colors.textSecondary,
              borderColor: status === opt.id ? theme.colors.primary : theme.colors.border,
            }}
            onClick={() => handleStatusChange(opt.id)}
          >
            {opt.label}
          </button>
        ))}
        <button
          style={{
            ...styles.filterToggle,
            color: showFilters ? theme.colors.primary : theme.colors.textTertiary,
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
                background: typeFilter === opt.id ? theme.colors.primaryLight : 'transparent',
                color: typeFilter === opt.id ? theme.colors.primary : theme.colors.textSecondary,
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
          <button style={styles.refreshBtn} onClick={onRefresh}>
            <RefreshCw size={14} />
            <span>Обновить</span>
          </button>
        </div>
      ) : (
        <div style={styles.list}>
          {filteredReports.map(report => (
            <ReportCard
              key={report.id}
              report={report}
              onProcessed={handleProcessed}
              compact={true}
            />
          ))}
        </div>
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
    borderTopColor: theme.colors.primary,
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
};

export default ReportList;