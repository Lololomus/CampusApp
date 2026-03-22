// ===== 📄 ФАЙЛ: frontend/src/components/moderation/AmbassadorDashboard.js =====

import React from 'react';
import { AlertCircle, CheckCircle, Ban, Clock, TrendingUp } from 'lucide-react';
import theme from '../../theme';

function AmbassadorDashboard({ stats, pendingCount, loading }) {
  const todayProcessed = stats?.today_processed || 0;
  const totalBanned = stats?.total_banned || 0;
  const avgResponseTime = stats?.avg_response_time || '—';
  const accuracy = stats?.accuracy || null;

  const cards = [
    {
      icon: AlertCircle,
      label: 'Ожидают',
      value: pendingCount,
      color: pendingCount > 0 ? '#ef4444' : '#22c55e',
      gradient: pendingCount > 0 
        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08))'
        : 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08))',
      borderColor: pendingCount > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)',
    },
    {
      icon: CheckCircle,
      label: 'Обработано сегодня',
      value: todayProcessed,
      color: '#3b82f6',
      gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.08))',
      borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    {
      icon: Ban,
      label: 'Забанено',
      value: totalBanned,
      color: theme.colors.premium.primary,
      gradient: 'linear-gradient(135deg, rgba(212, 255, 0, 0.15), rgba(212, 255, 0, 0.08))',
      borderColor: 'rgba(212, 255, 0, 0.3)',
    },
    {
      icon: Clock,
      label: 'Ср. время ответа',
      value: typeof avgResponseTime === 'number' ? `${avgResponseTime}м` : avgResponseTime,
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.08))',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
  ];

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <span style={{ color: theme.colors.textTertiary, fontSize: 14, marginTop: 12 }}>
          Загрузка...
        </span>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              style={{
                ...styles.card,
                background: card.gradient,
                borderColor: card.borderColor,
              }}
            >
              <div style={{ ...styles.iconWrap, backgroundColor: `${card.color}20` }}>
                <Icon size={20} color={card.color} />
              </div>
              <div style={{ ...styles.value, color: card.color }}>{card.value}</div>
              <div style={styles.label}>{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Accuracy bar */}
      {accuracy !== null && (
        <div style={styles.accuracyCard}>
          <div style={styles.accuracyHeader}>
            <TrendingUp size={16} color={theme.colors.premium.primary} />
            <span style={styles.accuracyTitle}>Точность модерации</span>
            <span style={{ ...styles.accuracyPercent, color: accuracy >= 80 ? '#22c55e' : '#f59e0b' }}>
              {accuracy}%
            </span>
          </div>
          <div style={styles.progressBar}>
            <div
              style={{
                ...styles.progressFill,
                width: `${Math.min(accuracy, 100)}%`,
                backgroundColor: accuracy >= 80 ? '#22c55e' : accuracy >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
          <div style={styles.accuracyHint}>
            Процент решений, не отменённых админом
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div style={styles.tipsCard}>
        <div style={styles.tipsTitle}>💡 Советы</div>
        <div style={styles.tip}>• В очереди — свайп влево чтобы пропустить</div>
        <div style={styles.tip}>• Для серьёзных действий (бан) нужна причина</div>
        <div style={styles.tip}>• Все действия логируются и видны админу</div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 0',
  },

  spinner: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.premium.primary,
    animation: 'spin 0.8s linear infinite',
  },

  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },

  card: {
    borderRadius: 16,
    padding: '16px 14px',
    border: '1px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    backdropFilter: 'blur(10px)',
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  value: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
  },

  label: {
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.textSecondary,
  },

  accuracyCard: {
    background: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    border: `1px solid ${theme.colors.border}`,
  },

  accuracyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  accuracyTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.text,
  },

  accuracyPercent: {
    fontSize: 18,
    fontWeight: 800,
  },

  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.bgSecondary,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.6s ease',
  },

  accuracyHint: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginTop: 6,
  },

  tipsCard: {
    background: theme.colors.card,
    borderRadius: 16,
    padding: 16,
    border: `1px solid ${theme.colors.border}`,
  },

  tipsTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: theme.colors.text,
    marginBottom: 8,
  },

  tip: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 1.6,
  },
};

export default AmbassadorDashboard;
