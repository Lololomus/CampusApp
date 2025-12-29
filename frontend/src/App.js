// ===== 📄 ФАЙЛ: src/App.js =====

import React, { useEffect } from 'react';
import { useStore } from './store';
import { initTelegramApp } from './utils/telegram';
import Navigation from './components/Navigation';
import Feed from './components/Feed';
import PostDetail from './components/PostDetail';
import CreatePost from './components/CreatePost';
import CreateRequestModal from './components/requests/CreateRequestModal';
import Onboarding from './components/Onboarding';
import AuthModal from './components/AuthModal';
import EditProfile from './components/EditProfile';
import Profile from './components/Profile';
import UserPosts from './components/UserPosts';
import DatingFeed from './components/dating/DatingFeed';
import Market from './components/market/Market';
import CreateMarketItem from './components/market/CreateMarketItem';
import './App.css';

function App() {
  const { 
    activeTab, 
    viewPostId, 
    showCreateModal,
    showCreateRequestModal,
    showCreateMarketItem,
    editingMarketItem,       // ✅ NEW: Достаем редактируемый товар
    setEditingMarketItem,    // ✅ NEW: Сеттер для очистки
    setShowCreateMarketItem, // ✅ NEW: Управление видимостью
    onboardingStep,
    showUserPosts
  } = useStore();

  useEffect(() => {
    initTelegramApp();
  }, []);

  const renderContent = () => {
    // Если открыт детальный просмотр поста
    if (viewPostId) {
      return <PostDetail />;
    }

    // Экран "Мои посты"
    if (showUserPosts) {
      return <UserPosts />;
    }

    // Остальные экраны
    switch (activeTab) {
      case 'feed':
        return <Feed />;
      case 'market':
        return <Market />;
      case 'people':
        return <DatingFeed />;
      case 'profile':
        return <Profile />;
      default:
        return <Feed />;
    }
  };
  
  // Если идёт онбординг - показываем только его
  if (onboardingStep > 0) {
    return (
      <div style={styles.app}>
        <Onboarding />
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {renderContent()}
      <Navigation />
      
      {/* Модальные окна */}
      {showCreateModal && <CreatePost />}
      
      {showCreateRequestModal && (
        <CreateRequestModal 
          onClose={() => useStore.getState().setShowCreateRequestModal(false)} 
        />
      )}

      {/* ✅ NEW: Модалка создания/редактирования товара */}
      {showCreateMarketItem && (
        <CreateMarketItem 
          editItem={editingMarketItem} // Передаем данные для редактирования (или null)
          onClose={() => {
            setEditingMarketItem(null); // Обязательно сбрасываем режим редактирования!
            setShowCreateMarketItem(false);
          }}
          onSuccess={() => {
            setEditingMarketItem(null); // Сбрасываем и закрываем
            setShowCreateMarketItem(false);
          }}
        />
      )}

      <AuthModal />
      <EditProfile />
    </div>
  );
}

const styles = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#121212',
    color: '#fff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
};

export default App;