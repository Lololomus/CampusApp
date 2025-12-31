// ===== 📄 ФАЙЛ: src/components/Navigation.js =====

import React from 'react';
import { Home, ShoppingBag, PlusCircle, User, Heart } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import theme from '../theme';
import { Z_NAVIGATION } from '../constants/zIndex';

function Navigation() {
  const {
    activeTab,
    setActiveTab,
    setShowCreateModal,
    setShowCreateRequestModal,
    setShowCreateMarketItem,
    feedSubTab,
    isRegistered,
    setShowAuthModal
  } = useStore();

  const tabs = [
    { id: 'feed', icon: Home, label: 'Лента' },
    { id: 'market', icon: ShoppingBag, label: 'Барахолка' },
    { id: 'create', icon: PlusCircle, label: 'Создать' },
    { id: 'people', icon: Heart, label: 'Знакомства' },
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  const handleTabClick = (tabId) => {
    hapticFeedback('light');

    if (!isRegistered && (tabId === 'create' || tabId === 'profile' || tabId === 'people' || tabId === 'market')) {
      setShowAuthModal(true);
      return;
    }

    if (tabId === 'create') {
      if (activeTab === 'market') {
        setShowCreateMarketItem(true); // Открываем CreateMarketItem напрямую!
      } else if (feedSubTab === 'requests') {
        setShowCreateRequestModal(true);
      } else {
        setShowCreateModal(true);
      }
      return;
    }

    setActiveTab(tabId);
  };

  // ✅ ОПРЕДЕЛЯЕМ, АКТИВЕН ЛИ РЕЖИМ БАРАХОЛКИ
  const isMarketContext = activeTab === 'market';
  
  // Цвета для маркета (зеленые)
  const marketColor = theme.colors.market || '#10b981';
  const marketGradient = `linear-gradient(135deg, ${theme.colors.marketGradientStart || '#059669'} 0%, ${theme.colors.marketGradientEnd || '#10b981'} 100%)`;
  const marketShadow = `0 8px 24px rgba(16, 185, 129, 0.4)`;

  // Цвета стандартные (фиолетовые)
  const primaryColor = theme.colors.primary;
  const primaryGradient = `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`;
  const primaryShadow = `0 8px 24px rgba(135, 116, 225, 0.4)`;

  return (
    <nav style={styles.nav}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const isCreateButton = tab.id === 'create';

        if (isCreateButton) {
          return (
            <div key={tab.id} style={styles.createButtonWrapper}>
              <button
                onClick={() => handleTabClick(tab.id)}
                style={{
                  ...styles.createButton,
                  // ✅ Динамическая смена цвета кнопки "+"
                  background: isMarketContext ? marketGradient : primaryGradient,
                  boxShadow: isMarketContext ? marketShadow : primaryShadow,
                  borderColor: theme.colors.bgSecondary, // Явно указываем цвет границы, чтобы не было конфликтов
                }}
              >
                <Icon size={28} />
              </button>
            </div>
          );
        }

        // ✅ Определение цвета активной иконки
        // Если это таб маркета и он активен -> зеленый. Иначе -> стандартный primary.
        const activeColor = tab.id === 'market' ? marketColor : primaryColor;

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              ...styles.button,
              color: isActive ? activeColor : theme.colors.textDisabled
            }}
          >
            <Icon size={24} />
            {tab.label && (
              <span 
                style={{
                  ...styles.label,
                  // Жирность шрифта для активного таба
                  fontWeight: isActive ? 700 : 500 
                }}
              >
                {tab.label}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: theme.colors.bgSecondary,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: Z_NAVIGATION
  },

  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.xs,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    transition: theme.transitions.normal,
    flex: 1
  },

  label: {
    fontSize: 11,
    transition: 'font-weight 0.2s ease', // Плавный переход жирности
  },

  createButtonWrapper: {
    position: 'relative',
    top: -20,
    flex: 1,
    display: 'flex',
    justifyContent: 'center'
  },

  createButton: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    // background и boxShadow теперь задаются инлайново в компоненте
    borderWidth: 4,
    borderStyle: 'solid',
    color: '#ffffff', // Всегда белый цвет иконки внутри
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: theme.transitions.normal
  }
};

export default Navigation;