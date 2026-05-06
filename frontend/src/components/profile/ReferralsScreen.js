import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Gift, Send, Trophy } from 'lucide-react';
import { getReferralSummary } from '../../api';
import { useStore } from '../../store';
import { hapticFeedback } from '../../utils/telegram';
import { toast } from '../shared/Toast';
import { buildMiniAppStartappUrl } from '../../utils/deepLinks';
import { shareReferralInviteViaTelegram } from '../../utils/telegramShare';
import { Z_REFERRALS_SCREEN } from '../../constants/zIndex';
import EdgeSwipeBack from '../shared/EdgeSwipeBack';
import { useTelegramScreen } from '../shared/telegram/useTelegramScreen';
import DrilldownHeader from '../shared/DrilldownHeader';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { resolveImageUrl } from '../../utils/mediaUrl';

const C = {
  bg: '#000000',
  surface: '#161616',
  surfaceElevated: '#202020',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#FFFFFF',
  textMuted: '#9A9AA1',
  textTertiary: '#6F6F76',
  accent: '#D4FF00',
  accentText: '#000000',
};

const REFERRAL_TABS = [
  { id: 'people', label: 'Люди' },
  { id: 'universities', label: 'Вузы' },
  { id: 'institutes', label: 'Институты' },
];

const REFERRAL_CHART_COLORS = ['#D4FF00', '#5EE7E4', '#DA35C2', '#F0A640', '#765DE6'];

const truncateGroupLabel = (value, maxLength = 11) => {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const getInitials = (name) => {
  const text = String(name || '').trim();
  return text ? text.charAt(0).toUpperCase() : '?';
};

function ReferralGroupChart({ items, emptyText }) {
  const chartItems = items;
  const maxValue = Math.max(...chartItems.map((item) => Number(item.referrals_count) || 0), 0);
  const chartWidth = chartItems.length > 5 ? chartItems.length * 82 : '100%';

  if (!maxValue) {
    return <div style={styles.state}>{emptyText}</div>;
  }

  return (
    <div style={styles.chartPanel}>
      <div style={styles.chartScroller}>
        <div style={{ ...styles.chartGrid, width: chartWidth }}>
          {chartItems.map((item, index) => {
            const value = Number(item.referrals_count) || 0;
            const height = Math.max(16, Math.round((value / maxValue) * 100));
            const color = REFERRAL_CHART_COLORS[index % REFERRAL_CHART_COLORS.length];

            return (
              <div key={item.key} style={styles.chartColumn}>
                <div style={styles.chartValue}>{value}</div>
                <div style={styles.chartTrack}>
                  <div
                    style={{
                      ...styles.chartBar,
                      height: `${height}%`,
                      background: color,
                      boxShadow: `0 0 18px ${color}55`,
                      animationDelay: `${Math.min(index, 8) * 0.035}s`,
                    }}
                  />
                </div>
                <div style={styles.chartLabel} title={item.label}>
                  {truncateGroupLabel(item.label)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ReferralGroupList({ items }) {
  return (
    <div style={styles.groupList}>
      {items.slice(0, 10).map((entry) => (
        <div
          key={entry.key}
          style={{
            ...styles.groupRow,
            ...(entry.is_my_group ? styles.rowMe : null),
          }}
        >
          <div style={styles.rank}>#{entry.rank}</div>
          <div style={styles.groupText}>
            <div style={styles.groupName}>{entry.label}</div>
            {(entry.city || entry.university) && (
              <div style={styles.groupMeta}>
                {[entry.university, entry.city].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
          <div style={styles.count}>{entry.referrals_count}</div>
        </div>
      ))}
    </div>
  );
}

function ReferralAvatar({ entry }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatarUrl = imageFailed ? '' : resolveImageUrl(entry?.avatar, 'avatars');

  return (
    <div style={styles.avatar}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={styles.avatarImage}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{getInitials(entry?.name)}</span>
      )}
    </div>
  );
}

function PeopleLeaderboard({ items }) {
  if (!items.length) {
    return (
      <div style={styles.state}>
        Пока никто не приглашал друзей на этой неделе
      </div>
    );
  }

  return (
    <div style={styles.leaderboard}>
      {items.map((entry) => (
        <div
          key={entry.user_id}
          style={{
            ...styles.peopleRow,
            ...(entry.is_me ? styles.rowMe : null),
          }}
        >
          <div style={styles.rank}>#{entry.rank}</div>
          <ReferralAvatar entry={entry} />
          <div style={styles.personName}>{entry.name}</div>
          <div style={styles.count}>{entry.referrals_count}</div>
        </div>
      ))}
    </div>
  );
}

function ReferralsScreen() {
  const { setShowReferralsScreen } = useStore();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('people');
  const [isExiting, setIsExiting] = useState(false);
  const closeTimeoutRef = useRef(null);

  const closeImmediately = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsExiting(false);
    setShowReferralsScreen(false);
  }, [setShowReferralsScreen]);

  const handleClose = useCallback(() => {
    if (isExiting) return;
    hapticFeedback('light');
    setIsExiting(true);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setIsExiting(false);
      setShowReferralsScreen(false);
    }, 340);
  }, [isExiting, setShowReferralsScreen]);

  useTelegramScreen({
    id: 'referrals-screen',
    title: 'Конкурс приглашений',
    priority: 40,
    back: { visible: true, onClick: handleClose },
  });

  useBodyScrollLock();

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getReferralSummary();
      setSummary(data);
    } catch (err) {
      console.error('Referral summary load error:', err);
      setError('Не удалось загрузить рейтинг приглашений');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  const peopleLeaderboard = useMemo(
    () => summary?.people_leaderboard || summary?.leaderboard || [],
    [summary]
  );
  const universityLeaderboard = useMemo(
    () => summary?.university_leaderboard || [],
    [summary]
  );
  const instituteLeaderboard = useMemo(
    () => summary?.institute_leaderboard || [],
    [summary]
  );
  const instituteScopeLabel = summary?.institute_scope?.label || 'твоего вуза';
  const hasCode = Boolean(summary?.referral_code);

  const activeGroupData = useMemo(() => {
    if (activeTab === 'universities') {
      return {
        title: 'Вузы недели',
        items: universityLeaderboard,
        empty: 'Пока нет приглашений по вузам на этой неделе',
      };
    }

    return {
      title: `Институты ${instituteScopeLabel}`,
      items: instituteLeaderboard,
      empty: 'Пока нет приглашений внутри твоего вуза',
    };
  }, [activeTab, instituteLeaderboard, instituteScopeLabel, universityLeaderboard]);

  const handleShare = () => {
    if (!summary?.referral_code) return;
    hapticFeedback('medium');
    shareReferralInviteViaTelegram(summary.referral_code);
  };

  const handleCopy = async () => {
    if (!summary?.referral_code) return;
    const link = buildMiniAppStartappUrl(`ref_${summary.referral_code}`);
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Ссылка скопирована');
      hapticFeedback('success');
    } catch (err) {
      console.error('Referral link copy error:', err);
      toast.error('Не удалось скопировать ссылку');
      hapticFeedback('error');
    }
  };

  const containerStyle = {
    ...styles.container,
    animation: isExiting
      ? 'referralsScreenSlideOut 0.32s cubic-bezier(0.32,0.72,0,1) forwards'
      : 'referralsScreenSlideIn 0.38s cubic-bezier(0.32,0.72,0,1) forwards',
    pointerEvents: isExiting ? 'none' : 'auto',
  };

  const placeText = summary?.my_rank ? `#${summary.my_rank}` : '—';

  return (
    <>
      <style>{`
        @keyframes referralsScreenSlideIn { from { transform: translate3d(100%, 0, 0); } to { transform: translate3d(0, 0, 0); } }
        @keyframes referralsScreenSlideOut { from { transform: translate3d(0, 0, 0); } to { transform: translate3d(100%, 0, 0); } }
        @keyframes referralBarGrow { from { transform: scaleY(0); opacity: 0.45; } to { transform: scaleY(1); opacity: 1; } }
      `}</style>
      <EdgeSwipeBack
        onBack={closeImmediately}
        disabled={isExiting}
        zIndex={Z_REFERRALS_SCREEN}
      >
        <div style={containerStyle}>
          <DrilldownHeader
            title="Конкурс приглашений"
            onBack={handleClose}
            background="#000000"
            showDivider={false}
          />

          <div style={styles.scrollArea}>
            <div style={styles.content}>
              <section style={styles.hero}>
                <div style={styles.heroIcon}>
                  <Gift size={24} />
                </div>
                <div>
                  <h2 style={styles.heroTitle}>Приглашай друзей в CampusApp</h2>
                  <p style={styles.heroText}>
                    Реферал засчитывается после регистрации друга. Рейтинг обновляется за текущую неделю.
                  </p>
                </div>
              </section>

              {loading && (
                <div style={styles.state}>Загружаем конкурс...</div>
              )}

              {!loading && error && (
                <div style={styles.state}>
                  <div>{error}</div>
                  <button type="button" style={styles.retryButton} onClick={loadSummary}>
                    Повторить
                  </button>
                </div>
              )}

              {!loading && !error && summary && (
                <>
                  <section style={styles.stats}>
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Твой результат</span>
                      <strong style={styles.statValue}>{summary.my_count || 0}</strong>
                    </div>
                    <div style={styles.statDivider} />
                    <div style={styles.statItem}>
                      <span style={styles.statLabel}>Место</span>
                      <strong style={styles.statValue}>{placeText}</strong>
                    </div>
                  </section>

                  <div style={styles.tabs}>
                    <div
                      style={{
                        ...styles.tabIndicator,
                        transform: `translateX(${REFERRAL_TABS.findIndex((tab) => tab.id === activeTab) * 100}%)`,
                      }}
                    />
                    {REFERRAL_TABS.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          style={{
                            ...styles.tabButton,
                            color: isActive ? C.accentText : C.textMuted,
                          }}
                          onClick={() => {
                            hapticFeedback('selection');
                            setActiveTab(tab.id);
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <section style={styles.section}>
                    <div style={styles.sectionTitleRow}>
                      <h3 style={styles.sectionTitle}>
                        {activeTab === 'people' ? 'Лидеры недели' : activeGroupData.title}
                      </h3>
                      {activeTab !== 'people' && <Trophy size={18} color={C.accent} />}
                    </div>

                    {activeTab === 'people' ? (
                      <PeopleLeaderboard items={peopleLeaderboard} />
                    ) : (
                      <>
                        <ReferralGroupChart
                          key={activeTab}
                          items={activeGroupData.items}
                          emptyText={activeGroupData.empty}
                        />
                        {activeGroupData.items.length > 0 && <ReferralGroupList items={activeGroupData.items} />}
                      </>
                    )}
                  </section>
                </>
              )}
            </div>
          </div>

          <div style={styles.footer}>
            <button
              type="button"
              style={{ ...styles.primaryButton, opacity: hasCode ? 1 : 0.55 }}
              onClick={handleShare}
              disabled={!hasCode}
            >
              <Send size={18} />
              Отправить в Telegram
            </button>
            <button
              type="button"
              style={{ ...styles.secondaryButton, opacity: hasCode ? 1 : 0.55 }}
              onClick={handleCopy}
              disabled={!hasCode}
            >
              <Copy size={18} />
              Скопировать ссылку
            </button>
          </div>
        </div>
      </EdgeSwipeBack>
    </>
  );
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_REFERRALS_SCREEN,
    background: C.bg,
    color: C.text,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  scrollArea: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    paddingBottom: 'calc(136px + env(safe-area-inset-bottom, 0px))',
  },
  content: {
    width: '100%',
    maxWidth: 680,
    margin: '0 auto',
    padding: '12px 16px 0',
    boxSizing: 'border-box',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: '52px 1fr',
    gap: 14,
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    background: C.surface,
    border: `1px solid ${C.border}`,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(212, 255, 0, 0.12)',
    color: C.accent,
  },
  heroTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: '24px',
    fontWeight: 800,
    letterSpacing: 0,
  },
  heroText: {
    margin: '6px 0 0',
    color: C.textMuted,
    fontSize: 14,
    lineHeight: '19px',
  },
  state: {
    marginTop: 14,
    minHeight: 96,
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.textMuted,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 16,
    fontSize: 14,
    lineHeight: '20px',
  },
  retryButton: {
    border: 'none',
    borderRadius: 8,
    padding: '10px 14px',
    background: C.accent,
    color: C.accentText,
    fontWeight: 800,
    cursor: 'pointer',
  },
  stats: {
    marginTop: 14,
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    alignItems: 'stretch',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    background: C.surface,
    overflow: 'hidden',
  },
  statItem: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  statLabel: {
    color: C.textMuted,
    fontSize: 13,
    lineHeight: '16px',
  },
  statValue: {
    fontSize: 30,
    lineHeight: '34px',
    fontWeight: 900,
    letterSpacing: 0,
  },
  statDivider: {
    background: C.border,
  },
  tabs: {
    position: 'relative',
    marginTop: 14,
    display: 'flex',
    height: 42,
    padding: 0,
    borderRadius: 14,
    background: '#1C1C1E',
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 'calc(100% / 3)',
    borderRadius: 14,
    background: C.accent,
    boxShadow: '0 2px 10px rgba(212,255,0,0.2)',
    transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
    zIndex: 1,
  },
  tabButton: {
    flex: 1,
    position: 'relative',
    zIndex: 2,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    lineHeight: '16px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'color 0.2s',
  },
  section: {
    marginTop: 18,
  },
  sectionTitleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: '22px',
    fontWeight: 850,
    letterSpacing: 0,
  },
  leaderboard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  peopleRow: {
    minHeight: 58,
    display: 'grid',
    gridTemplateColumns: '48px 42px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    background: C.surface,
    border: `1px solid ${C.border}`,
  },
  rowMe: {
    borderColor: 'rgba(212, 255, 0, 0.42)',
    background: 'rgba(212, 255, 0, 0.08)',
  },
  rank: {
    color: C.textMuted,
    fontSize: 14,
    fontWeight: 850,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: C.surfaceElevated,
    color: C.accent,
    fontSize: 15,
    fontWeight: 900,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  personName: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: C.text,
    fontSize: 15,
    fontWeight: 750,
  },
  count: {
    minWidth: 34,
    height: 34,
    padding: '0 10px',
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.08)',
    color: C.text,
    fontSize: 16,
    fontWeight: 900,
  },
  chartPanel: {
    padding: '16px 0 12px',
    borderRadius: 8,
    background: C.surface,
    border: `1px solid ${C.border}`,
    overflow: 'hidden',
  },
  chartScroller: {
    overflowX: 'auto',
    overflowY: 'hidden',
    WebkitOverflowScrolling: 'touch',
    padding: '0 10px 2px',
    scrollbarWidth: 'none',
  },
  chartGrid: {
    height: 248,
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(58px, 1fr)',
    gap: 12,
    alignItems: 'end',
    padding: '0 4px',
    minWidth: '100%',
  },
  chartColumn: {
    minWidth: 0,
    height: '100%',
    display: 'grid',
    gridTemplateRows: '24px 1fr 26px',
    alignItems: 'end',
    justifyItems: 'center',
    gap: 6,
  },
  chartValue: {
    color: C.text,
    fontSize: 15,
    lineHeight: '20px',
    fontWeight: 900,
  },
  chartTrack: {
    width: '100%',
    maxWidth: 78,
    height: '100%',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.12)',
  },
  chartBar: {
    width: '100%',
    minHeight: 18,
    borderRadius: '14px 14px 8px 8px',
    transformOrigin: 'bottom',
    animation: 'referralBarGrow 0.48s cubic-bezier(0.32, 0.72, 0, 1) both',
  },
  chartLabel: {
    width: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    color: C.textMuted,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 800,
  },
  groupList: {
    marginTop: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  groupRow: {
    minHeight: 58,
    display: 'grid',
    gridTemplateColumns: '48px 1fr auto',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 8,
    background: C.surface,
    border: `1px solid ${C.border}`,
  },
  groupText: {
    minWidth: 0,
  },
  groupName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: C.text,
    fontSize: 15,
    fontWeight: 800,
  },
  groupMeta: {
    marginTop: 3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: C.textMuted,
    fontSize: 12,
    lineHeight: '16px',
  },
  footer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
    maxWidth: 648,
    margin: '0 auto',
    zIndex: Z_REFERRALS_SCREEN + 1,
    display: 'grid',
    gap: 10,
    boxSizing: 'border-box',
    pointerEvents: 'none',
  },
  primaryButton: {
    height: 48,
    border: 'none',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: C.accent,
    color: C.accentText,
    fontSize: 15,
    fontWeight: 900,
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: '0 14px 34px rgba(0, 0, 0, 0.38)',
  },
  secondaryButton: {
    height: 44,
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: C.surface,
    color: C.text,
    fontSize: 14,
    fontWeight: 850,
    cursor: 'pointer',
    pointerEvents: 'auto',
    boxShadow: '0 12px 28px rgba(0, 0, 0, 0.34)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
  },
};

export default ReferralsScreen;
