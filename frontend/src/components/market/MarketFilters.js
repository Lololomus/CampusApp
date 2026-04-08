// ===== 📄 ФАЙЛ: frontend/src/components/market/MarketFilters.js =====
import React, { useState } from 'react';
import { useStore } from '../../store';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import { hapticFeedback } from '../../utils/telegram';
import { getCampusDisplayName, getUserCity } from '../../constants/universityData';
import { MARKET_CATEGORIES } from '../../constants/marketConstants';


const MarketFilters = ({ onClose, onApply }) => {
  const { user, marketFilters, setMarketFilters, clearMarketFilters } = useStore();

  const [localFilters, setLocalFilters] = useState({ ...marketFilters });


  // ===== ОПЦИИ =====

  const campusLabel = getCampusDisplayName(user);
  const cityLabel = getUserCity(user);
  const marketThemes = MARKET_CATEGORIES.map((category) => ({
    value: category.id,
    label: `${category.icon} ${category.label}`,
  }));
  
  const locationOptions = [
    { value: 'all', label: 'Все университеты' },
    ...(user?.campus_id ? [{ value: 'my_campus', label: `Мой кампус (${campusLabel})` }] : []),
    { value: 'my_university', label: `Мой ВУЗ (${user?.university || '—'})` },
    ...(cityLabel ? [{ value: 'my_city', label: `Мой город (${cityLabel})` }] : []),
  ];

  const priceQuickFilters = [
    { label: 'До 500₽', min: null, max: 500 },
    { label: '500-2000₽', min: 500, max: 2000 },
    { label: '2000-5000₽', min: 2000, max: 5000 },   
    { label: '5000-10000₽', min: 5000, max: 10000 }, 
    { label: '10000+₽', min: 10000, max: null },
  ];

  const conditionOptions = [
    { value: 'new', label: 'Новое', icon: '✨' },
    { value: 'like_new', label: 'Как новое', icon: '⭐' },
    { value: 'good', label: 'Хорошее', icon: '👍' },
    { value: 'fair', label: 'Удовл.', icon: '👌' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Новые', icon: '🆕' },
    { value: 'price_asc', label: 'Дешевле', icon: '📉' },
    { value: 'price_desc', label: 'Дороже', icon: '📈' },
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

  const handleCategoryChange = (value) => {
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      category: localFilters.category === value ? 'all' : value,
    });
  };

  const handleQuickPrice = (min, max) => {
    hapticFeedback('light');
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
    hapticFeedback('light');
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
    hapticFeedback('light');
    setLocalFilters({
      ...localFilters,
      sort: value,
    });
  };

  const handleApply = () => {
    hapticFeedback('medium');
    setMarketFilters(localFilters);
    onApply();
    onClose();
  };

  const handleReset = () => {
    hapticFeedback('light');
    const defaultFilters = {
      category: 'all',
      price_min: null,
      price_max: null,
      condition: null,
      location: 'all',
      university: 'all',
      institute: 'all',
      campus_id: null,
      city: null,
      sort: 'newest',
    };
    setLocalFilters(defaultFilters);
    clearMarketFilters();
    onApply();
    onClose();
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

  const activeCount = activeFiltersCount();


  return (
    <SwipeableModal
      isOpen={true}
      onClose={onClose}
      showHeaderDivider={false}
      title={
        <div style={styles.titleWrapper}>
          <span>Фильтры</span>
          {activeCount > 0 && (
            <div style={styles.badge}>{activeCount}</div>
          )}
        </div>
      }
      footer={
        <div style={styles.footer}>
          <button style={styles.resetButton} onClick={handleReset}>
            Сбросить
          </button>
          <button style={styles.applyButton} onClick={handleApply}>
            Применить
          </button>
        </div>
      }
    >
      <div style={styles.container}>
        <Section title="Темы">
          <div style={styles.chipGroup}>
            {marketThemes.map((themeOption) => (
              <button
                key={themeOption.value}
                style={{
                  ...styles.chip,
                  ...(localFilters.category === themeOption.value ? styles.chipActive : {}),
                }}
                onClick={() => handleCategoryChange(themeOption.value)}
              >
                {themeOption.label}
              </button>
            ))}
          </div>
        </Section>

        {/* ===== ЛОКАЦИЯ ===== */}
        <Section title="📍 ЛОКАЦИЯ">
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
        </Section>

        {/* ===== ЦЕНА ===== */}
        <Section title="💰 ЦЕНА">
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
        </Section>

        {/* ===== СОСТОЯНИЕ ===== */}
        <Section title="📦 СОСТОЯНИЕ">
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
        </Section>

        {/* ===== СОРТИРОВКА ===== */}
        <Section title="🔄 СОРТИРОВКА">
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
        </Section>

      </div>
    </SwipeableModal>
  );
};


// ===== ВСПОМОГАТЕЛЬНЫЙ КОМПОНЕНТ =====
const Section = ({ title, children }) => (
  <div style={styles.section}>
    <div style={styles.sectionTitle}>{title}</div>
    {children}
  </div>
);


// ===== СТИЛИ =====
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },

  // Title с badge
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    position: 'relative',
  },

  badge: {
    background: theme.colors.premium.primary,
    color: theme.colors.premium.primaryText,
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.bold,
    padding: `0 ${theme.spacing.md}px`,
    borderRadius: theme.radius.full,
    minWidth: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section
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
    borderColor: theme.colors.premium.primary,
    color: theme.colors.premium.primary,
  },

  // === ЦЕНА (Chips) ===
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
    background: theme.colors.premium.primary,
    borderColor: theme.colors.premium.primary,
    color: '#000',
  },

  // === ЦЕНА (Inputs) ===
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
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
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: theme.colors.border,
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
    borderColor: theme.colors.premium.primary,
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
    borderColor: theme.colors.premium.primary,
    color: theme.colors.premium.primary,
  },

  sortIcon: {
    fontSize: 20,
  },

  sortLabel: {
    fontSize: 11,
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },

  // === FOOTER ===
  footer: {
    display: 'flex',
    gap: theme.spacing.md,
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
    background: theme.colors.premium.primary,
    borderWidth: 0,
    borderStyle: 'none',
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
    color: '#000',
    fontSize: theme.fontSize.base,
    fontWeight: theme.fontWeight.semibold,
    cursor: 'pointer',
    transition: theme.transitions.normal,
  },
};


// CSS для убирания стрелок у input[type=number]
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    margin: 0; 
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
`;
if (!document.getElementById('market-filters-styles')) {
  styleSheet.id = 'market-filters-styles';
  document.head.appendChild(styleSheet);
}


export default MarketFilters;
