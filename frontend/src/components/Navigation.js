// ===== 📄 ФАЙЛ: src/components/Navigation.js =====

import React, { useState, useEffect, useRef } from 'react';
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

  const [isBouncing, setIsBouncing] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const prevActiveTabRef = useRef(activeTab);
  const bounceTimeoutRef = useRef(null);

  // Боковые табы (без кнопки создания)
  const sideTabs = [
    { id: 'feed', icon: Home, label: 'Лента' },
    { id: 'market', icon: ShoppingBag, label: 'Барахолка' },
    { id: 'people', icon: Heart, label: 'Знакомства' },
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  const shouldShowCreateButton = activeTab === 'feed' || activeTab === 'market';

  useEffect(() => {
    setIsFirstRender(false);
  }, []);

  useEffect(() => {
    const prevTab = prevActiveTabRef.current;
    
    if (!isFirstRender && prevTab !== activeTab && shouldShowCreateButton) {
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current);
      }

      setIsBouncing(true);
      bounceTimeoutRef.current = setTimeout(() => {
        setIsBouncing(false);
      }, 600);
    }

    prevActiveTabRef.current = activeTab;

    return () => {
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current);
      }
    };
  }, [activeTab, shouldShowCreateButton, isFirstRender]);

  const handleTabClick = (tabId) => {
    hapticFeedback('light');
    
    if (!isRegistered && (tabId === 'create' || tabId === 'profile' || tabId === 'people' || tabId === 'market')) {
      setShowAuthModal(true);
      return;
    }
    
    if (tabId === 'create') {
      if (activeTab === 'market') {
        setShowCreateMarketItem(true);
      } else {
        setShowCreateModal(true);
      }
      return;
    }
    
    setActiveTab(tabId);
  };

  const isMarketContext = activeTab === 'market';
  
  const marketColor = theme.colors.market || '#10b981';
  const marketGradient = `linear-gradient(135deg, ${theme.colors.marketGradientStart || '#059669'} 0%, ${theme.colors.marketGradientEnd || '#10b981'} 100%)`;
  const marketShadow = `0 8px 24px rgba(16, 185, 129, 0.4)`;

  const primaryColor = theme.colors.primary;
  const primaryGradient = `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`;
  const primaryShadow = `0 8px 24px rgba(135, 116, 225, 0.4)`;

  return (
    <nav style={styles.nav}>
      {/* Контейнер для боковых кнопок */}
      <div style={styles.tabsContainer}>
        {sideTabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const activeColor = tab.id === 'market' ? marketColor : primaryColor;

          // Вставляем пустое место посередине для кнопки "+"
          const isAfterMiddle = index >= 2;

          return (
            <React.Fragment key={tab.id}>
              <button
                onClick={() => handleTabClick(tab.id)}
                style={{
                  ...styles.button,
                  color: isActive ? activeColor : theme.colors.textDisabled,
                  // Сдвигаем боковые кнопки когда центральная скрыта
                  transform: !shouldShowCreateButton 
                    ? (isAfterMiddle ? 'translateX(-20px)' : 'translateX(20px)')
                    : 'translateX(0)',
                }}
              >
                <Icon size={24} />
                {tab.label && (
                  <span 
                    style={{
                      ...styles.label,
                      fontWeight: isActive ? 700 : 500 
                    }}
                  >
                    {tab.label}
                  </span>
                )}
              </button>
              
              {/* Пустое место для центральной кнопки (после 2-го таба) */}
              {index === 1 && <div style={{ flex: 1 }} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Центральная кнопка "+" (абсолютное позиционирование) */}
      <div 
        style={{
          ...styles.createButtonWrapper,
          transform: shouldShowCreateButton 
            ? 'translateY(0)' 
            : 'translateY(100px)',
          opacity: shouldShowCreateButton ? 1 : 0,
          pointerEvents: shouldShowCreateButton ? 'auto' : 'none',
        }}
      >
        <button
          onClick={() => handleTabClick('create')}
          style={{
            ...styles.createButton,
            background: isMarketContext ? marketGradient : primaryGradient,
            boxShadow: isMarketContext ? marketShadow : primaryShadow,
            borderColor: theme.colors.bgSecondary,
            animation: isBouncing ? 'slideUpBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'none',
          }}
        >
          <PlusCircle size={28} />
        </button>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes slideUpBounce {
          0% {
            transform: translateY(20px) scale(0.8);
            opacity: 0;
          }
          50% {
            transform: translateY(-5px) scale(1.1);
          }
          70% {
            transform: translateY(2px) scale(0.95);
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
      `}</style>
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
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: Z_NAVIGATION,
  },

  tabsContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: '100%',
    position: 'relative',
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
    flex: 1,
    transition: `color ${theme.transitions.normal}, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`,
    willChange: 'transform',
  },

  label: {
    fontSize: 11,
    transition: 'font-weight 0.2s ease',
  },

  createButtonWrapper: {
    position: 'absolute',
    left: '50%',
    top: -20,
    marginLeft: -28, // Центрируем (половина ширины кнопки 56px)
    transition: `transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease`,
    willChange: 'transform, opacity',
    zIndex: 10,
  },

  createButton: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    borderWidth: 4,
    borderStyle: 'solid',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: `background ${theme.transitions.normal}, box-shadow ${theme.transitions.normal}`,
    willChange: 'transform',
  }
};

export default Navigation;