// ===== 📄 ФАЙЛ: frontend/src/components/moderation/ReportQueue.js =====

import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw, Inbox } from 'lucide-react';
import { hapticFeedback } from '../../utils/telegram';
import theme from '../../theme';
import ReportCard from './ReportCard';

function ReportQueue({ reports, loading, onProcessed, onRefresh }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef(null);

  const currentReport = reports[currentIndex];
  const remaining = reports.length - currentIndex;

  const goNext = useCallback(() => {
    setSwipeOffset(0);
    setCurrentIndex(prev => Math.min(prev + 1, reports.length));
  }, [reports.length]);

  const handleProcessed = useCallback((reportId, action) => {
    onProcessed?.(reportId);
    // Не двигаем индекс — массив reports сам уменьшится через родителя
  }, [onProcessed]);

  // === SWIPE ===
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!swiping) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Определяем направление свайпа
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        isHorizontalSwipe.current = Math.abs(dx) > Math.abs(dy);
      }
    }

    if (isHorizontalSwipe.current) {
      e.preventDefault();
      setSwipeOffset(dx);
    }
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (Math.abs(swipeOffset) > 100) {
      // Свайп влево — skip (пропустить)
      hapticFeedback('light');
      handleProcessed(currentReport?.id, 'skipped');
    }
    setSwipeOffset(0);
    isHorizontalSwipe.current = null;
  };

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

  const opacity = 1 - Math.abs(swipeOffset) / 300;
  const rotate = swipeOffset * 0.05;

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
      <div
        style={styles.cardWrapper}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            ...styles.swipeCard,
            transform: `translateX(${swipeOffset}px) rotate(${rotate}deg)`,
            opacity: Math.max(opacity, 0.3),
            transition: swiping ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
          }}
        >
          <ReportCard
            report={currentReport}
            onProcessed={handleProcessed}
          />
        </div>

        {/* Swipe hints */}
        {Math.abs(swipeOffset) > 50 && (
          <div style={{
            ...styles.swipeHint,
            left: swipeOffset < 0 ? 'auto' : 20,
            right: swipeOffset < 0 ? 20 : 'auto',
          }}>
            {swipeOffset < 0 ? '⏭️ Пропустить' : '⏭️ Пропустить'}
          </div>
        )}
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

  cardWrapper: {
    position: 'relative',
    touchAction: 'pan-y',
  },

  swipeCard: {
    willChange: 'transform, opacity',
  },

  swipeHint: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.textTertiary,
    pointerEvents: 'none',
    zIndex: 10,
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