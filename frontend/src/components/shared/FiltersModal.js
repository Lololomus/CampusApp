// ===== 📄 ФАЙЛ: frontend/src/components/shared/FiltersModal.js =====
import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import theme from '../../theme';
import SwipeableModal from './SwipeableModal';
import { hapticFeedback } from '../../utils/telegram';
import { getCampusDisplayName, getUserCity } from '../../constants/universityData';


const FiltersModal = ({ onClose, onApply }) => {
  const { 
    user, 
    feedSubTab,
    postsFilters, 
    requestsFilters,
    setPostsFilters,
    setRequestsFilters,
    clearPostsFilters,
    clearRequestsFilters
  } = useStore();

  const isPostsMode = feedSubTab === 'posts';
  
  const [localFilters, setLocalFilters] = useState(
    isPostsMode ? { ...postsFilters } : { ...requestsFilters }
  );

  useEffect(() => {
    setLocalFilters(isPostsMode ? { ...postsFilters } : { ...requestsFilters });
  }, [feedSubTab, postsFilters, requestsFilters, isPostsMode]);


  // ===== ОПЦИИ ДЛЯ ПОСТОВ =====
  
  const STUDENT_TAGS = [
    { id: 'помощь', label: 'Помощь', emoji: '🤝' },
    { id: 'срочно', label: 'Срочно', emoji: '⚡' },
    { id: 'конспекты', label: 'Конспекты', emoji: '📝' },
    { id: 'экзамены', label: 'Экзамены', emoji: '📚' },
    { id: 'учеба', label: 'Учеба', emoji: '🎓' },
    { id: 'курсовая', label: 'Курсовая', emoji: '📄' },
    { id: 'общага', label: 'Общага', emoji: '🏠' },
    { id: 'мероприятие', label: 'Мероприятие', emoji: '🎉' },
    { id: 'стажировка', label: 'Стажировка', emoji: '💼' },
    { id: 'практика', label: 'Практика', emoji: '🔧' },
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'Всё время', icon: '📅' },
    { value: 'today', label: 'Сегодня', icon: '🌅' },
    { value: 'week', label: 'Неделя', icon: '📆' },
    { value: 'month', label: 'Месяц', icon: '📊' },
  ];

  const postsSortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'popular', label: 'Популярные', icon: '🔥' },
    { value: 'discussed', label: 'Обсуждаемые', icon: '💬' },
  ];


  // ===== ОПЦИИ ДЛЯ ЗАПРОСОВ =====

  const urgencyOptions = [
    { value: 'all', label: 'Все', icon: '📋' },
    { value: 'soon', label: 'Срочно (<24ч)', icon: '⚡' },
    { value: 'later', label: 'Не срочно', icon: '⏰' },
  ];

  const statusOptions = [
    { value: 'active', label: 'Активные', icon: '✅' },
    { value: 'all', label: 'Все', icon: '📋' },
  ];

  const rewardOptions = [
    { value: 'all', label: 'Все', icon: '📋' },
    { value: 'with', label: 'С наградой', icon: '💰' },
    { value: 'without', label: 'Без награды', icon: '🎁' },
  ];

  const requestsSortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'expires_soon', label: 'Истекают', icon: '⏰' },
    { value: 'most_responses', label: 'Популярные', icon: '🔥' },
  ];


  // ===== ОБЩИЕ ОПЦИИ =====

  const campusLabel = getCampusDisplayName(user);
  const cityLabel = getUserCity(user);

  const locationOptions = [
    { value: 'all', label: 'Все университеты' },
    // Мой кампус — только для привязанных (campus_id != null)
    ...(user?.campus_id ? [{ value: 'my_campus', label: `Мой кампус (${campusLabel})` }] : []),
    { value: 'my_university', label: `Мой ВУЗ (${user?.university || '—'})` },
    ...(cityLabel ? [{ value: 'my_city', label: `Мой город (${cityLabel})` }] : []),
  ];


  // ===== HANDLERS =====

  const handleLocationChange = (value) => {
    hapticFeedback('light');
    if (value === 'all') {
      setLocalFilters({
        ...localFilters,
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
      });
    } else if (value === 'my_campus') {
      setLocalFilters({
        ...localFilters,
        location: 'my_campus',
        campus_id: user?.campus_id,
        university: user?.university,
        institute: 'all',
        city: null,
      });
    } else if (value === 'my_university') {
      setLocalFilters({
        ...localFilters,
        location: 'my_university',
        university: user?.university,
        institute: 'all',
        campus_id: null,
        city: null,
      });
    } else if (value === 'my_city') {
      setLocalFilters({
        ...localFilters,
        location: 'my_city',
        city: cityLabel,
        university: 'all',
        institute: 'all',
        campus_id: null,
      });
    }
  };

  const handleTagToggle = (tagId) => {
    hapticFeedback('light');
    const currentTags = localFilters.tags || [];
    const newTags = currentTags.includes(tagId)
      ? currentTags.filter(t => t !== tagId)
      : [...currentTags, tagId];
    
    setLocalFilters({
      ...localFilters,
      tags: newTags,
    });
  };

  const isTagSelected = (tagId) => {
    return localFilters.tags?.includes(tagId) || false;
  };

  const handleDateRangeChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      dateRange: value,
    });
  };

  const handleUrgencyChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      urgency: value,
    });
  };

  const handleStatusChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      status: value,
    });
  };

  const handleRewardChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      hasReward: value,
    });
  };

  const handleSortChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      sort: value,
    });
  };

  const handleApply = () => {
    hapticFeedback('medium');
    if (isPostsMode) {
      setPostsFilters(localFilters);
    } else {
      setRequestsFilters(localFilters);
    }
    onApply();
    onClose();
  };

  const handleReset = () => {
    hapticFeedback('light');
    
    if (isPostsMode) {
      const defaultFilters = {
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
        tags: [],
        dateRange: 'all',
        sort: 'newest',
      };
      setLocalFilters(defaultFilters);
      clearPostsFilters();
    } else {
      const defaultFilters = {
        location: 'all',
        university: 'all',
        institute: 'all',
        campus_id: null,
        city: null,
        status: 'active',
        hasReward: 'all',
        urgency: 'all',
        sort: 'newest',
      };
      setLocalFilters(defaultFilters);
      clearRequestsFilters();
    }
    
    onApply();
    onClose();
  };

  const activeFiltersCount = () => {
    let count = 0;
    
    if (isPostsMode) {
      if (localFilters.location !== 'all') count++;
      if (localFilters.tags && localFilters.tags.length > 0) count++;
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


  return (
    <SwipeableModal
      isOpen={true}
      onClose={onClose}
      title={
        <div style={styles.titleWrapper}>
          <span>Фильтры {isPostsMode ? 'постов' : 'запросов'}</span>
          {activeCount > 0 && (
            <div style={styles.badge}>{activeCount}</div>
          )}
        </div>
      }
    >
      <div style={styles.container}>
        {/* Локация */}
        <Section title="📍 ЛОКАЦИЯ">
          <RadioGroup
            options={locationOptions}
            value={localFilters.location}
            onChange={handleLocationChange}
          />
        </Section>

        {/* ===== ФИЛЬТРЫ ДЛЯ ПОСТОВ ===== */}
        {isPostsMode && (
          <>
            <Section title="🏷️ ТЕГИ">
              <div style={styles.chipGroup}>
                {STUDENT_TAGS.map((tag) => (
                  <Chip
                    key={tag.id}
                    label={`${tag.emoji} ${tag.label}`}
                    selected={isTagSelected(tag.id)}
                    onClick={() => handleTagToggle(tag.id)}
                  />
                ))}
              </div>
            </Section>

            <Section title="📅 ДАТА ПУБЛИКАЦИИ">
              <div style={styles.chipGroup}>
                {dateRangeOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={`${option.icon} ${option.label}`}
                    selected={localFilters.dateRange === option.value}
                    onClick={() => handleDateRangeChange(option.value)}
                  />
                ))}
              </div>
            </Section>

            <Section title="🔥 СОРТИРОВКА">
              <div style={styles.sortingGrid}>
                {postsSortOptions.map((option) => (
                  <SortButton
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    selected={localFilters.sort === option.value}
                    onClick={() => handleSortChange(option.value)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ===== ФИЛЬТРЫ ДЛЯ ЗАПРОСОВ ===== */}
        {!isPostsMode && (
          <>
            <Section title="⚡ СРОЧНОСТЬ">
              <div style={styles.chipGroup}>
                {urgencyOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={`${option.icon} ${option.label}`}
                    selected={localFilters.urgency === option.value}
                    onClick={() => handleUrgencyChange(option.value)}
                  />
                ))}
              </div>
            </Section>

            <Section title="💰 ВОЗНАГРАЖДЕНИЕ">
              <div style={styles.chipGroup}>
                {rewardOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={`${option.icon} ${option.label}`}
                    selected={localFilters.hasReward === option.value}
                    onClick={() => handleRewardChange(option.value)}
                  />
                ))}
              </div>
            </Section>

            <Section title="📊 СТАТУС">
              <div style={styles.chipGroup}>
                {statusOptions.map((option) => (
                  <Chip
                    key={option.value}
                    label={`${option.icon} ${option.label}`}
                    selected={localFilters.status === option.value}
                    onClick={() => handleStatusChange(option.value)}
                  />
                ))}
              </div>
            </Section>

            <Section title="🔥 СОРТИРОВКА">
              <div style={styles.sortingGrid}>
                {requestsSortOptions.map((option) => (
                  <SortButton
                    key={option.value}
                    icon={option.icon}
                    label={option.label}
                    selected={localFilters.sort === option.value}
                    onClick={() => handleSortChange(option.value)}
                  />
                ))}
              </div>
            </Section>
          </>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={handleReset} style={styles.resetButton}>
            Сбросить
          </button>
          <button onClick={handleApply} style={styles.applyButton}>
            Применить
          </button>
        </div>
      </div>
    </SwipeableModal>
  );
};


// ===== ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ =====

const Section = ({ title, children }) => (
  <div style={styles.section}>
    <div style={styles.sectionTitle}>{title}</div>
    {children}
  </div>
);

const RadioGroup = ({ options, value, onChange }) => (
  <div style={styles.radioGroup}>
    {options.map((option) => (
      <button
        key={option.value}
        style={{
          ...styles.radioButton,
          ...(value === option.value ? styles.radioButtonActive : {}),
        }}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const Chip = ({ label, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.chip,
      ...(selected ? styles.chipActive : {}),
    }}
  >
    {label}
  </button>
);

const SortButton = ({ icon, label, selected, onClick }) => (
  <button
    onClick={onClick}
    style={{
      ...styles.sortButton,
      ...(selected ? styles.sortButtonActive : {}),
    }}
  >
    <span style={styles.sortIcon}>{icon}</span>
    <span style={styles.sortLabel}>{label}</span>
  </button>
);


// ===== СТИЛИ =====
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },

  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    position: 'relative',
  },

  badge: {
    background: theme.colors.primary,
    color: '#fff',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radius.full,
    minWidth: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },

  sectionTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    letterSpacing: '0.5px',
  },

  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },

  radioButton: {
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.fast,
    textAlign: 'left',
  },

  radioButtonActive: {
    background: theme.colors.card,
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },

  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  chip: {
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.full,
    padding: `${theme.spacing.sm}px ${theme.spacing.lg}px`,
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.fast,
  },

  chipActive: {
    background: theme.colors.primary,
    borderColor: theme.colors.primary,
    color: '#fff',
  },

  sortingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.sm,
  },

  sortButton: {
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: '10px 4px',
    color: theme.colors.text,
    cursor: 'pointer',
    transition: theme.transitions.fast,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: '100%',
  },

  sortButtonActive: {
    background: theme.colors.card,
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },

  sortIcon: {
    fontSize: 20,
  },

  sortLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },

  footer: {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  resetButton: {
    flex: 1,
    background: theme.colors.card,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },

  applyButton: {
    flex: 2,
    background: theme.colors.primary,
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
};


export default FiltersModal;