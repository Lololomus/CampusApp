// ===== FILE: AdminPanel.js =====

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Users, MessageSquare, BarChart3,
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
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
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

  useTelegramScreen({
    id: 'admin-panel-screen',
    title: 'Админ-панель',
    priority: 71,
    back: {
      visible: true,
      onClick: handleBack,
    },
  });

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
      <DrilldownHeader
        title="Админ-панель"
        onBack={handleBack}
        background="#000000"
        showDivider={false}
      />

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
  const [expandedWindows, setExpandedWindows] = useState({
    dau: true,
    wau: false,
    mau: false,
  });
  const lastTouchToggleAtRef = useRef(0);

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

  const formatNumber = (value) => new Intl.NumberFormat('ru-RU').format(Number(value || 0));
  const formatPercent = (value) => value == null ? '—' : `${Number(value).toFixed(1)}%`;
  const formatDuration = (seconds) => {
    const total = Number(seconds || 0);
    if (total < 60) return `${Math.round(total)}с`;
    if (total < 3600) return `${Math.round(total / 60)}м`;
    const hours = Math.floor(total / 3600);
    const minutes = Math.round((total % 3600) / 60);
    return minutes ? `${hours}ч ${minutes}м` : `${hours}ч`;
  };

  const statCards = [
    { label: 'Real DAU', value: stats.real_dau ?? stats.dau ?? 0, color: '#4DA6FF' },
    { label: 'Real WAU', value: stats.real_wau ?? stats.wau ?? 0, color: P.primary },
    { label: 'Real MAU', value: stats.real_mau ?? stats.mau ?? 0, color: P.primary },
    { label: 'DAU/MAU', value: formatPercent(stats.stickiness_pct), color: '#22c55e' },
    { label: 'Жалоб сегодня', value: stats.reports_today || 0, color: '#f59e0b' },
    { label: 'Обработано', value: stats.reports_processed || 0, color: '#22c55e' },
    { label: 'Просрочено >24ч', value: stats.reports_overdue || 0, color: '#ef4444' },
    { label: 'Постов', value: stats.total_posts || 0, color: P.primary },
    { label: 'Пользователей', value: stats.total_users || 0, color: '#4DA6FF' },
  ];
  const online = stats.online_time_30d || {};
  const places = Array.isArray(online.places) ? online.places.slice(0, 6) : [];
  const maxPlaceSeconds = Math.max(...places.map((p) => Number(p.active_seconds || 0)), 1);
  const actionRows = Array.isArray(stats.action_usage_today) ? stats.action_usage_today : [];
  const activityWindows = stats.activity_windows || {};

  const renderDelta = (value) => {
    if (value == null) return '—';
    const sign = Number(value) > 0 ? '+' : '';
    return `${sign}${Number(value).toFixed(1)}%`;
  };

  const toggleWindow = (windowKey) => {
    setExpandedWindows((prev) => ({ ...prev, [windowKey]: !prev[windowKey] }));
  };

  const handleWindowTouchEnd = (event, windowKey) => {
    event.preventDefault();
    event.stopPropagation();
    lastTouchToggleAtRef.current = Date.now();
    toggleWindow(windowKey);
  };

  const handleWindowClick = (event, windowKey) => {
    event.preventDefault();
    event.stopPropagation();
    if (Date.now() - lastTouchToggleAtRef.current < 450) return;
    toggleWindow(windowKey);
  };

  const renderWindowDetail = (windowKey) => {
    const row = activityWindows[windowKey];
    if (!row) return null;
    const isExpanded = Boolean(expandedWindows[windowKey]);
    const modules = Array.isArray(row.modules) ? row.modules.slice(0, 8) : [];
    const actions = Array.isArray(row.actions) ? row.actions : [];
    const businessMetrics = Array.isArray(row.business_metrics) ? row.business_metrics : [];
    const windowOnline = row.online_time || {};
    const maxModuleUsers = Math.max(...modules.map((m) => Number(m.users_count || 0)), 1);

    return (
      <div key={windowKey} style={styles.windowBlock}>
        <button
          type="button"
          style={styles.windowToggle}
          onClick={(event) => handleWindowClick(event, windowKey)}
          onTouchEnd={(event) => handleWindowTouchEnd(event, windowKey)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              handleWindowClick(event, windowKey);
            }
          }}
        >
          <div style={styles.windowToggleText}>
            <span style={styles.windowTitle}>{row.label}</span>
            <span style={styles.usageMeta}>
              {row.start_date === row.end_date ? row.end_date : `${row.start_date} · ${row.end_date}`}
            </span>
          </div>
          <div style={styles.windowToggleNumbers}>
            <span style={styles.windowValue}>{formatNumber(row.active_users)}</span>
            <span style={{ ...styles.windowDelta, color: Number(row.change_pct || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
              {renderDelta(row.change_pct)}
            </span>
          </div>
        </button>

        {isExpanded && (
          <div style={styles.windowDetails}>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span>Прошлый период</span><strong>{formatNumber(row.previous_active_users)}</strong></div>
              <div style={styles.detailItem}><span>Новые активные</span><strong>{formatNumber(row.new_active_users)}</strong></div>
              <div style={styles.detailItem}><span>Вернувшиеся</span><strong>{formatPercent(row.returning_pct)}</strong></div>
              <div style={styles.detailItem}><span>Событий</span><strong>{formatNumber(row.events_count)}</strong></div>
              <div style={styles.detailItem}><span>Событий / юзер</span><strong>{Number(row.events_per_user || 0).toFixed(1)}</strong></div>
              <div style={styles.detailItem}><span>Средняя сессия</span><strong>{formatDuration(windowOnline.avg_session_seconds)}</strong></div>
              <div style={styles.detailItem}><span>В день / активный</span><strong>{formatDuration(windowOnline.avg_daily_user_seconds)}</strong></div>
              <div style={styles.detailItem}><span>Сессий</span><strong>{formatNumber(windowOnline.sessions_count)}</strong></div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Бизнес-метрики</div>
              <div style={styles.usageList}>
                {businessMetrics.map((metric) => (
                  <div key={metric.metric_key} style={styles.usageRow}>
                    <div style={styles.usageText}>
                      <span style={styles.usageName}>{BUSINESS_LABELS_RU[metric.metric_key] || metric.label || metric.metric_key}</span>
                      <span style={styles.usageMeta}>
                        {formatNumber(metric.numerator)} / {formatNumber(metric.denominator)}
                      </span>
                    </div>
                    <div style={styles.usageValue}>{formatPercent(metric.value_pct)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Места</div>
              <div style={styles.usageList}>
                {modules.map((module) => {
                  const width = `${Math.max(4, Math.round((Number(module.users_count || 0) / maxModuleUsers) * 100))}%`;
                  return (
                    <div key={module.module} style={styles.placeRow}>
                      <div style={styles.placeHeader}>
                        <span style={styles.usageName}>{MODULE_LABELS_RU[module.module] || module.module}</span>
                        <span style={styles.usageValue}>{formatNumber(module.users_count)}</span>
                      </div>
                      <div style={styles.placeBar}><div style={{ ...styles.placeBarFill, width }} /></div>
                      <div style={styles.usageMeta}>
                        {formatPercent(module.share_active_pct)} активных · {formatNumber(module.events_count)} событий · {Number(module.events_per_user || 0).toFixed(1)} / юзер
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Действия</div>
              <div style={styles.usageList}>
                {actions.map((action) => (
                  <div key={action.action_key} style={styles.usageRow}>
                    <div style={styles.usageText}>
                      <span style={styles.usageName}>{ACTION_LABELS_RU[action.action_key] || action.label || action.action_key}</span>
                      <span style={styles.usageMeta}>
                        база {formatNumber(action.base_users)} · {formatNumber(action.events_count)} событий · {Number(action.events_per_active_user || 0).toFixed(1)} / юзер
                      </span>
                    </div>
                    <div style={styles.usageValue}>{formatNumber(action.active_users)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderedActivityWindows = ['dau', 'wau', 'mau']
    .map(renderWindowDetail)
    .filter(Boolean);

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

      <div style={styles.section}>
        <div style={styles.analyticsCard}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Подробная аудитория</span>
            <span style={styles.analyticsKpiMeta}>DAU · WAU · MAU</span>
          </div>
          <div style={styles.windowList}>
            {renderedActivityWindows.length > 0 ? renderedActivityWindows : (
              <div style={styles.emptySmall}>Данные аудитории пока недоступны</div>
            )}
          </div>
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.analyticsCard}>
          <div style={styles.sectionHeader}>
            <span style={styles.sectionTitle}>Реальная активность</span>
            <span style={styles.analyticsKpiMeta}>по событиям, 30 дней</span>
          </div>
          <div style={styles.usageSummaryGrid}>
            <div style={styles.usageSummaryItem}>
              <div style={styles.analyticsKpiLabel}>Средняя сессия</div>
              <div style={styles.analyticsKpiValue}>{formatDuration(online.avg_session_seconds)}</div>
            </div>
            <div style={styles.usageSummaryItem}>
              <div style={styles.analyticsKpiLabel}>В день на активного</div>
              <div style={styles.analyticsKpiValue}>{formatDuration(online.avg_daily_user_seconds)}</div>
            </div>
            <div style={styles.usageSummaryItem}>
              <div style={styles.analyticsKpiLabel}>Сессий</div>
              <div style={styles.analyticsKpiValue}>{formatNumber(online.sessions_count)}</div>
            </div>
          </div>
        </div>

        <div style={styles.analyticsCard}>
          <div style={styles.sectionTitle}>Действия сегодня</div>
          <div style={styles.usageList}>
            {actionRows.map((row) => (
              <div key={row.action_key} style={styles.usageRow}>
                <div style={styles.usageText}>
                  <span style={styles.usageName}>{ACTION_LABELS_RU[row.action_key] || row.label || row.action_key}</span>
                  <span style={styles.usageMeta}>
                    {formatNumber(row.events_count)} событий · {formatPercent(row.completion_pct)}
                  </span>
                </div>
                <div style={styles.usageValue}>{formatNumber(row.active_users)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.analyticsCard}>
          <div style={styles.sectionTitle}>Где проводят время</div>
          <div style={styles.usageList}>
            {places.map((place) => {
              const width = `${Math.max(4, Math.round((Number(place.active_seconds || 0) / maxPlaceSeconds) * 100))}%`;
              return (
                <div key={place.module} style={styles.placeRow}>
                  <div style={styles.placeHeader}>
                    <span style={styles.usageName}>{MODULE_LABELS_RU[place.module] || place.module}</span>
                    <span style={styles.usageValue}>{formatDuration(place.active_seconds)}</span>
                  </div>
                  <div style={styles.placeBar}><div style={{ ...styles.placeBarFill, width }} /></div>
                  <div style={styles.usageMeta}>
                    {formatNumber(place.users_count)} пользователей · {formatNumber(place.events_count)} событий
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <AnalyticsSection />
    </>
  );
}

const ACTION_LABELS_RU = {
  feed_read: 'Открыли пост',
  feed_engage: 'Лайки и комментарии',
  content_create: 'Создали контент',
  request_respond: 'Ответили на запрос',
  market_contact: 'Маркет: контакт/избранное',
  dating_like: 'Дейтинг: лайк',
  notification_open: 'Открыли уведомление',
  ad_click: 'Кликнули рекламу',
};

const MODULE_LABELS_RU = {
  app: 'Приложение',
  feed: 'Лента и посты',
  content: 'Создание',
  requests: 'Запросы',
  market: 'Маркет',
  dating: 'Дейтинг',
  notifications: 'Уведомления',
  moderation: 'Модерация',
  ads: 'Реклама',
  other: 'Другое',
};

const BUSINESS_LABELS_RU = {
  feed_engagement_pct: 'Лайки/комменты от ленты',
  post_open_rate_pct: 'Открытие постов из ленты',
  creator_share_pct: 'Доля создателей',
  request_response_pct: 'Отклик на запросы',
  market_intent_pct: 'Намерение в маркете',
  dating_usage_pct: 'Использование дейтинга',
  notification_reach_pct: 'Охват уведомлений',
  ads_click_pct: 'Клики по рекламе',
};

// Словарь переводов KPI-меток (label или metric_key с бэкенда)
const KPI_LABELS_RU = {
  'New Users': 'Новые пользователи',
  'Activated Users': 'Новые с активностью',
  'New Users With Activity': 'Новые с активностью',
  'Active Users': 'Активные пользователи',
  'Activation Rate %': 'Новые с активностью',
  'New User Activity %': 'Новые с активностью',
  'Feed Engagement %': 'Лайки/комменты от ленты',
  'Post Open Rate %': 'Открываемость постов',
  'Create Conversion %': 'Доля создателей',
  'Creator Share %': 'Доля создателей',
  'Request Response Rate %': 'Отклик на запросы',
  'Market Favorite Rate %': 'Избранное в маркете',
  'new_users': 'Новые пользователи',
  'activated_users': 'Новые с активностью',
  'active_users': 'Активные пользователи',
  'activation_rate': 'Конверсия активации',
  'feed_engagement_rate': 'Лайки/комменты от ленты',
  'post_open_rate': 'Открываемость постов',
  'creator_share_pct': 'Доля создателей',
  'create_conversion_pct': 'Доля создателей',
  'create_conversion_rate': 'Доля создателей',
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
    if (row?.unit === 'percent' || row?.unit === '%') return `${Number(raw).toFixed(2)}%`;
    if (typeof raw === 'number') return new Intl.NumberFormat('ru-RU').format(raw);
    return String(raw);
  };

  const allKpiRows = Array.isArray(report?.kpi_overview) ? report.kpi_overview : [];
  const usefulKpiRows = allKpiRows.filter((row) => row?.value !== null && row?.value !== undefined);
  const unavailableKpiRows = allKpiRows.filter((row) => row?.value === null || row?.value === undefined);
  const kpiRows = [...usefulKpiRows, ...unavailableKpiRows].slice(0, 8);
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

  backButtonPlaceholder: {
    width: 40,
    height: 40,
    flexShrink: 0,
  },

  headerTitle: {
    fontSize: 18, fontWeight: 800, color: '#fff',
  },

  tabsContainer: {
    padding: '12px 16px 0',
    position: 'sticky', top: 'calc(var(--drilldown-header-height) + env(safe-area-inset-top, 0px))', zIndex: 19,
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

  usageSummaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  },

  usageSummaryItem: {
    background: P.surfaceHover,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: 10,
    minWidth: 0,
  },

  usageList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  usageRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    background: P.surfaceHover,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: '10px 12px',
  },

  usageText: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },

  usageName: {
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  usageMeta: {
    fontSize: 11,
    color: P.textMuted,
  },

  usageValue: {
    fontSize: 15,
    fontWeight: 800,
    color: P.primary,
    flexShrink: 0,
  },

  placeRow: {
    background: P.surfaceHover,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: '10px 12px',
  },

  placeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },

  placeBar: {
    height: 6,
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 6,
  },

  placeBarFill: {
    height: '100%',
    borderRadius: 999,
    background: P.primary,
  },

  windowList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  windowBlock: {
    background: P.surfaceHover,
    borderRadius: 12,
    border: `1px solid ${P.border}`,
    overflow: 'hidden',
    position: 'relative',
  },

  windowToggle: {
    width: '100%',
    minHeight: 56,
    background: 'transparent',
    border: 'none',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    cursor: 'pointer',
    textAlign: 'left',
    color: '#fff',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    pointerEvents: 'auto',
    position: 'relative',
    zIndex: 1,
    outline: 'none',
  },

  windowToggleText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  },

  windowTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: '#fff',
  },

  windowToggleNumbers: {
    display: 'flex',
    alignItems: 'flex-end',
    flexDirection: 'column',
    gap: 2,
    flexShrink: 0,
  },

  windowValue: {
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 900,
    color: P.primary,
  },

  windowDelta: {
    fontSize: 11,
    fontWeight: 800,
  },

  windowDetails: {
    borderTop: `1px solid ${P.border}`,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },

  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: 8,
  },

  detailItem: {
    background: P.surfaceElevated,
    borderRadius: 10,
    border: `1px solid ${P.border}`,
    padding: 10,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  detailTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: P.textMuted,
    textTransform: 'uppercase',
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
