// ===== 📄 ФАЙЛ: src/components/Market/MarketFilters.js =====

import React, { useState } from 'react';
import { useStore } from '../../store';
import theme from '../../theme';
import { Z_MARKET_FILTERS } from '../../constants/zIndex';

const MarketFilters = ({ onClose, onApply }) => {
  const { user, marketFilters, setMarketFilters, clearMarketFilters } = useStore();

  // Локальное состояние (до применения)
  const [localFilters, setLocalFilters] = useState({ ...marketFilters });

  // ===== ОПЦИИ =====
  
  // Локация
  const locationOptions = [
    { value: 'all', label: 'Все университеты' },
    { value: 'my_university', label: `Мой университет (${user?.university || 'ВШЭ'})` },
    { value: 'my_institute', label: `Мой институт (${user?.institute || 'ФКН'})` },
  ];

  // ✅ БЫСТРЫЕ ФИЛЬТРЫ ЦЕНЫ (ОБНОВЛЕНО)
  const priceQuickFilters = [
    { label: 'До 500₽', min: null, max: 500 },
    { label: '500-2000₽', min: 500, max: 2000 },
    { label: '2000-5000₽', min: 2000, max: 5000 },   // ✅ Добавлено
    { label: '5000-10000₽', min: 5000, max: 10000 }, // ✅ Изменено
    { label: '10000+₽', min: 10000, max: null },
  ];

  // Состояние товара
  const conditionOptions = [
    { value: 'new', label: 'Новое', icon: '✨' },
    { value: 'like-new', label: 'Как новое', icon: '⭐' },
    { value: 'good', label: 'Хорошее', icon: '👍' },
    { value: 'fair', label: 'Удовл.', icon: '👌' },
  ];

  // Сортировка
  const sortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'price_asc', label: 'Дешевле', icon: '📉' },
    { value: 'price_desc', label: 'Дороже', icon: '📈' },
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

  const handleQuickPrice = (min, max) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      price_min: min,
      price_max: max,
    });
  };

  const handlePriceInputChange = (field, value) => {
    const numValue = value ? parseInt(value) : null;
    setLocalFilters({
      ...localFilters,
      [field]: numValue,
    });
  };

  const handleConditionToggle = (value) => {
    haptic('light');
    const currentConditions = localFilters.condition ? localFilters.condition.split(',') : [];
    const newConditions = currentConditions.includes(value)
      ? currentConditions.filter(c => c !== value)
      : [...currentConditions, value];
    
    setLocalFilters({
      ...localFilters,
      condition: newConditions.length > 0 ? newConditions.join(',') : null,
    });
  };

  const handleSortChange = (value) => {
    haptic('light');
    setLocalFilters({
      ...localFilters,
      sort: value,
    });
  };

  const handleApply = () => {
    haptic('medium');
    setMarketFilters(localFilters);
    onApply();
    onClose();
  };

  const handleReset = () => {
    haptic('light');
    const defaultFilters = {
      category: 'all',
      price_min: null,
      price_max: null,
      condition: null,
      location: 'all',
      university: 'all',
      institute: 'all',
      sort: 'newest',
    };
    setLocalFilters(defaultFilters);
    clearMarketFilters();
    onApply();
    onClose();
  };

  const haptic = (type) => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

  const isConditionSelected = (value) => {
    if (!localFilters.condition) return false;
    return localFilters.condition.split(',').includes(value);
  };

  const activeFiltersCount = () => {
    let count = 0;
    if (localFilters.category && localFilters.category !== 'all') count++;
    if (localFilters.price_min !== null) count++;
    if (localFilters.price_max !== null) count++;
    if (localFilters.condition) count++;
    if (localFilters.location !== 'all') count++;
    if (localFilters.sort !== 'newest') count++;
    return count;
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>Фильтры</div>
          {activeFiltersCount() > 0 && (
            <div style={styles.badge}>{activeFiltersCount()}</div>
          )}
          <button style={styles.closeButton} onClick={onClose}>
            <span style={styles.closeIcon}>✕</span>
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* ===== ЛОКАЦИЯ ===== */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📍 Локация</div>
            <div style={styles.radioGroup}>
              {locationOptions.map((option) => (
                <button
                  key={option.value}
                  style={{
                    ...styles.radioButton,
                    ...(localFilters.location === option.value ? styles.radioButtonActive : {}),
                  }}
                  onClick={() => handleLocationChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* ===== ЦЕНА ===== */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>💰 Цена</div>
            
            <div style={styles.chipGroup}>
              {priceQuickFilters.map((filter, index) => (
                <button
                  key={index}
                  style={{
                    ...styles.chip,
                    ...(localFilters.price_min === filter.min && localFilters.price_max === filter.max
                      ? styles.chipActive
                      : {}),
                  }}
                  onClick={() => handleQuickPrice(filter.min, filter.max)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div style={styles.priceInputs}>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>От</label>
                <input
                  type="number"
                  placeholder="0"
                  value={localFilters.price_min || ''}
                  onChange={(e) => handlePriceInputChange('price_min', e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.inputDivider}>—</div>

              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>До</label>
                <input
                  type="number"
                  placeholder="1 000 000"
                  value={localFilters.price_max || ''}
                  onChange={(e) => handlePriceInputChange('price_max', e.target.value)}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* ===== СОСТОЯНИЕ (Грид 2x2) ===== */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📦 Состояние</div>
            <div style={styles.conditionGrid}>
              {conditionOptions.map((option) => (
                <button
                  key={option.value}
                  style={{
                    ...styles.checkboxButton,
                    ...(isConditionSelected(option.value) ? styles.checkboxButtonActive : {}),
                  }}
                  onClick={() => handleConditionToggle(option.value)}
                >
                  <span style={styles.checkboxIcon}>
                    {isConditionSelected(option.value) ? '☑️' : '⬜'}
                  </span>
                  <span>{option.icon} {option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ===== СОРТИРОВКА (Грид 1x3) ===== */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>🔄 Сортировка</div>
            <div style={styles.sortingGrid}>
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  style={{
                    ...styles.sortButton,
                    ...(localFilters.sort === option.value ? styles.sortButtonActive : {}),
                  }}
                  onClick={() => handleSortChange(option.value)}
                >
                  <span style={styles.sortIcon}>{option.icon}</span>
                  <span style={styles.sortLabel}>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.resetButton} onClick={handleReset}>
            Сбросить
          </button>
          <button style={styles.applyButton} onClick={handleApply}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    zIndex: Z_MARKET_FILTERS,
    display: 'flex',
    alignItems: 'flex-end',
    animation: 'fadeIn 0.3s ease',
  },

  modal: {
    width: '100%',
    maxHeight: '85vh',
    background: theme.colors.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

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
    background: theme.colors.market,
    color: theme.colors.text,
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
    fontSize: theme.fontSize.xl,
    color: theme.colors.textSecondary,
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },

  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },

  sectionTitle: {
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },

  // === ЛОКАЦИЯ ===
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
    border: `1px solid ${theme.colors.market}`,
    color: theme.colors.market,
  },

  // === ЦЕНА (Chips) ===
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
    background: theme.colors.market,
    border: `1px solid ${theme.colors.market}`,
    color: theme.colors.text,
  },

  // === ЦЕНА (Inputs - КОМПАКТНЫЕ) ===
  priceInputs: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
    marginTop: 4,
  },

  inputGroup: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },

  inputLabel: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontWeight: theme.fontWeight.medium,
    marginBottom: 2,
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '6px 10px',
    height: 34,
    color: theme.colors.text,
    fontSize: 13,
    outline: 'none',
    transition: theme.transitions.fast,
  },

  inputDivider: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.lg,
    marginBottom: 6,
  },

  // === СОСТОЯНИЕ (Grid 2x2) ===
  conditionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
  },

  checkboxButton: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    padding: '10px',
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    cursor: 'pointer',
    transition: theme.transitions.fast,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    textAlign: 'left',
  },

  checkboxButtonActive: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.market}`,
  },

  checkboxIcon: {
    fontSize: 16,
  },

  // === СОРТИРОВКА (Grid 1x3) ===
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
    gap: 6,
    height: '100%',
  },

  sortButtonActive: {
    background: theme.colors.card,
    border: `1px solid ${theme.colors.market}`,
    color: theme.colors.market,
  },

  sortIcon: {
    fontSize: 20,
  },

  sortLabel: {
    fontSize: 11,
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
    background: theme.colors.market,
    border: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: theme.colors.text,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
};

// CSS Animations & Global Styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    margin: 0; 
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
`;
document.head.appendChild(styleSheet);

export default MarketFilters;