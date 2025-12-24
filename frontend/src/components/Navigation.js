import React from 'react';
import { Home, Search, PlusCircle, User, Users } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import theme from '../theme';
import { Z_NAVIGATION } from '../constants/zIndex';

function Navigation() {
  const { activeTab, setActiveTab, setShowCreateModal, isRegistered, setShowAuthModal } = useStore();
  
  const tabs = [
    { id: 'feed', icon: Home, label: 'Главная' },
    { id: 'search', icon: Search, label: 'Поиск' },
    { id: 'people', icon: Users, label: 'Люди' },
    { id: 'create', icon: PlusCircle, label: 'Создать' },
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  const handleTabClick = (tabId) => {
    hapticFeedback('light');
    
    if (!isRegistered && (tabId === 'create' || tabId === 'profile' || tabId === 'people')) {
      setShowAuthModal(true);
      return;
    }
    
    if (tabId === 'create') {
      setShowCreateModal(true);
      return;
    }
    
    setActiveTab(tabId);
  };

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
                style={styles.createButton}
              >
                <Icon size={28} strokeWidth={2.5} />
              </button>
            </div>
          );
        }

        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              ...styles.button,
              color: isActive ? theme.colors.primary : theme.colors.textDisabled
            }}
          >
            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
            {tab.label && <span style={styles.label}>{tab.label}</span>}
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
    fontWeight: theme.fontWeight.medium
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
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryHover} 100%)`,
    border: `4px solid ${theme.colors.bgSecondary}`,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: `0 8px 24px rgba(135, 116, 225, 0.4)`,
    transition: theme.transitions.normal
  }
};

export default Navigation;