// ===== FILE: frontend/src/components/posts/PostFiltersModal.js =====
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import { useBottomSheetModal } from '../../hooks/useBottomSheetModal';
import { hapticFeedback } from '../../utils/telegram';
import { getCampusDisplayName, getUserCity } from '../../constants/universityData';
import { CREATE_CONTENT_POST_CATEGORIES } from '../../constants/createContentUiConfig';

const D = {
  accent:          '#D4FF00',
  accentText:      '#000000',
  accentBg:        'rgba(212,255,0,0.08)',
  accentBgStrong:  'rgba(212,255,0,0.12)',
  accentBorder:    'rgba(212,255,0,0.35)',
  accentBorderSub: 'rgba(212,255,0,0.22)',
  accentInset:     'inset 3px 0 0 #D4FF00, 0 0 16px rgba(212,255,0,0.06)',
  accentGlowBtn:   '0 0 10px rgba(212,255,0,0.12)',
  surface:         'rgba(255,255,255,0.03)',
  surfaceEl:       'rgba(255,255,255,0.04)',
  border:          'rgba(255,255,255,0.07)',
  muted:           '#888888',
  body:            '#D1D1D1',
  transUI:         '0.2s cubic-bezier(0.4,0,0.2,1)',
};

const PostFiltersModal = ({ onClose, onApply, resultsCount = null, fetchCount = null }) => {
  const { isOpen, requestClose } = useBottomSheetModal({ onClose });
  const {
    user,
    feedSubTab,
    postsFilters,
    requestsFilters,
    setPostsFilters,
    setRequestsFilters,
    clearPostsFilters,
    clearRequestsFilters,
  } = useStore();

  const isPostsMode = feedSubTab === 'posts';

  const [localFilters, setLocalFilters] = useState(
    isPostsMode ? { ...postsFilters } : { ...requestsFilters }
  );

  useEffect(() => {
    setLocalFilters(isPostsMode ? { ...postsFilters } : { ...requestsFilters });
  }, [feedSubTab, postsFilters, requestsFilters, isPostsMode]);


  // ===== ОПЦИИ ДЛЯ ПОСТОВ =====

  const postThemes = CREATE_CONTENT_POST_CATEGORIES.map((category) => ({
    id: category.value,
    label: `${category.icon} ${category.label}`,
  }));

  const dateRangeOptions = [
    { value: 'all',   label: 'Всё время' },
    { value: 'today', label: 'Сегодня'   },
    { value: 'week',  label: 'Неделя'    },
    { value: 'month', label: 'Месяц'     },
  ];

  const postsSortOptions = [
    { value: 'newest',    label: 'Новые',        icon: '🆕' },
    { value: 'popular',   label: 'В тренде',      icon: '🔥' },
    { value: 'discussed', label: 'Обсуждаемые',  icon: '💬' },
  ];


  // ===== ОПЦИИ ДЛЯ ЗАПРОСОВ =====

  const urgencyOptions = [
    { value: 'all',  label: 'Все'           },
    { value: 'soon', label: 'Срочно (<24ч)' },
    { value: 'later', label: 'Не срочно'    },
  ];

  const statusOptions = [
    { value: 'active', label: 'Активные' },
    { value: 'all',    label: 'Все'       },
  ];

  const rewardOptions = [
    { value: 'all',     label: 'Все'          },
    { value: 'with',    label: 'С наградой'   },
    { value: 'without', label: 'Без награды'  },
  ];

  const requestsSortOptions = [
    { value: 'newest',         label: 'Новые',      icon: '🆕' },
    { value: 'expires_soon',   label: 'Истекают',   icon: '⏰' },
    { value: 'most_responses', label: 'Популярные', icon: '🔥' },
  ];


  // ===== ОБЩИЕ ОПЦИИ =====

  const cityLabel = getUserCity(user);

  const locationOptions = [
    { value: 'all',           label: 'Все'       },
    ...(user?.campus_id ? [{ value: 'my_campus',    label: 'Кампус'    }] : []),
    { value: 'my_university', label: 'Мой ВУЗ'   },
    ...(cityLabel ? [{ value: 'my_city', label: 'Мой город' }] : []),
  ];

  const CATEGORY_TAG_COLOR_MAP = {
    general:     { color: 'rgba(255,255,255,0.6)', bg: 'rgba(255,255,255,0.1)' },
    help:        theme.colors.premium.tagColors.help,
    news:        theme.colors.premium.tagColors.news,
    memes:       theme.colors.premium.tagColors.memes,
    confessions: theme.colors.premium.tagColors.confessions,
    polls:       { color: D.accent, bg: 'rgba(212,255,0,0.1)' },
    events:      theme.colors.premium.tagColors.events,
    lost_found:  theme.colors.premium.tagColors.lostFound,
  };


  // ===== HANDLERS =====

  const handleLocationChange = (value) => {
    hapticFeedback('selection');
    if (value === 'all') {
      setLocalFilters({ ...localFilters, location: 'all', university: 'all', institute: 'all', campus_id: null, city: null });
    } else if (value === 'my_campus') {
      setLocalFilters({ ...localFilters, location: 'my_campus', campus_id: user?.campus_id, university: user?.university, institute: 'all', city: null });
    } else if (value === 'my_university') {
      setLocalFilters({ ...localFilters, location: 'my_university', university: user?.university, institute: 'all', campus_id: null, city: null });
    } else if (value === 'my_city') {
      setLocalFilters({ ...localFilters, location: 'my_city', city: cityLabel, university: 'all', institute: 'all', campus_id: null });
    }
  };

  const handlePostThemeChange = (categoryId) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, category: localFilters.category === categoryId ? 'all' : categoryId, tags: [] });
  };

  const handleDateRangeChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, dateRange: value });
  };

  const handleUrgencyChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, urgency: value });
  };

  const handleStatusChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, status: value });
  };

  const handleRewardChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, hasReward: value });
  };

  const handleSortChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, sort: value });
  };

  const handleRemoveFilter = (key, defaultValue) => {
    hapticFeedback('selection');
    if (key === 'location') {
      setLocalFilters(prev => ({ ...prev, location: 'all', university: 'all', institute: 'all', campus_id: null, city: null }));
    } else {
      setLocalFilters(prev => ({ ...prev, [key]: defaultValue }));
    }
  };

  const handleApply = () => {
    hapticFeedback('medium');
    if (isPostsMode) {
      setPostsFilters(localFilters);
    } else {
      setRequestsFilters(localFilters);
    }
    onApply();
    requestClose();
  };

  const handleReset = () => {
    hapticFeedback('light');
    if (isPostsMode) {
      const defaultFilters = { category: 'all', location: 'all', university: 'all', institute: 'all', campus_id: null, city: null, tags: [], dateRange: 'all', sort: 'newest' };
      setLocalFilters(defaultFilters);
      clearPostsFilters();
    } else {
      const defaultFilters = { location: 'all', university: 'all', institute: 'all', campus_id: null, city: null, status: 'active', hasReward: 'all', urgency: 'all', sort: 'newest' };
      setLocalFilters(defaultFilters);
      clearRequestsFilters();
    }
    onApply();
    requestClose();
  };

  const activeFiltersCount = () => {
    let count = 0;
    if (isPostsMode) {
      if (localFilters.category !== 'all') count++;
      if (localFilters.location !== 'all') count++;
      if (localFilters.dateRange !== 'all') count++;
      if (localFilters.sort !== 'newest') count++;
    } else {
      if (localFilters.location !== 'all') count++;
      if (localFilters.status !== 'active') count++;
      if (localFilters.hasReward !== 'all') count++;
      if (localFilters.urgency !== 'all') count++;
      if (localFilters.sort !== 'newest') count++;
    }
    return count;
  };

  const activeCount = activeFiltersCount();

  const [liveCount, setLiveCount] = useState(resultsCount);
  const debounceRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!fetchCount) return;
    setLiveCount(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const count = await fetchCount(localFilters);
      setLiveCount(count);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [localFilters]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <SwipeableModal
      isOpen={isOpen}
      onClose={requestClose}
      showHeaderDivider={false}
      title={
        <div style={styles.titleWrapper}>
          {activeCount > 0 && (
            <span style={styles.titleLeft}>
              Фильтры: <span style={{ color: D.accent }}>{activeCount}</span>
            </span>
          )}
          <span>Фильтры {isPostsMode ? 'постов' : 'запросов'}</span>
          {activeCount > 0 && (
            <span style={styles.titleRight}>
              {liveCount != null
                ? <>Найдено: <span style={{ color: D.body }}>{liveCount}</span></>
                : <>Найдено: <span style={styles.shimmer} /></>
              }
            </span>
          )}
        </div>
      }
      footer={
        <div style={styles.footer}>
          <button onClick={handleReset} style={styles.resetButton} className="pressable">
            Сбросить
          </button>
          <button onClick={handleApply} style={styles.applyButton} className="pressable">
            Применить
          </button>
        </div>
      }
    >
      <style>{`@keyframes filterShimmer{0%,100%{opacity:.25}50%{opacity:.6}}`}</style>
      <div style={styles.container}>

        <ActiveFiltersStrip
          filters={localFilters}
          isPostsMode={isPostsMode}
          locationOptions={locationOptions}
          postThemes={postThemes}
          dateRangeOptions={dateRangeOptions}
          postsSortOptions={postsSortOptions}
          urgencyOptions={urgencyOptions}
          rewardOptions={rewardOptions}
          statusOptions={statusOptions}
          requestsSortOptions={requestsSortOptions}
          onRemove={handleRemoveFilter}
        />

        <SectionCard title="ЛОКАЦИЯ" isActive={localFilters.location !== 'all'}>
          <SegmentedControl
            options={locationOptions}
            value={localFilters.location}
            onChange={handleLocationChange}
          />
        </SectionCard>

        {/* ===== ФИЛЬТРЫ ДЛЯ ПОСТОВ ===== */}
        {isPostsMode && (
          <>
            <SectionCard title="ТЕМА" isActive={localFilters.category !== 'all'}>
              <CategoryTileGrid
                categories={CREATE_CONTENT_POST_CATEGORIES}
                selected={localFilters.category}
                onSelect={handlePostThemeChange}
                tagColorMap={CATEGORY_TAG_COLOR_MAP}
              />
            </SectionCard>

            <SectionCard title="ДАТА ПУБЛИКАЦИИ" isActive={localFilters.dateRange !== 'all'}>
              <OptionPills
                options={dateRangeOptions}
                value={localFilters.dateRange}
                onChange={handleDateRangeChange}
              />
            </SectionCard>

            <SectionCard title="СОРТИРОВКА" isActive={localFilters.sort !== 'newest'}>
              <SortGrid
                options={postsSortOptions}
                value={localFilters.sort}
                onChange={handleSortChange}
              />
            </SectionCard>
          </>
        )}

        {/* ===== ФИЛЬТРЫ ДЛЯ ЗАПРОСОВ ===== */}
        {!isPostsMode && (
          <>
            <SectionCard title="СРОЧНОСТЬ" isActive={localFilters.urgency !== 'all'}>
              <OptionPills
                options={urgencyOptions}
                value={localFilters.urgency}
                onChange={handleUrgencyChange}
              />
            </SectionCard>

            <SectionCard title="ВОЗНАГРАЖДЕНИЕ" isActive={localFilters.hasReward !== 'all'}>
              <OptionPills
                options={rewardOptions}
                value={localFilters.hasReward}
                onChange={handleRewardChange}
              />
            </SectionCard>

            <SectionCard title="СТАТУС" isActive={localFilters.status !== 'active'}>
              <OptionPills
                options={statusOptions}
                value={localFilters.status}
                onChange={handleStatusChange}
              />
            </SectionCard>

            <SectionCard title="СОРТИРОВКА" isActive={localFilters.sort !== 'newest'}>
              <SortGrid
                options={requestsSortOptions}
                value={localFilters.sort}
                onChange={handleSortChange}
              />
            </SectionCard>
          </>
        )}

      </div>
    </SwipeableModal>
  );
};


// ===== ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ =====

const SectionCard = ({ title, isActive, children }) => (
  <div style={{
    background: D.surface,
    border: '1px solid ' + (isActive ? D.accentBorderSub : D.border),
    borderRadius: 16,
    padding: 14,
    boxShadow: isActive ? D.accentInset : 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  }}>
    <div style={{
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '1.2px',
      color: '#555',
      fontWeight: 600,
      marginBottom: 10,
    }}>
      {title}
    </div>
    {children}
  </div>
);

const SegmentedControl = ({ options, value, onChange }) => (
  <div style={{
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 9999,
    padding: 3,
    display: 'flex',
  }}>
    {options.map(option => (
      <button
        key={option.value}
        className="pressable"
        onClick={() => onChange(option.value)}
        style={{
          flex: 1,
          minWidth: 0,
          padding: '7px 4px',
          borderRadius: 9999,
          fontSize: 12,
          textAlign: 'center',
          border: 'none',
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: D.transUI,
          background: value === option.value ? D.accent : 'transparent',
          color: value === option.value ? '#000' : D.muted,
          fontWeight: value === option.value ? 600 : 400,
        }}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const CategoryTileGrid = ({ categories, selected, onSelect, tagColorMap }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 8,
  }}>
    {categories.map(cat => {
      const isActive = selected === cat.value;
      const tagColor = tagColorMap[cat.value] || { color: D.muted, bg: 'rgba(255,255,255,0.06)' };
      return (
        <button
          key={cat.value}
          className="pressable"
          onClick={() => onSelect(cat.value)}
          style={{
            borderRadius: 12,
            padding: '10px 4px',
            minHeight: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid ' + (isActive ? tagColor.color + '99' : 'rgba(255,255,255,0.06)'),
            background: isActive ? tagColor.bg : D.surface,
            transition: D.transUI,
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: isActive ? tagColor.bg : 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            marginBottom: 5,
          }}>
            {cat.icon || '🗂'}
          </div>
          <div style={{
            fontSize: 10,
            textAlign: 'center',
            lineHeight: 1.2,
            color: isActive ? tagColor.color : D.muted,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {cat.label}
          </div>
        </button>
      );
    })}
  </div>
);

const OptionPills = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {options.map(option => {
      const isActive = value === option.value;
      return (
        <button
          key={option.value}
          className="pressable"
          onClick={() => onChange(option.value)}
          style={{
            borderRadius: 9999,
            padding: '7px 14px',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            border: '1px solid',
            whiteSpace: 'nowrap',
            transition: D.transUI,
            background: isActive ? D.accentBgStrong : 'rgba(255,255,255,0.06)',
            color: isActive ? D.accent : D.muted,
            borderColor: isActive ? D.accentBorder : 'transparent',
            boxShadow: isActive ? D.accentGlowBtn : 'none',
          }}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

const SortGrid = ({ options, value, onChange }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
    {options.map(option => {
      const isActive = value === option.value;
      return (
        <button
          key={option.value}
          className="pressable"
          onClick={() => onChange(option.value)}
          style={{
            borderRadius: 14,
            padding: '14px 8px',
            minHeight: 72,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: D.transUI,
            background: isActive ? D.accentBg : D.surfaceEl,
            color: isActive ? D.accent : D.muted,
            boxShadow: isActive ? '0 4px 12px rgba(212,255,0,0.1)' : 'none',
            ...(isActive ? {
              borderTopWidth: 2.5, borderTopStyle: 'solid', borderTopColor: D.accent,
              borderRightWidth: 1, borderRightStyle: 'solid', borderRightColor: D.accentBorder,
              borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: D.accentBorder,
              borderLeftWidth: 1, borderLeftStyle: 'solid', borderLeftColor: D.accentBorder,
            } : {
              borderWidth: 1, borderStyle: 'solid', borderColor: D.border,
            }),
          }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>{option.icon}</span>
          <span style={{ fontSize: 12, fontWeight: 600, marginTop: 7, textAlign: 'center' }}>
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

const ActiveFiltersStrip = ({
  filters, isPostsMode,
  locationOptions, postThemes, dateRangeOptions, postsSortOptions,
  urgencyOptions, rewardOptions, statusOptions, requestsSortOptions,
  onRemove,
}) => {
  const badges = [];

  if (filters.location !== 'all') {
    const opt = locationOptions.find(o => o.value === filters.location);
    badges.push({ key: 'location', label: '📍 ' + (opt?.label || filters.location), default: 'all' });
  }

  if (isPostsMode) {
    if (filters.category !== 'all') {
      const opt = postThemes.find(t => t.id === filters.category);
      const raw = opt?.label || filters.category;
      badges.push({ key: 'category', label: raw.replace(/^\S+\s?/, ''), default: 'all' });
    }
    if (filters.dateRange !== 'all') {
      const opt = dateRangeOptions.find(o => o.value === filters.dateRange);
      badges.push({ key: 'dateRange', label: opt?.label || filters.dateRange, default: 'all' });
    }
    if (filters.sort !== 'newest') {
      const opt = postsSortOptions.find(o => o.value === filters.sort);
      badges.push({ key: 'sort', label: opt?.label || filters.sort, default: 'newest' });
    }
  } else {
    if (filters.urgency !== 'all') {
      const opt = urgencyOptions.find(o => o.value === filters.urgency);
      badges.push({ key: 'urgency', label: opt?.label || filters.urgency, default: 'all' });
    }
    if (filters.hasReward !== 'all') {
      const opt = rewardOptions.find(o => o.value === filters.hasReward);
      badges.push({ key: 'hasReward', label: opt?.label || filters.hasReward, default: 'all' });
    }
    if (filters.status !== 'active') {
      const opt = statusOptions.find(o => o.value === filters.status);
      badges.push({ key: 'status', label: opt?.label || filters.status, default: 'active' });
    }
    if (filters.sort !== 'newest') {
      const opt = requestsSortOptions.find(o => o.value === filters.sort);
      badges.push({ key: 'sort', label: opt?.label || filters.sort, default: 'newest' });
    }
  }

  if (badges.length === 0) return null;

  return (
    <div
      className="hide-scroll"
      style={{
        overflowX: 'auto',
        display: 'flex',
        gap: 8,
        paddingBottom: 4,
        marginBottom: 4,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {badges.map(badge => (
        <button
          key={badge.key}
          onClick={() => onRemove(badge.key, badge.default)}
          style={{
            borderRadius: 9999,
            padding: '4px 10px',
            background: 'rgba(212,255,0,0.1)',
            border: '1px solid rgba(212,255,0,0.3)',
            color: D.accent,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            transition: D.transUI,
          }}
        >
          {badge.label}
          <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
        </button>
      ))}
    </div>
  );
};


// ===== СТИЛИ =====
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  titleLeft: {
    position: 'absolute',
    left: 0,
    fontSize: 12,
    fontWeight: 500,
    color: D.muted,
    whiteSpace: 'nowrap',
  },
  titleRight: {
    position: 'absolute',
    right: 0,
    fontSize: 12,
    fontWeight: 500,
    color: D.muted,
    whiteSpace: 'nowrap',
  },
  shimmer: {
    display: 'inline-block',
    width: 30,
    height: 13,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.1)',
    animation: 'filterShimmer 1.4s ease-in-out infinite',
    verticalAlign: 'middle',
    marginLeft: 2,
  },
  footer: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  resetButton: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    fontWeight: 600,
    color: D.body,
    cursor: 'pointer',
    transition: D.transUI,
  },
  applyButton: {
    flex: 2,
    background: D.accent,
    border: 'none',
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    fontWeight: 700,
    color: D.accentText,
    letterSpacing: '0.3px',
    cursor: 'pointer',
    transition: D.transUI,
  },
};


export default PostFiltersModal;
