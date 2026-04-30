// ===== 📄 ФАЙЛ: frontend/src/components/market/MarketFilters.js =====
import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import theme from '../../theme';
import SwipeableModal from '../shared/SwipeableModal';
import { useBottomSheetModal } from '../../hooks/useBottomSheetModal';
import { hapticFeedback } from '../../utils/telegram';
import { getCampusDisplayName, getUserCity } from '../../constants/universityData';
import { MARKET_CATEGORIES } from '../../constants/marketConstants';

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
  surfaceInput:    'rgba(255,255,255,0.05)',
  border:          'rgba(255,255,255,0.07)',
  borderInput:     'rgba(255,255,255,0.1)',
  muted:           '#888888',
  body:            '#D1D1D1',
  transUI:         '0.2s cubic-bezier(0.4,0,0.2,1)',
};


const MarketFilters = ({ onClose, onApply, resultsCount = null, fetchCount = null }) => {
  const { isOpen, requestClose } = useBottomSheetModal({ onClose });
  const { user, marketFilters, setMarketFilters, clearMarketFilters } = useStore();

  const [localFilters, setLocalFilters] = useState({ ...marketFilters });


  // ===== ОПЦИИ =====

  const cityLabel = getUserCity(user);

  const locationOptions = [
    { value: 'all',           label: 'Все'       },
    ...(user?.campus_id ? [{ value: 'my_campus',    label: 'Кампус'    }] : []),
    { value: 'my_university', label: 'Мой ВУЗ'   },
    ...(cityLabel ? [{ value: 'my_city', label: 'Мой город' }] : []),
  ];

  const priceQuickFilters = [
    { label: 'До 500₽',      min: null,  max: 500   },
    { label: '500–2000₽',    min: 500,   max: 2000  },
    { label: '2000–5000₽',   min: 2000,  max: 5000  },
    { label: '5000–10000₽',  min: 5000,  max: 10000 },
    { label: '10000+₽',      min: 10000, max: null  },
  ];

  const conditionOptions = [
    { value: 'new',      label: 'Новое',     icon: '✨' },
    { value: 'like_new', label: 'Как новое', icon: '⭐' },
    { value: 'good',     label: 'Хорошее',   icon: '👍' },
    { value: 'fair',     label: 'Удовл.',    icon: '👌' },
  ];

  const sortOptions = [
    { value: 'newest',     label: 'Новые',   icon: '🆕' },
    { value: 'price_asc',  label: 'Дешевле', icon: '📉' },
    { value: 'price_desc', label: 'Дороже',  icon: '📈' },
  ];


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

  const handleCategoryChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, category: localFilters.category === value ? 'all' : value });
  };

  const handleQuickPrice = (min, max) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, price_min: min, price_max: max });
  };

  const handlePriceInputChange = (field, value) => {
    const numValue = value ? parseInt(value) : null;
    setLocalFilters({ ...localFilters, [field]: numValue });
  };

  const handleConditionToggle = (value) => {
    hapticFeedback('selection');
    const currentConditions = localFilters.condition ? localFilters.condition.split(',') : [];
    const newConditions = currentConditions.includes(value)
      ? currentConditions.filter(c => c !== value)
      : [...currentConditions, value];
    setLocalFilters({ ...localFilters, condition: newConditions.length > 0 ? newConditions.join(',') : null });
  };

  const handleSortChange = (value) => {
    hapticFeedback('selection');
    setLocalFilters({ ...localFilters, sort: value });
  };

  const handleRemoveFilter = (key, defaultValue) => {
    hapticFeedback('selection');
    if (key === 'location') {
      setLocalFilters(prev => ({ ...prev, location: 'all', university: 'all', institute: 'all', campus_id: null, city: null }));
    } else if (key === 'price') {
      setLocalFilters(prev => ({ ...prev, price_min: null, price_max: null }));
    } else {
      setLocalFilters(prev => ({ ...prev, [key]: defaultValue }));
    }
  };

  const handleApply = () => {
    hapticFeedback('medium');
    setMarketFilters(localFilters);
    onApply();
    requestClose();
  };

  const handleReset = () => {
    hapticFeedback('light');
    const defaultFilters = {
      category: 'all', price_min: null, price_max: null, condition: null,
      location: 'all', university: 'all', institute: 'all', campus_id: null, city: null, sort: 'newest',
    };
    setLocalFilters(defaultFilters);
    clearMarketFilters();
    onApply();
    requestClose();
  };

  const isConditionSelected = (value) => {
    if (!localFilters.condition) return false;
    return localFilters.condition.split(',').includes(value);
  };

  const isPriceQuickActive = (f) =>
    localFilters.price_min === f.min && localFilters.price_max === f.max;

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

  const marketActiveBadges = (() => {
    const badges = [];
    if (localFilters.location !== 'all') {
      const opt = locationOptions.find(o => o.value === localFilters.location);
      badges.push({ key: 'location', label: '📍 ' + (opt?.label || localFilters.location), default: 'all' });
    }
    if (localFilters.category && localFilters.category !== 'all') {
      const cat = MARKET_CATEGORIES.find(c => c.id === localFilters.category);
      badges.push({ key: 'category', label: cat ? cat.icon + ' ' + cat.label : localFilters.category, default: 'all' });
    }
    if (localFilters.price_min !== null || localFilters.price_max !== null) {
      const minStr = localFilters.price_min != null ? localFilters.price_min + '₽' : '0';
      const maxStr = localFilters.price_max != null ? localFilters.price_max + '₽' : '∞';
      badges.push({ key: 'price', label: minStr + '–' + maxStr, default: null });
    }
    if (localFilters.condition) {
      const parts = localFilters.condition.split(',');
      const labels = parts.map(c => conditionOptions.find(o => o.value === c)?.label || c).join(', ');
      badges.push({ key: 'condition', label: labels, default: null });
    }
    if (localFilters.sort !== 'newest') {
      const opt = sortOptions.find(o => o.value === localFilters.sort);
      badges.push({ key: 'sort', label: opt?.label || localFilters.sort, default: 'newest' });
    }
    return badges;
  })();

  const badgeStyle = {
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
  };


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
          <span>Фильтры маркета</span>
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
          <button style={styles.resetButton} onClick={handleReset} className="pressable">
            Сбросить
          </button>
          <button style={styles.applyButton} onClick={handleApply} className="pressable">
            Применить
          </button>
        </div>
      }
    >
      <style>{`@keyframes filterShimmer{0%,100%{opacity:.25}50%{opacity:.6}}`}</style>
      <div style={styles.container}>

        {/* Active filters strip */}
        {marketActiveBadges.length > 0 && (
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
            {marketActiveBadges.map(badge => (
              <button
                key={badge.key}
                onClick={() => handleRemoveFilter(badge.key, badge.default)}
                style={badgeStyle}
              >
                {badge.label}
                <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
              </button>
            ))}
          </div>
        )}

        {/* Категория */}
        <SectionCard
          title="КАТЕГОРИЯ"
          isActive={localFilters.category && localFilters.category !== 'all'}
        >
          <MarketCategoryGrid
            categories={MARKET_CATEGORIES}
            selected={localFilters.category}
            onSelect={handleCategoryChange}
          />
        </SectionCard>

        {/* Локация */}
        <SectionCard title="ЛОКАЦИЯ" isActive={localFilters.location !== 'all'}>
          <SegmentedControl
            options={locationOptions}
            value={localFilters.location}
            onChange={handleLocationChange}
          />
        </SectionCard>

        {/* Цена */}
        <SectionCard
          title="ЦЕНА"
          isActive={localFilters.price_min !== null || localFilters.price_max !== null}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {priceQuickFilters.map((f, i) => (
              <button
                key={i}
                className="pressable"
                onClick={() => handleQuickPrice(f.min, f.max)}
                style={{
                  borderRadius: 9999,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid',
                  whiteSpace: 'nowrap',
                  transition: D.transUI,
                  background: isPriceQuickActive(f) ? D.accentBgStrong : 'rgba(255,255,255,0.06)',
                  color: isPriceQuickActive(f) ? D.accent : D.muted,
                  borderColor: isPriceQuickActive(f) ? D.accentBorder : 'transparent',
                  boxShadow: isPriceQuickActive(f) ? D.accentGlowBtn : 'none',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <PriceInput
              placeholder="0"
              value={localFilters.price_min || ''}
              onChange={(e) => handlePriceInputChange('price_min', e.target.value)}
            />
            <span style={{ color: D.muted, fontSize: 16, flexShrink: 0 }}>—</span>
            <PriceInput
              placeholder="∞"
              value={localFilters.price_max || ''}
              onChange={(e) => handlePriceInputChange('price_max', e.target.value)}
            />
          </div>
        </SectionCard>

        {/* Состояние */}
        <SectionCard title="СОСТОЯНИЕ" isActive={!!localFilters.condition}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {conditionOptions.map(option => {
              const isActive = isConditionSelected(option.value);
              return (
                <button
                  key={option.value}
                  className="pressable"
                  onClick={() => handleConditionToggle(option.value)}
                  style={{
                    borderRadius: 12,
                    padding: '12px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    border: '1px solid',
                    transition: D.transUI,
                    background: isActive ? D.accentBg : D.surfaceEl,
                    borderColor: isActive ? D.accentBorder : D.border,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{option.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: D.body, flex: 1, textAlign: 'left' }}>
                    {option.label}
                  </span>
                  <div style={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.18s ease, border-color 0.18s ease',
                    background: isActive ? D.accent : 'transparent',
                    border: '1.5px solid ' + (isActive ? D.accent : 'rgba(255,255,255,0.2)'),
                  }}>
                    {isActive && (
                      <span style={{ fontSize: 10, color: '#000', fontWeight: 700, lineHeight: 1 }}>✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Сортировка */}
        <SectionCard title="СОРТИРОВКА" isActive={localFilters.sort !== 'newest'}>
          <SortGrid
            options={sortOptions}
            value={localFilters.sort}
            onChange={handleSortChange}
          />
        </SectionCard>

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

const MarketCategoryGrid = ({ categories, selected, onSelect }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
  }}>
    {categories.map(cat => {
      const isActive = selected === cat.id;
      return (
        <button
          key={cat.id}
          className="pressable"
          onClick={() => onSelect(cat.id)}
          style={{
            borderRadius: 12,
            padding: '10px 4px',
            minHeight: 64,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: '1px solid ' + (isActive ? D.accentBorder : 'rgba(255,255,255,0.06)'),
            background: isActive ? D.accentBg : D.surface,
            transition: D.transUI,
          }}
        >
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: isActive ? D.accentBgStrong : 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            marginBottom: 5,
          }}>
            {cat.icon}
          </div>
          <div style={{
            fontSize: 10,
            textAlign: 'center',
            lineHeight: 1.2,
            color: isActive ? D.accent : D.muted,
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

const PriceInput = ({ placeholder, value, onChange }) => (
  <div className="mf-price-input" style={{
    flex: 1,
    background: D.surfaceInput,
    border: '1px solid ' + D.borderInput,
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
  }}>
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      style={{
        flex: 1,
        background: 'transparent',
        padding: '10px 12px',
        color: 'white',
        fontSize: 16,
        border: 'none',
        outline: 'none',
        width: '100%',
      }}
    />
    <span style={{ paddingRight: 12, color: '#555', fontSize: 14, flexShrink: 0 }}>₽</span>
  </div>
);


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


// CSS: убираем стрелки у number input + focus ring для price inputs
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
  .mf-price-input:focus-within {
    border-color: rgba(212,255,0,0.5) !important;
    transition: border-color 0.2s ease;
  }
`;
if (!document.getElementById('market-filters-styles')) {
  styleSheet.id = 'market-filters-styles';
  document.head.appendChild(styleSheet);
}


export default MarketFilters;
