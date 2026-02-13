// ===== 📄 ФАЙЛ: frontend/src/components/moderation/AmbassadorPanel.js =====

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, BarChart3, Layers, Megaphone, Clock } from 'lucide-react';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { getReports, getAdminStats } from '../../api';
import theme from '../../theme';

import AmbassadorDashboard from './AmbassadorDashboard';
import ReportQueue from './ReportQueue';
import ReportList from './ReportList';
import ModerationHistory from './ModerationHistory';
import AdManager from './AdManager';

const TABS = [
  { id: 'dashboard', label: 'Обзор', icon: BarChart3 },
  { id: 'reports', label: 'Жалобы', icon: Layers },
  { id: 'ads', label: 'Реклама', icon: Megaphone },
  { id: 'history', label: 'История', icon: Clock },
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

  // Защита: обычный юзер не попадёт сюда
  if (!canModerate) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, color: theme.colors.textSecondary }}>Нет доступа</div>
        </div>
      </div>
    );
  }

  const pendingCount = reports.length;
  const activeTabIndex = TABS.findIndex(t => t.id === tab);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={22} color={theme.colors.text} />
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
          <div
            style={{
              ...styles.tabIndicator,
              width: `${100 / TABS.length}%`,
              transform: `translateX(${activeTabIndex * 100}%)`,
            }}
          />
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { hapticFeedback('selection'); setTab(t.id); }}
                style={{
                  ...styles.tabButton,
                  color: isActive ? '#fff' : theme.colors.textSecondary,
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
        {tab === 'ads' && <AdManager isAdmin={false} />}
        {tab === 'history' && <ModerationHistory />}
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
          <button key={v.id} onClick={() => { hapticFeedback('selection'); setView(v.id); }} style={{
            flex: 1, padding: 7, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: view === v.id ? theme.colors.primary : theme.colors.bgSecondary,
            color: view === v.id ? '#fff' : theme.colors.textSecondary,
            border: `1px solid ${view === v.id ? theme.colors.primary : theme.colors.border}`,
          }}>{v.l}</button>
        ))}
      </div>
      {view === 'queue'
        ? <ReportQueue reports={reports} loading={loading} onProcessed={onProcessed} onRefresh={onRefresh} />
        : <ReportList reports={reports} loading={loading} onProcessed={onProcessed} onRefresh={onRefresh} />
      }
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: theme.colors.bg,
    paddingBottom: 100,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
    background: theme.colors.bgSecondary,
    borderBottom: `1px solid ${theme.colors.border}`,
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
    color: theme.colors.text,
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
    background: theme.colors.bg,
  },

  tabsWrapper: {
    display: 'flex',
    background: theme.colors.bgSecondary,
    borderRadius: 12,
    padding: 3,
    position: 'relative',
    height: 38,
    border: `1px solid ${theme.colors.borderLight}`,
  },

  tabIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 10,
    background: theme.colors.primary,
    boxShadow: theme.shadows.md,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 1,
  },

  tabButton: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    position: 'relative',
    zIndex: 2,
    transition: 'color 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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