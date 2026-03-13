// ===== FILE: AmbassadorPanel.js =====

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BarChart3, Layers, Megaphone, Clock, Building2, TrendingUp } from 'lucide-react';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { getReports, getAdminStats } from '../../api';
import theme from '../../theme';

import AmbassadorDashboard from './AmbassadorDashboard';
import ReportQueue from './ReportQueue';
import ReportList from './ReportList';
import ModerationHistory from './ModerationHistory';
import CampaignManager from './CampaignManager';
import CampusManager from './CampusManager';

const P = theme.colors.premium;

const TABS = [
  { id: 'dashboard', label: 'Обзор', icon: BarChart3 },
  { id: 'reports', label: 'Жалобы', icon: Layers },
  { id: 'campuses', label: 'Кампусы', icon: Building2 },
  { id: 'campaigns', label: 'Реклама', icon: Megaphone },
  { id: 'history', label: 'История', icon: Clock },
  { id: 'kpi', label: 'KPI', icon: TrendingUp },
];

function AmbassadorPanel() {
  const { setActiveTab: setNavigationTab, moderationRole } = useStore();
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const canModerate = moderationRole?.can_moderate === true;

  const loadData = useCallback(async () => {
    if (!canModerate) return;
    setLoading(true);
    try {
      const [reportsData, statsData] = await Promise.allSettled([
        getReports('pending', null, 100, 0),
        getAdminStats().catch(() => null),
      ]);
      if (reportsData.status === 'fulfilled') {
        setReports(Array.isArray(reportsData.value) ? reportsData.value : reportsData.value?.items || []);
      }
      if (statsData.status === 'fulfilled' && statsData.value) {
        setStats(statsData.value);
      }
    } catch (err) {
      console.error('AmbassadorPanel load error:', err);
    } finally {
      setLoading(false);
    }
  }, [canModerate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = () => {
    hapticFeedback('light');
    setNavigationTab('profile');
  };

  const handleReportProcessed = (reportId) => {
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  if (!canModerate) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, color: P.textMuted }}>Нет доступа</div>
        </div>
      </div>
    );
  }

  const pendingCount = reports.length;
  const tabSlots = [...TABS, ...Array(Math.max(0, 6 - TABS.length)).fill(null)];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <div style={styles.headerTitle}>
          <span>🛡️ Модерация</span>
          {pendingCount > 0 && (
            <span style={styles.headerBadge}>{pendingCount}</span>
          )}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <div style={styles.tabsWrapper}>
          {tabSlots.map((t, index) => {
            if (!t) {
              return <div key={`empty-${index}`} style={styles.tabSlotPlaceholder} />;
            }
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { hapticFeedback('selection'); setTab(t.id); }}
                style={{
                  ...styles.tabButton,
                  ...(isActive ? styles.tabButtonActive : null),
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {tab === 'dashboard' && (
          <AmbassadorDashboard stats={stats} pendingCount={pendingCount} loading={loading} />
        )}
        {tab === 'reports' && (
          <ReportsTab reports={reports} loading={loading} onProcessed={handleReportProcessed} onRefresh={loadData} />
        )}
        {tab === 'campuses' && <CampusManager isAdmin={false} />}
        {tab === 'campaigns' && <CampaignManager isAdmin={false} />}
        {tab === 'history' && <ModerationHistory />}
        {tab === 'kpi' && <AmbassadorKpiSection stats={stats} loading={loading} />}
      </div>
    </div>
  );
}

// Объединённый таб жалоб (очередь + список)
function ReportsTab({ reports, loading, onProcessed, onRefresh }) {
  const [view, setView] = useState('queue');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px' }}>
        {[{ id: 'queue', l: 'Очередь' }, { id: 'list', l: 'Все жалобы' }].map(v => (
          <button
            key={v.id}
            onClick={() => { hapticFeedback('selection'); setView(v.id); }}
            style={{
              flex: 1, padding: 7, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: view === v.id ? P.primary : P.surfaceElevated,
              color: view === v.id ? P.primaryText : P.textMuted,
              border: `1px solid ${view === v.id ? 'transparent' : P.border}`,
            }}
          >
            {v.l}
          </button>
        ))}
      </div>
      {view === 'queue'
        ? <ReportQueue reports={reports} loading={loading} onProcessed={onProcessed} onRefresh={onRefresh} />
        : <ReportList reports={reports} loading={loading} onProcessed={onProcessed} onRefresh={onRefresh} />
      }
    </div>
  );
}

function AmbassadorKpiSection({ stats, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: `3px solid ${P.border}`,
          borderTopColor: P.primary,
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ textAlign: 'center', padding: 24, color: P.textMuted }}>
        KPI недоступны
      </div>
    );
  }

  const cards = [
    { label: 'DAU', value: stats.dau || 0, color: '#4DA6FF' },
    { label: 'WAU', value: stats.wau || 0, color: P.primary },
    { label: 'MAU', value: stats.mau || 0, color: P.primary },
    { label: 'Жалоб сегодня', value: stats.reports_today || 0, color: '#f59e0b' },
    { label: 'Обработано', value: stats.reports_processed || 0, color: '#22c55e' },
    { label: 'Просрочено >24ч', value: stats.reports_overdue || 0, color: '#ef4444' },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {cards.map((card) => (
          <div key={card.label} style={{
            background: P.surfaceElevated,
            borderRadius: 14,
            border: `1px solid ${P.border}`,
            padding: '16px 14px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: card.color, lineHeight: 1, marginBottom: 4 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: P.textMuted }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: P.bg,
    paddingBottom: 100,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
    background: '#0A0A0A',
    borderBottom: `1px solid ${P.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: 'transparent',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },

  headerBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
  },

  tabsContainer: {
    padding: '12px 16px 0',
    position: 'sticky',
    top: 64,
    zIndex: 19,
    background: P.bg,
  },

  tabsWrapper: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 6,
    background: P.surfaceElevated,
    borderRadius: 14,
    padding: 6,
    border: `1px solid ${P.border}`,
  },

  tabButton: {
    width: '100%',
    minHeight: 38,
    background: 'transparent',
    border: `1px solid ${P.border}`,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: P.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  tabButtonActive: {
    color: P.primaryText,
    border: '1px solid transparent',
    background: P.primary,
    boxShadow: '0 2px 12px rgba(212, 255, 0, 0.2)',
  },

  tabSlotPlaceholder: {
    minHeight: 38,
    borderRadius: 10,
    border: `1px dashed ${P.border}`,
    background: 'transparent',
    opacity: 0.4,
  },

  content: {
    padding: '12px 0',
  },

  accessDenied: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '60vh',
  },
};

export default AmbassadorPanel;
