// ===== FILE: AdminPanel.js =====

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Activity, Users, MessageSquare, BarChart3,
  Shield, Plus, Trash2, Search, RefreshCw,
  CheckCircle, XCircle, Megaphone, Building2
} from 'lucide-react';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import {
  getAdminStats, getAmbassadors, assignAmbassador,
  removeAmbassador, getAppeals, reviewAppeal,
  getAnalyticsLatestReport, getAnalyticsReport, rebuildAnalyticsReport,
  getAnalyticsHealth, downloadAnalyticsReport
} from '../../api';
import { toast } from '../shared/Toast';
import theme from '../../theme';
import ActionFeed from './ActionFeed';
import CampaignManager from './CampaignManager';
import CampusManager from './CampusManager';

const P = theme.colors.premium;

const TABS = [
  { id: 'feed', label: 'Лента', icon: Activity },
  { id: 'ambassadors', label: 'Люди', icon: Users },
  { id: 'campuses', label: 'Кампусы', icon: Building2 },
  { id: 'appeals', label: 'Апелл.', icon: MessageSquare },
  { id: 'campaigns', label: 'Рекл.', icon: Megaphone },
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

  if (!canAdmin) {
    return (
      <div style={styles.container}>
        <div style={styles.accessDenied}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
          <div style={{ fontSize: 16, color: P.textMuted }}>
            Доступ только для суперадмина
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <div style={styles.headerTitle}>⚡ Админ-панель</div>
        <div style={{ width: 40 }} />
      </div>

      {/* Tabs */}
      <div style={styles.tabsContainer}>
        <div style={styles.tabsWrapper}>
          {TABS.map((t) => {
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
        {tab === 'feed' && <ActionFeed onReverse={() => {}} />}
        {tab === 'ambassadors' && <AmbassadorManager />}
        {tab === 'campuses' && <CampusManager isAdmin={true} />}
        {tab === 'appeals' && <AppealsSection />}
        {tab === 'campaigns' && <CampaignManager isAdmin={true} />}
        {tab === 'stats' && <StatsSection />}
      </div>
    </div>
  );
}

// ==============================
// Ambassador Manager sub-component
// ==============================
function AmbassadorManager() {
  const { user } = useStore();
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
    if (parseInt(newTgId) === user?.telegram_id) {
      hapticFeedback('error');
      toast.error('Нельзя назначить себя амбассадором');
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

  const handleRemove = async (amb) => {
    if (amb.telegram_id === user?.telegram_id) {
      hapticFeedback('error');
      toast.error('Нельзя снять роль с себя');
      return;
    }
    hapticFeedback('heavy');
    try {
      await removeAmbassador(amb.id);
      setAmbassadors(prev => prev.filter(a => a.id !== amb.id));
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
          {ambassadors.map((amb) => {
            const isSelf = amb.telegram_id === user?.telegram_id;
            return (
              <div key={amb.id} style={styles.ambassadorItem}>
                <div style={styles.ambAvatar}>
                  <Shield size={16} color={P.primary} />
                </div>
                <div style={styles.ambInfo}>
                  <div style={styles.ambName}>
                    {amb.name || `#${amb.telegram_id}`}
                    {isSelf && <span style={styles.selfTag}> (вы)</span>}
                  </div>
                  <div style={styles.ambMeta}>
                    {amb.university || 'Без привязки'}
                    {amb.actions_count !== undefined && ` · ${amb.actions_count} действий`}
                    {amb.accuracy !== undefined && ` · ${amb.accuracy}% точность`}
                  </div>
                </div>
                {!isSelf && (
                  <button
                    style={styles.removeBtn}
                    onClick={() => handleRemove(amb)}
                  >
                    <Trash2 size={14} color="#ef4444" />
                  </button>
                )}
              </div>
            );
          })}
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
        <MessageSquare size={36} color={P.textMuted} strokeWidth={1.5} />
        <div style={{ fontSize: 15, color: P.textMuted, marginTop: 10 }}>
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
    { label: 'DAU', value: stats.dau || 0, color: '#4DA6FF' },
    { label: 'WAU', value: stats.wau || 0, color: P.primary },
    { label: 'MAU', value: stats.mau || 0, color: P.primary },
    { label: 'Жалоб сегодня', value: stats.reports_today || 0, color: '#f59e0b' },
    { label: 'Обработано', value: stats.reports_processed || 0, color: '#22c55e' },
    { label: 'Просрочено >24ч', value: stats.reports_overdue || 0, color: '#ef4444' },
    { label: 'Постов', value: stats.total_posts || 0, color: P.primary },
    { label: 'Пользователей', value: stats.total_users || 0, color: '#4DA6FF' },
  ];

  return (
    <>
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
      <AnalyticsSection />
    </>
  );
}

// Словарь переводов KPI-меток (label или metric_key с бэкенда)
const KPI_LABELS_RU = {
  'New Users': 'Новые пользователи',
  'Activated Users': 'Активированных',
  'Activation Rate %': 'Конверсия активации',
  'Feed Engagement %': 'Вовлечённость в ленте',
  'Post Open Rate %': 'Открываемость постов',
  'Create Conversion %': 'Конверсия создания',
  'Request Response Rate %': 'Отклик на запросы',
  'Market Favorite Rate %': 'Избранное в маркете',
  'new_users': 'Новые пользователи',
  'activated_users': 'Активированных',
  'activation_rate': 'Конверсия активации',
  'feed_engagement_rate': 'Вовлечённость в ленте',
  'post_open_rate': 'Открываемость постов',
  'create_conversion_rate': 'Конверсия создания',
  'request_response_rate': 'Отклик на запросы',
  'market_favorite_rate': 'Избранное в маркете',
  'dau': 'DAU',
  'wau': 'WAU',
  'mau': 'MAU',
};

const CALC_STATUS_RU = {
  'ok': 'ок',
  'insufficient_data': 'мало данных',
  'error': 'ошибка',
  'pending': 'ожидание',
  'skipped': 'пропущено',
};

const QUALITY_KEYS_RU = {
  'missing_events_rate':    'Пропущенные события',
  'late_events_rate':       'Запоздалые события',
  'metric_drift_rate':      'Дрейф метрик',
  'null_rate':              'Доля null',
  'duplicate_rate':         'Дубликаты',
  'outlier_rate':           'Выбросы',
  'coverage_rate':          'Покрытие',
  'freshness_hours':        'Свежесть (ч)',
};

const translateKpiLabel = (row) => KPI_LABELS_RU[row.label] || KPI_LABELS_RU[row.metric_key] || row.label || row.metric_key;
const translateQualityKey = (key) => QUALITY_KEYS_RU[key] || key;
const translateCalcStatus = (status) => CALC_STATUS_RU[status] || status || 'ок';

function AnalyticsSection() {
  const [latest, setLatest] = useState(null);
  const [health, setHealth] = useState(null);
  const [reportDate, setReportDate] = useState('');
  const [report, setReport] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const loadReport = useCallback(async (dateValue) => {
    if (!dateValue) return;
    setLoadingReport(true);
    try {
      const data = await getAnalyticsReport(dateValue);
      setReport(data);
    } catch (err) {
      console.error(err);
      setReport(null);
      toast.error('Отчёт не найден за выбранную дату');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const refreshMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [latestRes, healthRes] = await Promise.allSettled([
        getAnalyticsLatestReport(),
        getAnalyticsHealth(),
      ]);
      let nextDate = '';

      if (latestRes.status === 'fulfilled') {
        setLatest(latestRes.value);
        nextDate = latestRes.value?.date || '';
      } else {
        setLatest(null);
      }

      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      } else {
        setHealth(null);
      }

      if (!nextDate) {
        nextDate = new Date().toISOString().slice(0, 10);
      }
      setReportDate((prev) => prev || nextDate);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (latest?.date && !report) {
      loadReport(latest.date);
    }
  }, [latest, report, loadReport]);

  const handleLoad = async () => {
    await loadReport(reportDate);
  };

  const handleLoadLatest = async () => {
    const targetDate = latest?.date || reportDate;
    if (!targetDate) return;
    setReportDate(targetDate);
    await loadReport(targetDate);
  };

  const handleRebuild = async () => {
    if (!reportDate) return;
    setBusyAction('rebuild');
    try {
      await rebuildAnalyticsReport(reportDate);
      toast.success(`Отчёт пересобран: ${reportDate}`);
      await loadReport(reportDate);
      await refreshMeta();
    } catch (err) {
      console.error(err);
      toast.error('Ошибка пересборки');
    } finally {
      setBusyAction('');
    }
  };

  const handleDownload = async (format) => {
    if (!reportDate) return;
    setBusyAction(`download-${format}`);
    try {
      await downloadAnalyticsReport(reportDate, format);
      toast.success(`Скачан ${format.toUpperCase()} отчёт`);
    } catch (err) {
      console.error(err);
      toast.error('Ошибка скачивания');
    } finally {
      setBusyAction('');
    }
  };

  const formatMetricValue = (row) => {
    const raw = row?.value;
    if (raw === null || raw === undefined) return '—';
    if (row?.unit === 'percent') return `${Number(raw).toFixed(2)}%`;
    if (typeof raw === 'number') return new Intl.NumberFormat('ru-RU').format(raw);
    return String(raw);
  };

  const kpiRows = Array.isArray(report?.kpi_overview) ? report.kpi_overview.slice(0, 8) : [];
  const qualityRows = Array.isArray(report?.quality_checks) ? report.quality_checks : [];
  const ingestLagHours = health?.ingest_lag_seconds != null
    ? (health.ingest_lag_seconds / 3600).toFixed(1)
    : null;

  return (
    <div style={styles.section}>
      <div style={styles.analyticsCard}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionTitle}>Аналитика</span>
          <button
            style={styles.secondaryBtn}
            onClick={refreshMeta}
            disabled={loadingMeta}
          >
            <RefreshCw size={14} />
            <span>{loadingMeta ? 'Загрузка...' : 'Обновить'}</span>
          </button>
        </div>

        <div style={styles.analyticsMetaGrid}>
          <div style={styles.analyticsMetaItem}>
            <div style={styles.analyticsMetaLabel}>Последний отчёт</div>
            <div style={styles.analyticsMetaValue}>{latest?.date || '—'}</div>
          </div>
          <div style={styles.analyticsMetaItem}>
            <div style={styles.analyticsMetaLabel}>Задержка данных</div>
            <div style={styles.analyticsMetaValue}>{ingestLagHours ? `${ingestLagHours}ч` : '—'}</div>
          </div>
          <div style={styles.analyticsMetaItem}>
            <div style={styles.analyticsMetaLabel}>Статус системы</div>
            <div style={styles.analyticsMetaValue}>{health?.status || '—'}</div>
          </div>
        </div>

        <div style={styles.analyticsActionsRow}>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            style={styles.dateInput}
          />
          <button style={styles.secondaryBtn} onClick={handleLoad} disabled={loadingReport || !reportDate}>
            Загрузить
          </button>
          <button style={styles.secondaryBtn} onClick={handleLoadLatest} disabled={loadingReport}>
            Последний
          </button>
        </div>

        <div style={styles.analyticsActionsRow}>
          <button
            style={styles.primaryBtn}
            onClick={handleRebuild}
            disabled={busyAction === 'rebuild' || !reportDate}
          >
            {busyAction === 'rebuild' ? 'Пересборка...' : 'Пересобрать'}
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => handleDownload('json')}
            disabled={busyAction === 'download-json' || !reportDate}
          >
            JSON
          </button>
          <button
            style={styles.secondaryBtn}
            onClick={() => handleDownload('csv')}
            disabled={busyAction === 'download-csv' || !reportDate}
          >
            CSV ZIP
          </button>
        </div>
      </div>

      {loadingReport ? (
        <div style={styles.loadingSmall}><div style={styles.spinner} /></div>
      ) : !report ? (
        <div style={styles.emptySmall}>Отчёт ещё не загружен</div>
      ) : (
        <>
          <div style={styles.analyticsCard}>
            <div style={styles.sectionTitle}>KPI</div>
            <div style={styles.analyticsKpiGrid}>
              {kpiRows.map((row) => (
                <div key={row.metric_key} style={styles.analyticsKpiItem}>
                  <div style={styles.analyticsKpiLabel}>{translateKpiLabel(row)}</div>
                  <div style={styles.analyticsKpiValue}>{formatMetricValue(row)}</div>
                  <div style={styles.analyticsKpiMeta}>{translateCalcStatus(row.calc_status)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.analyticsCard}>
            <div style={styles.sectionTitle}>Качество данных</div>
            {qualityRows.length === 0 ? (
              <div style={styles.emptySmall}>Нет данных за эту дату</div>
            ) : (
              <div style={styles.analyticsQualityList}>
                {qualityRows.map((row) => (
                  <div key={row.metric_key} style={styles.analyticsQualityItem}>
                    <span style={styles.analyticsQualityKey}>{translateQualityKey(row.metric_key)}</span>
                    <span style={styles.analyticsQualityValue}>{row.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ==============================
// Styles — Premium design
// ==============================
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
    width: 40, height: 40, borderRadius: 12,
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },

  headerTitle: {
    fontSize: 18, fontWeight: 800, color: '#fff',
  },

  tabsContainer: {
    padding: '12px 16px 0',
    position: 'sticky', top: 64, zIndex: 19,
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

  content: { padding: '12px 0' },

  accessDenied: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '60vh',
  },

  section: { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 },

  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },

  sectionTitle: {
    fontSize: 15, fontWeight: 700, color: '#fff',
  },

  addBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '7px 14px', borderRadius: 10,
    background: P.primary, color: P.primaryText,
    border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },

  addForm: {
    background: P.surfaceElevated, borderRadius: 14,
    padding: 14, border: `1px solid ${P.border}`,
    display: 'flex', flexDirection: 'column', gap: 8,
  },

  input: {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: `1px solid ${P.border}`, background: P.surfaceHover,
    color: '#fff', fontSize: 14, fontFamily: 'inherit',
    outline: 'none', boxSizing: 'border-box',
  },

  submitBtn: {
    padding: '10px', borderRadius: 10, border: 'none',
    background: P.primary, color: P.primaryText,
    fontSize: 14, fontWeight: 700, cursor: 'pointer',
  },

  ambassadorList: { display: 'flex', flexDirection: 'column', gap: 6 },

  ambassadorItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 14px', background: P.surfaceElevated,
    borderRadius: 14, border: `1px solid ${P.border}`,
  },

  ambAvatar: {
    width: 36, height: 36, borderRadius: 10,
    background: 'rgba(212, 255, 0, 0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },

  ambInfo: { flex: 1, minWidth: 0 },

  ambName: { fontSize: 14, fontWeight: 700, color: '#fff' },

  selfTag: { fontSize: 12, fontWeight: 600, color: P.textMuted },

  ambMeta: {
    fontSize: 12, color: P.textMuted,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },

  removeBtn: {
    width: 34, height: 34, borderRadius: 10,
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },

  // Appeals
  appealCard: {
    background: P.surfaceElevated, borderRadius: 14,
    padding: 14, border: `1px solid ${P.border}`,
  },

  appealHeader: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },

  appealUser: { fontSize: 14, fontWeight: 700, color: '#fff' },

  appealTime: { fontSize: 11, color: P.textMuted },

  appealMessage: {
    fontSize: 14, color: P.textBody, lineHeight: 1.5,
    marginBottom: 8,
  },

  appealContext: {
    fontSize: 12, color: P.textMuted,
    padding: '8px 10px', background: P.surfaceHover,
    borderRadius: 8, marginBottom: 10,
  },

  appealActions: { display: 'flex', gap: 8 },

  approveBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px', borderRadius: 10, border: '1px solid rgba(34, 197, 94, 0.3)',
    background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  rejectBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: '8px', borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)',
    background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444',
    fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },

  // Stats
  statsGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },

  statCard: {
    background: P.surfaceElevated, borderRadius: 14,
    padding: '16px 14px', border: `1px solid ${P.border}`,
    textAlign: 'center',
  },

  statValue: { fontSize: 26, fontWeight: 800, lineHeight: 1, marginBottom: 4 },

  statLabel: { fontSize: 12, fontWeight: 600, color: P.textMuted },

  // Analytics
  analyticsCard: {
    background: P.surfaceElevated,
    borderRadius: 14,
    border: `1px solid ${P.border}`,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },

  analyticsMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },

  analyticsMetaItem: {
    background: P.surfaceHover,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: 10,
  },

  analyticsMetaLabel: {
    fontSize: 11,
    color: P.textMuted,
    marginBottom: 4,
  },

  analyticsMetaValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },

  analyticsActionsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    alignItems: 'center',
  },

  dateInput: {
    width: '100%',
    minHeight: 38,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    background: P.surfaceHover,
    color: '#fff',
    padding: '0 10px',
    fontSize: 13,
    boxSizing: 'border-box',
  },

  primaryBtn: {
    minHeight: 38,
    borderRadius: 10,
    border: 'none',
    background: P.primary,
    color: P.primaryText,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },

  secondaryBtn: {
    minHeight: 38,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    background: P.surfaceHover,
    color: P.textBody,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  analyticsKpiGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },

  analyticsKpiItem: {
    background: P.surfaceHover,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: 10,
  },

  analyticsKpiLabel: {
    fontSize: 11,
    color: P.textMuted,
    marginBottom: 4,
  },

  analyticsKpiValue: {
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 800,
    color: '#fff',
    marginBottom: 4,
  },

  analyticsKpiMeta: {
    fontSize: 11,
    color: P.textMuted,
  },

  analyticsQualityList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },

  analyticsQualityItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    border: `1px solid ${P.border}`,
    borderRadius: 10,
    background: P.surfaceHover,
    padding: '8px 10px',
  },

  analyticsQualityKey: {
    fontSize: 12,
    color: P.textMuted,
  },

  analyticsQualityValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
  },

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
    color: P.textMuted,
  },

  spinner: {
    width: 28, height: 28, borderRadius: '50%',
    border: `3px solid ${P.border}`,
    borderTopColor: P.primary,
    animation: 'spin 0.8s linear infinite',
  },
};

export default AdminPanel;
