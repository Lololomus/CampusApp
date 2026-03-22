// ===== 📄 ФАЙЛ: src/components/Navigation.js =====
// 4 таба: Лента, Маркет, Знакомства, Профиль
// Центральная кнопка "+" между 2-м и 3-м табом
// Доступ к модерации/админке — через кнопки в Profile

import React, { useState, useEffect, useRef } from 'react';
import { Home, ShoppingBag, Plus, User, Heart } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import { triggerRegistrationPrompt } from '../api';
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
    setShowAuthModal,
    unreadNotificationsCount,
  } = useStore();

  const [isBouncing, setIsBouncing] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const prevActiveTabRef = useRef(activeTab);
  const bounceTimeoutRef = useRef(null);
  const outerRef = useRef(null);
  const isProd = import.meta.env.PROD;

  // В prod dating-сегмент скрыт; в dev доступен для тестирования
  const sideTabs = [
    { id: 'feed', icon: Home, label: 'Лента' },
    { id: 'market', icon: ShoppingBag, label: 'Маркет' },
    ...(!isProd ? [{ id: 'people', icon: Heart, label: 'Знакомства' }] : []),
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  const shouldShowCreateButton = activeTab === 'feed' || activeTab === 'market';

  // Индекс, после которого вставляем пустое место под "+" кнопку
  const middleInsertAfter = 1;

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

  // Скрываем навигацию при открытии клавиатуры (iOS двигает fixed-элементы вверх)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const el = outerRef.current;
      if (!el) return;
      const keyboardHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.transition = 'transform 0.25s ease';
      el.style.transform = keyboardHeight > 50 ? `translateY(${keyboardHeight}px)` : 'translateY(0)';
    };
    vv.addEventListener('resize', handleResize);
    vv.addEventListener('scroll', handleResize);
    return () => {
      vv.removeEventListener('resize', handleResize);
      vv.removeEventListener('scroll', handleResize);
    };
  }, []);

  const handleTabClick = (tabId) => {
    hapticFeedback('light');

    if (!isRegistered && (tabId === 'create' || tabId === 'profile' || tabId === 'people')) {
      if (tabId === 'people') {
        triggerRegistrationPrompt('open_dating_tab');
      } else if (tabId === 'profile') {
        triggerRegistrationPrompt('open_profile_tab');
      } else {
        setShowAuthModal(true);
      }
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

  const p = theme.colors.premium;

  return (
    <div ref={outerRef} style={styles.outerWrapper}>
      <nav style={styles.nav}>
        {/* Контейнер для боковых кнопок */}
        <div style={styles.tabsContainer}>
          {sideTabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            const isAfterMiddle = index >= middleInsertAfter + 1;

            return (
              <React.Fragment key={tab.id}>
                <button
                  onClick={() => handleTabClick(tab.id)}
                  style={{
                    ...styles.button,
                    color: isActive ? '#FFFFFF' : p.textMuted,
                    transform: !shouldShowCreateButton
                      ? (isAfterMiddle ? 'translateX(-20px)' : 'translateX(20px)')
                      : 'translateX(0)',
                  }}
                >
                  {/* Индикатор активного таба */}
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      top: -8,
                      width: 24,
                      height: 4,
                      borderRadius: '0 0 4px 4px',
                      background: '#FFFFFF',
                      boxShadow: '0 4px 12px rgba(255,255,255,0.4)',
                    }} />
                  )}
                  {tab.id === 'profile' && unreadNotificationsCount > 0 ? (
                    <div style={{ position: 'relative' }}>
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                      <div style={{
                        position: 'absolute', top: -2, right: -3,
                        width: 8, height: 8, borderRadius: 4,
                        background: '#FF453A',
                        border: '1.5px solid #2C2C2E',
                      }} />
                    </div>
                  ) : (
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                  )}
                </button>

                {/* Пустое место для центральной кнопки (после 2-го таба) */}
                {index === middleInsertAfter && <div style={{ flex: 1 }} />}
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
              background: p.primary,
              boxShadow: `0 4px 16px rgba(212, 255, 0, 0.40)`,
              animation: isBouncing ? 'slideUpBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'none',
            }}
          >
            <Plus size={26} strokeWidth={3} />
          </button>
        </div>

        {/* Keyframe animations */}
        <style>{`
          @keyframes slideUpBounce {
            0% { transform: translateY(20px) scale(0.8); opacity: 0; }
            50% { transform: translateY(-5px) scale(1.1); }
            70% { transform: translateY(2px) scale(0.95); }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
        `}</style>
      </nav>
    </div>
  );
}

const styles = {
  outerWrapper: {
    position: 'fixed',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: Z_NAVIGATION,
    pointerEvents: 'none',
    display: 'flex',
    justifyContent: 'center',
  },

  nav: {
    background: theme.colors.premium.surfaceElevated,
    borderRadius: 32,
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    pointerEvents: 'auto',
    boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
    position: 'relative',
  },

  tabsContainer: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    position: 'relative',
  },

  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    flex: 1,
    height: 48,
    position: 'relative',
    transition: `color ${theme.transitions.normal}, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)`,
    willChange: 'transform',
  },

  createButtonWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -24,
    marginTop: -24,
    transition: `transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease`,
    willChange: 'transform, opacity',
    zIndex: 10,
  },

  createButton: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    border: 'none',
    color: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: `background ${theme.transitions.normal}, box-shadow ${theme.transitions.normal}`,
    willChange: 'transform',
  },
};

export default Navigation;
