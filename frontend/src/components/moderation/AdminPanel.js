// ===== 📄 ФАЙЛ: frontend/src/components/moderation/AdminPanel.js =====

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Activity, Users, MessageSquare, BarChart3,
  Shield, Plus, Trash2, Pause, Play, Search, RefreshCw,
  CheckCircle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import {
  getAdminStats, getAmbassadors, assignAmbassador,
  removeAmbassador, getAppeals, reviewAppeal
} from '../../api';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import ActionFeed from './ActionFeed';

const TABS = [
  { id: 'feed', label: 'Лента', icon: Activity },
  { id: 'ambassadors', label: 'Люди', icon: Users },
  { id: 'appeals', label: 'Апелляции', icon: MessageSquare },
  { id: 'stats', label: 'Статы', icon: BarChart3 },
];

function AdminPanel() {
  const { setActiveTab: setNavigationTab, moderationRole } = useStore();
  const [tab, setTab] = useState('feed');

  const canAdmin = moderationRole?.can_admin === true;

  const handleBack = () => {
    hapticFeedback('light');
    setNavigationTab('profile');
  };

  // Защита
  if (!canAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, color: theme.colors.textSecondary }}>
            Доступ только для суперадмина
          </div>
        </div>
      </div>
    );
  }

  const activeTabIndex = TABS.findIndex(t => t.id === tab);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={22} color={theme.colors.text} />
        </button>
        <div style={styles.headerTitle}>⚡ Админ-панель</div>
        <div style={{ width: 40 }} />
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <div style={styles.tabsWrapper}>
          <div
            style={{
              ...styles.tabIndicator,
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
        {tab === 'feed' && <ActionFeed onReverse={(log) => console.log('Reverse:', log)} />}
        {tab === 'ambassadors' && <AmbassadorManager />}
        {tab === 'appeals' && <AppealsSection />}
        {tab === 'stats' && <StatsSection />}
      </div>
    </div>
  );
}

// ==============================
// Ambassador Manager sub-component
// ==============================
function AmbassadorManager() {
  const [ambassadors, setAmbassadors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTgId, setNewTgId] = useState('');
  const [newUniversity, setNewUniversity] = useState('');
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAmbassadors();
      setAmbassadors(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newTgId.trim()) {
      toast.error('Введите Telegram ID');
      return;
    }
    setAdding(true);
    try {
      await assignAmbassador(parseInt(newTgId), newUniversity || null);
      toast.success('Амбассадор назначен');
      setShowAdd(false);
      setNewTgId('');
      setNewUniversity('');
      load();
    } catch (err) {
      toast.error('Ошибка назначения');
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId) => {
    hapticFeedback('heavy');
    try {
      await removeAmbassador(userId);
      setAmbassadors(prev => prev.filter(a => a.id !== userId));
      toast.success('Роль снята');
    } catch (err) {
      toast.error('Ошибка');
    }
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>Амбассадоры ({ambassadors.length})</span>
        <button
          style={styles.addBtn}
          onClick={() => setShowAdd(!showAdd)}
        >
          <Plus size={16} />
          <span>Добавить</span>
        </button>
      </div>

      {showAdd && (
        <div style={styles.addForm}>
          <input
            style={styles.input}
            placeholder="Telegram ID"
            value={newTgId}
            onChange={(e) => setNewTgId(e.target.value)}
            type="number"
          />
          <input
            style={styles.input}
            placeholder="Университет (опционально)"
            value={newUniversity}
            onChange={(e) => setNewUniversity(e.target.value)}
          />
          <button
            style={{ ...styles.submitBtn, opacity: adding ? 0.5 : 1 }}
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? 'Назначаю...' : 'Назначить'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={styles.loadingSmall}><div style={styles.spinner} /></div>
      ) : ambassadors.length === 0 ? (
        <div style={styles.emptySmall}>Нет амбассадоров</div>
      ) : (
        <div style={styles.ambassadorList}>
          {ambassadors.map((amb) => (
            <div key={amb.id} style={styles.ambassadorItem}>
              <div style={styles.ambAvatar}>
                <Shield size={16} color={theme.colors.primary} />
              </div>
              <div style={styles.ambInfo}>
                <div style={styles.ambName}>{amb.name || `#${amb.telegram_id}`}</div>
                <div style={styles.ambMeta}>
                  {amb.university || 'Без привязки'}
                  {amb.actions_count !== undefined && ` · ${amb.actions_count} действий`}
                  {amb.accuracy !== undefined && ` · ${amb.accuracy}% точность`}
                </div>
              </div>
              <button
                style={styles.removeBtn}
                onClick={() => handleRemove(amb.id)}
              >
                <Trash2 size={14} color="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==============================
// Appeals sub-component
// ==============================
function AppealsSection() {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAppeals('pending', 50, 0);
      setAppeals(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (appealId, status) => {
    hapticFeedback('medium');
    setProcessing(appealId);
    try {
      await reviewAppeal(appealId, status);
      setAppeals(prev => prev.filter(a => a.id !== appealId));
      toast.success(status === 'approved' ? 'Апелляция одобрена' : 'Апелляция отклонена');
    } catch (err) {
      toast.error('Ошибка');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div style={styles.loadingSmall}><div style={styles.spinner} /></div>;
  }

  if (appeals.length === 0) {
    return (
      <div style={styles.emptySection}>
        <MessageSquare size={36} color={theme.colors.textTertiary} strokeWidth={1.5} />
        <div style={{ fontSize: 15, color: theme.colors.textSecondary, marginTop: 10 }}>
          Нет открытых апелляций
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      {appeals.map((appeal) => (
        <div key={appeal.id} style={styles.appealCard}>
          <div style={styles.appealHeader}>
            <span style={styles.appealUser}>
              {appeal.user_name || `Пользователь #${appeal.user_id}`}
            </span>
            <span style={styles.appealTime}>
              {new Date(appeal.created_at).toLocaleDateString('ru-RU')}
            </span>
          </div>
          <div style={styles.appealMessage}>{appeal.message}</div>
          {appeal.moderation_action && (
            <div style={styles.appealContext}>
              Действие: {appeal.moderation_action} · Причина: {appeal.moderation_reason || '—'}
            </div>
          )}
          <div style={styles.appealActions}>
            <button
              style={styles.approveBtn}
              onClick={() => handleReview(appeal.id, 'approved')}
              disabled={processing === appeal.id}
            >
              <CheckCircle size={14} />
              <span>Одобрить</span>
            </button>
            <button
              style={styles.rejectBtn}
              onClick={() => handleReview(appeal.id, 'rejected')}
              disabled={processing === appeal.id}
            >
              <XCircle size={14} />
              <span>Отклонить</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==============================
// Stats sub-component
// ==============================
function StatsSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(data => setStats(data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={styles.loadingSmall}><div style={styles.spinner} /></div>;
  }

  if (!stats) {
    return <div style={styles.emptySmall}>Статистика недоступна</div>;
  }

  const statCards = [
    { label: 'DAU', value: stats.dau || 0, color: '#3b82f6' },
    { label: 'WAU', value: stats.wau || 0, color: '#8b5cf6' },
    { label: 'MAU', value: stats.mau || 0, color: '#06b6d4' },
    { label: 'Жалоб сегодня', value: stats.reports_today || 0, color: '#f59e0b' },
    { label: 'Обработано', value: stats.reports_processed || 0, color: '#22c55e' },
    { label: 'Просрочено >24ч', value: stats.reports_overdue || 0, color: '#ef4444' },
    { label: 'Постов', value: stats.total_posts || 0, color: '#6366f1' },
    { label: 'Пользователей', value: stats.total_users || 0, color: '#14b8a6' },
  ];

  return (
    <div style={styles.section}>
      <div style={styles.statsGrid}>
        {statCards.map((s, i) => (
          <div key={i} style={styles.statCard}>
            <div style={{ ...styles.statValue, color: s.color }}>{s.value}</div>
            <div style={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==============================
// Styles
// ==============================
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
    width: 40, height: 40, borderRadius: 12,
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },

  headerTitle: {
    fontSize: 18, fontWeight: 800, color: theme.colors.text,
  },

  tabsContainer: {
    padding: '12px 16px 0',
    position: 'sticky', top: 64, zIndex: 19,
    background: theme.colors.bg,
  },

  tabsWrapper: {
    display: 'flex',
    background: theme.colors.bgSecondary,
    borderRadius: 12, padding: 3,
    position: 'relative', height: 38,
    border: `1px solid ${theme.colors.borderLight}`,
  },

  tabIndicator: {
    position: 'absolute', 
    top: 3, 
    bottom: 3, 
    left: 3,
    width: 'calc((100% - 6px) / 4)', // ← ИСПРАВЛЕНО: 6px = padding 3px * 2, деление на 4 таба
    borderRadius: 10,
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    boxShadow: theme.shadows.md,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 1,
  },

  tabButton: {
    flex: 1, background: 'transparent', border: 'none',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    position: 'relative', zIndex: 2, transition: 'color 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  },

  content: { padding: '12px 0' },

  accessDenied: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '60vh',
  },

  // Shared sub-component styles
  section: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: theme.colors.text,
  },

  addBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '7px 14px', borderRadius: 10,
    background: theme.colors.primary, color: '#fff',
    border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  addForm: {
    background: theme.colors.card, borderRadius: 14,
    padding: 14, border: `1px solid ${theme.colors.border}`,
    display: 'flex', flexDirection: 'column', gap: 8,
  },

  input: {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${theme.colors.border}`, background: theme.colors.bgSecondary,
    color: theme.colors.text, fontSize: 14, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },

  submitBtn: {
    padding: '10px', borderRadius: 10, border: 'none',
    background: theme.colors.primary, color: '#fff',
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },

  ambassadorList: { display: 'flex', flexDirection: 'column', gap: 6 },

  ambassadorItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', background: theme.colors.card,
    borderRadius: 14, border: `1px solid ${theme.colors.borderLight}`,
  },

  ambAvatar: {
    width: 36, height: 36, borderRadius: 10,
    background: theme.colors.primaryLight,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  ambInfo: { flex: 1, minWidth: 0 },

  ambName: { fontSize: 14, fontWeight: 700, color: theme.colors.text },

  ambMeta: {
    fontSize: 12, color: theme.colors.textTertiary,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  removeBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: 'rgba(239, 68, 68, 0.1)', 
    border: '1px solid rgba(239, 68, 68, 0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },

  // Appeals
  appealCard: {
    background: theme.colors.card, borderRadius: 14,
    padding: 14, border: `1px solid ${theme.colors.border}`,
  },

  appealHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },

  appealUser: { fontSize: 14, fontWeight: 700, color: theme.colors.text },

  appealTime: { fontSize: 11, color: theme.colors.textTertiary },

  appealMessage: {
    fontSize: 14, color: theme.colors.text, lineHeight: 1.5,
    marginBottom: 8,
  },

  appealContext: {
    fontSize: 12, color: theme.colors.textTertiary,
    padding: '8px 10px', background: theme.colors.bgSecondary,
    borderRadius: 8, marginBottom: 10,
  },

  appealActions: { display: 'flex', gap: 8 },

  approveBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px', borderRadius: 10, border: '1px solid #22c55e40',
    background: '#22c55e10', color: '#22c55e',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  rejectBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px', borderRadius: 10, border: '1px solid #ef444440',
    background: '#ef444410', color: '#ef4444',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  // Stats
  statsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },

  statCard: {
    background: theme.colors.card, borderRadius: 14,
    padding: '16px 14px', border: `1px solid ${theme.colors.borderLight}`,
    textAlign: 'center',
  },

  statValue: { fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 4 },

  statLabel: { fontSize: 12, fontWeight: 600, color: theme.colors.textSecondary },

  // Shared
  emptySection: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '50px 20px',
  },

  loadingSmall: {
    display: 'flex', justifyContent: 'center', padding: '40px 0',
  },

  emptySmall: {
    textAlign: 'center', padding: '30px', fontSize: 14,
    color: theme.colors.textSecondary,
  },

  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `3px solid ${theme.colors.border}`,
    borderTopColor: theme.colors.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default AdminPanel;