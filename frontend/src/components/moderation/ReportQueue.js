// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ReportQueue.js =====

import React, { useCallback, useRef } from 'react';
import { RefreshCw, Inbox } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import { useSwipe } from '../../hooks/useSwipe';
import ReportCard from './ReportCard';

function ReportQueue({ reports, loading, onProcessed, onRefresh }) {
  const cardRef = useRef(null);

  const currentReport = reports[0];
  const remaining = reports.length;

  const handleProcessed = useCallback((reportId, action) => {
    onProcessed?.(reportId);
  }, [onProcessed]);

  const handleSkip = useCallback(() => {
    if (!currentReport) return;
    hapticFeedback('light');
    handleProcessed(currentReport.id, 'skipped');
  }, [currentReport, handleProcessed]);

  const swipeHandlers = useSwipe({
    elementRef: cardRef,
    onSwipeLeft: handleSkip,
    onSwipeRight: handleSkip,
    isModal: false,
    threshold: 80,
  });

  if (loading) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.spinner} />
        <span style={{ color: theme.colors.textTertiary, fontSize: 14, marginTop: 12 }}>
          Загрузка очереди...
        </span>
      </div>
    );
  }

  if (!currentReport || reports.length === 0) {
    return (
      <div style={styles.emptyState}>
        <Inbox size={48} color={theme.colors.textTertiary} strokeWidth={1.5} />
        <div style={styles.emptyTitle}>Очередь пуста</div>
        <div style={styles.emptySubtitle}>Все жалобы обработаны 🎉</div>
        <button style={styles.refreshBtn} onClick={onRefresh}>
          <RefreshCw size={16} />
          <span>Обновить</span>
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Counter */}
      <div style={styles.counterRow}>
        <span style={styles.counter}>
          {remaining} в очереди
        </span>
        <button style={styles.refreshSmall} onClick={onRefresh}>
          <RefreshCw size={14} color={theme.colors.textTertiary} />
        </button>
      </div>

      {/* Card with swipe */}
      <div ref={cardRef} style={styles.swipeCard} {...swipeHandlers}>
        <ReportCard
          report={currentReport}
          onProcessed={handleProcessed}
        />
      </div>

      {/* Progress dots */}
      {reports.length > 1 && reports.length <= 10 && (
        <div style={styles.dotsRow}>
          {reports.map((_, i) => (
            <div
              key={i}
              style={{
                ...styles.dot,
                backgroundColor: i === 0
                  ? theme.colors.primary
                  : theme.colors.border,
              }}
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
  },

  counterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  counter: {
    fontSize: 13,
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },

  refreshSmall: {
    width: 32,
    height: 32,
    borderRadius: 10,
    background: theme.colors.bgSecondary,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  swipeCard: {
    willChange: 'transform',
    touchAction: 'pan-y',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'grab',
  },

  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    transition: 'background 0.3s',
  },

  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: 4,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: theme.colors.text,
    marginTop: 12,
  },

  emptySubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },

  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    borderRadius: 12,
    background: theme.colors.primary,
    color: '#fff',
    border: 'none',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 16,
  },

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default ReportQueue;
