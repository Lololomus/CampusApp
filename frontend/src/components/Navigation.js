import React from 'react';
import { Home, Search, PlusCircle, User, Users } from 'lucide-react';
import { useStore } from '../store';
import { hapticFeedback } from '../utils/telegram';
import DatingFeed from './dating/DatingFeed';

function Navigation() {
  const { activeTab, setActiveTab, setShowCreateModal } = useStore();
  
  const tabs = [
    { id: 'feed', icon: Home, label: 'Главная' },
    { id: 'search', icon: Search, label: 'Поиск' },
    { id: 'people', icon: Users, label: 'Люди' },  // ← НОВЫЙ ТАБ
    { id: 'create', icon: PlusCircle, label: 'Создать' },
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  const handleTabClick = (tabId) => {
    hapticFeedback('light');
    
    // Если кликнули на "создать" - открываем модалку
    if (tabId === 'create') {
      setShowCreateModal(true); // ИСПРАВЛЕНО
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

        // Центральная кнопка создания
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

        // Обычные кнопки навигации
        return (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            style={{
              ...styles.button,
              color: isActive ? '#8774e1' : '#666'
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
    height: '64px',
    backgroundColor: '#1a1a1a',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 'env(safe-area-inset-bottom)',
    zIndex: 1
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px 12px',
    transition: 'color 0.2s',
    flex: 1
  },
  label: {
    fontSize: '11px',
    fontWeight: '500'
  },
  createButtonWrapper: {
    position: 'relative',
    top: '-20px',
    flex: 1,
    display: 'flex',
    justifyContent: 'center'
  },
  createButton: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8774e1 0%, #6b5dd3 100%)',
    border: '4px solid #1a1a1a',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(135, 116, 225, 0.4)',
    transition: 'transform 0.2s'
  }
};

export default Navigation;