// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ModerationHistory.js =====

import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, Trash2, Ban, Pin, RefreshCw } from 'lucide-react';
import { getModerationLogs } from '../../api';
import { useStore } from '../../store';
import { toast } from '../shared/Toast';
import theme from '../../theme';

const ACTION_CONFIG = {
  delete_post: { icon: Trash2, label: 'Удалён пост', color: '#f59e0b' },
  delete_comment: { icon: Trash2, label: 'Удалён комментарий', color: '#f59e0b' },
  delete_request: { icon: Trash2, label: 'Удалён запрос', color: '#f59e0b' },
  delete_market_item: { icon: Trash2, label: 'Удалён товар', color: '#f59e0b' },
  shadow_ban: { icon: Ban, label: 'Бан', color: '#ef4444' },
  shadow_unban: { icon: CheckCircle, label: 'Разбан', color: '#22c55e' },
  pin_post: { icon: Pin, label: 'Закреплён пост', color: '#3b82f6' },
  unpin_post: { icon: Pin, label: 'Откреплён пост', color: '#6b7280' },
};

const STATUS_CONFIG = {
  confirmed: { icon: CheckCircle, label: 'Подтверждено', color: '#22c55e' },
  pending: { icon: Clock, label: 'На проверке', color: '#f59e0b' },
  reversed: { icon: XCircle, label: 'Отменено админом', color: '#ef4444' },
};

function ModerationHistory() {
  const { user } = useStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadLogs = async (reset = false) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const data = await getModerationLogs({
        moderator_id: user.id,
        limit: 30,
        offset: newOffset,
      });
      const items = Array.isArray(data) ? data : data?.items || [];
      if (reset) {
        setLogs(items);
        setOffset(items.length);
      } else {
        setLogs(prev => [...prev, ...items]);
        setOffset(prev => prev + items.length);
      }
      setHasMore(items.length >= 30);
    } catch (err) {
      console.error('History load error:', err);
      toast.error('Ошибка загрузки истории');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs(true);
  }, []);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин назад`;
    if (diffHr < 24) return `${diffHr} ч назад`;
    if (diffDay < 7) return `${diffDay} д назад`;
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  if (loading && logs.length === 0) {
    return (
      <div style={styles.loadingState}>
        <div style={styles.spinner} />
        <span style={{ color: theme.colors.textTertiary, fontSize: 14, marginTop: 12 }}>
          Загрузка истории...
        </span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Clock size={40} color={theme.colors.textTertiary} strokeWidth={1.5} />
        <div style={styles.emptyTitle}>Нет действий</div>
        <div style={styles.emptySubtitle}>Обработайте первую жалобу</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.list}>
        {logs.map((log, i) => {
          const actionCfg = ACTION_CONFIG[log.action] || {
            icon: Clock, label: log.action, color: '#6b7280'
          };
          const statusCfg = STATUS_CONFIG[log.review_status] || STATUS_CONFIG.pending;
          const ActionIcon = actionCfg.icon;
          const StatusIcon = statusCfg.icon;

          return (
            <div key={log.id || i} style={styles.logItem}>
              {/* Left icon */}
              <div style={{ ...styles.iconWrap, backgroundColor: `${actionCfg.color}15` }}>
                <ActionIcon size={16} color={actionCfg.color} />
              </div>

              {/* Content */}
              <div style={styles.logContent}>
                <div style={styles.logAction}>{actionCfg.label}</div>
                {log.reason && (
                  <div style={styles.logReason}>«{log.reason}»</div>
                )}
                <div style={styles.logMeta}>
                  <span>{formatTime(log.created_at)}</span>
                  {log.target_type && (
                    <span> · {log.target_type} #{log.target_id}</span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div style={{ ...styles.statusBadge, color: statusCfg.color }}>
                <StatusIcon size={14} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          style={styles.loadMoreBtn}
          onClick={() => loadLogs(false)}
          disabled={loading}
        >
          {loading ? (
            <div style={styles.spinnerSmall} />
          ) : (
            <>
              <RefreshCw size={14} />
              <span>Загрузить ещё</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 16px',
  },

  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },

  logItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '12px 14px',
    background: theme.colors.card,
    borderRadius: 14,
    border: `1px solid ${theme.colors.borderLight}`,
  },

  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },

  logContent: {
    flex: 1,
    minWidth: 0,
  },

  logAction: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.text,
    marginBottom: 2,
  },

  logReason: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  logMeta: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: 500,
  },

  statusBadge: {
    flexShrink: 0,
    marginTop: 4,
  },

  loadMoreBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    padding: '12px',
    borderRadius: 12,
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 12,
  },

  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 0',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '60px 20px',
    gap: 4,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: theme.colors.text,
    marginTop: 10,
  },

  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    animation: 'spin 0.8s linear infinite',
  },

  spinnerSmall: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default ModerationHistory;