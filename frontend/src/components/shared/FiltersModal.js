// ===== 📄 ФАЙЛ: src/components/shared/FiltersModal.js =====

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✅ ИМПОРТИРУЕМ PORTAL
import { useStore } from '../../store';
import theme from '../../theme';
import { Z_OVERLAY, Z_MODAL_MARKET_FILTERS } from '../../constants/zIndex';

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

  // Определяем контекст (посты или запросы)
  const isPostsMode = feedSubTab === 'posts';
  
  // Локальное состояние (до применения)
  const [localFilters, setLocalFilters] = useState(
    isPostsMode ? { ...postsFilters } : { ...requestsFilters }
  );

  // Обновляем локальное состояние если изменился feedSubTab
  useEffect(() => {
    setLocalFilters(isPostsMode ? { ...postsFilters } : { ...requestsFilters });
  }, [feedSubTab, postsFilters, requestsFilters, isPostsMode]);


  // ===== ОПЦИИ ДЛЯ ПОСТОВ =====
  
  // Студенческие теги (хардкод)
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

  // Диапазон дат для постов
  const dateRangeOptions = [
    { value: 'all', label: 'Всё время', icon: '📅' },
    { value: 'today', label: 'Сегодня', icon: '🌅' },
    { value: 'week', label: 'Неделя', icon: '📆' },
    { value: 'month', label: 'Месяц', icon: '📊' },
  ];

  // Сортировка для постов
  const postsSortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'popular', label: 'Популярные', icon: '🔥' },
    { value: 'discussed', label: 'Обсуждаемые', icon: '💬' },
  ];


  // ===== ОПЦИИ ДЛЯ ЗАПРОСОВ =====

  // Срочность
  const urgencyOptions = [
    { value: 'all', label: 'Все', icon: '📋' },
    { value: 'soon', label: 'Срочно (<24ч)', icon: '⚡' },
    { value: 'later', label: 'Не срочно', icon: '⏰' },
  ];

  // Статус
  const statusOptions = [
    { value: 'active', label: 'Активные', icon: '✅' },
    { value: 'all', label: 'Все', icon: '📋' },
  ];

  // Вознаграждение
  const rewardOptions = [
    { value: 'all', label: 'Все', icon: '📋' },
    { value: 'with', label: 'С наградой', icon: '💰' },
    { value: 'without', label: 'Без награды', icon: '🎁' },
  ];

  // Сортировка для запросов
  const requestsSortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'expires_soon', label: 'Истекают', icon: '⏰' },
    { value: 'most_responses', label: 'Популярные', icon: '🔥' },
  ];


  // ===== ОБЩИЕ ОПЦИИ =====

  // Локация (одинаковая для постов и запросов)
  const locationOptions = [
    { value: 'all', label: 'Все университеты' },
    { value: 'my_university', label: `Мой университет (${user?.university || 'ВШЭ'})` },
    { value: 'my_institute', label: `Мой институт (${user?.institute || 'ФКН'})` },
  ];


  // ===== HANDLERS =====

  const handleLocationChange = (value) => {
    haptic('light');
    if (value === 'all') {
      setLocalFilters({
        ...localFilters,
        location: 'all',
        university: 'all',
        institute: 'all',
      });
    } else if (value === 'my_university') {
      setLocalFilters({
        ...localFilters,
        location: 'my_university',
        university: user?.university,
        institute: 'all',
      });
    } else if (value === 'my_institute') {
      setLocalFilters({
        ...localFilters,
        location: 'my_institute',
        university: user?.university,
        institute: user?.institute,
      });
    }
  };

  // Теги (только для постов)
  const handleTagToggle = (tagId) => {
    haptic('light');
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

  // Диапазон дат (только для постов)
  const handleDateRangeChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      dateRange: value,
    });
  };

  // Срочность (только для запросов)
  const handleUrgencyChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      urgency: value,
    });
  };

  // Статус (только для запросов)
  const handleStatusChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      status: value,
    });
  };

  // Вознаграждение (только для запросов)
  const handleRewardChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      hasReward: value,
    });
  };

  // Сортировка (общая)
  const handleSortChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      sort: value,
    });
  };

  const handleApply = () => {
    haptic('medium');
    if (isPostsMode) {
      setPostsFilters(localFilters);
    } else {
      setRequestsFilters(localFilters);
    }
    onApply();
    onClose();
  };

  const handleReset = () => {
    haptic('light');
    
    if (isPostsMode) {
      const defaultFilters = {
        location: 'all',
        university: 'all',
        institute: 'all',
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

  const haptic = (type) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  // Подсчёт активных фильтров
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

  // ✅ РЕНДЕРИМ ЧЕРЕЗ PORTAL
  const modalContent = (
    <>
      {/* Overlay */}
      <div style={styles.overlay} onClick={onClose} />

      {/* Modal */}
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            Фильтры {isPostsMode ? 'постов' : 'запросов'}
            {activeCount > 0 && (
              <div style={styles.badge}>{activeCount}</div>
            )}
          </div>
          <button
            onClick={() => {
              haptic('light');
              onClose();
            }}
            style={styles.closeButton}
          >
            <span style={styles.closeIcon}>×</span>
          </button>
        </div>

        {/* Content (scrollable) */}
        <div style={styles.content}>
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
              {/* Теги */}
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

              {/* Дата */}
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

              {/* Сортировка */}
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
              {/* Срочность */}
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

              {/* Вознаграждение */}
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

              {/* Статус */}
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

              {/* Сортировка */}
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
        </div>

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
    </>
  );

  // ✅ ВОЗВРАЩАЕМ ЧЕРЕЗ PORTAL
  return createPortal(modalContent, document.body);
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
  // Overlay
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: Z_OVERLAY,
    display: 'flex',
    alignItems: 'flex-end',
    animation: 'fadeIn 0.3s ease',
  },

  // Modal
  modal: {
    position: 'fixed', // ✅ ДОБАВИЛИ position: fixed
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    maxHeight: '85vh',
    background: theme.colors.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
    zIndex: Z_MODAL_MARKET_FILTERS, // ✅ ДОБАВИЛИ z-index
  },

  // Header
  header: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },

  headerTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },

  badge: {
    position: 'absolute',
    left: theme.spacing.lg,
    background: theme.colors.primary,
    color: '#fff',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.bold,
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    borderRadius: theme.radius.full,
  },

  closeButton: {
    position: 'absolute',
    right: theme.spacing.lg,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.sm,
  },

  closeIcon: {
    fontSize: theme.fontSize.xxl,
    color: theme.colors.textSecondary,
  },

  // Content
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },

  // Section
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

  // Radio Group (Локация)
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },

  radioButton: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
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
    border: `1px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
  },

  // Chips (Теги, Дата, Срочность и т.д.)
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  chip: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
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
    border: `1px solid ${theme.colors.primary}`,
    color: '#fff',
  },

  // Sorting Grid (1x3)
  sortingGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing.sm,
  },

  sortButton: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px 4px',
    color: theme.colors.text,
    cursor: 'pointer',
    transition: theme.transitions.fast,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    height: '100%',
  },

  sortButtonActive: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
  },

  sortIcon: {
    fontSize: '20px',
  },

  sortLabel: {
    fontSize: '11px',
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },

  // Footer
  footer: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
  },

  resetButton: {
    flex: 1,
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
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
    border: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: '#fff',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
};

// CSS Animations (Global Styles)
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
`;
document.head.appendChild(styleSheet);

export default FiltersModal;