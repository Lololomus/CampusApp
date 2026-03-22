// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ActionFeed.js =====

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  RotateCcw, Trash2, Ban, Pin, CheckCircle, Eye,
  Filter, RefreshCw, AlertTriangle, Clock, Shield
} from 'lucide-react';
import { getModerationLogs } from '../../api';
import { useStore } from '../../store';
import { toast } from '../shared/Toast';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import FeedDateDivider from '../shared/FeedDateDivider';
import { buildFeedSections } from '../../utils/feedDateSections';

const ACTION_CONFIG = {
  delete_post: { icon: Trash2, label: 'Удалил пост', color: '#f59e0b', heavy: false },
  delete_comment: { icon: Trash2, label: 'Удалил коммент', color: '#f59e0b', heavy: false },
  delete_request: { icon: Trash2, label: 'Удалил запрос', color: '#f59e0b', heavy: false },
  delete_market_item: { icon: Trash2, label: 'Удалил товар', color: '#f59e0b', heavy: false },
  shadow_ban: { icon: Ban, label: 'Забанил', color: '#ef4444', heavy: true },
  shadow_unban: { icon: CheckCircle, label: 'Разбанил', color: '#22c55e', heavy: false },
  pin_post: { icon: Pin, label: 'Закрепил', color: '#3b82f6', heavy: false },
  unpin_post: { icon: Pin, label: 'Открепил', color: '#6b7280', heavy: false },
};

function ActionFeed({ onReverse }) {
  const { user } = useStore();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    moderator_id: null,
    action: null,
    heavyOnly: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [reversingId, setReversingId] = useState(null);
  const loadMoreTriggerRef = useRef(null);
  const observerRef = useRef(null);

  const logRows = useMemo(() => (
    buildFeedSections(
      logs,
      (log) => log.created_at,
      { getItemKey: (log, index) => log.id || `log-${index}` }
    )
  ), [logs]);

  const loadLogs = useCallback(async (reset = false) => {
    if (loading && !reset) return;

    setLoading(true);
    try {
      const params = {
        limit: 30,
        offset: reset ? 0 : offset,
      };
      if (filters.moderator_id) params.moderator_id = filters.moderator_id;
      if (filters.action) params.action = filters.action;

      const data = await getModerationLogs(params);
      let items = Array.isArray(data) ? data : data?.items || [];

      if (filters.heavyOnly) {
        items = items.filter(log => ACTION_CONFIG[log.action]?.heavy);
      }

      if (reset) {
        setLogs(items);
        setOffset(items.length);
      } else {
        setLogs(prev => [...prev, ...items]);
        setOffset(prev => prev + items.length);
      }
      setHasMore(items.length >= 30);
    } catch (err) {
      console.error('ActionFeed load error:', err);
      toast.error('Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  }, [loading, offset, filters]);

  useEffect(() => {
    loadLogs(true);
  }, [filters.moderator_id, filters.action, filters.heavyOnly]);

  useEffect(() => {
    if (!hasMore || loading || logs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) {
          loadLogs(false);
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );

    observerRef.current = observer;
    if (loadMoreTriggerRef.current) observer.observe(loadMoreTriggerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, logs.length, loadLogs]);

  const handleReverse = async (log) => {
    hapticFeedback('heavy');
    setReversingId(log.id);
    try {
      // Callback к AdminPanel для выполнения reversal через API
      await onReverse?.(log);
      setLogs(prev => prev.map(l =>
        l.id === log.id ? { ...l, review_status: 'reversed' } : l
      ));
      toast.success('Действие отменено');
    } catch (err) {
      toast.error('Ошибка отмены');
      console.error(err);
    } finally {
      setReversingId(null);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now - d) / 60000);
    if (diffMin < 1) return 'только что';
    if (diffMin < 60) return `${diffMin} мин`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ч`;
    return `${Math.floor(diffHr / 24)} д`;
  };

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.toolbarTitle}>Действия модераторов</span>
        <div style={styles.toolbarButtons}>
          <button
            style={{
              ...styles.toolbarBtn,
              color: filters.heavyOnly ? '#ef4444' : theme.colors.textTertiary,
              borderColor: filters.heavyOnly ? '#ef4444' : theme.colors.border,
            }}
            onClick={() => setFilters(f => ({ ...f, heavyOnly: !f.heavyOnly }))}
          >
            <AlertTriangle size={14} />
          </button>
          <button
            style={styles.toolbarBtn}
            onClick={() => loadLogs(true)}
          >
            <RefreshCw size={14} color={theme.colors.textTertiary} />
          </button>
        </div>
      </div>

      {/* Feed */}
      {loading && logs.length === 0 ? (
        <div style={styles.loadingState}>
          <div style={styles.spinner} />
        </div>
      ) : logs.length === 0 ? (
        <div style={styles.emptyState}>
          <Shield size={40} color={theme.colors.textTertiary} strokeWidth={1.5} />
          <div style={{ fontSize: 15, color: theme.colors.textSecondary, marginTop: 10 }}>
            Нет действий
          </div>
        </div>
      ) : (
        <div style={styles.feed}>
          {logRows.map((row) => {
            if (row.type === 'divider') {
              return <FeedDateDivider key={row.key} label={row.label} />;
            }

            const log = row.item;
            const moderatorId = log?.moderator?.id ?? log?.moderator_id ?? null;
            const moderatorName = log?.moderator?.name || log?.moderator_name || (moderatorId ? `Модератор #${moderatorId}` : 'Модератор');
            const isCurrentModerator = moderatorId !== null && user?.id === moderatorId;
            const cfg = ACTION_CONFIG[log.action] || {
              icon: Clock, label: log.action, color: '#6b7280', heavy: false
            };
            const ActionIcon = cfg.icon;
            const isReversed = log.review_status === 'reversed';
            const isReversing = reversingId === log.id;

            return (
              <div
                key={row.key}
                style={{
                  ...styles.feedItem,
                  opacity: isReversed ? 0.5 : 1,
                  borderLeftColor: cfg.color,
                }}
              >
                <div style={styles.feedHeader}>
                  <div style={styles.feedMod}>
                    <Shield size={14} color={theme.colors.premium.primary} />
                    <span style={styles.modName}>
                      {moderatorName}
                      {isCurrentModerator ? ' (Вы)' : ''}
                    </span>
                  </div>
                  <span style={styles.feedTime}>{formatTime(log.created_at)}</span>
                </div>

                <div style={styles.feedBody}>
                  <ActionIcon size={15} color={cfg.color} />
                  <span style={{ color: cfg.color, fontWeight: 600, fontSize: 13 }}>
                    {cfg.label}
                  </span>
                  {log.target_type && (
                    <span style={styles.targetInfo}>
                      #{log.target_id}
                    </span>
                  )}
                </div>

                {log.reason && (
                  <div style={styles.feedReason}>«{log.reason}»</div>
                )}

                {/* Actions */}
                <div style={styles.feedActions}>
                  {!isReversed ? (
                    <button
                      style={styles.reverseBtn}
                      onClick={() => handleReverse(log)}
                      disabled={isReversing}
                    >
                      <RotateCcw size={14} />
                      <span>{isReversing ? '...' : 'Отменить'}</span>
                    </button>
                  ) : (
                    <span style={styles.reversedLabel}>
                      ↩️ Отменено
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && logs.length > 0 && (
        <div ref={loadMoreTriggerRef} style={styles.loadMoreTrigger} />
      )}
      {hasMore && logs.length > 0 && (
        <button
          style={styles.loadMoreBtn}
          onClick={() => loadLogs(false)}
          disabled={loading}
        >
          {loading ? <div style={styles.spinnerSmall} /> : 'Загрузить ещё'}
        </button>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 16px',
  },

  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  toolbarTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: theme.colors.text,
  },

  toolbarButtons: {
    display: 'flex',
    gap: 6,
  },

  toolbarBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  feed: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  feedItem: {
    background: theme.colors.card,
    borderRadius: 14,
    padding: '12px 14px',
    border: `1px solid ${theme.colors.borderLight}`,
    borderLeft: '3px solid',
    transition: 'opacity 0.3s',
  },

  feedHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  feedMod: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },

  modName: {
    fontSize: 13,
    fontWeight: 700,
    color: theme.colors.text,
  },

  feedTime: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    fontWeight: 500,
  },

  feedBody: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  targetInfo: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    fontWeight: 500,
  },

  feedReason: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 6,
    paddingLeft: 21,
  },

  feedActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 21,
  },

  reverseBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '5px 12px',
    borderRadius: 8,
    background: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },

  reversedLabel: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: 600,
  },

  loadMoreBtn: {
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreTrigger: {
    height: 4,
  },

  loadingState: {
    display: 'flex',
    justifyContent: 'center',
    padding: '50px 0',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '50px 20px',
  },

  spinner: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.premium.primary,
    animation: 'spin 0.8s linear infinite',
  },

  spinnerSmall: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    border: `2px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.premium.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default ActionFeed;
